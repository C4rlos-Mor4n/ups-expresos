import { useState } from "react";
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { PrimaryButton } from "@/components/operational-ui";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/error-message";

const upsLogo = require("../../../assets/images/images_upsgo/logo-ups.png");

export default function OtpScreen() {
  const { email: rawEmail } = useLocalSearchParams<{ email?: string }>();
  const email = typeof rawEmail === "string" ? rawEmail : "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { login } = useAuth();

  const verifyCode = async () => {
    if (code.length !== 6) {
      setError("El código debe contener 6 dígitos.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await authService.verifyCode(email, code);
      await login(response.accessToken, response.refreshToken, response.user);
      router.replace("/");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../../../assets/images/images_upsgo/fondo.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.topRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Volver"
                onPress={() => router.back()}
                style={styles.back}
              >
                <Ionicons name="arrow-back" size={22} color={Colors.white} />
              </Pressable>
              <Text style={styles.brandText}>UPS GO</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.logoFrame}>
                <Image
                  source={upsLogo}
                  style={styles.upsLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.securityChip}>
                <Ionicons
                  name="shield-checkmark"
                  size={15}
                  color={Colors.primary}
                />
                <Text style={styles.securityChipText}>ACCESO SEGURO</Text>
              </View>
              <Text style={styles.title}>Verifica tu identidad</Text>
              <Text style={styles.description}>
                Ingresa el código de seis dígitos que enviamos a tu correo
                institucional.
              </Text>
              <View style={styles.emailPill}>
                <Ionicons
                  name="mail-outline"
                  size={17}
                  color={Colors.primary}
                />
                <Text selectable style={styles.email} numberOfLines={1}>
                  {email || "tu correo institucional"}
                </Text>
              </View>
              <View style={styles.codeSection}>
                <View style={styles.codeLabelRow}>
                  <Text style={styles.codeLabel}>Código de verificación</Text>
                  <Text style={styles.codeCount}>{code.length}/6</Text>
                </View>
                <TextInput
                  accessibilityLabel="Código de verificación de seis dígitos"
                  autoFocus
                  autoComplete="one-time-code"
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  value={code}
                  editable={!loading}
                  onChangeText={(value) => {
                    setCode(value.replace(/\D/g, ""));
                    if (error) setError(null);
                  }}
                  style={styles.codeInput}
                  placeholder="000000"
                  placeholderTextColor="#A7B2C2"
                  onSubmitEditing={verifyCode}
                  selectionColor={Colors.secondary}
                />
                <View style={styles.dots} accessibilityElementsHidden>
                  {Array.from({ length: 6 }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        index < code.length && styles.dotFilled,
                      ]}
                    />
                  ))}
                </View>
              </View>
              {error ? (
                <View style={styles.error}>
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={Colors.error}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <PrimaryButton
                label="Verificar e ingresar"
                loading={loading}
                disabled={code.length !== 6}
                onPress={verifyCode}
                icon="checkmark"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.change}
              >
                <Text style={styles.changeText}>Usar otro correo</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 34, 78, 0.70)",
  },
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  topRow: { minHeight: 52, alignItems: "center", flexDirection: "row", gap: 4 },
  back: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -10,
  },
  brandText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 18 },
  card: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 22,
    gap: 16,
    marginVertical: 18,
    boxShadow: "0 14px 30px rgba(0, 23, 56, 0.30)",
  },
  logoFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background.alt,
    alignSelf: "center",
  },
  upsLogo: { width: 58, height: 58 },
  securityChip: {
    alignSelf: "center",
    backgroundColor: "#EAF1F8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  securityChipText: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
    fontSize: 11,
    letterSpacing: 0.7,
  },
  title: {
    fontFamily: "Inter-Bold",
    color: Colors.text.dark,
    fontSize: 25,
    lineHeight: 31,
    textAlign: "center",
  },
  description: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: -7,
  },
  emailPill: {
    minHeight: 42,
    backgroundColor: Colors.background.subtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  email: {
    flex: 1,
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  codeSection: { gap: 8 },
  codeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeLabel: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  codeCount: {
    color: Colors.text.light,
    fontFamily: "Inter-Medium",
    fontSize: 12,
  },
  codeInput: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.background.subtle,
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 27,
    letterSpacing: 10,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D9E2EE" },
  dotFilled: { backgroundColor: Colors.secondary },
  error: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FDE9E7",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontFamily: "Inter-Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  change: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  changeText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
});
