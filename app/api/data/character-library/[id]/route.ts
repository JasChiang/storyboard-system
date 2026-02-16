import { NextRequest, NextResponse } from 'next/server';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { saveRemoteImageToLocalMedia } from '@/lib/storage/local-media';

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
      return NextResponse.json({ error: 'Character library item not found' }, { status: 404 });
    }
    return NextResponse.json({ data: item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch character library item' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Character library item not found' }, { status: 404 });
    }

    const updates: Partial<CharacterLibraryItem> = { ...body };
    if (Array.isArray(body.views)) {
      updates.views = await ensureArchivedViews(body.views, body.name || existing.name);
    }

    const updated = sqliteCharacterLibraryRepo.update(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Character library item not found' }, { status: 404 });
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update character library item' },
      { status: 500 }
    );
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
      return NextResponse.json({ error: 'Character library item not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete character library item' },
      { status: 500 }
    );
  }
}
