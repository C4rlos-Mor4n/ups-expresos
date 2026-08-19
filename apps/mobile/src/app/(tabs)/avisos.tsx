import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { mobileService } from "../../services/mobile.service";
import { Notice } from "../../types/notice";
import { appendPage } from "../../utils/pagination";
import { Ionicons } from "@expo/vector-icons";

const PAGE_LIMIT = 20;

export default function AvisosScreen() {
  const [activeTab, setActiveTab] = useState("Todos");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isSmallDevice = width < 380;

  const styles = makeStyles(colors, isSmallDevice);

  const tabs = ["Todos", "Información", "Advertencias", "Suspensiones"];

  const severityMap: Record<string, string> = {
    "Información": "INFO",
    "Advertencias": "WARNING",
    "Suspensiones": "CRITICAL"
  };

  useEffect(() => {
    loadNotices();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setActiveTab("Todos");
      };
    }, [])
  );

  const loadNotices = async () => {
    try {
      setLoading(true);
      const response = await mobileService.getNotices({ page: 1, limit: PAGE_LIMIT });
      const { items, hasMore: more } = appendPage([], response.data, response.meta);
      pageRef.current = response.meta.page;
      setNotices(items);
      setHasMore(more);
    } catch (error) {
      console.error("Error loading notices", error);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreNotices = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const response = await mobileService.getNotices({ page: nextPage, limit: PAGE_LIMIT });
      const { items, hasMore: more } = appendPage(notices, response.data, response.meta);
      pageRef.current = response.meta.page;
      setNotices(items);
      setHasMore(more);
    } catch (error) {
      console.error("Error loading more notices", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const safeNotices = Array.isArray(notices) ? notices : [];
  const filteredNotices = activeTab === "Todos" 
    ? safeNotices 
    : safeNotices.filter(notice => notice.severity === severityMap[activeTab]);

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'INFO':
        return {
          icon: 'information-circle',
          color: colors.info || '#1976D2',
          bgColor: (colors.info || '#1976D2') + '1A', // 10% opacity
          label: 'Información'
        };
      case 'WARNING':
        return {
          icon: 'warning',
          color: colors.warning || '#F57C00',
          bgColor: (colors.warning || '#F57C00') + '1A', // 10% opacity
          label: 'Advertencia'
        };
      case 'CRITICAL':
        return {
          icon: 'alert-circle',
          color: colors.error || '#D32F2F',
          bgColor: (colors.error || '#D32F2F') + '1A', // 10% opacity
          label: 'Suspensión / Demora'
        };
      default:
        return {
          icon: 'notifications',
          color: colors.text.light || '#9E9E9E',
          bgColor: (colors.text.light || '#9E9E9E') + '1A',
          label: 'Aviso'
        };
    }
  };

  const formatDate = (dateString: Date | string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate();
    const month = date.toLocaleDateString('es-ES', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month}. ${year}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Avisos</Text>
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <Pressable 
            key={tab} 
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]} numberOfLines={1} adjustsFontSizeToFit>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.button.primary} />
        </View>
      ) : filteredNotices.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.text.light }}>No hay avisos disponibles en este momento.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {filteredNotices.map((notice, index) => {
            const config = getSeverityConfig(notice.severity);
            // Usar index como fallback para key si id no existe (prevención de crasheos)
            const key = notice.id || index.toString();
            
            return (
              <View key={key} style={styles.card}>
                <View style={styles.cardContent}>
                  
                  {/* Izquierda: Icono circular */}
                  <View style={styles.iconColumn}>
                    <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
                      <Ionicons name={config.icon as any} size={24} color={config.color} />
                    </View>
                  </View>

                  {/* Derecha: Información */}
                  <View style={styles.infoColumn}>
                    
                    <View style={[styles.badgeContainer, { backgroundColor: config.bgColor }]}>
                      <Text style={[styles.badgeText, { color: config.color }]}>
                        {config.label}
                      </Text>
                    </View>
                    
                    <Text style={styles.cardTitle}>{notice.title}</Text>
                    <Text style={styles.cardText}>{notice.message}</Text>
                    
                    <View style={styles.dateRow}>
                      {notice.publishedFrom && (
                        <Text style={styles.dateText}>{formatDate(notice.publishedFrom)}</Text>
                      )}
                      {notice.publishedUntil ? (
                        <Text style={styles.dateText}>{formatDate(notice.publishedUntil)}</Text>
                      ) : (
                        <View />
                      )}
                    </View>

                  </View>
                </View>
              </View>
            );
          })}
          {hasMore && (
            <Pressable
              style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.85 }]}
              onPress={loadMoreNotices}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.button.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Cargar más avisos</Text>
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
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.main,
    },
    screenTitle: {
      fontSize: isSmallDevice ? 24 : 28,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      paddingHorizontal: isSmallDevice ? 16 : 20,
      paddingTop: 20, // Espacio superior extra al ocultar el header nativo
      paddingBottom: 5,
    },
    tabContainer: {
      flexDirection: "row",
      padding: isSmallDevice ? 10 : 15,
      paddingHorizontal: isSmallDevice ? 16 : 20,
      justifyContent: "space-between",
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      marginHorizontal: 3,
      backgroundColor: colors.background.card,
    },
    activeTab: {
      backgroundColor: colors.button.primary,
      borderColor: colors.button.primary,
    },
    tabText: {
      color: colors.text.dark,
      fontFamily: "Inter-Regular",
      fontSize: isSmallDevice ? 10 : 12,
    },
    activeTabText: {
      color: "#FFFFFF",
      fontFamily: "Inter-Bold",
    },
    list: {
      padding: isSmallDevice ? 16 : 20,
      paddingTop: 0,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    cardContent: {
      flexDirection: 'row',
      padding: isSmallDevice ? 12 : 15,
    },
    iconColumn: {
      marginRight: 15,
      alignItems: 'center',
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoColumn: {
      flex: 1,
    },
    badgeContainer: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      marginBottom: 8,
    },
    badgeText: {
      fontSize: 10,
      fontFamily: "Inter-Bold",
    },
    cardTitle: {
      fontSize: isSmallDevice ? 14 : 16,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 6,
    },
    cardText: {
      fontSize: isSmallDevice ? 11 : 13,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      marginBottom: 12,
      lineHeight: isSmallDevice ? 16 : 18,
    },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 11,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
    },
    loadMore: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background.card,
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
