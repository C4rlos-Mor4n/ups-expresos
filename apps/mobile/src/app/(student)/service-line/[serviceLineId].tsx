import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
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
  ListSkeleton,
  ScreenHeader,
} from "@/components/operational-ui";
import {
  DepartureRow,
  DirectionToggle,
  FavoriteButton,
  LinkButton,
  SectionHeader,
  StopChips,
  studentStyles,
} from "@/components/student-ui";
import { Illustration } from "@/components/visual";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { useGuayaquilClock } from "@/hooks/use-guayaquil-clock";
import { operationalService } from "@/services/operational.service";
import {
  stopKey,
  studentPreferencesService,
} from "@/services/student-preferences.service";
import type { DepartureSummary, Direction } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";
import {
  formatDuration,
  formatGuayaquilDate,
  getDirectionLabel,
  shiftCivilDate,
} from "@/utils/operational";
import {
  clockToMinutes,
  formatRelativeDay,
  splitByClock,
} from "@/utils/schedule";

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function ServiceLineScreen() {
  const { serviceLineId, name, direction: directionParam } = useLocalSearchParams<{
    serviceLineId: string;
    name?: string;
    direction?: Direction;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const clock = useGuayaquilClock();

  const [direction, setDirection] = useState<Direction>(
    directionParam === "RETORNO" ? "RETORNO" : "IDA",
  );
  const [date, setDate] = useState(clock.date);
  const [departures, setDepartures] = useState<DepartureSummary[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [stops, setStops] = useState<Record<string, string>>({});
  const [showPast, setShowPast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isToday = date === clock.date;
  const selectedStopId = serviceLineId ? (stops[stopKey(serviceLineId, direction)] ?? null) : null;

  const load = useCallback(
    async (refresh = false) => {
      if (!serviceLineId) return;
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        setDepartures(await operationalService.getDepartures(serviceLineId, date, direction));
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
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!userId || !serviceLineId) return;
    let active = true;
    void studentPreferencesService.get(userId).then((prefs) => {
      if (!active) return;
      setFavorite(prefs.favoriteLineIds.includes(serviceLineId));
      setStops(prefs.stops);
    });
    return () => {
      active = false;
    };
  }, [serviceLineId, userId]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(student)/(tabs)");
  };

  const toggleFavorite = async () => {
    if (!userId || !serviceLineId) return;
    const ids = await studentPreferencesService.toggleFavoriteLine(userId, serviceLineId);
    setFavorite(ids.includes(serviceLineId));
  };

  const selectStop = async (stopId: string | null) => {
    if (!userId || !serviceLineId) return;
    setStops(await studentPreferencesService.setStop(userId, serviceLineId, direction, stopId));
  };

  // El recorrido se describe una sola vez con la primera salida que lo trae.
  const route = useMemo(() => {
    const reference = departures.find((item) => (item.stopTimes?.length ?? 0) > 1);
    const stopTimes = reference?.stopTimes ?? [];
    const first = stopTimes[0];
    const last = stopTimes[stopTimes.length - 1];
    const duration =
      first && last ? clockToMinutes(last.time) - clockToMinutes(first.time) : 0;
    return {
      stops: stopTimes,
      origin: reference?.originStop ?? first?.name ?? null,
      destination: reference?.destinationStop ?? last?.name ?? null,
      duration: duration > 0 ? duration : 0,
    };
  }, [departures]);

  const { upcoming, past } = useMemo(() => {
    if (!isToday) return { upcoming: departures, past: [] as DepartureSummary[] };
    return splitByClock(departures, clock, () => selectedStopId);
  }, [clock, departures, isToday, selectedStopId]);

  const openDeparture = (id: string) =>
    router.push({
      pathname: "/(student)/scheduled-departure/[departureId]",
      params: { departureId: id },
    });

  const renderRows = (items: DepartureSummary[], isPast = false) => (
    <View style={studentStyles.list}>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <View style={studentStyles.divider} /> : null}
          <DepartureRow
            departure={item}
            clock={clock}
            stopId={selectedStopId}
            past={isPast}
            onPress={() => openDeparture(item.id)}
          />
        </View>
      ))}
    </View>
  );

  return (
    <AppScreen>
      <ScreenHeader
        title={name || "Horarios"}
        subtitle="Horarios y paradas"
        back
        onBack={handleBack}
        right={<FavoriteButton active={favorite} onPress={() => void toggleFavorite()} tone="dark" />}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.dateBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Día anterior"
            onPress={() => setDate((value) => shiftCivilDate(value, -1))}
            style={styles.dateNav}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          </Pressable>
          <View style={styles.dateCopy}>
            <Text style={styles.dateLabel}>{capitalize(formatRelativeDay(date, clock.date))}</Text>
            {formatRelativeDay(date, clock.date).includes(" ") ? null : (
              <Text style={styles.dateSub}>{formatGuayaquilDate(date)}</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Día siguiente"
            onPress={() => setDate((value) => shiftCivilDate(value, 1))}
            style={styles.dateNav}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
          </Pressable>
        </View>

        <DirectionToggle
          value={direction}
          onChange={(next) => {
            setDirection(next);
            setShowPast(false);
          }}
        />

        {route.origin && route.destination ? (
          <View style={styles.routeCard}>
            <Illustration name="route" width={260} style={styles.routeIllustration} />
            <View style={styles.routeLine}>
              <View style={styles.routeDot} />
              <Text style={styles.routeStop} numberOfLines={2}>
                {route.origin}
              </Text>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeLine}>
              <Ionicons name="location" size={14} color={Colors.secondary} />
              <Text style={styles.routeStop} numberOfLines={2}>
                {route.destination}
              </Text>
            </View>
            <Text style={styles.routeMeta}>
              {route.stops.length > 0 ? `${route.stops.length} paradas` : null}
              {route.duration > 0 ? ` · ${formatDuration(route.duration)} aprox.` : ""}
            </Text>
          </View>
        ) : null}

        {route.stops.length > 1 ? (
          <View style={styles.section}>
            <View style={styles.stopIntro}>
              <Illustration name="myStop" height={64} />
              <View style={styles.stopIntroCopy}>
                <Text style={styles.stopIntroTitle}>¿Dónde lo tomas?</Text>
                <Text style={styles.helper}>
                  {selectedStopId
                    ? "Te mostramos la hora a la que el bus pasa por tu parada."
                    : "Elige tu parada y verás a qué hora pasa el bus por ahí."}
                </Text>
              </View>
            </View>
            <StopChips
              stops={route.stops}
              selectedId={selectedStopId}
              onSelect={(stopId) => void selectStop(stopId)}
            />
          </View>
        ) : null}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            illustration="empty"
            title="No pudimos consultar los horarios"
            message={error}
            action={<LinkButton label="Reintentar" onPress={() => void load()} />}
          />
        ) : departures.length === 0 ? (
          <InlineState
            icon="calendar-clear-outline"
            illustration="noMore"
            title="Sin salidas este día"
            message={`No hay salidas de ${getDirectionLabel(direction).toLowerCase()} para ${formatGuayaquilDate(date)}.`}
            action={
              <LinkButton
                label="Ver el día siguiente"
                onPress={() => setDate((value) => shiftCivilDate(value, 1))}
              />
            }
          />
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader
                title={
                  isToday
                    ? upcoming.length > 0
                      ? "Próximas salidas"
                      : "Ya no quedan salidas hoy"
                    : "Salidas"
                }
              />
              {upcoming.length > 0 ? (
                renderRows(upcoming)
              ) : (
                <LinkButton
                  label="Ver salidas de mañana"
                  onPress={() => setDate(shiftCivilDate(clock.date, 1))}
                />
              )}
            </View>

            {past.length > 0 ? (
              <View style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showPast }}
                  onPress={() => setShowPast((value) => !value)}
                  style={styles.pastToggle}
                >
                  <Text style={styles.pastToggleText}>
                    {showPast ? "Ocultar" : "Ver"} salidas que ya pasaron ({past.length})
                  </Text>
                  <Ionicons
                    name={showPast ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={Colors.text.light}
                  />
                </Pressable>
                {showPast ? renderRows([...past].reverse(), true) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 60 },
  section: { gap: 10 },
  dateBar: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    paddingHorizontal: 4,
  },
  dateNav: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  dateCopy: { flex: 1, alignItems: "center" },
  dateLabel: {
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 16,
  },
  dateSub: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 },
  routeCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    padding: 16,
    gap: 4,
  },
  routeLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: Colors.primary,
    marginHorizontal: 1,
  },
  routeConnector: {
    width: 2,
    height: 14,
    backgroundColor: "#CBD5E1",
    marginLeft: 6,
  },
  routeStop: { flex: 1, color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 15 },
  routeMeta: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    marginTop: 8,
  },
  helper: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  stopIntro: { flexDirection: "row", alignItems: "center", gap: 12 },
  stopIntroCopy: { flex: 1, minWidth: 0, gap: 2 },
  stopIntroTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 17 },
  routeIllustration: { alignSelf: "center", marginBottom: 10 },
  pastToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
  },
  pastToggleText: { color: Colors.text.light, fontFamily: "Inter-SemiBold", fontSize: 14 },
});
