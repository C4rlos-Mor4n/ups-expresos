/**
 * Normalización de los mensajes DataForward de Hunter (AVL) al modelo interno de UPS GO.
 *
 * Contrato de referencia: "DataForward - Definiciones" (pie de página V1.2.0, archivo V1.3.0).
 * - Evento: identifica el dispositivo con `Id` y el activo con `AliasEtiqueta` ("ALIAS/ETIQUETA").
 * - Alerta: identifica el activo con `IdActivo`, `Alias` y `Etiqueta`; trae `Descripcion`.
 * - `FechaHora` llega en UTC con formato `yyyyMMdd HH:mm:ss` (el PDF dice `HH:mm:dd`, el ejemplo
 *   muestra segundos; se acepta el formato con segundos y también ISO-8601 por robustez).
 * - `Velocidad` llega en millas por hora → se convierte una sola vez a km/h.
 * - `CalidadGPS`/`EstadoGPS`: 1 = excelente, 9 = sin GPS.
 * - `Rumbo`: 0 = detenido, 1..360 = grados (360 = norte).
 *
 * Funciones puras: no dependen de Nest ni de la base de datos.
 */

export const MPH_TO_KPH = 1.609344;
export const HUNTER_NO_GPS_QUALITY = 9;

export type HunterKind = 'EVENT' | 'ALERT';

export interface NormalizedTrackingReport {
  kind: HunterKind;
  externalId: string;
  alias: string | null;
  label: string | null;
  occurredAt: Date;
  latitude: number;
  longitude: number;
  speedKph: number;
  heading: number | null;
  altitudeMeters: number | null;
  satellites: number | null;
  gpsQuality: number | null;
  ignition: boolean | null;
  eventCode: number | null;
  occurrenceCode: number | null;
  description: string | null;
  address: string | null;
  /** `false` si el reporte no trae una posición utilizable (sin GPS o coordenadas 0,0). */
  hasValidPosition: boolean;
  raw: Record<string, unknown>;
}

export class HunterPayloadError extends Error {}

const HUNTER_DATE = /^(\d{4})(\d{2})(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

/** `20221027 17:58:08` (UTC) → Date. También acepta ISO-8601 con zona. */
export function parseHunterDate(value: unknown): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HunterPayloadError('FechaHora is required');
  }
  const text = value.trim();
  const match = HUNTER_DATE.exec(text);
  if (match) {
    const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
    const date = new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!, s!));
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo! - 1 ||
      date.getUTCDate() !== d ||
      h! > 23 ||
      mi! > 59 ||
      s! > 59
    ) {
      throw new HunterPayloadError(`FechaHora is not a real date: ${text}`);
    }
    return date;
  }
  if (/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new HunterPayloadError(`FechaHora has an unsupported format: ${text}`);
}

function num(body: Record<string, unknown>, key: string, required = false): number | null {
  const value = body[key];
  if (value === undefined || value === null || value === '') {
    if (required) throw new HunterPayloadError(`${key} is required`);
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new HunterPayloadError(`${key} must be numeric`);
  return parsed;
}

function int(body: Record<string, unknown>, key: string, required = false): number | null {
  const value = num(body, key, required);
  return value === null ? null : Math.round(value);
}

function text(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str ? str.slice(0, 300) : null;
}

/** Identificador del proveedor como texto (los Id de Hunter superan Number.MAX_SAFE_INTEGER a veces). */
function identifier(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new HunterPayloadError(`${key} is required`);
  }
  const str = String(value).trim();
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(str)) throw new HunterPayloadError(`${key} has invalid characters`);
  return str;
}

export function detectHunterKind(body: Record<string, unknown>): HunterKind {
  if (body.IdActivo !== undefined) return 'ALERT';
  if (body.Id !== undefined) return 'EVENT';
  throw new HunterPayloadError('Payload has neither Id (event) nor IdActivo (alert)');
}

export function normalizeHunterPayload(
  input: unknown,
  expectedKind?: HunterKind,
): NormalizedTrackingReport {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HunterPayloadError('Payload must be a JSON object');
  }
  const body = input as Record<string, unknown>;
  const kind = detectHunterKind(body);
  if (expectedKind && expectedKind !== kind) {
    throw new HunterPayloadError(`Expected ${expectedKind} payload but received ${kind}`);
  }

  const latitude = num(body, 'Latitud', true)!;
  const longitude = num(body, 'Longitud', true)!;
  if (latitude < -90 || latitude > 90) throw new HunterPayloadError('Latitud out of range');
  if (longitude < -180 || longitude > 180) throw new HunterPayloadError('Longitud out of range');

  const speedMph = num(body, 'Velocidad', true)!;
  if (speedMph < 0) throw new HunterPayloadError('Velocidad must be >= 0');

  const rumbo = int(body, 'Rumbo');
  const heading = rumbo === null || rumbo <= 0 ? null : rumbo % 360;

  const gpsQuality = int(body, kind === 'EVENT' ? 'CalidadGPS' : 'EstadoGPS');
  const ignitionRaw = int(body, 'EstadoIgnicion');

  let alias: string | null;
  let label: string | null;
  let externalId: string;
  if (kind === 'EVENT') {
    externalId = identifier(body, 'Id');
    const aliasEtiqueta = text(body, 'AliasEtiqueta');
    const [a, ...rest] = (aliasEtiqueta ?? '').split('/');
    alias = a?.trim() || null;
    label = rest.join('/').trim() || null;
  } else {
    externalId = identifier(body, 'IdActivo');
    alias = text(body, 'Alias');
    label = text(body, 'Etiqueta');
  }

  const hasValidPosition =
    gpsQuality !== HUNTER_NO_GPS_QUALITY && !(latitude === 0 && longitude === 0);

  return {
    kind,
    externalId,
    alias,
    label,
    occurredAt: parseHunterDate(body.FechaHora),
    latitude,
    longitude,
    speedKph: Math.round(speedMph * MPH_TO_KPH * 100) / 100,
    heading,
    altitudeMeters: int(body, 'Altitud'),
    satellites: int(body, 'NumeroSatelites'),
    gpsQuality,
    ignition: ignitionRaw === null ? null : ignitionRaw === 1,
    eventCode: kind === 'EVENT' ? int(body, 'Evento') : null,
    occurrenceCode: kind === 'EVENT' ? int(body, 'Suceso') : null,
    description: kind === 'ALERT' ? text(body, 'Descripcion') : null,
    address: text(body, 'Calle'),
    hasValidPosition,
    raw: body,
  };
}

/** Clave de idempotencia: un reenvío idéntico del proveedor no crea un segundo punto. */
export function trackingDedupKey(report: NormalizedTrackingReport): string {
  return [
    report.kind,
    report.occurredAt.toISOString(),
    report.eventCode ?? '',
    report.occurrenceCode ?? '',
    report.description ?? '',
  ].join('|');
}

/** El cuerpo puede llegar como objeto, como lista de objetos o como texto JSON. */
export function coerceHunterBody(body: unknown): unknown[] {
  let value = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw new HunterPayloadError('Body is not valid JSON');
    }
  }
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  throw new HunterPayloadError('Body is empty');
}
