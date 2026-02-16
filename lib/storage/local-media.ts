import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL_MEDIA_ROOT = path.join(process.cwd(), '.data', 'local-media');

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'asset';
}

function extensionFromContentType(contentType: string | null): string {
  const type = (contentType || '').toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('bmp')) return 'bmp';
  if (type.includes('avif')) return 'avif';
  return 'jpg';
}

export interface SaveRemoteImageOptions {
  category?: string;
  baseName?: string;
}

export interface SavedLocalMedia {
  relativePath: string;
  absolutePath: string;
  contentType: string;
}

export async function saveRemoteImageToLocalMedia(
  imageUrl: string,
  options?: SaveRemoteImageOptions
): Promise<SavedLocalMedia> {
  const response = await fetch(imageUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to download remote image: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const ext = extensionFromContentType(contentType);
  const data = Buffer.from(await response.arrayBuffer());
  const dayFolder = new Date().toISOString().slice(0, 10);
  const category = sanitizeSegment(options?.category || 'general');
  const baseName = sanitizeSegment(options?.baseName || 'image');
  const fileName = `${baseName}-${Date.now()}.${ext}`;

  const relativeDir = path.posix.join(category, dayFolder);
  const relativePath = path.posix.join(relativeDir, fileName);
  const absoluteDir = path.join(LOCAL_MEDIA_ROOT, ...relativeDir.split('/'));
  const absolutePath = path.join(LOCAL_MEDIA_ROOT, ...relativePath.split('/'));

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, data);

  return {
    relativePath,
    absolutePath,
    contentType,
  };
}
