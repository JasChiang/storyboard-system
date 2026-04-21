import { NextRequest, NextResponse } from 'next/server';
import { sqliteTaskRepo, type GenerationTaskStage } from '@/lib/db/sqlite';
import { apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      projectId?: string;
      stage?: GenerationTaskStage;
      staleAfterMinutes?: number;
    };

    const staleAfterMinutes = Number(body.staleAfterMinutes ?? 0);
    if (Number.isFinite(staleAfterMinutes) && staleAfterMinutes > 0) {
      const staleBeforeIso = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();
      sqliteTaskRepo.markStaleRunningAsFailed(staleBeforeIso);
    }

    const task = sqliteTaskRepo.claimNextQueued({
      projectId: body.projectId,
      stage: body.stage,
    });

    if (!task) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data: task });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to claim task' });
  }
}
