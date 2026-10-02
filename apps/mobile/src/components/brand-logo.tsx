import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const logo = require("../../assets/images/images_upsgo/logo-ups-go-ui.png");
// Relación de aspecto del PNG (ancho / alto).
const ASPECT = 720 / 422;

// Logo completo de UPS GO sobre una "píldora" blanca: las letras azul oscuro del
// logo no se leen directamente sobre los fondos navy de la app.
export function BrandLogo({
  height = 44,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pad = Math.round(height * 0.12);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="UPS GO"
      style={[
        styles.pill,
        { height, borderRadius: Math.round(height * 0.28), paddingHorizontal: pad },
        style,
      ]}
    >
      <Image
        source={logo}
        resizeMode="contain"
        style={{ height: height - pad * 2, width: (height - pad * 2) * ASPECT }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
});
