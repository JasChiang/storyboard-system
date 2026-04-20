import type {
    ProjectReference,
    Scene,
    SceneConsistencyEntityCheck,
    SceneConsistencyReport,
    ConsistencySeverity,
} from '@/lib/types/storyboard';
import { normalizeTag } from '@/lib/references/scene-references';

const SEVERITY_VALUES: ConsistencySeverity[] = ['pass', 'warn', 'fail'];

export interface ConsistencyCheckEntity {
    tag: string;
    entityType: 'character' | 'product';
    referenceImageUrls: string[];
    referenceAngle?: SceneConsistencyEntityCheck['referenceAngle'];
    identityCore?: string;
    mustKeepFeatures?: string[];
}

export interface ConsistencyCheckRequest {
    sceneId: string;
    sceneNumber: number;
    frameType: 'start' | 'end';
    frameImageUrl: string;
    entities: ConsistencyCheckEntity[];
}

/**
 * Build request entities from a scene + project references, restricted to
 * characters / products the scene actually uses.
 */
export function buildConsistencyEntities(
    scene: Pick<Scene, 'charactersUsed' | 'productsUsed' | 'referenceViewHints' | 'referencePlan'>,
    references: ProjectReference[]
): ConsistencyCheckEntity[] {
    const tagSources: Array<{ tag: string; entityType: 'character' | 'product' }> = [];
    for (const tag of scene.charactersUsed || []) {
        if (typeof tag === 'string' && tag.trim()) tagSources.push({ tag, entityType: 'character' });
    }
    for (const tag of scene.productsUsed || []) {
        if (typeof tag === 'string' && tag.trim()) tagSources.push({ tag, entityType: 'product' });
    }
    if (tagSources.length === 0) return [];

    const byNormalized = new Map<string, ProjectReference[]>();
    for (const ref of references) {
        if (ref.type !== 'character' && ref.type !== 'product') continue;
        if (!ref.name || !ref.url) continue;
        const key = normalizeTag(ref.name);
        if (!key) continue;
        const list = byNormalized.get(key) || [];
        list.push(ref);
        byNormalized.set(key, list);
    }

    const out: ConsistencyCheckEntity[] = [];
    const seenTags = new Set<string>();
    for (const { tag, entityType } of tagSources) {
        const normalized = normalizeTag(tag);
        if (!normalized || seenTags.has(normalized)) continue;
        seenTags.add(normalized);
        const candidates = byNormalized.get(normalized) || [];
        if (candidates.length === 0) continue;

        const hint = scene.referenceViewHints?.[tag];
        const planItem = (scene.referencePlan || []).find((item) => normalizeTag(item.tag) === normalized);
        const requestedView = planItem?.requestedView || hint;
        const sorted = [...candidates].sort((a, b) => {
            const aMatch = requestedView && a.angle === requestedView ? 1 : 0;
            const bMatch = requestedView && b.angle === requestedView ? 1 : 0;
            return bMatch - aMatch;
        });

        const urls: string[] = [];
        for (const ref of sorted) {
            if (ref.url && !urls.includes(ref.url)) urls.push(ref.url);
            if (urls.length >= 3) break;
        }
        const primary = sorted[0];
        out.push({
            tag,
            entityType,
            referenceImageUrls: urls,
            referenceAngle: primary?.angle,
            identityCore: primary?.identityCore || undefined,
            mustKeepFeatures: primary?.mustKeepFeatures || undefined,
        });
    }
    return out;
}

/**
 * Given a request, produce the system prompt text we feed to the vision model.
 * The response is expected to be JSON matching SceneConsistencyReport's entityChecks.
 */
