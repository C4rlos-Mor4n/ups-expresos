import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import type { OperationalState } from "@/types/operational";
import { getOperationalStateMeta } from "@/utils/operational";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function AppScreen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>{children}</SafeAreaView>;
}

export function ScreenHeader({ title, subtitle, back, onBack, right }: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={onBack} hitSlop={10} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
        ) : <View style={styles.brandMark}><Ionicons name="navigate" size={18} color={Colors.secondary} /></View>}
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, tone = "blue", icon }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "blue" | "gold" | "outline";
  icon?: IconName;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`button_${tone}`], isDisabled && styles.buttonDisabled, pressed && !isDisabled && styles.buttonPressed]}
    >
      {loading ? <ActivityIndicator color={tone === "gold" ? Colors.navy : Colors.white} /> : icon ? <Ionicons name={icon} size={19} color={tone === "gold" ? Colors.navy : tone === "outline" ? Colors.primary : Colors.white} /> : null}
      <Text style={[styles.buttonText, styles[`buttonText_${tone}`]]}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ state }: { state: OperationalState }) {
  const meta = getOperationalStateMeta(state);
  const palette = state === "SCHEDULED" ? Colors.state.scheduled : state === "ASSIGNED" ? Colors.state.assigned : state === "IN_PROGRESS" ? Colors.state.inProgress : Colors.state.completed;
  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.background }]} accessibilityLabel={`Estado: ${meta.label}`}>
      <Ionicons name={meta.icon} size={15} color={palette.foreground} />
      <Text style={[styles.statusText, { color: palette.foreground }]}>{meta.label}</Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{children}</Text>{action}</View>;
}

export function InlineState({ icon, title, message, action }: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return <View style={styles.state}><View style={styles.stateIcon}><Ionicons name={icon} size={26} color={Colors.primary} /></View><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateMessage}>{message}</Text>{action ? <View style={styles.stateAction}>{action}</View> : null}</View>;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <View style={styles.skeletonList}>{Array.from({ length: rows }, (_, index) => <View key={index} style={styles.skeletonCard}><View style={styles.skeletonWide} /><View style={styles.skeletonShort} /></View>)}</View>;
}

export const uiStyles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 36 },
  scrollContent: { padding: 20, gap: 16, paddingBottom: 36 },
  card: { backgroundColor: Colors.background.card, borderRadius: 16, padding: 16, shadowColor: Colors.navy, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  cardPressed: { opacity: 0.86 },
  muted: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 20 },
  body: { color: Colors.text.dark, fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22 },
  label: { color: Colors.text.light, fontFamily: "Inter-SemiBold", fontSize: 12 },
  value: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background.main },
  header: { backgroundColor: Colors.navy, paddingHorizontal: 20, paddingVertical: 16 },
  headerRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 12 },
  brandMark: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  iconButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center", marginLeft: -10 },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 20 },
  headerSubtitle: { color: "#C9DBEF", fontFamily: "Inter-Regular", fontSize: 13 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  button_blue: { backgroundColor: Colors.button.primary },
  button_gold: { backgroundColor: Colors.secondary },
  button_outline: { borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.white },
  buttonDisabled: { opacity: 0.56 },
  buttonPressed: { opacity: 0.84 },
  buttonText: { fontFamily: "Inter-SemiBold", fontSize: 15 },
  buttonText_blue: { color: Colors.white },
  buttonText_gold: { color: Colors.navy },
  buttonText_outline: { color: Colors.primary },
  statusBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 5 },
  statusText: { fontFamily: "Inter-SemiBold", fontSize: 12 },
  sectionTitleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  sectionTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 18 },
  state: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 36 },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.background.alt, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  stateTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 18, textAlign: "center" },
  stateMessage: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 8 },
  stateAction: { marginTop: 20, alignSelf: "stretch" },
  skeletonList: { gap: 12, padding: 20 },
  skeletonCard: { minHeight: 102, borderRadius: 16, backgroundColor: Colors.background.card, padding: 16, gap: 12 },
  skeletonWide: { height: 18, width: "72%", borderRadius: 9, backgroundColor: Colors.background.alt },
  skeletonShort: { height: 14, width: "46%", borderRadius: 7, backgroundColor: Colors.background.alt },
});
