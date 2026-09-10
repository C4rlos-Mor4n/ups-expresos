import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ScreenHeader,
  SectionTitle,
  StatusBadge,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { operationalService } from "@/services/operational.service";
import type {
  StudentAssignment,
  StudentDepartureDetail,
} from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";
import {
  addMinutesToOperationalTime,
  formatDuration,
  formatGuayaquilDate,
  formatOperationalTime,
  getDirectionLabel,
} from "@/utils/operational";

function cleanStopReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const lower = ref.toLowerCase();

  if (lower.includes("robles 107")) return "Robles 107 y Chambers";
  if (lower.includes("kfc") || lower.includes("17 y portete"))
    return "17 y Portete, junto al KFC";
  if (lower.includes("quito y portete"))
    return "Intersección Av. Quito y Portete";
  if (lower.includes("puerto azul"))
    return "Paso peatonal frente a Puerto Azul";
  if (
    lower.includes("comisariato") ||
    lower.includes("km. 6.9") ||
    lower.includes("km 6.9")
  )
    return "Km 6.9 Vía a la Costa";
  if (lower.includes("km 19") || lower.includes("km. 19"))
    return "Km 19 Vía a la Costa";
  if (lower.includes("avícola") || lower.includes("américas"))
    return "Av. de las Américas";
  if (lower.includes("joya")) return "Urbanización La Joya";

  if (
    lower.includes("google maps") ||
    lower.includes("investigación") ||
    lower.includes("plus code") ||
    lower.includes("coordenada") ||
    lower.includes("openstreetmap")
  ) {
    return null;
  }

  return ref.trim() || null;
}

