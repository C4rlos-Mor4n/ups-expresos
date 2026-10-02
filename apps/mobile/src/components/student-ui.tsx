import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBadge } from "@/components/operational-ui";
import { Illustration, PressableScale } from "@/components/visual";
import { Colors } from "@/constants/Colors";
import type {
  DepartureStopTime,
  DepartureSummary,
  Direction,
} from "@/types/operational";
import { getDirectionLabel } from "@/utils/operational";
import {
  departureTimeAt,
  formatTimeUntil,
  minutesUntil,
  type GuayaquilClock,
} from "@/utils/schedule";

/** Muestra el estado solo cuando aporta: "Programado" es el estado por defecto. */
export function StateChip({ state }: { state: DepartureSummary["state"] }) {
  if (state === "SCHEDULED") return null;
  return <StatusBadge state={state} />;
}

export function DirectionToggle({
  value,
  onChange,
}: {
  value: Direction;
  onChange: (direction: Direction) => void;
}) {
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {(["IDA", "RETORNO"] as const).map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={[styles.toggleOption, selected && styles.toggleOptionSelected]}
          >
            <Ionicons
              name={option === "IDA" ? "arrow-forward" : "arrow-back"}
              size={15}
              color={selected ? Colors.primary : Colors.text.light}
            />
            <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>
              {option === "IDA" ? "Ida al campus" : "Retorno"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FavoriteButton({
  active,
  onPress,
  tone = "light",
}: {
  active: boolean;
  onPress: () => void;
  tone?: "light" | "dark";
}) {
  const color = active
    ? Colors.secondary
    : tone === "dark"
      ? Colors.white
      : Colors.text.light;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? "Quitar de mis líneas" : "Guardar en mis líneas"}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      hitSlop={10}
      style={[styles.favorite, tone === "dark" && styles.favoriteDark]}
    >
      <Ionicons name={active ? "star" : "star-outline"} size={20} color={color} />
    </Pressable>
  );
}

/** Fila compacta de una salida: hora (en tu parada si la elegiste) y cuánto falta. */
export function DepartureRow({
  departure,
  clock,
  stopId,
  title,
  past = false,
  onPress,
}: {
  departure: DepartureSummary;
  clock: GuayaquilClock;
  stopId?: string | null;
  title?: string;
  past?: boolean;
  onPress: () => void;
}) {
  const { time, atStop } = departureTimeAt(departure, stopId);
  const until = minutesUntil(departure.serviceDate, time, clock);
  const isToday = departure.serviceDate === clock.date;
  const vehicle = departure.assignedVehicles?.[0];
  const subtitle = [
    title,
    title ? getDirectionLabel(departure.direction) : null,
    atStop ? `sale ${departure.scheduledTime.slice(0, 5)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Salida ${time}${isToday && !past ? `, ${formatTimeUntil(until)}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={[styles.rowTime, past && styles.rowPast]}>{time}</Text>
      <View style={styles.rowCopy}>
        {isToday && !past ? (
          <Text style={[styles.rowUntil, until <= 15 && styles.rowUntilSoon]}>
            {formatTimeUntil(until)}
          </Text>
        ) : past ? (
          <Text style={styles.rowPastLabel}>Ya salió</Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.rowSubtitle, past && styles.rowPast]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {vehicle ? (
        <View style={styles.plate}>
          <Ionicons name="bus" size={12} color={Colors.primary} />
          <Text style={styles.plateText}>{vehicle.plate}</Text>
        </View>
      ) : null}
      <StateChip state={departure.state} />
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </Pressable>
  );
}

export function StopChips({
  stops,
  selectedId,
  onSelect,
}: {
  stops: DepartureStopTime[];
  selectedId: string | null;
  onSelect: (stopId: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {stops.map((stop) => {
        const selected = stop.stopId === selectedId;
        return (
          <Pressable
            key={stop.stopId}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(selected ? null : stop.stopId)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            {selected ? (
              <Ionicons name="location" size={14} color={Colors.navy} />
            ) : null}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {stop.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Tarjeta protagonista del inicio con forma de boleto: el próximo bus del estudiante. */
export function NextBusCard({
  departure,
  lineName,
  clock,
  stopId,
  dayLabel,
  onPress,
  onChooseStop,
}: {
  departure: DepartureSummary;
  lineName: string;
  clock: GuayaquilClock;
  stopId?: string | null;
  dayLabel?: string;
  onPress: () => void;
  onChooseStop?: () => void;
}) {
  const { time, atStop } = departureTimeAt(departure, stopId);
  const until = minutesUntil(departure.serviceDate, time, clock);
  const isToday = departure.serviceDate === clock.date;
  const stopName = atStop
    ? departure.stopTimes?.find((item) => item.stopId === stopId)?.name
    : null;
  const vehicle = departure.assignedVehicles?.[0];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Tu próximo bus: ${lineName}, ${time}`}
      onPress={onPress}
      style={styles.ticket}
    >
      <View style={styles.ticketTop}>
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketEyebrow}>
            {isToday ? "Tu próximo bus" : `Próximo bus · ${dayLabel ?? ""}`}
          </Text>
          <StateChip state={departure.state} />
        </View>

        <View style={styles.ticketMain}>
          <View style={styles.ticketMainCopy}>
            <Text style={styles.ticketUntil} numberOfLines={1} adjustsFontSizeToFit>
              {isToday ? formatTimeUntil(until) : time}
            </Text>
            <View style={styles.ticketTimeRow}>
              {isToday ? (
                <View style={styles.ticketTimePill}>
                  <Ionicons name="time" size={13} color={Colors.navy} />
                  <Text style={styles.ticketTimeText}>{time}</Text>
                </View>
              ) : null}
              <Text style={styles.ticketLine} numberOfLines={1}>
                {lineName} · {getDirectionLabel(departure.direction)}
              </Text>
            </View>
          </View>
          <Illustration name="bus" width={112} />
        </View>

        {departure.originStop && departure.destinationStop ? (
          <View style={styles.ticketRoute}>
            <View style={styles.ticketRouteRow}>
              <View style={styles.ticketDot} />
              <Text style={styles.ticketRouteText} numberOfLines={1}>
                {departure.originStop}
              </Text>
            </View>
            <View style={styles.ticketRouteLine} />
            <View style={styles.ticketRouteRow}>
              <Ionicons name="location" size={14} color={Colors.secondary} />
              <Text style={styles.ticketRouteText} numberOfLines={1}>
                {departure.destinationStop}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dash} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.ticketStub}>
        <View style={styles.ticketStubCopy}>
          {stopName ? (
            <>
              <Text style={styles.stubLabel}>Tu parada · {time}</Text>
              <Text style={styles.stubValue} numberOfLines={1}>
                {stopName}
              </Text>
            </>
          ) : onChooseStop ? (
            <Pressable accessibilityRole="button" onPress={onChooseStop} hitSlop={8}>
              <Text style={styles.stubLabel}>¿Dónde lo tomas?</Text>
              <Text style={styles.stubLink}>Elige tu parada</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.stubLabel}>Bus</Text>
              <Text style={styles.stubValue} numberOfLines={1}>
                {vehicle ? `${vehicle.code} · ${vehicle.plate}` : "Por confirmar"}
              </Text>
            </>
          )}
        </View>
        <View style={styles.ticketCta}>
          <Text style={styles.ticketCtaText}>Ver recorrido</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.navy} />
        </View>
      </View>
    </PressableScale>
  );
}

export function NamePromptCard({
  onSave,
  onDismiss,
}: {
  onSave: (name: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2;

  const save = async () => {
    if (!valid || saving) return;
    try {
      setSaving(true);
      setError(null);
      await onSave(name.trim());
    } catch {
      setError("No pudimos guardar tu nombre. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.prompt}>
      <View style={styles.promptHeader}>
        <Illustration name="welcome" height={64} />
        <View style={styles.promptCopy}>
          <Text style={styles.promptTitle}>¿Cómo te llamamos?</Text>
          <Text style={styles.promptText}>Así te saludamos cada día.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Ahora no" onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={20} color={Colors.text.light} />
        </Pressable>
      </View>
      <View style={styles.promptRow}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor="#94A3B8"
          maxLength={60}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
          style={styles.promptInput}
          accessibilityLabel="Tu nombre"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !valid || saving }}
          disabled={!valid || saving}
          onPress={() => void save()}
          style={[styles.promptButton, (!valid || saving) && styles.promptButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.promptButtonText}>Guardar</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.promptError}>{error}</Text> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
    </Pressable>
  );
}

export const studentStyles = StyleSheet.create({
  list: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E2E8F0",
  },
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  ticket: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    shadowColor: Colors.navy,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  ticketTop: { padding: 20, paddingBottom: 14, gap: 10 },
  ticketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ticketEyebrow: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  ticketMain: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketMainCopy: { flex: 1, minWidth: 0, gap: 8 },
  ticketUntil: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 34, letterSpacing: -0.8 },
  ticketTimeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  ticketTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF1CC",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ticketTimeText: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 14, fontVariant: ["tabular-nums"] },
  ticketLine: { flexShrink: 1, color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 15 },
  ticketRoute: {
    backgroundColor: "#F3F7FC",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  ticketRouteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ticketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: Colors.primary,
    marginHorizontal: 1,
  },
  ticketRouteLine: { width: 2, height: 10, backgroundColor: "#C6D2E1", marginLeft: 6, marginVertical: 2 },
  ticketRouteText: { flex: 1, color: Colors.text.dark, fontFamily: "Inter-Medium", fontSize: 14 },
  perforation: { height: 20, flexDirection: "row", alignItems: "center" },
  notch: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.background.main },
  notchLeft: { marginLeft: -10 },
  notchRight: { marginRight: -10 },
  dash: {
    flex: 1,
    marginHorizontal: 6,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D6E1EE",
  },
  ticketStub: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
  },
  ticketStubCopy: { flex: 1, minWidth: 0, gap: 2 },
  stubLabel: { color: Colors.text.light, fontFamily: "Inter-Medium", fontSize: 12 },
  stubValue: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 15 },
  stubLink: { color: Colors.primary, fontFamily: "Inter-Bold", fontSize: 15, textDecorationLine: "underline" },
  ticketCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.secondary,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  ticketCtaText: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 14 },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#E7EEF7",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toggleOptionSelected: {
    backgroundColor: Colors.white,
    shadowColor: Colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  toggleText: { color: Colors.text.light, fontFamily: "Inter-SemiBold", fontSize: 14 },
  toggleTextSelected: { color: Colors.primary },
  favorite: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteDark: { backgroundColor: "rgba(255,255,255,0.12)" },
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowTime: {
    width: 58,
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 19,
    fontVariant: ["tabular-nums"],
  },
  rowPast: { color: "#94A3B8" },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowUntil: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 14 },
  rowUntilSoon: { color: "#B45309" },
  rowPastLabel: { color: "#94A3B8", fontFamily: "Inter-Medium", fontSize: 13 },
  rowSubtitle: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13 },
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF4FB",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  plateText: { color: Colors.primary, fontFamily: "Inter-Bold", fontSize: 12 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#D6E1EE",
  },
  chipSelected: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  chipText: { color: Colors.text.dark, fontFamily: "Inter-Medium", fontSize: 14 },
  chipTextSelected: { color: Colors.navy, fontFamily: "Inter-Bold" },
  prompt: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5EDF7",
  },
  promptHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  promptCopy: { flex: 1, minWidth: 0, gap: 2 },
  promptText: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 14 },
  promptTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 16 },
  promptRow: { flexDirection: "row", gap: 8 },
  promptInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D6E1EE",
    backgroundColor: "#F8FAFD",
    paddingHorizontal: 14,
    color: Colors.text.dark,
    fontFamily: "Inter-Regular",
    fontSize: 15,
  },
  promptButton: {
    flexShrink: 0,
    minHeight: 46,
    minWidth: 96,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  promptButtonDisabled: { backgroundColor: "#9DB4CF" },
  promptButtonText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 15 },
  promptError: { color: Colors.error, fontFamily: "Inter-Regular", fontSize: 13 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 17 },
  link: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 32 },
  linkText: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 14 },
});
