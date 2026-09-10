import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import type { Campus } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

export default function CampusesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [preferredCampusId, setPreferredCampusId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const [backendCampuses, savedPrefId] = await Promise.all([
          operationalService.getCampuses(),
          userId
            ? campusPreferenceService.getPreferredCampusId(userId)
            : Promise.resolve(null),
        ]);

        setCampuses(backendCampuses);
        setPreferredCampusId(savedPrefId);
      } catch (requestError) {
        setError(getOperationalErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [load]);

  const filteredCampuses = campuses.filter((campus) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();
    const matchName = campus.name.toLowerCase().includes(query);
    const matchAddress = campus.address?.toLowerCase().includes(query) ?? false;
    const matchCode = campus.code.toLowerCase().includes(query);
    return matchName || matchAddress || matchCode;
  });

  return (
    <AppScreen>
      <ScreenHeader
        title="Servicios"
        subtitle="Explora las sedes y rutas universitarias"
      />

      <View style={styles.container}>
        {/* Search & Filter Bar */}
        <View style={styles.searchBarContainer}>
          <Ionicons
            name="search-outline"
            size={19}
            color="#64748B"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar campus o dirección..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Buscar campus"
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

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Sedes universitarias</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {filteredCampuses.length}{" "}
              {filteredCampuses.length === 1 ? "sede" : "sedes"}
            </Text>
          </View>
        </View>

        {/* Content List */}
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="No pudimos cargar los campus"
            message={error}
            action={
              <Pressable onPress={() => void load()} style={styles.retryButton}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            }
          />
        ) : (
          <FlatList
            data={filteredCampuses}
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
            ListEmptyComponent={
              searchQuery.trim().length > 0 ? (
                <InlineState
                  icon="search-outline"
                  title="No se encontraron sedes"
                  message={`No hay resultados para "${searchQuery}". Intenta con otro término.`}
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
                  icon="business-outline"
                  title="No hay campus disponibles"
                  message="Cuando el servicio tenga campus activos, aparecerán aquí."
                />
              )
            }
            renderItem={({ item }) => {
              const isPreferred = item.id === preferredCampusId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Campus ${item.name}`}
                  style={({ pressed }) => [
                    styles.campusCard,
                    isPreferred && styles.campusCardPreferred,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(student)/campus/[campusId]",
                      params: { campusId: item.id, name: item.name },
                    })
                  }
                >
                  {/* Top Row: Icon + Code + Preferred Badge */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.campusIconBox}>
                      <Ionicons
                        name="business"
                        size={22}
                        color={Colors.primary}
                      />
                    </View>

                    <View style={styles.codeTag}>
                      <Text style={styles.codeTagText}>{item.code}</Text>
                    </View>

                    <View style={styles.cardHeaderSpacer} />

                    {isPreferred ? (
                      <View style={styles.preferredBadge}>
                        <Ionicons name="star" size={12} color="#D97706" />
                        <Text style={styles.preferredBadgeText}>
                          Tu campus preferido
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Campus Name & Address */}
                  <View style={styles.cardBody}>
                    <Text
                      style={styles.campusName}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                    <View style={styles.locationRow}>
                      <Ionicons
                        name="location-sharp"
                        size={14}
                        color="#F59E0B"
                        style={styles.locationIcon}
                      />
                      <Text
                        style={styles.campusAddress}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {item.address || "Guayaquil, Ecuador"}
                      </Text>
                    </View>
                  </View>

                  {/* Informative Tags */}
                  <View style={styles.tagsRow}>
                    <View style={styles.tagPill}>
                      <Ionicons name="bus-outline" size={13} color="#07508E" />
                      <Text style={styles.tagPillText}>
                        Rutas de transporte
                      </Text>
                    </View>
                    <View style={styles.tagPill}>
                      <Ionicons
                        name="swap-horizontal"
                        size={13}
                        color="#07508E"
                      />
                      <Text style={styles.tagPillText}>Ida y Retorno</Text>
                    </View>
                  </View>

                  {/* Action Link Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.actionText}>
                      Explorar líneas y horarios
                    </Text>
                    <View style={styles.actionIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Colors.primary}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            }}
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
    marginTop: 12,
    marginBottom: 14,
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: "#1E293B",
    fontFamily: "Inter-Bold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countPillText: {
    color: "#475569",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
  },
  listContent: {
    gap: 14,
    paddingBottom: 100,
  },
  campusCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    gap: 12,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  campusCardPreferred: {
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FAFF",
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
  campusIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EBF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  codeTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
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
  preferredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexShrink: 0,
  },
  preferredBadgeText: {
    color: "#92400E",
    fontFamily: "Inter-Bold",
    fontSize: 11,
  },
  cardBody: {
    gap: 4,
    minWidth: 0,
  },
  campusName: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 16.5,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    minWidth: 0,
  },
  locationIcon: {
    marginTop: 2,
  },
  campusAddress: {
    flex: 1,
    flexShrink: 1,
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 2,
  },
  tagPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0F6FC",
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DCE7F3",
    flexShrink: 1,
  },
  tagPillText: {
    color: "#07508E",
    fontFamily: "Inter-Medium",
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  actionText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 13.5,
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
    marginTop: 12,
  },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
});
