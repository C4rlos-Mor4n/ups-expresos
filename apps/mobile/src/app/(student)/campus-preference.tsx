import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
} from "@/components/operational-ui";
import { LinkButton } from "@/components/student-ui";
import { BrandGradient, PressableScale } from "@/components/visual";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import type { Campus } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

const heroImage = require("../../../assets/images/images_upsgo/bus-campus-hero.jpg");

interface CampusOption extends Campus {
  routeCount: number | null;
}

/** Iniciales para el monograma: "Campus María Auxiliadora" → "MA". */
function campusInitials(name: string): string {
  const words = name
    .replace(/^campus\s+/i, "")
    .split(/\s+/)
    .filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(word));
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words.slice(0, 2).map((word) => word[0]).join("") || name[0] || "U").toUpperCase();
}

export default function CampusPreferenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedPreference, setHasSavedPreference] = useState(false);

  const loadCampuses = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const [backendCampuses, savedId] = await Promise.all([
        operationalService.getCampuses(),
        campusPreferenceService.getPreferredCampusId(userId),
      ]);
      // El número de rutas ayuda a decidir; si falla, la tarjeta simplemente no lo muestra.
      const withCounts = await Promise.all(
        backendCampuses.map(async (campus) => {
          try {
            const lines = await operationalService.getServiceLines(campus.id);
            return { ...campus, routeCount: lines.length };
          } catch {
            return { ...campus, routeCount: null };
          }
        }),
      );
      setCampuses(withCounts);

      if (savedId && backendCampuses.some((campus) => campus.id === savedId)) {
        setSelectedCampusId(savedId);
        setHasSavedPreference(true);
      } else if (backendCampuses.length === 1 && backendCampuses[0]) {
        setSelectedCampusId(backendCampuses[0].id);
      }
    } catch (loadError) {
      setError(getOperationalErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadCampuses(), 0);
    return () => clearTimeout(timer);
  }, [loadCampuses]);

  const handleSave = async () => {
    if (!userId || !selectedCampusId) return;
    try {
      setSaving(true);
      await campusPreferenceService.setPreferredCampusId(userId, selectedCampusId);
    } finally {
      setSaving(false);
      router.replace("/(student)/(tabs)");
    }
  };

  const selected = campuses.find((campus) => campus.id === selectedCampusId);
  const showFooter = !loading && !error && campuses.length > 0;

  return (
    <AppScreen>
      <ScreenHeader
        title={hasSavedPreference ? "Tu campus" : "UPS GO"}
        subtitle={hasSavedPreference ? "Cámbialo cuando quieras" : "Transporte universitario"}
        back={hasSavedPreference}
        onBack={() => router.replace("/(student)/(tabs)")}
      />

      <ScrollView
        contentContainerStyle={[styles.content, showFooter && styles.contentWithFooter]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>👋 {hasSavedPreference ? "Hola de nuevo" : "¡Bienvenido!"}</Text>
            <Text style={styles.heroTitle}>¿A qué campus vas?</Text>
            <Text style={styles.heroText}>
              Lo usamos para mostrarte primero tus buses y horarios.
            </Text>
          </View>
        </View>

        {loading ? (
          <ListSkeleton rows={2} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            illustration="empty"
            title="No pudimos cargar los campus"
            message={error}
            action={<LinkButton label="Reintentar" onPress={() => void loadCampuses()} />}
          />
        ) : campuses.length === 0 ? (
          <InlineState
            icon="business-outline"
            illustration="empty"
            title="Aún no hay campus disponibles"
            message="Cuando la universidad active el servicio en un campus, aparecerá aquí."
          />
        ) : (
          <View style={styles.list}>
            {campuses.map((campus) => {
              const isSelected = selectedCampusId === campus.id;
              return (
                <PressableScale
                  key={campus.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={campus.name}
                  onPress={() => setSelectedCampusId(campus.id)}
                  style={[styles.card, isSelected && styles.cardSelected]}
                >
                  <View style={styles.monogram}>
                    <BrandGradient
                      from={isSelected ? Colors.navy : "#2E5C91"}
                      to={isSelected ? "#0A5BA8" : "#6E93BF"}
                    />
                    <Text style={styles.monogramText}>{campusInitials(campus.name)}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {campus.name}
                    </Text>
                    {campus.address ? (
                      <View style={styles.cardRow}>
                        <Ionicons name="location" size={14} color={Colors.secondary} />
                        <Text style={styles.cardText} numberOfLines={1}>
                          {campus.address}
                        </Text>
                      </View>
                    ) : null}
                    {campus.routeCount !== null ? (
                      <View style={styles.cardRow}>
                        <Ionicons name="bus" size={14} color={Colors.primary} />
                        <Text style={styles.cardText}>
                          {campus.routeCount === 0
                            ? "Sin rutas aún"
                            : `${campus.routeCount} ${campus.routeCount === 1 ? "ruta" : "rutas"}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.check, isSelected && styles.checkSelected]}>
                    {isSelected ? <Ionicons name="checkmark" size={16} color={Colors.navy} /> : null}
                  </View>
                </PressableScale>
              );
            })}

            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace("/(student)/(tabs)/campuses")}
              style={styles.explore}
              hitSlop={6}
            >
              <Ionicons name="map-outline" size={16} color={Colors.primary} />
              <Text style={styles.exploreText}>Ver las rutas de todos los campus</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {showFooter ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !selected || saving }}
            disabled={!selected || saving}
            onPress={() => void handleSave()}
            style={({ pressed }) => [
              styles.cta,
              (!selected || saving) && styles.ctaDisabled,
              pressed && styles.ctaPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={Colors.navy} />
            ) : (
              <>
                <Text style={styles.ctaText} numberOfLines={1}>
                  {selected ? `Continuar con ${selected.name}` : "Elige un campus"}
                </Text>
                {selected ? <Ionicons name="arrow-forward" size={18} color={Colors.navy} /> : null}
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  contentWithFooter: { paddingBottom: 120 },
  hero: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: Colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  // La ilustración trae un margen blanco arriba: se desplaza para que el borde quede limpio.
  heroImage: { width: "100%", height: 206, marginTop: -16 },
  heroCopy: { padding: 20, gap: 6 },
  heroEyebrow: { color: Colors.primary, fontFamily: "Inter-Bold", fontSize: 14 },
  heroTitle: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 26, letterSpacing: -0.4 },
  heroText: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 15, lineHeight: 22 },
  list: { gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 14,
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: Colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: "#F7FAFF" },
  monogram: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  monogramText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 20, letterSpacing: 0.5 },
  cardCopy: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 17 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardText: { flexShrink: 1, color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 14 },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#C6D2E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkSelected: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  explore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    marginTop: 4,
  },
  exploreText: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 15 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(244,247,251,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#DCE5F0",
  },
  cta: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: Colors.secondary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  ctaDisabled: { backgroundColor: "#E3E9F1" },
  ctaPressed: { opacity: 0.9 },
  ctaText: { flexShrink: 1, color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 16 },
});
