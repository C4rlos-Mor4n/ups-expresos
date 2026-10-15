import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { LIVE_MAP_HTML, type LiveMapState } from "./live-map-html";

export type { LiveMapState, LiveMapBus, LiveMapStop } from "./live-map-html";

export interface LiveMapHandle {
  recenter: () => void;
  focusBus: () => void;
}

/** Mapa en vivo (Leaflet en WebView). Recibe paradas y buses; se actualiza sin recargarse. */
export const LiveMap = forwardRef<LiveMapHandle, { state: LiveMapState; style?: StyleProp<ViewStyle> }>(
  function LiveMap({ state, style }, ref) {
    const webview = useRef<WebView>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (!ready) return;
      webview.current?.injectJavaScript(`window.__update(${JSON.stringify(JSON.stringify(state))});true;`);
    }, [ready, state]);

    useImperativeHandle(ref, () => ({
      recenter: () => webview.current?.injectJavaScript("window.__fit&&window.__fit();true;"),
      focusBus: () => webview.current?.injectJavaScript("window.__focusBus&&window.__focusBus();true;"),
    }));

    return (
      <View style={[styles.wrap, style]}>
        <WebView
          ref={webview}
          originWhitelist={["*"]}
          source={{ html: LIVE_MAP_HTML, baseUrl: "https://upsgo.app/" }}
          onLoadEnd={() => setReady(true)}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          nestedScrollEnabled
          style={styles.web}
          accessibilityLabel="Mapa con la ubicación del bus y las paradas"
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", backgroundColor: "#E8EEF5" },
  web: { flex: 1, backgroundColor: "#E8EEF5" },
});
