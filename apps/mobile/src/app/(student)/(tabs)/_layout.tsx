import { Tabs } from "expo-router";
import { DockTabBar, type DockTabIcons } from "@/components/dock-tab-bar";

const ICONS: DockTabIcons = {
  index: ["home", "home-outline"],
  campuses: ["map", "map-outline"],
  profile: ["person", "person-outline"],
};

export default function StudentTabsLayout() {
  return (
    <Tabs tabBar={(props) => <DockTabBar {...props} icons={ICONS} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="campuses" options={{ title: "Servicios" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
