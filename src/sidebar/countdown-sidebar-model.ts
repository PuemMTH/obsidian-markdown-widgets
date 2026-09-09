import {
  findInlineCountdownTokens,
  InlineCountdownToken,
} from "../widgets/countdown/inline-syntax";

export interface CountdownSidebarEntry {
  key: string;
  path: string;
  fileName: string;
  groupKey: string;
  groupLabel: string;
  line: number;
  from: number;
  to: number;
  label: string;
  targetTimestamp: number;
}

export interface CountdownSidebarGroup {
  key: string;
  label: string;
  entries: CountdownSidebarEntry[];
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/^\s*#{1,6}\s+/u, "")
    .replace(/^\s*(?:[-*+] |\d+[.)] )(?:\[[ xX]\]\s*)?/u, "")
    .replace(/\s+#+\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function cleanLineLabel(
  line: string,
  tokens: readonly InlineCountdownToken[],
  fallback: string,
): string {
  let label = line;
  for (const token of [...tokens].reverse()) {
    label = `${label.slice(0, token.from)} ${label.slice(token.to)}`;
  }
  return cleanMarkdownText(label) || fallback;
}

function getInlineCodeRanges(line: string): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];
  const delimiterPattern = /`+/gu;
  let opening: RegExpExecArray | null = null;
  let match = delimiterPattern.exec(line);

  while (match) {
    if (!opening) {
      opening = match;
    } else if (match[0].length === opening[0].length) {
      ranges.push({
        from: opening.index,
        to: match.index + match[0].length,
      });
      opening = null;
    }
    match = delimiterPattern.exec(line);
  }
  return ranges;
}

function isInsideInlineCode(
  token: InlineCountdownToken,
  ranges: ReadonlyArray<{ from: number; to: number }>,
): boolean {
  return ranges.some((range) => token.from >= range.from && token.to <= range.to);
}

function getFence(line: string): { marker: "`" | "~"; length: number } | null {
  const match = /^\s{0,3}(`{3,}|~{3,})/u.exec(line);
  if (!match) {
    return null;
  }
  return {
    marker: match[1][0] as "`" | "~",
    length: match[1].length,
  };
}

function closesFence(
  line: string,
  fence: { marker: "`" | "~"; length: number },
): boolean {
  const escapedMarker = fence.marker === "`" ? "`" : "~";
  const pattern = new RegExp(
    `^\\s{0,3}${escapedMarker}{${fence.length},}\\s*$`,
    "u",
  );
  return pattern.test(line);
}

export function parseCountdownSidebarEntries(
  path: string,
  fileName: string,
  source: string,
): CountdownSidebarEntry[] {
  const entries: CountdownSidebarEntry[] = [];
  let currentHeading: string | null = null;
  let activeFence: { marker: "`" | "~"; length: number } | null = null;

  for (const [lineNumber, line] of source.split(/\r?\n/u).entries()) {
    if (activeFence) {
      if (closesFence(line, activeFence)) {
        activeFence = null;
      }
      continue;
    }

    const openingFence = getFence(line);
    if (openingFence) {
      activeFence = openingFence;
      continue;
    }

    const headingMatch = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u.exec(line);
    if (headingMatch) {
      currentHeading = cleanMarkdownText(headingMatch[1]);
    }

    const inlineCodeRanges = getInlineCodeRanges(line);
    const tokens = findInlineCountdownTokens(line).filter(
      (token) => !isInsideInlineCode(token, inlineCodeRanges),
    );
    if (tokens.length === 0) {
      continue;
    }

    const groupKey = `${path}\u0000${currentHeading ?? ""}`;
    const groupLabel = currentHeading ? `${fileName} › ${currentHeading}` : fileName;
    const label = cleanLineLabel(line, tokens, fileName);
    for (const token of tokens) {
      entries.push({
        key: `${path}:${lineNumber}:${token.from}:${token.target.getTime()}`,
        path,
        fileName,
        groupKey,
        groupLabel,
        line: lineNumber,
        from: token.from,
        to: token.to,
        label,
        targetTimestamp: token.target.getTime(),
      });
    }
  }

  return entries;
}

/** Upcoming countdowns come first; completed countdowns remain visible after them. */
export function sortCountdownSidebarEntries(
  entries: readonly CountdownSidebarEntry[],
  now = Date.now(),
): CountdownSidebarEntry[] {
  return [...entries].sort((left, right) => {
    const leftComplete = left.targetTimestamp <= now;
    const rightComplete = right.targetTimestamp <= now;
    if (leftComplete !== rightComplete) {
      return leftComplete ? 1 : -1;
    }
    return leftComplete
      ? right.targetTimestamp - left.targetTimestamp
      : left.targetTimestamp - right.targetTimestamp;
  });
}

export function groupCountdownSidebarEntries(
  entries: readonly CountdownSidebarEntry[],
  now = Date.now(),
): CountdownSidebarGroup[] {
  const groups = new Map<string, CountdownSidebarGroup>();
  for (const entry of entries) {
    const group = groups.get(entry.groupKey) ?? {
      key: entry.groupKey,
      label: entry.groupLabel,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(entry.groupKey, group);
  }

  const rankedGroups = [...groups.values()].map((group) => {
    group.entries = sortCountdownSidebarEntries(group.entries, now);
    const upcoming = group.entries.filter((entry) => entry.targetTimestamp > now);
    return {
      group,
      nextTarget: upcoming.length > 0 ? upcoming[0].targetTimestamp : Number.POSITIVE_INFINITY,
      lastTarget: Math.max(...group.entries.map((entry) => entry.targetTimestamp)),
    };
  });

  rankedGroups.sort((left, right) => {
    if (left.nextTarget !== right.nextTarget) {
      return left.nextTarget - right.nextTarget;
    }
    if (left.nextTarget === Number.POSITIVE_INFINITY && left.lastTarget !== right.lastTarget) {
      return right.lastTarget - left.lastTarget;
    }
    return left.group.label.localeCompare(right.group.label, "th");
  });
  return rankedGroups.map(({ group }) => group);
}
