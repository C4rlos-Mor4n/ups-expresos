import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { RouteStop } from "../types/route";
import { escapeScriptJson } from "../utils/scriptJson";
import { ESCAPE_HTML_JS } from "../utils/htmlEscape";

export interface LeafletMapHandle {
  fitToStops: () => void;
}

interface LeafletMapProps {
  stops: RouteStop[];
}

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(
  ({ stops }, ref) => {
    const webViewRef = useRef<WebView>(null);

    // Expose an imperative handle so parent can trigger fitBounds
    useImperativeHandle(ref, () => ({
      fitToStops: () => {
        webViewRef.current?.injectJavaScript(`
          if (window._map && window._bounds) {
            window._map.fitBounds(window._bounds, { padding: [50, 50] });
          }
          true;
        `);
      },
    }));

    // Serialize stops for injection into the HTML.
    // El escapado evita que un dato (p.ej. un nombre de parada) con "</script>"
    // cierre el bloque de script e inyecte HTML/JS arbitrario en el WebView.
    const stopsJson = escapeScriptJson(
      stops.map((s) => ({
        lat: Number(s.stop.latitude),
        lng: Number(s.stop.longitude),
        name: s.stop.name,
        reference: s.stop.reference || "",
        order: s.stopOrder,
      }))
    );

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Mapa de Ruta</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; }
    .custom-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .marker-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #0056B8;
      border: 3px solid #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-weight: 700;
      font-size: 13px;
      color: #FFFFFF;
    }
    .marker-label {
      margin-top: 3px;
      background: rgba(255,255,255,0.92);
      color: #1a1a2e;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 6px;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* attribution compact */
    .leaflet-control-attribution {
      font-size: 9px !important;
    }
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var stops = ${stopsJson};

  ${ESCAPE_HTML_JS}

  // Initialize map - center will be adjusted via fitBounds
  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
  }).setView([-2.8974, -79.0045], 13);

  window._map = map;

  // CartoDB Positron – clean, light, no Google dependency
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  if (stops.length > 0) {
    var latLngs = stops.map(function(s) { return [s.lat, s.lng]; });

    // Draw polyline connecting all stops in order using OSRM for real road routing
    if (stops.length > 1) {
      var coordinates = stops.map(function(s) { return s.lng + ',' + s.lat; }).join(';');
      var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + coordinates + '?overview=full&geometries=geojson';
      
      fetch(osrmUrl)
        .then(function(response) { return response.json(); })
        .then(function(data) {
          if (data.routes && data.routes.length > 0) {
            var routeGeometry = data.routes[0].geometry;
            L.geoJSON(routeGeometry, {
              style: {
                color: '#0056B8',
                weight: 4,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round'
              }
            }).addTo(map);
          } else {
            // Fallback to straight lines if routing fails
            L.polyline(latLngs, { color: '#0056B8', weight: 4, opacity: 0.9 }).addTo(map);
          }
        })
        .catch(function(err) {
          console.error("OSRM Routing Error:", err);
          L.polyline(latLngs, { color: '#0056B8', weight: 4, opacity: 0.9 }).addTo(map);
        });
    }

    // Draw markers
    stops.forEach(function(stop) {
      // Escapado HTML contextual: los valores (nombre, referencia, orden) se
      // insertan dentro de strings HTML (divIcon / bindPopup), no solo JSON.
      var order = escapeHtml(stop.order);
      var name = escapeHtml(stop.name);
      var reference = escapeHtml(stop.reference || '');

      var iconHtml = '<div class="custom-marker">' +
        '<div class="marker-circle">' + order + '</div>' +
        '<div class="marker-label">' + name + '</div>' +
        '</div>';

      var icon = L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: null,
        iconAnchor: [16, 16],
        popupAnchor: [0, -20],
      });

      L.marker([stop.lat, stop.lng], { icon: icon })
        .addTo(map)
        .bindPopup('<b>' + order + '. ' + name + '</b>' +
          (stop.reference ? '<br/><span style="font-size:12px;color:#555;">' + reference + '</span>' : ''));
    });

    // Auto-fit bounds to show all stops
    var bounds = L.latLngBounds(latLngs);
    window._bounds = bounds;
    map.fitBounds(bounds, { padding: [50, 50] });
  }
</script>
</body>
</html>
`;

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          // Todos los recursos (Leaflet, tiles CARTO, OSRM) son https: no se
          // permite contenido mixto. El valor por defecto de la plataforma
          // ("never") es suficiente y evita cargas http inseguras.
          mixedContentMode="never"
          allowsInlineMediaPlayback
          onError={(e) => console.warn("LeafletMap WebView error:", e.nativeEvent)}
        />
      </View>
    );
  }
);

LeafletMap.displayName = "LeafletMap";

export default LeafletMap;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
