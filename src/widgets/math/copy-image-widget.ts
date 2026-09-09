import { FileSystemAdapter, MarkdownView, Menu, Notice, type MarkdownPostProcessorContext, type Plugin } from "obsidian";
import type { MarkdownWidget } from "../widget";
import { findMathSpans, spanAt } from "./math-source";
import { texToSvg } from "./tex-to-svg";

const PADDING_PX = 12;
const MAX_SCALE = 3;
const BACKGROUND = "#ffffff";
const FOREGROUND = "#000000";
const TEX_ATTRIBUTE = "data-mw-tex";

interface NativeImage {
  isEmpty(): boolean;
  getSize(): { width: number; height: number };
}

interface WebContents {
  capturePage(rect: { x: number; y: number; width: number; height: number }): Promise<NativeImage>;
  getZoomFactor(): number;
}

interface Clipboard {
  writeImage(image: unknown): void;
  writeText(text: string): void;
  writeBuffer(format: string, buffer: Uint8Array, type?: string): void;
  readBuffer(format: string): Uint8Array;
}

interface Remote {
  getCurrentWebContents(): WebContents;
  dialog: {
    showSaveDialog(options: {
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    }): Promise<{ canceled: boolean; filePath?: string }>;
  };
}

const SVG_MIME = "image/svg+xml";

/**
 * Obsidian renders MathJax as CommonHTML (`<mjx-c>` elements + web fonts), not SVG, so there is
 * no SVG in the page to lift and no LaTeX left in the DOM after `tex2chtml`. Capturing the
 * composited page is the only route to a picture that needs neither.
 */
function loadRemote(): Remote {
  for (const id of ["@electron/remote", "electron"]) {
    try {
      const mod = require(id) as Partial<Remote> & { remote?: Partial<Remote> };
      const remote = id === "electron" ? mod.remote : mod;
      if (remote?.getCurrentWebContents && remote.dialog) return remote as Remote;
    } catch {
      // try the next entry point
    }
  }
  throw new Error("ปลั๊กอินนี้ต้องใช้ Obsidian เวอร์ชันเดสก์ท็อป (Electron remote ใช้ไม่ได้)");
}

function loadClipboard(): Clipboard {
  return (require("electron") as { clipboard: Clipboard }).clipboard;
}

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

/* ------------------------------------------------------------------ LaTeX source recovery */

/**
 * Live preview keeps the source in the CodeMirror document, and `posAtDOM` maps the rendered
 * widget back to it. Reading view has no such mapping, so a post-processor stamps each `.math`
 * element with the source from its own section (see `tagRenderedMath`).
 */
function sourceFromEditor(container: HTMLElement, plugin: Plugin): { tex: string; display: boolean } | null {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  const editorView = (view?.editor as unknown as { cm?: { posAtDOM(node: Node): number; state: { doc: { toString(): string } } } })?.cm;
  if (!editorView) return null;
  try {
    const pos = editorView.posAtDOM(container);
    const span = spanAt(findMathSpans(editorView.state.doc.toString()), pos);
    return span ? { tex: span.tex, display: span.display } : null;
  } catch {
    return null;
  }
}

function tagRenderedMath(element: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  const rendered = Array.from(element.querySelectorAll<HTMLElement>(".math"));
  if (rendered.length === 0) return;
  const info = ctx.getSectionInfo(element);
  if (!info) return;

  const spans = findMathSpans(info.text.split("\n").slice(info.lineStart, info.lineEnd + 1).join("\n"));
  // A mismatch means the section was parsed differently than the renderer saw it; a wrong
  // equation is worse than none, so tag nothing rather than guess at the alignment.
  if (spans.length !== rendered.length) return;
  rendered.forEach((el, index) => el.setAttribute(TEX_ATTRIBUTE, spans[index].tex));
}

function findSource(container: HTMLElement, plugin: Plugin): { tex: string; display: boolean } {
  const mathEl = container.closest<HTMLElement>(".math");
  const tagged = mathEl?.getAttribute(TEX_ATTRIBUTE);
  if (tagged) return { tex: tagged, display: mathEl?.hasClass("math-block") ?? false };

  const fromEditor = sourceFromEditor(container, plugin);
  if (fromEditor) return fromEditor;

  throw new Error("หา LaTeX ต้นฉบับของสมการนี้ไม่เจอ — ลองใช้ Copy as image แทน");
}

/* ------------------------------------------------------------------------------- actions */

/**
 * capturePage grabs whatever is composited, so capturing the equation in place drags the note's
 * theme background and element box along with it, at screen resolution. Copy it into a
 * throwaway overlay instead: `zoom` makes CHTML re-lay-out as text at N× (genuinely sharp, not
 * an upscale), and the overlay owns its own background and colour.
 */
function buildOverlay(container: HTMLElement, scale: number): HTMLElement {
  const overlay = window.document.body.createDiv();
  overlay.style.setProperty("position", "fixed");
  overlay.style.setProperty("left", "0");
  overlay.style.setProperty("top", "0");
  overlay.style.setProperty("z-index", "2147483647");
  overlay.style.setProperty("display", "inline-block");
  overlay.style.setProperty("padding", `${PADDING_PX}px`);
  overlay.style.setProperty("background", BACKGROUND);
  overlay.style.setProperty("color", FOREGROUND);
  overlay.style.setProperty("zoom", String(scale));
  // CHTML sizes every glyph in `em`, so the inherited font-size has to come along or the
  // clone renders at the wrong scale.
  overlay.style.setProperty("font-size", window.getComputedStyle(container).fontSize);
  overlay.appendChild(container.cloneNode(true));
  return overlay;
}

