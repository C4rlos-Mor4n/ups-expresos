import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen, InlineState, ListSkeleton, ScreenHeader, uiStyles } from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { operationalService } from "@/services/operational.service";
import type { Campus } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

export default function CampusesScreen() {
  const [campuses, setCampuses] = useState<Campus[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null); const router = useRouter();
  const load = useCallback(async (refresh = false) => { try { if (refresh) setRefreshing(true); else setLoading(true); setError(null); setCampuses(await operationalService.getCampuses()); } catch (requestError) { setError(getOperationalErrorMessage(requestError)); } finally { setLoading(false); setRefreshing(false); } }, []);
  useEffect(() => { const initialLoad = setTimeout(() => { void load(); }, 0); return () => clearTimeout(initialLoad); }, [load]);
  return <AppScreen><ScreenHeader title="Servicios" subtitle="Selecciona el campus de salida" />{loading ? <ListSkeleton /> : error ? <InlineState icon="cloud-offline-outline" title="No pudimos cargar los campus" message={error} action={<Pressable onPress={() => void load()}><Text style={styles.retry}>Reintentar</Text></Pressable>} /> : <FlatList data={campuses} keyExtractor={(item) => item.id} contentContainerStyle={uiStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.primary} />} ListEmptyComponent={<InlineState icon="business-outline" title="No hay campus disponibles" message="Cuando el servicio tenga campus activos, aparecerán aquí." />} renderItem={({ item }) => <Pressable accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && uiStyles.cardPressed]} onPress={() => router.push({ pathname: "/(student)/campus/[campusId]", params: { campusId: item.id, name: item.name } })}><View style={styles.icon}><Ionicons name="business-outline" size={24} color={Colors.primary} /></View><View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.detail}>{item.address || item.code}</Text></View><Ionicons name="chevron-forward" size={20} color={Colors.text.light} /></Pressable>} />}</AppScreen>;
}

const styles = StyleSheet.create({ card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 }, icon: { width: 48, height: 48, borderRadius: 14, backgroundColor: Colors.background.alt, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: 4 }, name: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 16 }, detail: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 }, retry: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 15, marginTop: 12 }, });
