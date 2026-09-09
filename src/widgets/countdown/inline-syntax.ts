import { parseCountdownTarget } from "./parser";

export interface InlineCountdownToken {
  from: number;
  to: number;
  source: string;
  expression: string;
  target: Date;
}

const INLINE_COUNTDOWN_PATTERN = /%\{count:\s*([^}%\r\n]+?)\s*\}%/giu;

/** Find valid inline countdown placeholders. Invalid/incomplete tokens stay editable text. */
export function findInlineCountdownTokens(text: string, offset = 0): InlineCountdownToken[] {
  const tokens: InlineCountdownToken[] = [];
  const pattern = new RegExp(INLINE_COUNTDOWN_PATTERN.source, INLINE_COUNTDOWN_PATTERN.flags);

  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) {
      continue;
    }

    const expression = match[1].trim();
    try {
      tokens.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        source: match[0],
        expression,
        target: parseCountdownTarget(expression),
      });
    } catch {
      // While the user is typing, incomplete placeholders should remain normal text.
    }
  }

  return tokens;
}
