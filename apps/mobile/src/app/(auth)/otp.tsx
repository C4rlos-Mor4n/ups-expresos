import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { PrimaryButton } from "@/components/operational-ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/error-message";

export default function OtpScreen() {
  const { email: rawEmail } = useLocalSearchParams<{ email?: string }>();
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const verifyCode = async () => {
    if (code.length !== 6) { setError("El código debe contener 6 dígitos."); return; }
    try {
      setLoading(true); setError(null);
      const response = await authService.verifyCode(email, code);
      await login(response.accessToken, response.refreshToken, response.user);
      router.replace("/");
    } catch (requestError) { setError(getErrorMessage(requestError)); } finally { setLoading(false); }
  };

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={Colors.white} /></Pressable><Text style={styles.headerTitle}>Verificación</Text></View><View style={styles.content}><View style={styles.icon}><Ionicons name="shield-checkmark-outline" size={36} color={Colors.primary} /></View><Text style={styles.title}>Confirma tu acceso</Text><Text style={styles.description}>Escribe el código de seis dígitos que enviamos a{`\n`}<Text style={styles.email}>{email || "tu correo institucional"}</Text>.</Text><TextInput accessibilityLabel="Código de verificación de seis dígitos" autoFocus keyboardType="number-pad" maxLength={6} textContentType="oneTimeCode" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, "")); if (error) setError(null); }} style={styles.codeInput} placeholder="000000" placeholderTextColor="#A7B2C2" onSubmitEditing={verifyCode} />{error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}<PrimaryButton label="Verificar e ingresar" loading={loading} onPress={verifyCode} icon="checkmark" /><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.change}><Text style={styles.changeText}>Usar otro correo</Text></Pressable></View></KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background.main }, keyboard: { flex: 1 }, header: { minHeight: 72, backgroundColor: Colors.navy, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 }, back: { width: 44, height: 44, justifyContent: "center", alignItems: "center", marginLeft: -10 }, headerTitle: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 18 }, content: { flex: 1, padding: 24, justifyContent: "center", alignItems: "stretch", gap: 18 }, icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.background.alt, justifyContent: "center", alignItems: "center", alignSelf: "center" }, title: { fontFamily: "Inter-Bold", color: Colors.text.dark, fontSize: 26, textAlign: "center" }, description: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: -8 }, email: { color: Colors.text.dark, fontFamily: "Inter-SemiBold" }, codeInput: { minHeight: 60, borderRadius: 14, borderWidth: 1, borderColor: Colors.primary, backgroundColor: Colors.white, color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 28, letterSpacing: 9, textAlign: "center", marginTop: 8 }, error: { padding: 12, borderRadius: 12, backgroundColor: "#FDE9E7" }, errorText: { color: Colors.error, fontFamily: "Inter-Regular", fontSize: 13, textAlign: "center" }, change: { minHeight: 44, alignItems: "center", justifyContent: "center" }, changeText: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 14 },
});
