import { NextRequest, NextResponse } from 'next/server';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import { diffProjectReferencesAgainstLibrary } from '@/lib/characters/library-sync';
import type { ProjectReference } from '@/lib/types/storyboard';
import { apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

interface CheckUpdatesBody {
  references?: ProjectReference[];
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckUpdatesBody;
    const references = Array.isArray(body.references) ? body.references : [];
    if (references.length === 0) {
      return NextResponse.json({ diffs: [] });
    }

    const libraryItems = sqliteCharacterLibraryRepo.getAll();
    const diffs = diffProjectReferencesAgainstLibrary(references, libraryItems);

    return NextResponse.json({ diffs });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to check library updates' });
  }
}
