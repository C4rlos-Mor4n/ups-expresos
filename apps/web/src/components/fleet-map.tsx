"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";

export interface MapBus {
  id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  label: string;
  tone: "live" | "stale" | "idle";
  popup?: string;
}

const COLORS = { live: "#0F8A6B", stale: "#B7791F", idle: "#7A8799" };

function icon(L: typeof import("leaflet"), bus: MapBus) {
  const arrow =
    bus.heading == null
      ? ""
      : `<div style="position:absolute;left:14px;top:-6px;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid #00224E;transform:rotate(${bus.heading}deg);transform-origin:5px 22px"></div>`;
  return L.divIcon({
    className: "",
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="position:relative;width:38px;height:38px">${arrow}<div style="position:absolute;left:5px;top:5px;width:28px;height:28px;border-radius:50%;background:${COLORS[bus.tone]};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div><div style="position:absolute;top:36px;left:50%;transform:translateX(-50%);background:#00224E;color:#fff;font:700 11px Inter,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap">${bus.label.replace(/[<>&"]/g, "")}</div></div>`,
  });
}

/** Mapa Leaflet (OpenStreetMap) con la flota; actualiza marcadores sin re-centrar mientras el operador navega. */
export function FleetMap({ buses, focusId, className }: { buses: MapBus[]; focusId?: string | null; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !container.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(container.current, { zoomControl: true }).setView([-2.17, -79.92], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m) return;
    const seen = new Set<string>();
    for (const bus of buses) {
      seen.add(bus.id);
      const existing = markers.current.get(bus.id);
      if (existing) {
        existing.setLatLng([bus.latitude, bus.longitude]);
        existing.setIcon(icon(L, bus));
      } else {
        const marker = L.marker([bus.latitude, bus.longitude], { icon: icon(L, bus) }).addTo(m);
        if (bus.popup) marker.bindPopup(bus.popup);
        markers.current.set(bus.id, marker);
      }
    }
    for (const [id, marker] of markers.current) {
      if (!seen.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
    if (!fitted.current && buses.length > 0) {
      fitted.current = true;
      if (buses.length === 1) m.setView([buses[0]!.latitude, buses[0]!.longitude], 15);
      else m.fitBounds(buses.map((b) => [b.latitude, b.longitude] as [number, number]), { padding: [40, 40], maxZoom: 15 });
    }
  }, [ready, buses]);

  useEffect(() => {
    const target = buses.find((b) => b.id === focusId);
    if (target && map.current) map.current.setView([target.latitude, target.longitude], 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return <div ref={container} className={className ?? "h-[480px] w-full rounded-2xl"} />;
}
