import type { ImageGenerationModel } from '@/lib/constants/image-models';
import type { ProjectReference } from '@/lib/types/storyboard';

const MAX_REFERENCE_IMAGES: Record<ImageGenerationModel, number> = {
  'nano-banana-pro': 6,
  'seedream-5-lite': 4,
};

interface BuildPrioritizedReferenceUrlsInput {
  model: ImageGenerationModel;
  continuityReferenceUrl?: string;
  startFrameReferenceUrl?: string;
  sceneReferenceUrl?: string | null;
  requiredContentRefs?: ProjectReference[];
  optionalContentRefs?: ProjectReference[];
  styleReferenceUrls?: string[];
}

function appendUniqueUrl(target: string[], raw?: string | null) {
  if (typeof raw !== 'string') return;
  const normalized = raw.trim();
  if (!normalized) return;
  if (target.includes(normalized)) return;
  target.push(normalized);
}

export function buildPrioritizedReferenceUrls(
  input: BuildPrioritizedReferenceUrlsInput
): string[] {
  const ordered: string[] = [];

  appendUniqueUrl(ordered, input.continuityReferenceUrl);
  appendUniqueUrl(ordered, input.startFrameReferenceUrl);
  appendUniqueUrl(ordered, input.sceneReferenceUrl);

  for (const ref of input.requiredContentRefs || []) {
    appendUniqueUrl(ordered, ref.url);
  }

  for (const ref of input.optionalContentRefs || []) {
    appendUniqueUrl(ordered, ref.url);
  }

  for (const styleUrl of input.styleReferenceUrls || []) {
    appendUniqueUrl(ordered, styleUrl);
  }

  const cap = MAX_REFERENCE_IMAGES[input.model] ?? 4;
  return ordered.slice(0, cap);
}

