import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BrandLogo } from "@/components/brand-logo";
import { AppScreen, ScreenHeader } from "@/components/operational-ui";
import { BrandGradient, Illustration } from "@/components/visual";
import { Colors } from "@/constants/Colors";
import { DEVELOPMENT_TEAM, PROJECT_TUTOR, type Contributor } from "@/constants/credits";

// Un color por integrante: la tarjeta se reconoce de un vistazo sin depender de fotos.
const AVATAR_COLORS = ["#0A5BA8", "#7A4FD1", "#0F8A6B", "#C2410C"];

/** Agradecimientos al equipo que construyó UPS GO. Abierta con o sin sesión (ver `isSharedRoute`). */
export default function CreditsScreen() {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <AppScreen>
      <ScreenHeader title="Agradecimientos" subtitle="El equipo detrás de UPS GO" back onBack={goBack} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <BrandGradient />
          <BrandLogo height={52} style={styles.heroLogo} />
          <Text style={styles.heroTitle}>Hecho por estudiantes, para estudiantes</Text>
          <Text style={styles.heroText}>
            UPS GO nació en la Universidad Politécnica Salesiana con una idea simple: que nadie pierda su bus por no
            saber a qué hora pasa. Gracias a quienes lo hicieron posible.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Tutor del proyecto
          </Text>
          <ContributorCard person={PROJECT_TUTOR} color={Colors.navy} featured />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Equipo de desarrollo
          </Text>
          <Text style={styles.sectionHint}>Estudiantes de la Universidad Politécnica Salesiana</Text>
          {DEVELOPMENT_TEAM.map((person, index) => (
            <ContributorCard
              key={person.name}
              person={person}
              color={AVATAR_COLORS[index % AVATAR_COLORS.length]!}
            />
          ))}
        </View>

        <View style={styles.thanks}>
          <Illustration name="welcome" height={120} />
          <Text style={styles.thanksTitle}>¡Gracias, comunidad UPS!</Text>
          <Text style={styles.thanksText}>
            A los conductores, al personal de transporte y a cada estudiante que probó la app y nos ayudó a mejorarla.
          </Text>
        </View>

        <View style={styles.footer}>
          <Ionicons name="heart" size={14} color={Colors.secondary} />
          <Text style={styles.footerText}>Universidad Politécnica Salesiana · Guayaquil · 2026</Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function ContributorCard({
  person,
  color,
  featured = false,
}: {
  person: Contributor;
  color: string;
  featured?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${person.name}, ${person.role}`}
      style={[styles.card, featured && styles.cardFeatured]}
    >
      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{person.initials}</Text>
      </View>
      <View style={styles.cardCopy}>
        <Text style={styles.name}>{person.name}</Text>
        <View style={[styles.rolePill, featured && styles.rolePillFeatured]}>
          <Text style={[styles.roleText, featured && styles.roleTextFeatured]}>{person.role}</Text>
        </View>
        {person.description ? <Text style={styles.description}>{person.description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 48 },
  hero: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 22,
    gap: 10,
    alignItems: "flex-start",
  },
  heroLogo: { marginBottom: 6 },
  heroTitle: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heroText: { color: "#D9E8F8", fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 21 },
  section: { gap: 10 },
  sectionTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 18, paddingHorizontal: 2 },
  sectionHint: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 13,
    marginTop: -6,
    paddingHorizontal: 2,
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: Colors.navy,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardFeatured: { borderWidth: 2, borderColor: Colors.secondary, backgroundColor: "#FFFCF3" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.white, fontFamily: "Inter-Bold", fontSize: 18, letterSpacing: 0.5 },
  cardCopy: { flex: 1, minWidth: 0, gap: 6 },
  name: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 16, lineHeight: 21 },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF2FC",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rolePillFeatured: { backgroundColor: "#FFF4D8" },
  roleText: { color: Colors.primary, fontFamily: "Inter-SemiBold", fontSize: 12 },
  roleTextFeatured: { color: "#8A5A00" },
  description: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 19 },
  thanks: {
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EAF2FC",
    borderRadius: 22,
    padding: 20,
  },
  thanksTitle: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 18, textAlign: "center" },
  thanksText: {
    color: "#3C5577",
    fontFamily: "Inter-Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { color: Colors.text.light, fontFamily: "Inter-Regular", fontSize: 12 },
});
