/**
 * FFmpeg 影片渲染 API
 * 自動合成場景、加入轉場和字幕
 */

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { mkdir, writeFile, unlink, rm } from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import type { Scene } from '@/lib/types/storyboard';
import type { EditingSuggestion, SceneEditSuggestion } from '@/lib/types/project';

// 設定 FFmpeg 路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const maxDuration = 300; // 最长5分钟

interface RenderRequest {
  projectId: string;
  scenes: Scene[];
  projectTitle: string;
  includeSubtitles?: boolean;
  editingSuggestion?: EditingSuggestion | null;
}

interface ProcessedScene {
  path: string;
  duration: number;
  subtitle: string;
  isImage: boolean;
  transitionType: string;
  transitionDuration: number;
  applyTransition: boolean;
}

/**
 * 下載文件到本地
 */
async function downloadFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下載失敗: ${url}`);
  }
  const fileStream = createWriteStream(outputPath);
  await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);
}

/**
 * 將圖片轉換為影片片段
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

async function trimVideo(
  inputPath: string,
  startSec: number,
  durationSec: number,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSec)
      .duration(durationSec)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset medium',
        '-crf 23',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function normalizeTransitionType(raw?: string): { type: string; applyTransition: boolean } {
  const value = (raw || '').toLowerCase().trim();
  if (!value) return { type: 'fade', applyTransition: true };

  if (['cut', 'continuation', 'none'].includes(value)) {
    return { type: 'fade', applyTransition: false };
  }
  if (['crossfade', 'dissolve', 'fade', 'gamma_cross', 'match_cut'].includes(value)) {
    return { type: 'fade', applyTransition: true };
  }
  if (['wipe', 'wipeleft'].includes(value)) {
    return { type: 'wipeleft', applyTransition: true };
  }
  if (['wiperight'].includes(value)) {
    return { type: 'wiperight', applyTransition: true };
  }
  if (['slide', 'slideleft', 'push'].includes(value)) {
    return { type: 'slideleft', applyTransition: true };
  }
  if (['slideright'].includes(value)) {
    return { type: 'slideright', applyTransition: true };
  }
  if (['fade_black', 'diptoblack', 'diptoblack'].includes(value)) {
    return { type: 'fadeblack', applyTransition: true };
  }
  if (['fade_white', 'diptowhite'].includes(value)) {
    return { type: 'fadewhite', applyTransition: true };
  }

  return { type: 'fade', applyTransition: true };
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
 * 合並影片片段（帶轉場效果）
 */
async function concatenateVideos(
  scenes: ProcessedScene[],
  outputPath: string,
  subtitlePath: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // 加入所有輸入
    scenes.forEach(scene => {
      command.input(scene.path);
    });

    // 建構複雜過濾器（場景拼接 + 淡入淡出轉場）
    const filterComplex: string[] = [];
    const fallbackTransitionDuration = 0.5;

    scenes.forEach((scene, index) => {
      // 為每個場景加入 scale 確保尺寸一致
      filterComplex.push(`[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${index}]`);
    });

    // 建構轉場鏈
    let currentLabel = 'v0';
    let cumulativeDuration = scenes[0]?.duration || 0;
    for (let i = 1; i < scenes.length; i++) {
      const nextLabel = i === scenes.length - 1 ? 'outv' : `v${i}tmp`;
      const prevScene = scenes[i - 1];
      const nextScene = scenes[i];
      const baseDuration = prevScene.applyTransition
        ? prevScene.transitionDuration
        : 0.01;
      const transitionDuration = Math.max(
        0.01,
        Math.min(baseDuration || fallbackTransitionDuration, prevScene.duration * 0.45, nextScene.duration * 0.45)
      );
      const offset = Math.max(0.01, cumulativeDuration - transitionDuration);

      filterComplex.push(
        `[${currentLabel}][v${i}]xfade=transition=${prevScene.transitionType}:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${nextLabel}]`
      );

      cumulativeDuration = cumulativeDuration + nextScene.duration - transitionDuration;
      currentLabel = nextLabel;
    }

    // 如果只有一個場景，直接使用
    if (scenes.length === 1) {
      filterComplex.push('[v0]null[outv]');
    }

    // 有字幕則燒入，否則直接輸出
    if (subtitlePath) {
      filterComplex.push(`[outv]subtitles=${subtitlePath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,Shadow=1'[outfinal]`);
    } else {
      filterComplex.push('[outv]null[outfinal]');
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
        console.log(`[FFmpeg] 進度: ${progress.percent?.toFixed(1)}%`);
      })
      .on('end', () => {
        console.log('[FFmpeg] 渲染完成');
        resolve();
      })
      .on('error', (err) => {
        console.error('[FFmpeg] 錯誤:', err);
        reject(err);
      })
      .run();
  });
}

