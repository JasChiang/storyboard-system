import { describe, expect, it } from 'vitest';
import { enforceVideoPromptPolicy, normalizePromptWhitespace } from '@/lib/video/prompt-policy';

describe('video prompt policy', () => {
  it('normalizes whitespace and punctuation spacing', () => {
    expect(normalizePromptWhitespace('  a   b  ,  c  .  ')).toBe('a b, c.');
  });

  it('keeps prompt unchanged when under hard limit', () => {
    const result = enforceVideoPromptPolicy('Keep camera static and preserve logo.', 'kling');
    expect(result.wasTruncated).toBe(false);
    expect(result.prompt).toBe('Keep camera static and preserve logo.');
    expect(result.finalLength).toBe(result.originalLength);
  });

  it('truncates long prompt and appends identity lock sentence', () => {
    const longPrompt = 'camera action and environment detail '.repeat(120);
    const result = enforceVideoPromptPolicy(longPrompt, 'kling');

    expect(result.wasTruncated).toBe(true);
    expect(result.finalLength).toBeLessThanOrEqual(result.hardLimit);
    expect(result.prompt).toContain('Keep identity, geometry, logos, and visible text exact and unchanged.');
  });
});
