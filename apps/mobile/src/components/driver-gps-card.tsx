import { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LiveMap, type LiveMapState } from "@/components/live-map/live-map";
import { Colors } from "@/constants/Colors";
import { useLivePolling } from "@/hooks/use-live-polling";
import { operationalService } from "@/services/operational.service";
import type { DriverRouteStop, LiveBus } from "@/types/operational";
import { liveStatusCopy, type LiveTone } from "@/utils/live";

const DRIVER_REFRESH_SECONDS = 15;
const fixedRefresh = () => DRIVER_REFRESH_SECONDS;
const toneColor: Record<LiveTone, string> = { live: "#0F8A6B", stale: "#B7791F", muted: "#7A8799" };
const toneBg: Record<LiveTone, string> = { live: "#E3F5EE", stale: "#FFF4D8", muted: "#EEF2F7" };

/**
 * "GPS del bus" para el conductor: confirma que el equipo Hunter del vehículo está reportando
 * (lo que ven los estudiantes en el mapa). El conductor no envía ubicación desde su teléfono.
 */
export function DriverGpsCard({
  assignmentId,
  stops,
  showMap = true,
}: {
  assignmentId: string;
  stops: DriverRouteStop[];
  showMap?: boolean;
}) {
  const fetcher = useCallback(() => operationalService.getDriverAssignmentLive(assignmentId), [assignmentId]);
  const { data: bus, error } = useLivePolling<LiveBus>(fetcher, fixedRefresh);

  const mapState = useMemo<LiveMapState>(() => {
    const position = bus?.tracking.position;
    return {
      stops: stops
        .filter((s) => typeof s.stop.latitude === "number" && typeof s.stop.longitude === "number")
        .map((s) => ({ latitude: s.stop.latitude!, longitude: s.stop.longitude!, name: s.stop.name, order: s.stopOrder })),
      buses: position
        ? [{ id: assignmentId, latitude: position.latitude, longitude: position.longitude, heading: position.heading, label: bus!.vehicle.code, live: position.freshness === "LIVE" }]
        : [],
    };
  }, [assignmentId, bus, stops]);

  if (!bus) {
    if (!error) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.title}>GPS del bus</Text>
        <Text style={styles.detail}>No pudimos consultar el GPS. Revisa tu conexión.</Text>
      </View>
    );
  }

  const copy = liveStatusCopy(bus, "driver");
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: toneBg[copy.tone] }]}>
          <Ionicons name="navigate" size={18} color={toneColor[copy.tone]} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>GPS del bus · {copy.title}</Text>
          <Text style={styles.detail}>{copy.detail}</Text>
        </View>
      </View>
      {showMap && mapState.buses.length > 0 ? <LiveMap state={mapState} style={styles.map} /> : null}
      <Text style={styles.footnote}>
        Los estudiantes ven esta ubicación desde 30 min antes de la salida y durante el recorrido.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 14 },
  detail: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 18 },
  map: { height: 200, borderRadius: 14 },
  footnote: { color: "#94A3B8", fontFamily: "Inter-Regular", fontSize: 11, lineHeight: 15 },
});
