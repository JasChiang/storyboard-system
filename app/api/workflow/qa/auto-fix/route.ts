import { NextRequest, NextResponse } from 'next/server';
import type { Storyboard } from '@/lib/types/storyboard';
import { sqliteProjectRepo } from '@/lib/db/sqlite';
import { autoFixStoryboardBlockingIssues } from '@/lib/workflow/qa-autofix';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectId?: string;
      storyboard?: Storyboard;
      maxScenes?: number;
      model?: string;
    };

    if (!body.projectId || !body.storyboard) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'projectId and storyboard are required');
    }

    const result = await autoFixStoryboardBlockingIssues({
      projectId: body.projectId,
      storyboard: body.storyboard,
      options: {
        maxScenes: typeof body.maxScenes === 'number' ? body.maxScenes : undefined,
        model: typeof body.model === 'string' ? body.model : undefined,
      },
    });

    const updatedProject = sqliteProjectRepo.update(body.projectId, {
      storyboard: result.storyboard,
      status: 'storyboard',
    });
    if (!updatedProject) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Project not found');
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to auto-fix storyboard' });
  }
}
