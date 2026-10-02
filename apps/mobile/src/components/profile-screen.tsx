import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import {
  AppScreen,
  ScreenHeader,
  uiStyles,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/utils/operational";

type UpdateCheck = "idle" | "checking" | "latest" | "error";

export function ProfileScreen({
  roleLabel,
  children,
}: {
  roleLabel: string;
  /** Filas propias del rol (por ejemplo, campus principal del estudiante). */
  children?: ReactNode;
}) {
  const { user, logout, updateName } = useAuth();
  const displayName = getDisplayName(user?.name, user?.email);
  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "UG";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck>("idle");

  const saveName = async () => {
    if (draft.trim().length < 2 || saving) return;
    try {
      setSaving(true);
      setNameError(null);
      await updateName(draft.trim());
      setEditing(false);
    } catch {
      setNameError("No pudimos guardar tu nombre. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const checkForUpdate = async () => {
    if (!Updates.isEnabled) {
      setUpdateCheck("latest");
      return;
    }
    try {
      setUpdateCheck("checking");
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setUpdateCheck("latest");
        return;
      }
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setUpdateCheck("error");
    }
  };

  const requestLogout = () =>
    Alert.alert(
      "Cerrar sesión",
      "Tendrás que volver a verificar tu correo para ingresar.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar sesión",
          style: "destructive",
          onPress: () => {
            void logout();
          },
        },
      ],
    );

  const appVersion = Constants.expoConfig?.version ?? "—";
  const updateDate = Updates.createdAt
    ? Updates.createdAt.toLocaleDateString("es-EC", { day: "numeric", month: "short" })
    : null;

  return (
    <AppScreen>
      <ScreenHeader title="Perfil" subtitle={roleLabel} />
      <ScrollView
        contentContainerStyle={uiStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>

          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Tu nombre"
                placeholderTextColor="#94A3B8"
                maxLength={60}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                style={styles.editInput}
                accessibilityLabel="Tu nombre"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar nombre"
                disabled={draft.trim().length < 2 || saving}
                onPress={() => void saveName()}
                style={[
                  styles.editSave,
                  (draft.trim().length < 2 || saving) && styles.editSaveDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Ionicons name="checkmark" size={22} color={Colors.white} />
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Editar tu nombre"
              onPress={() => {
                setDraft(user?.name ?? "");
                setEditing(true);
              }}
              style={styles.nameRow}
              hitSlop={6}
            >
              <Text style={styles.name} numberOfLines={2}>
                {user?.name?.trim() ? displayName : "Agrega tu nombre"}
              </Text>
              <Ionicons name="pencil" size={16} color={Colors.primary} />
            </Pressable>
          )}
          {nameError ? <Text style={styles.error}>{nameError}</Text> : null}

          <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
            {user?.email ?? ""}
          </Text>
          <View style={styles.role}>
            <Ionicons name="shield-checkmark-outline" size={15} color={Colors.primary} />
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        {children}

        <View style={uiStyles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={21} color={Colors.primary} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Acerca de UPS GO</Text>
              <Text style={styles.infoText}>
                Horarios programados por la operación de transporte de la universidad.
                Pronto podrás ver en el mapa dónde va tu bus.
              </Text>
            </View>
          </View>
          <View style={styles.separator} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar actualizaciones"
            onPress={() => void checkForUpdate()}
            disabled={updateCheck === "checking"}
            style={styles.updateRow}
          >
            <Ionicons name="refresh" size={19} color={Colors.primary} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Buscar actualizaciones</Text>
              <Text style={styles.infoText}>
                {updateCheck === "checking"
                  ? "Buscando…"
                  : updateCheck === "latest"
                    ? "Ya tienes la versión más reciente."
                    : updateCheck === "error"
                      ? "No pudimos comprobarlo. Revisa tu conexión."
                      : `Versión ${appVersion}${updateDate ? ` · actualizada el ${updateDate}` : ""}`}
              </Text>
            </View>
            {updateCheck === "checking" ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : null}
          </Pressable>
        </View>

        <View style={uiStyles.card}>
          <LinkRow icon="heart-outline" title="Agradecimientos" href={{ pathname: "/credits" }} />
          <View style={styles.separator} />
          <LinkRow
            icon="shield-checkmark-outline"
            title="Política de privacidad"
            href={{ pathname: "/legal", params: { doc: "privacy" } }}
          />
          <View style={styles.separator} />
          <LinkRow
            icon="document-text-outline"
            title="Términos de uso"
            href={{ pathname: "/legal", params: { doc: "terms" } }}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          style={({ pressed }) => [styles.logout, pressed && uiStyles.cardPressed]}
          onPress={requestLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

function LinkRow({
  icon,
  title,
  href,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  href: Href;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={title}
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.updateRow, pressed && uiStyles.cardPressed]}
    >
      <Ionicons name={icon} size={19} color={Colors.primary} />
      <Text style={[styles.infoTitle, styles.legalTitle]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </Pressable>
  );
}

/** Fila de ajuste reutilizable dentro de una tarjeta del perfil. */
export function ProfileRow({
  icon,
  title,
  value,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [uiStyles.card, styles.rowCard, pressed && uiStyles.cardPressed]}
    >
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoText} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 7,
    shadowColor: Colors.navy,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  initials: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 25 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" },
  name: {
    flexShrink: 1,
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  editRow: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  editInput: {
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
    fontSize: 16,
  },
  editSave: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveDisabled: { backgroundColor: "#9DB4CF" },
  error: { color: Colors.error, fontFamily: "Inter-Regular", fontSize: 13 },
  email: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  role: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.background.alt,
    marginTop: 5,
    alignItems: "center",
  },
  roleText: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 12 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoCopy: { flex: 1, minWidth: 0, gap: 4 },
  infoTitle: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 15 },
  infoText: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 14,
  },
  updateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  legalTitle: { flex: 1 },
  logout: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: "#FDE9E7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { color: Colors.error, fontFamily: "Inter-SemiBold", fontSize: 15 },
});
