import { describe, expect, it } from 'vitest';
import { normalizePromptParts } from '@/lib/prompts/prompt-normalizer';

describe('prompt normalizer', () => {
  it('keeps first-seen order after normalization and dedup', () => {
    const output = normalizePromptParts([
      '  second instruction  ',
      'first instruction',
      'SECOND INSTRUCTION',
      'third instruction',
    ]);

    expect(output).toBe('second instruction. first instruction. third instruction');
  });

  it('applies max length by original instruction order', () => {
    const output = normalizePromptParts(
      [
        'anchor continuity',
        'identity lock sentence',
        'style sentence',
      ],
      35
    );

    expect(output).toBe('anchor continuity');
  });
});

