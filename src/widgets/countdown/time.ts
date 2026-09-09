import { CountdownParts } from "./model";

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3_600;
const SECONDS_PER_MINUTE = 60;

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
