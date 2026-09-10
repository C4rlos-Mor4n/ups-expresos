import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Colors } from "@/constants/Colors";
import type { OperationalState } from "@/types/operational";
import { getOperationalStateMeta } from "@/utils/operational";

const appLogo = require("../../assets/images/images_upsgo/logo-ups-go-icon.png");

type IconName = ComponentProps<typeof Ionicons>["name"];

export function AppScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.screenBody}>{children}</View>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headerWrapper}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver"
              onPress={onBack}
              hitSlop={12}
              style={styles.iconButton}
            >
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </Pressable>
          ) : (
            <View style={styles.brandMark}>
              <Image
                source={appLogo}
                style={styles.brandLogo}
                resizeMode="contain"
              />
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={styles.headerSubtitle}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
      </View>

      {/* Dual organic brand wave at bottom */}
      <Svg
        pointerEvents="none"
        width="100%"
        height={32}
        viewBox="0 0 390 32"
        preserveAspectRatio="none"
        style={styles.headerWave}
      >
        {/* Layer 1: Secondary blue depth curve on the right */}
        <Path
          d="M 170 32 C 245 22, 320 12, 390 2 L 390 32 Z"
          fill="#1C62B3"
          opacity={0.92}
        />
        {/* Layer 2: Main canvas surface wave spanning 100% width */}
        <Path
          d="M 0 6 C 90 24, 215 28, 305 18 C 340 14, 368 6, 390 2 L 390 32 L 0 32 Z"
          fill={Colors.background.main}
        />
      </Svg>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = "blue",
  icon,
}: {
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
      style={({ pressed }) => [
        styles.button,
        styles[`button_${tone}`],
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={tone === "gold" ? Colors.navy : Colors.white}
        />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={19}
          color={
            tone === "gold"
              ? Colors.navy
              : tone === "outline"
                ? Colors.primary
                : Colors.white
          }
        />
      ) : null}
      <Text style={[styles.buttonText, styles[`buttonText_${tone}`]]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function StatusBadge({ state }: { state: OperationalState }) {
  const meta = getOperationalStateMeta(state);
  const palette =
    state === "SCHEDULED"
      ? Colors.state.scheduled
      : state === "ASSIGNED"
        ? Colors.state.assigned
        : state === "IN_PROGRESS"
          ? Colors.state.inProgress
          : Colors.state.completed;
  return (
    <View
      style={[styles.statusBadge, { backgroundColor: palette.background }]}
      accessibilityLabel={`Estado: ${meta.label}`}
    >
      <Ionicons name={meta.icon} size={15} color={palette.foreground} />
      <Text style={[styles.statusText, { color: palette.foreground }]}>
        {meta.label}
      </Text>
    </View>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function InlineState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Ionicons name={icon} size={26} color={Colors.primary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.skeletonCard}>
          <View style={styles.skeletonWide} />
          <View style={styles.skeletonShort} />
        </View>
      ))}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 110 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 110 },
  card: {
    backgroundColor: Colors.background.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  cardPressed: { opacity: 0.86 },
  muted: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  body: {
    color: Colors.text.dark,
    fontFamily: "Inter-Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: Colors.text.light,
    fontFamily: "Inter-SemiBold",
    fontSize: 12,
  },
  value: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.navy },
  screenBody: { flex: 1, backgroundColor: Colors.background.main },
  headerWrapper: {
    backgroundColor: Colors.navy,
    position: "relative",
  },
  header: {
    backgroundColor: Colors.navy,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.white,
    padding: 3,
    shadowColor: Colors.navy,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  brandLogo: { width: 38, height: 38, borderRadius: 19 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 21 },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.88)",
    fontFamily: "Inter-Regular",
    fontSize: 13,
  },
  headerWave: {
    marginBottom: -1,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  button_blue: { backgroundColor: Colors.button.primary },
  button_gold: { backgroundColor: Colors.secondary },
  button_outline: {
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.white,
  },
  buttonDisabled: { opacity: 0.56 },
  buttonPressed: { opacity: 0.84 },
  buttonText: { fontFamily: "Inter-SemiBold", fontSize: 15 },
  buttonText_blue: { color: Colors.white },
  buttonText_gold: { color: Colors.navy },
  buttonText_outline: { color: Colors.primary },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 5,
  },
  statusText: { fontFamily: "Inter-SemiBold", fontSize: 12 },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionTitle: {
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 18,
  },
  state: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 36 },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background.alt,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  stateTitle: {
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 18,
    textAlign: "center",
  },
  stateMessage: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  stateAction: { marginTop: 20, alignSelf: "stretch" },
  skeletonList: { gap: 12, padding: 20 },
  skeletonCard: {
    minHeight: 102,
    borderRadius: 16,
    backgroundColor: Colors.background.card,
    padding: 16,
    gap: 12,
  },
  skeletonWide: {
    height: 18,
    width: "72%",
    borderRadius: 9,
    backgroundColor: Colors.background.alt,
  },
  skeletonShort: {
    height: 14,
    width: "46%",
    borderRadius: 7,
    backgroundColor: Colors.background.alt,
  },
});
