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
import { Ionicons } from "@expo/vector-icons";
import {
  AppScreen,
  InlineState,
  ListSkeleton,
  ScreenHeader,
  uiStyles,
} from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";
import type { Campus } from "@/types/operational";
import { getOperationalErrorMessage } from "@/utils/error-message";

const heroIllustration = require("../../../assets/images/images_upsgo/bus-campus-hero.jpg");

export default function CampusPreferenceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [campuses, setCampuses] = useState<Campus[]>([]);
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
      setCampuses(backendCampuses);

      if (savedId && backendCampuses.some((c) => c.id === savedId)) {
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
    const timer = setTimeout(() => {
      void loadCampuses();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCampuses]);

  const handleSave = async () => {
    if (!userId || !selectedCampusId) return;
    try {
      setSaving(true);
      await campusPreferenceService.setPreferredCampusId(
        userId,
        selectedCampusId,
      );
      router.replace("/(student)/(tabs)");
    } catch {
      router.replace("/(student)/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  const handleExploreAll = () => {
    router.replace("/(student)/(tabs)/campuses");
  };

  return (
    <AppScreen>
      <ScreenHeader
        title="UPS GO"
        subtitle="Transporte universitario"
        back={hasSavedPreference}
        onBack={() => router.replace("/(student)/(tabs)")}
      />

      <ScrollView
        contentContainerStyle={uiStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Layered Hero Banner */}
        <View style={styles.heroBanner}>
          {/* Illustration placed absolutely in the background right */}
          <Image
            source={heroIllustration}
            style={styles.heroBackgroundIllustration}
            resizeMode="cover"
          />

          {/* Left Column Content - strictly bounded to left side */}
          <View style={styles.heroContent}>
            <View style={styles.welcomePill}>
              <Text style={styles.welcomeEmoji}>👋</Text>
              <Text style={styles.welcomeText}>Bienvenido</Text>
            </View>

            <Text style={styles.heroTitle}>¿Qué campus te interesa más?</Text>

            <Text style={styles.heroSubtitle}>
              Elige tu campus principal para personalizar tu inicio y salidas.
            </Text>
          </View>
        </View>

        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <InlineState
            icon="cloud-offline-outline"
            title="No pudimos cargar los campus"
            message={error}
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadCampuses()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            }
          />
        ) : campuses.length === 0 ? (
          <InlineState
            icon="business-outline"
            title="No hay campus disponibles"
            message="No encontramos campus activos en el sistema en este momento."
          />
        ) : (
          <View style={styles.selectionSection}>
            <Text style={styles.sectionLabel}>
              Selecciona tu campus principal
            </Text>

            <View style={styles.campusList}>
              {campuses.map((campus) => {
                const isSelected = selectedCampusId === campus.id;
                return (
                  <Pressable
                    key={campus.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={campus.name}
                    onPress={() => setSelectedCampusId(campus.id)}
                    style={({ pressed }) => [
                      styles.campusCard,
                      isSelected && styles.campusCardSelected,
                      pressed && styles.campusCardPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.campusIconContainer,
                        isSelected && styles.campusIconContainerSelected,
                      ]}
                    >
                      <Ionicons
                        name="business"
                        size={22}
                        color={isSelected ? Colors.primary : "#64748B"}
                      />
                    </View>

                    <View style={styles.campusInfo}>
                      <Text
                        style={[
                          styles.campusName,
                          isSelected && styles.campusNameSelected,
                        ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {campus.name}
                      </Text>
                      <View style={styles.locationRow}>
                        <Ionicons
                          name="location-sharp"
                          size={14}
                          color="#F59E0B"
                          style={styles.locationIcon}
                        />
                        <Text
                          style={styles.campusAddress}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {campus.address || campus.code || "Guayaquil"}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleSelected,
                      ]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* 4. Action Button */}
            <View style={styles.actionContainer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continuar"
                disabled={!selectedCampusId || saving}
                onPress={() => void handleSave()}
                style={({ pressed }) => [
                  styles.continueButton,
                  (!selectedCampusId || saving) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Continuar</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={Colors.white}
                    />
                  </View>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleExploreAll}
                style={styles.exploreButton}
              >
                <Text style={styles.exploreText}>
                  Explorar todos los campus
                </Text>
              </Pressable>
            </View>

            {/* 5. Footer Info Note */}
            <View style={styles.footerNote}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.footerText}>
                Podrás cambiar tu campus principal en cualquier momento desde el
                inicio o tu perfil.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroBanner: {
    backgroundColor: "#F4F8FE",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E1EEFA",
    minHeight: 180,
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroBackgroundIllustration: {
    position: "absolute",
    bottom: 0,
    right: -15,
    width: "54%",
    height: "100%",
    opacity: 0.96,
  },
  heroContent: {
    width: "52%",
    paddingLeft: 18,
    paddingVertical: 18,
    paddingRight: 4,
    gap: 6,
    zIndex: 10,
  },
  welcomePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  welcomeEmoji: {
    fontSize: 20,
  },
  welcomeText: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
    fontSize: 15,
  },
  heroTitle: {
    color: Colors.navy,
    fontFamily: "Inter-Bold",
    fontSize: 20,
    lineHeight: 25,
  },
  heroSubtitle: {
    color: "#5B738E",
    fontFamily: "Inter-Regular",
    fontSize: 12.5,
    lineHeight: 17,
  },
  selectionSection: {
    gap: 16,
  },
  sectionLabel: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
    marginTop: 2,
  },
  campusList: {
    gap: 12,
  },
  campusCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    shadowColor: Colors.navy,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  campusCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#F7FAFE",
  },
  campusCardPressed: {
    opacity: 0.85,
  },
  campusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  campusIconContainerSelected: {
    backgroundColor: "#EBF4FE",
  },
  campusInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  campusName: {
    color: Colors.text.dark,
    fontFamily: "Inter-SemiBold",
    fontSize: 15.5,
    flexShrink: 1,
  },
  campusNameSelected: {
    color: Colors.primary,
    fontFamily: "Inter-Bold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    minWidth: 0,
  },
  locationIcon: {
    marginTop: 2,
  },
  campusAddress: {
    flex: 1,
    flexShrink: 1,
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  actionContainer: {
    gap: 10,
    marginTop: 4,
  },
  continueButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#07508E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    shadowColor: "#07508E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: Colors.white,
    fontFamily: "Inter-Bold",
    fontSize: 16,
  },
  exploreButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.white,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  footerText: {
    flex: 1,
    color: "#64748B",
    fontFamily: "Inter-Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  retryButton: {
    marginTop: 10,
  },
  retryText: {
    color: Colors.primary,
    fontFamily: "Inter-SemiBold",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});
