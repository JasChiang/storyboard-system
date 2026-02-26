function normalizeLine(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function normalizePromptParts(parts: string[], maxChars?: number): string {
  const normalized = parts
    .map(normalizeLine)
    .filter(Boolean);

  const dedup: string[] = [];
  const seen = new Set<string>();
  for (const line of normalized) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(line);
  }

  const joined = dedup.join('. ');

  if (!maxChars || joined.length <= maxChars) {
    return joined;
  }

  const compact: string[] = [];
  let length = 0;
  for (const line of dedup) {
    const next = compact.length ? `. ${line}` : line;
    if (length + next.length > maxChars) break;
    compact.push(line);
    length += next.length;
  }

  return compact.join('. ');
}
