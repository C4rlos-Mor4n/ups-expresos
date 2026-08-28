import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useRoutes } from "../../context/RoutesContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { mobileService } from "../../services/mobile.service";
import { getNextSchedule } from "../../utils/schedule";
import { MobileRoute } from "../../types/route";
import RouteOperationBadge from "../../components/RouteOperationBadge";

import {
  MapPin,
  Bell,
  Star,
} from "lucide-react-native";

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const { routes, loading: loadingRoutes } = useRoutes();
  
  const [firstRoute, setFirstRoute] = useState<MobileRoute | null>(null);
  const [nextSchedule, setNextSchedule] = useState<string>("--:--");
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  useEffect(() => {
    const loadScheduleForFirstRoute = async () => {
      if (routes && routes.length > 0) {
        const route = routes[0];
        setFirstRoute(route);
        try {
          const schedules = await mobileService.getRouteSchedules(route.id);
          const next = getNextSchedule(schedules, new Date());
          setNextSchedule(next ? next.departureTime.substring(0, 5) : "--:--");
        } catch (error) {
          console.error("Error fetching schedules for home:", error);
        } finally {
          setLoadingSchedule(false);
        }
      } else if (!loadingRoutes) {
        setLoadingSchedule(false);
      }
    };
    loadScheduleForFirstRoute();
  }, [routes, loadingRoutes]);

  const styles = makeStyles(colors, isSmallDevice);
  const displayName = user?.email
  ? user.email
      .split("@")[0]
      .split(".")
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ")
  : "Estudiante";

return (
  <ScrollView
    style={styles.container}
    showsVerticalScrollIndicator={false}
  >
    {/* Encabezado azul */}
    {/* Encabezado azul */}
<View style={styles.header}>

  <View style={styles.headerLeft}>

    <View style={styles.nameRow}>

      <Text style={[styles.greeting, { flexShrink: 1, paddingRight: 10 }]} adjustsFontSizeToFit numberOfLines={1}>
        ¡Hola, {displayName}!
      </Text>

      <Pressable
        style={styles.notificationButton}
        onPress={() => router.push("/(tabs)/avisos")}
      >
        <Ionicons
          name="notifications-outline"
          size={28}
          color="#FFFFFF"
        />
      </Pressable>

    </View>

    <Text style={styles.welcome}>
      Bienvenido de nuevo
    </Text>

  </View>

</View>

<View style={styles.summaryCard}>

  <Text style={styles.summaryTitle}>
    Resumen rápido
  </Text>

  <View style={styles.statusRow}>

    <Text style={styles.statusLabel}>
      Estado del servicio
    </Text>

    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeText}>
        Operativo
      </Text>
    </View>

  </View>

</View>


    {/* Accesos rápidos */}
    <View style={styles.quickActions}>

      <Pressable
        style={styles.quickCard}
        onPress={() => router.push("/(tabs)/rutas")}
      >
        <MapPin
          size={isSmallDevice ? 28 : 34}
          color="#2E4DB7"
          strokeWidth={2.2}
        />

        <Text style={styles.quickTitle}>
          Rutas
        </Text>

        <Text style={styles.quickSubtitle}>
          Ver todas
        </Text>
      </Pressable>

      <Pressable
        style={styles.quickCard}
        onPress={() => router.push("/(tabs)/avisos")}
      >
        <Bell
          size={isSmallDevice ? 28 : 34}
          color="#2E4DB7"
          strokeWidth={2.2}
        />

        <Text style={styles.quickTitle}>
          Avisos
        </Text>

        <Text style={styles.quickSubtitle}>
          Comunicados
        </Text>
      </Pressable>

      <Pressable
        style={styles.quickCard}
        onPress={() => router.push("/(tabs)/favoritos")}
      >
        <Star
          size={isSmallDevice ? 28 : 34}
          color="#2E4DB7"
          strokeWidth={2.2}
        />

        <Text style={styles.quickTitle}>
          Favoritos
        </Text>

        <Text style={styles.quickSubtitle}>
          Guardados
        </Text>
      </Pressable>

    </View>
{/* Próximo horario cercano */}
<View style={styles.scheduleSection}>

  <Text style={styles.scheduleTitle}>
    Próximo horario cercano
  </Text>

  {loadingRoutes || loadingSchedule ? (
    <View style={[styles.scheduleCard, { padding: 20, justifyContent: 'center' }]}>
      <Text style={{ textAlign: 'center', color: '#666' }}>Cargando ruta...</Text>
    </View>
  ) : firstRoute ? (
    <Pressable
      style={styles.scheduleCard}
      onPress={() => router.push(`/route/${firstRoute.id}`)}
    >

      <View style={styles.blueLine} />

      <View style={styles.scheduleContent}>

        <View style={styles.scheduleInfo}>

          <Text style={styles.routeName} numberOfLines={1}>
            {firstRoute.name}
          </Text>

          <Text style={styles.routeFrom} numberOfLines={2}>
            {firstRoute.direction ? firstRoute.direction.replace(" --> ", " -->\n") : ''}
          </Text>

          {firstRoute.currentOperation ? (
            <View style={{ marginTop: 6 }}>
              <RouteOperationBadge status={firstRoute.currentOperation.status} />
            </View>
          ) : null}

          <Text style={styles.routeLabel}>
            Próximo horario
          </Text>

        </View>

        <View style={styles.scheduleRight}>

          <Text style={styles.routeHour}>
            {nextSchedule}
          </Text>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#666"
          />

        </View>

      </View>

    </Pressable>
  ) : (
    <View style={[styles.scheduleCard, { padding: 20 }]}>
      <Text style={{ color: '#666', fontFamily: 'Inter-Regular' }}>No hay rutas disponibles.</Text>
    </View>
  )}

  </View>
  </ScrollView>
);
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors, isSmallDevice: boolean = false) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.main,
    },
