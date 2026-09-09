import {
  ItemView,
  MarkdownView,
  Notice,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { formatSidebarCountdown } from "../widgets/countdown/inline-renderer";
import { calculateCountdown } from "../widgets/countdown/time";
import {
  CountdownSidebarEntry,
  CountdownSidebarGroup,
  groupCountdownSidebarEntries,
  parseCountdownSidebarEntries,
} from "./countdown-sidebar-model";

export const COUNTDOWN_SIDEBAR_VIEW_TYPE = "markdown-widgets-countdowns";

const MARKDOWN_EXTENSION = "md";
const UPDATE_DELAY_MS = 300;

export class CountdownSidebarView extends ItemView {
  private readonly entriesByPath = new Map<string, CountdownSidebarEntry[]>();
  private readonly entryByKey = new Map<string, CountdownSidebarEntry>();
  private readonly pendingUpdates = new Map<string, number>();
  private wasComplete = new Map<string, boolean>();

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.navigation = false;
  }

  getViewType(): string {
    return COUNTDOWN_SIDEBAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Countdowns";
  }

  getIcon(): string {
    return "timer";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("markdown-widgets-sidebar");
    this.addAction("refresh-cw", "สแกน Countdown ใหม่", () => this.scanVault());

    this.registerEvent(
      this.app.vault.on("create", (file) => this.scheduleFileUpdate(file)),
    );
    this.registerEvent(
      this.app.vault.on("modify", (file) => this.scheduleFileUpdate(file)),
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => this.removeFile(file.path)),
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.removeFile(oldPath, false);
        this.scheduleFileUpdate(file);
      }),
    );
    this.registerDomEvent(this.contentEl, "click", (event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-countdown-key]") : null;
      const key = element?.dataset.countdownKey;
      const entry = key ? this.entryByKey.get(key) : undefined;
      if (entry) {
        void this.openEntry(entry);
      }
    });
    this.registerDomEvent(this.contentEl, "keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-countdown-key]") : null;
      const key = element?.dataset.countdownKey;
      const entry = key ? this.entryByKey.get(key) : undefined;
      if (entry) {
        event.preventDefault();
        void this.openEntry(entry);
      }
    });

    this.registerInterval(
      window.setInterval(() => this.updateVisibleCountdowns(), 1_000),
    );

    await this.scanVault();
  }

  async onClose(): Promise<void> {
    for (const timeoutId of this.pendingUpdates.values()) {
      window.clearTimeout(timeoutId);
    }
    this.pendingUpdates.clear();
  }

  private async scanVault(): Promise<void> {
    this.renderLoading();
    const nextEntries = new Map<string, CountdownSidebarEntry[]>();
    const files = this.app.vault.getMarkdownFiles();

    await Promise.all(
      files.map(async (file) => {
        try {
          const source = await this.app.vault.cachedRead(file);
          nextEntries.set(
            file.path,
            parseCountdownSidebarEntries(file.path, file.basename, source),
          );
        } catch {
          // A file can disappear while the initial scan is running.
        }
      }),
    );

    this.entriesByPath.clear();
    for (const [path, entries] of nextEntries) {
      this.entriesByPath.set(path, entries);
    }
    this.renderEntries();
  }

  private scheduleFileUpdate(file: TAbstractFile): void {
    if (!(file instanceof TFile) || file.extension !== MARKDOWN_EXTENSION) {
      return;
    }

    const existingTimeout = this.pendingUpdates.get(file.path);
    if (existingTimeout !== undefined) {
      window.clearTimeout(existingTimeout);
    }

    const timeoutId = window.setTimeout(() => {
      this.pendingUpdates.delete(file.path);
      void this.updateFile(file);
    }, UPDATE_DELAY_MS);
    this.pendingUpdates.set(file.path, timeoutId);
  }

  private async updateFile(file: TFile): Promise<void> {
    try {
      const source = await this.app.vault.cachedRead(file);
      this.entriesByPath.set(
        file.path,
        parseCountdownSidebarEntries(file.path, file.basename, source),
      );
      this.renderEntries();
    } catch {
      this.removeFile(file.path);
    }
  }

  private removeFile(path: string, render = true): void {
    const timeoutId = this.pendingUpdates.get(path);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.pendingUpdates.delete(path);
    }
    this.entriesByPath.delete(path);
    if (render) {
      this.renderEntries();
    }
  }

  private getGroups(now = Date.now()): CountdownSidebarGroup[] {
    return groupCountdownSidebarEntries(
      [...this.entriesByPath.values()].flat(),
      now,
    );
  }

  private renderLoading(): void {
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: "markdown-widgets-sidebar__empty",
      text: "กำลังสแกน Countdown…",
    });
  }

  private renderEntries(): void {
    const now = Date.now();
    const groups = this.getGroups(now);
    const entries = groups.flatMap((group) => group.entries);
    this.entryByKey.clear();
    this.wasComplete = new Map(entries.map((entry) => [entry.key, entry.targetTimestamp <= now]));
    this.contentEl.empty();

    const header = this.contentEl.createDiv({ cls: "markdown-widgets-sidebar__header" });
    header.createEl("h4", { text: "Countdowns" });
    header.createDiv({
      cls: "markdown-widgets-sidebar__summary",
      text: `${entries.length} รายการ`,
    });

    if (entries.length === 0) {
      this.contentEl.createDiv({
        cls: "markdown-widgets-sidebar__empty",
        text: "ยังไม่พบ %{count: ...}% ใน vault นี้",
      });
      return;
    }

    for (const group of groups) {
      this.renderGroup(group);
    }
  }

  private renderGroup(group: CountdownSidebarGroup): void {
    const section = this.contentEl.createDiv({ cls: "markdown-widgets-sidebar__section" });
    section.createDiv({
      cls: "markdown-widgets-sidebar__section-title",
      text: `${group.label} · ${group.entries.length}`,
    });

    for (const entry of group.entries) {
      this.entryByKey.set(entry.key, entry);
      const row = section.createDiv({
        cls: "markdown-widgets-sidebar__item",
        attr: {
          role: "button",
          tabindex: "0",
          "data-countdown-key": entry.key,
        },
      });
      row.createDiv({
        cls: "markdown-widgets-sidebar__item-label",
        text: entry.label,
      });

      const meta = row.createDiv({ cls: "markdown-widgets-sidebar__item-meta" });
      meta.createSpan({
        cls: "markdown-widgets-sidebar__item-file",
        text: `${entry.fileName} · บรรทัด ${entry.line + 1}`,
      });
      meta.createSpan({
        cls: "markdown-widgets-sidebar__item-time",
        text: new Intl.DateTimeFormat("th-TH", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(entry.targetTimestamp)),
      });

      row.createDiv({
        cls: "markdown-widgets-sidebar__remaining",
        attr: { "data-countdown-target": String(entry.targetTimestamp) },
        text: formatSidebarCountdown(calculateCountdown(new Date(entry.targetTimestamp))),
      });
    }
  }

  private updateVisibleCountdowns(): void {
    let needsRegroup = false;
    const elements = Array.from(
      this.contentEl.querySelectorAll("[data-countdown-target]"),
    ) as HTMLElement[];
    for (const element of elements) {
      const targetTimestamp = Number(element.dataset.countdownTarget);
      if (!Number.isFinite(targetTimestamp)) {
        continue;
      }

      const parts = calculateCountdown(new Date(targetTimestamp));
      const nextText = formatSidebarCountdown(parts);
      if (element.textContent !== nextText) {
        element.setText(nextText);
      }
      const row = element.closest("[data-countdown-key]") as HTMLElement | null;
      const key = row?.dataset.countdownKey;
      if (key && this.wasComplete.get(key) !== parts.complete) {
        needsRegroup = true;
      }
    }

    if (needsRegroup) {
      this.renderEntries();
    }
  }

  private async openEntry(entry: CountdownSidebarEntry): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (!(file instanceof TFile)) {
      new Notice("ไม่พบไฟล์ของ Countdown นี้แล้ว");
      this.removeFile(entry.path);
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await this.app.workspace.revealLeaf(leaf);

    if (leaf.view instanceof MarkdownView) {
      const from = { line: entry.line, ch: entry.from };
      const to = { line: entry.line, ch: entry.to };
      leaf.view.editor.setSelection(from, to);
      leaf.view.editor.scrollIntoView({ from, to }, true);
      leaf.view.editor.focus();
    }
  }
}
