import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen, ScreenHeader, SectionTitle, uiStyles } from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { getDisplayName } from "@/utils/operational";

export default function StudentHomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const name = getDisplayName(user?.name, user?.email).split(" ")[0];
  return <AppScreen><ScreenHeader title="UPS GO" subtitle="Servicios de transporte" /><ScrollView contentContainerStyle={uiStyles.scrollContent}><View style={styles.hero}><Text style={styles.greeting}>Hola, {name}</Text><Text style={styles.heroCopy}>Encuentra la salida que necesitas para hoy o consulta otra fecha.</Text><Pressable accessibilityRole="button" style={({ pressed }) => [styles.heroAction, pressed && uiStyles.cardPressed]} onPress={() => router.push("/(student)/(tabs)/campuses")}><View style={styles.heroActionIcon}><Ionicons name="map-outline" size={24} color={Colors.navy} /></View><View style={styles.heroActionCopy}><Text style={styles.heroActionTitle}>Consultar servicios</Text><Text style={styles.heroActionText}>Elige campus, línea y horario</Text></View><Ionicons name="chevron-forward" size={22} color={Colors.white} /></Pressable></View><SectionTitle>Cómo funciona</SectionTitle><View style={styles.steps}><Step icon="business-outline" title="1. Selecciona tu campus" text="Consulta las líneas disponibles." /><Step icon="time-outline" title="2. Revisa las salidas" text="Distingue ida, retorno y fecha." /><Step icon="bus-outline" title="3. Confirma el bus" text="Cada asignación muestra su estado real." /></View><View style={styles.notice}><Ionicons name="information-circle-outline" size={20} color={Colors.primary} /><Text style={styles.noticeText}>Una salida programada puede tener varios buses asignados. UPS GO los muestra por separado.</Text></View></ScrollView></AppScreen>;
}

function Step({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) { return <View style={styles.step}><View style={styles.stepIcon}><Ionicons name={icon} size={20} color={Colors.primary} /></View><View style={styles.stepCopy}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepText}>{text}</Text></View></View>; }

const styles = StyleSheet.create({
  hero: { backgroundColor: Colors.navy, padding: 20, borderRadius: 20, gap: 10 }, greeting: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 25 }, heroCopy: { color: "#D6E4F3", fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22 }, heroAction: { marginTop: 8, backgroundColor: Colors.primary, borderRadius: 16, minHeight: 76, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, heroActionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.secondary, alignItems: "center", justifyContent: "center" }, heroActionCopy: { flex: 1 }, heroActionTitle: { color: Colors.white, fontFamily: "Inter-SemiBold", fontSize: 16 }, heroActionText: { color: "#D6E4F3", fontFamily: "Inter-Regular", fontSize: 13, marginTop: 3 },
  steps: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, gap: 16, shadowColor: Colors.navy, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 }, step: { flexDirection: "row", gap: 12, alignItems: "center" }, stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background.alt, alignItems: "center", justifyContent: "center" }, stepCopy: { flex: 1 }, stepTitle: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 15 }, stepText: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13, marginTop: 3 }, notice: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: "#EAF1F8", borderRadius: 14, alignItems: "flex-start" }, noticeText: { flex: 1, color: Colors.primary, fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 19 },
});
