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
import { useFavoriteStops } from "../../context/FavoriteStopsContext";
import { useRoutes } from "../../context/RoutesContext";
import { mobileService } from "../../services/mobile.service";
import { Route } from "../../types/route";
import { Ionicons } from "@expo/vector-icons";

export default function StopDetailScreen() {
  const {
    id,
    routeId,
    stopOrder,
    totalStops,
    estimatedArrivalMinutes,
    stopName,
    stopReference,
  } = useLocalSearchParams();

  const router = useRouter();
  const { colors } = useTheme();
  const { isFavoriteStop, toggleFavoriteStop } = useFavoriteStops();
  const { routes } = useRoutes();

  const [routesForStop, setRoutesForStop] = useState<Route[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  const styles = makeStyles(colors);

  const stopId = id as string;
  const isFav = isFavoriteStop(stopId);

  useEffect(() => {
    if (!stopId || !routes || routes.length === 0) {
      setLoadingRoutes(false);
      return;
    }
    findRoutesForStop(stopId);
  }, [stopId, routes]);

  const findRoutesForStop = async (sId: string) => {
    try {
      setLoadingRoutes(true);
      const results = await Promise.all(
        routes.map(async (route) => {
          try {
            const stops = await mobileService.getRouteStops(route.id);
            const found = Array.isArray(stops)
              ? stops.some((s: any) => s.stop?.id === sId || s.stopId === sId)
              : false;
            return found ? route : null;
          } catch {
            return null;
          }
        })
      );
      setRoutesForStop(results.filter(Boolean) as Route[]);
    } catch (error) {
      console.error("Error finding routes for stop", error);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleToggleFavorite = () => {
    toggleFavoriteStop({
      id: stopId,
      name: stopName as string,
      reference: stopReference as string,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Parada</Text>
        <Pressable style={styles.starBtn} hitSlop={8} onPress={handleToggleFavorite}>
          <Ionicons
            name={isFav ? "star" : "star-outline"}
            size={24}
            color={isFav ? "#FFD600" : "#FFFFFF"}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.stopTitle}>{stopName || "Parada"}</Text>
        {stopOrder && totalStops ? (
          <Text style={styles.stopSubtitle}>
            {"Parada " + stopOrder + " de " + totalStops}
          </Text>
        ) : null}

        {stopReference ? (
          <View style={styles.refSection}>
            <Text style={styles.refLabel}>Referencia</Text>
            <Text style={styles.refText}>{stopReference}</Text>
          </View>
        ) : null}

        <View style={styles.routesSection}>
          <Text style={styles.routesSectionTitle}>Rutas que pasan por esta parada</Text>
          {loadingRoutes ? (
            <ActivityIndicator size="small" color={colors.button.primary} style={{ marginTop: 10 }} />
          ) : routesForStop.length > 0 ? (
            routesForStop.map((route) => (
              <Pressable
                key={route.id}
                style={({ pressed }) => [styles.routeCard, pressed && { opacity: 0.7 }]}
                onPress={() => router.push("/route/" + route.id)}
              >
                <View style={styles.routeCardBorder} />
                <View style={styles.routeCardContent}>
                  <Text style={styles.routeCardName}>{route.name}</Text>
                  {!!route.direction && (
                    <Text style={styles.routeCardDir}>{route.direction}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.light} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>No se encontraron rutas para esta parada.</Text>
          )}
        </View>

        {estimatedArrivalMinutes ? (
          <View style={styles.arrivalSection}>
            <Text style={styles.arrivalLabel}>Tiempo estimado de llegada</Text>
            <Text style={styles.arrivalTime}>{"En " + estimatedArrivalMinutes + " min"}</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.main },
    content:   { paddingBottom: 40 },
    header: {
      backgroundColor: "#0056B8",
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 55,
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    backBtn:     { marginRight: 12 },
    headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter-Bold", color: "#FFFFFF" },
    starBtn:     { marginLeft: 10, padding: 4 },
    body: {
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    stopTitle: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 4,
    },
    stopSubtitle: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      marginBottom: 16,
    },
    refSection: {
      marginBottom: 20,
    },
    refLabel: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 4,
    },
    refText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      lineHeight: 20,
    },
    routesSection: {
      marginBottom: 20,
    },
    routesSectionTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 10,
    },
    routeCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    routeCardBorder: {
      width: 4,
      alignSelf: "stretch",
      backgroundColor: "#0056B8",
    },
    routeCardContent: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    routeCardName: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 2,
    },
    routeCardDir: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
    },
    arrivalSection: {
      backgroundColor: "#EBF2FF",
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },
    arrivalLabel: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "#0056B8",
      marginBottom: 4,
    },
    arrivalTime: {
      fontSize: 20,
      fontFamily: "Inter-Bold",
      color: "#0056B8",
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      marginTop: 8,
    },
  });
}