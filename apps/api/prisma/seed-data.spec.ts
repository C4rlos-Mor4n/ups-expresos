import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAllowedDomains, getDemoCatalog, shouldIncludeDemoData } from './seed-data';

test('shouldIncludeDemoData enables demo data by default outside production', () => {
  assert.equal(shouldIncludeDemoData('development', undefined), true);
  assert.equal(shouldIncludeDemoData('test', undefined), true);
});

test('shouldIncludeDemoData disables demo data by default in production unless explicitly enabled', () => {
  assert.equal(shouldIncludeDemoData('production', undefined), false);
  assert.equal(shouldIncludeDemoData('production', 'false'), false);
  assert.equal(shouldIncludeDemoData('production', 'true'), true);
  assert.equal(shouldIncludeDemoData('production', '1'), true);
});

test('buildAllowedDomains normalizes comma-separated domains and removes empties', () => {
  assert.deepEqual(buildAllowedDomains(' ups.edu.ec, gmail.com ,, est.ups.edu.ec '), [
    'ups.edu.ec',
    'gmail.com',
    'est.ups.edu.ec',
  ]);
});

test('getDemoCatalog returns enough demo data to visualize the API', () => {
  const catalog = getDemoCatalog();

  assert.ok(catalog.users.length >= 12);
  assert.ok(catalog.routes.length >= 7);
  assert.ok(catalog.stops.length >= 12);
  assert.ok(catalog.routeStops.length >= 30);
  assert.ok(catalog.schedules.length >= 70);
  assert.ok(catalog.vehicles.length >= 5);
  assert.ok(catalog.drivers.length >= 5);
  assert.ok(catalog.notices.length >= 6);
  assert.ok(catalog.tripFeedbacks.length >= 12);
});

test('all seeded stops use real Guayaquil corridor coordinates', () => {
  const catalog = getDemoCatalog();

  for (const stop of catalog.stops) {
    assert.ok(stop.latitude >= -2.3 && stop.latitude <= -2.05, `${stop.name} latitude must be in Guayaquil`);
    assert.ok(stop.longitude >= -80.1 && stop.longitude <= -79.8, `${stop.name} longitude must be in Guayaquil`);
  }

  const centenario = catalog.stops.find((stop) => stop.key === 'ups-centenario');
  const mariaAuxiliadora = catalog.stops.find((stop) => stop.key === 'ups-maria-auxiliadora');

  assert.deepEqual(
    centenario && { latitude: centenario.latitude, longitude: centenario.longitude },
    { latitude: -2.2206355, longitude: -79.886659 },
  );
  assert.deepEqual(
    mariaAuxiliadora && { latitude: mariaAuxiliadora.latitude, longitude: mariaAuxiliadora.longitude },
    { latitude: -2.1918485, longitude: -80.0458099 },
  );
});

test('seeded routes reference valid ordered stops and one of the UPS Guayaquil campuses', () => {
  const catalog = getDemoCatalog();
  const routeKeys = new Set(catalog.routes.map((route) => route.key));
  const stopKeys = new Set(catalog.stops.map((stop) => stop.key));
  const campusStopKeys = new Set(['ups-centenario', 'ups-maria-auxiliadora']);

  for (const route of catalog.routes) {
    const stops = catalog.routeStops
      .filter((routeStop) => routeStop.routeKey === route.key)
      .sort((a, b) => a.stopOrder - b.stopOrder);

    assert.ok(stops.length >= 4, `${route.name} must include at least four real stops`);
    assert.deepEqual(
      stops.map((routeStop) => routeStop.stopOrder),
      stops.map((_, index) => index + 1),
      `${route.name} stop order must be contiguous`,
    );
    assert.equal(stops[0]?.estimatedArrivalMinutes, 0, `${route.name} must begin at minute zero`);
    assert.ok(
      stops.some((routeStop) => campusStopKeys.has(routeStop.stopKey)),
      `${route.name} must connect to a UPS Guayaquil campus`,
    );

    for (let index = 0; index < stops.length; index += 1) {
      const routeStop = stops[index];
      assert.ok(routeStop && stopKeys.has(routeStop.stopKey), `${route.name} contains an unknown stop`);
      if (index > 0) {
        assert.ok(
          routeStop && routeStop.estimatedArrivalMinutes > stops[index - 1]!.estimatedArrivalMinutes,
          `${route.name} estimated arrival minutes must increase`,
        );
      }
    }
  }

  for (const schedule of catalog.schedules) assert.ok(routeKeys.has(schedule.routeKey));
  for (const driver of catalog.drivers) assert.ok(routeKeys.has(driver.assignedRouteKey));
  for (const feedback of catalog.tripFeedbacks) assert.ok(routeKeys.has(feedback.routeKey));
});
