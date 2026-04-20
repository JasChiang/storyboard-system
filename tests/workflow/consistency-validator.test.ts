import { describe, expect, it } from 'vitest';
import {
    buildConsistencyEntities,
    buildConsistencyPrompt,
    parseConsistencyResponse,
    summarizeConsistencyReport,
    type ConsistencyCheckRequest,
} from '@/lib/workflow/consistency-validator';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';

const mkRef = (overrides: Partial<ProjectReference>): ProjectReference => ({
    id: overrides.id || `ref-${Math.random()}`,
    name: overrides.name || 'Alice',
    type: overrides.type || 'character',
    url: overrides.url ?? 'https://example.com/alice.png',
    description: overrides.description || '',
    descriptionSource: overrides.descriptionSource || 'manual',
    angle: overrides.angle,
    identityCore: overrides.identityCore,
    mustKeepFeatures: overrides.mustKeepFeatures,
    ...overrides,
});

describe('buildConsistencyEntities', () => {
    it('returns empty when scene has no characters or products', () => {
        const scene = {
            charactersUsed: [],
            productsUsed: [],
        } as unknown as Scene;
        expect(buildConsistencyEntities(scene, [])).toEqual([]);
    });

    it('matches references by normalized tag and de-duplicates URLs', () => {
        const refs: ProjectReference[] = [
            mkRef({ name: 'Alice', angle: 'front', url: 'https://x/a-front.png' }),
            mkRef({ name: 'Alice', angle: 'side', url: 'https://x/a-side.png' }),
            mkRef({ name: 'Alice', angle: 'side', url: 'https://x/a-side.png' }),
        ];
        const scene = {
            charactersUsed: ['<Alice>'],
            productsUsed: [],
        } as unknown as Scene;

        const entities = buildConsistencyEntities(scene, refs);
        expect(entities).toHaveLength(1);
        expect(entities[0].tag).toBe('<Alice>');
        expect(entities[0].entityType).toBe('character');
        expect(entities[0].referenceImageUrls).toEqual([
            'https://x/a-front.png',
            'https://x/a-side.png',
        ]);
    });

    it('prioritises references matching requestedView from referencePlan', () => {
        const refs: ProjectReference[] = [
            mkRef({ name: 'Alice', angle: 'front', url: 'https://x/front.png' }),
            mkRef({ name: 'Alice', angle: 'side', url: 'https://x/side.png' }),
        ];
        const scene = {
            charactersUsed: ['<Alice>'],
            productsUsed: [],
            referencePlan: [{ tag: '<Alice>', requestedView: 'side', required: true }],
        } as unknown as Scene;

        const entities = buildConsistencyEntities(scene, refs);
        expect(entities[0].referenceImageUrls[0]).toBe('https://x/side.png');
        expect(entities[0].referenceAngle).toBe('side');
    });

    it('falls back to referenceViewHints when referencePlan is missing', () => {
        const refs: ProjectReference[] = [
            mkRef({ name: 'Alice', angle: 'front', url: 'https://x/front.png' }),
            mkRef({ name: 'Alice', angle: 'three_quarter', url: 'https://x/3q.png' }),
        ];
        const scene = {
            charactersUsed: ['<Alice>'],
            productsUsed: [],
            referenceViewHints: { '<Alice>': 'three_quarter' },
        } as unknown as Scene;

        const entities = buildConsistencyEntities(scene, refs);
        expect(entities[0].referenceImageUrls[0]).toBe('https://x/3q.png');
    });

    it('skips entities whose references have no usable URL', () => {
        const refs: ProjectReference[] = [
            mkRef({ name: 'Bob', url: '' }),
        ];
        const scene = {
            charactersUsed: ['<Bob>'],
            productsUsed: [],
        } as unknown as Scene;
        expect(buildConsistencyEntities(scene, refs)).toEqual([]);
    });

    it('caps reference URLs per entity at 3', () => {
        const refs: ProjectReference[] = Array.from({ length: 5 }).map((_, i) =>
            mkRef({ name: 'Alice', angle: 'front', url: `https://x/a${i}.png`, id: `id-${i}` })
        );
        const scene = {
            charactersUsed: ['<Alice>'],
            productsUsed: [],
        } as unknown as Scene;

        const entities = buildConsistencyEntities(scene, refs);
        expect(entities[0].referenceImageUrls).toHaveLength(3);
    });

    it('handles both characters and products with correct entityType', () => {
        const refs: ProjectReference[] = [
            mkRef({ name: 'Alice', type: 'character', url: 'https://x/a.png' }),
            mkRef({ name: 'iPhone', type: 'product', url: 'https://x/p.png' }),
        ];
        const scene = {
            charactersUsed: ['<Alice>'],
            productsUsed: ['<iPhone>'],
        } as unknown as Scene;

        const entities = buildConsistencyEntities(scene, refs);
        expect(entities).toHaveLength(2);
        const alice = entities.find((e) => e.tag === '<Alice>');
        const iphone = entities.find((e) => e.tag === '<iPhone>');
        expect(alice?.entityType).toBe('character');
        expect(iphone?.entityType).toBe('product');
    });
});

