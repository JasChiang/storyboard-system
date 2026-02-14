import type { Storyboard, Scene } from '@/lib/types/storyboard';
import type { StoryboardQaIssue } from '@/lib/db/sqlite';

const HIGH = 30;
const MEDIUM = 12;
const LOW = 5;

function issue(
  severity: 'high' | 'medium' | 'low',
  code: string,
  message: string,
  scene?: Scene
): StoryboardQaIssue {
  return {
    severity,
    code,
    message,
    sceneId: scene?.id,
    sceneNumber: scene?.sceneNumber,
  };
}

export function validateStoryboard(storyboard: Storyboard): {
  score: number;
  summary: string;
  issues: StoryboardQaIssue[];
} {
  const issues: StoryboardQaIssue[] = [];

  storyboard.scenes.forEach((scene, index) => {
    const hasCharactersTag = Array.isArray(scene.charactersUsed) && scene.charactersUsed.length > 0;
    const hasProductsTag = Array.isArray(scene.productsUsed) && scene.productsUsed.length > 0;

    if (!hasCharactersTag && !hasProductsTag) {
      issues.push(issue('medium', 'missing_entity_tags', '場景缺少 charactersUsed/productsUsed，後續一致性過濾會變弱。', scene));
    }

    if ((scene.transitionToNext?.type === 'continuation' || scene.transitionToNext?.useEndFrameAsNextStart) && !scene.requiresEndFrame) {
      issues.push(issue('high', 'continuation_without_endframe', '設定了 continuation 但此場景沒有啟用尾幀。', scene));
    }

    if (scene.requiresEndFrame && !scene.endFrameDescription?.trim()) {
      issues.push(issue('high', 'missing_endframe_description', '此場景啟用了尾幀，但沒有尾幀描述。', scene));
    }
    if (scene.requiresEndFrame && !scene.endFrameDelta?.trim()) {
      issues.push(issue('medium', 'missing_endframe_delta', '此場景啟用了尾幀，但沒有 endFrameDelta（差異描述）。', scene));
    }

    if (scene.duration <= 0) {
      issues.push(issue('high', 'invalid_duration', '場景時長必須大於 0。', scene));
    }

    if (!scene.cameraMovement?.trim()) {
      issues.push(issue('low', 'missing_camera_movement', '場景缺少運鏡描述，影片提示詞可能過於平。', scene));
    }
    if (!scene.startComposition?.trim()) {
      issues.push(issue('low', 'missing_start_composition', '缺少 startComposition，首幀構圖錨點較弱。', scene));
    }
    if (!scene.continuityLock?.trim()) {
      issues.push(issue('medium', 'missing_continuity_lock', '缺少 continuityLock，首尾幀幾何延續風險較高。', scene));
    }

    if (!scene.shotIntent?.trim()) {
      issues.push(issue('low', 'missing_shot_intent', '缺少 shotIntent，鏡頭意圖與節奏控制較弱。', scene));
    }

    if (index > 0 && !scene.changeFromPrev?.trim()) {
      issues.push(issue('low', 'missing_change_from_prev', '缺少 changeFromPrev，連場變化語意不完整。', scene));
    }

    if (index > 0 && !scene.continuityAnchor?.trim()) {
      issues.push(issue('medium', 'missing_continuity_anchor', '缺少 continuityAnchor，首尾幀或跨鏡頭延續可能漂移。', scene));
    }
  });

  let score = 100;
  issues.forEach((i) => {
    if (i.severity === 'high') score -= HIGH;
    else if (i.severity === 'medium') score -= MEDIUM;
    else score -= LOW;
  });
  score = Math.max(0, score);

  const high = issues.filter((i) => i.severity === 'high').length;
  const medium = issues.filter((i) => i.severity === 'medium').length;
  const low = issues.filter((i) => i.severity === 'low').length;

  const summary =
    high > 0
      ? `QA 未通過：${high} 個高風險、${medium} 個中風險、${low} 個低風險問題。`
      : `QA 通過：${medium} 個中風險、${low} 個低風險提示。`;

  return { score, summary, issues };
}
