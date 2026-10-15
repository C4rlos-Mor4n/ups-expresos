import {
  coerceHunterBody,
  HunterPayloadError,
  normalizeHunterPayload,
  parseHunterDate,
  trackingDedupKey,
} from './hunter-payload';

// Ejemplos tomados literalmente del PDF "DataForward - Definiciones".
const EVENT_EXAMPLE = {
  AliasEtiqueta: 'GSK6748/JNEIRA',
  FechaHora: '20221027 17:58:08',
  Id: 4631511939,
  Evento: 1,
  Suceso: 0,
  Latitud: -2.1528408527374268,
  Longitud: -79.89356231689453,
  Calle: '3 Callejon 14A NE,Guayaquil,Guayaquil,Guayas',
  NumeroSatelites: 13,
  CalidadGPS: 1,
  EstadoIgnicion: 0,
  Velocidad: 0.0,
  Rumbo: 213,
  Altitud: 29,
  VoltajeAlimentacion: 12.432999610900879,
  VoltajeBateriaDispositivo: 3.687999963760376,
  Odometro: 177808944,
  Horometro: 5887044,
  CheckEngineCAN: false,
};

const ALERT_EXAMPLE = {
  FechaHora: '20200328 13:11:52',
  IdActivo: 4631511939,
  Alias: 'GSK6748',
  Etiqueta: 'Movil',
  Descripcion: 'ALERTA EXCESO DE VELOCIDAD',
  Latitud: -2.03535556793213,
  Longitud: -79.8940963745117,
  NumeroSatelites: 12,
  EstadoGPS: 1,
  EstadoIgnicion: 0,
  Velocidad: 0,
  Rumbo: 0,
  Altitud: 4,
  NivelBateriaDispositivo: 80,
};

describe('parseHunterDate', () => {
  it('reads yyyyMMdd HH:mm:ss as UTC', () => {
    expect(parseHunterDate('20221027 17:58:08').toISOString()).toBe('2022-10-27T17:58:08.000Z');
  });
  it('accepts ISO-8601 with zone', () => {
    expect(parseHunterDate('2026-10-15T12:00:00Z').toISOString()).toBe('2026-10-15T12:00:00.000Z');
  });
  it.each(['20221345 10:00:00', '20220230 10:00:00', '2022-10-27 17:58', '', 'x'])('rejects %p', (value) => {
    expect(() => parseHunterDate(value)).toThrow(HunterPayloadError);
  });
});

describe('normalizeHunterPayload', () => {
  it('normalizes the documented event example', () => {
    const r = normalizeHunterPayload(EVENT_EXAMPLE);
    expect(r).toMatchObject({
      kind: 'EVENT',
      externalId: '4631511939',
      alias: 'GSK6748',
      label: 'JNEIRA',
      latitude: -2.1528408527374268,
      speedKph: 0,
      heading: 213,
      altitudeMeters: 29,
      satellites: 13,
      gpsQuality: 1,
      ignition: false,
      eventCode: 1,
      occurrenceCode: 0,
      address: '3 Callejon 14A NE,Guayaquil,Guayaquil,Guayas',
      hasValidPosition: true,
    });
    expect(r.occurredAt.toISOString()).toBe('2022-10-27T17:58:08.000Z');
  });

  it('normalizes the documented alert example', () => {
    const r = normalizeHunterPayload(ALERT_EXAMPLE);
    expect(r).toMatchObject({
      kind: 'ALERT',
      externalId: '4631511939',
      alias: 'GSK6748',
      label: 'Movil',
      description: 'ALERTA EXCESO DE VELOCIDAD',
      heading: null,
      gpsQuality: 1,
      eventCode: null,
    });
  });

  it('converts mph to km/h once', () => {
    expect(normalizeHunterPayload({ ...EVENT_EXAMPLE, Velocidad: 30 }).speedKph).toBe(48.28);
  });

  it('maps Rumbo 360 to north (0) and 0 to unknown', () => {
    expect(normalizeHunterPayload({ ...EVENT_EXAMPLE, Rumbo: 360 }).heading).toBe(0);
    expect(normalizeHunterPayload({ ...EVENT_EXAMPLE, Rumbo: 0 }).heading).toBeNull();
  });

  it('marks reports without GPS as having no valid position', () => {
    expect(normalizeHunterPayload({ ...EVENT_EXAMPLE, CalidadGPS: 9 }).hasValidPosition).toBe(false);
    expect(
      normalizeHunterPayload({ ...EVENT_EXAMPLE, Latitud: 0, Longitud: 0 }).hasValidPosition,
    ).toBe(false);
  });

  it('accepts numeric fields sent as strings', () => {
    const r = normalizeHunterPayload({ ...EVENT_EXAMPLE, Latitud: '-2.1', Velocidad: '10' });
    expect(r.latitude).toBe(-2.1);
    expect(r.speedKph).toBe(16.09);
  });

  it.each([
    ['missing Id', { ...EVENT_EXAMPLE, Id: undefined }],
    ['latitude out of range', { ...EVENT_EXAMPLE, Latitud: 120 }],
    ['negative speed', { ...EVENT_EXAMPLE, Velocidad: -1 }],
    ['non numeric longitude', { ...EVENT_EXAMPLE, Longitud: 'abc' }],
    ['bad date', { ...EVENT_EXAMPLE, FechaHora: 'ayer' }],
    ['unsafe identifier', { ...EVENT_EXAMPLE, Id: 'a b<c>' }],
  ])('rejects %s', (_label, body) => {
    expect(() => normalizeHunterPayload(body)).toThrow(HunterPayloadError);
  });

  it('enforces the expected kind on dedicated endpoints', () => {
    expect(() => normalizeHunterPayload(ALERT_EXAMPLE, 'EVENT')).toThrow(HunterPayloadError);
  });
});

describe('trackingDedupKey / coerceHunterBody', () => {
  it('is stable for resends and different for another report', () => {
    const a = normalizeHunterPayload(EVENT_EXAMPLE);
    expect(trackingDedupKey(a)).toBe(trackingDedupKey(normalizeHunterPayload({ ...EVENT_EXAMPLE })));
    expect(trackingDedupKey(a)).not.toBe(
      trackingDedupKey(normalizeHunterPayload({ ...EVENT_EXAMPLE, Suceso: 7 })),
    );
  });

  it('accepts an object, a list or JSON text', () => {
    expect(coerceHunterBody(EVENT_EXAMPLE)).toHaveLength(1);
    expect(coerceHunterBody([EVENT_EXAMPLE, ALERT_EXAMPLE])).toHaveLength(2);
    expect(coerceHunterBody(JSON.stringify(EVENT_EXAMPLE))).toHaveLength(1);
    expect(() => coerceHunterBody('not json')).toThrow(HunterPayloadError);
  });
});
