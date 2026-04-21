import { NextRequest, NextResponse } from 'next/server';
import { sqliteGenerationRunRepo } from '@/lib/db/sqlite';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'projectId is required');
    }
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 100)));
    const runs = sqliteGenerationRunRepo.listByProject(projectId, limit);
    return NextResponse.json({ data: runs });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to fetch generation runs' });
  }
}
