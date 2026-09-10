import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
  StatusBadge,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import type { Campus, DepartureSummary } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";
import {
  formatOperationalTime,
  getDirectionLabel,
  getDisplayName,
  getGuayaquilCurrentTime,
  getGuayaquilToday,
} from "@/utils/operational";

const busIsolatedImage = require("../../../../assets/images/images_upsgo/bus-isolated.png");

interface StudentDepartureSummary extends DepartureSummary {
  serviceLineName: string;
}

export default function StudentHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;

  const [preferredCampus, setPreferredCampus] = useState<Campus | null>(null);
  const [nextDeparture, setNextDeparture] =
    useState<StudentDepartureSummary | null>(null);
  const [remainingDepartures, setRemainingDepartures] = useState<
    StudentDepartureSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(
    async (isPullToRefresh = false) => {
      if (!userId) return;
      try {
        if (isPullToRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const [backendCampuses, savedPrefId] = await Promise.all([
          operationalService.getCampuses(),
          campusPreferenceService.getPreferredCampusId(userId),
        ]);

        let activeCampus: Campus | null = null;
        if (savedPrefId) {
          activeCampus =
            backendCampuses.find((c) => c.id === savedPrefId) || null;
          if (!activeCampus) {
            await campusPreferenceService.clearPreferredCampusId(userId);
          }
        }

        if (!activeCampus) {
          router.replace("/(student)/campus-preference");
          return;
        }
        setPreferredCampus(activeCampus);

        if (activeCampus) {
          const today = getGuayaquilToday();
          const lines = await operationalService.getServiceLines(
            activeCampus.id,
          );

          const departuresByLine = await Promise.all(
            lines.map(async (line) => {
              const [ida, retorno] = await Promise.all([
                operationalService.getDepartures(line.id, today, "IDA"),
                operationalService.getDepartures(line.id, today, "RETORNO"),
              ]);
              return [...ida, ...retorno].map((dep) => ({
                ...dep,
                serviceLineName: line.name,
              }));
            }),
          );

          const allTodayDepartures = departuresByLine
            .flat()
            .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

          const currentGuayaquilTime = getGuayaquilCurrentTime();
          const upcoming = allTodayDepartures.filter(
            (d) =>
              formatOperationalTime(d.scheduledTime) >= currentGuayaquilTime,
          );

          const next = upcoming.length > 0 ? (upcoming[0] ?? null) : null;
          const remaining = allTodayDepartures.filter((d) => d.id !== next?.id);

          setNextDeparture(next);
          setRemainingDepartures(remaining);
        } else {
          setNextDeparture(null);
          setRemainingDepartures([]);
        }
      } catch (loadError) {
        setError(getOperationalErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, userId],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const rawName = getDisplayName(user?.name, user?.email);
  const firstName = rawName.split(" ")[0] || rawName;

  return (
    <AppScreen>
      <ScreenHeader
        title="UPS GO"
        subtitle="Transporte universitario"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Configuración"
            onPress={() => router.push("/(student)/(tabs)/profile")}
            style={styles.settingsButton}
          >
            <Ionicons name="settings-sharp" size={20} color={Colors.white} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(true)}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 1. Greeting Card */}
        <View style={styles.greetingCard}>
          <View style={styles.greetingContent}>
            <Text style={styles.greetingTitle}>Hola, {firstName} 👋</Text>
            <Text style={styles.greetingSubtitle}>
              Organiza tu día y llega a tiempo.
            </Text>
          </View>
          <View style={styles.greetingBusWrap}>
            <Image
              source={busIsolatedImage}
              style={styles.greetingBusImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="No pudimos cargar los servicios"
            message={error}
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadData()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            }
          />
        ) : (
          <>
            {/* 2. Preferred Campus Card */}
            {preferredCampus ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cambiar campus principal"
                onPress={() => router.push("/(student)/campus-preference")}
                style={({ pressed }) => [
                  styles.campusCard,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.campusIconContainer}>
                  <Ionicons name="business" size={22} color={Colors.primary} />
                </View>

                <View style={styles.campusInfo}>
                  <Text style={styles.campusLabel}>TU CAMPUS PRINCIPAL</Text>
                  <View style={styles.campusNameRow}>
                    <Ionicons name="location-sharp" size={15} color="#F59E0B" />
                    <Text
                      style={styles.campusName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {preferredCampus.name}
                    </Text>
                  </View>
                </View>

                <View style={styles.changeContainer}>
                  <Text style={styles.changeText}>Cambiar</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={Colors.primary}
                  />
                </View>
              </Pressable>
            ) : null}

            {/* 3. Next Departure Card ("Próxima salida hoy") */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Próxima salida hoy</Text>
              {nextDeparture ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Próxima salida ${formatOperationalTime(nextDeparture.scheduledTime)}`}
                  onPress={() =>
                    router.push({
                      pathname: "/(student)/scheduled-departure/[departureId]",
                      params: { departureId: nextDeparture.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.nextDepartureCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Vertical Blue Left Accent Bar */}
                  <View style={styles.leftAccentStrip} />

                  <View style={styles.nextCardInner}>
                    <View style={styles.nextCardTopRow}>
                      <View style={styles.busCircle}>
                        <Ionicons name="bus" size={22} color={Colors.white} />
                      </View>
                      <Text
                        style={styles.departureTime}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatOperationalTime(nextDeparture.scheduledTime)}
                      </Text>
                      <StatusBadge state={nextDeparture.state} />
                    </View>

                    <View style={styles.nextRouteDetails}>
                      <Text style={styles.nextRouteName} numberOfLines={2}>
                        {nextDeparture.serviceLineName}
                      </Text>
                      <View style={styles.nextDirectionRow}>
                        <Text style={styles.nextDirectionArrow}>→</Text>
                        <Text style={styles.nextDirectionLabel}>
                          {getDirectionLabel(nextDeparture.direction)}
                        </Text>
                      </View>
                      {nextDeparture.originStop &&
                      nextDeparture.destinationStop ? (
                        <View style={styles.nextRoutePreviewRow}>
                          <Ionicons
                            name="navigate-circle"
                            size={14}
                            color="#0284C7"
                          />
                          <Text
                            style={styles.nextRoutePreviewText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {nextDeparture.originStop} ➔{" "}
                            {nextDeparture.destinationStop}
                          </Text>
                        </View>
                      ) : null}

                      {nextDeparture.assignedVehicles &&
                      nextDeparture.assignedVehicles.length > 0 ? (
                        <View style={styles.nextAssignedBlock}>
                          <View style={styles.nextUnitPill}>
                            <Ionicons name="bus" size={12} color="#07508E" />
                            <Text style={styles.nextUnitPillCode}>
                              {nextDeparture.assignedVehicles[0]?.code}
                            </Text>
                            <View style={styles.plateDivider} />
                            <Ionicons
                              name="card-outline"
                              size={11}
                              color="#07508E"
                            />
                            <Text style={styles.nextUnitPillPlate}>
                              {nextDeparture.assignedVehicles[0]?.plate}
                            </Text>
                          </View>
                          {nextDeparture.assignedVehicles[0]?.driverName ? (
                            <View style={styles.nextDriverPill}>
                              <Ionicons
                                name="person"
                                size={11}
                                color="#0F766E"
                              />
                              <Text
                                style={styles.nextDriverPillText}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {nextDeparture.assignedVehicles[0]?.driverName}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={styles.nextBusAssignmentText}>
                          Bus por asignar · Unidad y conductor en confirmación
                        </Text>
                      )}
                    </View>

                    <View style={styles.nextCardDivider} />

                    <View style={styles.nextCardFooter}>
                      <Text style={styles.nextFooterActionText}>
                        Ver paradas e itinerario
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={Colors.primary}
                      />
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.emptyNextCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons
                      name="time-outline"
                      size={24}
                      color={Colors.primary}
                    />
                  </View>
                  <View style={styles.emptyNextCopy}>
                    <Text style={styles.emptyNextTitle}>
                      No quedan salidas programadas para hoy
                    </Text>
                    <Text style={styles.emptyNextMessage}>
                      Puedes consultar los horarios de otros días o líneas del
                      campus.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 4. Scheduled Departures Timeline Card */}
            {remainingDepartures.length > 0 ? (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeadingRow}>
                  <Text style={styles.sectionHeading}>
                    Salidas programadas para hoy
                  </Text>
                  {preferredCampus ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: "/(student)/campus/[campusId]",
                          params: {
                            campusId: preferredCampus.id,
                            name: preferredCampus.name,
                          },
                        })
                      }
                      style={styles.seeAllButton}
                    >
                      <Text style={styles.seeAllText}>Ver todas</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={Colors.primary}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.timelineCard}>
                  {remainingDepartures.map((dep, index) => {
                    const isLast = index === remainingDepartures.length - 1;
                    const isFirst = index === 0;
                    return (
                      <Pressable
                        key={dep.id}
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname:
                              "/(student)/scheduled-departure/[departureId]",
                            params: { departureId: dep.id },
                          })
                        }
                        style={({ pressed }) => [
                          styles.timelineRow,
                          !isLast && styles.timelineRowDivider,
                          pressed && styles.cardPressed,
                        ]}
                      >
                        {/* Vertical timeline node */}
                        <View style={styles.timelineNode}>
                          <View
                            style={[
                              styles.timelineDot,
                              isFirst
                                ? styles.timelineDotActive
                                : styles.timelineDotInactive,
                            ]}
                          />
                          {!isLast ? (
                            <View style={styles.timelineVerticalLine} />
                          ) : null}
                        </View>

                        {/* Departure Time */}
                        <Text style={styles.timelineTime}>
                          {formatOperationalTime(dep.scheduledTime)}
                        </Text>

                        {/* Route info */}
                        <View style={styles.timelineInfo}>
                          <Text
                            style={styles.timelineLineName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {dep.serviceLineName}
                          </Text>
                          <View style={styles.timelineMetaRow}>
                            <Text
                              style={styles.timelineMeta}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {getDirectionLabel(dep.direction)}
                            </Text>
                            {dep.assignedVehicles && dep.assignedVehicles[0] ? (
                              <View style={styles.timelinePlateTag}>
                                <Ionicons
                                  name="card-outline"
                                  size={10}
                                  color="#07508E"
                                />
                                <Text style={styles.timelinePlateText}>
                                  {dep.assignedVehicles[0].plate}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* Status badge & Chevron */}
                        <View style={styles.timelineAction}>
                          <StatusBadge state={dep.state} />
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#94A3B8"
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 110,
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  greetingCard: {
    backgroundColor: "#052E67",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
    position: "relative",
    overflow: "hidden",
  },
  greetingContent: {
    flex: 1,
    gap: 4,
    zIndex: 2,
  },
  greetingTitle: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 22,
    lineHeight: 27,
  },
  greetingSubtitle: {
    color: "rgba(255, 255, 255, 0.82)",
    fontFamily: "Inter-Regular",
    fontSize: 13,
  },
  greetingBusWrap: {
    width: 105,
    height: 65,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingBusImage: {
    width: "100%",
    height: "100%",
  },
  campusCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  campusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#EBF3FB",
    alignItems: "center",
    justifyContent: "center",
  },
  campusInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  campusLabel: {
    color: "#64748B",
    fontFamily: "Inter-Bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  campusNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  campusName: {
    flex: 1,
    flexShrink: 1,
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 15,
  },
  changeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  changeText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  sectionHeading: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 16,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  seeAllText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  nextDepartureCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    shadowColor: Colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative",
    overflow: "hidden",
  },
  leftAccentStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4.5,
    backgroundColor: "#0868D9",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  nextCardInner: {
    padding: 16,
    paddingLeft: 20,
    gap: 12,
  },
  nextCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  busCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  departureTime: {
    flex: 1,
    minWidth: 80,
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 26,
    letterSpacing: -0.5,
  },
  nextRouteDetails: {
    gap: 4,
  },
  nextRouteName: {
    color: "#0F172A",
    fontFamily: "Inter-SemiBold",
    fontSize: 14.5,
    lineHeight: 20,
  },
  nextDirectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nextDirectionArrow: {
    color: "#64748B",
    fontSize: 13,
  },
  nextDirectionLabel: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 13,
  },
  nextRoutePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  nextRoutePreviewText: {
    color: "#334155",
    fontFamily: "Inter-Medium",
    fontSize: 12,
    flex: 1,
  },
  nextAssignedBlock: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  nextUnitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  nextUnitPillCode: {
    color: "#052E67",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
  },
  plateDivider: {
    width: 1,
    height: 10,
    backgroundColor: "#CBD5E1",
  },
  nextUnitPillPlate: {
    color: "#07508E",
    fontFamily: "Inter-Bold",
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  nextDriverPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#CCFBF1",
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#99F6E4",
    gap: 4,
    flexShrink: 1,
  },
  nextDriverPillText: {
    color: "#0F766E",
    fontFamily: "Inter-SemiBold",
    fontSize: 11.5,
  },
  nextBusAssignmentText: {
    color: "#64748B",
    fontFamily: "Inter-Medium",
    fontSize: 12,
    marginTop: 2,
  },
  nextCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
  },
  nextCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  nextFooterActionText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 13.5,
  },
  timelineCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    shadowColor: Colors.navy,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  timelineRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F1F5F9",
  },
  timelineNode: {
    width: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
  },
  timelineDotActive: {
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  timelineDotInactive: {
    backgroundColor: "#94A3B8",
  },
  timelineVerticalLine: {
    position: "absolute",
    top: 12,
    bottom: -28,
    width: 1.5,
    backgroundColor: "#CBD5E1",
    zIndex: 1,
  },
  timelineTime: {
    color: "#0F172A",
    fontFamily: "Inter-Bold",
    fontSize: 15,
    flexShrink: 0,
  },
  timelineInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timelineLineName: {
    color: "#0F172A",
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  timelineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  timelineMeta: {
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 11.5,
  },
  timelinePlateTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 3,
  },
  timelinePlateText: {
    color: "#07508E",
    fontFamily: "Inter-Bold",
    fontSize: 10.5,
  },
  timelineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  emptyNextCard: {
    backgroundColor: "#F7FAFE",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#E1ECF7",
  },
  emptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyNextCopy: {
    flex: 1,
    gap: 3,
  },
  emptyNextTitle: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  emptyNextMessage: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  retryButton: {
    marginTop: 10,
  },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
  cardPressed: {
    opacity: 0.85,
  },
});
