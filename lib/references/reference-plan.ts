import type {
  ProjectReference,
  ReferencePlanEntityType,
  Scene,
  SceneReferencePlanItem,
  ViewIntent,
} from '@/lib/types/storyboard';
import { STORYBOARD_VIEW_INTENTS } from '@/lib/prompts/storyboard-contract';
import { normalizeTag } from '@/lib/references/scene-references';

const VIEW_INTENT_SET = new Set<string>(STORYBOARD_VIEW_INTENTS as readonly string[]);

function normalizeViewIntent(raw: unknown, fallback: ViewIntent = 'auto'): ViewIntent {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim();
  return VIEW_INTENT_SET.has(normalized) ? (normalized as ViewIntent) : fallback;
}

function normalizeEntityType(raw: unknown): ReferencePlanEntityType | undefined {
  return raw === 'character' || raw === 'product' ? raw : undefined;
}

function stringValue(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function buildCanonicalTagMap(
  references?: Array<Pick<ProjectReference, 'name'>>,
  scene?: Partial<Pick<Scene, 'charactersUsed' | 'productsUsed' | 'requiredReferences'>>
) {
  const tags = new Map<string, string>();
  const register = (raw?: string) => {
    const normalized = normalizeTag(raw || '');
    if (!normalized) return;
    tags.set(normalized, raw?.trim() || normalized);
  };

  (references || []).forEach((reference) => {
    if (!reference.name) return;
    register(`<${reference.name.trim()}>`);
  });
  (scene?.charactersUsed || []).forEach(register);
  (scene?.productsUsed || []).forEach(register);
  (scene?.requiredReferences || []).forEach(register);

  return tags;
}

function sortReferencePlan(a: SceneReferencePlanItem, b: SceneReferencePlanItem) {
  if (a.required !== b.required) return a.required ? -1 : 1;
  if ((a.entityType || '') !== (b.entityType || '')) {
    return (a.entityType || '').localeCompare(b.entityType || '');
  }
  return a.tag.localeCompare(b.tag);
}

export function getSceneReferencePlan(
  scene: Pick<
    Scene,
    'referencePlan' | 'referenceViewHints' | 'viewIntent' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'
  >,
  references?: Array<Pick<ProjectReference, 'name'>>
): SceneReferencePlanItem[] {
  const planMap = new Map<string, SceneReferencePlanItem>();
  const canonicalTags = buildCanonicalTagMap(references, scene);
  const defaultView = normalizeViewIntent(scene.viewIntent, 'auto');

  const upsert = (rawTag: string, patch: Partial<SceneReferencePlanItem>) => {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;

    const canonicalTag = canonicalTags.get(normalized) || normalized;
    const current = planMap.get(normalized) || {
      tag: canonicalTag,
      requestedView: defaultView,
      required: false,
    };

    const next: SceneReferencePlanItem = {
      ...current,
      tag: canonicalTag,
      entityType: patch.entityType || current.entityType,
      requestedView: normalizeViewIntent(
        patch.requestedView,
        current.requestedView || defaultView
      ),
      required: typeof patch.required === 'boolean' ? (current.required || patch.required) : current.required,
      visibleFeatures: stringValue(patch.visibleFeatures) || current.visibleFeatures,
    };

    planMap.set(normalized, next);
  };

  (scene.referencePlan || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    upsert((item as SceneReferencePlanItem).tag, {
      entityType: normalizeEntityType((item as SceneReferencePlanItem).entityType),
      requestedView: normalizeViewIntent((item as SceneReferencePlanItem).requestedView, defaultView),
      required: Boolean((item as SceneReferencePlanItem).required),
      visibleFeatures: stringValue((item as SceneReferencePlanItem).visibleFeatures),
    });
  });

  (scene.charactersUsed || []).forEach((tag) => {
    upsert(tag, { entityType: 'character', requestedView: defaultView });
  });
  (scene.productsUsed || []).forEach((tag) => {
    upsert(tag, { entityType: 'product', requestedView: defaultView });
  });
  (scene.requiredReferences || []).forEach((tag) => {
    upsert(tag, { required: true });
  });

  if (scene.referenceViewHints && typeof scene.referenceViewHints === 'object') {
    for (const [tag, requestedView] of Object.entries(scene.referenceViewHints)) {
      upsert(tag, { requestedView: normalizeViewIntent(requestedView, defaultView) });
    }
  }

  return [...planMap.values()].sort(sortReferencePlan);
}

export function getReferencePlanItemForTag(
  scene: Pick<
    Scene,
    'referencePlan' | 'referenceViewHints' | 'viewIntent' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'
  >,
  rawTag: string,
  references?: Array<Pick<ProjectReference, 'name'>>
): SceneReferencePlanItem | undefined {
  const normalized = normalizeTag(rawTag);
  if (!normalized) return undefined;
  return getSceneReferencePlan(scene, references).find((item) => normalizeTag(item.tag) === normalized);
}

export function buildSceneReferencePlanLines(
  plan?: SceneReferencePlanItem[]
): string[] {
  if (!Array.isArray(plan) || plan.length === 0) return [];
  return plan.map((item) => {
    const typeText = item.entityType ? ` ${item.entityType}` : '';
    const requiredText = item.required ? ' required' : ' optional';
    const visibleText = item.visibleFeatures?.trim()
      ? ` visible: ${item.visibleFeatures.trim()}`
      : '';
    return `${item.tag}${typeText} -> ${item.requestedView}${requiredText}${visibleText}`;
  });
}
