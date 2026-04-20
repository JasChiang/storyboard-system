import { describe, expect, it } from 'vitest';
import { detectTemplateConflicts } from '@/lib/storyboard/template-conflict';
import type { ProjectReference } from '@/lib/types/storyboard';

const productRef = (): ProjectReference => ({
    id: 'r1',
    url: 'https://x/p.png',
    description: 'product',
    type: 'product',
    descriptionSource: 'manual',
});

const characterRef = (): ProjectReference => ({
    id: 'r2',
    url: 'https://x/c.png',
    description: 'character',
    type: 'character',
    descriptionSource: 'manual',
});

const environmentRef = (): ProjectReference => ({
    id: 'r3',
    url: 'https://x/e.png',
    description: 'env',
    type: 'environment',
    descriptionSource: 'manual',
});

describe('detectTemplateConflicts', () => {
    it('returns no warnings when inputs match defaults', () => {
        expect(
            detectTemplateConflicts({
                templateId: 'default',
                targetDurationSec: 30,
                references: [],
            })
        ).toEqual([]);
    });

    it('warns when Shorts template is too long', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'shorts_hook',
            targetDurationSec: 60,
            references: [],
        });
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0].level).toBe('warn');
        expect(warnings[0].message).toContain('Shorts');
    });

    it('warns when Shorts has too many manual scenes', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'shorts_hook',
            targetDurationSec: 30,
            manualSceneCount: 8,
            references: [],
        });
        expect(warnings.some((w) => w.message.includes('鉤子'))).toBe(true);
    });

    it('informs tech_product template when no product reference provided', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'tech_product',
            targetDurationSec: 30,
            references: [characterRef()],
        });
        expect(warnings.some((w) => w.level === 'info' && w.message.includes('商品圖'))).toBe(true);
    });

    it('does not warn tech_product when product reference exists', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'tech_product',
            targetDurationSec: 30,
            references: [productRef()],
        });
        expect(warnings.some((w) => w.message.includes('商品圖'))).toBe(false);
    });

    it('warns when commercial/tech_product has excessive scene count', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'commercial',
            targetDurationSec: 30,
            manualSceneCount: 12,
            references: [productRef()],
        });
        expect(warnings.some((w) => w.message.includes('12'))).toBe(true);
    });

    it('warns documentary template if duration is too short', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'documentary',
            targetDurationSec: 10,
            references: [],
        });
        expect(warnings.length).toBe(1);
        expect(warnings[0].level).toBe('warn');
    });

    it('suggests anchor/product references when only environment refs are provided', () => {
        const warnings = detectTemplateConflicts({
            templateId: 'default',
            targetDurationSec: 30,
            references: [environmentRef()],
        });
        expect(warnings.some((w) => w.message.includes('環境'))).toBe(true);
    });
});
