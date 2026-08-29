import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { canAccessRoleRoute, getRoleHome, isPrivateRoute } from "@/utils/routes";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (loading || !navigationState?.key) return;
    const privateRoute = isPrivateRoute(segments);
    const onAuthRoute = segments[0] === "(auth)";
    if (!isAuthenticated && privateRoute) {
      router.replace("/(auth)/login");
      return;
    }
    if (isAuthenticated && (onAuthRoute || !privateRoute || !canAccessRoleRoute(user?.role, segments))) {
      router.replace(getRoleHome(user?.role));
    }
  }, [isAuthenticated, loading, navigationState?.key, router, segments, user?.role]);

  return <><StatusBar style="light" /><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /><Stack.Screen name="(auth)" /><Stack.Screen name="(student)" /><Stack.Screen name="(driver)" /><Stack.Screen name="unsupported-role" /></Stack></>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ "Inter-Regular": Inter_400Regular, "Inter-Medium": Inter_500Medium, "Inter-SemiBold": Inter_600SemiBold, "Inter-Bold": Inter_700Bold });
  useEffect(() => { if (fontsLoaded) void SplashScreen.hideAsync(); }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return <AuthProvider><AppContent /></AuthProvider>;
}
