export type VideoPromptModel = 'kling' | 'seedance';

const HARD_LIMITS: Record<VideoPromptModel, number> = {
  kling: 2500,
  seedance: 4000,
};

const SOFT_TARGETS: Record<VideoPromptModel, number> = {
  kling: 2300,
  seedance: 3600,
};

export interface PromptPolicyResult {
  prompt: string;
  originalLength: number;
  finalLength: number;
  hardLimit: number;
  wasTruncated: boolean;
}

export function normalizePromptWhitespace(input: string): string {
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

export function enforceVideoPromptPolicy(
  input: string,
  model: VideoPromptModel
): PromptPolicyResult {
  const hardLimit = HARD_LIMITS[model];
  const softTarget = SOFT_TARGETS[model];
  const normalized = normalizePromptWhitespace(input || '');
  const originalLength = normalized.length;

  if (originalLength <= hardLimit) {
    return {
      prompt: normalized,
      originalLength,
      finalLength: originalLength,
      hardLimit,
      wasTruncated: false,
    };
  }

  // Keep the front of the prompt (camera/action directives usually come first),
  // then append a short high-priority identity lock sentence.
  const lockSentence = ' Keep identity, geometry, logos, and visible text unchanged.';
  const budget = Math.max(200, softTarget - lockSentence.length);
  let truncated = normalized.slice(0, budget).trim();
  truncated = truncated.replace(/[|,;:\-.\s]+$/g, '').trim();
  let prompt = `${truncated}.${lockSentence}`.trim();

  if (prompt.length > hardLimit) {
    prompt = prompt.slice(0, hardLimit).trim();
  }

  return {
    prompt,
    originalLength,
    finalLength: prompt.length,
    hardLimit,
    wasTruncated: true,
  };
}
