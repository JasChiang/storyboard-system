import type { Scene, SharedContinuityDirective, WorkflowStage } from '@/lib/types/storyboard';

interface ContinuityMemoryOptions {
  lookbackShots?: number;
  stage?: WorkflowStage;
  sharedAnchors?: string[];
  sharedContinuityDirectives?: SharedContinuityDirective[];
}

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

export function buildContinuityMemoryLines(
  currentScene: Pick<Scene, 'id' | 'sceneNumber'>,
  orderedScenes: Array<Pick<Scene, 'id' | 'sceneNumber' | 'continuityAnchor' | 'continuityLock' | 'changeFromPrev' | 'requiredReferences'>>,
  options?: ContinuityMemoryOptions
): string[] {
  if (!Array.isArray(orderedScenes) || orderedScenes.length === 0) return [];
  const currentIndex = orderedScenes.findIndex((scene) => scene.id === currentScene.id);
  if (currentIndex <= 0) return [];

  const lookback = Math.max(1, Math.min(8, options?.lookbackShots ?? 4));
  const startIndex = Math.max(0, currentIndex - lookback);
  const previousScenes = orderedScenes.slice(startIndex, currentIndex);
  const lines: string[] = [];

  previousScenes.forEach((scene) => {
    const parts: string[] = [];
    const continuityAnchor = normalize(scene.continuityAnchor);
    const continuityLock = normalize(scene.continuityLock);
    const changeFromPrev = normalize(scene.changeFromPrev);
    const requiredRefs = Array.isArray(scene.requiredReferences)
      ? scene.requiredReferences.map((tag) => normalize(tag)).filter(Boolean)
      : [];

    if (continuityAnchor) {
      parts.push(`anchor=${clip(continuityAnchor, 80)}`);
    }
    if (continuityLock) {
      parts.push(`lock=${clip(continuityLock, 80)}`);
    }
    if (changeFromPrev && changeFromPrev !== 'N/A') {
      parts.push(`delta=${clip(changeFromPrev, 64)}`);
    }
    if (requiredRefs.length > 0) {
      parts.push(`refs=${clip(requiredRefs.slice(0, 3).join(', '), 64)}`);
    }

    if (parts.length === 0) return;
    lines.push(`Shot ${scene.sceneNumber}: ${parts.join(' | ')}`);
  });

  const sharedAnchors = (options?.sharedAnchors || []).map((item) => normalize(item)).filter(Boolean);
  const sharedDirectives = (options?.sharedContinuityDirectives || []).filter((item) => {
    if (!normalize(item.directive)) return false;
    if (!options?.stage || !item.appliesToStages?.length) return true;
    return item.appliesToStages.includes(options.stage);
  });

  if (lines.length === 0 && sharedAnchors.length === 0 && sharedDirectives.length === 0) return [];
  return [
    `Continuity memory (${lines.length} previous shots):`,
    ...lines,
    ...(sharedAnchors.length > 0 ? [`Shared anchors: ${sharedAnchors.join(' | ')}`] : []),
    ...sharedDirectives.map((item) => `Shared directive${item.anchorLabel ? ` [${item.anchorLabel}]` : ''}: ${normalize(item.directive)}`),
    'Keep unresolved anchors and continuity locks stable unless this shot explicitly changes them.',
  ];
}
