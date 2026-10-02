import { useEffect } from "react";
import { Alert, AppState } from "react-native";
import * as Updates from "expo-updates";

// Descarga actualizaciones OTA (EAS Update) al abrir la app y al volver a primer plano,
// y pregunta si reiniciar cuando hay una lista. No hace nada en desarrollo ni en builds
// sin expo-updates activo (Updates.isEnabled === false).
export function UpdatePrompt() {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (!Updates.isEnabled) return;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Sin red o servidor no disponible: se reintenta en el próximo primer plano.
      } finally {
        checking = false;
      }
    };
    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending) return;
    Alert.alert(
      "Actualización lista",
      "Hay una nueva versión de UPS GO. Reinicia para usarla.",
      [
        { text: "Más tarde", style: "cancel" },
        { text: "Reiniciar ahora", onPress: () => void Updates.reloadAsync() },
      ],
    );
  }, [isUpdatePending]);

  return null;
}