export async function POST(request: NextRequest) {
  const tempDir = path.resolve(process.cwd(), 'temp', `render-${Date.now()}`);

  try {
    const body: RenderRequest = await request.json();
    const { projectId, scenes, includeSubtitles = true, editingSuggestion } = body;

    if (!scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: '沒有可渲染的場景' },
        { status: 400 }
      );
    }

    // 過濾出有影片或圖片的場景
    const renderableScenes = scenes.filter(
      scene => scene.generatedVideo?.url || scene.generatedImage?.url
    );
    const suggestionMap = new Map<string, SceneEditSuggestion>(
      (editingSuggestion?.scenes || []).map(scene => [scene.sceneId, scene])
    );
    const globalTransitionDuration = Number(editingSuggestion?.transitionDuration);

    if (renderableScenes.length === 0) {
      return NextResponse.json(
        { error: '沒有可用的影片或圖片素材' },
        { status: 400 }
      );
    }

    console.log(`[FFmpeg] 開始渲染專案: ${projectId}`);
    console.log(`[FFmpeg] 場景数: ${renderableScenes.length}`);

    // 建立暫時目錄
    await mkdir(tempDir, { recursive: true });

    // 確保輸出目錄存在
    const outputDir = path.resolve(process.cwd(), 'public', 'renders');
    await mkdir(outputDir, { recursive: true });

    // 步驟 1: 下載所有素材並轉換
    console.log('[FFmpeg] 步驟 1: 下載素材');
    const processedScenes: ProcessedScene[] = [];

    for (let i = 0; i < renderableScenes.length; i++) {
      const scene = renderableScenes[i];
      const sceneIndex = i + 1;

      if (scene.generatedVideo?.url) {
        const sceneSuggestion = suggestionMap.get(scene.id);
        const inPointRaw = Number(sceneSuggestion?.inPoint);
        const outPointRaw = Number(sceneSuggestion?.outPoint);
        const inPoint = Number.isFinite(inPointRaw) ? Math.max(0, inPointRaw) : 0;
        const outPoint = Number.isFinite(outPointRaw) && outPointRaw > inPoint
          ? outPointRaw
          : scene.duration;
        const effectiveDuration = Math.max(0.3, outPoint - inPoint);
        const transitionSource = sceneSuggestion?.transition || scene.transitionToNext?.type || 'dissolve';
        const transitionDurationRaw = Number(sceneSuggestion?.transitionDuration ?? scene.transitionToNext?.duration ?? globalTransitionDuration ?? 0.5);
        const transitionDuration = Number.isFinite(transitionDurationRaw) ? Math.max(0.1, Math.min(2, transitionDurationRaw)) : 0.5;
        const transitionConfig = normalizeTransitionType(transitionSource);

        // 處理影片
        const sourceVideoPath = path.join(tempDir, `scene-${sceneIndex}-source.mp4`);
        const videoPath = path.join(tempDir, `scene-${sceneIndex}.mp4`);
        console.log(`[FFmpeg] 下載影片 ${sceneIndex}/${renderableScenes.length}`);
        await downloadFile(scene.generatedVideo.url, sourceVideoPath);
        await trimVideo(sourceVideoPath, inPoint, effectiveDuration, videoPath);
        await unlink(sourceVideoPath).catch(() => undefined);

        processedScenes.push({
          path: videoPath,
          duration: effectiveDuration,
          subtitle: scene.dialogue || scene.description || '',
          isImage: false,
          transitionType: transitionConfig.type,
          transitionDuration,
          applyTransition: transitionConfig.applyTransition,
        });
      } else if (scene.generatedImage?.url) {
        const transitionConfig = normalizeTransitionType(scene.transitionToNext?.type || 'dissolve');
        const transitionDurationRaw = Number(scene.transitionToNext?.duration ?? globalTransitionDuration ?? 0.5);
        const transitionDuration = Number.isFinite(transitionDurationRaw) ? Math.max(0.1, Math.min(2, transitionDurationRaw)) : 0.5;
        // 處理圖片 -> 轉換為影片
        const imagePath = path.join(tempDir, `scene-${sceneIndex}.jpg`);
        const videoPath = path.join(tempDir, `scene-${sceneIndex}.mp4`);

        console.log(`[FFmpeg] 下載圖片 ${sceneIndex}/${renderableScenes.length}`);
        await downloadFile(scene.generatedImage.url, imagePath);

        console.log(`[FFmpeg] 轉換圖片為影片 ${sceneIndex}/${renderableScenes.length}`);
        await imageToVideo(imagePath, scene.duration, videoPath);

        processedScenes.push({
          path: videoPath,
          duration: scene.duration,
          subtitle: scene.dialogue || scene.description || '',
          isImage: true,
          transitionType: transitionConfig.type,
          transitionDuration,
          applyTransition: transitionConfig.applyTransition,
        });
      }
    }

    // 步驟 2: 生成字幕文件（可選）
    let subtitlePath: string | null = null;
    if (includeSubtitles) {
      console.log('[FFmpeg] 步驟 2: 生成字幕');
      subtitlePath = path.join(tempDir, 'subtitles.srt');
      await generateSubtitles(processedScenes, subtitlePath);
    } else {
      console.log('[FFmpeg] 步驟 2: 跳過字幕');
    }

    // 步驟 3: 合並影片
    console.log('[FFmpeg] 步驟 3: 合並影片');
    const outputPath = path.join(outputDir, `${projectId}.mp4`);
    await concatenateVideos(processedScenes, outputPath, subtitlePath);

    // 步驟 4: 清理暫時文件
    console.log('[FFmpeg] 步驟 4: 清理暫時文件');
    await rm(tempDir, { recursive: true, force: true });

    const totalDuration = processedScenes.reduce((sum, s) => sum + s.duration, 0);

    return NextResponse.json({
      success: true,
      videoUrl: `/renders/${projectId}.mp4`,
      duration: totalDuration,
      scenes: processedScenes.length,
    });

  } catch (error) {
    console.error('[FFmpeg] 渲染錯誤:', error);

    // 清理暫時文件
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true }).catch(console.error);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '渲染失敗',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
