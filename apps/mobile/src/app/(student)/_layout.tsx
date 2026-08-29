import { Stack } from "expo-router";

export default function StudentLayout() {
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="campus/[campusId]" /><Stack.Screen name="service-line/[serviceLineId]" /><Stack.Screen name="scheduled-departure/[departureId]" /></Stack>;
}
