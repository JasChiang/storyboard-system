/**
 * FFmpeg 视频渲染 API
 * 自动合成场景、添加转场和字幕
 */

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { mkdir, writeFile, unlink, rm } from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import type { Scene } from '@/lib/types/storyboard';

// 设置 FFmpeg 路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const maxDuration = 300; // 最长5分钟

interface RenderRequest {
  projectId: string;
  scenes: Scene[];
  projectTitle: string;
  includeSubtitles?: boolean;
}

interface ProcessedScene {
  path: string;
  duration: number;
  subtitle: string;
  isImage: boolean;
}

/**
 * 下载文件到本地
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${url}`);
  }
  const fileStream = createWriteStream(outputPath);
  await pipeline(response.body as any, fileStream);
}

/**
 * 将图片转换为视频片段
 */
async function imageToVideo(
  imagePath: string,
  duration: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .loop(duration)
      .fps(30)
      .videoCodec('libx264')
      .size('1920x1080')
      .outputOptions([
        '-pix_fmt yuv420p',
        '-t ' + duration,
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * 生成字幕文件 (SRT 格式)
 */
async function generateSubtitles(
  scenes: ProcessedScene[],
  outputPath: string
): Promise<void> {
  let srtContent = '';
  let currentTime = 0;

  scenes.forEach((scene, index) => {
    const startTime = currentTime;
    const endTime = currentTime + scene.duration;

    // SRT 时间格式: 00:00:00,000
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const millis = Math.floor((seconds % 1) * 1000);

      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
    };

    srtContent += `${index + 1}\n`;
    srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
    srtContent += `${scene.subtitle}\n\n`;

    currentTime = endTime;
  });

  await writeFile(outputPath, srtContent, 'utf-8');
}

/**
 * 合并视频片段（带转场效果）
 */
async function concatenateVideos(
  scenes: ProcessedScene[],
  outputPath: string,
  subtitlePath: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // 添加所有输入
    scenes.forEach(scene => {
      command.input(scene.path);
    });

    // 构建复杂过滤器（场景拼接 + 淡入淡出转场）
    const filterComplex: string[] = [];
    const transitionDuration = 0.5; // 转场时长 0.5 秒

    scenes.forEach((scene, index) => {
      // 为每个场景添加 scale 确保尺寸一致
      filterComplex.push(`[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${index}]`);
    });

    // 构建转场链
    let currentLabel = 'v0';
    for (let i = 1; i < scenes.length; i++) {
      const nextLabel = i === scenes.length - 1 ? 'outv' : `v${i}tmp`;

      // xfade 转场效果
      filterComplex.push(
        `[${currentLabel}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${scenes.slice(0, i).reduce((sum, s) => sum + s.duration, 0) - transitionDuration}[${nextLabel}]`
      );

      currentLabel = nextLabel;
    }

    // 如果只有一个场景，直接使用
    if (scenes.length === 1) {
      filterComplex.push('[v0]copy[outv]');
    }

    // 有字幕則燒入，否則直接輸出
    if (subtitlePath) {
      filterComplex.push(`[outv]subtitles=${subtitlePath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1'[outfinal]`);
    } else {
      filterComplex.push('[outv]copy[outfinal]');
    }

    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map [outfinal]',
        '-c:v libx264',
        '-preset medium',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('[FFmpeg] 命令:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`[FFmpeg] 进度: ${progress.percent?.toFixed(1)}%`);
      })
      .on('end', () => {
        console.log('[FFmpeg] 渲染完成');
        resolve();
      })
      .on('error', (err) => {
        console.error('[FFmpeg] 错误:', err);
        reject(err);
      })
      .run();
  });
}

export async function POST(request: NextRequest) {
  const tempDir = path.resolve(process.cwd(), 'temp', `render-${Date.now()}`);

  try {
    const body: RenderRequest = await request.json();
    const { projectId, scenes, projectTitle, includeSubtitles = true } = body;

    if (!scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: '没有可渲染的场景' },
        { status: 400 }
      );
    }

    // 过滤出有视频或图片的场景
    const renderableScenes = scenes.filter(
      scene => scene.generatedVideo?.url || scene.generatedImage?.url
    );

    if (renderableScenes.length === 0) {
      return NextResponse.json(
        { error: '没有可用的视频或图片素材' },
        { status: 400 }
      );
    }

    console.log(`[FFmpeg] 开始渲染项目: ${projectId}`);
    console.log(`[FFmpeg] 场景数: ${renderableScenes.length}`);

    // 创建临时目录
    await mkdir(tempDir, { recursive: true });

    // 确保输出目录存在
    const outputDir = path.resolve(process.cwd(), 'public', 'renders');
    await mkdir(outputDir, { recursive: true });

    // 步骤 1: 下载所有素材并转换
    console.log('[FFmpeg] 步骤 1: 下载素材');
    const processedScenes: ProcessedScene[] = [];

    for (let i = 0; i < renderableScenes.length; i++) {
      const scene = renderableScenes[i];
      const sceneIndex = i + 1;

      if (scene.generatedVideo?.url) {
        // 处理视频
        const videoPath = path.join(tempDir, `scene-${sceneIndex}.mp4`);
        console.log(`[FFmpeg] 下载视频 ${sceneIndex}/${renderableScenes.length}`);
        await downloadFile(scene.generatedVideo.url, videoPath);

        processedScenes.push({
          path: videoPath,
          duration: scene.duration,
          subtitle: scene.subtitles || scene.description || '',
          isImage: false,
        });
      } else if (scene.generatedImage?.url) {
        // 处理图片 -> 转换为视频
        const imagePath = path.join(tempDir, `scene-${sceneIndex}.jpg`);
        const videoPath = path.join(tempDir, `scene-${sceneIndex}.mp4`);

        console.log(`[FFmpeg] 下载图片 ${sceneIndex}/${renderableScenes.length}`);
        await downloadFile(scene.generatedImage.url, imagePath);

        console.log(`[FFmpeg] 转换图片为视频 ${sceneIndex}/${renderableScenes.length}`);
        await imageToVideo(imagePath, scene.duration, videoPath);

        processedScenes.push({
          path: videoPath,
          duration: scene.duration,
          subtitle: scene.subtitles || scene.description || '',
          isImage: true,
        });
      }
    }

    // 步骤 2: 生成字幕文件（可選）
    let subtitlePath: string | null = null;
    if (includeSubtitles) {
      console.log('[FFmpeg] 步骤 2: 生成字幕');
      subtitlePath = path.join(tempDir, 'subtitles.srt');
      await generateSubtitles(processedScenes, subtitlePath);
    } else {
      console.log('[FFmpeg] 步骤 2: 跳過字幕');
    }

    // 步骤 3: 合并视频
    console.log('[FFmpeg] 步骤 3: 合并视频');
    const outputPath = path.join(outputDir, `${projectId}.mp4`);
    await concatenateVideos(processedScenes, outputPath, subtitlePath);

    // 步骤 4: 清理临时文件
    console.log('[FFmpeg] 步骤 4: 清理临时文件');
    await rm(tempDir, { recursive: true, force: true });

    const totalDuration = processedScenes.reduce((sum, s) => sum + s.duration, 0);

    return NextResponse.json({
      success: true,
      videoUrl: `/renders/${projectId}.mp4`,
      duration: totalDuration,
      scenes: processedScenes.length,
    });

  } catch (error) {
    console.error('[FFmpeg] 渲染错误:', error);

    // 清理临时文件
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true }).catch(console.error);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '渲染失败',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
