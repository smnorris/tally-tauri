import { describe, it, expect } from "vitest";
import { fmtISO, getMonday, addDays, getCurrentMonthRange, getPreviousMonthRange } from "../App.jsx";

describe("fmtISO", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026
    expect(fmtISO(d)).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 8, 1); // Sep 1, 2026
    expect(fmtISO(d)).toBe("2026-09-01");
  });
});

describe("getMonday", () => {
  it("returns the same date when given a Monday", () => {
    const monday = new Date(2026, 7, 3); // Aug 3, 2026 is a Monday
    expect(monday.getDay()).toBe(1);
    expect(fmtISO(getMonday(monday))).toBe(fmtISO(monday));
  });

  it("rolls forward to Monday when given a mid-week date", () => {
    const wednesday = new Date(2026, 7, 5); // Aug 5, 2026 is a Wednesday
    const result = getMonday(wednesday);
    expect(result.getDay()).toBe(1);
    expect(fmtISO(result)).toBe("2026-08-03");
  });

  it("rolls back to Monday when given a Sunday", () => {
    const sunday = new Date(2026, 7, 9); // Aug 9, 2026 is a Sunday
    expect(fmtISO(getMonday(sunday))).toBe("2026-08-03");
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const d = new Date(2026, 7, 3);
    expect(fmtISO(addDays(d, 4))).toBe("2026-08-07");
  });

  it("adds negative days", () => {
    const d = new Date(2026, 7, 3);
    expect(fmtISO(addDays(d, -7))).toBe("2026-07-27");
  });

  it("rolls over a month boundary", () => {
    const d = new Date(2026, 7, 30); // Aug 30, 2026
    expect(fmtISO(addDays(d, 3))).toBe("2026-09-02");
  });
});

describe("getCurrentMonthRange", () => {
  it("returns the first and last day of a 28-day February", () => {
    // 2026 is not a leap year.
    const range = getCurrentMonthRange(new Date(2026, 1, 15));
    expect(range.from).toBe("2026-02-01");
    expect(range.to).toBe("2026-02-28");
  });

  it("handles a 31-day month", () => {
    const range = getCurrentMonthRange(new Date(2026, 7, 12)); // August
    expect(range.from).toBe("2026-08-01");
    expect(range.to).toBe("2026-08-31");
  });

  it("handles December without rolling the year forward", () => {
    const range = getCurrentMonthRange(new Date(2026, 11, 10));
    expect(range.from).toBe("2026-12-01");
    expect(range.to).toBe("2026-12-31");
  });
});

describe("getPreviousMonthRange", () => {
  it("returns the month before the given date", () => {
    const range = getPreviousMonthRange(new Date(2026, 7, 12)); // August -> July
    expect(range.from).toBe("2026-07-01");
    expect(range.to).toBe("2026-07-31");
  });

  it("rolls back across a year boundary from January", () => {
    const range = getPreviousMonthRange(new Date(2026, 0, 15)); // Jan -> Dec 2025
    expect(range.from).toBe("2025-12-01");
    expect(range.to).toBe("2025-12-31");
  });

  it("handles the previous month having fewer days than the current one", () => {
    // March 2026 -> February 2026 (28 days, non-leap year)
    const range = getPreviousMonthRange(new Date(2026, 2, 15));
    expect(range.from).toBe("2026-02-01");
    expect(range.to).toBe("2026-02-28");
  });
});
