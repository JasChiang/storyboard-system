import { describe, expect, it } from 'vitest';
import { buildIdentityLockPromptLine, buildStructuredIdentityLock } from '@/lib/references/identity-lock';

describe('buildStructuredIdentityLock', () => {
  it('does not classify "texture" as logo/text', () => {
    const lock = buildStructuredIdentityLock({
      type: 'product',
      description: 'Silver brushed metallic texture',
      identityCore: '',
      guidelines: '',
      mustKeepFeatures: ['Silver brushed metallic texture with horizontal grain'],
    });

    expect(lock).toBeDefined();
    const line = buildIdentityLockPromptLine(lock!, '<Product>');
    expect(line).toContain('material=');
    expect(line).not.toContain('logo/text=Silver brushed metallic texture');
  });

  it('keeps explicit visible text constraints in logo/text bucket', () => {
    const lock = buildStructuredIdentityLock({
      type: 'product',
      description: 'Phone package',
      identityCore: '',
      guidelines: '',
      mustKeepFeatures: ['Visible text "SAMSUNG" must stay unchanged'],
    });

    expect(lock?.logoText?.some((item) => item.includes('Visible text'))).toBe(true);
  });
});
