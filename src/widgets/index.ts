import type { MarkdownWidget } from "./widget";
import { countdownWidget } from "./countdown/countdown-widget";
import { inlineCountdownWidget } from "./countdown/inline-countdown-widget";

/** Add future widgets to this list; each module owns its parser, renderer and tests. */
export const widgets: readonly MarkdownWidget[] = [countdownWidget, inlineCountdownWidget];
