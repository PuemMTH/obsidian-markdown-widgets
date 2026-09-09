import { Notice, Plugin } from "obsidian";
import {
  COUNTDOWN_SIDEBAR_VIEW_TYPE,
  CountdownSidebarView,
} from "./sidebar/countdown-sidebar-view";
import { widgets } from "./widgets";
import { CountdownDateTimePickerModal } from "./widgets/countdown/date-time-picker";
import { toLocalIsoWithOffset } from "./widgets/countdown/time";

export default class MarkdownWidgetsPlugin extends Plugin {
  onload(): void {
    this.registerView(
      COUNTDOWN_SIDEBAR_VIEW_TYPE,
      (leaf) => new CountdownSidebarView(leaf),
    );

    const openCountdownSidebar = async (): Promise<void> => {
      const existingLeaf = this.app.workspace.getLeavesOfType(COUNTDOWN_SIDEBAR_VIEW_TYPE)[0];
      const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
      if (!leaf) {
        new Notice("ไม่สามารถเปิด Countdown sidebar ได้");
        return;
      }

      if (!existingLeaf) {
        await leaf.setViewState({
          type: COUNTDOWN_SIDEBAR_VIEW_TYPE,
          active: true,
        });
      }
      await this.app.workspace.revealLeaf(leaf);
    };

    this.addRibbonIcon("timer", "เปิด Countdown sidebar", () => {
      void openCountdownSidebar();
    });
    this.addCommand({
      id: "open-countdown-sidebar",
      name: "Open countdown sidebar",
      callback: () => openCountdownSidebar(),
    });

    for (const widget of widgets) {
      widget.register(this);
    }

    this.addCommand({
      id: "insert-countdown-block",
      name: "Insert countdown block with date/time picker",
      editorCallback: (editor) => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
        new CountdownDateTimePickerModal(this.app, {
          title: "เลือกวันและเวลาสำหรับ Countdown Block",
          submitLabel: "แทรก Countdown Block",
          initialDate: tomorrow,
          onSubmit: (target) => {
            const block = [
              "```countdown",
              "title: ชื่องานหรือเหตุการณ์",
              `date: ${toLocalIsoWithOffset(target)}`,
              "done: ถึงกำหนดแล้ว!",
              "```",
            ].join("\n");
            editor.replaceSelection(block);
          },
        }).open();
      },
    });

    this.addCommand({
      id: "insert-inline-countdown",
      name: "Insert inline countdown with date/time picker",
      editorCallback: (editor) => {
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
        new CountdownDateTimePickerModal(this.app, {
          title: "เลือกวันและเวลาสำหรับ Countdown",
          submitLabel: "แทรก Countdown",
          initialDate: tomorrow,
          onSubmit: (target) => {
            editor.replaceSelection(`%{count: ${toLocalIsoWithOffset(target)}}%`);
          },
        }).open();
      },
    });
  }
}
