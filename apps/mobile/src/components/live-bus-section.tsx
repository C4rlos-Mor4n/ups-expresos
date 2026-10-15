import { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LiveMap, type LiveMapHandle, type LiveMapState } from "@/components/live-map/live-map";
import { Colors } from "@/constants/Colors";
import { useLivePolling } from "@/hooks/use-live-polling";
import { operationalService } from "@/services/operational.service";
import type { DepartureLive, JourneyStop, LiveBus } from "@/types/operational";
import { liveStatusCopy, phaseLabel, type LiveTone } from "@/utils/live";

const refreshFrom = (value: DepartureLive) => value.refreshAfterSeconds;

const toneColor: Record<LiveTone, string> = { live: "#0F8A6B", stale: "#B7791F", muted: "#7A8799" };
const toneBg: Record<LiveTone, string> = { live: "#E3F5EE", stale: "#FFF4D8", muted: "#EEF2F7" };

export function mapStateFrom(stops: JourneyStop[], buses: LiveBus[], myStopId: string | null): LiveMapState {
  return {
    stops: stops
      .filter((stop) => typeof stop.latitude === "number" && typeof stop.longitude === "number")
      .map((stop) => ({
        latitude: stop.latitude!,
        longitude: stop.longitude!,
        name: stop.name,
        order: stop.order,
        highlight: stop.id === myStopId,
      })),
    buses: buses
      .filter((bus) => bus.tracking.position)
      .map((bus) => ({
        id: bus.assignmentId,
        latitude: bus.tracking.position!.latitude,
        longitude: bus.tracking.position!.longitude,
        heading: bus.tracking.position!.heading,
        label: bus.vehicle.code,
        live: bus.tracking.position!.freshness === "LIVE",
      })),
  };
}

/**
 * "Tu bus en vivo": mapa con la ubicación real (Hunter) de los buses de la salida.
 * Solo aparece cuando el servicio está por salir o en curso; se refresca solo.
 */
export function LiveBusSection({
  departureId,
  stops,
  myStopId,
}: {
  departureId: string;
  stops: JourneyStop[];
  myStopId: string | null;
}) {
  const map = useRef<LiveMapHandle>(null);
  const fetcher = useCallback(() => operationalService.getDepartureLive(departureId), [departureId]);
  const { data } = useLivePolling<DepartureLive>(fetcher, refreshFrom);

  const visibleBuses = useMemo(() => (data?.buses ?? []).filter((bus) => bus.phase !== "NOT_LIVE"), [data]);
  const mapState = useMemo(() => mapStateFrom(stops, visibleBuses, myStopId), [stops, visibleBuses, myStopId]);

  if (visibleBuses.length === 0) return null;
  const anyPosition = mapState.buses.length > 0;
  const headline = liveStatusCopy(visibleBuses[0]!);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{visibleBuses.length > 1 ? "Tus buses en vivo" : "Tu bus en vivo"}</Text>
        <View style={[styles.pill, { backgroundColor: toneBg[headline.tone] }]}>
          <View style={[styles.dot, { backgroundColor: toneColor[headline.tone] }]} />
          <Text style={[styles.pillText, { color: toneColor[headline.tone] }]}>{headline.title}</Text>
        </View>
      </View>

      {anyPosition ? (
        <View>
          <LiveMap ref={map} state={mapState} style={styles.map} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Centrar el mapa en el bus"
            onPress={() => map.current?.focusBus()}
            style={[styles.mapButton, { right: 56 }]}
          >
            <Ionicons name="bus" size={18} color={Colors.navy} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver todo el recorrido"
            onPress={() => map.current?.recenter()}
            style={styles.mapButton}
          >
            <Ionicons name="scan-outline" size={18} color={Colors.navy} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.noMap}>
          <Ionicons name="navigate-circle-outline" size={28} color="#7A8799" />
          <Text style={styles.noMapText}>{headline.detail}</Text>
        </View>
      )}

      {visibleBuses.map((bus) => {
        const copy = liveStatusCopy(bus);
        const phase = phaseLabel(bus);
        return (
          <View key={bus.assignmentId} style={styles.busRow}>
            <View style={[styles.busIcon, { backgroundColor: toneBg[copy.tone] }]}>
              <Ionicons name="bus" size={18} color={toneColor[copy.tone]} />
            </View>
            <View style={styles.busCopy}>
              <Text style={styles.busTitle}>
                {bus.vehicle.code} · {bus.vehicle.plate}
              </Text>
              {phase ? <Text style={styles.busPhase}>{phase}</Text> : null}
              <Text style={styles.busDetail}>{copy.detail}</Text>
            </View>
          </View>
        );
      })}

      {anyPosition ? (
        <Text style={styles.footnote}>
          Ubicación GPS del bus. La línea punteada une las paradas: es referencial, no el trazado exacto.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5EDF7",
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 17 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: "Inter-Bold", fontSize: 12 },
  map: { height: 260, borderRadius: 16 },
  mapButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.navy,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  noMap: { alignItems: "center", gap: 6, paddingVertical: 18, backgroundColor: "#F4F7FB", borderRadius: 16 },
  noMapText: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13, textAlign: "center", paddingHorizontal: 16 },
  busRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  busIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  busCopy: { flex: 1, minWidth: 0, gap: 1 },
  busTitle: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 14 },
  busPhase: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 12 },
  busDetail: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 12 },
  footnote: { color: "#94A3B8", fontFamily: "Inter-Regular", fontSize: 11, lineHeight: 15 },
});
