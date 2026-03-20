import type { Storyboard, Scene } from '@/lib/types/storyboard';
import type { StoryboardQaIssue } from '@/lib/db/sqlite';
import { getSceneReferencePlan } from '@/lib/references/reference-plan';

const HIGH = 30;
const MEDIUM = 12;
const LOW = 5;
const TAG_PATTERN = /^<[^<>]+>$/;

function normalizeTag(raw: string): string {
  const trimmed = raw.replace(/^<|>$/g, '').trim().toLowerCase();
  return trimmed ? `<${trimmed}>` : '';
}

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
  sceneReports: Array<{
    sceneId?: string;
    sceneNumber?: number;
    status: 'pass' | 'warn' | 'block';
    issues: StoryboardQaIssue[];
  }>;
} {
  const issues: StoryboardQaIssue[] = [];
  const availableReferenceTags = new Set<string>(
    (storyboard.projectReferences || [])
      .map((reference) => (typeof reference.name === 'string' ? normalizeTag(reference.name) : ''))
      .filter(Boolean)
  );

  if (storyboard.sharedAnchors && !Array.isArray(storyboard.sharedAnchors)) {
    issues.push(issue('medium', 'invalid_shared_anchors', 'sharedAnchors 必須是字串陣列。'));
  }
  if (storyboard.sharedContinuityDirectives && !Array.isArray(storyboard.sharedContinuityDirectives)) {
    issues.push(issue('medium', 'invalid_shared_directives', 'sharedContinuityDirectives 必須是陣列。'));
  }
  (storyboard.sharedContinuityDirectives || []).forEach((directive, index) => {
    if (!directive.anchorLabel?.trim() || !directive.directive?.trim()) {
      issues.push(issue('medium', 'invalid_shared_directive_item', `sharedContinuityDirectives[${index}] 缺少 anchorLabel 或 directive。`));
    }
  });

  storyboard.scenes.forEach((scene, index) => {
    const hasCharactersTag = Array.isArray(scene.charactersUsed) && scene.charactersUsed.length > 0;
    const hasProductsTag = Array.isArray(scene.productsUsed) && scene.productsUsed.length > 0;
    const hasRequiredReferences = Array.isArray(scene.requiredReferences);
    const hasTransition = Boolean(scene.transitionToNext?.type);
    const hasDescription = Boolean(scene.description?.trim());
    const hasCameraMovement = Boolean(scene.cameraMovement?.trim());
    const hasSceneIntent = Boolean(scene.sceneIntent?.trim());
    const hasStartComposition = Boolean(scene.startComposition?.trim());
    const hasSubjectMotion = Boolean(scene.subjectMotion?.trim());
    const hasContinuityLock = Boolean(scene.continuityLock?.trim());
    const hasShotIntent = Boolean(scene.shotIntent?.trim());
    const hasContinuityAnchor = Boolean(scene.continuityAnchor?.trim());
    const hasChangeFromPrev = Boolean(scene.changeFromPrev?.trim());
    const hasHookScore = typeof scene.hookScore === 'number';
    const hasHookScoreReason = typeof scene.hookScoreReason === 'string' && scene.hookScoreReason.trim().length > 0;
    const hasRetentionRisk = typeof scene.retentionRisk === 'string' && scene.retentionRisk.trim().length > 0;
    const hasRenderLane = Boolean(scene.renderLane?.trim());
    const hasProductionRisk = Boolean(scene.productionRisk?.trim());
    const hasReservedForPost = typeof scene.reservedForPost === 'string';
    const hasDeliveryIntent = typeof scene.deliveryIntent === 'string';
    const hasReferencePriorityMode = Boolean(scene.referencePriorityMode?.trim());
    const continuationMode = scene.transitionToNext?.continuitySourceMode;
    const continuationUsesStartOnly = continuationMode === 'previous_start_only' || continuationMode === 'none';
    const normalizedRequiredTags = (scene.requiredReferences || [])
      .map((tag) => normalizeTag(typeof tag === 'string' ? tag : ''))
      .filter(Boolean);
    const hasExplicitReferencePlan = Array.isArray(scene.referencePlan) && scene.referencePlan.length > 0;
    const referencePlan = getSceneReferencePlan(scene, storyboard.projectReferences || []);

    // ===== Block（只保留流程必要檢查）=====
    if ((scene.transitionToNext?.type === 'continuation' || scene.transitionToNext?.useEndFrameAsNextStart) && !scene.requiresEndFrame && !continuationUsesStartOnly) {
      issues.push(issue('medium', 'continuation_without_endframe', '設定了 continuation 但此場景未啟用尾幀；若要沿用上一景，建議確認來源模式可使用首幀或手動啟用尾幀。', scene));
    }

    if (scene.requiresEndFrame && !scene.endFrameDelta?.trim()) {
      issues.push(issue('high', 'missing_endframe_delta', '此場景啟用了尾幀，但沒有 endFrameDelta（差異描述）。', scene));
    }

    if (scene.duration <= 0) {
      issues.push(issue('high', 'invalid_duration', '場景時長必須大於 0。', scene));
    }

    if (!hasDescription) {
      issues.push(issue('high', 'missing_description', '場景缺少 description，無法穩定生成分鏡圖。', scene));
    }
    if (!hasCameraMovement) {
      issues.push(issue('high', 'missing_camera_movement', '場景缺少 cameraMovement，無法穩定生成影片運鏡。', scene));
    }
    if (!hasTransition) {
      issues.push(issue('high', 'missing_transition', '場景缺少 transitionToNext.type，後續剪輯轉場依據不足。', scene));
    }
    if (hasRequiredReferences && scene.requiredReferences?.some((tag) => !TAG_PATTERN.test((tag || '').trim()))) {
      issues.push(issue('high', 'invalid_required_reference_tags', 'requiredReferences 必須使用 <名稱> 標記格式。', scene));
    }
    if (availableReferenceTags.size > 0) {
      const missingRequiredTags = normalizedRequiredTags.filter((tag) => !availableReferenceTags.has(tag));
      if (missingRequiredTags.length > 0) {
        issues.push(issue('high', 'required_references_not_found', `requiredReferences 找不到對應專案參考：${missingRequiredTags.join(', ')}`, scene));
      }
    }
    const invalidPlanTags = referencePlan.filter((item) => !TAG_PATTERN.test((item.tag || '').trim()));
    if (invalidPlanTags.length > 0) {
      issues.push(issue('high', 'invalid_reference_plan_tags', `referencePlan 含有無效 tag：${invalidPlanTags.map((item) => item.tag).join(', ')}`, scene));
    }
    if (availableReferenceTags.size > 0) {
      const missingPlanRefs = referencePlan
        .map((item) => normalizeTag(item.tag))
        .filter(Boolean)
        .filter((tag) => !availableReferenceTags.has(tag));
      if (missingPlanRefs.length > 0) {
        issues.push(issue('high', 'reference_plan_refs_not_found', `referencePlan 找不到對應專案參考：${missingPlanRefs.join(', ')}`, scene));
      }
    }

    // ===== Warn（品質提醒，不阻擋流程）=====
    if (hasRenderLane && !['hero', 'performance', 'continuity', 'plate', 'insert', 'utility'].includes(scene.renderLane!)) {
      issues.push(issue('medium', 'invalid_render_lane', `renderLane 值無效：${scene.renderLane}`, scene));
    }
    if (hasProductionRisk && !['low', 'medium', 'high'].includes(scene.productionRisk!)) {
      issues.push(issue('medium', 'invalid_production_risk', `productionRisk 值無效：${scene.productionRisk}`, scene));
    }
    if (hasReferencePriorityMode && !['identity_first', 'continuity_first', 'style_first', 'stage_balanced'].includes(scene.referencePriorityMode!)) {
      issues.push(issue('medium', 'invalid_reference_priority_mode', `referencePriorityMode 值無效：${scene.referencePriorityMode}`, scene));
    }
    if (!hasCharactersTag && !hasProductsTag) {
      issues.push(issue('medium', 'missing_entity_tags', '場景缺少 charactersUsed/productsUsed，一致性追蹤會較弱。', scene));
    }
    if (!hasSceneIntent) {
      issues.push(issue('medium', 'missing_scene_intent', '缺少 sceneIntent，會降低鏡頭敘事聚焦。', scene));
    }
    if (!hasHookScore) {
      issues.push(issue('medium', 'missing_hook_score', '缺少 hookScore，無法預估此鏡吸引力。', scene));
    }
    if (!hasHookScoreReason) {
      issues.push(issue('medium', 'missing_hook_score_reason', '缺少 hookScoreReason，無法理解 Hook 判斷依據。', scene));
    }
    if (!hasRetentionRisk) {
      issues.push(issue('medium', 'missing_retention_risk', '缺少 retentionRisk，無法預估觀眾流失風險。', scene));
    }
    if (!hasStartComposition) {
      issues.push(issue('medium', 'missing_start_composition', '缺少 startComposition，首幀構圖錨點不足。', scene));
    }
    if (!hasSubjectMotion) {
      issues.push(issue('medium', 'missing_subject_motion', '缺少 subjectMotion，影片動作邊界不明確。', scene));
    }
    if (!hasContinuityLock) {
      issues.push(issue('medium', 'missing_continuity_lock', '缺少 continuityLock，影像保真與連續性風險提高。', scene));
    }
    if (!hasShotIntent) {
      issues.push(issue('medium', 'missing_shot_intent', '缺少 shotIntent，鏡頭任務不明確。', scene));
    }
    if (!hasContinuityAnchor) {
      issues.push(issue('medium', 'missing_continuity_anchor', '缺少 continuityAnchor，跨鏡頭連續性不易維持。', scene));
    }
    if (!hasRequiredReferences) {
      issues.push(issue('medium', 'missing_required_references', '缺少 requiredReferences 欄位，無法精準限制本鏡頭必用參考。', scene));
    }
    if (!hasExplicitReferencePlan && (hasCharactersTag || hasProductsTag || normalizedRequiredTags.length > 0)) {
      issues.push(issue('medium', 'missing_reference_plan', '場景有角色/商品參考，但缺少 referencePlan，後續視角路由會退回推測模式。', scene));
    }
    const missingVisibleFeatures = referencePlan.filter((item) => item.requestedView !== 'auto' && item.requestedView !== 'front' && !item.visibleFeatures?.trim());
    if (missingVisibleFeatures.length > 0) {
      issues.push(issue('medium', 'reference_plan_missing_visible_features', `referencePlan 缺少非正面視角的 visibleFeatures：${missingVisibleFeatures.map((item) => `${item.tag}:${item.requestedView}`).join(', ')}`, scene));
    }
    if (!hasRenderLane) {
      issues.push(issue('medium', 'missing_render_lane', '缺少 renderLane，生產 lane 無法穩定路由。', scene));
    }
    if (!hasProductionRisk) {
      issues.push(issue('medium', 'missing_production_risk', '缺少 productionRisk，QA 無法判讀製作風險。', scene));
    }
    if (!hasReservedForPost) {
      issues.push(issue('medium', 'missing_reserved_for_post', '缺少 reservedForPost，後製責任切分不明。', scene));
    }
    if (!hasDeliveryIntent) {
      issues.push(issue('medium', 'missing_delivery_intent', '缺少 deliveryIntent，交付目的不明。', scene));
    }
    if (!hasReferencePriorityMode) {
      issues.push(issue('medium', 'missing_reference_priority_mode', '缺少 referencePriorityMode，參考優先順序不明。', scene));
    }
    if (hasRequiredReferences && scene.requiredReferences!.length > 0 && !hasCharactersTag && !hasProductsTag) {
      issues.push(issue('medium', 'required_refs_without_entity_tags', '有 requiredReferences 但缺少 charactersUsed/productsUsed，參考映射可能失效。', scene));
    }
    if (index > 0 && !hasChangeFromPrev) {
      issues.push(issue('medium', 'missing_change_from_prev', '缺少 changeFromPrev，連場變化語意不完整。', scene));
    }
    if (index === 0 && typeof scene.hookScore === 'number' && scene.hookScore < 4) {
      issues.push(issue('medium', 'weak_opening_hook', '第一場 hookScore 低於 4，開場吸引力偏弱。', scene));
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

  const sceneReports = storyboard.scenes.map((scene) => {
    const sceneIssues = issues.filter((i) => i.sceneId === scene.id || i.sceneNumber === scene.sceneNumber);
    const hasHigh = sceneIssues.some((i) => i.severity === 'high');
    const hasMedium = sceneIssues.some((i) => i.severity === 'medium');
    const status: 'pass' | 'warn' | 'block' = hasHigh ? 'block' : hasMedium ? 'warn' : 'pass';
    return {
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      status,
      issues: sceneIssues,
    };
  });

  return { score, summary, issues, sceneReports };
}
