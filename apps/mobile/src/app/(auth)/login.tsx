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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import { authService } from "@/services/auth.service";
import { getErrorMessage } from "@/utils/error-message";
import { PrimaryButton } from "@/components/operational-ui";

const upsLogo = require("../../../assets/images/images_upsgo/logo-ups-go-icon.png");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const requestCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Escribe tu correo institucional para continuar.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await authService.requestCode(normalizedEmail);
      router.push({
        pathname: "/(auth)/otp",
        params: { email: normalizedEmail },
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboard}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {router.canGoBack() ? (
              <View style={styles.topRow}>
                <Pressable
                  onPress={handleBack}
                  accessibilityLabel="Volver"
                  accessibilityRole="button"
                  style={styles.back}
                >
                  <Ionicons name="arrow-back" size={22} color={Colors.white} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.topRowSpacer} />
            )}

            <View style={styles.identity}>
              <View style={styles.logoFrame}>
                <Image
                  source={upsLogo}
                  style={styles.upsLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.university}>
                Universidad Politécnica Salesiana
              </Text>
              <Text style={styles.product}>UPS GO</Text>
              <Text style={styles.productSubtitle}>
                Servicios de transporte
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.formHeading}>
                <View style={styles.headingIcon}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.headingCopy}>
                  <Text style={styles.title}>Ingresa con tu correo</Text>
                  <Text style={styles.description}>
                    Te enviaremos un código seguro para validar tu acceso.
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo institucional</Text>
                <View style={styles.inputShell}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={Colors.primary}
                  />
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    accessibilityLabel="Correo institucional"
                    placeholder="nombre@est.ups.edu.ec"
                    placeholderTextColor="#7A8799"
                    style={styles.input}
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      if (error) setError(null);
                    }}
                    onSubmitEditing={requestCode}
                    returnKeyType="send"
                  />
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
                label="Enviar código"
                loading={loading}
                disabled={!email.trim()}
                onPress={requestCode}
                tone="gold"
                icon="arrow-forward"
              />

              <View style={styles.helpRow}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={15}
                  color={Colors.text.light}
                />
                <Text style={styles.help}>
                  Acceso exclusivo para la comunidad UPS
                </Text>
              </View>
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
    backgroundColor: "rgba(0, 34, 78, 0.68)",
  },
  safe: { flex: 1 },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: "center",
  },
  topRow: { minHeight: 44, justifyContent: "center" },
  topRowSpacer: { height: 12 },
  back: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -10,
  },
  identity: {
    alignItems: "center",
    paddingVertical: 14,
    gap: 2,
  },
  logoFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.96)",
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
  },
  upsLogo: { width: 64, height: 64, borderRadius: 32 },
  university: {
    color: "#D9E8F8",
    fontFamily: "Inter-Medium",
    fontSize: 12,
    marginTop: 8,
    textAlign: "center",
  },
  product: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 26,
    letterSpacing: 0.6,
  },
  productSubtitle: {
    color: "#D9E8F8",
    fontFamily: "Inter-Regular",
    fontSize: 13,
  },
  form: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    marginTop: 8,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  formHeading: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  headingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.background.alt,
    alignItems: "center",
    justifyContent: "center",
  },
  headingCopy: { flex: 1, gap: 4 },
  title: {
    color: Colors.text.dark,
    fontFamily: "Inter-Bold",
    fontSize: 20,
    lineHeight: 25,
  },
  description: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  inputGroup: { gap: 8 },
  label: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 13,
  },
  inputShell: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.background.subtle,
  },
  input: {
    flex: 1,
    color: Colors.text.dark,
    fontFamily: "Inter-Regular",
    fontSize: 15,
  },
  error: {
    backgroundColor: "#FDE9E7",
    borderRadius: 12,
    padding: 12,
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
  helpRow: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  help: {
    flexShrink: 1,
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
