import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ProfileRow, ProfileScreen } from "@/components/profile-screen";
import { useAuth } from "@/context/AuthContext";
import { campusPreferenceService } from "@/services/campus-preference.service";
import { operationalService } from "@/services/operational.service";

export default function StudentProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [campusName, setCampusName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      void (async () => {
        try {
          const [campusId, campuses] = await Promise.all([
            campusPreferenceService.getPreferredCampusId(userId),
            operationalService.getCampuses(),
          ]);
          if (active) setCampusName(campuses.find((item) => item.id === campusId)?.name ?? null);
        } catch {
          // Sin red: la fila muestra el texto por defecto.
        }
      })();
      return () => {
        active = false;
      };
    }, [userId]),
  );

  return (
    <ProfileScreen roleLabel="Estudiante">
      <ProfileRow
        icon="location-outline"
        title="Campus principal"
        value={campusName ?? "Elige tu campus"}
        onPress={() => router.push("/(student)/campus-preference")}
      />
    </ProfileScreen>
  );
}
