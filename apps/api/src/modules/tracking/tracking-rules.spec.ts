import { classifyFreshness, liveBusPhase, positionAgeSeconds } from './tracking-freshness';
import { shouldAutoStart } from './operations-auto-run.service';
import type { VehiclePosition } from './tracking.service';

const now = new Date('2026-10-15T15:00:00Z');
const thresholds = { liveSeconds: 120, staleSeconds: 900 };
const position = (overrides: Partial<VehiclePosition> = {}): VehiclePosition => ({
  deviceId: 'd',
  latitude: -2.1,
  longitude: -79.9,
  speedKph: 0,
  heading: null,
  ignition: true,
  gpsQuality: 1,
  occurredAt: now,
  receivedAt: now,
  ageSeconds: 10,
  freshness: 'LIVE',
  ...overrides,
});

describe('freshness', () => {
  it('classifies by age', () => {
    expect(classifyFreshness(30, thresholds)).toBe('LIVE');
    expect(classifyFreshness(600, thresholds)).toBe('STALE');
    expect(classifyFreshness(901, thresholds)).toBe('OFFLINE');
    expect(classifyFreshness(null, thresholds)).toBe('OFFLINE');
  });
  it('uses the reception time when the device clock is ahead', () => {
    const future = new Date(now.getTime() + 60_000);
    expect(positionAgeSeconds(future, new Date(now.getTime() - 5_000), now)).toBe(5);
    expect(positionAgeSeconds(new Date(now.getTime() - 42_000), null, now)).toBe(42);
  });
});

describe('liveBusPhase', () => {
  const at = (minutesFromNow: number) => new Date(now.getTime() + minutesFromNow * 60_000);
  it('opens the map 30 min before departure and closes it at the planned end', () => {
    expect(liveBusPhase({ plannedStartAt: at(45), plannedEndAt: at(105), runStatus: null }, now)).toBe('NOT_LIVE');
    expect(liveBusPhase({ plannedStartAt: at(20), plannedEndAt: at(80), runStatus: null }, now)).toBe('BEFORE_START');
    expect(liveBusPhase({ plannedStartAt: at(-90), plannedEndAt: at(-10), runStatus: null }, now)).toBe('NOT_LIVE');
  });
  it('follows the run state', () => {
    expect(liveBusPhase({ plannedStartAt: at(-90), plannedEndAt: at(-10), runStatus: 'IN_PROGRESS' }, now)).toBe('IN_PROGRESS');
    expect(liveBusPhase({ plannedStartAt: at(5), plannedEndAt: at(60), runStatus: 'COMPLETED' }, now)).toBe('NOT_LIVE');
  });
});

describe('shouldAutoStart', () => {
  it('never starts when disabled and always on schedule mode', () => {
    expect(shouldAutoStart('off', position())).toBe(false);
    expect(shouldAutoStart('schedule', null)).toBe(true);
  });
  it('requires a live GPS with ignition or movement in schedule_with_gps mode', () => {
    expect(shouldAutoStart('schedule_with_gps', null)).toBe(false);
    expect(shouldAutoStart('schedule_with_gps', position({ freshness: 'STALE' }))).toBe(false);
    expect(shouldAutoStart('schedule_with_gps', position({ ignition: false, speedKph: 0 }))).toBe(false);
    expect(shouldAutoStart('schedule_with_gps', position({ ignition: null, speedKph: 12 }))).toBe(true);
    expect(shouldAutoStart('schedule_with_gps', position())).toBe(true);
  });
});