async function copyAsPng(container: HTMLElement): Promise<void> {
  let overlay: HTMLElement | null = null;
  try {
    const webContents = loadRemote().getCurrentWebContents();
    const clipboard = loadClipboard();

    // Scaling past the viewport would crop the equation, so cap it on the larger dimension.
    const source = container.getBoundingClientRect();
    const fit = Math.min(
      window.innerWidth / (source.width + PADDING_PX * 2),
      window.innerHeight / (source.height + PADDING_PX * 2),
    );
    const scale = Math.max(1, Math.min(MAX_SCALE, Math.floor(fit)));

    overlay = buildOverlay(container, scale);
    // Two frames: one for the overlay to lay out, one so the context menu we just dismissed is
    // gone from the composited frame instead of appearing in the screenshot.
    await nextFrame();
    await nextFrame();

    // getBoundingClientRect is in CSS pixels; capturePage wants device-independent pixels.
    const zoom = webContents.getZoomFactor();
    const rect = overlay.getBoundingClientRect();
    const image = await webContents.capturePage({
      x: 0,
      y: 0,
      width: Math.ceil(rect.width * zoom),
      height: Math.ceil(rect.height * zoom),
    });

    if (image.isEmpty()) throw new Error("จับภาพสมการไม่ได้ (ภาพว่างเปล่า)");
    clipboard.writeImage(image);
    const { width, height } = image.getSize();
    new Notice(`คัดลอกสมการเป็นรูปภาพแล้ว (${width}×${height}, ${scale}×)`);
  } catch (error) {
    new Notice(error instanceof Error ? error.message : "คัดลอกสมการไม่สำเร็จ");
  } finally {
    overlay?.remove();
  }
}

function copyAsSvg(container: HTMLElement, plugin: Plugin): void {
  try {
    const { tex, display } = findSource(container, plugin);
    const svg = texToSvg(tex, display);
    const clipboard = loadClipboard();

    // Inkscape and Illustrator paste an `image/svg+xml` clipboard target, not plain text.
    // Every clipboard write clears the others, so the buffer flavour has to win — fall back to
    // text only when the platform refused it.
    clipboard.writeBuffer(SVG_MIME, new TextEncoder().encode(svg));
    if (clipboard.readBuffer(SVG_MIME).length > 0) {
      new Notice(`คัดลอกสมการเป็น SVG แล้ว (${SVG_MIME}, ${svg.length.toLocaleString()} ตัวอักษร)`);
      return;
    }

    clipboard.writeText(svg);
    new Notice("คลิปบอร์ดไม่รับ image/svg+xml — คัดลอกเป็นข้อความแทน");
  } catch (error) {
    new Notice(error instanceof Error ? error.message : "แปลงสมการเป็น SVG ไม่สำเร็จ");
  }
}

/** Default the save dialog next to the note the equation came from. */
function defaultSvgPath(plugin: Plugin): string | undefined {
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return undefined;
  const file = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file;
  const { join, dirname } = require("path") as typeof import("path");
  const base = file ? join(adapter.getBasePath(), dirname(file.path)) : adapter.getBasePath();
  const stem = file?.basename ?? "equation";
  return join(base, `${stem}-equation.svg`);
}

async function saveAsSvg(container: HTMLElement, plugin: Plugin): Promise<void> {
  try {
    const { tex, display } = findSource(container, plugin);
    const svg = texToSvg(tex, display);
    const { filePath, canceled } = await loadRemote().dialog.showSaveDialog({
      defaultPath: defaultSvgPath(plugin),
      filters: [{ name: "SVG", extensions: ["svg"] }],
    });
    if (canceled || !filePath) return;

    const { writeFileSync } = require("fs") as typeof import("fs");
    writeFileSync(filePath, svg, "utf8");
    new Notice(`บันทึกแล้ว: ${filePath}`);
  } catch (error) {
    new Notice(error instanceof Error ? error.message : "บันทึก SVG ไม่สำเร็จ");
  }
}

export const mathCopyImageWidget: MarkdownWidget = {
  id: "math-copy-image",
  register(plugin: Plugin): void {
    plugin.registerMarkdownPostProcessor(tagRenderedMath);

    // Capture phase and a single document listener: covers reading view and live preview,
    // where math is a CodeMirror widget the Markdown post-processor never sees.
    plugin.registerDomEvent(
      window.document,
      "contextmenu",
      (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const container = target.closest("mjx-container");
        if (!(container instanceof HTMLElement)) return;

        event.preventDefault();
        event.stopPropagation();

        const menu = new Menu();
        menu.addItem((item) =>
          item
            .setTitle("Copy equation as image")
            .setIcon("image")
            .onClick(() => void copyAsPng(container)),
        );
        menu.addItem((item) =>
          item
            .setTitle("Copy equation as SVG")
            .setIcon("shapes")
            .onClick(() => copyAsSvg(container, plugin)),
        );
        menu.addItem((item) =>
          item
            .setTitle("Save equation as SVG…")
            .setIcon("save")
            .onClick(() => void saveAsSvg(container, plugin)),
        );
        menu.showAtMouseEvent(event);
      },
      { capture: true },
    );
  },
};
