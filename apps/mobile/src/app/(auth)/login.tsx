import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";

import { useRouter } from "expo-router";
import { useState } from "react";
import { Colors } from "../../constants/Colors";
import { authService } from "../../services/auth.service";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

const handleRequestCode = async () => {
  if (!email) {
    Alert.alert(
      "Error",
      "Por favor ingresa tu correo institucional"
    );
    return;
  }

  setIsLoading(true);

  try {
    await authService.requestCode(email);

    router.push({
      pathname: "/(auth)/otp",
      params: {
        email,
      },
    });

  } catch (error: any) {

  if (error.response?.status === 429) {
    alert("Debes esperar unos segundos antes de solicitar otro código.");
    return;
  }

  alert(
    error.response?.data?.message ??
    "No se pudo reenviar el código."
  );

  } finally {

    setIsLoading(false);

  }
};

  return (
  <KeyboardAvoidingView
    style={styles.container}
    behavior={Platform.OS === "ios" ? "padding" : "height"}
  >
    <View style={styles.content}>

      <Text style={styles.title}>
        Iniciar sesión
      </Text>

      <Text style={styles.subtitle}>
        Accede con tu correo institucional UPS.
      </Text>

      <Text style={styles.label}>
        Correo institucional
      </Text>

      <View style={styles.inputContainer}>
        <Image
          source={require("../../../assets/images/images_busapp/correo.png")}
          style={styles.inputIcon}
    resizeMode="contain"
  />

  <TextInput
    style={styles.input}
    placeholder="usuario@est.ups.edu.ec"
    placeholderTextColor={Colors.text.light}
    value={email}
    onChangeText={setEmail}
    autoCapitalize="none"
    keyboardType="email-address"
    editable={!isLoading}
  />
</View>

<Pressable
  style={[
    styles.loginButton,
    isLoading && styles.loginButtonDisabled,
  ]}
  onPress={handleRequestCode}
  disabled={isLoading}
>
  {isLoading ? (
    <ActivityIndicator color="#FFFFFF" />
  ) : (
    <Text style={styles.loginButtonText}>
      Enviar código
    </Text>
  )}
</Pressable>

    </View>
  </KeyboardAvoidingView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
    color: Colors.text.dark,
    marginBottom: 10,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    paddingHorizontal: 28,
    paddingTop: 100,
  },
  inputContainer: {
  flexDirection: "row",
  alignItems: "center",
  height: 55,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
  paddingHorizontal: 16,
  marginBottom: 24,
  backgroundColor: "#FFFFFF",
},
inputIcon: {
  width: 18,
  height: 18,
  marginRight: 12,
  tintColor: Colors.text.light,
},
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter-Regular",
    color: Colors.text.light,
    marginBottom: 40,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.dark,
    marginBottom: 10,
  },
input: {
  flex: 1,
  fontSize: 16,
  fontFamily: "Inter-Regular",
  color: Colors.text.dark,
},
  loginButton: {
    height: 54,
    borderRadius: 12,
    backgroundColor: Colors.button.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  loginButtonDisabled: {
    opacity: 0.5,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter-Bold",
    fontSize: 16,
  },
});