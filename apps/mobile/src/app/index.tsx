import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

export default function WelcomeScreen() {
  const router = useRouter();
  return <ImageBackground source={require("../../assets/images/images_upsgo/fondo.png")} style={styles.background} resizeMode="cover"><View style={styles.overlay} /><SafeAreaView style={styles.container}><View style={styles.brand}><Image source={require("../../assets/images/images_upsgo/logo-ups-go-icon.png")} style={styles.mark} /><Text style={styles.brandText}>UPS GO</Text></View><View style={styles.content}><Text style={styles.title}>El transporte universitario, claro y a tiempo.</Text><Text style={styles.subtitle}>Consulta tu servicio programado o gestiona tu jornada desde un solo lugar.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Ingresar a UPS GO" style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={() => router.push("/(auth)/login")}><Text style={styles.buttonText}>Ingresar a UPS GO</Text><Ionicons name="arrow-forward" size={20} color={Colors.navy} /></Pressable></SafeAreaView></ImageBackground>;
}

const styles = StyleSheet.create({
  background: { flex: 1 }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 33, 82, 0.42)" }, container: { flex: 1, paddingHorizontal: 24, paddingBottom: 28 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8 }, mark: { width: 48, height: 48, borderRadius: 24 }, brandText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 20, letterSpacing: 0.4 },
  content: { flex: 1, justifyContent: "center" }, title: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 32, lineHeight: 40 }, subtitle: { color: "#E0EBF8", fontFamily: "Inter-Regular", fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 320 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: Colors.secondary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }, buttonPressed: { opacity: 0.85 }, buttonText: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 16 },
});
