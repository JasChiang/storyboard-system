import type { CharacterLibraryItem, CharacterLibraryView } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

export interface LibraryReferenceDiff {
  libraryItemId: string;
  name: string;
  type: ProjectReference['type'];
  currentVersion: number | undefined;
  latestVersion: number;
  currentSnapshotId: string | undefined;
  latestSnapshotId: string | undefined;
  changes: string[];
  newAngles: string[];
  affectedReferenceIds: string[];
}

function diffStringArrays(before: string[] | undefined, after: string[] | undefined): { added: string[]; removed: string[] } {
  const beforeSet = new Set((before || []).map((s) => s.trim()).filter(Boolean));
  const afterSet = new Set((after || []).map((s) => s.trim()).filter(Boolean));
  const added: string[] = [];
  const removed: string[] = [];
  afterSet.forEach((value) => {
    if (!beforeSet.has(value)) added.push(value);
  });
  beforeSet.forEach((value) => {
    if (!afterSet.has(value)) removed.push(value);
  });
  return { added, removed };
}

function findViewForReference(item: CharacterLibraryItem, reference: ProjectReference): CharacterLibraryView | undefined {
  if (reference.angle) {
    return item.views.find((view) => view.angle === reference.angle);
  }
  return item.views[0];
}

function describeReferenceChanges(
  reference: ProjectReference,
  matchingView: CharacterLibraryView | undefined
): string[] {
  const changes: string[] = [];

  if (!matchingView) {
    changes.push(`原本引用的 ${reference.angle || 'front'} 視角已從角色庫移除`);
    return changes;
  }

  if (matchingView.identityCore && reference.identityCore && matchingView.identityCore !== reference.identityCore) {
    changes.push('identityCore 已更新');
  } else if (matchingView.identityCore && !reference.identityCore) {
    changes.push('新增 identityCore');
  }

  const mustKeepDiff = diffStringArrays(reference.mustKeepFeatures, matchingView.mustKeepFeatures);
  if (mustKeepDiff.added.length > 0) {
    changes.push(`mustKeepFeatures 新增 ${mustKeepDiff.added.length} 項`);
  }
  if (mustKeepDiff.removed.length > 0) {
    changes.push(`mustKeepFeatures 移除 ${mustKeepDiff.removed.length} 項`);
  }

  if (matchingView.url && reference.url && matchingView.url !== reference.url) {
    changes.push('參考圖 URL 已更新');
  }

  return changes;
}

/**
 * Compare a project's ProjectReference entries against the latest character
 * library state and return a per-library-item diff. Only references that
 * originated from the library (have sourceCharacterLibraryItemId) participate.
 */
export function diffProjectReferencesAgainstLibrary(
  references: ProjectReference[],
  libraryItems: CharacterLibraryItem[]
): LibraryReferenceDiff[] {
  const itemsById = new Map<string, CharacterLibraryItem>();
  for (const item of libraryItems) {
    itemsById.set(item.id, item);
  }

  const grouped = new Map<string, ProjectReference[]>();
  for (const reference of references) {
    const sourceId = reference.sourceCharacterLibraryItemId;
    if (!sourceId) continue;
    const list = grouped.get(sourceId) || [];
    list.push(reference);
    grouped.set(sourceId, list);
  }

  const diffs: LibraryReferenceDiff[] = [];

  grouped.forEach((projectRefs, libraryItemId) => {
    const item = itemsById.get(libraryItemId);
    if (!item) return;

    const projectAngles = new Set<string>();
    const projectVersions = new Set<number>();
    const projectSnapshots = new Set<string>();
    const affectedReferenceIds: string[] = [];
    const aggregatedChanges = new Set<string>();

    for (const ref of projectRefs) {
      if (ref.angle) projectAngles.add(ref.angle);
      if (typeof ref.sourceCharacterLibraryVersion === 'number') {
        projectVersions.add(ref.sourceCharacterLibraryVersion);
      }
      if (ref.sourceCharacterSnapshotId) projectSnapshots.add(ref.sourceCharacterSnapshotId);

      const matchingView = findViewForReference(item, ref);
      describeReferenceChanges(ref, matchingView).forEach((msg) => aggregatedChanges.add(msg));
      affectedReferenceIds.push(ref.id);
    }

    const libraryAngles = new Set(item.views.map((view) => view.angle));
    const newAngles: string[] = [];
    libraryAngles.forEach((angle) => {
      if (!projectAngles.has(angle)) newAngles.push(angle);
    });
    if (newAngles.length > 0) {
      aggregatedChanges.add(`新增 ${newAngles.length} 個視角：${newAngles.join('、')}`);
    }

    const currentVersion = projectVersions.size === 1
      ? Array.from(projectVersions)[0]
      : undefined;
    const versionOutdated = typeof currentVersion === 'number' && currentVersion < item.version;
    const snapshotOutdated = item.currentSnapshotId
      ? !projectSnapshots.has(item.currentSnapshotId)
      : false;

    if (!versionOutdated && !snapshotOutdated && newAngles.length === 0 && aggregatedChanges.size === 0) {
      return;
    }

    if (versionOutdated) {
      aggregatedChanges.add(`版本 ${currentVersion} → ${item.version}`);
    }

    diffs.push({
      libraryItemId,
      name: item.name,
      type: projectRefs[0].type,
      currentVersion,
      latestVersion: item.version,
      currentSnapshotId: projectRefs[0].sourceCharacterSnapshotId,
      latestSnapshotId: item.currentSnapshotId,
      changes: Array.from(aggregatedChanges),
      newAngles,
      affectedReferenceIds,
    });
  });

  return diffs.sort((a, b) => a.name.localeCompare(b.name));
}

export function summarizeLibraryDiffs(diffs: LibraryReferenceDiff[]): string {
  if (diffs.length === 0) return '所有參考已是最新';
  return `${diffs.length} 個參考有新版：${diffs.map((d) => d.name).join('、')}`;
}
