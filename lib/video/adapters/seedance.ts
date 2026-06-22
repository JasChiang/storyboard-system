import type { ProjectReference, Scene, SceneRefSource } from '@/lib/types/storyboard';
import { buildVideoIdentityLine } from '@/lib/prompts/invariant-layers';
import { analyzeMotionRisk, buildMotionSafetyLines } from './motion-safety';
import { buildVideoPromptFromParts } from './prompt-schema';
import { buildVideoSceneScriptLines } from './scene-script';

interface SeedancePromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
  continuityMemoryLines?: string[];
  refSources?: SceneRefSource[];
  // 覆寫 scene.videoMode；若未給以 scene.videoMode 為準
  videoMode?: Scene['videoMode'];
  // videoCapability='extension' 時要延長的新增秒數
  extensionDurationSeconds?: number;
}

const AT_PREFIX: Record<SceneRefSource['kind'], string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
};

function atToken(kind: SceneRefSource['kind'], index: number): string {
  return `@${AT_PREFIX[kind]}${index}`;
}

function usageClause(source: SceneRefSource): string | null {
  const atIndex = source.atIndex;
  if (!atIndex || atIndex < 1) return null;
  const tok = atToken(source.kind, atIndex);
  switch (source.usage) {
    case 'identity':
      return null; // 身份參考由 identityLine 集中處理
    case 'camera':
      return `参考${tok}的运镜效果`;
    case 'motion':
      return `参考${tok}的动作与走位`;
    case 'effect':
      return `参考${tok}的特效/转场`;
    case 'voice':
      return `音色参考${tok}`;
    case 'music':
      return `背景音乐参考${tok}`;
    case 'environment':
      return `场景/环境参考${tok}`;
    default:
      return null;
  }
}

/**
 * Build a natural-language video prompt for Seedance 2.0.
 *
 * Covers i2v (標準) / reference-to-video / text-to-video，並在 videoCapability 指定時加上對應前綴：
 *   - extension：`将@视频1延长Xs，保持角色/场景/风格一致`
 *   - edit：`在@视频1的基础上进行编辑`
 *   - one_shot / scene.oneShot：`一镜到底 + 全程不切镜头`
 *
 * refSources 會依 usage 產生對應 @引用 子句（中文），與官方 skill 模板一致。
 *
 * Seedance 不處理 negative prompt，這邊一律不輸出。
 */
export function buildSeedancePrompt({
  scene,
  motionPrompt,
  scopedRefs,
  continuityMemoryLines = [],
  refSources,
  videoMode,
  extensionDurationSeconds,
}: SeedancePromptInput): string {
  const resolvedMode = videoMode || scene.videoMode || 'standard';
  const isText = resolvedMode === 'text';
  const isReference = resolvedMode === 'reference';
  const capability = scene.videoCapability;
  const isExtension = capability === 'extension';
  const isEdit = capability === 'edit';
  const isOneShot = Boolean(scene.oneShot) || capability === 'one_shot';

  // ---- Capability prefix（放最前，讓模型先讀到骨架指令） ----
  const prefixLines: string[] = [];
  if (isExtension) {
    const secs = typeof extensionDurationSeconds === 'number' && extensionDurationSeconds > 0
      ? Math.round(extensionDurationSeconds)
      : 5;
    prefixLines.push(`将@视频1延长${secs}s，保持角色、场景、风格与运镜连贯一致`);
  }
  if (isEdit) {
    prefixLines.push('在@视频1的基础上进行编辑，保持未提及的元素完全不变');
  }
  if (isOneShot) {
    prefixLines.push('一镜到底 + 全程不切镜头，保持镜头连贯');
  }

  const motionRisk = analyzeMotionRisk({ scene, motionPrompt, scopedRefs });
  // text-to-video 沒有首幀可參考，安全/連續性護欄的主題是避免首幀錯位 — 無首幀就不必加。
  const motionSafetyLines = isText ? [] : buildMotionSafetyLines({ scene, motionPrompt, scopedRefs });
  const sceneScriptLines = buildVideoSceneScriptLines(scene);

  const actionLines: string[] = [
    ...prefixLines,
    ...sceneScriptLines,
    ...motionSafetyLines,
  ];

  // Continuity memory — 延長模式下由「延長句」接手，不再重複帶 previous shots
  if (!isExtension) {
    const anchorLines = continuityMemoryLines.filter((l) => /^Shot \d+:/.test(l));
    if (anchorLines.length > 0) {
      actionLines.push(`Previous shots: ${anchorLines.join('. ')}`);
    }
  }

  // Camera motion
  const cameraParts: string[] = [];
  if (scene.cameraMovement?.trim()) cameraParts.push(scene.cameraMovement.trim());
  if (motionPrompt?.trim()) cameraParts.push(motionPrompt.trim());
  const cameraMotion = cameraParts.join(', ') || 'Smooth stable camera';

  if (motionRisk.riskyCrossSubjectHandoff) {
    actionLines.unshift('Keep the anchored product stable, only perform a subtle reframe within visible content');
  }

  // End frame alignment 只對 i2v 標準模式有意義
  const hasEndFrame = !!scene.requiresEndFrame && !!scene.generatedEndFrame?.url;
  if (hasEndFrame && !isReference && !isText && !isExtension && !isEdit) {
    actionLines.push('Match the provided end frame composition at the end of the shot');
  }

  // ---- Ref sources ----
  const identityRefSources: SceneRefSource[] = [];
  const usageLines: string[] = [];
  for (const source of refSources || []) {
    if (!source.atIndex) continue;
    if (source.usage === 'identity') {
      identityRefSources.push(source);
      continue;
    }
    const clause = usageClause(source);
    if (clause) usageLines.push(clause);
  }
  if (usageLines.length > 0) {
    actionLines.push(...usageLines);
  }

  // ---- Identity line ----
  let identityLine: string | undefined;
  if (identityRefSources.length > 0) {
    const tokens = identityRefSources.map((r) => atToken(r.kind, r.atIndex!));
    identityLine = `Keep identity and appearance consistent with ${tokens.join(', ')}`;
  } else if (!isText) {
    // 純文字模式沒有參考素材可鎖，identity line 反而會干擾
    identityLine = buildVideoIdentityLine(scopedRefs) || undefined;
  }

  return buildVideoPromptFromParts({
    cameraMotion,
    actionLines,
    identityLine,
  });
}
