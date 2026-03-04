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
  prioritizeContentRefs?: boolean;
  strictRequiredOnlyWhenPresent?: boolean;
  includeStyleReferenceImages?: boolean;
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
  const requiredContentRefs = input.requiredContentRefs || [];
  const optionalContentRefs = input.optionalContentRefs || [];
  const hasRequiredContentRefs = requiredContentRefs.length > 0;
  const includeOptionalContentRefs = !(
    input.strictRequiredOnlyWhenPresent && hasRequiredContentRefs
  );

  if (input.prioritizeContentRefs) {
    for (const ref of requiredContentRefs) {
      appendUniqueUrl(ordered, ref.url);
    }
    appendUniqueUrl(ordered, input.sceneReferenceUrl);
    if (includeOptionalContentRefs) {
      for (const ref of optionalContentRefs) {
        appendUniqueUrl(ordered, ref.url);
      }
    }
    appendUniqueUrl(ordered, input.continuityReferenceUrl);
    appendUniqueUrl(ordered, input.startFrameReferenceUrl);
  } else {
    appendUniqueUrl(ordered, input.continuityReferenceUrl);
    appendUniqueUrl(ordered, input.startFrameReferenceUrl);
    appendUniqueUrl(ordered, input.sceneReferenceUrl);
    for (const ref of requiredContentRefs) {
      appendUniqueUrl(ordered, ref.url);
    }
    if (includeOptionalContentRefs) {
      for (const ref of optionalContentRefs) {
        appendUniqueUrl(ordered, ref.url);
      }
    }
  }

  if (input.includeStyleReferenceImages !== false) {
    for (const styleUrl of input.styleReferenceUrls || []) {
      appendUniqueUrl(ordered, styleUrl);
    }
  }

  const cap = MAX_REFERENCE_IMAGES[input.model] ?? 4;
  return ordered.slice(0, cap);
}
