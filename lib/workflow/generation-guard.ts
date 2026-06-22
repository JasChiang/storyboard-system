import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { normalizeTag } from '@/lib/references/scene-references';

const TAG_PATTERN = /^<[^<>]+>$/;

export type GenerationStage = 'image_start' | 'image_end' | 'video';

export interface GenerationBlocker {
  code: string;
  message: string;
}

interface SceneGenerationGuardInput {
  stage: GenerationStage;
  scene: Pick<Scene, 'qaStatus' | 'qaIssues' | 'requiredReferences' | 'videoMode'>;
  projectReferences?: Array<Pick<ProjectReference, 'name' | 'type'>>;
  effectiveStartFrameUrl?: string;
  allowPendingStartFrame?: boolean;
}

// Seedance ref / t2v 模式不依賴首幀：ref 吃多模態參考、t2v 純文字。
// 圖片生成階段也套用同規則（不對 ref/t2v 場景強制首幀）。
function sceneSkipsStartFrame(videoMode?: Scene['videoMode']): boolean {
  return videoMode === 'reference' || videoMode === 'text';
}

function toAvailableReferenceTags(
  references: Array<Pick<ProjectReference, 'name' | 'type'>>
): Set<string> {
  const tags = new Set<string>();
  references
    .filter((reference) => reference.type !== 'style')
    .forEach((reference) => {
      if (!reference.name || typeof reference.name !== 'string') return;
      const normalized = normalizeTag(reference.name);
      if (normalized) tags.add(normalized);
    });
  return tags;
}


export function getSceneGenerationBlockers(input: SceneGenerationGuardInput): GenerationBlocker[] {
  const blockers: GenerationBlocker[] = [];
  const rawRequiredRefs = Array.isArray(input.scene.requiredReferences) ? input.scene.requiredReferences : [];
  const invalidRequiredRefs = rawRequiredRefs
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .filter((value) => !TAG_PATTERN.test(value));
  const normalizedRequiredRefs = rawRequiredRefs
    .map((value) => (typeof value === 'string' ? normalizeTag(value) : ''))
    .filter(Boolean);
  const availableReferenceTags = toAvailableReferenceTags(input.projectReferences || []);

  if (input.scene.qaStatus === 'block') {
    const issueText = Array.isArray(input.scene.qaIssues) && input.scene.qaIssues.length > 0
      ? `（${input.scene.qaIssues[0]}）`
      : '';
    blockers.push({
      code: 'qa_blocked',
      message: `此場景被 QA 阻擋，請先回分鏡修正${issueText}`,
    });
  }

  if (invalidRequiredRefs.length > 0) {
    blockers.push({
      code: 'invalid_required_reference_tags',
      message: `requiredReferences 格式錯誤：${invalidRequiredRefs.join(', ')}。請使用 <名稱> 格式。`,
    });
  }

  if (normalizedRequiredRefs.length > 0) {
    if (availableReferenceTags.size === 0) {
      blockers.push({
        code: 'required_references_missing_project_refs',
        message: '此場景設定了 requiredReferences，但專案中沒有可對應的角色/商品參考圖。',
      });
    } else {
      const missingTags = normalizedRequiredRefs.filter((tag) => !availableReferenceTags.has(tag));
      if (missingTags.length > 0) {
        blockers.push({
          code: 'required_references_not_found',
          message: `找不到 requiredReferences 對應參考：${missingTags.join(', ')}`,
        });
      }
    }
  }

  // Note: referencePlan view mismatches are NOT blockers.
  // Users typically upload 1-2 angles per reference; the model can infer
  // other views from available references. The reference routing pipeline
  // will select the closest available angle automatically.

  const requiresStartFrame = input.stage === 'image_end' || input.stage === 'video';
  const scenarioSkipsFrame = sceneSkipsStartFrame(input.scene.videoMode);
  if (
    requiresStartFrame
    && !input.allowPendingStartFrame
    && !scenarioSkipsFrame
    && !input.effectiveStartFrameUrl
  ) {
    blockers.push({
      code: 'missing_start_frame',
      message: input.stage === 'video'
        ? '影片生成需要有效首幀，請先在圖片頁生成首幀。'
        : '尾幀生成需要有效首幀，請先生成首幀。',
    });
  }

  return blockers;
}

export function formatBlockersForAlert(blockers: GenerationBlocker[]): string {
  if (blockers.length === 0) return '';
  return blockers.map((blocker, index) => `${index + 1}. ${blocker.message}`).join('\n');
}
