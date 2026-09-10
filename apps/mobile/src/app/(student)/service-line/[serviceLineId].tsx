import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
  StatusBadge,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { operationalService } from "@/services/operational.service";
import type { DepartureSummary, Direction } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";
import {
  formatGuayaquilDate,
  formatOperationalTime,
  getDirectionLabel,
  getGuayaquilToday,
  shiftCivilDate,
} from "@/utils/operational";

export default function DeparturesScreen() {
  const { serviceLineId, name } = useLocalSearchParams<{
    serviceLineId: string;
    name?: string;
  }>();
  const router = useRouter();
  const [direction, setDirection] = useState<Direction>("IDA");
  const [date, setDate] = useState(getGuayaquilToday);
  const [departures, setDepartures] = useState<DepartureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isToday = date === getGuayaquilToday();

  const load = useCallback(
    async (refresh = false) => {
      if (!serviceLineId) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        setDepartures(
          await operationalService.getDepartures(
            serviceLineId,
            date,
            direction,
          ),
        );
      } catch (requestError) {
        setError(getOperationalErrorMessage(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date, direction, serviceLineId],
  );

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, [load]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(student)/(tabs)");
    }
  };

  const getTimePeriodHint = (timeStr: string) => {
    const hour = parseInt(timeStr.split(":")[0] || "0", 10);
    if (hour < 12) return "Turno matutino";
    if (hour < 18) return "Turno de la tarde";
    return "Turno nocturno";
  };

  return (
    <AppScreen>
      <ScreenHeader
        title={name || "Salidas"}
        subtitle="Horarios por fecha y sentido"
        back
        onBack={handleBack}
      />

      <View style={styles.container}>
        {/* Date Selector Row */}
        <View style={styles.dateSelectorCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Día anterior"
            onPress={() => setDate((value) => shiftCivilDate(value, -1))}
            style={styles.dateNavButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </Pressable>

          <View style={styles.dateDisplay}>
            <View style={styles.dateBadgeRow}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.dateSubLabel}>
                {isToday ? "Hoy" : "Fecha seleccionada"}
              </Text>
            </View>
            <Text style={styles.dateMainLabel}>
              {formatGuayaquilDate(date)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Día siguiente"
            onPress={() => setDate((value) => shiftCivilDate(value, 1))}
            style={styles.dateNavButton}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </Pressable>
        </View>

        {/* Direction Tabs (IDA / RETORNO) */}
        <View style={styles.directionTabsContainer}>
          {(["IDA", "RETORNO"] as const).map((option) => {
            const isSelected = direction === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.directionTab,
                  isSelected && styles.directionTabSelected,
                ]}
                onPress={() => setDirection(option)}
              >
                <Ionicons
                  name={option === "IDA" ? "bus-outline" : "swap-horizontal"}
                  size={16}
                  color={isSelected ? Colors.primary : "#64748B"}
                  style={styles.directionTabIcon}
                />
                <Text
                  style={[
                    styles.directionTabText,
                    isSelected && styles.directionTabTextSelected,
                  ]}
                >
                  {getDirectionLabel(option)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            Salidas de {getDirectionLabel(direction).toLowerCase()}
          </Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {departures.length}{" "}
              {departures.length === 1 ? "salida" : "salidas"}
            </Text>
          </View>
        </View>

        {/* Content List */}
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="No pudimos consultar las salidas"
            message={error}
            action={
              <Pressable onPress={() => void load()} style={styles.retryButton}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            }
          />
        ) : (
          <FlatList
            data={departures}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load(true)}
                tintColor={Colors.primary}
              />
            }
            ListEmptyComponent={
              <InlineState
                icon="calendar-clear-outline"
                title="Sin salidas programadas"
                message={`No hay turnos de ${getDirectionLabel(direction).toLowerCase()} para ${formatGuayaquilDate(date)}.`}
                action={
                  !isToday ? (
                    <Pressable
                      onPress={() => setDate(getGuayaquilToday())}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryText}>Ver salidas de hoy</Text>
                    </Pressable>
                  ) : undefined
                }
              />
            }
            renderItem={({ item }) => {
              const hasAssignments =
                item.assignedVehicles && item.assignedVehicles.length > 0;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Salida ${formatOperationalTime(item.scheduledTime)}`}
                  style={({ pressed }) => [
                    styles.departureCard,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/(student)/scheduled-departure/[departureId]",
                      params: { departureId: item.id },
                    })
                  }
                >
                  {/* Top Row: Time Box + Status + Period Hint + Chevron */}
                  <View style={styles.cardMainRow}>
                    <View style={styles.timeBox}>
                      <Text style={styles.timeValue} numberOfLines={1}>
                        {formatOperationalTime(item.scheduledTime)}
                      </Text>
                      <View style={styles.directionTag}>
                        <Text style={styles.directionTagText}>
                          {getDirectionLabel(item.direction)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.departureDetails}>
                      <View style={styles.statusRow}>
                        <StatusBadge state={item.state} />
                        <Text style={styles.periodHintText}>
                          · {getTimePeriodHint(item.scheduledTime)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionIconWrap}>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Colors.primary}
                      />
                    </View>
                  </View>

                  {/* Route Timeline Preview (Inicio ➔ Fin) */}
                  {item.originStop && item.destinationStop ? (
                    <View style={styles.routeTimelineContainer}>
                      {/* Origin Stop */}
                      <View style={styles.routeStopPoint}>
                        <View style={styles.originIndicator}>
                          <View style={styles.originInnerDot} />
                        </View>
                        <View style={styles.stopNameWrap}>
                          <Text style={styles.stopRoleLabel}>
                            Inicio de recorrido
                          </Text>
                          <Text
                            style={styles.stopNameText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.originStop}
                          </Text>
                        </View>
                      </View>

                      {/* Connecting Dash & Stops Count */}
                      <View style={styles.routeConnectorRow}>
                        <View style={styles.routeVerticalDash} />
                        <View style={styles.stopsBadgePill}>
                          <Ionicons
                            name="git-commit-outline"
                            size={11}
                            color="#0284C7"
                          />
                          <Text style={styles.stopsBadgePillText}>
                            {item.stopsCount} paradas en ruta
                          </Text>
                        </View>
                      </View>

                      {/* Destination Stop */}
                      <View style={styles.routeStopPoint}>
                        <View style={styles.destIndicator}>
                          <Ionicons
                            name="location"
                            size={11}
                            color={Colors.white}
                          />
                        </View>
                        <View style={styles.stopNameWrap}>
                          <Text style={styles.stopRoleLabel}>
                            Fin de ruta (Destino)
                          </Text>
                          <Text
                            style={styles.stopNameText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.destinationStop}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {/* Middle Block: Bus Unit & Driver Preview */}
                  {hasAssignments ? (
                    <View style={styles.assignedUnitsBlock}>
                      {item.assignedVehicles!.map((v, vIdx) => (
                        <View key={v.id || vIdx} style={styles.assignedUnitRow}>
                          {/* Unit & Plate Pill */}
                          <View style={styles.unitPill}>
                            <Ionicons name="bus" size={12} color="#07508E" />
                            <Text style={styles.unitPillCode}>{v.code}</Text>
                            <View style={styles.plateDivider} />
                            <Ionicons
                              name="card-outline"
                              size={11}
                              color="#07508E"
                            />
                            <Text style={styles.unitPillPlate}>{v.plate}</Text>
                          </View>

                          {/* Driver Pill */}
                          {v.driverName ? (
                            <View style={styles.driverPill}>
                              <Ionicons
                                name="person"
                                size={11}
                                color="#0F766E"
                              />
                              <Text
                                style={styles.driverPillText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {v.driverName}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.unassignedBlock}>
                      <Ionicons name="time-outline" size={13} color="#94A3B8" />
                      <Text style={styles.unassignedText}>
                        Bus por asignar · Unidad y conductor en confirmación
                      </Text>
                    </View>
                  )}

                  {/* Card Footer */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.footerActionText}>
                      Ver paradas e itinerario completo
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={13}
                      color={Colors.primary}
                    />
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateSelectorCard: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: Colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dateNavButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateDisplay: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  dateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateSubLabel: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 11.5,
  },
  dateMainLabel: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 14.5,
  },
  directionTabsContainer: {
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    marginBottom: 12,
  },
  directionTab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  directionTabSelected: {
    backgroundColor: Colors.white,
    shadowColor: Colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  directionTabIcon: {
    marginTop: 1,
  },
  directionTabText: {
    color: "#64748B",
    fontFamily: "Inter-SemiBold",
    fontSize: 13.5,
  },
  directionTabTextSelected: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    color: "#1E293B",
    fontFamily: "Inter-Bold",
    fontSize: 15.5,
    letterSpacing: -0.2,
  },
  countPill: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countPillText: {
    color: "#475569",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
  },
  listContent: {
    gap: 12,
    paddingBottom: 40,
  },
  departureCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    gap: 10,
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  cardMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  timeBox: {
    minWidth: 84,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#EBF3FB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D4E5F7",
    gap: 2,
    flexShrink: 0,
  },
  timeValue: {
    color: "#052E67",
    fontFamily: "Inter-Bold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  directionTag: {
    backgroundColor: "#DCEBFB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  directionTagText: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
    fontSize: 10.5,
  },
  departureDetails: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: "flex-start",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  routeTimelineContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 2,
  },
  routeStopPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  originIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  originInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0284C7",
  },
  destIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  stopNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  stopRoleLabel: {
    color: "#64748B",
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  stopNameText: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 13,
    lineHeight: 17,
  },
  routeConnectorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    gap: 8,
    marginVertical: 2,
  },
  routeVerticalDash: {
    width: 2,
    height: 14,
    backgroundColor: "#CBD5E1",
    borderRadius: 1,
  },
  stopsBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  stopsBadgePillText: {
    color: "#0369A1",
    fontFamily: "Inter-SemiBold",
    fontSize: 10.5,
  },
  assignedUnitsBlock: {
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#D0E5FC",
    gap: 6,
  },
  assignedUnitRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  unitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  unitPillCode: {
    color: "#052E67",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
  },
  plateDivider: {
    width: 1,
    height: 10,
    backgroundColor: "#CBD5E1",
  },
  unitPillPlate: {
    color: "#07508E",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  driverPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99F6E4",
    gap: 4,
    flex: 1,
    minWidth: 120,
  },
  driverPillText: {
    color: "#0F766E",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
    flex: 1,
  },
  unassignedBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  unassignedText: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 11.5,
    flex: 1,
  },
  assignmentInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  assignmentCountText: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 12.5,
    flex: 1,
    flexShrink: 1,
  },
  assignmentCountActive: {
    color: "#0F172A",
    fontFamily: "Inter-SemiBold",
  },
  periodHintText: {
    color: "#94A3B8",
    fontFamily: "Inter-Regular",
    fontSize: 11.5,
  },
  actionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  footerActionText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 12.5,
  },
  retryButton: {
    marginTop: 10,
  },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
});
