import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/api/fal';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import {
  characterLibraryItemToProjectReference,
  characterLibraryItemToProjectReferences,
  type CharacterLibraryItem,
  type CharacterLibraryView,
} from '@/lib/types/character-library';
import {
  inferImageMimeTypeFromPath,
  resolveLocalMediaAbsolutePath,
  saveRemoteImageToLocalMedia,
} from '@/lib/storage/local-media';
import type { ProjectReference } from '@/lib/types/storyboard';
import { normalizeProjectReferenceWorkflow, type ReferenceUsageRole } from '@/lib/characters/workflow';

export const runtime = 'nodejs';

type ViewAngle = CharacterLibraryView['angle'];

interface SelectionItem {
  id: string;
  angle?: ViewAngle;
  isAnchor?: boolean;
  usageRole?: ReferenceUsageRole;
}

interface ResolveSelectionBody {
  selections?: SelectionItem[];
  includeAllViews?: boolean;
}

function sanitizeNameSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'asset';
}

function uniqueSelections(items: SelectionItem[]): SelectionItem[] {
  const seen = new Set<string>();
  const result: SelectionItem[] = [];
  items.forEach((item) => {
    const id = typeof item?.id === 'string' ? item.id.trim() : '';
    if (!id || seen.has(id)) return;
    seen.add(id);
    result.push({
      id,
      angle: item.angle || 'front',
      isAnchor: Boolean(item.isAnchor),
      usageRole: item.usageRole || 'supporting',
    });
  });
  return result;
}

async function ensureViewHasLocalArchive(
  view: CharacterLibraryView,
  itemName: string
): Promise<{ view: CharacterLibraryView; warning?: string; changed: boolean }> {
  if (view.archivedLocalPath) {
    return { view, changed: false };
  }

  try {
    const saved = await saveRemoteImageToLocalMedia(view.url, {
      category: 'character-library',
      baseName: `${itemName}-${view.angle}`,
    });
    return {
      view: {
        ...view,
        archivedLocalPath: saved.relativePath,
      },
      changed: true,
    };
  } catch {
    return {
      view,
      warning: `無法為 ${itemName}/${view.angle} 建立本地備份，可能原始 Fal URL 已失效。`,
      changed: false,
    };
  }
}

async function refreshViewFalUrl(
  view: CharacterLibraryView,
  itemName: string,
  falApiKey: string
): Promise<{ view: CharacterLibraryView; warning?: string; changed: boolean }> {
  if (!view.archivedLocalPath) {
    return { view, warning: `${itemName}/${view.angle} 沒有本地備份，略過 Fal URL 刷新。`, changed: false };
  }

  const absolutePath = resolveLocalMediaAbsolutePath(view.archivedLocalPath);
  if (!absolutePath) {
    return { view, warning: `${itemName}/${view.angle} 的本地備份路徑無效。`, changed: false };
  }

  try {
    const fileBuffer = await readFile(absolutePath);
    const mimeType = inferImageMimeTypeFromPath(absolutePath);
    const ext = path.extname(absolutePath) || '.jpg';
    const fileName = `${sanitizeNameSegment(itemName)}-${view.angle}${ext}`;
    const file = new File([fileBuffer], fileName, { type: mimeType });
    const refreshedUrl = await uploadFile(file, { apiKey: falApiKey });
    if (!refreshedUrl) {
      return { view, warning: `${itemName}/${view.angle} Fal 上傳未返回 URL。`, changed: false };
    }
    if (refreshedUrl === view.url) {
      return { view, changed: false };
    }
    return {
      view: {
        ...view,
        url: refreshedUrl,
      },
      changed: true,
    };
  } catch {
    return {
      view,
      warning: `${itemName}/${view.angle} Fal 刷新失敗，改用現有 URL。`,
      changed: false,
    };
  }
}

