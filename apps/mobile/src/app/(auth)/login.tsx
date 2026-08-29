import { useState } from "react";
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/error-message";
import { PrimaryButton } from "@/components/operational-ui";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setError("Escribe tu correo institucional para continuar."); return; }
    try {
      setLoading(true); setError(null);
      await authService.requestCode(normalizedEmail);
      router.push({ pathname: "/(auth)/otp", params: { email: normalizedEmail } });
    } catch (requestError) { setError(getErrorMessage(requestError)); } finally { setLoading(false); }
  };

  return <ImageBackground source={require("../../../assets/images/images_busapp/fondo.png")} style={styles.background} resizeMode="cover"><View style={styles.overlay} /><SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}><View style={styles.top}><Pressable onPress={() => router.back()} accessibilityLabel="Volver" accessibilityRole="button" style={styles.back}><Ionicons name="arrow-back" size={22} color={Colors.white} /></Pressable><View style={styles.brand}><Ionicons name="navigate" size={20} color={Colors.secondary} /><Text style={styles.brandText}>UPS GO</Text></View></View><View style={styles.form}><Text style={styles.title}>Ingresa con tu correo institucional</Text><Text style={styles.description}>Te enviaremos un código de verificación para acceder de forma segura.</Text><View style={styles.inputGroup}><Text style={styles.label}>Correo institucional</Text><View style={styles.inputShell}><Ionicons name="mail-outline" size={20} color={Colors.primary} /><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" accessibilityLabel="Correo institucional" placeholder="nombre@est.ups.edu.ec" placeholderTextColor="#7A8799" style={styles.input} value={email} onChangeText={(value) => { setEmail(value); if (error) setError(null); }} onSubmitEditing={requestCode} returnKeyType="send" /></View></View>{error ? <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#FFE0DE" /><Text style={styles.errorText}>{error}</Text></View> : null}<PrimaryButton label="Enviar código" icon="arrow-forward" loading={loading} onPress={requestCode} tone="gold" /><Text style={styles.help}>Solo usamos tu correo para validar tu acceso a UPS GO.</Text></View></KeyboardAvoidingView></SafeAreaView></ImageBackground>;
}

const styles = StyleSheet.create({
  background: { flex: 1 }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 30, 75, 0.64)" }, safe: { flex: 1 }, keyboard: { flex: 1, paddingHorizontal: 20, justifyContent: "space-between" },
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -10 }, brand: { flexDirection: "row", gap: 8, alignItems: "center" }, brandText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 18 },
  form: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 22, gap: 18, shadowColor: Colors.navy, shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
  title: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 24, lineHeight: 31 }, description: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22, marginTop: -8 }, inputGroup: { gap: 8 }, label: { color: Colors.text.dark, fontFamily: "Inter-SemiBold", fontSize: 13 }, inputShell: { minHeight: 52, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.background.subtle }, input: { flex: 1, color: Colors.text.dark, fontFamily: "Inter-Regular", fontSize: 15 },
  error: { backgroundColor: "#8B1D18", borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" }, errorText: { flex: 1, color: Colors.white, fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 19 }, help: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 12, lineHeight: 18, textAlign: "center" },
});
