const GUAYAQUIL_UTC_OFFSET_MINUTES = 5 * 60;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PlannedWindow = {
  plannedStartAt: Date;
  plannedEndAt: Date;
};

export const civilDateToIso = (value: Date): string => value.toISOString().slice(0, 10);

export const parseCivilDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return civilDateToIso(date) === value ? date : null;
};

export const guayaquilToday = (now: Date = new Date()): string =>
  new Date(now.getTime() - GUAYAQUIL_UTC_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);

export const nextCivilDate = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1));

export const calculatePlannedWindow = (
  serviceDate: Date,
  scheduledTime: Date,
  maximumOffsetMinutes: number,
): PlannedWindow | null => {
  if (!Number.isInteger(maximumOffsetMinutes) || maximumOffsetMinutes <= 0) return null;

  const plannedStartAt = new Date(
    Date.UTC(
      serviceDate.getUTCFullYear(),
      serviceDate.getUTCMonth(),
      serviceDate.getUTCDate(),
      scheduledTime.getUTCHours(),
      scheduledTime.getUTCMinutes(),
      scheduledTime.getUTCSeconds(),
    ) + GUAYAQUIL_UTC_OFFSET_MINUTES * 60_000,
  );
  const plannedEndAt = new Date(plannedStartAt.getTime() + maximumOffsetMinutes * 60_000);

  return { plannedStartAt, plannedEndAt };
};