async function refreshItemViewsForSelection(
  item: CharacterLibraryItem,
  includeAllViews: boolean,
  selectedAngle: ViewAngle,
  falApiKey: string
): Promise<{ item: CharacterLibraryItem; warnings: string[]; changed: boolean; changedViewCount: number }> {
  const warnings: string[] = [];
  const targetAngles = includeAllViews ? new Set(item.views.map((v) => v.angle)) : new Set<ViewAngle>([selectedAngle]);
  let changed = false;
  let changedViewCount = 0;

  const refreshedViews: CharacterLibraryView[] = [];
  for (const originalView of item.views) {
    if (!targetAngles.has(originalView.angle)) {
      refreshedViews.push(originalView);
      continue;
    }

    let workingView = originalView;
    let viewChanged = false;

    const archived = await ensureViewHasLocalArchive(workingView, item.name);
    workingView = archived.view;
    if (archived.changed) {
      changed = true;
      viewChanged = true;
    }
    if (archived.warning) warnings.push(archived.warning);

    const refreshed = await refreshViewFalUrl(workingView, item.name, falApiKey);
    workingView = refreshed.view;
    if (refreshed.changed) {
      changed = true;
      viewChanged = true;
    }
    if (refreshed.warning) warnings.push(refreshed.warning);
    if (viewChanged) changedViewCount += 1;

    refreshedViews.push(workingView);
  }

  const nextItem = changed
    ? {
        ...item,
        views: refreshedViews,
        updatedAt: new Date().toISOString(),
      }
    : item;

  return {
    item: nextItem,
    warnings,
    changed,
    changedViewCount,
  };
}

function applyWorkflowSelection(reference: ProjectReference, selection: SelectionItem): ProjectReference {
  return normalizeProjectReferenceWorkflow({
    ...reference,
    referenceVersionSeed: [
      reference.sourceCharacterLibraryItemId,
      reference.sourceCharacterLibraryVersion,
      reference.sourceCharacterSnapshotId,
      reference.url,
      reference.identityCore,
      ...(reference.mustKeepFeatures || []),
    ].filter(Boolean).join('|') || undefined,
    isAnchor: Boolean(selection.isAnchor),
    usageRole: selection.isAnchor ? 'anchor' : (selection.usageRole || reference.usageRole || 'supporting'),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ResolveSelectionBody;
    const includeAllViews = body.includeAllViews !== false;
    const selections = uniqueSelections(Array.isArray(body.selections) ? body.selections : []);

    if (selections.length === 0) {
      return NextResponse.json({ error: 'selections is required' }, { status: 400 });
    }

    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey) {
      return NextResponse.json({ error: 'Missing FAL_API_KEY on server' }, { status: 500 });
    }

    const references: ProjectReference[] = [];
    const warnings: string[] = [];
    let refreshedItemCount = 0;
    let refreshedViewCount = 0;

    for (const selection of selections) {
      const item = sqliteCharacterLibraryRepo.getById(selection.id);
      if (!item) {
        warnings.push(`找不到角色庫項目：${selection.id}`);
        continue;
      }

      const targetAngle = selection.angle || 'front';
      const refreshed = await refreshItemViewsForSelection(item, includeAllViews, targetAngle, falApiKey);
      warnings.push(...refreshed.warnings);

      let activeItem = item;
      if (refreshed.changed) {
        const updated = sqliteCharacterLibraryRepo.update(item.id, { views: refreshed.item.views });
        activeItem = updated || refreshed.item;
        refreshedItemCount += 1;
        refreshedViewCount += refreshed.changedViewCount;
      } else {
        activeItem = refreshed.item;
      }

      if (includeAllViews) {
        references.push(...characterLibraryItemToProjectReferences(activeItem, 'all').map((reference) => applyWorkflowSelection(reference, selection)));
      } else {
        references.push(applyWorkflowSelection(characterLibraryItemToProjectReference(activeItem, targetAngle), selection));
      }
    }

    return NextResponse.json({
      references,
      meta: {
        refreshedItemCount,
        refreshedViewCount,
        warningCount: warnings.length,
      },
      warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve character references' },
      { status: 500 }
    );
  }
}
