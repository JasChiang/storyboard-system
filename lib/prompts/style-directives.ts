import type { StyleProfile } from '@/lib/types/storyboard';

function normalizeItem(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\-\*\d\.\)\s]+/, '')
    .trim();
}

function splitNegativePrompt(raw: string): string[] {
  const firstPass = raw
    .split(/[\n;；。]+/g)
    .map(normalizeItem)
    .filter(Boolean);

  const secondPass = firstPass.flatMap((segment) =>
    segment
      .split(/,(?=\s*(?:no\b|without\b|avoid\b|do not\b|don['’]t\b))/i)
      .map(normalizeItem)
      .filter(Boolean)
  );

  const dedup = new Map<string, string>();
  secondPass.forEach((item) => {
    const key = item.toLowerCase();
    if (!dedup.has(key)) dedup.set(key, item);
  });

  return Array.from(dedup.values());
}

export function buildStyleDirectiveLines(
  styleProfile?: Pick<StyleProfile, 'stylePrompt' | 'negativePrompt'>,
  options?: { maxNegativeItems?: number }
): string[] {
  if (!styleProfile) return [];

  const lines: string[] = [];
  const stylePrompt = styleProfile.stylePrompt?.trim();
  if (stylePrompt) {
    const hasStructuredShape = /(rendering style:|composition goal:|continuity lock:)/i.test(stylePrompt);
    const normalizedStylePrompt = hasStructuredShape
      ? stylePrompt
      : `Rendering style: ${stylePrompt}`;
    lines.push(`Style direction: ${normalizedStylePrompt}`);
  }

  const maxNegativeItems = options?.maxNegativeItems ?? 6;
  const negatives = styleProfile.negativePrompt
    ? splitNegativePrompt(styleProfile.negativePrompt).slice(0, maxNegativeItems)
    : [];

  if (negatives.length > 0) {
    lines.push(`Hard negatives: ${negatives.join('; ')}`);
  }

  return lines;
}
