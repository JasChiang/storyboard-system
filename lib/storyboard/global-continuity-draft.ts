import type { ProjectReference, SharedContinuityDirective, Storyboard, StyleProfile } from '@/lib/types/storyboard';
import { normalizeProjectReferenceWorkflow, sortReferencesForContinuityDraft } from '@/lib/characters/workflow';

export interface GlobalContinuityDraft {
  sharedAnchors: string[];
  sharedContinuityDirectives: SharedContinuityDirective[];
  sourceSignature: string;
  generatedAt: string;
}

function normalizeText(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toClauses(value?: string | null): string[] {
  return normalizeText(value)
    .split(/[\n；;。]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function clip(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;
}

function buildReferenceSignature(reference: ProjectReference): string {
  return JSON.stringify({
    type: reference.type,
    name: reference.name || '',
    identityCore: reference.identityCore || '',
    mustKeepFeatures: reference.mustKeepFeatures || [],
    guidelines: reference.guidelines || '',
    styleTraits: reference.styleTraits || '',
    ipProfile: reference.ipProfile || null,
    isAnchor: reference.isAnchor || false,
    usageRole: reference.usageRole || null,
    sourceCharacterStatus: reference.sourceCharacterStatus || null,
  });
}

export function buildGlobalContinuityDraft(
  projectReferences: ProjectReference[] = [],
  styleProfile?: Pick<StyleProfile, 'id' | 'name' | 'continuityStrategy'> | null
): GlobalContinuityDraft {
  const references = sortReferencesForContinuityDraft(projectReferences);
  const anchors: string[] = [];
  const directives: SharedContinuityDirective[] = [];

  const pushAnchor = (value?: string | null) => {
    const normalized = normalizeText(value);
    if (normalized) anchors.push(clip(normalized));
  };

  const pushDirective = (anchorLabel: string, directive?: string | null, appliesToStages?: SharedContinuityDirective['appliesToStages']) => {
    const normalized = normalizeText(directive);
    if (!normalized) return;
    directives.push({
      anchorLabel,
      directive: clip(normalized, 220),
      ...(appliesToStages?.length ? { appliesToStages } : {}),
    });
  };

  references.forEach((rawReference) => {
    const reference = normalizeProjectReferenceWorkflow(rawReference);
    const label = normalizeText(reference.name) || reference.type;
    const typedLabel = reference.type === 'style' ? `style:${label}` : `${reference.type}:${label}`;
    const rolePrefix = reference.isAnchor ? 'anchor' : (reference.usageRole === 'style_support' ? 'style support' : 'supporting');

    if (reference.type === 'character' || reference.type === 'product') {
      pushAnchor(reference.isAnchor
        ? `${label} is the anchor ${reference.type}; identity stays locked across shots`
        : `${label} identity stays locked across shots`);
      pushDirective(typedLabel, `${label} workflow role: ${rolePrefix}.`);
      pushDirective(typedLabel, reference.identityCore ? `${label} core identity: ${reference.identityCore}` : undefined);
      toClauses(reference.guidelines).forEach((rule) => pushDirective(typedLabel, rule));
      (reference.mustKeepFeatures || []).forEach((feature) => pushDirective(typedLabel, `${label} must keep: ${feature}`));
      (reference.ipProfile?.immutableRules || []).forEach((rule) => pushDirective(typedLabel, `${label} immutable rule: ${rule}`));
      if (reference.ipProfile?.textLogoPolicy === 'lock_visible_text') {
        pushDirective(typedLabel, `${label} visible logo / text must remain legible and cannot be rewritten.`);
      }
      if (reference.ipProfile?.textLogoPolicy === 'forbid_new_text') {
        pushDirective(typedLabel, `${label} cannot gain new text, new logo, or rewritten lettering.`);
      }
      if (reference.ipProfile && reference.type === 'character' && !reference.ipProfile.allowAccessoryChanges) {
        pushDirective(typedLabel, `${label} accessories and signature outfit details should not change between shots.`);
      }
    }

    if (reference.type === 'environment') {
      pushAnchor(reference.isAnchor
        ? `${label} is the anchor environment; layout and light logic remain stable`
        : `${label} environment layout and light logic remain stable`);
      pushDirective(typedLabel, `${label} workflow role: ${rolePrefix}.`);
      pushDirective(typedLabel, reference.identityCore ? `${label} spatial identity: ${reference.identityCore}` : undefined);
      toClauses(reference.guidelines).forEach((rule) => pushDirective(typedLabel, rule));
      (reference.mustKeepFeatures || []).forEach((feature) => pushDirective(typedLabel, `${label} must keep: ${feature}`));
    }

    if (reference.type === 'style') {
      pushAnchor(reference.isAnchor
        ? `${label} is the anchor style language across the full storyboard`
        : `${label} visual language stays consistent across the full storyboard`);
      pushDirective(typedLabel, `${label} workflow role: ${rolePrefix}.`, ['image_start', 'image_end', 'video']);
      pushDirective(typedLabel, reference.styleTraits ? `${label} style traits: ${reference.styleTraits}` : undefined, ['image_start', 'image_end', 'video']);
      toClauses(reference.guidelines).forEach((rule) => pushDirective(typedLabel, rule, ['image_start', 'image_end', 'video']));
    }
  });

  if (styleProfile?.continuityStrategy?.trim()) {
    pushAnchor(`${styleProfile.name || 'Selected style'} continuity strategy stays active across generation stages`);
    pushDirective(`style-profile:${styleProfile.name || styleProfile.id || 'selected'}`, styleProfile.continuityStrategy, ['image_start', 'image_end', 'video']);
  }

  return {
    sharedAnchors: dedupe(anchors),
    sharedContinuityDirectives: directives.filter((item, index, array) => {
      const key = `${item.anchorLabel}::${item.directive}::${(item.appliesToStages || []).join(',')}`;
      return array.findIndex((candidate) => `${candidate.anchorLabel}::${candidate.directive}::${(candidate.appliesToStages || []).join(',')}` === key) === index;
    }),
    sourceSignature: JSON.stringify({
      references: references.map(buildReferenceSignature),
      styleProfile: styleProfile ? { id: styleProfile.id, name: styleProfile.name, continuityStrategy: styleProfile.continuityStrategy || '' } : null,
    }),
    generatedAt: new Date().toISOString(),
  };
}

export function areSharedDirectivesEqual(a: SharedContinuityDirective[] = [], b: SharedContinuityDirective[] = []): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isGlobalContinuityDraftStillPristine(storyboard?: Storyboard | null): boolean {
  if (!storyboard?.globalContinuityDraft) return false;
  return JSON.stringify(storyboard.sharedAnchors || []) === JSON.stringify(storyboard.globalContinuityDraft.sharedAnchors || [])
    && areSharedDirectivesEqual(storyboard.sharedContinuityDirectives || [], storyboard.globalContinuityDraft.sharedContinuityDirectives || []);
}

export function applyAutoGlobalContinuityDraft(
  storyboard: Storyboard,
  draft: GlobalContinuityDraft,
  options?: { forceApply?: boolean }
): Storyboard {
  const hasManualAnchors = (storyboard.sharedAnchors || []).length > 0;
  const hasManualDirectives = (storyboard.sharedContinuityDirectives || []).length > 0;
  const draftIsPristine = isGlobalContinuityDraftStillPristine(storyboard);
  const shouldApply = Boolean(options?.forceApply) || (!hasManualAnchors && !hasManualDirectives) || draftIsPristine;

  return {
    ...storyboard,
    sharedAnchors: shouldApply ? draft.sharedAnchors : (storyboard.sharedAnchors || []),
    sharedContinuityDirectives: shouldApply ? draft.sharedContinuityDirectives : (storyboard.sharedContinuityDirectives || []),
    globalContinuityDraft: draft,
    updatedAt: new Date().toISOString(),
  };
}
