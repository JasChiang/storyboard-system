import { NextRequest, NextResponse } from 'next/server';
import { sqliteProjectRepo } from '@/lib/db/sqlite';
import type { Project } from '@/lib/types/project';

export const runtime = 'nodejs';

function buildProject(input: { name: string; description?: string }): Project {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET() {
  try {
    const projects = sqliteProjectRepo.getAll();
    return NextResponse.json({ data: projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    const description = body?.description ? String(body.description).trim() : undefined;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    const created = sqliteProjectRepo.create(buildProject({ name, description }));
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    );
  }
}
