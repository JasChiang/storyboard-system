import { NextRequest, NextResponse } from 'next/server';
import { sqliteGenerationRunRepo } from '@/lib/db/sqlite';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const limit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit') || 100)));
    const runs = sqliteGenerationRunRepo.listByProject(projectId, limit);
    return NextResponse.json({ data: runs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch generation runs' },
      { status: 500 }
    );
  }
}
