import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  PluginValue,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { editorLivePreviewField, MarkdownRenderChild, Notice, Plugin } from "obsidian";
import type { MarkdownWidget } from "../widget";
import { CountdownDateTimePickerModal } from "./date-time-picker";
import { findInlineCountdownTokens } from "./inline-syntax";
import { mountInlineCountdown } from "./inline-renderer";
import { toLocalIsoWithOffset } from "./time";

const cleanupByElement = new WeakMap<HTMLElement, () => void>();

class InlineCountdownEditorWidget extends WidgetType {
  constructor(
    private readonly plugin: Plugin,
    private readonly targetTimestamp: number,
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }

  eq(other: InlineCountdownEditorWidget): boolean {
    return (
      this.targetTimestamp === other.targetTimestamp &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const element = view.dom.ownerDocument.createElement("span");
    element.contentEditable = "false";
    const target = new Date(this.targetTimestamp);
    cleanupByElement.set(
      element,
      mountInlineCountdown(element, target, {
        onActivate: () => {
          new CountdownDateTimePickerModal(this.plugin.app, {
            title: "แก้ไขวันและเวลา Countdown",
            submitLabel: "บันทึก",
            initialDate: target,
            onSubmit: (nextTarget) => {
              const currentSource = view.state.doc.sliceString(this.from, this.to);
              if (!currentSource.startsWith("%{count:") || !currentSource.endsWith("}%")) {
                new Notice("ไม่พบ countdown ตำแหน่งเดิม กรุณาลองใหม่");
                return;
              }

              const replacement = `%{count: ${toLocalIsoWithOffset(nextTarget)}}%`;
              view.dispatch({
                changes: { from: this.from, to: this.to, insert: replacement },
                selection: { anchor: this.from + replacement.length },
                scrollIntoView: true,
              });
              view.focus();
            },
          }).open();
        },
      }),
    );
    return element;
  }

  destroy(element: HTMLElement): void {
    cleanupByElement.get(element)?.();
    cleanupByElement.delete(element);
  }

  ignoreEvent(event: Event): boolean {
    return event.type === "mousedown" || event.type === "click";
  }
}

function selectionTouchesToken(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => {
    if (range.empty) {
      return range.from >= from && range.from <= to;
    }
    return range.from < to && range.to > from;
  });
}

function isInsideCode(view: EditorView, position: number): boolean {
  let node = syntaxTree(view.state).resolveInner(position, 1);
  while (node) {
    if (node.name.toLowerCase().includes("code")) {
      return true;
    }
    if (!node.parent) {
      break;
    }
    node = node.parent;
  }
  return false;
}

function buildDecorations(view: EditorView, plugin: Plugin): DecorationSet {
  if (!view.state.field(editorLivePreviewField, false)) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const token of findInlineCountdownTokens(text, from)) {
      if (
        !selectionTouchesToken(view, token.from, token.to) &&
        !isInsideCode(view, token.from)
      ) {
        builder.add(
          token.from,
          token.to,
          Decoration.replace({
            widget: new InlineCountdownEditorWidget(
              plugin,
              token.target.getTime(),
              token.from,
              token.to,
            ),
          }),
        );
      }
    }
  }
  return builder.finish();
}

class InlineCountdownViewPlugin implements PluginValue {
  decorations: DecorationSet;

  constructor(
    view: EditorView,
    private readonly plugin: Plugin,
  ) {
    this.decorations = buildDecorations(view, plugin);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildDecorations(update.view, this.plugin);
    }
  }
}

function createInlineCountdownEditorExtension(plugin: Plugin): ViewPlugin<InlineCountdownViewPlugin> {
  return ViewPlugin.define(
    (view) => new InlineCountdownViewPlugin(view, plugin),
    { decorations: (value) => value.decorations },
  );
}

class InlineCountdownMarkdownChild extends MarkdownRenderChild {
  onload(): void {
    const ownerDocument = this.containerEl.ownerDocument;
    const walker = ownerDocument.createTreeWalker(this.containerEl, 4);
    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
      if (currentNode.nodeType === 3) {
        textNodes.push(currentNode as Text);
      }
      currentNode = walker.nextNode();
    }

    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (
        !parent ||
        parent.closest(
          "code, pre, a, .markdown-widgets-countdown, .markdown-widgets-inline-countdown",
        )
      ) {
        continue;
      }

      const text = textNode.data;
      const tokens = findInlineCountdownTokens(text);
      if (tokens.length === 0) {
        continue;
      }

      const fragment = ownerDocument.createDocumentFragment();
      let cursor = 0;
      for (const token of tokens) {
        fragment.append(text.slice(cursor, token.from));
        const element = ownerDocument.createElement("span");
        this.register(mountInlineCountdown(element, token.target));
        fragment.append(element);
        cursor = token.to;
      }
      fragment.append(text.slice(cursor));
      textNode.replaceWith(fragment);
    }
  }
}

export const inlineCountdownWidget: MarkdownWidget = {
  id: "inline-countdown",
  register(plugin: Plugin): void {
    plugin.registerEditorExtension(createInlineCountdownEditorExtension(plugin));
    plugin.registerMarkdownPostProcessor((element, context) => {
      context.addChild(new InlineCountdownMarkdownChild(element));
    });
  },
};
