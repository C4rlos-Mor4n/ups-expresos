import { Stack } from "expo-router";
export default function DriverLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /><Stack.Screen name="assignment/[assignmentId]" /><Stack.Screen name="run/[runId]" /></Stack>; }
