import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen, PrimaryButton, ScreenHeader } from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";

export default function UnsupportedRoleScreen() { const { logout } = useAuth(); const router = useRouter(); return <AppScreen><ScreenHeader title="UPS GO" /><View style={styles.content}><Text style={styles.title}>Este perfil aún no tiene acceso móvil</Text><Text style={styles.text}>UPS GO móvil está habilitada para estudiantes y conductores. Usa el canal institucional correspondiente o inicia sesión con otro perfil.</Text><PrimaryButton label="Cerrar sesión" tone="outline" onPress={() => { void logout(); router.replace("/"); }} /></View></AppScreen>; }
const styles = StyleSheet.create({ content: { flex: 1, justifyContent: "center", padding: 24, gap: 14 }, title: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 25, lineHeight: 32, textAlign: "center" }, text: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 8 }, });
