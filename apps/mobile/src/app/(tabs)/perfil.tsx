import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";

const APP_VERSION = "1.0.1";

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [showTerms, setShowTerms] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const styles = makeStyles(colors);

  // Nombre derivado del correo si name no está disponible
  const displayName = user?.name
    ? user.name
    : user?.email
      ? user.email.split("@")[0].split(".").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : "Estudiante";

  // Iniciales derivadas del displayName
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Mapeo de rol a español
  const roleMap: Record<string, string> = {
    STUDENT: "Estudiante",
    ADMIN: "Administrador",
    SUPER_ADMIN: "Super Administrador",
    DRIVER: "Conductor",
  };
  const roleLabel = user?.role ? roleMap[user.role] ?? user.role : "Estudiante";

  return (
    <View style={styles.container}>
      {/* Fondo azul detrás de la cabecera */}
      <View style={styles.headerBackground} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Título de Cabecera */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Mi perfil</Text>
        </View>

        {/* ── Tarjeta principal solapada ───────────────────────────── */}
        <View style={styles.card}>

          {/* Avatar + datos del usuario */}
          <View style={styles.profileBlock}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.userName}>
              {displayName}
            </Text>
            <Text style={styles.userEmail}>
              {user?.email || ""}
            </Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>

          {/* ── Separador ──────────────────────────────────────────── */}
          <View style={styles.divider} />

          {/* Espaciador para empujar el bloque inferior al fondo */}
          <View style={{ flex: 1 }} />

          {/* ── Sección Términos y Versión centrados ─────────────── */}
          <View style={styles.infoSection}>
            {/* Términos y Condiciones como link centrado */}
            <Pressable
              style={({ pressed }) => [styles.termsLink, pressed && styles.termsLinkPressed]}
              onPress={() => setShowTerms(true)}
            >
              <Text style={styles.termsLinkText}>Términos y Condiciones</Text>
            </Pressable>

            {/* Versión de la App centrada */}
            <Text style={styles.versionText}>v{APP_VERSION}</Text>
          </View>

          {/* ── Botón cerrar sesión al fondo ──────────────────────── */}
          <View style={styles.logoutContainer}>
            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && styles.logoutBtnPressed,
              ]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>

      {/* ── Modal Términos y Condiciones ─────────────────────────── */}
      <Modal
        visible={showTerms}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Términos y Condiciones</Text>
              <Pressable onPress={() => setShowTerms(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>1. Uso de la aplicación</Text>
              <Text style={styles.modalText}>
                UPS Expresos es una plataforma desarrollada exclusivamente para uso de la comunidad universitaria de la
                Universidad Politécnica Salesiana (UPS). El acceso está permitido a estudiantes, docentes y personal
                autorizado con credenciales institucionales válidas.
              </Text>

              <Text style={styles.modalSectionTitle}>2. Datos personales</Text>
              <Text style={styles.modalText}>
                La aplicación recopila únicamente los datos necesarios para ofrecer el servicio de transporte:
                nombre de usuario, correo institucional y preferencias de rutas. Los datos no serán compartidos
                con terceros sin autorización expresa del titular.
              </Text>

              <Text style={styles.modalSectionTitle}>3. Responsabilidad del servicio</Text>
              <Text style={styles.modalText}>
                La universidad no garantiza la exactitud en tiempo real de los horarios mostrados,
                ya que estos pueden verse afectados por condiciones de tráfico, clima u otros factores externos.
                Esta información es de carácter referencial.
              </Text>

              <Text style={styles.modalSectionTitle}>4. Modificaciones</Text>
              <Text style={styles.modalText}>
                La UPS se reserva el derecho de modificar estos términos en cualquier momento.
                Los cambios serán notificados a través de la plataforma y el uso continuado de la
                aplicación implica la aceptación de los nuevos términos.
              </Text>

              <Text style={styles.modalSectionTitle}>5. Contacto</Text>
              <Text style={styles.modalText}>
                Para consultas o reportes relacionados con el servicio de transporte, contacta al
                Departamento de Bienestar Estudiantil de la UPS.
              </Text>

              <Text style={styles.modalVersion}>UPS Expresos v{APP_VERSION} · Universidad Politécnica Salesiana</Text>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setShowTerms(false)}
            >
              <Text style={styles.modalCloseBtnText}>Entendido</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
type ThemeColors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: ThemeColors) {
  const statusBarHeight = Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 40;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.main,
    },
    headerBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: statusBarHeight + 100,
      backgroundColor: "#0056B8",
    },
    topBar: {
      paddingTop: statusBarHeight,
      paddingBottom: 25,
      paddingHorizontal: 20,
    },
    topBarTitle: {
      color: "#FFFFFF",
      fontSize: 24,
      fontFamily: "Inter-Bold",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },

    // ── Tarjeta blanca ──────────────────────────────────────────────
    card: {
      flex: 1,
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
      paddingTop: 10,
    },

    profileBlock: {
      alignItems: "center",
      paddingTop: 30,
      paddingBottom: 24,
      paddingHorizontal: 20,
    },
    avatarCircle: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: "#0056B8",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      shadowColor: "#0056B8",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    avatarText: {
      fontSize: 34,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
      letterSpacing: 1,
    },
    userName: {
      fontSize: 22,
      fontFamily: "Inter-Bold",
      color: colors.text.dark,
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      marginBottom: 12,
    },
    roleBadge: {
      backgroundColor: "#EBF2FF",
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 5,
    },
    roleBadgeText: {
      fontSize: 13,
      fontFamily: "Inter-SemiBold",
      color: "#0056B8",
    },
    divider: {
      height: 1,
      backgroundColor: "#F1F5F9",
      marginHorizontal: 0,
    },

    // ── Sección Info (Términos + Versión) ─────────────────────────
    infoSection: {
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 20,
    },
    termsLink: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    termsLinkPressed: {
      backgroundColor: "#EBF2FF",
    },
    termsLinkText: {
      fontSize: 15,
      fontFamily: "Inter-SemiBold",
      color: "#0056B8",
      textDecorationLine: "none",
    },
    versionText: {
      fontSize: 13,
      fontFamily: "Inter-Regular",
      color: colors.text.light,
      marginTop: 4,
    },

    logoutContainer: {
      paddingHorizontal: 20,
      paddingBottom: 44,
      paddingTop: 32,
    },
    logoutBtn: {
      flexDirection: "row",
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: 'transparent',
    },
    logoutBtnPressed: {
      backgroundColor: colors.error + '1A',
    },
    logoutText: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: colors.error,
    },

    // ── Modal Términos ─────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      backgroundColor: "#FFFFFF",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: "85%",
      paddingBottom: Platform.OS === "ios" ? 34 : 20,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: "#F1F5F9",
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: "Inter-Bold",
      color: "#1E293B",
    },
    modalBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    modalSectionTitle: {
      fontSize: 14,
      fontFamily: "Inter-Bold",
      color: "#0056B8",
      marginTop: 16,
      marginBottom: 6,
    },
    modalText: {
      fontSize: 14,
      fontFamily: "Inter-Regular",
      color: "#475569",
      lineHeight: 22,
    },
    modalVersion: {
      fontSize: 12,
      fontFamily: "Inter-Regular",
      color: "#94A3B8",
      textAlign: "center",
      marginTop: 28,
      marginBottom: 28,
    },
    modalCloseBtn: {
      margin: 20,
      marginTop: 12,
      backgroundColor: "#0056B8",
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalCloseBtnText: {
      fontSize: 16,
      fontFamily: "Inter-Bold",
      color: "#FFFFFF",
    },
  });
}
