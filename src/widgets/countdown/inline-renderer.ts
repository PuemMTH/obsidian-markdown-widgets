import type { CountdownParts } from "./model";
import { calculateCountdown } from "./time";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatInlineCountdown(parts: CountdownParts): string {
  if (parts.complete) {
    return "ถึงเวลาแล้ว";
  }

  const clock = `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
  return parts.days > 0 ? `${parts.days} วัน ${clock}` : clock;
}

/** Mount a self-updating inline timer and return its cleanup function. */
export function mountInlineCountdown(element: HTMLElement, target: Date): () => void {
  let intervalId: number | undefined;

  element.classList.add("markdown-widgets-inline-countdown");
  element.setAttribute("role", "timer");
  element.setAttribute(
    "title",
    new Intl.DateTimeFormat("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(target),
  );

  const icon = element.ownerDocument.createElement("span");
  icon.className = "markdown-widgets-inline-countdown__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "◷";

  const value = element.ownerDocument.createElement("span");
  value.className = "markdown-widgets-inline-countdown__value";
  element.append(icon, value);

  const update = (): void => {
    const parts = calculateCountdown(target);
    value.textContent = formatInlineCountdown(parts);
    element.classList.toggle("is-complete", parts.complete);
    element.setAttribute("aria-label", `นับถอยหลัง ${value.textContent}`);

    if (parts.complete && intervalId !== undefined) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  update();
  if (target.getTime() > Date.now()) {
    intervalId = window.setInterval(update, 1_000);
  }

  return () => {
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  };
}