export function buildConsistencyPrompt(request: ConsistencyCheckRequest): string {
    const entityLines = request.entities.map((entity, index) => {
        const angle = entity.referenceAngle ? ` [${entity.referenceAngle} view]` : '';
        const core = entity.identityCore ? ` | identity: ${entity.identityCore}` : '';
        const mustKeep = entity.mustKeepFeatures && entity.mustKeepFeatures.length > 0
            ? ` | must_keep: ${entity.mustKeepFeatures.join(' / ')}`
            : '';
        return `${index + 1}. ${entity.tag} (${entity.entityType})${angle}${core}${mustKeep}`;
    }).join('\n');

    return `你是影像一致性稽核員。我會給你一張場景${request.frameType === 'end' ? '尾幀' : '首幀'}（第一張圖），以及多張角色 / 商品參考圖（之後的圖，按下方清單順序）。請逐個實體判斷「場景圖中出現的這個角色/商品，是否與其參考圖一致」。

實體清單（與參考圖順序對齊，一個實體可能對應多張參考圖，請取其共同身份特徵為準）：
${entityLines}

嚴格規則：
1) 只輸出 JSON，不可有其他文字。
2) 若某個實體在場景圖中「看不到」，severity 設為 "warn"，differences 填 ["not visible in frame"]，score 填 0.5。
3) score 範圍 0-1，score >= 0.85 判為 pass，0.6-0.85 判為 warn，< 0.6 判為 fail。
4) differences 必須具體描述（例：「耳機顏色從白變灰」、「logo 位置偏移」），不可只寫「不一致」。
5) matched 列出該實體確認一致的關鍵特徵（1-3 條）。

輸出 JSON 結構：
{
  "overallScore": number,
  "overall": "pass" | "warn" | "fail",
  "notes": "string",
  "entityChecks": [
    {
      "tag": "string (必須與清單相同)",
      "score": number,
      "severity": "pass" | "warn" | "fail",
      "differences": ["string"],
      "matched": ["string"]
    }
  ]
}`;
}

function clampScore(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(1, num));
}

function toSeverity(value: unknown, score: number): ConsistencySeverity {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase() as ConsistencySeverity;
        if (SEVERITY_VALUES.includes(normalized)) return normalized;
    }
    if (score >= 0.85) return 'pass';
    if (score >= 0.6) return 'warn';
    return 'fail';
}

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
}

/**
 * Parse the raw vision response into a structured report. Tolerant to model
 * variance (missing entities, wrong casing, stray text).
 */
export function parseConsistencyResponse(
    raw: string,
    request: ConsistencyCheckRequest,
    modelUsed: string
): SceneConsistencyReport {
    const cleaned = (raw || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '');

    let parsed: Record<string, unknown> = {};
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        parsed = {};
    }

    const responseByTag = new Map<string, Record<string, unknown>>();
    const rawChecks = Array.isArray(parsed.entityChecks) ? parsed.entityChecks : [];
    for (const item of rawChecks) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const tag = typeof record.tag === 'string' ? record.tag : '';
        const normalized = normalizeTag(tag);
        if (!normalized) continue;
        responseByTag.set(normalized, record);
    }

    const entityChecks: SceneConsistencyEntityCheck[] = request.entities.map((entity) => {
        const key = normalizeTag(entity.tag) || entity.tag;
        const record = responseByTag.get(key) || {};
        const score = clampScore(record.score);
        const severity = toSeverity(record.severity, score);
        return {
            tag: entity.tag,
            entityType: entity.entityType,
            referenceAngle: entity.referenceAngle,
            score,
            severity,
            differences: toStringArray(record.differences),
            matched: toStringArray(record.matched),
        };
    });

    const providedOverallScore = clampScore(parsed.overallScore);
    const overallScore = entityChecks.length === 0
        ? providedOverallScore
        : providedOverallScore > 0
            ? providedOverallScore
            : entityChecks.reduce((sum, check) => sum + check.score, 0) / entityChecks.length;
    const overall = toSeverity(parsed.overall, overallScore);
    const notes = typeof parsed.notes === 'string' ? parsed.notes.trim() || undefined : undefined;

    return {
        checkedAt: new Date().toISOString(),
        modelUsed,
        frameType: request.frameType,
        overall,
        overallScore,
        entityChecks,
        notes,
    };
}

/**
 * Summarize a report into a one-liner suited for UI tooltips.
 */
export function summarizeConsistencyReport(report: SceneConsistencyReport): string {
    if (report.entityChecks.length === 0) return '無實體可比對';
    const failed = report.entityChecks.filter((check) => check.severity === 'fail');
    const warned = report.entityChecks.filter((check) => check.severity === 'warn');
    if (failed.length > 0) {
        return `${failed.length} 個實體偏差：${failed.map((check) => check.tag).join('、')}`;
    }
    if (warned.length > 0) {
        return `${warned.length} 個實體需檢查：${warned.map((check) => check.tag).join('、')}`;
    }
    return `全部 ${report.entityChecks.length} 個實體一致（${Math.round(report.overallScore * 100)}%）`;
}
