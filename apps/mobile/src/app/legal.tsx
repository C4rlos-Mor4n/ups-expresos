import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppScreen, ScreenHeader } from "@/components/operational-ui";
import { Colors } from "@/constants/Colors";
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED_AT,
  LEGAL_VERSION,
  type LegalDocumentId,
} from "@/constants/legal";

const TABS: { id: LegalDocumentId; label: string }[] = [
  { id: "privacy", label: "Privacidad" },
  { id: "terms", label: "Términos" },
];

/** Política de privacidad y Términos de uso. Abierta con o sin sesión (ver `isSharedRoute`). */
export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ doc?: string }>();
  const active: LegalDocumentId = params.doc === "terms" ? "terms" : "privacy";
  const document = LEGAL_DOCUMENTS[active];
  const scrollRef = useRef<ScrollView>(null);

  const select = (id: LegalDocumentId) => {
    if (id === active) return;
    router.setParams({ doc: id });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <AppScreen>
      <ScreenHeader title={document.title} subtitle="UPS GO" back onBack={goBack} />

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => select(tab.id)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Ionicons
            name={active === "privacy" ? "shield-checkmark" : "document-text"}
            size={22}
            color={Colors.primary}
          />
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>En resumen</Text>
            <Text style={styles.summaryText}>{document.summary}</Text>
          </View>
        </View>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {section.title}
            </Text>
            {section.intro ? <Text style={styles.paragraph}>{section.intro}</Text> : null}
            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.meta}>
          Versión {LEGAL_VERSION} · Última actualización: {LEGAL_UPDATED_AT}
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#E5EDF7",
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSelected: {
    backgroundColor: Colors.white,
    shadowColor: Colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { color: Colors.text.light, fontFamily: "Inter-SemiBold", fontSize: 14 },
  tabTextSelected: { color: Colors.navy, fontFamily: "Inter-Bold" },
  content: { padding: 16, paddingTop: 8, gap: 18, paddingBottom: 48 },
  summary: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#EAF2FC",
    borderRadius: 18,
    padding: 16,
  },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { color: Colors.navy, fontFamily: "Inter-Bold", fontSize: 15 },
  summaryText: { color: "#3C5577", fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 21 },
  section: { gap: 8 },
  sectionTitle: { color: Colors.text.dark, fontFamily: "Inter-Bold", fontSize: 16 },
  paragraph: { color: "#3F4B5C", fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 10, paddingRight: 4 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.secondary,
    marginTop: 8,
  },
  bulletText: { flex: 1, color: "#3F4B5C", fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 22 },
  meta: {
    color: Colors.text.light,
    fontFamily: "Inter-Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