export default function DepartureDetailScreen() {
  const { departureId } = useLocalSearchParams<{ departureId: string }>();
  const router = useRouter();
  const [departure, setDeparture] = useState<StudentDepartureDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] =
    useState<number>(0);

  const load = useCallback(async () => {
    if (!departureId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await operationalService.getStudentDeparture(departureId);
      setDeparture(data);
      setSelectedAssignmentIndex(0);
      const primaryJourney =
        data.assignments[0]?.journey || data.journey;
      const stops = primaryJourney?.stops ?? [];
      if (stops.length > 0) {
        setSelectedStopId(stops[0]?.id || null);
      }
    } catch (requestError) {
      setError(getOperationalErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [departureId]);

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

  if (loading) {
    return (
      <AppScreen>
        <ScreenHeader title="Detalle de salida" back onBack={handleBack} />
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      </AppScreen>
    );
  }

  if (error || !departure) {
    return (
      <AppScreen>
        <ScreenHeader title="Detalle de salida" back onBack={handleBack} />
        <InlineState
          icon="cloud-offline-outline"
          title="No pudimos cargar la salida"
          message={error || "La salida no está disponible."}
          action={
            <Pressable onPress={() => void load()} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          }
        />
      </AppScreen>
    );
  }

  const activeAssignment =
    departure.assignments[selectedAssignmentIndex] || departure.assignments[0];
  const primaryJourney =
    activeAssignment?.journey || departure.journey;
  const stops = primaryJourney?.stops ?? [];
  const originStop = stops[0]?.name;
  const destinationStop = stops[stops.length - 1]?.name;
  const durationText =
    typeof primaryJourney?.durationMinutes === "number" &&
    primaryJourney.durationMinutes > 0
      ? formatDuration(primaryJourney.durationMinutes)
      : null;

  return (
    <AppScreen>
      <ScreenHeader
        title="Detalle de salida"
        subtitle={departure.serviceLine.name}
        back
        onBack={handleBack}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Departure Hero Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={styles.timeWrap}>
              <Text style={styles.timeText}>
                {formatOperationalTime(departure.scheduledTime)}
              </Text>
              <Text style={styles.dateText}>
                {formatGuayaquilDate(departure.serviceDate)} ·{" "}
                {getDirectionLabel(departure.direction)}
              </Text>
            </View>
            <StatusBadge state={departure.state} />
          </View>

          {/* Context Badges */}
          <View style={styles.contextBadgesRow}>
            <View style={styles.contextBadge}>
              <Ionicons name="business" size={14} color={Colors.white} />
              <Text style={styles.contextText}>
                {departure.serviceLine.campus.name}
              </Text>
            </View>
            <View style={styles.contextBadge}>
              <Ionicons name="git-branch" size={14} color={Colors.white} />
              <Text style={styles.contextText}>
                {departure.serviceLine.code}
              </Text>
            </View>
          </View>

          {/* Route Overview Preview */}
          {originStop && destinationStop ? (
            <View style={styles.routeOverviewBox}>
              <View style={styles.routeOverviewRow}>
                <Ionicons name="navigate-circle" size={16} color="#60A5FA" />
                <Text
                  style={styles.routeOverviewText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {originStop} ➔ {destinationStop}
                </Text>
              </View>
              {stops.length > 0 ? (
                <Text style={styles.routeStopsCountText}>
                  {stops.length} paradas
                  {durationText ? ` · Duración programada: ${durationText}` : ""}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 2. Bus Assignments List */}
        <View style={styles.assignmentsSection}>
          <SectionTitle>
            {departure.assignments.length === 1
              ? "1 Bus asignado"
              : departure.assignments.length > 1
                ? `${departure.assignments.length} Buses asignados`
                : "Asignación de buses"}
          </SectionTitle>

          {/* Multi-bus selector tabs if multiple buses */}
          {departure.assignments.length > 1 ? (
            <View style={styles.multiBusSelectorRow}>
              {departure.assignments.map((assignment, idx) => {
                const isSelectedBus = idx === selectedAssignmentIndex;
                return (
                  <Pressable
                    key={assignment.id}
                    onPress={() => {
                      setSelectedAssignmentIndex(idx);
                      const bStops =
                        assignment.journey?.stops || departure.journey?.stops;
                      if (bStops && bStops.length > 0) {
                        setSelectedStopId(bStops[0]?.id || null);
                      }
                    }}
                    style={[
                      styles.multiBusTab,
                      isSelectedBus && styles.multiBusTabSelected,
                    ]}
                  >
                    <Ionicons
                      name="bus"
                      size={14}
                      color={isSelectedBus ? Colors.white : Colors.primary}
                    />
                    <Text
                      style={[
                        styles.multiBusTabText,
                        isSelectedBus && styles.multiBusTabTextSelected,
                      ]}
                    >
                      {assignment.vehicle.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {departure.assignments.length === 0 ? (
            <View style={styles.emptyAssignmentCard}>
              <Ionicons
                name="bus-outline"
                size={32}
                color={Colors.text.light}
              />
              <Text style={styles.emptyAssignmentTitle}>Bus por asignar</Text>
              <Text style={styles.emptyAssignmentMessage}>
                La salida está programada. Las unidades y conductores se confirman
                antes de la hora de partida.
              </Text>
            </View>
          ) : (
            departure.assignments.map((assignment, index) => (
              <StudentAssignmentCard
                assignment={assignment}
                departureTime={departure.scheduledTime}
                key={assignment.id}
                index={index + 1}
                total={departure.assignments.length}
                isSelected={index === selectedAssignmentIndex}
                onSelect={() => {
                  setSelectedAssignmentIndex(index);
                  const bStops =
                    assignment.journey?.stops || departure.journey?.stops;
                  if (bStops && bStops.length > 0) {
                    setSelectedStopId(bStops[0]?.id || null);
                  }
                }}
              />
            ))
          )}
        </View>

        {/* 3. Complete Stops Itinerary */}
        {stops.length > 0 ? (
          <View style={styles.itinerarySection}>
            <SectionTitle>
              {`Itinerario de paradas (${stops.length})`}
            </SectionTitle>

            <View style={styles.itineraryCard}>
              {stops.map((stop, stopIdx) => {
                const isFirst = stopIdx === 0;
                const isLast = stopIdx === stops.length - 1;
                const isSelected = stop.id === selectedStopId;
                const scheduledStopTime = addMinutesToOperationalTime(
                  departure.scheduledTime,
                  stop.offsetMinutes ?? 0,
                );
                const cleanRef = cleanStopReference(stop.reference);

                return (
                  <Pressable
                    key={stop.id}
                    onPress={() => setSelectedStopId(stop.id)}
                    style={[
                      styles.stopRow,
                      isSelected && styles.stopRowSelected,
                    ]}
                  >
                    {/* Visual node and connecting vertical bar */}
                    <View style={styles.stopIndicatorCol}>
                      <View
                        style={[
                          styles.stopDot,
                          isFirst && styles.stopDotFirst,
                          isLast && styles.stopDotLast,
                          isSelected && styles.stopDotSelected,
                        ]}
                      >
                        {isFirst ? (
                          <Ionicons
                            name="play"
                            size={10}
                            color={Colors.white}
                          />
                        ) : isLast ? (
                          <Ionicons
                            name="flag"
                            size={10}
                            color={Colors.white}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.stopOrderText,
                              isSelected && styles.stopOrderTextSelected,
                            ]}
                          >
                            {stop.order}
                          </Text>
                        )}
                      </View>
                      {!isLast ? (
                        <View style={styles.stopConnectorLine} />
                      ) : null}
                    </View>

                    {/* Stop Name, Programmed Time & Reference */}
                    <View style={styles.stopCopyWrap}>
                      <View style={styles.stopNameRow}>
                        <Text
                          style={[
                            styles.stopNameText,
                            (isFirst || isLast) && styles.stopNameTextKey,
                            isSelected && styles.stopNameTextSelected,
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {stop.name}
                        </Text>

                        {/* Programmed Time Badge */}
                        <View
                          style={[
                            styles.timePill,
                            isFirst && styles.timePillFirst,
                            isLast && styles.timePillLast,
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={11}
                            color={
                              isFirst
                                ? "#052E67"
                                : isLast
                                  ? "#991B1B"
                                  : "#0284C7"
                            }
                          />
                          <Text
                            style={[
                              styles.timePillText,
                              isFirst && styles.timePillTextFirst,
                              isLast && styles.timePillTextLast,
                            ]}
                          >
                            {scheduledStopTime}
                          </Text>
                        </View>
                      </View>

                      {/* Clean Location Reference */}
                      {cleanRef ? (
                        <View style={styles.refRow}>
                          <Ionicons
                            name="location-outline"
                            size={12}
                            color="#64748B"
                          />
                          <Text style={styles.stopRefText} numberOfLines={1}>
                            {cleanRef}
                          </Text>
                        </View>
                      ) : null}

                      {/* Programmed Schedule Label */}
                      <View style={styles.stopSubMetaRow}>
                        {isFirst ? (
                          <Text style={styles.stopSubMetaStart}>
                            Salida programada · {scheduledStopTime}
                          </Text>
                        ) : isLast ? (
                          <Text style={styles.stopSubMetaDest}>
                            Llegada programada · {scheduledStopTime}
                          </Text>
                        ) : (
                          <Text style={styles.stopSubMetaInter}>
                            Paso programado · {scheduledStopTime}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.itinerarySection}>
            <SectionTitle>Itinerario del recorrido</SectionTitle>
            <View style={styles.emptyAssignmentCard}>
              <Ionicons
                name="map-outline"
                size={32}
                color={Colors.text.light}
              />
              <Text style={styles.emptyAssignmentTitle}>
                Recorrido por confirmar
              </Text>
              <Text style={styles.emptyAssignmentMessage}>
                El itinerario y las paradas se confirmarán al asignar la unidad de transporte.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function StudentAssignmentCard({
  assignment,
  departureTime,
  index,
  total,
  isSelected,
  onSelect,
}: {
  assignment: StudentAssignment;
  departureTime: string;
  index: number;
  total: number;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const capacityText =
    typeof assignment.vehicle.capacity === "number" &&
    assignment.vehicle.capacity > 0
      ? `· Capacidad: ${assignment.vehicle.capacity} pasajeros`
      : "· Capacidad no registrada";

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.assignmentCard,
        isSelected && total > 1 && styles.assignmentCardSelected,
      ]}
    >
      {/* 1. Vehicle Header (Code, Plate, Capacity) */}
      <View style={styles.assignmentHeaderRow}>
        <View style={styles.vehicleIconWrap}>
          <Ionicons name="bus" size={24} color={Colors.primary} />
        </View>
        <View style={styles.vehicleInfo}>
          <View style={styles.vehicleTitleRow}>
            <Text style={styles.vehicleCode}>{assignment.vehicle.code}</Text>
            {total > 1 ? (
              <View
                style={[
                  styles.busIndexTag,
                  isSelected && styles.busIndexTagSelected,
                ]}
              >
                <Text
                  style={[
                    styles.busIndexText,
                    isSelected && styles.busIndexTextSelected,
                  ]}
                >
                  Bus {index} de {total}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.vehicleMetaRow}>
            <View style={styles.plateTag}>
              <Ionicons name="card-outline" size={12} color="#052E67" />
              <Text style={styles.plateText}>
                {assignment.vehicle.plate || "Sin placa"}
              </Text>
            </View>
            <Text style={styles.capacityText}>{capacityText}</Text>
          </View>
        </View>
        <StatusBadge state={assignment.operationStatus} />
      </View>

      {/* 2. Driver & Run Status Block */}
      <View style={styles.driverCardBlock}>
        <View style={styles.driverAvatar}>
          <Ionicons name="person" size={18} color={Colors.white} />
        </View>
        <View style={styles.driverInfoWrap}>
          <Text style={styles.driverLabel}>Conductor asignado</Text>
          <Text
            style={styles.driverNameText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {assignment.driverName || "Conductor por confirmar"}
          </Text>

          {/* Operational Run State */}
          <View style={styles.windowTimeRow}>
            {assignment.run?.status === "IN_PROGRESS" ? (
              <>
                <Ionicons name="navigate-circle" size={13} color="#059669" />
                <Text style={styles.runActiveText}>
                  En recorrido · Inicio marcado a las{" "}
                  {formatOperationalTime(
                    assignment.run.startedAt?.split("T")[1] || departureTime,
                  )}
                </Text>
              </>
            ) : assignment.run?.status === "COMPLETED" ? (
              <>
                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                <Text style={styles.runCompletedText}>Recorrido finalizado</Text>
              </>
            ) : (
              <>
                <Ionicons name="time-outline" size={13} color="#64748B" />
                <Text style={styles.windowTimeText}>
                  Turno por iniciar · Salida a las{" "}
                  {formatOperationalTime(departureTime)}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  retryButton: { marginTop: 12 },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: "#052E67",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
  },
  timeWrap: {
    flex: 1,
    minWidth: 120,
    gap: 3,
  },
  timeText: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 30,
    letterSpacing: -0.5,
  },
  dateText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: "Inter-Medium",
    fontSize: 13,
  },
  contextBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  contextText: {
    color: Colors.white,
    fontFamily: "Inter-SemiBold",
    fontSize: 12.5,
  },
  routeOverviewBox: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  routeOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeOverviewText: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 13.5,
    flex: 1,
  },
  routeStopsCountText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: "Inter-Medium",
    fontSize: 12,
  },
  assignmentsSection: {
    gap: 12,
  },
  multiBusSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  multiBusTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  multiBusTabSelected: {
    backgroundColor: "#0868D9",
    borderColor: "#0868D9",
  },
  multiBusTabText: {
    color: "#0F172A",
    fontFamily: "Inter-SemiBold",
    fontSize: 12.5,
  },
  multiBusTabTextSelected: {
    color: Colors.white,
  },
  emptyAssignmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  emptyAssignmentTitle: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 15,
  },
  emptyAssignmentMessage: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  assignmentCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  assignmentCardSelected: {
    borderColor: "#0868D9",
    borderWidth: 1.5,
  },
  assignmentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vehicleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  vehicleInfo: {
    flex: 1,
    gap: 3,
  },
  vehicleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleCode: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 16,
  },
  busIndexTag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  busIndexTagSelected: {
    backgroundColor: "#E0F2FE",
  },
  busIndexText: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 11,
  },
  busIndexTextSelected: {
    color: "#0284C7",
    fontFamily: "Inter-Bold",
  },
  vehicleMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  plateTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  plateText: {
    color: "#052E67",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
  },
  capacityText: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  driverCardBlock: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInfoWrap: {
    flex: 1,
    gap: 2,
  },
  driverLabel: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 11,
  },
  driverNameText: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 13.5,
  },
  windowTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  windowTimeText: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 12,
  },
  runActiveText: {
    color: "#059669",
    fontFamily: "Inter-Bold",
    fontSize: 12,
  },
  runCompletedText: {
    color: "#059669",
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
  },
  itinerarySection: {
    gap: 12,
  },
  itineraryCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 14,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stopRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  stopRowSelected: {
    backgroundColor: "#F0F9FF",
  },
  stopIndicatorCol: {
    alignItems: "center",
    width: 24,
  },
  stopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stopDotFirst: {
    backgroundColor: "#0284C7",
  },
  stopDotLast: {
    backgroundColor: "#EF4444",
  },
  stopDotSelected: {
    borderWidth: 2,
    borderColor: "#0868D9",
    transform: [{ scale: 1.1 }],
  },
  stopOrderText: {
    color: "#475569",
    fontFamily: "Inter-Bold",
    fontSize: 10.5,
  },
  stopOrderTextSelected: {
    color: "#0868D9",
  },
  stopConnectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    minHeight: 34,
  },
  stopCopyWrap: {
    flex: 1,
    gap: 3,
    paddingBottom: 6,
  },
  stopNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stopNameText: {
    color: "#1E293B",
    fontFamily: "Inter-SemiBold",
    fontSize: 13.5,
    lineHeight: 18,
    flex: 1,
  },
  stopNameTextKey: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
  },
  stopNameTextSelected: {
    color: "#0868D9",
    fontFamily: "Inter-Bold",
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    gap: 3,
  },
  timePillFirst: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  timePillLast: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  timePillText: {
    color: "#0284C7",
    fontFamily: "Inter-Bold",
    fontSize: 11,
  },
  timePillTextFirst: {
    color: "#052E67",
  },
  timePillTextLast: {
    color: "#B91C1C",
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  stopRefText: {
    color: "#475569",
    fontFamily: "Inter-Medium",
    fontSize: 11.5,
    flex: 1,
  },
  stopSubMetaRow: {
    marginTop: 2,
  },
  stopSubMetaStart: {
    color: "#0284C7",
    fontFamily: "Inter-SemiBold",
    fontSize: 10.5,
  },
  stopSubMetaDest: {
    color: "#DC2626",
    fontFamily: "Inter-SemiBold",
    fontSize: 10.5,
  },
  stopSubMetaInter: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 10.5,
  },
});
