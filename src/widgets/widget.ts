import type { Plugin } from "obsidian";

/** A self-contained Markdown feature that can register itself with the plugin. */
export interface MarkdownWidget {
  readonly id: string;
  register(plugin: Plugin): void;
}
