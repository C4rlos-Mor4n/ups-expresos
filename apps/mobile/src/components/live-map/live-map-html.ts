/**
 * Página HTML (Leaflet + OpenStreetMap) que se carga dentro de la WebView del mapa en vivo.
 * La app le envía el estado con `window.__update(json)`; no se recarga en cada actualización,
 * así el usuario puede mover/zoom sin que el mapa salte.
 *
 * Las paradas se unen con una línea punteada (referencial, no es el trazado exacto por calles).
 */
export interface LiveMapStop {
  latitude: number;
  longitude: number;
  name: string;
  order: number;
  highlight?: boolean;
}

export interface LiveMapBus {
  id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  label: string;
  live: boolean;
}

export interface LiveMapState {
  stops: LiveMapStop[];
  buses: LiveMapBus[];
}

export const LIVE_MAP_HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map{height:100%;margin:0;background:#E8EEF5;font-family:-apple-system,Roboto,sans-serif}
.stop{width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #0A5BA8;box-sizing:border-box}
.stop.mine{width:18px;height:18px;background:#F5B323;border-color:#00224E}
.stop.end{border-color:#00224E;background:#00224E}
.bus{position:relative;width:44px;height:44px}
.bus .halo{position:absolute;inset:0;border-radius:50%;background:rgba(15,138,107,.25);animation:pulse 1.8s ease-out infinite}
.bus.stale .halo{background:rgba(120,135,153,.25);animation:none}
.bus .dot{position:absolute;left:8px;top:8px;width:28px;height:28px;border-radius:50%;background:#0F8A6B;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.bus.stale .dot{background:#7A8799}
.bus .arrow{position:absolute;left:18px;top:-2px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:8px solid #00224E;transform-origin:4px 24px}
.bus svg{width:15px;height:15px}
.tag{position:absolute;top:44px;left:50%;transform:translateX(-50%);background:#00224E;color:#fff;font-size:11px;font-weight:700;padding:2px 6px;border-radius:6px;white-space:nowrap}
@keyframes pulse{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.5);opacity:0}}
.leaflet-control-attribution{font-size:9px}
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:true}).setView([-2.17,-79.92],12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var stopsLayer=L.layerGroup().addTo(map),busLayer=L.layerGroup().addTo(map),line=null,state=null,fitted=false,busMarkers={};
var BUS_SVG='<svg viewBox="0 0 24 24" fill="#fff"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4S4 2.5 4 6v10zm3.5 1a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm9 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM18 11H6V6h12v5z"/></svg>';
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function busIcon(b){var arrow=b.heading==null?'':'<div class="arrow" style="transform:rotate('+b.heading+'deg)"></div>';
 return L.divIcon({className:'',iconSize:[44,44],iconAnchor:[22,22],html:'<div class="bus '+(b.live?'':'stale')+'"><div class="halo"></div>'+arrow+'<div class="dot">'+BUS_SVG+'</div><div class="tag">'+esc(b.label)+'</div></div>'})}
function fit(){if(!state)return;var pts=[];state.stops.forEach(function(s){pts.push([s.latitude,s.longitude])});state.buses.forEach(function(b){pts.push([b.latitude,b.longitude])});
 if(pts.length===1)map.setView(pts[0],15);else if(pts.length>1)map.fitBounds(pts,{padding:[36,36],maxZoom:16})}
window.__fit=fit;
window.__focusBus=function(){if(state&&state.buses[0])map.setView([state.buses[0].latitude,state.buses[0].longitude],16)};
window.__update=function(next){state=typeof next==='string'?JSON.parse(next):next;
 stopsLayer.clearLayers();var pts=state.stops.map(function(s){return [s.latitude,s.longitude]});
 if(line)map.removeLayer(line);line=pts.length>1?L.polyline(pts,{color:'#0A5BA8',weight:4,opacity:.55,dashArray:'6 8'}).addTo(map):null;
 state.stops.forEach(function(s,i){var cls='stop'+(s.highlight?' mine':'')+(i===state.stops.length-1?' end':'');
  L.marker([s.latitude,s.longitude],{icon:L.divIcon({className:'',html:'<div class="'+cls+'"></div>',iconSize:s.highlight?[18,18]:[12,12]})}).bindTooltip(esc(s.order+'. '+s.name)).addTo(stopsLayer)});
 var seen={};state.buses.forEach(function(b){seen[b.id]=1;var m=busMarkers[b.id];
  if(m){m.setLatLng([b.latitude,b.longitude]);m.setIcon(busIcon(b))}else{busMarkers[b.id]=L.marker([b.latitude,b.longitude],{icon:busIcon(b),zIndexOffset:1000}).addTo(busLayer)}});
 Object.keys(busMarkers).forEach(function(id){if(!seen[id]){busLayer.removeLayer(busMarkers[id]);delete busMarkers[id]}});
 if(!fitted){fit();fitted=true}};
window.addEventListener('message',function(e){if(e&&e.data&&e.data.__liveMap)window.__update(e.data.state)});
</script></body></html>`;
