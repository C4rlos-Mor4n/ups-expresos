import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen, InlineState, ListSkeleton, ScreenHeader, uiStyles } from "@/components/operational-ui";
import { DriverAssignmentCard } from "@/components/driver-assignment-card";
import { Colors } from "@/constants/Colors";
import { operationalService } from "@/services/operational.service";
import type { DriverAssignment } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

export default function DriverAssignmentsScreen() {
  const router = useRouter(); const [assignments, setAssignments] = useState<DriverAssignment[]>([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => { try { if (refresh) setRefreshing(true); else setLoading(true); setError(null); setAssignments(await operationalService.getDriverAssignmentsToday()); } catch (requestError) { setError(getOperationalErrorMessage(requestError)); } finally { setLoading(false); setRefreshing(false); } }, []); useEffect(() => { const initialLoad = setTimeout(() => { void load(); }, 0); return () => clearTimeout(initialLoad); }, [load]);
  return <AppScreen><ScreenHeader title="Mis servicios" subtitle="Asignaciones de hoy" />{loading ? <ListSkeleton /> : error ? <InlineState icon="cloud-offline-outline" title="No pudimos cargar tus servicios" message={error} action={<Pressable onPress={() => void load()}><Text style={styles.retry}>Reintentar</Text></Pressable>} /> : <FlatList data={assignments} keyExtractor={(item) => item.id} contentContainerStyle={uiStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={Colors.primary} />} ListEmptyComponent={<InlineState icon="calendar-clear-outline" title="No tienes servicios hoy" message="Las asignaciones autorizadas por la operación aparecerán aquí." />} renderItem={({ item }) => <DriverAssignmentCard assignment={item} onPress={() => router.push({ pathname: "/(driver)/assignment/[assignmentId]", params: { assignmentId: item.id } })} />} />}</AppScreen>;
}
const styles = StyleSheet.create({ retry: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 15, marginTop: 12 } });
