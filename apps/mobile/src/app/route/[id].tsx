import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useFavorites } from "../../context/FavoritesContext";
import { mobileService } from "../../services/mobile.service";
import { RouteDetail, Schedule } from "../../types/route";
import { Ionicons } from "@expo/vector-icons";

const DAY_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mie",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sab", SUNDAY: "Dom",
};

function buildScheduleSummary(schedules: Schedule[]) {
  if (!schedules || schedules.length === 0) return null;
  const byDirection: Record<string, Schedule[]> = {};
  schedules.forEach((s) => {
    const dir = s.direction ?? "default";
    if (!byDirection[dir]) byDirection[dir] = [];
    byDirection[dir].push(s);
  });
  return Object.entries(byDirection).map(([_dir, items]) => {
    const days = [...new Set(items.map((s) => s.dayOfWeek))].sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)
    );
    const dayRange =
      days.length === 1
        ? (DAY_SHORT[days[0]] ?? days[0])
        : (DAY_SHORT[days[0]] ?? days[0]) + " - " + (DAY_SHORT[days[days.length - 1]] ?? days[days.length - 1]);
    const allTimes = items.map((s) => s.departureTime.substring(0, 5)).sort();
    const displayTimes = allTimes.slice(0, 5).join(", ") + (allTimes.length > 5 ? "..." : "");
    let frecuencia = "";
    if (allTimes.length >= 2) {
      const p1 = allTimes[0].split(":").map(Number);
      const p2 = allTimes[1].split(":").map(Number);
      const diff = p2[0] * 60 + p2[1] - (p1[0] * 60 + p1[1]);
      if (diff > 0 && diff <= 90) frecuencia = "Frecuencia: cada " + diff + " min";
    }
    return { dayRange, displayTimes, frecuencia };
  });
}

