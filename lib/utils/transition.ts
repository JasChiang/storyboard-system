import type { Scene, TransitionToNext } from '@/lib/types/storyboard';

// Backward-compatible continuation detection:
// some legacy data may only have useEndFrameAsNextStart without type.
export function shouldUseEndFrameAsNextStart(transition?: TransitionToNext): boolean {
  if (!transition) return false;
  if (transition.continuitySourceMode === 'none') return false;
  if (transition.type === 'continuation') return true;
  if (!transition.type && transition.useEndFrameAsNextStart === true) return true;
  return false;
}

function getContinuationSourceMode(
  transition?: TransitionToNext
): 'auto' | 'previous_end_only' | 'previous_start_only' | 'none' {
  if (!transition) return 'none';
  if (transition.continuitySourceMode) return transition.continuitySourceMode;
  // Legacy fallback: old data may only have this boolean.
  if (!transition.type && transition.useEndFrameAsNextStart) return 'previous_end_only';
  return 'auto';
}

export function resolveContinuationSource(
  previousScene: Scene | null | undefined
): { url?: string; source?: 'end' | 'start' } {
  if (!previousScene) return {};
  if (!shouldUseEndFrameAsNextStart(previousScene.transitionToNext)) return {};

  const mode = getContinuationSourceMode(previousScene.transitionToNext);
  const endUrl = previousScene.generatedEndFrame?.url;
  const startUrl = previousScene.generatedImage?.url;

  if (mode === 'none') return {};
  if (mode === 'previous_end_only') {
    return endUrl ? { url: endUrl, source: 'end' } : {};
  }
  if (mode === 'previous_start_only') {
    return startUrl ? { url: startUrl, source: 'start' } : {};
  }

  if (endUrl) return { url: endUrl, source: 'end' };
  if (startUrl) return { url: startUrl, source: 'start' };
  return {};
}
