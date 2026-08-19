import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { useFavorites } from "../../context/FavoritesContext";
import { useFavoriteStops } from "../../context/FavoriteStopsContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

type ActiveTab = "rutas" | "paradas";

export default function FavoritosScreen() {
  const { colors } = useTheme();
  const { favoriteRoutes, isFavorite, toggleFavorite } = useFavorites();
  const { favoriteStops, isFavoriteStop, toggleFavoriteStop } = useFavoriteStops();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;
  const [activeTab, setActiveTab] = useState<ActiveTab>("rutas");

  const styles = makeStyles(colors, isSmallDevice);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, activeTab === "rutas" && styles.tabBtnActive]}
            onPress={() => setActiveTab("rutas")}
          >
            <Text style={[styles.tabBtnText, activeTab === "rutas" && styles.tabBtnTextActive]}>
              Rutas
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, activeTab === "paradas" && styles.tabBtnActive]}
            onPress={() => setActiveTab("paradas")}
          >
            <Text style={[styles.tabBtnText, activeTab === "paradas" && styles.tabBtnTextActive]}>
              Paradas
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {activeTab === "rutas" ? (
          <>
            {favoriteRoutes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="star-outline" size={52} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Sin rutas favoritas</Text>
                <Text style={styles.emptySubtitle}>
                  Toca la estrella en cualquier ruta para guardarla aqui.
                </Text>
              </View>
            ) : (
              favoriteRoutes.map((route) => (
                <Pressable
                  key={route.id}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push("/route/" + route.id)}
                >
                  <View style={styles.blueLine} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>{route.name}</Text>
                      <Text style={styles.cardSubtitle}>{route.direction}</Text>
                    </View>
                    <Pressable onPress={() => toggleFavorite(route)} hitSlop={8}>
                      <Ionicons
                        name={isFavorite(route.id) ? "star" : "star-outline"}
                        size={24}
                        color={isFavorite(route.id) ? "#F2A900" : "#CBD5E1"}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            {favoriteStops.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={52} color="#CBD5E1" />
                <Text style={styles.emptyTitle}>Sin paradas favoritas</Text>
                <Text style={styles.emptySubtitle}>
                  Toca la estrella en cualquier parada para guardarla aqui.
                </Text>
              </View>
            ) : (
              favoriteStops.map((stop) => (
                <Pressable
                  key={stop.id}
                  style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                  onPress={() =>
                    router.push({
                      pathname: "/stop/[id]",
                      params: {
                        id: stop.id,
                        stopName: stop.name,
                        stopReference: stop.reference,
                      },
                    })
                  }
                >
                  <View style={styles.blueLine} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>{stop.name}</Text>
                      {!!stop.reference && (
                        <Text style={styles.cardSubtitle}>{stop.reference}</Text>
                      )}
                    </View>
                    <Pressable onPress={() => toggleFavoriteStop(stop)} hitSlop={8}>
                      <Ionicons
                        name={isFavoriteStop(stop.id) ? "star" : "star-outline"}
                        size={24}
                        color={isFavoriteStop(stop.id) ? "#F2A900" : "#CBD5E1"}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={24} color="#0056B8" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Los favoritos se guardan en tu dispositivo y puedes consultarlos sin conexion.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors, isSmallDevice: boolean = false) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.main },
    header: {
      backgroundColor: "#0056B8",
      paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40,
      paddingBottom: isSmallDevice ? 10 : 12,
      paddingHorizontal: isSmallDevice ? 16 : 20,
      elevation: 4,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    headerTitle: {
      fontSize: isSmallDevice ? 20 : 24,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
      marginBottom: 12,
    },
    tabBar: {
      flexDirection: "row",
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 10,
      padding: 3,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 8,
    },
    tabBtnActive: {
      backgroundColor: "#FFFFFF",
    },
    tabBtnText: {
      fontSize: isSmallDevice ? 13 : 14,
      fontFamily: "Inter-SemiBold",
      color: "rgba(255,255,255,0.75)",
    },
    tabBtnTextActive: {
      color: "#0056B8",
    },
    list: {
      padding: isSmallDevice ? 16 : 20,
      paddingTop: 16,
      flexGrow: 1,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 30,
    },
    emptyTitle: {
      marginTop: 16,
      fontSize: 18,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      textAlign: "center",
    },
    emptySubtitle: {
      marginTop: 8,
      fontSize: isSmallDevice ? 12 : 14,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      textAlign: "center",
      lineHeight: isSmallDevice ? 18 : 20,
    },
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#ECECEC",
      overflow: "hidden",
      flexDirection: "row",
      marginBottom: 12,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    blueLine: {
      width: 4,
      backgroundColor: "#2E4DB7",
    },
    cardContent: {
      flex: 1,
      padding: isSmallDevice ? 12 : 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    cardTextCol: { flex: 1, paddingRight: 10 },
    cardTitle:   { fontSize: isSmallDevice ? 14 : 16, fontFamily: "Inter-Bold",    color: colors.text.dark,  marginBottom: 4 },
    cardSubtitle:{ fontSize: isSmallDevice ? 11 : 13, fontFamily: "Inter-Regular", color: colors.text.light },
    infoCard: {
      flexDirection: "row",
      backgroundColor: "#EBF2FF",
      padding: 15,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 20,
      marginBottom: 30,
    },
    infoIcon: { marginRight: 10 },
    infoText: { flex: 1, fontSize: 13, fontFamily: "Inter-Regular", color: "#0056B8", lineHeight: 18 },
  });
}