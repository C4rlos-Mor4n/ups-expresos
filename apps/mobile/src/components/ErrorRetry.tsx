import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Colors } from "../constants/Colors";

interface ErrorRetryProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

const DEFAULT_MESSAGE = "No pudimos conectarnos al servidor. Verifica tu conexión e intenta nuevamente.";

export default function ErrorRetry({
  title = "Algo salió mal",
  message = DEFAULT_MESSAGE,
  onRetry,
  retrying = false,
}: ErrorRetryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
        >
          {retrying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Reintentar</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    color: Colors.text.dark,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: Colors.text.light,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: Colors.button.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter-SemiBold",
  },
});