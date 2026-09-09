import { CountdownParts } from "./model";

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateTimeInputValue(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function toLocalIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainder = absoluteOffset % 60;

  return `${toLocalDateTimeInputValue(date)}${sign}${pad(offsetHours)}:${pad(offsetRemainder)}`;
}

export function calculateCountdown(target: Date, now = new Date()): CountdownParts {
  const differenceMs = target.getTime() - now.getTime();
  const complete = differenceMs <= 0;
  let remainingSeconds = complete ? 0 : Math.ceil(differenceMs / 1_000);

  const days = Math.floor(remainingSeconds / SECONDS_PER_DAY);
  remainingSeconds %= SECONDS_PER_DAY;

  const hours = Math.floor(remainingSeconds / SECONDS_PER_HOUR);
  remainingSeconds %= SECONDS_PER_HOUR;

  const minutes = Math.floor(remainingSeconds / SECONDS_PER_MINUTE);
  const seconds = remainingSeconds % SECONDS_PER_MINUTE;

  return { days, hours, minutes, seconds, complete };
}
