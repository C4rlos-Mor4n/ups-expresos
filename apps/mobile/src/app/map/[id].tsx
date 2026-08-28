import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../context/ThemeContext";
import { mobileService } from "../../services/mobile.service";
import { RouteDetail } from "../../types/route";
import LeafletMap, { LeafletMapHandle } from "../../components/LeafletMap";
import { getErrorMessage } from "../../utils/error-message";

export default function MapScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const leafletRef = useRef<LeafletMapHandle>(null);

  const styles = makeStyles(colors);

  useEffect(() => {
    if (id) {
      loadRouteDetail(id as string);
    }
  }, [id]);

  const loadRouteDetail = async (routeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const { route: routeData, stops, schedules } = await mobileService.getRouteDetail(routeId);
      setRoute({
        ...routeData,
        stops,
        schedules,
      });
    } catch (err) {
      console.error("Error loading route details", err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCenter = () => {
    leafletRef.current?.fitToStops();
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.button.primary} />
        <Text style={[styles.loadingText, { color: colors.text.light }]}>
          Cargando mapa...
        </Text>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !route) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.text.light} />
        <Text style={[styles.errorTitle, { color: colors.text.light }]}>
          Sin conexión
        </Text>
        <Text style={[styles.errorMsg, { color: colors.text.light }]}>
          {error ?? "Error desconocido al cargar la ruta."}
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => id && loadRouteDetail(id as string)}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  // Extract stops ordered by stopOrder
  const orderedStops = [...(route.stops ?? [])].sort(
    (a, b) => a.stopOrder - b.stopOrder
  );

  const hasStops = orderedStops.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {route.name}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {hasStops ? (
          <LeafletMap ref={leafletRef} stops={orderedStops} />
        ) : (
          <View style={[styles.center, { flex: 1 }]}>
            <Ionicons name="map-outline" size={48} color={colors.text.light} />
            <Text style={{ color: colors.text.light, marginTop: 12 }}>
              Esta ruta no tiene paradas con coordenadas.
            </Text>
          </View>
        )}

        {/* Floating overlay: notice card */}
        <View style={styles.noticeCard}>
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#0056B8"
            style={styles.noticeIcon}
          />
          <Text style={styles.noticeText}>
            Este mapa muestra las paradas y el recorrido referencial. No es tiempo real.
          </Text>
        </View>

        {/* Floating overlay: legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Leyenda</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendLine} />
            <Text style={styles.legendText}>Recorrido de la ruta</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>Paradas</Text>
          </View>
        </View>

        {/* Center map button */}
        {hasStops && (
          <Pressable style={styles.centerLocationBtn} onPress={handleCenter}>
            <Ionicons name="locate" size={24} color="#0056B8" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.main,
    },
    center: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontFamily: "Inter-Medium",
    },
    errorTitle: {
      marginTop: 16,
      fontSize: 20,
      fontFamily: "Inter-Bold",
      textAlign: "center",
    },
    errorMsg: {
      marginTop: 8,
      fontSize: 14,
      fontFamily: "Inter-Medium",
      textAlign: "center",
      lineHeight: 20,
    },
    retryBtn: {
      marginTop: 24,
      backgroundColor: "#0056B8",
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 10,
    },
    retryText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: "Inter-SemiBold",
    },
    header: {
      backgroundColor: "#0056B8",
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 55,
      paddingBottom: 16,
      paddingHorizontal: 16,
      zIndex: 10,
    },
    backBtn: {
      marginRight: 12,
      padding: 4,
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
    },
    mapContainer: {
      flex: 1,
    },
    noticeCard: {
      position: "absolute",
      top: 16,
      left: 16,
      right: 16,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      padding: 12,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    noticeIcon: {
      marginRight: 10,
    },
    noticeText: {
      flex: 1,
      color: colors.text.dark,
      fontSize: 13,
      fontFamily: "Inter-Medium",
      lineHeight: 18,
    },
    legendCard: {
      position: "absolute",
      bottom: 24,
      left: 16,
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      padding: 14,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
      minWidth: 160,
    },
    legendTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 10,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    legendLine: {
      width: 20,
      height: 3,
      backgroundColor: "#0056B8",
      marginRight: 8,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: "#0056B8",
      marginRight: 12,
      marginLeft: 4,
    },
    legendText: {
      fontSize: 13,
      fontFamily: "Inter-Medium",
      color: colors.text.dark,
    },
    centerLocationBtn: {
      position: "absolute",
      bottom: 24,
      right: 16,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: "#FFFFFF",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
  });
}