header: {
  backgroundColor: "#0056B8",
  paddingTop: 60,
  paddingHorizontal: isSmallDevice ? 16 : 22,
  paddingBottom: isSmallDevice ? 24 : 30,
},
headerLeft: {
  width: "100%",
},

nameRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

notificationButton: {
  paddingLeft: 12,
},
greeting: {
  fontSize: 24,
  fontFamily: "Inter-Bold",
  color: "#FFFFFF",
},
welcome: {
  color: "#D9E7FF",
  fontSize: 16,
  fontFamily: "Inter-Regular",
  marginTop: 4,
},
summaryCard: {
  backgroundColor: "#FFFFFF",
  marginHorizontal: isSmallDevice ? 14 : 18,
  marginTop: -12,
  borderRadius: 18,
  padding: isSmallDevice ? 16 : 20,
  elevation: 3,
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
},
summaryTitle: {
  fontSize: isSmallDevice ? 18 : 21,
  fontFamily: "Inter-Bold",
  color: colors.text.dark,
  marginBottom: isSmallDevice ? 14 : 18,
},
statusRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

statusLabel: {
  fontSize: 15,
  fontFamily: "Inter-SemiBold",
  color: colors.text.dark,
},
statusBadge: {
  backgroundColor: "#DDF7E5",
  paddingHorizontal: 14,
  paddingVertical: 6,
  borderRadius: 20,
  alignSelf: "flex-start",
},
statusBadgeText: {
  color: "#1E9E57",
  fontFamily: "Inter-Bold",
},
quickActions: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: isSmallDevice ? 18 : 22,
  marginHorizontal: isSmallDevice ? 14 : 18,
},

quickCard: {
  width: "31%",
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: isSmallDevice ? 14 : 20,

  shadowColor: "#000",
  shadowOpacity: 0.05,
  shadowRadius: 5,
  shadowOffset: {
    width: 0,
    height: 2,
  },

  elevation: 2,
},

quickTitle: {
  marginTop: 12,
  fontSize: isSmallDevice ? 13 : 15,
  fontFamily: "Inter-Bold",
  color: "#1E1E1E",
},

quickSubtitle: {
  marginTop: 4,
  fontSize: isSmallDevice ? 10 : 12,
  fontFamily: "Inter-Regular",
  color: "#8B8B8B",
},
scheduleSection: {
  marginHorizontal: isSmallDevice ? 14 : 18,
  marginTop: isSmallDevice ? 20 : 26,
},

scheduleTitle: {
  fontSize: isSmallDevice ? 18 : 21,
  fontFamily: "Inter-Bold",
  color: colors.text.dark,
  marginBottom: isSmallDevice ? 10 : 14,
},

scheduleCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#ECECEC",
  overflow: "hidden",
  flexDirection: "row",

  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 5,
  elevation: 2,
},

blueLine: {
  width: 4,
  backgroundColor: "#2E4DB7",
},

scheduleContent: {
  flex: 1,
  paddingVertical: 16,
  paddingHorizontal: 16,
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},

scheduleInfo: {
  flex: 1,
},

routeName: {
  fontSize: 17,
  fontFamily: "Inter-Bold",
  color: colors.text.dark,
  marginBottom: 8,
},

routeFrom: {
  fontSize: 12,
  fontFamily: "Inter-Regular",
  color: colors.text.light,
  marginBottom: 8,
},

routeLabel: {
  fontSize: 14,
  fontFamily: "Inter-Regular",
  color: colors.text.light,
},

scheduleRight: {
  flexDirection: "row",
  alignItems: "center",
},

routeHour: {
  fontSize: isSmallDevice ? 20 : 24,
  fontFamily: "Inter-Bold",
  color: colors.text.dark,
  marginRight: 6,
},
  });
}
