import { formatTime, formatDate } from "./datetime";

describe("formatTime", () => {
  it("formats an ISO datetime to local HH:MM", () => {
    const iso = new Date(2026, 7, 27, 7, 15, 0).toISOString();
    expect(formatTime(iso)).toBe("07:15");
  });

  it("returns null for null/undefined input", () => {
    expect(formatTime(null)).toBeNull();
    expect(formatTime(undefined)).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(formatTime("not-a-date")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats an ISO datetime to a friendly date", () => {
    const iso = new Date(2026, 7, 27, 12, 0, 0).toISOString();
    expect(formatDate(iso)).toBe("27 ago 2026");
  });

  it("returns null for null/undefined input", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate(undefined)).toBeNull();
  });

  it("returns null for invalid dates", () => {
    expect(formatDate("invalid")).toBeNull();
  });
});