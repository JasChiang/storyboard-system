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
  scene: Pick<Scene, 'qaStatus' | 'qaIssues' | 'requiredReferences'>;
  projectReferences?: Array<Pick<ProjectReference, 'name' | 'type'>>;
  effectiveStartFrameUrl?: string;
  allowPendingStartFrame?: boolean;
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

  const requiresStartFrame = input.stage === 'image_end' || input.stage === 'video';
  if (requiresStartFrame && !input.allowPendingStartFrame && !input.effectiveStartFrameUrl) {
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
