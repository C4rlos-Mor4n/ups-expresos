import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/Colors";
import { TripStatus } from "../types/route";
import { getRouteStatusLabel, getRouteStatusVariant, RouteOperationVariant } from "../utils/route-status";

interface RouteOperationBadgeProps {
  status: TripStatus | null | undefined;
}

// Mapa de colores por variante semántica. Usa tokens existentes de Colors;
// no se hardcodean colores dentro de pantallas.
const VARIANT_STYLE: Record<RouteOperationVariant, { bg: string; fg: string }> = {
  scheduled: { bg: "#E7F0FB", fg: Colors.button.primary },
  active: { bg: "#E4F4EA", fg: Colors.success },
  completed: { bg: "#EDF1F4", fg: Colors.text.light },
  cancelled: { bg: "#FDEBEB", fg: Colors.error },
  suspended: { bg: "#FFF4E0", fg: Colors.warning },
};

export default function RouteOperationBadge({ status }: RouteOperationBadgeProps) {
  if (!status) return null;

  const variant = getRouteStatusVariant(status);
  const label = getRouteStatusLabel(status);
  const palette = VARIANT_STYLE[variant] ?? VARIANT_STYLE.scheduled;

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]} accessibilityRole="text">
      <Text style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter-SemiBold",
  },
});