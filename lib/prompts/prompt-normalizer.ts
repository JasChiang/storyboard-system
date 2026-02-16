const PRIORITY_PREFIXES: Array<{ prefix: string; weight: number }> = [
  { prefix: 'Style direction:', weight: 100 },
  { prefix: 'Content references:', weight: 90 },
  { prefix: 'Use the generated start frame as the single source of truth.', weight: 88 },
  { prefix: 'Apply only this end-frame delta:', weight: 86 },
  { prefix: 'Identity invariants:', weight: 84 },
  { prefix: 'Hard negatives:', weight: 62 },
  { prefix: 'Negative constraints:', weight: 60 },
];

function normalizeLine(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function getPriority(line: string): number {
  const matched = PRIORITY_PREFIXES.find((item) => line.startsWith(item.prefix));
  return matched?.weight ?? 40;
}

export function normalizePromptParts(parts: string[], maxChars?: number): string {
  const normalized = parts
    .map(normalizeLine)
    .filter(Boolean);

  const dedup = Array.from(new Map(normalized.map((line) => [line.toLowerCase(), line])).values());
  const sorted = dedup.sort((a, b) => getPriority(b) - getPriority(a));
  const joined = sorted.join('. ');

  if (!maxChars || joined.length <= maxChars) {
    return joined;
  }

  const compact: string[] = [];
  let length = 0;
  for (const line of sorted) {
    const next = compact.length ? `. ${line}` : line;
    if (length + next.length > maxChars) continue;
    compact.push(line);
    length += next.length;
  }

  return compact.join('. ');
}
