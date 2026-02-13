import { NextRequest, NextResponse } from 'next/server';
import { sqliteProjectRepo } from '@/lib/db/sqlite';
import type { Project } from '@/lib/types/project';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projects?: Project[] };
    const projects = Array.isArray(body.projects) ? body.projects : [];

    let imported = 0;
    projects.forEach((project) => {
      if (!project?.id || !project?.name) return;
      const exists = sqliteProjectRepo.getById(project.id);
      if (exists) return;
      sqliteProjectRepo.create(project);
      imported += 1;
    });

    return NextResponse.json({ imported });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import projects' },
      { status: 500 }
    );
  }
}
