import { MarkdownRenderChild, Plugin } from "obsidian";
import type { MarkdownWidget } from "../widget";
import { CountdownConfig, CountdownConfigError, CountdownParts } from "./model";
import { parseCountdownConfig } from "./parser";
import { calculateCountdown } from "./time";

const UNIT_LABELS = [
  ["days", "วัน"],
  ["hours", "ชั่วโมง"],
  ["minutes", "นาที"],
  ["seconds", "วินาที"],
] as const;

class CountdownRenderChild extends MarkdownRenderChild {
  private config: CountdownConfig | null = null;
  private valueElements: Partial<Record<keyof CountdownParts, HTMLElement>> = {};
  private statusElement: HTMLElement | null = null;
  private rootElement: HTMLElement | null = null;

  constructor(containerEl: HTMLElement, private readonly source: string) {
    super(containerEl);
  }

  onload(): void {
    this.containerEl.empty();

    try {
      this.config = parseCountdownConfig(this.source);
      this.buildCountdown();
      const alreadyComplete = this.updateCountdown();
      if (!alreadyComplete) {
        const intervalId = window.setInterval(() => {
          if (this.updateCountdown()) {
            window.clearInterval(intervalId);
          }
        }, 1_000);
        this.registerInterval(intervalId);
      }
    } catch (error) {
      this.renderError(error);
    }
  }

  private buildCountdown(): void {
    if (!this.config) {
      return;
    }

    const root = this.containerEl.createDiv({
      cls: "markdown-widgets-countdown",
      attr: { role: "timer" },
    });
    this.rootElement = root;

    root.createDiv({ cls: "markdown-widgets-countdown__title", text: this.config.title });

    const units = root.createDiv({ cls: "markdown-widgets-countdown__units" });
    for (const [key, label] of UNIT_LABELS) {
      const unit = units.createDiv({ cls: "markdown-widgets-countdown__unit" });
      this.valueElements[key] = unit.createDiv({
        cls: "markdown-widgets-countdown__value",
        text: "0",
      });
      unit.createDiv({ cls: "markdown-widgets-countdown__label", text: label });
    }

    const formattedTarget = new Intl.DateTimeFormat(this.config.locale, {
      dateStyle: "full",
      timeStyle: "medium",
    }).format(this.config.target);
    root.createDiv({
      cls: "markdown-widgets-countdown__target",
      text: `เป้าหมาย: ${formattedTarget}`,
    });
    this.statusElement = root.createDiv({ cls: "markdown-widgets-countdown__status" });
  }

  private updateCountdown(): boolean {
    if (!this.config) {
      return true;
    }

    const parts = calculateCountdown(this.config.target);
    for (const [key] of UNIT_LABELS) {
      this.valueElements[key]?.setText(String(parts[key]).padStart(2, "0"));
    }

    this.rootElement?.toggleClass("is-complete", parts.complete);
    this.statusElement?.setText(parts.complete ? this.config.doneMessage : "");
    return parts.complete;
  }

  private renderError(error: unknown): void {
    const message =
      error instanceof CountdownConfigError || error instanceof Error
        ? error.message
        : "Unknown countdown error.";
    const errorEl = this.containerEl.createDiv({ cls: "markdown-widgets-error" });
    errorEl.createEl("strong", { text: "Countdown error" });
    errorEl.createDiv({ text: message });
  }
}

export const countdownWidget: MarkdownWidget = {
  id: "countdown",
  register(plugin: Plugin): void {
    plugin.registerMarkdownCodeBlockProcessor("countdown", (source, el, context) => {
      context.addChild(new CountdownRenderChild(el, source));
    });
  },
};
