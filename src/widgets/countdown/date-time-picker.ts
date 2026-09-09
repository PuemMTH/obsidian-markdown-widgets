import { App, Modal, Notice } from "obsidian";
import {
  parseSmartDateTime,
  SmartDateTimeParseError,
} from "./smart-date-time";
import {
  toLocalDateTimeInputValue,
  toLocalIsoWithOffset,
} from "./time";

interface CountdownDateTimePickerOptions {
  title: string;
  submitLabel: string;
  initialDate: Date;
  onSubmit: (target: Date) => void;
}

let pickerId = 0;

function toSmartInputValue(date: Date): string {
  return toLocalDateTimeInputValue(date).replace("T", " ").slice(0, 16);
}

function roundToMinute(date: Date): Date {
  const result = new Date(date);
  result.setSeconds(0, 0);
  return result;
}

export class CountdownDateTimePickerModal extends Modal {
  private parseTimeoutId: number | null = null;

  constructor(
    app: App,
    private readonly options: CountdownDateTimePickerOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const now = roundToMinute(new Date());
    let currentTarget = roundToMinute(this.options.initialDate);
    const currentPickerId = ++pickerId;

    contentEl.empty();
    contentEl.addClass("markdown-widgets-picker");
    contentEl.createEl("h2", { text: this.options.title });

    const form = contentEl.createEl("form", {
      cls: "markdown-widgets-picker__form",
    });

    const smartField = form.createDiv({ cls: "markdown-widgets-picker__field" });
    const smartLabel = smartField.createEl("label", { text: "Smart input" });
    const smartInput = smartField.createEl("input", {
      cls: "markdown-widgets-picker__input",
      attr: {
        type: "text",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "พรุ่งนี้ 18:30, tomorrow, +3d",
      },
    });
    smartInput.id = `markdown-widgets-smart-target-${currentPickerId}`;
    smartLabel.htmlFor = smartInput.id;
    smartInput.value = toSmartInputValue(currentTarget);

    smartField.createDiv({
      cls: "markdown-widgets-picker__hint",
      text: "รองรับ วันนี้/พรุ่งนี้/มะรืน, today/tomorrow, +30m/+2h/+3d/+1w",
    });

    const presets = form.createDiv({ cls: "markdown-widgets-picker__presets" });
    const presetValues = [
      ["วันนี้", "วันนี้"],
      ["พรุ่งนี้", "พรุ่งนี้"],
      ["+7 วัน", "+7d"],
    ] as const;

    const nativeField = form.createDiv({ cls: "markdown-widgets-picker__field" });
    const nativeLabel = nativeField.createEl("label", { text: "ปฏิทินและเวลา" });
    const nativeInput = nativeField.createEl("input", {
      cls: "markdown-widgets-picker__input",
      attr: {
        type: "datetime-local",
        step: "60",
        required: "true",
      },
    });
    nativeInput.id = `markdown-widgets-native-target-${currentPickerId}`;
    nativeLabel.htmlFor = nativeInput.id;
    nativeInput.value = toLocalDateTimeInputValue(currentTarget).slice(0, 16);

    const feedback = form.createDiv({ cls: "markdown-widgets-picker__feedback" });
    const errorElement = feedback.createDiv({
      cls: "markdown-widgets-picker__error",
      attr: { "aria-live": "polite" },
    });
    const previewElement = feedback.createDiv({
      cls: "markdown-widgets-picker__preview",
      attr: { "aria-live": "polite" },
    });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    form.createDiv({
      cls: "markdown-widgets-picker__hint",
      text: `บันทึกเป็น ISO โดยใช้ timezone ของเครื่อง (${timezone})`,
    });

    const actions = form.createDiv({ cls: "markdown-widgets-picker__actions" });
    const cancelButton = actions.createEl("button", {
      cls: "markdown-widgets-picker__button",
      text: "ยกเลิก",
      attr: { type: "button" },
    });
    const submitButton = actions.createEl("button", {
      cls: ["markdown-widgets-picker__button", "mod-cta"],
      text: this.options.submitLabel,
      attr: { type: "submit" },
    });

    const renderValidTarget = (target: Date): void => {
      currentTarget = roundToMinute(target);
      nativeInput.value = toLocalDateTimeInputValue(currentTarget).slice(0, 16);
      errorElement.empty();
      previewElement.setText(
        `${new Intl.DateTimeFormat("th-TH", {
          dateStyle: "full",
          timeStyle: "short",
        }).format(currentTarget)} · ${toLocalIsoWithOffset(currentTarget)}`,
      );
      submitButton.disabled = false;
      smartInput.removeAttribute("aria-invalid");
    };

    const renderError = (error: unknown): void => {
      const message =
        error instanceof SmartDateTimeParseError || error instanceof Error
          ? error.message
          : "วันหรือเวลาไม่ถูกต้อง";
      errorElement.setText(message);
      previewElement.empty();
      submitButton.disabled = true;
      smartInput.setAttribute("aria-invalid", "true");
    };

    const parseSmartInput = (): boolean => {
      try {
        renderValidTarget(parseSmartDateTime(smartInput.value, now));
        return true;
      } catch (error) {
        renderError(error);
        return false;
      }
    };

    for (const [label, value] of presetValues) {
      const button = presets.createEl("button", {
        cls: "markdown-widgets-picker__preset",
        text: label,
        attr: { type: "button" },
      });
      button.addEventListener("click", () => {
        smartInput.value = value;
        parseSmartInput();
        smartInput.focus();
      });
    }

    smartInput.addEventListener("input", () => {
      if (this.parseTimeoutId !== null) {
        window.clearTimeout(this.parseTimeoutId);
      }
      this.parseTimeoutId = window.setTimeout(() => {
        this.parseTimeoutId = null;
        parseSmartInput();
      }, 150);
    });

    nativeInput.addEventListener("input", () => {
      const target = new Date(nativeInput.value);
      if (!nativeInput.value || Number.isNaN(target.getTime())) {
        renderError(new SmartDateTimeParseError("กรุณาเลือกวันและเวลาให้ถูกต้อง"));
        return;
      }
      smartInput.value = toSmartInputValue(target);
      renderValidTarget(target);
    });

    cancelButton.addEventListener("click", () => this.close());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.parseTimeoutId !== null) {
        window.clearTimeout(this.parseTimeoutId);
        this.parseTimeoutId = null;
      }
      if (!parseSmartInput()) {
        smartInput.focus();
        return;
      }

      this.close();
      this.options.onSubmit(currentTarget);
    });

    renderValidTarget(currentTarget);
    window.setTimeout(() => smartInput.focus(), 0);
  }

  onClose(): void {
    if (this.parseTimeoutId !== null) {
      window.clearTimeout(this.parseTimeoutId);
      this.parseTimeoutId = null;
    }
    this.contentEl.empty();
  }
}
