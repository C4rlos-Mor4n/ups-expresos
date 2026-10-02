import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
} from "@/components/operational-ui";
import {
  FavoriteButton,
  LinkButton,
  studentStyles,
} from "@/components/student-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import { studentPreferencesService } from "@/services/student-preferences.service";
import type { Campus, ServiceLine } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

interface CampusWithLines {
  campus: Campus;
  lines: ServiceLine[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Servicios: todas las líneas agrupadas por campus, a un toque de sus horarios. */
export default function ServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [groups, setGroups] = useState<CampusWithLines[]>([]);
  const [preferredCampusId, setPreferredCampusId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        setError(null);
        const [campuses, savedCampusId, prefs] = await Promise.all([
          operationalService.getCampuses(),
          userId ? campusPreferenceService.getPreferredCampusId(userId) : null,
          userId ? studentPreferencesService.get(userId) : null,
        ]);
        const withLines = await Promise.all(
          campuses.map(async (campus) => ({
            campus,
            lines: await operationalService.getServiceLines(campus.id),
          })),
        );
        // El campus principal del estudiante va primero.
        withLines.sort(
          (a, b) =>
            Number(b.campus.id === savedCampusId) - Number(a.campus.id === savedCampusId),
        );
        setGroups(withLines);
        setPreferredCampusId(savedCampusId);
        setFavorites(prefs?.favoriteLineIds ?? []);
      } catch (requestError) {
        setError(getOperationalErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleFavorite = async (lineId: string) => {
    if (!userId) return;
    setFavorites(await studentPreferencesService.toggleFavoriteLine(userId, lineId));
  };

  const q = normalize(query.trim());
  const visible = groups
    .map((group) => {
      if (!q) return group;
      const campusMatches =
        normalize(group.campus.name).includes(q) ||
        normalize(group.campus.address ?? "").includes(q);
      return {
        ...group,
        lines: campusMatches
          ? group.lines
          : group.lines.filter(
              (line) =>
                normalize(line.name).includes(q) ||
                normalize(line.description ?? "").includes(q),
            ),
      };
    })
    .filter((group) => group.lines.length > 0 || (!q && group.lines.length === 0));

  return (
    <AppScreen>
      <ScreenHeader title="Servicios" subtitle="Rutas y horarios por campus" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.search}>
          <Ionicons name="search-outline" size={19} color={Colors.text.light} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar campus, ruta o sector"
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            accessibilityLabel="Buscar campus o ruta"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery("")}
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
            title="No pudimos cargar los servicios"
            message={error}
            action={<LinkButton label="Reintentar" onPress={() => void load()} />}
          />
        ) : visible.length === 0 ? (
          <InlineState
            icon={q ? "search-outline" : "business-outline"}
            title={q ? "Sin resultados" : "No hay campus disponibles"}
            message={
              q
                ? `No encontramos rutas para "${query.trim()}".`
                : "Cuando el servicio tenga campus activos, aparecerán aquí."
            }
            action={q ? <LinkButton label="Borrar búsqueda" onPress={() => setQuery("")} /> : undefined}
          />
        ) : (
          visible.map(({ campus, lines }) => (
            <View key={campus.id} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleRow}>
                  <Text style={styles.groupTitle} numberOfLines={1}>
                    {campus.name}
                  </Text>
                  {campus.id === preferredCampusId ? (
                    <View style={styles.mineTag}>
                      <Text style={styles.mineTagText}>Tu campus</Text>
                    </View>
                  ) : null}
                </View>
                {campus.address ? (
                  <Text style={styles.groupAddress} numberOfLines={1}>
                    {campus.address}
                  </Text>
                ) : null}
              </View>

              {lines.length === 0 ? (
                <Text style={styles.emptyLines}>Este campus aún no tiene rutas publicadas.</Text>
              ) : (
                <View style={studentStyles.list}>
                  {lines.map((line, index) => (
                    <View key={line.id}>
                      {index > 0 ? <View style={studentStyles.divider} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ver horarios de ${line.name}`}
                        onPress={() =>
                          router.push({
                            pathname: "/(student)/service-line/[serviceLineId]",
                            params: { serviceLineId: line.id, name: line.name },
                          })
                        }
                        style={({ pressed }) => [styles.lineRow, pressed && styles.pressed]}
                      >
                        <View style={styles.lineIcon}>
                          <Ionicons name="bus" size={18} color={Colors.primary} />
                        </View>
                        <View style={styles.lineCopy}>
                          <Text style={styles.lineName} numberOfLines={1}>
                            {line.name}
                          </Text>
                          <Text style={styles.lineMeta} numberOfLines={1}>
                            {line.description?.trim() || "Ida y retorno · ver horarios"}
                          </Text>
                        </View>
                        <FavoriteButton
                          active={favorites.includes(line.id)}
                          onPress={() => void toggleFavorite(line.id)}
                        />
                        <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 120 },
  pressed: { opacity: 0.85 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.dark,
    fontFamily: "Inter-Regular",
    fontSize: 15,
    paddingVertical: 10,
  },
  group: { gap: 10 },
  groupHeader: { gap: 2, paddingHorizontal: 2 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTitle: { flexShrink: 1, color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 17 },
  groupAddress: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 },
  mineTag: {
    backgroundColor: "#FFF4D8",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  mineTagText: { color: "#8A5A00", fontFamily: "Inter-Bold", fontSize: 12 },
  emptyLines: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    paddingHorizontal: 2,
  },
  lineRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  lineIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  lineCopy: { flex: 1, minWidth: 0, gap: 2 },
  lineName: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 16 },
  lineMeta: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 },
});
