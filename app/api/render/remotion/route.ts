import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { promises as fs } from 'fs';
import type { Scene } from '@/lib/types/storyboard';
import { convertToRemotionProps } from '@/lib/utils/remotion-converter';

export const runtime = 'nodejs';

interface RenderRequestBody {
  projectId?: string;
  scenes: Scene[];
  aspectRatio?: '16:9' | '9:16' | '1:1';
  outputPath?: string;
}

function resolveOutputPath(projectId?: string, outputPath?: string) {
  const safeProject = projectId ? projectId.replace(/[^a-zA-Z0-9_-]/g, '') : 'project';
  const baseDir = path.join(process.cwd(), 'temp', 'remotion');
  const defaultName = `${safeProject}-${Date.now()}.mp4`;
  const candidate = outputPath ? path.resolve(outputPath) : path.join(baseDir, defaultName);

  if (!candidate.startsWith(baseDir)) {
    return path.join(baseDir, defaultName);
  }

  return candidate;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RenderRequestBody;

    if (!body?.scenes || !Array.isArray(body.scenes)) {
      return Response.json({ error: '缺少場景資料。' }, { status: 400 });
    }

    const props = convertToRemotionProps(body.scenes, {
      aspectRatio: body.aspectRatio,
    });

    const entry = path.join(process.cwd(), 'lib', 'remotion', 'Root.tsx');
    const serveUrl = await bundle(entry);

    const composition = await selectComposition({
      serveUrl,
      id: 'main',
      inputProps: props,
    });

    const outputLocation = resolveOutputPath(body.projectId, body.outputPath);
    await fs.mkdir(path.dirname(outputLocation), { recursive: true });

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation,
      inputProps: props,
      onProgress: (progress) => {
        const percent = Math.round(progress.progress * 100);
        console.log(`[Remotion] Render progress: ${percent}%`);
      },
    });

    return Response.json({ success: true, path: outputLocation });
  } catch (error) {
    console.error('[Remotion] Render error:', error);
    return Response.json({ error: '渲染失敗，請查看伺服器日誌。' }, { status: 500 });
  }
}
