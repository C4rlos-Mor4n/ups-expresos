import { Image, type ImageStyle, type StyleProp } from "react-native";

// Logo completo de UPS GO con contorno blanco tipo sticker: se lee sobre los fondos navy
// y claros de la app sin necesidad de una caja blanca detrás.
const logo = require("../../assets/images/images_upsgo/logo-ups-go-outline.png");
// Relación de aspecto del PNG (ancho / alto).
const ASPECT = 900 / 526;

export function BrandLogo({
  height = 44,
  style,
}: {
  height?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={logo}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="UPS GO"
      style={[{ height, width: height * ASPECT, alignSelf: "flex-start" }, style]}
    />
  );
}
