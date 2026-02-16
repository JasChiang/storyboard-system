import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const ROOT_DIR = path.join(process.cwd(), '.data', 'local-media');

function resolveSafePath(rawPath: string): string | null {
  const normalized = rawPath
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');

  if (!normalized) return null;

  const absolutePath = path.join(ROOT_DIR, ...normalized.split('/'));
  const relative = path.relative(ROOT_DIR, absolutePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return absolutePath;
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.avif':
      return 'image/avif';
    case '.jpeg':
    case '.jpg':
    default:
      return 'image/jpeg';
  }
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path') || '';
  const filePath = resolveSafePath(rawPath);
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
        'Content-Type': getContentType(filePath),
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
