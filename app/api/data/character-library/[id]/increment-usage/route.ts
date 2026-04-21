import { NextRequest, NextResponse } from 'next/server';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = sqliteCharacterLibraryRepo.incrementUsage(id);
    if (!updated) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Character library item not found');
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to increment usage' });
  }
}