function getStatusConfig(status: string) {
  switch (status) {
    case "ACTIVE":    return { label: "Operativa",  color: "#1E9E57", bg: "#DDF7E5" };
    case "SUSPENDED": return { label: "Suspendida", color: "#E65100", bg: "#FFF3E0" };
    default:          return { label: "Inactiva",   color: "#D32F2F", bg: "#FFEBEE" };
  }
}

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite, getFavoriteDetail } = useFavorites();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const styles = makeStyles(colors);

  useEffect(() => {
    if (id) loadRouteDetail(id as string);
  }, [id]);

  const loadRouteDetail = async (routeId: string) => {
    try {
      setLoading(true);
      const data = await mobileService.getRouteDetail(routeId);
      const rd = data as any;
      setRoute({ ...rd.route, stops: rd.stops, schedules: rd.schedules } as RouteDetail);
    } catch (error) {
      console.error("Error loading route details", error);
      const offline = getFavoriteDetail(routeId);
      if (offline) setRoute(offline);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background.main }}>
        <ActivityIndicator size="large" color={colors.button.primary} />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background.main }}>
        <Text style={{ color: colors.text.light }}>Error al cargar la ruta.</Text>
      </View>
    );
  }

  const statusConfig = getStatusConfig(route.status);
  const scheduleSummary = buildScheduleSummary(route.schedules ?? []);
  const totalStops = route.stops?.length ?? 0;
  const isFav = isFavorite(route.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={2}>{route.name}</Text>
        </View>
        <Pressable style={styles.starBtn} hitSlop={8} onPress={() => toggleFavorite(route)}>
          <Ionicons name={isFav ? "star" : "star-outline"} size={24} color={isFav ? "#FFD600" : "#FFFFFF"} />
        </Pressable>
      </View>

      <View style={styles.badgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
        </View>
      </View>

      {!!route.direction && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Direccion</Text>
          <Text style={styles.sectionText}>{route.direction}</Text>
        </View>
      )}

      {!!route.description && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descripcion</Text>
          <Text style={styles.sectionText}>{route.description}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{"Paradas" + (totalStops > 0 ? " (" + totalStops + ")" : "")}</Text>
        {route.stops && route.stops.length > 0 ? (
          route.stops.map((stopInfo) => (
            <Pressable
              key={stopInfo.id}
              style={({ pressed }) => [styles.stopItem, pressed && { opacity: 0.7 }]}
              onPress={() => router.push({ pathname: "/stop/[id]", params: {
                id: stopInfo.stop.id,
                routeId: route.id,
                stopOrder: stopInfo.stopOrder,
                totalStops: totalStops,
                estimatedArrivalMinutes: stopInfo.estimatedArrivalMinutes,
                stopName: stopInfo.stop.name,
                stopReference: stopInfo.stop.reference,
              }})}
            >
              <View style={styles.stopBullet}>
                <Text style={styles.stopBulletText}>{stopInfo.stopOrder}</Text>
              </View>
              <Text style={styles.stopName}>{stopInfo.stop.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.text.light} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.sectionText}>No hay paradas registradas.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Horarios aproximados</Text>
        {scheduleSummary && scheduleSummary.length > 0 ? (
          scheduleSummary.map((item, i) => (
            <View key={i} style={i > 0 ? { marginTop: 14 } : undefined}>
              <Text style={styles.scheduleDay}>{item.dayRange}</Text>
              <Text style={styles.scheduleTimes}>{item.displayTimes}</Text>
              {!!item.frecuencia && <Text style={styles.scheduleFreq}>{item.frecuencia}</Text>}
            </View>
          ))
        ) : (
          <Text style={styles.sectionText}>No hay horarios registrados.</Text>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [styles.mapBtn, pressed && { opacity: 0.85 }]}
        onPress={() => router.push("/map/" + id)}
      >
        <Ionicons name="map-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
        <Text style={styles.mapBtnText}>Ver mapa de la ruta</Text>
      </Pressable>
    </ScrollView>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.main },
    content:   { paddingBottom: 40 },
    header: { backgroundColor: "#0056B8", flexDirection: "row", alignItems: "center", paddingTop: 55, paddingBottom: 16, paddingHorizontal: 16 },
    backBtn: { marginRight: 12 },
    starBtn: { marginLeft: 10, padding: 4 },
    headerTitleContainer: { flex: 1 },
    headerTitle: { fontSize: 17, fontFamily: "Inter-Bold", color: "#FFFFFF", lineHeight: 22 },
    badgeRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
    statusBadge: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
    statusText: { fontSize: 13, fontFamily: "Inter-SemiBold" },
    section: { backgroundColor: "#FFFFFF", marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    sectionLabel: { fontSize: 14, fontFamily: "Inter-Bold", color: colors.text.dark, marginBottom: 8 },
    sectionText:  { fontSize: 14, fontFamily: "Inter-Regular", color: colors.text.light, lineHeight: 20 },
    stopItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    stopBullet: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0056B8", alignItems: "center", justifyContent: "center", marginRight: 12 },
    stopBulletText: { fontSize: 12, fontFamily: "Inter-Bold", color: "#FFFFFF" },
    stopName: { flex: 1, fontSize: 14, fontFamily: "Inter-SemiBold", color: colors.text.dark },
    scheduleDay:   { fontSize: 14, fontFamily: "Inter-Bold",    color: colors.text.dark,  marginBottom: 3 },
    scheduleTimes: { fontSize: 14, fontFamily: "Inter-Regular", color: colors.text.light, lineHeight: 20 },
    scheduleFreq:  { fontSize: 13, fontFamily: "Inter-Regular", color: colors.text.light, marginTop: 2 },
    mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#0056B8", marginHorizontal: 16, marginTop: 20, borderRadius: 14, paddingVertical: 16, elevation: 3, shadowColor: "#0056B8", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    mapBtnText: { fontSize: 16, fontFamily: "Inter-Bold", color: "#FFFFFF" },
  });
}