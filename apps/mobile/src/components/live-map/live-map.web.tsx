import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LIVE_MAP_HTML, type LiveMapState } from "./live-map-html";

export type { LiveMapState, LiveMapBus, LiveMapStop } from "./live-map-html";

export interface LiveMapHandle {
  recenter: () => void;
  focusBus: () => void;
}

/** Versión web (iframe) del mapa en vivo: misma página Leaflet, comunicación por postMessage. */
export const LiveMap = forwardRef<LiveMapHandle, { state: LiveMapState; style?: StyleProp<ViewStyle> }>(
  function LiveMap({ state, style }, ref) {
    const frame = useRef<HTMLIFrameElement | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      if (ready) frame.current?.contentWindow?.postMessage({ __liveMap: true, state }, "*");
    }, [ready, state]);

    useImperativeHandle(ref, () => ({
      recenter: () => (frame.current?.contentWindow as unknown as { __fit?: () => void })?.__fit?.(),
      focusBus: () => (frame.current?.contentWindow as unknown as { __focusBus?: () => void })?.__focusBus?.(),
    }));

    return (
      <View style={[styles.wrap, style]}>
        {createElement("iframe", {
          ref: frame,
          srcDoc: LIVE_MAP_HTML,
          onLoad: () => setReady(true),
          style: { border: 0, width: "100%", height: "100%" },
          title: "Mapa en vivo",
        })}
      </View>
    );
  },
);

const styles = StyleSheet.create({ wrap: { overflow: "hidden", backgroundColor: "#E8EEF5" } });
