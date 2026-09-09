export class SmartDateTimeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmartDateTimeParseError";
  }
}

const NAMED_DAY_OFFSETS = new Map<string, number>([
  ["วันนี้", 0],
  ["today", 0],
  ["พรุ่งนี้", 1],
  ["tomorrow", 1],
  ["มะรืน", 2],
  ["day after tomorrow", 2],
]);

const RELATIVE_UNIT_ALIASES = new Map<string, "minute" | "hour" | "day" | "week">([
  ["m", "minute"],
  ["min", "minute"],
  ["mins", "minute"],
  ["minute", "minute"],
  ["minutes", "minute"],
  ["นาที", "minute"],
  ["h", "hour"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hour", "hour"],
  ["hours", "hour"],
  ["ชั่วโมง", "hour"],
  ["d", "day"],
  ["day", "day"],
  ["days", "day"],
  ["วัน", "day"],
  ["w", "week"],
  ["week", "week"],
  ["weeks", "week"],
  ["สัปดาห์", "week"],
]);

function createRoundedNow(now: Date): Date {
  const result = new Date(now);
  result.setSeconds(0, 0);
  return result;
}

function parseClock(value: string | undefined): [number, number] | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})$/u.exec(value.trim());
  if (!match) {
    throw new SmartDateTimeParseError("เวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:mm เช่น 18:30");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new SmartDateTimeParseError("เวลาไม่ถูกต้อง กรุณาใช้ช่วง 00:00–23:59");
  }
  return [hour, minute];
}

function buildLocalDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    throw new SmartDateTimeParseError("วันที่หรือเวลาไม่ถูกต้อง");
  }
  return result;
}

function parseAbsoluteDate(input: string, now: Date): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:(?:T|\s+)(\d{1,2}):(\d{2})(?::\d{2})?)?$/u.exec(
    input,
  );
  if (!match) {
    return null;
  }

  const hour = match[4] === undefined ? now.getHours() : Number(match[4]);
  const minute = match[5] === undefined ? now.getMinutes() : Number(match[5]);
  return buildLocalDate(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    hour,
    minute,
  );
}

function parseNamedDay(input: string, now: Date): Date | null {
  for (const [name, dayOffset] of NAMED_DAY_OFFSETS) {
    if (input !== name && !input.startsWith(`${name} `)) {
      continue;
    }

    const clockText = input.slice(name.length).trim().replace(/^at\s+/u, "");
    const clock = parseClock(clockText || undefined);
    const result = createRoundedNow(now);
    result.setDate(result.getDate() + dayOffset);
    if (clock) {
      result.setHours(clock[0], clock[1], 0, 0);
    }
    return result;
  }
  return null;
}

function parseRelativeDate(input: string, now: Date): Date | null {
  const match = /^\+(\d+)\s*([a-z]+|นาที|ชั่วโมง|วัน|สัปดาห์)(?:\s+(?:at\s+)?(\d{1,2}:\d{2}))?$/u.exec(
    input,
  );
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = RELATIVE_UNIT_ALIASES.get(match[2]);
  if (!unit || amount <= 0) {
    throw new SmartDateTimeParseError("ระยะเวลาไม่ถูกต้อง ตัวอย่างที่รองรับ: +30m, +2h, +3d, +1w");
  }

  if ((unit === "minute" || unit === "hour") && match[3]) {
    throw new SmartDateTimeParseError("+นาที และ +ชั่วโมง ไม่สามารถระบุเวลาเพิ่มเติมได้");
  }

  const result = createRoundedNow(now);
  if (unit === "minute") {
    result.setMinutes(result.getMinutes() + amount);
  } else if (unit === "hour") {
    result.setHours(result.getHours() + amount);
  } else {
    result.setDate(result.getDate() + amount * (unit === "week" ? 7 : 1));
    const clock = parseClock(match[3]);
    if (clock) {
      result.setHours(clock[0], clock[1], 0, 0);
    }
  }
  return result;
}

/** Parse user-friendly date text into a fixed local Date. */
export function parseSmartDateTime(value: string, now = new Date()): Date {
  const input = value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
  if (!input) {
    throw new SmartDateTimeParseError("กรุณาระบุวันหรือเวลา");
  }

  const roundedNow = createRoundedNow(now);
  const target =
    parseAbsoluteDate(input, roundedNow) ??
    parseNamedDay(input, roundedNow) ??
    parseRelativeDate(input, roundedNow);

  if (!target) {
    throw new SmartDateTimeParseError(
      "ไม่เข้าใจรูปแบบนี้ ลองใช้ พรุ่งนี้ 18:30, tomorrow, +3d หรือ 2026-12-31 18:30",
    );
  }
  return target;
}
