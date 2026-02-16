import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { inferImageMimeTypeFromPath, resolveLocalMediaAbsolutePath } from '@/lib/storage/local-media';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path') || '';
  const filePath = resolveLocalMediaAbsolutePath(rawPath);
  if (!filePath) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
