import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { inferImageMimeTypeFromPath, resolveLocalMediaAbsolutePath } from '@/lib/storage/local-media';
import { API_ERROR_CODES, apiError } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path') || '';
  const filePath = resolveLocalMediaAbsolutePath(rawPath);
  if (!filePath) {
    return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid path');
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Not found');
    }

    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': inferImageMimeTypeFromPath(filePath),
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return apiError(API_ERROR_CODES.NOT_FOUND, 'Not found');
  }
}
