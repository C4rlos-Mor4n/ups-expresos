import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { mobileService } from "../../services/mobile.service";
import { tripFeedbackService } from "../../services/trip-feedback.service";
import ErrorRetry from "../../components/ErrorRetry";
import { getErrorMessage } from "../../utils/error-message";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function FeedbackScreen() {
  const { routeId, driverId } = useLocalSearchParams<{ routeId: string; driverId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [routeName, setRouteName] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Carga el nombre de la ruta para contexto (requiere sesión; si falla, no bloquea el envío).
  const loadRoute = useCallback(async () => {
    setLoadingRoute(true);
    try {
      const detail = await mobileService.getRouteDetail(routeId);
      setRouteName(detail.route.name);
    } catch {
      setRouteName(null);
    } finally {
      setLoadingRoute(false);
    }
  }, [routeId]);

  useEffect(() => {
    if (routeId) {
      loadRoute();
    }
  }, [routeId, loadRoute]);

  const canSubmit = rating >= 1 && rating <= 5 && !submitting && !submitted;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await tripFeedbackService.submit({
        routeId,
        driverId: driverId && driverId.length > 0 ? driverId : undefined,
        rating,
        comment: comment.trim().length > 0 ? comment.trim() : undefined,
      });
      setSubmitted(true);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.containerCentered}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.successTitle}>¡Gracias por tu calificación!</Text>
        <Text style={styles.successSubtitle}>Tu opinión ayuda a mejorar el servicio.</Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Calificar viaje</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Ruta</Text>
          <Text style={styles.routeName}>
            {loadingRoute ? "Cargando..." : routeName ?? "Ruta"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Tu calificación</Text>
          <View style={styles.ratingRow}>
            {RATING_OPTIONS.map((value) => (
              <Pressable
                key={value}
                style={styles.starBtn}
                onPress={() => setRating(value)}
                accessibilityRole="button"
                accessibilityLabel={`${value} estrellas`}
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={36}
                  color={value <= rating ? "#F2A900" : colors.border}
                />
              </Pressable>
            ))}
          </View>
          {rating === 0 ? (
            <Text style={styles.ratingHint}>Selecciona de 1 a 5 estrellas</Text>
          ) : (
            <Text style={styles.ratingValue}>{rating} de 5</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Comentario (opcional)</Text>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Cuéntanos sobre tu viaje..."
            placeholderTextColor={colors.text.light}
            multiline
            maxLength={500}
          />
        </View>

        {error ? (
          <ErrorRetry title="No se pudo enviar" message={error} onRetry={handleSubmit} retrying={submitting} />
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.button, (pressed || !canSubmit) && styles.buttonPressed]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Enviar calificación</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type Colors = ReturnType<typeof useTheme>["colors"];

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.main },
    containerCentered: { flex: 1, backgroundColor: colors.background.main, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
    header: { backgroundColor: "#0056B8", flexDirection: "row", alignItems: "center", paddingTop: 55, paddingBottom: 16, paddingHorizontal: 16 },
    backBtn: { marginRight: 12 },
    headerTitle: { fontSize: 17, fontFamily: "Inter-Bold", color: "#FFFFFF" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
    label: { fontSize: 13, fontFamily: "Inter-SemiBold", color: colors.text.light, marginBottom: 8 },
    routeName: { fontSize: 16, fontFamily: "Inter-Bold", color: colors.text.dark },
    ratingRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    starBtn: { padding: 4 },
    ratingHint: { fontSize: 13, fontFamily: "Inter-Regular", color: colors.text.light },
    ratingValue: { fontSize: 14, fontFamily: "Inter-SemiBold", color: colors.text.dark },
    input: { minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: "Inter-Regular", color: colors.text.dark, textAlignVertical: "top" },
    button: { minHeight: 50, borderRadius: 24, backgroundColor: colors.button.primary, alignItems: "center", justifyContent: "center", marginTop: 8 },
    buttonPressed: { opacity: 0.6 },
    buttonText: { fontSize: 16, fontFamily: "Inter-Bold", color: "#FFFFFF" },
    successTitle: { fontSize: 20, fontFamily: "Inter-Bold", color: colors.text.dark, textAlign: "center" },
    successSubtitle: { fontSize: 14, fontFamily: "Inter-Regular", color: colors.text.light, textAlign: "center" },
  });
}