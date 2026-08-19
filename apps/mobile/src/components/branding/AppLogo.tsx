import { Image, StyleSheet, View } from "react-native";

interface AppLogoProps {
  showInstitutionalLogo?: boolean;
}

export default function AppLogo({
  showInstitutionalLogo = true,
}: AppLogoProps) {
  return (
    <View style={styles.container}>

      {showInstitutionalLogo && (
        <Image
          source={require("../../../assets/images/images_busapp/logo-ups.png")}
          style={styles.logoUPS}
          resizeMode="contain"
        />
      )}

      <Image
        source={require("../../../assets/images/images_busapp/logo-busapp.png")}
        style={styles.logoApp}
        resizeMode="contain"
      />

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  logoUPS: {
    width: 150,
    height: 70,
    marginBottom: 30,
  },

  logoApp: {
    width: 240,
    height: 240,
  },

});