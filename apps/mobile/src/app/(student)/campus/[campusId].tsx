import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { operationalService } from "@/services/operational.service";
import type { ServiceLine } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

const busIsolatedImage = require("../../../../assets/images/images_upsgo/bus-isolated.png");

export default function ServiceLinesScreen() {
  const { campusId, name } = useLocalSearchParams<{
    campusId: string;
    name?: string;
  }>();
  const router = useRouter();

  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!campusId) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        setLines(await operationalService.getServiceLines(campusId));
      } catch (requestError) {
        setError(getOperationalErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [campusId],
  );

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [load]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(student)/(tabs)");
    }
  };

  const filteredLines = lines.filter((line) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const matchName = line.name.toLowerCase().includes(query);
    const matchCode = line.code.toLowerCase().includes(query);
    const matchDesc = line.description?.toLowerCase().includes(query) ?? false;
    return matchName || matchCode || matchDesc;
  });

  return (
    <AppScreen>
      <ScreenHeader
        title="Líneas disponibles"
        subtitle={name || "Campus"}
        back
        onBack={handleBack}
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={18}
            color="#64748B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar ruta o sector..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Buscar ruta"
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Limpiar búsqueda"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="No pudimos cargar las líneas"
            message={error}
            action={
              <Pressable onPress={() => void load()} style={styles.retryButton}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            }
          />
        ) : (
          <FlatList
            data={filteredLines}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load(true)}
                tintColor={Colors.primary}
              />
            }
            ListHeaderComponent={
              /* Visual Hero Banner with Bus illustration & No heavy text */
              <View style={styles.campusHeroBanner}>
                <View style={styles.heroCopyWrap}>
                  <View style={styles.heroBadgeRow}>
                    <Ionicons name="location" size={13} color="#60A5FA" />
                    <Text style={styles.heroBadgeText}>Sede Universitaria</Text>
                  </View>
                  <Text
                    style={styles.heroCampusName}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {name || "Campus Seleccionado"}
                  </Text>
                  <View style={styles.heroPill}>
                    <Ionicons name="bus" size={12} color="#052E67" />
                    <Text style={styles.heroPillText}>
                      {lines.length}{" "}
                      {lines.length === 1 ? "ruta activa" : "rutas activas"}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroImageWrap}>
                  <Image
                    source={busIsolatedImage}
                    style={styles.heroBusImage}
                    resizeMode="contain"
                    accessible={false}
                  />
                </View>
              </View>
            }
            ListEmptyComponent={
              searchQuery.trim().length > 0 ? (
                <InlineState
                  icon="search-outline"
                  title="No se encontraron rutas"
                  message={`No hay líneas que coincidan con "${searchQuery}".`}
                  action={
                    <Pressable
                      onPress={() => setSearchQuery("")}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>Borrar búsqueda</Text>
                    </Pressable>
                  }
                />
              ) : (
                <InlineState
                  icon="bus-outline"
                  title="No hay líneas para este campus"
                  message="Aún no hay líneas activas disponibles para esta sede."
                />
              )
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Línea ${item.name}`}
                style={({ pressed }) => [
                  styles.routeCard,
                  pressed && styles.cardPressed,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/(student)/service-line/[serviceLineId]",
                    params: { serviceLineId: item.id, name: item.name },
                  })
                }
              >
                {/* Top Row: Code Tag + Direction Badge */}
                <View style={styles.cardTopRow}>
                  <View style={styles.codeTag}>
                    <Ionicons
                      name="git-branch"
                      size={13}
                      color={Colors.primary}
                    />
                    <Text style={styles.codeTagText}>{item.code}</Text>
                  </View>

                  <View style={styles.cardHeaderSpacer} />

                  <View style={styles.directionBadge}>
                    <Ionicons
                      name="swap-horizontal"
                      size={13}
                      color="#07508E"
                    />
                    <Text style={styles.directionBadgeText}>Ida y Retorno</Text>
                  </View>
                </View>

                {/* Route Name */}
                <View style={styles.cardBody}>
                  <Text
                    style={styles.routeName}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text
                      style={styles.routeDescription}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                {/* Footer Action */}
                <View style={styles.cardFooter}>
                  <Text style={styles.actionText}>Ver salidas programadas</Text>
                  <View style={styles.actionIconWrap}>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={Colors.primary}
                    />
                  </View>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontFamily: "Inter-Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    gap: 12,
    paddingBottom: 40,
  },
  campusHeroBanner: {
    backgroundColor: "#052E67",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    shadowColor: Colors.navy,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: "hidden",
  },
  heroCopyWrap: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    paddingRight: 10,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroBadgeText: {
    color: "#93C5FD",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  heroCampusName: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 16,
    lineHeight: 21,
  },
  heroPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF3FB",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    marginTop: 2,
  },
  heroPillText: {
    color: "#052E67",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
  },
  heroImageWrap: {
    width: 105,
    height: 75,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBusImage: {
    width: 105,
    height: 75,
  },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    gap: 10,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  codeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EBF3FB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0E2F5",
  },
  codeTagText: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
    letterSpacing: 0.5,
  },
  cardHeaderSpacer: {
    flex: 1,
    minWidth: 6,
  },
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F6FC",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCE7F3",
    flexShrink: 0,
  },
  directionBadgeText: {
    color: "#07508E",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
  },
  cardBody: {
    gap: 3,
    minWidth: 0,
  },
  routeName: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 16,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  routeDescription: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 12.5,
    lineHeight: 17,
    flexShrink: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  actionText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
  },
  actionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EBF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  retryButton: {
    marginTop: 10,
  },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
});
