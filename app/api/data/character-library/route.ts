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

export async function GET() {
  try {
    const items = sqliteCharacterLibraryRepo.getAll();
    return NextResponse.json({ data: items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch character library' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<CharacterLibraryItem>;
    const now = new Date().toISOString();

    const type = body.type as CharacterLibraryItem['type'] | undefined;

    if (!body.name || !type || !Array.isArray(body.views) || body.views.length === 0) {
      return NextResponse.json({ error: 'name, type and views are required' }, { status: 400 });
    }

    const name = String(body.name);
    const views = await ensureArchivedViews(body.views, name);

    const item: CharacterLibraryItem = {
      id: body.id || crypto.randomUUID(),
      name,
      type,
      description: String(body.description || ''),
      guidelines: body.guidelines,
      tags: Array.isArray(body.tags) ? body.tags : [],
      views,
      ipProfile: body.ipProfile,
      usageCount: typeof body.usageCount === 'number' ? body.usageCount : 0,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const created = sqliteCharacterLibraryRepo.create(item);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create character library item' },
      { status: 500 }
    );
  }
}