describe('buildConsistencyPrompt', () => {
    it('lists each entity with index and metadata', () => {
        const request: ConsistencyCheckRequest = {
            sceneId: 's1',
            sceneNumber: 1,
            frameType: 'start',
            frameImageUrl: 'https://x/frame.png',
            entities: [
                {
                    tag: '<Alice>',
                    entityType: 'character',
                    referenceImageUrls: ['https://x/a.png'],
                    referenceAngle: 'front',
                    identityCore: 'red hair, freckles',
                    mustKeepFeatures: ['red bow'],
                },
            ],
        };
        const prompt = buildConsistencyPrompt(request);
        expect(prompt).toContain('1. <Alice> (character)');
        expect(prompt).toContain('[front view]');
        expect(prompt).toContain('identity: red hair, freckles');
        expect(prompt).toContain('must_keep: red bow');
        expect(prompt).toContain('首幀');
    });

    it('uses 尾幀 wording when frameType is end', () => {
        const prompt = buildConsistencyPrompt({
            sceneId: 's1',
            sceneNumber: 1,
            frameType: 'end',
            frameImageUrl: 'https://x/frame.png',
            entities: [
                { tag: '<X>', entityType: 'product', referenceImageUrls: ['https://x/x.png'] },
            ],
        });
        expect(prompt).toContain('尾幀');
    });
});

