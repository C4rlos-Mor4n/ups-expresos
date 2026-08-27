import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useFavorites } from "../../context/FavoritesContext";
import { useRoutes } from "../../context/RoutesContext";
import { Ionicons } from "@expo/vector-icons";
import RouteOperationBadge from "../../components/RouteOperationBadge";
import ErrorRetry from "../../components/ErrorRetry";

export default function RutasScreen() {
  const router = useRouter();
  const { routes: globalRoutes, loading, loadingMore, hasMore, loadMoreRoutes, refreshRoutes } = useRoutes();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;

  const styles = makeStyles(colors, isSmallDevice);

  const routes = useMemo(() => {
    if (!debouncedSearch) return globalRoutes;
    const term = debouncedSearch.toLowerCase().trim();
    return globalRoutes.filter((r) => 
      r.name.toLowerCase().includes(term) || 
      (r.direction && r.direction.toLowerCase().includes(term))
    );
  }, [globalRoutes, debouncedSearch]);



  useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 500);

  return () => clearTimeout(timer);
}, [search]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setSearch("");
      };
    }, [])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRoutes();
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [refreshRoutes]);

  const handleLoadMore = useCallback(async () => {
    try {
      await loadMoreRoutes();
    } catch {
      setLoadFailed(true);
    }
  }, [loadMoreRoutes]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return { label: "Operativo", color: "#388E3C", bg: "#388E3C22" };
      case "SUSPENDED":
        return { label: "Suspendido", color: "#F57C00", bg: "#F57C0022" };
      default:
        return { label: "Inactivo", color: "#D32F2F", bg: "#D32F2F22" };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Azul */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rutas</Text>
      </View>

      {/* Barra de búsqueda */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.text.light} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar rutas"
            placeholderTextColor={colors.text.light}
            value={search}
            onChangeText={setSearch}
          />
          <Ionicons name="options-outline" size={20} color={colors.text.light} />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.button.primary} />
        </View>
      ) : loadFailed && routes.length === 0 ? (
        <ErrorRetry onRetry={handleRefresh} retrying={refreshing} />
      ) : routes.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.text.light }}>No hay rutas disponibles actualmente.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.button.primary} />
          }
        >
          <Text style={styles.sectionTitle}>Rutas activas</Text>
          {routes.map((route) => {
            const statusConfig = getStatusConfig(route.status);
            return (
              <Pressable
                key={route.id}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                onPress={() => router.push({ pathname: "/route/[id]", params: { id: route.id } })}
              >
                {/* Borde azul lateral */}
                <View style={styles.blueLine} />

                {/* Contenido */}
                <View style={styles.cardContent}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.cardTitle}>{route.name}</Text>
                    <Text style={styles.cardDirection}>{route.direction}</Text>
                    {route.currentOperation ? (
                      <View style={styles.operationBadgeWrap}>
                        <RouteOperationBadge status={route.currentOperation.status} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardRight}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleFavorite(route);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons
                        name={isFavorite(route.id) ? "star" : "star-outline"}
                        size={20}
                        color={isFavorite(route.id) ? "#F2A900" : colors.text.light}
                      />
                    </Pressable>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
          {hasMore && (
            <Pressable
              style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.85 }]}
              onPress={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.button.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Cargar más rutas</Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors, isSmallDevice: boolean = false) {
  const statusBarHeight =
    Platform.OS === "ios" ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.main,
    },
    header: {
      backgroundColor: "#0056B8",
      paddingTop: statusBarHeight,
      paddingBottom: isSmallDevice ? 12 : 16,
      paddingHorizontal: isSmallDevice ? 16 : 20,
    },
    headerTitle: {
      fontSize: isSmallDevice ? 20 : 24,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
    },
    searchWrapper: {
      backgroundColor: colors.background.main,
      paddingHorizontal: isSmallDevice ? 12 : 16,
      paddingVertical: isSmallDevice ? 8 : 12,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter-Regular",
      color: colors.text.dark,
    },
    list: {
      paddingHorizontal: isSmallDevice ? 12 : 16,
      paddingBottom: 20,
    },
    sectionTitle: {
      fontSize: isSmallDevice ? 14 : 16,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 12,
      marginTop: 4,
    },
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "#ECECEC",
      flexDirection: "row",
      marginBottom: 12,
      overflow: "hidden",
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
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      padding: isSmallDevice ? 10 : 14,
    },
    cardLeft: {
      flex: 1,
      paddingRight: 10,
    },
    cardTitle: {
      fontSize: isSmallDevice ? 14 : 16,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 4,
    },
    cardDirection: {
      fontSize: isSmallDevice ? 11 : 13,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
    },
    operationBadgeWrap: {
      marginTop: 8,
    },
    cardRight: {
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 10,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusText: {
      fontSize: isSmallDevice ? 9 : 11,
      fontFamily: "Inter-Bold",
    },
    loadMore: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadMoreText: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: colors.button.primary,
    },
  });
}
