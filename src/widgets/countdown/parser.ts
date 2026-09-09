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

function parseDate(value: string): Date {
  // Normalize a friendly local form while retaining ISO offsets such as +07:00.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(value)
    ? value.replace(" ", "T")
    : value;
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
      target: parseDate(unwrapQuotes(meaningfulLines[0])),
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
    target: parseDate(dateValue),
    doneMessage: values.get("done") || "Time reached!",
    locale: values.get("locale") || "th-TH",
  };
}
