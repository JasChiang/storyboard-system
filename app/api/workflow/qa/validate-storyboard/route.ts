import { NextRequest, NextResponse } from 'next/server';
import type { Storyboard } from '@/lib/types/storyboard';
import { validateStoryboard } from '@/lib/workflow/storyboard-qa';
import { sqliteQaRepo } from '@/lib/db/sqlite';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: string; storyboard?: Storyboard };
    if (!body.projectId || !body.storyboard) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'projectId and storyboard are required');
    }

    const result = validateStoryboard(body.storyboard);
    const report = sqliteQaRepo.create({
      id: crypto.randomUUID(),
      projectId: body.projectId,
      storyboardId: body.storyboard.id,
      score: result.score,
      summary: result.summary,
      issues: result.issues,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: { ...report, sceneReports: result.sceneReports } });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to validate storyboard' });
  }
}
