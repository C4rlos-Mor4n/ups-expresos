/**
 * Simulador de Hunter DataForward (solo QA/demo).
 *
 * Envía reportes de posición (Suceso 7) como lo haría la plataforma AVL de Hunter, moviendo un
 * "bus" a lo largo de las paradas de un recorrido del dataset de referencia de Guayaquil.
 *
 *   pnpm tracking:simulate -- --url https://api.ejemplo.com --token <HUNTER_WEBHOOK_TOKEN> \
 *     --route NORTE_IDA --device 900001 --alias GBA1234 --interval 5 --steps 8
 *
 * Opciones:
 *   --url       Base de la API (sin /integrations/...). Obligatorio.
 *   --token     API key del webhook (o variable HUNTER_WEBHOOK_TOKEN).
 *   --route     Código de RoutePath del dataset (NORTE_IDA, SUR_RETORNO, …). Por defecto NORTE_IDA.
 *   --device    Id del dispositivo simulado (Hunter `Id`). Por defecto 900001.
 *   --alias     Alias del activo (Hunter AliasEtiqueta = alias/etiqueta). Por defecto SIM-BUS.
 *   --interval  Segundos entre reportes. Por defecto 5.
 *   --steps     Puntos interpolados entre cada par de paradas. Por defecto 6.
 *   --once      Envía un único reporte en la primera parada y termina.
 *
 * Tras el primer reporte el dispositivo aparece en GET /admin/tracking/devices y debe vincularse
 * a un vehículo (PUT /admin/tracking/devices/:id/vehicle) para que las apps lo muestren.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Dataset {
  stops: Array<{ id: string; latitude: number; longitude: number; name: string }>;
  routePaths: Array<{ code: string; stopIds: string[] }>;
}

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1]!.startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
}

const MPH_PER_KPH = 1 / 1.609344;

function hunterDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())} ${p(date.getUTCHours())}:${p(date.getUTCMinutes())}:${p(date.getUTCSeconds())}`;
}

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a.map(toRad) as [number, number];
  const [lat2, lon2] = b.map(toRad) as [number, number];
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  const deg = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  return deg === 0 ? 360 : deg;
}

async function main(): Promise<void> {
  const url = arg('url');
  const token = arg('token', process.env.HUNTER_WEBHOOK_TOKEN);
  if (!url || !token) {
    console.error('Uso: --url <api> --token <token> [--route NORTE_IDA] [--device 900001]');
    process.exit(1);
  }
  const routeCode = arg('route', 'NORTE_IDA')!;
  const device = arg('device', '900001')!;
  const alias = arg('alias', 'SIM-BUS')!;
  const interval = Number(arg('interval', '5'));
  const steps = Math.max(1, Number(arg('steps', '6')));
  const once = process.argv.includes('--once');

  const dataset = JSON.parse(
    readFileSync(join(process.cwd(), 'prisma', 'data', 'ups_go_routes_reference_guayaquil.json'), 'utf8'),
  ) as Dataset;
  const route = dataset.routePaths.find((r) => r.code === routeCode);
  if (!route) throw new Error(`RoutePath ${routeCode} no existe en el dataset`);
  const stops = route.stopIds.map((id) => dataset.stops.find((s) => s.id === id)!);

  const path: Array<[number, number]> = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps;
      path.push([a.latitude + (b.latitude - a.latitude) * t, a.longitude + (b.longitude - a.longitude) * t]);
    }
  }
  const last = stops[stops.length - 1]!;
  path.push([last.latitude, last.longitude]);

  const endpoint = `${url.replace(/\/$/, '')}/integrations/hunter/dataforward`;
  const points = once ? path.slice(0, 1) : path;
  console.log(`Simulando ${routeCode} (${stops.length} paradas, ${points.length} reportes) → ${endpoint}`);

  for (let i = 0; i < points.length; i += 1) {
    const here = points[i]!;
    const next = points[Math.min(i + 1, points.length - 1)]!;
    const moving = i < points.length - 1;
    const body = {
      AliasEtiqueta: `${alias}/SIMULADOR`,
      FechaHora: hunterDate(new Date()),
      Id: Number(device),
      Evento: 1,
      Suceso: moving ? 7 : 8,
      Latitud: here[0],
      Longitud: here[1],
      NumeroSatelites: 12,
      CalidadGPS: 1,
      EstadoIgnicion: 1,
      Velocidad: moving ? Math.round(35 * MPH_PER_KPH * 10) / 10 : 0,
      Rumbo: moving ? bearing(here, next) : 0,
      Altitud: 10,
    };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': token, 'ngrok-skip-browser-warning': '1' },
      body: JSON.stringify(body),
    });
    console.log(`${i + 1}/${points.length} ${here[0].toFixed(5)},${here[1].toFixed(5)} → ${response.status} ${await response.text()}`);
    if (i < points.length - 1) await new Promise((resolve) => setTimeout(resolve, interval * 1000));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
