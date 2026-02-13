import { NextRequest, NextResponse } from 'next/server';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import type { CharacterLibraryItem } from '@/lib/types/character-library';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { items?: CharacterLibraryItem[] };
    const items = Array.isArray(body.items) ? body.items : [];

    let imported = 0;
    items.forEach((item) => {
      if (!item?.id || !item?.name) return;
      const exists = sqliteCharacterLibraryRepo.getById(item.id);
      if (exists) return;
      sqliteCharacterLibraryRepo.create(item);
      imported += 1;
    });

    return NextResponse.json({ imported });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import character library items' },
      { status: 500 }
    );
  }
}
