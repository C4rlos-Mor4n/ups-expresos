import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Colors } from "@/constants/Colors";

export default function StudentTabsLayout() {
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: Colors.primary, tabBarInactiveTintColor: Colors.text.light, tabBarStyle: { borderTopColor: Colors.border, backgroundColor: Colors.white }, tabBarLabelStyle: { fontFamily: "Inter-SemiBold", fontSize: 12 }, tabBarIcon: ({ color, size }) => { const icons: Record<string, keyof typeof Ionicons.glyphMap> = { index: "home-outline", campuses: "map-outline", profile: "person-outline" }; return <Ionicons name={icons[route.name] ?? "ellipse-outline"} color={color} size={size} />; } })}><Tabs.Screen name="index" options={{ title: "Inicio" }} /><Tabs.Screen name="campuses" options={{ title: "Servicios" }} /><Tabs.Screen name="profile" options={{ title: "Perfil" }} /></Tabs>;
}
