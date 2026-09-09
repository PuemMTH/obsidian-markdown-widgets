/** A `$…$` or `$$…$$` span located in Markdown source. */
export interface MathSpan {
  readonly from: number;
  readonly to: number;
  readonly tex: string;
  readonly display: boolean;
}

// `$$…$$` must be tried before `$…$` or the display delimiters parse as two empty inline spans.
// `(?<!\\)` skips escaped dollars; `(?:[^$\\]|\\.)` lets an inline span contain `\$`.
const MATH_PATTERN = /(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$|(?<!\\)\$((?:[^$\\\r\n]|\\.)+?)(?<!\\)\$/gu;

/**
 * Obsidian drops the LaTeX from the DOM once MathJax has rendered it, so the source has to be
 * recovered from the Markdown behind the rendered element.
 */
export function findMathSpans(text: string): MathSpan[] {
  const spans: MathSpan[] = [];
  for (const match of text.matchAll(MATH_PATTERN)) {
    if (match.index === undefined) continue;
    const display = match[1] !== undefined;
    const tex = (display ? match[1] : match[2]).trim();
    if (tex.length === 0) continue;
    spans.push({ from: match.index, to: match.index + match[0].length, tex, display });
  }
  return spans;
}

/** The span containing `pos`, else the first one starting at or after it. */
export function spanAt(spans: readonly MathSpan[], pos: number): MathSpan | null {
  return spans.find((span) => pos >= span.from && pos <= span.to) ?? spans.find((span) => span.from >= pos) ?? null;
}
