import type { ProjectReference, StructuredIdentityLock } from '@/lib/types/storyboard';

function splitTextLines(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\n|；|;|。/)
    .map(line => line.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function categorizeLine(
  line: string,
  buckets: {
    geometry: string[];
    materials: string[];
    logoText: string[];
    requiredParts: string[];
    forbiddenChanges: string[];
  }
) {
  const lower = line.toLowerCase();
  const geometryPattern = /比例|形狀|輪廓|線條|曲線|方形|圓形|corner|shape|geometry|silhouette|ratio|outline|head|body|panel|vent|grille|louver/;
  const materialPattern = /材質|霧面|亮面|金屬|塑膠|texture|material|matte|gloss|color|顏色|surface|finish/;
  const logoPattern = /logo|標誌|字樣|文字|\btext\b|spelling|字體|位置|placement|brand/;
  const forbiddenPattern = /不得|不可|不要|禁止|forbid|avoid|no\s|unchanged|固定|must remain|must stay|cannot|can't/;
  const requiredPattern = /必須|需|需要|must|保留|含有|構成|should have|must have/;

  if (forbiddenPattern.test(line) || forbiddenPattern.test(lower)) {
    buckets.forbiddenChanges.push(line);
  }
  if (logoPattern.test(line) || logoPattern.test(lower)) {
    buckets.logoText.push(line);
  }
  if (geometryPattern.test(line) || geometryPattern.test(lower)) {
    buckets.geometry.push(line);
  }
  if (materialPattern.test(line) || materialPattern.test(lower)) {
    buckets.materials.push(line);
  }
  if (requiredPattern.test(line) || requiredPattern.test(lower)) {
    buckets.requiredParts.push(line);
  }
}

function trimBucket(lines: string[], maxItems: number): string[] {
  return unique(lines).slice(0, maxItems);
}

export function buildStructuredIdentityLock(
  reference: Pick<
    ProjectReference,
    | 'type'
    | 'identityAnchor'
    | 'preserveList'
    | 'driftHotspots'
    | 'actionSafety'
    | 'styleDirective'
    | 'identityCore'
    | 'mustKeepFeatures'
    | 'guidelines'
    | 'description'
  >
): StructuredIdentityLock | undefined {
  if (reference.type !== 'character' && reference.type !== 'product') return undefined;

  // v2 primary sources
  const v2Anchor = reference.identityAnchor?.trim();
  const v2Preserve = (reference.preserveList || []).map(item => item.trim()).filter(Boolean);
  const v2DriftForbid: string[] = [];
  for (const spot of reference.driftHotspots || []) {
    for (const failure of spot.commonFailures || []) {
      const trimmed = failure.trim();
      if (trimmed) v2DriftForbid.push(`${spot.part}: avoid ${trimmed}`);
    }
  }
  const v2AnatomyForbid = (reference.actionSafety?.anatomyConstraints || [])
    .map(item => item.trim())
    .filter(Boolean);
  const v2VerbForbid = (reference.actionSafety?.forbiddenVerbs || [])
    .map(v => v.trim())
    .filter(Boolean)
    .map(verb => `avoid verb "${verb}"`);

  // v1 fallback sources (for characters not yet migrated)
  const identityLines = splitTextLines(reference.identityCore);
  const guidelineLines = splitTextLines(reference.guidelines);
  const legacyMustKeep = (reference.mustKeepFeatures || []).map(item => item.trim()).filter(Boolean);

  const appearanceSummary = v2Anchor || reference.description?.trim() || undefined;

  // If v2 is populated, short-circuit to structured output without heuristic categorization.
  if (v2Anchor || v2Preserve.length > 0 || v2DriftForbid.length > 0) {
    const requiredParts = trimBucket(v2Preserve.length > 0 ? v2Preserve : legacyMustKeep, 8);
    const forbiddenChanges = trimBucket(
      [...v2DriftForbid, ...v2AnatomyForbid, ...v2VerbForbid],
      12
    );
    return {
      version: 2,
      entityType: reference.type,
      appearanceSummary,
      geometry: v2Anchor ? trimBucket([v2Anchor], 6) : [],
      materials: reference.styleDirective?.trim() ? [reference.styleDirective.trim()] : [],
      logoText: [],
      requiredParts,
      forbiddenChanges,
    };
  }

  // v1 legacy categorization path
  const buckets = {
    geometry: [] as string[],
    materials: [] as string[],
    logoText: [] as string[],
    requiredParts: [] as string[],
    forbiddenChanges: [] as string[],
  };

  [...identityLines, ...legacyMustKeep, ...guidelineLines].forEach(line => categorizeLine(line, buckets));

  const geometry = trimBucket([...identityLines, ...buckets.geometry], 6);
  const materials = trimBucket(buckets.materials, 5);
  const logoText = trimBucket(buckets.logoText, 5);
  const requiredParts = trimBucket([...legacyMustKeep, ...buckets.requiredParts], 8);
  const forbiddenChanges = trimBucket(buckets.forbiddenChanges, 10);

  const hasContent =
    geometry.length > 0 ||
    materials.length > 0 ||
    logoText.length > 0 ||
    requiredParts.length > 0 ||
    forbiddenChanges.length > 0;

  if (!hasContent && !appearanceSummary) return undefined;

  return {
    version: 1,
    entityType: reference.type,
    appearanceSummary,
    geometry,
    materials,
    logoText,
    requiredParts,
    forbiddenChanges,
  };
}

export function mergeStructuredIdentityLocks(
  base?: StructuredIdentityLock,
  incoming?: StructuredIdentityLock
): StructuredIdentityLock | undefined {
  if (!base) return incoming;
  if (!incoming) return base;

  return {
    version: Math.max(base.version || 1, incoming.version || 1),
    entityType: base.entityType,
    appearanceSummary: base.appearanceSummary || incoming.appearanceSummary,
    geometry: unique([...(base.geometry || []), ...(incoming.geometry || [])]).slice(0, 8),
    materials: unique([...(base.materials || []), ...(incoming.materials || [])]).slice(0, 8),
    logoText: unique([...(base.logoText || []), ...(incoming.logoText || [])]).slice(0, 8),
    requiredParts: unique([...(base.requiredParts || []), ...(incoming.requiredParts || [])]).slice(0, 12),
    forbiddenChanges: unique([...(base.forbiddenChanges || []), ...(incoming.forbiddenChanges || [])]).slice(0, 12),
  };
}

export function buildIdentityLockPromptLine(lock: StructuredIdentityLock, tag: string): string {
  const parts: string[] = [];
  if (lock.geometry?.length) parts.push(`geometry=${lock.geometry.slice(0, 4).join(', ')}`);
  if (lock.materials?.length) parts.push(`material=${lock.materials.slice(0, 3).join(', ')}`);
  if (lock.logoText?.length) parts.push(`logo/text=${lock.logoText.slice(0, 3).join(', ')}`);
  if (lock.requiredParts?.length) parts.push(`required=${lock.requiredParts.slice(0, 4).join(', ')}`);
  if (lock.forbiddenChanges?.length) parts.push(`forbidden=${lock.forbiddenChanges.slice(0, 4).join(', ')}`);
  return `${tag} structured lock: ${parts.join(' | ')}`;
}
