import { SafeAreaView, StyleSheet } from "react-native";
import { ReactNode } from "react";

import { Colors } from "@/constants/Colors";

interface Props {
  children: ReactNode;
}

export default function ScreenContainer({ children }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.main,
  },
});