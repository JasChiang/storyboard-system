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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { items?: CharacterLibraryItem[] };
    const items = Array.isArray(body.items) ? body.items : [];

    let imported = 0;
    for (const item of items) {
      if (!item?.id || !item?.name) continue;
      const exists = sqliteCharacterLibraryRepo.getById(item.id);
      if (exists) continue;
      const views = Array.isArray(item.views) ? item.views : [];
      const archivedViews = await ensureArchivedViews(views, item.name);
      sqliteCharacterLibraryRepo.create({
        ...item,
        views: archivedViews,
      });
      imported += 1;
    }

    return NextResponse.json({ imported });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import character library items' },
      { status: 500 }
    );
  }
}
