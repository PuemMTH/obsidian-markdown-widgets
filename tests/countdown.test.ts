import { describe, expect, it } from "vitest";
import { CountdownConfigError } from "../src/widgets/countdown/model";
import { parseCountdownConfig } from "../src/widgets/countdown/parser";
import { calculateCountdown } from "../src/widgets/countdown/time";
import { findInlineCountdownTokens } from "../src/widgets/countdown/inline-syntax";
import { formatInlineCountdown } from "../src/widgets/countdown/inline-renderer";

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

  it("rejects calendar dates that JavaScript would otherwise roll forward", () => {
    expect(() => parseCountdownConfig("2026-02-30T12:00:00+07:00")).toThrowError(
      CountdownConfigError,
    );
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

describe("inline countdown placeholders", () => {
  it("finds multiple valid placeholders with document positions", () => {
    const text =
      "เริ่ม %{count: 2026-12-31}% และ %{count: 2027-01-01T00:00:00+07:00}%";
    const tokens = findInlineCountdownTokens(text, 10);

    expect(tokens).toHaveLength(2);
    expect(tokens[0].from).toBe(16);
    expect(tokens[0].expression).toBe("2026-12-31");
    expect(tokens[1].target.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("leaves incomplete or invalid placeholders as plain text", () => {
    expect(findInlineCountdownTokens("%{count: day or time}%")).toEqual([]);
    expect(findInlineCountdownTokens("%{count: 2026-12")).toEqual([]);
  });

  it("formats days and clock time compactly", () => {
    expect(
      formatInlineCountdown({
        days: 2,
        hours: 3,
        minutes: 4,
        seconds: 5,
        complete: false,
      }),
    ).toBe("2 วัน 03:04:05");
  });
});
