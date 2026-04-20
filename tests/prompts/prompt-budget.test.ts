import { describe, expect, it } from 'vitest';
import { estimatePromptBudget, formatBudgetLabel } from '@/lib/prompts/prompt-budget';
import type { ProjectReference } from '@/lib/types/storyboard';

const makeRef = (overrides: Partial<ProjectReference>): ProjectReference => ({
    id: 'r',
    url: 'https://x/img.png',
    description: '',
    type: 'character',
    descriptionSource: 'manual',
    ...overrides,
});

describe('estimatePromptBudget', () => {
    it('handles empty inputs with the template base only', () => {
        const result = estimatePromptBudget({ userPrompt: '', references: [], templateBaseChars: 4000 });
        expect(result.estimatedChars).toBe(4000);
        expect(result.level).toBe('ok');
        expect(result.breakdown.userPrompt).toBe(0);
        expect(result.breakdown.references).toBe(0);
        expect(result.breakdown.templateBase).toBe(4000);
    });

    it('sums user prompt length', () => {
        const result = estimatePromptBudget({
            userPrompt: 'a'.repeat(1000),
            references: [],
            templateBaseChars: 4000,
        });
        expect(result.breakdown.userPrompt).toBe(1000);
        expect(result.estimatedChars).toBe(5000);
    });

    it('sums reference description fields and fixed overhead', () => {
        const ref = makeRef({
            description: 'x'.repeat(500),
            aiDescription: 'y'.repeat(300),
            identityCore: 'z'.repeat(100),
            mustKeepFeatures: ['alpha', 'beta'],
        });
        const result = estimatePromptBudget({
            userPrompt: '',
            references: [ref, ref],
            templateBaseChars: 0,
        });
        expect(result.breakdown.references).toBeGreaterThan(1000);
    });

    it('crosses into warn level around 8K chars', () => {
        const ref = makeRef({ description: 'x'.repeat(3500) });
        const result = estimatePromptBudget({
            userPrompt: 'y'.repeat(500),
            references: [ref],
            templateBaseChars: 4000,
        });
        expect(result.level === 'warn' || result.level === 'danger').toBe(true);
    });

    it('crosses into danger level around 14K chars', () => {
        const ref = makeRef({ description: 'x'.repeat(6000) });
        const result = estimatePromptBudget({
            userPrompt: 'y'.repeat(500),
            references: [ref, ref],
            templateBaseChars: 4000,
        });
        expect(result.level).toBe('danger');
    });
});

describe('formatBudgetLabel', () => {
    it('returns plain label when ok', () => {
        const label = formatBudgetLabel({
            estimatedChars: 5000,
            level: 'ok',
            breakdown: { userPrompt: 0, references: 0, templateBase: 0 },
        });
        expect(label).toContain('5.0K');
        expect(label).not.toContain('⚠️');
    });

    it('flags warning for warn level', () => {
        const label = formatBudgetLabel({
            estimatedChars: 9000,
            level: 'warn',
            breakdown: { userPrompt: 0, references: 0, templateBase: 0 },
        });
        expect(label).toContain('接近上限');
    });

    it('flags danger for danger level', () => {
        const label = formatBudgetLabel({
            estimatedChars: 15000,
            level: 'danger',
            breakdown: { userPrompt: 0, references: 0, templateBase: 0 },
        });
        expect(label).toContain('⚠️');
        expect(label).toContain('偏高');
    });
});
