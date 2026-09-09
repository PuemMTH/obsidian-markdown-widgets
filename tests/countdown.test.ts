import { describe, expect, it } from "vitest";
import { CountdownConfigError } from "../src/widgets/countdown/model";
import { parseCountdownConfig } from "../src/widgets/countdown/parser";
import { calculateCountdown } from "../src/widgets/countdown/time";

describe("parseCountdownConfig", () => {
  it("parses a complete countdown block", () => {
    const config = parseCountdownConfig(`
      title: ส่งวิทยานิพนธ์
      date: 2026-12-31T23:59:59+07:00
      done: ส่งแล้ว!
      locale: th-TH
    `);

    expect(config.title).toBe("ส่งวิทยานิพนธ์");
    expect(config.target.toISOString()).toBe("2026-12-31T16:59:59.000Z");
    expect(config.doneMessage).toBe("ส่งแล้ว!");
    expect(config.locale).toBe("th-TH");
  });

  it("supports a date-only shorthand", () => {
    const config = parseCountdownConfig("2026-12-31T23:59:59+07:00");
    expect(config.target.toISOString()).toBe("2026-12-31T16:59:59.000Z");
  });

  it("accepts target as an alias for date", () => {
    const config = parseCountdownConfig("target: 2026-12-31T23:59:59Z");
    expect(config.target.toISOString()).toBe("2026-12-31T23:59:59.000Z");
  });

  it("reports an unknown option instead of silently ignoring a typo", () => {
    expect(() =>
      parseCountdownConfig("date: 2026-12-31T23:59:59Z\ntitel: Typo"),
    ).toThrowError(CountdownConfigError);
  });
});

describe("calculateCountdown", () => {
  it("splits the remaining time into days, hours, minutes and seconds", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const target = new Date("2026-01-03T03:04:05Z");

    expect(calculateCountdown(target, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      seconds: 5,
      complete: false,
    });
  });

  it("stops at zero after the target time", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    const target = new Date("2026-01-01T00:00:00Z");

    expect(calculateCountdown(target, now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      complete: true,
    });
  });
});
