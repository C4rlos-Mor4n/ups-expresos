import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
} from "@/components/operational-ui";
import {
  DepartureRow,
  DirectionToggle,
  FavoriteButton,
  LinkButton,
  NamePromptCard,
  NextBusCard,
  SectionHeader,
  studentStyles,
} from "@/components/student-ui";
import { Illustration } from "@/components/visual";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { useGuayaquilClock } from "@/hooks/use-guayaquil-clock";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import {
  stopKey,
  studentPreferencesService,
} from "@/services/student-preferences.service";
import type {
  Campus,
  DepartureSummary,
  Direction,
  ServiceLine,
} from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";
import { getDirectionLabel } from "@/utils/operational";
import {
  departureTimeAt,
  formatLongDate,
  formatRelativeDay,
  greetingName,
  nextServiceDates,
  splitByClock,
} from "@/utils/schedule";

interface LineDeparture extends DepartureSummary {
  lineId: string;
  lineName: string;
}

type FutureLookup =
  | { status: "idle" | "none" }
  | { status: "found"; departure: LineDeparture };

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// Días hacia adelante que se consultan cuando hoy ya no quedan salidas.
const LOOKAHEAD_DAYS = 7;

export default function StudentHomeScreen() {
  const router = useRouter();
  const { user, updateName } = useAuth();
  const userId = user?.id;
  const clock = useGuayaquilClock();

  const [campus, setCampus] = useState<Campus | null>(null);
  const [lines, setLines] = useState<ServiceLine[]>([]);
  const [departures, setDepartures] = useState<LineDeparture[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [stops, setStops] = useState<Record<string, string>>({});
  const [namePromptDismissed, setNamePromptDismissed] = useState(true);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [future, setFuture] = useState<Record<Direction, FutureLookup>>({
    IDA: { status: "idle" },
    RETORNO: { status: "idle" },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lookupsInFlight = useRef(new Set<string>());

  const load = useCallback(
    async (isPullToRefresh = false) => {
      if (!userId) return;
      try {
        if (isPullToRefresh) setRefreshing(true);
        setError(null);

        const [campuses, savedCampusId, prefs] = await Promise.all([
          operationalService.getCampuses(),
          campusPreferenceService.getPreferredCampusId(userId),
          studentPreferencesService.get(userId),
        ]);
        setFavorites(prefs.favoriteLineIds);
        setStops(prefs.stops);
        setNamePromptDismissed(prefs.namePromptDismissed);

        const activeCampus = campuses.find((item) => item.id === savedCampusId);
        if (!activeCampus) {
          if (savedCampusId) await campusPreferenceService.clearPreferredCampusId(userId);
          router.replace("/(student)/campus-preference");
          return;
        }
        setCampus(activeCampus);

        const today = clock.date;
        const campusLines = await operationalService.getServiceLines(activeCampus.id);
        const perLine = await Promise.all(
          campusLines.map(async (line) => {
            const [ida, retorno] = await Promise.all([
              operationalService.getDepartures(line.id, today, "IDA"),
              operationalService.getDepartures(line.id, today, "RETORNO"),
            ]);
            return [...ida, ...retorno].map((item) => ({
              ...item,
              lineId: line.id,
              lineName: line.name,
            }));
          }),
        );
        setLines(campusLines);
        setDepartures(perLine.flat());
        setFuture({ IDA: { status: "idle" }, RETORNO: { status: "idle" } });
      } catch (loadError) {
        setError(getOperationalErrorMessage(loadError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // clock.date: si cambia el día con la app abierta, se recargan las salidas.
    [clock.date, router, userId],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Líneas que manda el estudiante: sus favoritas del campus, o todas si no marcó ninguna.
  const relevantLineIds = useMemo(() => {
    const favoriteIds = lines
      .filter((line) => favorites.includes(line.id))
      .map((line) => line.id);
    return new Set(favoriteIds.length > 0 ? favoriteIds : lines.map((line) => line.id));
  }, [favorites, lines]);

  const stopFor = useCallback(
    (item: LineDeparture) => stops[stopKey(item.lineId, item.direction)] ?? null,
    [stops],
  );

  const relevant = useMemo(
    () => departures.filter((item) => relevantLineIds.has(item.lineId)),
    [departures, relevantLineIds],
  );

  // Sentido por defecto: el del próximo bus de cualquier sentido (ida en la mañana, retorno en la tarde).
  const autoDirection = useMemo<Direction>(() => {
    const { upcoming } = splitByClock(relevant, clock, stopFor);
    return upcoming[0]?.direction ?? "IDA";
  }, [clock, relevant, stopFor]);
  const activeDirection = direction ?? autoDirection;

  const { upcoming } = useMemo(
    () =>
      splitByClock(
        relevant.filter((item) => item.direction === activeDirection),
        clock,
        stopFor,
      ),
    [activeDirection, clock, relevant, stopFor],
  );
  const hero = upcoming[0] ?? null;
  // Distingue "hoy no hay" (p. ej. domingo) de "hoy ya no quedan".
  const hadDeparturesToday = relevant.some((item) => item.direction === activeDirection);
  const later = upcoming.slice(1, 5);

  // Si hoy ya no hay salidas en este sentido, busca la siguiente en los próximos días.
  const futureLookup = future[activeDirection];
  useEffect(() => {
    if (loading || hero || futureLookup.status !== "idle" || relevantLineIds.size === 0) {
      return;
    }
    // Evita consultas duplicadas mientras la búsqueda sigue en curso.
    const lookupKey = `${clock.date}:${activeDirection}:${[...relevantLineIds].join(",")}`;
    if (lookupsInFlight.current.has(lookupKey)) return;
    lookupsInFlight.current.add(lookupKey);
    let cancelled = false;
    void (async () => {
      try {
        for (const date of nextServiceDates(clock.date, LOOKAHEAD_DAYS)) {
          const found = await Promise.all(
            lines
              .filter((line) => relevantLineIds.has(line.id))
              .map(async (line) =>
                (await operationalService.getDepartures(line.id, date, activeDirection)).map(
                  (item) => ({ ...item, lineId: line.id, lineName: line.name }),
                ),
              ),
          );
          const sorted = found
            .flat()
            .sort((a, b) =>
              departureTimeAt(a, stopFor(a)).time.localeCompare(
                departureTimeAt(b, stopFor(b)).time,
              ),
            );
          if (sorted[0]) {
            if (!cancelled) {
              setFuture((current) => ({
                ...current,
                [activeDirection]: { status: "found", departure: sorted[0]! },
              }));
            }
            return;
          }
        }
        if (!cancelled) {
          setFuture((current) => ({ ...current, [activeDirection]: { status: "none" } }));
        }
      } catch {
        if (!cancelled) {
          setFuture((current) => ({ ...current, [activeDirection]: { status: "none" } }));
        }
      } finally {
        lookupsInFlight.current.delete(lookupKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDirection, clock.date, futureLookup.status, hero, lines, loading, relevantLineIds, stopFor]);

  const openDeparture = (id: string) =>
    router.push({
      pathname: "/(student)/scheduled-departure/[departureId]",
      params: { departureId: id },
    });
  const openLine = (line: { id: string; name: string }) =>
    router.push({
      pathname: "/(student)/service-line/[serviceLineId]",
      params: { serviceLineId: line.id, name: line.name },
    });

  const toggleFavorite = async (lineId: string) => {
    if (!userId) return;
    setFavorites(await studentPreferencesService.toggleFavoriteLine(userId, lineId));
    setFuture({ IDA: { status: "idle" }, RETORNO: { status: "idle" } });
  };

  const firstName = greetingName(user?.name);
  const showNamePrompt = !user?.name?.trim() && !namePromptDismissed;
  const directionLabel = getDirectionLabel(activeDirection).toLowerCase();
  const sortedLines = [...lines].sort(
    (a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)),
  );

  return (
    <AppScreen>
      <ScreenHeader title="UPS GO" subtitle="Transporte universitario" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.greeting}>
          <Text style={styles.greetingDate}>{capitalize(formatLongDate(clock.date))}</Text>
          <Text style={styles.greetingTitle}>
            {firstName ? `Hola, ${firstName} 👋` : "¡Hola! 👋"}
          </Text>
          {campus ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Campus principal: ${campus.name}. Cambiar`}
              onPress={() => router.push("/(student)/campus-preference")}
              hitSlop={6}
              style={styles.campusPill}
            >
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.campusText} numberOfLines={1}>
                {campus.name}
              </Text>
              <Text style={styles.campusChange}>Cambiar</Text>
            </Pressable>
          ) : null}
        </View>

        {showNamePrompt && userId ? (
          <NamePromptCard
            onSave={updateName}
            onDismiss={() => {
              setNamePromptDismissed(true);
              void studentPreferencesService.dismissNamePrompt(userId);
            }}
          />
        ) : null}

        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            illustration="empty"
            title="No pudimos cargar tus salidas"
            message={error}
            action={<LinkButton label="Reintentar" onPress={() => void load()} />}
          />
        ) : lines.length === 0 ? (
          <InlineState
            icon="bus-outline"
            illustration="busStop"
            title="Tu campus aún no tiene rutas"
            message="Cuando la universidad publique rutas para este campus, aparecerán aquí."
          />
        ) : (
          <>
            <DirectionToggle value={activeDirection} onChange={setDirection} />

            {hero ? (
              <NextBusCard
                departure={hero}
                lineName={hero.lineName}
                clock={clock}
                stopId={stopFor(hero)}
                onPress={() => openDeparture(hero.id)}
                onChooseStop={() => openLine({ id: hero.lineId, name: hero.lineName })}
              />
            ) : futureLookup.status === "found" ? (
              <View style={styles.section}>
                <Text style={styles.caption}>
                  {hadDeparturesToday
                    ? `Hoy ya no hay más salidas de ${directionLabel}.`
                    : `Hoy no hay salidas de ${directionLabel}.`}
                </Text>
                <NextBusCard
                  departure={futureLookup.departure}
                  lineName={futureLookup.departure.lineName}
                  clock={clock}
                  stopId={stopFor(futureLookup.departure)}
                  dayLabel={formatRelativeDay(futureLookup.departure.serviceDate, clock.date)}
                  onPress={() => openDeparture(futureLookup.departure.id)}
                />
              </View>
            ) : (
              <View style={styles.noMore}>
                <Illustration name="noMore" width={220} />
                <View style={styles.noMoreCopy}>
                  <Text style={styles.noMoreTitle}>
                    {hadDeparturesToday
                      ? `Hoy ya no hay más salidas de ${directionLabel}`
                      : `Hoy no hay salidas de ${directionLabel}`}
                  </Text>
                  <Text style={styles.noMoreText}>
                    {futureLookup.status === "none"
                      ? "No hay salidas programadas en los próximos días."
                      : "Buscando la próxima salida…"}
                  </Text>
                </View>
              </View>
            )}

            {later.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="Más tarde hoy" />
                <View style={studentStyles.list}>
                  {later.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 ? <View style={studentStyles.divider} /> : null}
                      <DepartureRow
                        departure={item}
                        clock={clock}
                        stopId={stopFor(item)}
                        title={lines.length > 1 ? item.lineName : undefined}
                        onPress={() => openDeparture(item.id)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeader
                title={favorites.length > 0 ? "Tus líneas" : "Líneas de tu campus"}
              />
              <View style={studentStyles.list}>
                {sortedLines.map((line, index) => {
                  const next = splitByClock(
                    departures.filter((item) => item.lineId === line.id),
                    clock,
                    stopFor,
                  ).upcoming[0];
                  return (
                    <View key={line.id}>
                      {index > 0 ? <View style={studentStyles.divider} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ver horarios de ${line.name}`}
                        onPress={() => openLine(line)}
                        style={({ pressed }) => [styles.lineRow, pressed && styles.pressed]}
                      >
                        <View style={styles.lineIcon}>
                          <Ionicons name="bus" size={18} color={Colors.primary} />
                        </View>
                        <View style={styles.lineCopy}>
                          <Text style={styles.lineName} numberOfLines={1}>
                            {line.name}
                          </Text>
                          <Text style={styles.lineMeta} numberOfLines={1}>
                            {next
                              ? `Próxima: ${departureTimeAt(next, stopFor(next)).time} · ${getDirectionLabel(next.direction).toLowerCase()}`
                              : "Sin más salidas hoy"}
                          </Text>
                        </View>
                        <FavoriteButton
                          active={favorites.includes(line.id)}
                          onPress={() => void toggleFavorite(line.id)}
                        />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {favorites.length === 0 && lines.length > 1 ? (
                <Text style={styles.hint}>
                  Marca con ★ las líneas que usas y el inicio mostrará solo esas.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 120 },
  pressed: { opacity: 0.85 },
  greeting: { gap: 6 },
  greetingDate: {
    color: Colors.text.light,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  greetingTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 24 },
  campusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E1EAF5",
    paddingHorizontal: 12,
    minHeight: 34,
  },
  campusText: {
    flexShrink: 1,
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
  campusChange: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 13 },
  section: { gap: 10 },
  caption: { color: Colors.text.light, fontFamily: "Inter-Medium", fontSize: 14, paddingHorizontal: 2 },
  noMore: {
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    padding: 16,
  },
  noMoreCopy: { gap: 4, alignItems: "center" },
  noMoreTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 16, textAlign: "center" },
  noMoreText: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  lineRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  lineIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  lineCopy: { flex: 1, minWidth: 0, gap: 2 },
  lineName: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 16 },
  lineMeta: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 },
  hint: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
});
