import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Colors } from "../../constants/Colors";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/auth.service";

export default function OtpScreen() {
  const { email } = useLocalSearchParams();
  const router = useRouter();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const [seconds, setSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const { login } = useAuth();

  const inputs = useRef<Array<TextInput | null>>([]);
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setTimeout(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [seconds]);

  const verifyOtp = async (code: string) => {
    setLoading(true);
    setError(false);

    try {
      const response = await authService.verifyCode(
        String(email),
        code
      );

      await login(
        response.accessToken,
        response.refreshToken,
        response.user
      );

      router.replace("/(tabs)");
    } catch (error) {
      console.error(error);

      shake();

      setOtp(["", "", "", "", "", ""]);

      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

const handleResendCode = async () => {

  if (resending || !canResend) return;

  setResending(true);

  try {

    await authService.requestCode(String(email));

    setSeconds(60);
    setCanResend(false);

  } finally {

    setResending(false);

  }
};

  const handleChange = (text: string, index: number) => {
    const newChar = text.slice(-1);
    if (!/^\d?$/.test(newChar)) return;

    const newOtp = [...otp];
    newOtp[index] = newChar;
    setOtp(newOtp);

    if (newChar !== "" && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (newChar === "" && index > 0) {
      inputs.current[index - 1]?.focus();
    }

    const fullCode = newOtp.join("");

    if (fullCode.length === 6 && !loading) {
      verifyOtp(fullCode);
    }
  };

  const shake = () => {
    setError(true);

    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error
    );

    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 40,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 40,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setError(false);
    }, 800);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificación</Text>

      <Text style={styles.subtitle}>
        Ingresa el código enviado a tu correo
      </Text>

      <Text style={styles.email}>{email}</Text>

      {loading && (
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={{ marginTop: 20 }}
        />
      )}

      <Animated.View
        style={[
          styles.otpContainer,
          {
            transform: [
              {
                translateX: shakeAnimation,
              },
            ],
          },
        ]}
      >
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            editable={!loading}
            style={[
              styles.otpInput,
              error && {
                borderColor: Colors.error,
              },
            ]}
            keyboardType="number-pad"
            maxLength={2}
            value={digit}
            textAlign="center"
            onChangeText={(text) =>
              handleChange(text, index)
            }
            onKeyPress={({ nativeEvent }) => {
              if (
                nativeEvent.key === "Backspace" &&
                otp[index] === "" &&
                index > 0
              ) {
                inputs.current[index - 1]?.focus();
              }
            }}
          />
        ))}
      </Animated.View>

      <Text style={styles.resendQuestion}>
        ¿No recibiste el código?
      </Text>

      <Pressable
        disabled={!canResend || resending}
        onPress={handleResendCode}
      >
        <Text style={styles.resendText}>
          {canResend
            ? "Reenviar código"
            : `Reenviar código (00:${seconds
                .toString()
                .padStart(2, "0")})`}
        </Text>
      </Pressable>

      <View style={styles.bottomContainer}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>
            Volver
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    paddingTop: 90,
  },
  bottomContainer: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  backButton: {
    textAlign: "center",
  color: Colors.primary,
  fontSize: 16,
  fontFamily: "Inter-SemiBold",
},

  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
    color: Colors.text.dark,
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: Colors.text.light,
    lineHeight: 24,
    marginBottom: 12,
  },

  email: {
    fontSize: 17,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary,
  },

  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
    marginBottom: 35,
  },

  otpInput: {
    width: 48,
    height: 58,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontFamily: "Inter-Bold",
    color: Colors.text.dark,
    backgroundColor: "#FFFFFF",
  },

  resendQuestion: {
    textAlign: "center",
    fontSize: 15,
    fontFamily: "Inter-Regular",
    color: Colors.text.light,
    marginTop: 20,
  },

  resendText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.primary,
    textAlign: "center",
  },

  disabledText: {
    color: "#A0A0A0",
  },

  backButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.dark,
  },
});