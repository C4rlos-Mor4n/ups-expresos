import { Tabs } from "expo-router";
import { DockTabBar, type DockTabIcons } from "@/components/dock-tab-bar";

const ICONS: DockTabIcons = {
  index: ["speedometer", "speedometer-outline"],
  assignments: ["list", "list-outline"],
  profile: ["person", "person-outline"],
};

export default function DriverTabsLayout() {
  return (
    <Tabs tabBar={(props) => <DockTabBar {...props} icons={ICONS} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="assignments" options={{ title: "Mis servicios" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