describe('parseConsistencyResponse', () => {
    const baseRequest: ConsistencyCheckRequest = {
        sceneId: 's1',
        sceneNumber: 1,
        frameType: 'start',
        frameImageUrl: 'https://x/frame.png',
        entities: [
            { tag: '<Alice>', entityType: 'character', referenceImageUrls: ['https://x/a.png'], referenceAngle: 'front' },
            { tag: '<iPhone>', entityType: 'product', referenceImageUrls: ['https://x/p.png'] },
        ],
    };

    it('parses well-formed JSON', () => {
        const raw = JSON.stringify({
            overallScore: 0.9,
            overall: 'pass',
            notes: 'looks good',
            entityChecks: [
                { tag: '<Alice>', score: 0.95, severity: 'pass', differences: [], matched: ['red hair'] },
                { tag: '<iPhone>', score: 0.85, severity: 'pass', differences: [], matched: ['black bezel'] },
            ],
        });

        const report = parseConsistencyResponse(raw, baseRequest, 'gemini-2.0-flash');
        expect(report.overall).toBe('pass');
        expect(report.overallScore).toBeCloseTo(0.9);
        expect(report.entityChecks).toHaveLength(2);
        expect(report.entityChecks[0].score).toBeCloseTo(0.95);
        expect(report.entityChecks[0].matched).toEqual(['red hair']);
        expect(report.modelUsed).toBe('gemini-2.0-flash');
        expect(report.frameType).toBe('start');
        expect(report.notes).toBe('looks good');
    });

    it('strips ```json fences from raw response', () => {
        const raw = '```json\n{"overall":"warn","entityChecks":[]}\n```';
        const report = parseConsistencyResponse(raw, { ...baseRequest, entities: [] }, 'm');
        expect(report.overall).toBe('warn');
    });

    it('returns fail-safe report when JSON is malformed', () => {
        const report = parseConsistencyResponse('not json at all', baseRequest, 'm');
        expect(report.entityChecks).toHaveLength(2);
        expect(report.entityChecks.every((c) => c.score === 0)).toBe(true);
        expect(report.entityChecks.every((c) => c.severity === 'fail')).toBe(true);
    });

    it('aligns response checks back to request entities by tag (case-insensitive)', () => {
        const raw = JSON.stringify({
            entityChecks: [
                { tag: '<alice>', score: 0.9, severity: 'pass', differences: [], matched: [] },
            ],
        });
        const report = parseConsistencyResponse(raw, baseRequest, 'm');
        const alice = report.entityChecks.find((c) => c.tag === '<Alice>');
        expect(alice?.score).toBeCloseTo(0.9);
        expect(alice?.severity).toBe('pass');
        const iphone = report.entityChecks.find((c) => c.tag === '<iPhone>');
        expect(iphone?.score).toBe(0);
    });

    it('clamps invalid scores into 0-1 range', () => {
        const raw = JSON.stringify({
            entityChecks: [
                { tag: '<Alice>', score: 5, severity: 'pass', differences: [], matched: [] },
                { tag: '<iPhone>', score: -2, severity: 'fail', differences: [], matched: [] },
            ],
        });
        const report = parseConsistencyResponse(raw, baseRequest, 'm');
        expect(report.entityChecks.find((c) => c.tag === '<Alice>')?.score).toBe(1);
        expect(report.entityChecks.find((c) => c.tag === '<iPhone>')?.score).toBe(0);
    });

    it('infers severity from score when severity is missing', () => {
        const raw = JSON.stringify({
            entityChecks: [
                { tag: '<Alice>', score: 0.7, differences: [], matched: [] },
                { tag: '<iPhone>', score: 0.4, differences: [], matched: [] },
            ],
        });
        const report = parseConsistencyResponse(raw, baseRequest, 'm');
        expect(report.entityChecks.find((c) => c.tag === '<Alice>')?.severity).toBe('warn');
        expect(report.entityChecks.find((c) => c.tag === '<iPhone>')?.severity).toBe('fail');
    });

    it('computes overallScore from entity averages when not provided', () => {
        const raw = JSON.stringify({
            entityChecks: [
                { tag: '<Alice>', score: 0.8, severity: 'pass', differences: [], matched: [] },
                { tag: '<iPhone>', score: 0.6, severity: 'warn', differences: [], matched: [] },
            ],
        });
        const report = parseConsistencyResponse(raw, baseRequest, 'm');
        expect(report.overallScore).toBeCloseTo(0.7);
    });
});

describe('summarizeConsistencyReport', () => {
    it('reports failed entities first', () => {
        const summary = summarizeConsistencyReport({
            checkedAt: '',
            modelUsed: 'm',
            frameType: 'start',
            overall: 'fail',
            overallScore: 0.4,
            entityChecks: [
                { tag: '<Alice>', entityType: 'character', score: 0.4, severity: 'fail', differences: ['x'], matched: [] },
                { tag: '<iPhone>', entityType: 'product', score: 0.9, severity: 'pass', differences: [], matched: [] },
            ],
        });
        expect(summary).toContain('1 個實體偏差');
        expect(summary).toContain('<Alice>');
    });

    it('reports warned entities when no failures', () => {
        const summary = summarizeConsistencyReport({
            checkedAt: '',
            modelUsed: 'm',
            frameType: 'start',
            overall: 'warn',
            overallScore: 0.7,
            entityChecks: [
                { tag: '<Alice>', entityType: 'character', score: 0.7, severity: 'warn', differences: [], matched: [] },
            ],
        });
        expect(summary).toContain('1 個實體需檢查');
    });

    it('reports all-consistent when everything passes', () => {
        const summary = summarizeConsistencyReport({
            checkedAt: '',
            modelUsed: 'm',
            frameType: 'start',
            overall: 'pass',
            overallScore: 0.95,
            entityChecks: [
                { tag: '<Alice>', entityType: 'character', score: 0.95, severity: 'pass', differences: [], matched: [] },
            ],
        });
        expect(summary).toContain('全部 1 個實體一致');
        expect(summary).toContain('95%');
    });

    it('handles empty entity list', () => {
        const summary = summarizeConsistencyReport({
            checkedAt: '',
            modelUsed: 'm',
            frameType: 'start',
            overall: 'pass',
            overallScore: 0,
            entityChecks: [],
        });
        expect(summary).toBe('無實體可比對');
    });
});
