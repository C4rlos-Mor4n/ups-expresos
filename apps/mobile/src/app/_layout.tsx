import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { isPrivateRoute } from "../utils/routes";
import { ThemeProvider } from "../context/ThemeContext";
import { FavoritesProvider } from "../context/FavoritesContext";
import { FavoriteStopsProvider } from "../context/FavoriteStopsContext";
import { RoutesProvider } from "../context/RoutesContext";
import { useEffect } from "react";
import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    if (loading || !navigationState?.key) return;

    // Si no está autenticado y navega a una ruta privada, redirigir a welcome.
    if (!isAuthenticated && isPrivateRoute(segments)) {
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace("/");
      }
    }
  }, [isAuthenticated, loading, segments, navigationState?.key]);

  return (
    <>
      <StatusBar style="dark" />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="route/[id]" />
        <Stack.Screen name="map/[id]" />
        <Stack.Screen name="stop/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <RoutesProvider>
          <FavoritesProvider>
            <FavoriteStopsProvider>
              <AppContent />
            </FavoriteStopsProvider>
          </FavoritesProvider>
        </RoutesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}