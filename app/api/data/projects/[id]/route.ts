import { NextRequest, NextResponse } from 'next/server';
import { sqliteProjectRepo } from '@/lib/db/sqlite';
import type { Project } from '@/lib/types/project';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = sqliteProjectRepo.getById(id);
    if (!project) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Project not found');
    }
    return NextResponse.json({ data: project });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to fetch project' });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<Project>;
    const updated = sqliteProjectRepo.update(id, body);

    if (!updated) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Project not found');
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to update project' });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = sqliteProjectRepo.delete(id);
    if (!deleted) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Project not found');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to delete project' });
  }
}
