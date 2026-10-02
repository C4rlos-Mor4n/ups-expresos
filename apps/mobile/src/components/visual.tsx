import { useState, type ReactNode } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Colors } from "@/constants/Colors";

/**
 * Ilustraciones de la app (unDraw, licencia libre para uso comercial sin atribución),
 * recoloreadas a la paleta UPS GO. Relación de aspecto = ancho / alto del PNG.
 */
export const illustrations = {
  busStop: { source: require("../../assets/images/illustrations/ill-bus-stop.png"), aspect: 720 / 355 },
  campus: { source: require("../../assets/images/illustrations/ill-campus.png"), aspect: 720 / 522 },
  empty: { source: require("../../assets/images/illustrations/ill-empty.png"), aspect: 720 / 703 },
  myStop: { source: require("../../assets/images/illustrations/ill-my-stop.png"), aspect: 720 / 558 },
  noMore: { source: require("../../assets/images/illustrations/ill-no-more.png"), aspect: 720 / 358 },
  route: { source: require("../../assets/images/illustrations/ill-route.png"), aspect: 720 / 404 },
  search: { source: require("../../assets/images/illustrations/ill-search.png"), aspect: 720 / 1245 },
  services: { source: require("../../assets/images/illustrations/ill-services.png"), aspect: 720 / 783 },
  welcome: { source: require("../../assets/images/illustrations/ill-welcome.png"), aspect: 720 / 608 },
  bus: { source: require("../../assets/images/images_upsgo/bus-isolated.png"), aspect: 1024 / 768 },
} as const satisfies Record<string, { source: ImageSourcePropType; aspect: number }>;

export type IllustrationName = keyof typeof illustrations;

export function Illustration({
  name,
  height,
  width,
  style,
}: {
  name: IllustrationName;
  height?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { source, aspect } = illustrations[name];
  const size =
    width !== undefined
      ? { width, height: width / aspect }
      : { height: height ?? 120, width: (height ?? 120) * aspect };
  return (
    <View style={style} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image source={source} style={size} resizeMode="contain" />
    </View>
  );
}

/** Pressable con un leve "hundimiento" al tocar: da respuesta física sin distraer. */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  ...props
}: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        animate(scaleTo);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animate(1);
        props.onPressOut?.(event);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Fondo con degradado de marca (navy → azul), dibujado con SVG para no sumar módulos nativos. */
export function BrandGradient({
  style,
  from = Colors.navy,
  to = "#0A5BA8",
}: {
  style?: StyleProp<ViewStyle>;
  from?: string;
  to?: string;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#brand)" />
      </Svg>
    </View>
  );
}
