import { NextRequest, NextResponse } from 'next/server';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { saveRemoteImageToLocalMedia } from '@/lib/storage/local-media';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

async function ensureArchivedViews(
  views: CharacterLibraryItem['views'],
  itemName: string
): Promise<CharacterLibraryItem['views']> {
  const normalizedName = (itemName || 'character').trim();
  return Promise.all(
    views.map(async (view) => {
      if (view.archivedLocalPath) return view;
      try {
        const saved = await saveRemoteImageToLocalMedia(view.url, {
          category: 'character-library',
          baseName: `${normalizedName}-${view.angle}`,
        });
        return {
          ...view,
          archivedLocalPath: saved.relativePath,
        };
      } catch {
        return view;
      }
    })
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = sqliteCharacterLibraryRepo.getById(id);
    if (!item) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Character library item not found');
    }
    return NextResponse.json({ data: item });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to fetch character library item' });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<CharacterLibraryItem>;
    const existing = sqliteCharacterLibraryRepo.getById(id);
    if (!existing) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Character library item not found');
    }

    const updates: Partial<CharacterLibraryItem> = { ...body };
    if (Array.isArray(body.views)) {
      updates.views = await ensureArchivedViews(body.views, body.name || existing.name);
    }

    const updated = sqliteCharacterLibraryRepo.update(id, updates);
    if (!updated) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Character library item not found');
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to update character library item' });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = sqliteCharacterLibraryRepo.delete(id);
    if (!deleted) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Character library item not found');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to delete character library item' });
  }
}
