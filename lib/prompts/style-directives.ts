import type { StyleProfile, WorkflowStage } from '@/lib/types/storyboard';

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
  styleProfile?: Pick<StyleProfile, 'stylePrompt' | 'negativePrompt' | 'usage' | 'productionPreset' | 'continuityStrategy' | 'stagePromptOverrides' | 'stageNegativeOverrides'>,
  options?: { maxNegativeItems?: number; stage?: WorkflowStage }
): string[] {
  if (!styleProfile) return [];

  const lines: string[] = [];
  const stage = options?.stage;
  const stagePrompt = stage ? styleProfile.stagePromptOverrides?.[stage]?.trim() : '';
  const stylePrompt = stagePrompt || styleProfile.stylePrompt?.trim();
  if (stylePrompt) {
    const hasStructuredShape = /(rendering style:|composition goal:|continuity lock:)/i.test(stylePrompt);
    const normalizedStylePrompt = hasStructuredShape
      ? stylePrompt
      : `Rendering style: ${stylePrompt}`;
    lines.push(`Style direction: ${normalizedStylePrompt}`);
  }

  if (styleProfile.productionPreset?.trim()) {
    lines.push(`Production preset: ${styleProfile.productionPreset.trim()}`);
  }
  if (styleProfile.usage?.trim()) {
    lines.push(`Primary use case: ${styleProfile.usage.trim()}`);
  }
  if (styleProfile.continuityStrategy?.trim()) {
    lines.push(`Continuity strategy: ${styleProfile.continuityStrategy.trim()}`);
  }

  const maxNegativeItems = options?.maxNegativeItems ?? 6;
  const negativeSource = (stage ? styleProfile.stageNegativeOverrides?.[stage] : '') || styleProfile.negativePrompt;
  const negatives = negativeSource
    ? splitNegativePrompt(negativeSource).slice(0, maxNegativeItems)
    : [];

  if (negatives.length > 0) {
    lines.push(`Hard negatives: ${negatives.join('; ')}`);
  }

  return lines;
}
