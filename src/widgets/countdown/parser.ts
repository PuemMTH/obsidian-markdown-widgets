import { CountdownConfig, CountdownConfigError } from "./model";

const SUPPORTED_KEYS = new Set(["date", "target", "title", "done", "locale"]);

function unwrapQuotes(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value.at(0);
  const last = value.at(-1);
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseCountdownTarget(value: string): Date {
  const input = unwrapQuotes(value.trim());
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:(?:T| )(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?)?$/u.exec(
    input,
  );

  if (!match) {
    throw new CountdownConfigError(
      `Invalid date "${value}". Use an ISO date such as 2026-12-31T23:59:59+07:00.`,
    );
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText ?? 0);
  const minute = Number(minuteText ?? 0);
  const second = Number(secondText ?? 0);
  const offsetHour = Number(offsetHourText ?? 0);
  const offsetMinute = Number(offsetMinuteText ?? 0);
  const lastDayOfMonth =
    month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;

  if (
    day < 1 ||
    day > lastDayOfMonth ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw new CountdownConfigError(`Invalid calendar date or time "${value}".`);
  }

  // A date without a time means midnight in the device's local timezone.
  const normalized = hourText ? input.replace(" ", "T") : `${input}T00:00:00`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new CountdownConfigError(
      `Invalid date "${value}". Use an ISO date such as 2026-12-31T23:59:59+07:00.`,
    );
  }

  return date;
}

export function parseCountdownConfig(source: string): CountdownConfig {
  const meaningfulLines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (meaningfulLines.length === 0) {
    throw new CountdownConfigError("Countdown needs a date.");
  }

  // Shorthand: a code block containing only an ISO date.
  if (meaningfulLines.length === 1 && !/^[a-z][\w-]*\s*:/iu.test(meaningfulLines[0])) {
    return {
      title: "Countdown",
      target: parseCountdownTarget(meaningfulLines[0]),
      doneMessage: "Time reached!",
      locale: "th-TH",
    };
  }

  const values = new Map<string, string>();
  for (const line of meaningfulLines) {
    const match = /^([a-z][\w-]*)\s*:\s*(.*)$/iu.exec(line);
    if (!match) {
      throw new CountdownConfigError(`Invalid line: "${line}". Expected key: value.`);
    }

    const key = match[1].toLowerCase();
    if (!SUPPORTED_KEYS.has(key)) {
      throw new CountdownConfigError(`Unknown option "${key}".`);
    }

    values.set(key, unwrapQuotes(match[2].trim()));
  }

  const dateValue = values.get("date") ?? values.get("target");
  if (!dateValue) {
    throw new CountdownConfigError('Missing "date" option.');
  }

  return {
    title: values.get("title") || "Countdown",
    target: parseCountdownTarget(dateValue),
    doneMessage: values.get("done") || "Time reached!",
    locale: values.get("locale") || "th-TH",
  };
}
