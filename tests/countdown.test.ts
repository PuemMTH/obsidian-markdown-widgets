import { describe, expect, it } from "vitest";
import { CountdownConfigError } from "../src/widgets/countdown/model";
import { parseCountdownConfig } from "../src/widgets/countdown/parser";
import { calculateCountdown } from "../src/widgets/countdown/time";
import { findInlineCountdownTokens } from "../src/widgets/countdown/inline-syntax";
import {
  formatInlineCountdown,
  formatSidebarCountdown,
} from "../src/widgets/countdown/inline-renderer";
import {
  toLocalDateTimeInputValue,
  toLocalIsoWithOffset,
} from "../src/widgets/countdown/time";
import {
  groupCountdownSidebarEntries,
  parseCountdownSidebarEntries,
  sortCountdownSidebarEntries,
} from "../src/sidebar/countdown-sidebar-model";
import {
  parseSmartDateTime,
  SmartDateTimeParseError,
} from "../src/widgets/countdown/smart-date-time";

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

describe("countdown date/time picker values", () => {
  it("formats the native picker value using local calendar fields", () => {
    const target = new Date(2026, 11, 31, 18, 30, 45);
    expect(toLocalDateTimeInputValue(target)).toBe("2026-12-31T18:30:45");
  });

  it("serializes the picked local time with an explicit timezone offset", () => {
    const target = new Date(2026, 11, 31, 18, 30, 45);
    const serialized = toLocalIsoWithOffset(target);

    expect(serialized).toMatch(/^2026-12-31T18:30:45[+-]\d{2}:\d{2}$/u);
    expect(new Date(serialized).getTime()).toBe(target.getTime());
  });
});

describe("smart date/time input", () => {
  const now = new Date(2026, 8, 9, 14, 37, 45);

  it.each([
    ["วันนี้ 18:30", 9, 18, 30],
    ["today at 18:30", 9, 18, 30],
    ["พรุ่งนี้", 10, 14, 37],
    ["tomorrow", 10, 14, 37],
    ["มะรืน 09:15", 11, 9, 15],
    ["day after tomorrow 09:15", 11, 9, 15],
  ])("parses named day %s", (input, day, hour, minute) => {
    const target = parseSmartDateTime(input, now);
    expect([target.getDate(), target.getHours(), target.getMinutes(), target.getSeconds()]).toEqual([
      day,
      hour,
      minute,
      0,
    ]);
  });

  it.each([
    ["+30m", 9, 15, 7],
    ["+2h", 9, 16, 37],
    ["+3d", 12, 14, 37],
    ["+1w 09:15", 16, 9, 15],
    ["+3 วัน 18:30", 12, 18, 30],
  ])("parses relative value %s", (input, day, hour, minute) => {
    const target = parseSmartDateTime(input, now);
    expect([target.getDate(), target.getHours(), target.getMinutes(), target.getSeconds()]).toEqual([
      day,
      hour,
      minute,
      0,
    ]);
  });

  it("uses the current local time for an absolute date without a time", () => {
    const target = parseSmartDateTime("2026-12-31", now);
    expect([
      target.getFullYear(),
      target.getMonth(),
      target.getDate(),
      target.getHours(),
      target.getMinutes(),
      target.getSeconds(),
    ]).toEqual([2026, 11, 31, 14, 37, 0]);
  });

  it("rejects invalid dates and unsupported natural language", () => {
    expect(() => parseSmartDateTime("2026-02-30", now)).toThrowError(
      SmartDateTimeParseError,
    );
    expect(() => parseSmartDateTime("next Friday", now)).toThrowError(
      SmartDateTimeParseError,
    );
  });
});

describe("countdown sidebar", () => {
  it("uses the rest of the line as the sidebar label", () => {
    const entries = parseCountdownSidebarEntries(
      "Projects/Thesis.md",
      "Thesis",
      "- [ ] ส่งวิทยานิพนธ์ %{count: 2026-12-31T18:30:00+07:00}% ก่อนปิดระบบ",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      path: "Projects/Thesis.md",
      fileName: "Thesis",
      line: 0,
      label: "ส่งวิทยานิพนธ์ ก่อนปิดระบบ",
      groupLabel: "Thesis",
    });
  });

  it("falls back to the file name when the placeholder is alone", () => {
    const [entry] = parseCountdownSidebarEntries(
      "Projects/Thesis.md",
      "Thesis",
      "%{count: 2026-12-31}%",
    );
    expect(entry.label).toBe("Thesis");
  });

  it("sorts upcoming targets nearest first and completed targets last", () => {
    const source = [
      "ผ่านแล้ว %{count: 2026-01-01T00:00:00Z}%",
      "ไกล %{count: 2026-01-04T00:00:00Z}%",
      "ใกล้ %{count: 2026-01-03T00:00:00Z}%",
    ].join("\n");
    const entries = parseCountdownSidebarEntries("Plan.md", "Plan", source);
    const sorted = sortCountdownSidebarEntries(
      entries,
      new Date("2026-01-02T00:00:00Z").getTime(),
    );

    expect(sorted.map((entry) => entry.label)).toEqual(["ใกล้", "ไกล", "ผ่านแล้ว"]);
  });

  it("groups by file and nearest preceding heading", () => {
    const source = [
      "### Silicosis",
      "- %{count: 2026-09-21}% Thesis",
      "- %{count: 2026-09-18}% Slide Machine Learning",
      "### NECTEC",
      "- %{count: 2026-09-15}% SQUAT",
    ].join("\n");
    const entries = parseCountdownSidebarEntries("Time.md", "Time", source);
    const groups = groupCountdownSidebarEntries(
      entries,
      new Date("2026-09-09T00:00:00").getTime(),
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Time › NECTEC",
      "Time › Silicosis",
    ]);
    expect(groups[1].entries.map((entry) => entry.label)).toEqual([
      "Slide Machine Learning",
      "Thesis",
    ]);
  });

  it("keeps matching headings from different files in separate groups", () => {
    const first = parseCountdownSidebarEntries(
      "First.md",
      "First",
      "## Tasks\nA %{count: 2026-09-11}%",
    );
    const second = parseCountdownSidebarEntries(
      "Second.md",
      "Second",
      "## Tasks\nB %{count: 2026-09-12}%",
    );
    const groups = groupCountdownSidebarEntries([...first, ...second]);
    expect(groups.map((group) => group.label).sort()).toEqual([
      "First › Tasks",
      "Second › Tasks",
    ]);
  });

  it("ignores placeholders inside fenced and inline code", () => {
    const source = [
      "## Visible",
      "real %{count: 2026-09-11}%",
      "`inline %{count: 2026-09-12}%`",
      "```md",
      "hidden %{count: 2026-09-13}%",
      "```",
      "after %{count: 2026-09-14}%",
    ].join("\n");
    const entries = parseCountdownSidebarEntries("Plan.md", "Plan", source);
    expect(entries.map((entry) => entry.label)).toEqual(["real", "after"]);
  });

  it("formats sidebar countdowns adaptively", () => {
    expect(
      formatSidebarCountdown({
        days: 4,
        hours: 9,
        minutes: 47,
        seconds: 53,
        complete: false,
      }),
    ).toBe("4 วัน 9 ชม.");
    expect(
      formatSidebarCountdown({
        days: 0,
        hours: 9,
        minutes: 47,
        seconds: 53,
        complete: false,
      }),
    ).toBe("09:47:53");
    expect(
      formatSidebarCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        complete: true,
      }),
    ).toBe("ถึงเวลาแล้ว");
  });
});
