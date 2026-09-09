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

export function formatSidebarCountdown(parts: CountdownParts): string {
  if (parts.complete) {
    return "ถึงเวลาแล้ว";
  }
  if (parts.days > 0) {
    return `${parts.days} วัน ${parts.hours} ชม.`;
  }
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}

/** Mount a self-updating inline timer and return its cleanup function. */
interface InlineCountdownOptions {
  onActivate?: () => void;
}

export function mountInlineCountdown(
  element: HTMLElement,
  target: Date,
  options: InlineCountdownOptions = {},
): () => void {
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

  const activate = (): void => options.onActivate?.();
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    activate();
  };

  if (options.onActivate) {
    element.classList.add("is-interactive");
    element.setAttribute("role", "button");
    element.tabIndex = 0;
    element.addEventListener("click", activate);
    element.addEventListener("keydown", handleKeyDown);
  }

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
    element.setAttribute(
      "aria-label",
      options.onActivate
        ? `แก้ไข countdown เหลือเวลา ${value.textContent}`
        : `นับถอยหลัง ${value.textContent}`,
    );

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
    element.removeEventListener("click", activate);
    element.removeEventListener("keydown", handleKeyDown);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
    }
  };
}
