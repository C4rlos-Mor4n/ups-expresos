import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";

type StudentTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

function StudentTabBar({ state, descriptors, navigation }: StudentTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBarContainer,
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor?.options ?? {};
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const rawLabel =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;

          const label =
            typeof rawLabel === "string"
              ? rawLabel
              : typeof rawLabel === "function"
                ? options.title || route.name
                : route.name;

          let iconName: keyof typeof Ionicons.glyphMap = "ellipse-outline";
          if (route.name === "index") {
            iconName = isFocused ? "home" : "home-outline";
          } else if (route.name === "campuses") {
            iconName = isFocused ? "map" : "map-outline";
          } else if (route.name === "profile") {
            iconName = isFocused ? "person" : "person-outline";
          }

          const activeColor = Colors.primary;
          const inactiveColor = "#718096";

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={String(label)}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              hitSlop={8}
              style={styles.tabButton}
            >
              <Ionicons
                name={iconName}
                size={22}
                color={isFocused ? activeColor : inactiveColor}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? activeColor : inactiveColor },
                  isFocused && styles.tabLabelActive,
                ]}
              >
                {String(label)}
              </Text>
              <View
                style={[
                  styles.activeIndicator,
                  isFocused && styles.activeIndicatorVisible,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function StudentTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <StudentTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Inicio" }} />
      <Tabs.Screen name="campuses" options={{ title: "Servicios" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    pointerEvents: "box-none",
  },
  dock: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5EDF7",
    shadowColor: Colors.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 3,
  },
  tabLabel: {
    fontFamily: "Inter-Medium",
    fontSize: 11.5,
    textAlign: "center",
  },
  tabLabelActive: {
    fontFamily: "Inter-Bold",
  },
  activeIndicator: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "transparent",
  },
  activeIndicatorVisible: {
    backgroundColor: Colors.primary,
  },
});
