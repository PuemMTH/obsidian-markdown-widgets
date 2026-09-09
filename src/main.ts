import { Plugin } from "obsidian";
import { widgets } from "./widgets";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toLocalIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainder = absoluteOffset % 60;

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offsetHours)}:${pad(offsetRemainder)}`
  );
}

export default class MarkdownWidgetsPlugin extends Plugin {
  onload(): void {
    for (const widget of widgets) {
      widget.register(this);
    }

    this.addCommand({
      id: "insert-countdown-block",
      name: "Insert countdown block",
      editorCallback: (editor) => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
        const block = [
          "```countdown",
          "title: ชื่องานหรือเหตุการณ์",
          `date: ${toLocalIsoWithOffset(tomorrow)}`,
          "done: ถึงกำหนดแล้ว!",
          "```",
        ].join("\n");

        editor.replaceSelection(block);
      },
    });
  }
}
