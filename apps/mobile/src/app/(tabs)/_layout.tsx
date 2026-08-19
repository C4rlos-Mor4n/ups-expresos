import { Tabs } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { View, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Ícono de la barra de pestañas ───────────────────────────────────────────


// ─── Layout principal de las pestañas ────────────────────────────────────────
export default function TabLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background.main }}>
        <ActivityIndicator size="large" color={colors.button.primary} />
      </View>
    );
  }

  return (
    <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#FFFFFF",
          tabBarActiveTintColor: "#0A4FB3",
          tabBarInactiveTintColor: "#9A9A9A",
          tabBarLabelStyle: {
            fontFamily: "Inter-Medium",
            fontSize: 11,
          },
          tabBarStyle: {
            height: 64 + Math.max(insets.bottom, 0),
            paddingTop: 8,
            paddingBottom: Math.max(insets.bottom, 8),
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#ECECEC",
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rutas"
        options={{
          title: "Rutas",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="bus-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: "Avisos",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="notifications-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: "Favoritos",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="heart-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      </Tabs>
  );
}
