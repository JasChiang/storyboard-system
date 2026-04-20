import type { ProjectReference } from '@/lib/types/storyboard';

export interface PromptBudgetEstimate {
  estimatedChars: number;
  level: 'ok' | 'warn' | 'danger';
  breakdown: {
    userPrompt: number;
    references: number;
    templateBase: number;
  };
}

export interface PromptBudgetInput {
  userPrompt: string;
  references: ProjectReference[];
  templateBaseChars?: number;
}

/**
 * Rough character-level estimate of the storyboard prompt size.
 * Uses characters (not tokens) because the system mixes Chinese + English
 * and character count is a reasonable lower-bound heuristic the user can
 * reason about. Thresholds tuned against observed Gemini 2.0 Flash limits.
 */
export function estimatePromptBudget({
  userPrompt,
  references,
  templateBaseChars = 4000,
}: PromptBudgetInput): PromptBudgetEstimate {
  const userPromptChars = userPrompt.length;

  let referenceChars = 0;
  for (const ref of references) {
    referenceChars += (ref.description || '').length;
    referenceChars += (ref.aiDescription || '').length;
    referenceChars += (ref.identityCore || '').length;
    referenceChars += (ref.styleTraits || '').length;
    referenceChars += (ref.angleVisibility || '').length;
    referenceChars += (ref.guidelines || '').length;
    if (Array.isArray(ref.mustKeepFeatures)) {
      referenceChars += ref.mustKeepFeatures.join(' ').length;
    }
    referenceChars += 200;
  }

  const estimatedChars = userPromptChars + referenceChars + templateBaseChars;

  let level: PromptBudgetEstimate['level'] = 'ok';
  if (estimatedChars >= 14000) level = 'danger';
  else if (estimatedChars >= 8000) level = 'warn';

  return {
    estimatedChars,
    level,
    breakdown: {
      userPrompt: userPromptChars,
      references: referenceChars,
      templateBase: templateBaseChars,
    },
  };
}

export function formatBudgetLabel(estimate: PromptBudgetEstimate): string {
  const kilo = (estimate.estimatedChars / 1000).toFixed(1);
  if (estimate.level === 'danger') return `⚠️ 預估 prompt ~${kilo}K 字（偏高，建議精簡參考或縮短故事）`;
  if (estimate.level === 'warn') return `預估 prompt ~${kilo}K 字（接近上限）`;
  return `預估 prompt ~${kilo}K 字`;
}
