/**
 * FFmpeg 影片渲染 API
 * 自動合成場景、加入轉場和字幕
 */

import { NextRequest, NextResponse } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { copyFile, mkdir, writeFile, unlink, rm } from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import type { Scene, Storyboard } from '@/lib/types/storyboard';
import type { EditingSuggestion, SceneEditSuggestion } from '@/lib/types/project';
import { buildTimelineComposition } from '@/lib/types/timeline';
import { completeGenerationRun, startGenerationRun } from '@/lib/workflow/run-logger';

// 設定 FFmpeg 路径
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const maxDuration = 300; // 最长5分钟

interface RenderRequest {
  projectId: string;
  scenes: Scene[];
  storyboardId?: string;
  projectTitle: string;
  includeSubtitles?: boolean;
  includeAudio?: boolean;
  generatedMusic?: {
    url: string;
    durationSeconds?: number;
  };
  audioMixSettings?: {
    voiceoverVolume?: number;
    musicVolume?: number;
    ducking?: boolean;
  };
  editingSuggestion?: EditingSuggestion | null;
}

interface ProcessedScene {
  sceneId: string;
  path: string;
  duration: number;
  subtitle: string;
  isImage: boolean;
  transitionType: string;
  transitionDuration: number;
  applyTransition: boolean;
  voiceoverUrl?: string;
  voiceoverDurationSeconds?: number;
}

interface TimelineLayout {
  startTimes: number[];
  totalDuration: number;
  transitionDurations: number[];
}

interface PreparedAudioClip {
  path: string;
  role: 'voice' | 'music';
  startSec: number;
  durationSec?: number;
  volume: number;
}

const FALLBACK_TRANSITION_DURATION = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeVolume(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, 0, 1.5);
}

function safeDuration(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function resolveTransitionOverlap(prevScene: ProcessedScene, nextScene: ProcessedScene): number {
  const baseDuration = prevScene.applyTransition ? prevScene.transitionDuration : 0.01;
  return Math.max(
    0.01,
    Math.min(
      safeDuration(baseDuration, FALLBACK_TRANSITION_DURATION),
      prevScene.duration * 0.45,
      nextScene.duration * 0.45
    )
  );
}

function buildTimelineLayout(scenes: ProcessedScene[]): TimelineLayout {
  if (scenes.length === 0) {
    return { startTimes: [], totalDuration: 0, transitionDurations: [] };
  }

  const startTimes = new Array<number>(scenes.length).fill(0);
  const transitionDurations = new Array<number>(Math.max(0, scenes.length - 1)).fill(0);
  let timelineCursor = scenes[0].duration;

  for (let i = 1; i < scenes.length; i++) {
    const prevScene = scenes[i - 1];
    const nextScene = scenes[i];
    const transitionDuration = resolveTransitionOverlap(prevScene, nextScene);
    transitionDurations[i - 1] = transitionDuration;
    const nextStart = Math.max(0.01, timelineCursor - transitionDuration);
    startTimes[i] = nextStart;
    timelineCursor = nextStart + nextScene.duration;
  }

  return {
    startTimes,
    totalDuration: timelineCursor,
    transitionDurations,
  };
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
): Promise<TimelineLayout> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // 加入所有輸入
    scenes.forEach(scene => {
      command.input(scene.path);
    });

    // 建構複雜過濾器（場景拼接 + 淡入淡出轉場）
    const filterComplex: string[] = [];
    const timeline = buildTimelineLayout(scenes);

    scenes.forEach((scene, index) => {
      // 為每個場景加入 scale 確保尺寸一致
      filterComplex.push(`[${index}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${index}]`);
    });

    // 建構轉場鏈
    let currentLabel = 'v0';
    for (let i = 1; i < scenes.length; i++) {
      const nextLabel = i === scenes.length - 1 ? 'outv' : `v${i}tmp`;
      const prevScene = scenes[i - 1];
      const transitionDuration = timeline.transitionDurations[i - 1] || 0.01;
      const offset = timeline.startTimes[i];

      filterComplex.push(
        `[${currentLabel}][v${i}]xfade=transition=${prevScene.transitionType}:duration=${transitionDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${nextLabel}]`
      );

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
        resolve(timeline);
      })
      .on('error', (err) => {
        console.error('[FFmpeg] 錯誤:', err);
        reject(err);
      })
      .run();
  });
}

async function mixAudioIntoVideo(
  videoPath: string,
  outputPath: string,
  clips: PreparedAudioClip[],
  videoDurationSec: number,
  ducking: boolean
): Promise<void> {
  if (clips.length === 0) {
    await copyFile(videoPath, outputPath);
    return;
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    command.input(videoPath);
    clips.forEach((clip) => command.input(clip.path));

    const filterComplex: string[] = [];
    const voiceLabels: string[] = [];
    const musicLabels: string[] = [];

    clips.forEach((clip, index) => {
      const inputIndex = index + 1;
      const baseLabel = `a${inputIndex}`;
      const parts: string[] = [`[${inputIndex}:a]aresample=48000`];
      if (clip.durationSec && clip.durationSec > 0) {
        parts.push(`atrim=0:${clip.durationSec.toFixed(3)}`);
      }
      parts.push('asetpts=PTS-STARTPTS');
      if (clip.startSec > 0.001) {
        const delayMs = Math.max(0, Math.round(clip.startSec * 1000));
        parts.push(`adelay=${delayMs}|${delayMs}`);
      }
      parts.push(`volume=${clip.volume.toFixed(3)}`);
      filterComplex.push(`${parts.join(',')}[${baseLabel}]`);
      if (clip.role === 'voice') {
        voiceLabels.push(`[${baseLabel}]`);
      } else {
        musicLabels.push(`[${baseLabel}]`);
      }
    });

    const buildMixBus = (labels: string[], outLabel: string) => {
      if (labels.length === 0) return;
      if (labels.length === 1) {
        filterComplex.push(`${labels[0]}anull[${outLabel}]`);
      } else {
        filterComplex.push(
          `${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0[${outLabel}]`
        );
      }
    };

    buildMixBus(voiceLabels, 'voiceBus');
    buildMixBus(musicLabels, 'musicBus');

    if (voiceLabels.length > 0 && musicLabels.length > 0) {
      if (ducking) {
        filterComplex.push('[musicBus][voiceBus]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=260[duckedMusic]');
        filterComplex.push('[duckedMusic][voiceBus]amix=inputs=2:normalize=0:dropout_transition=0[mixedAudio]');
      } else {
        filterComplex.push('[musicBus][voiceBus]amix=inputs=2:normalize=0:dropout_transition=0[mixedAudio]');
      }
    } else if (voiceLabels.length > 0) {
      filterComplex.push('[voiceBus]anull[mixedAudio]');
    } else {
      filterComplex.push('[musicBus]anull[mixedAudio]');
    }

    filterComplex.push(`[mixedAudio]alimiter=limit=0.95,atrim=0:${videoDurationSec.toFixed(3)}[aout]`);

    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map 0:v:0',
        '-map [aout]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-movflags +faststart',
        '-shortest',
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('[FFmpeg] 音訊混音命令:', commandLine);
      })
      .on('error', (error) => {
        reject(error);
      })
      .on('end', () => {
        resolve();
      })
      .run();
  });
}

export async function POST(request: NextRequest) {
  const tempDir = path.resolve(process.cwd(), 'temp', `render-${Date.now()}`);

  let activeRunId: string | null = null;
  try {
    const body: RenderRequest = await request.json();
    const {
      projectId,
      scenes,
      storyboardId,
      includeSubtitles = true,
      includeAudio = true,
      generatedMusic,
      audioMixSettings,
      editingSuggestion,
    } = body;

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

    const storyboardForTimeline: Storyboard = {
      id: storyboardId || `storyboard-${projectId}`,
      projectId,
      title: body.projectTitle,
      originalPrompt: '',
      templateUsed: 'runtime-ffmpeg',
      scenes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generatedMusic: generatedMusic
        ? {
            url: generatedMusic.url,
            model: 'elevenlabs-music',
            prompt: 'ffmpeg-render-bgm',
            durationSeconds: generatedMusic.durationSeconds,
            timestamp: new Date().toISOString(),
          }
        : undefined,
      audioMixSettings,
    };
    const timelineComposition = buildTimelineComposition(storyboardForTimeline, {
      includeSubtitles,
      includeVoiceovers: includeAudio,
      includeMusic: includeAudio,
      editingSuggestion,
    });
    const run = startGenerationRun({
      projectId,
      stage: 'ffmpeg_render',
      provider: 'ffmpeg',
      model: 'libx264+aac',
      promptText: JSON.stringify({
        includeSubtitles,
        includeAudio,
        sceneCount: scenes.length,
      }),
      metadata: {
        timelineComposition,
        audioMixSettings,
      },
    });
    activeRunId = run.id;

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
          sceneId: scene.id,
          path: videoPath,
          duration: effectiveDuration,
          subtitle: scene.dialogue || scene.description || '',
          isImage: false,
          transitionType: transitionConfig.type,
          transitionDuration,
          applyTransition: transitionConfig.applyTransition,
          voiceoverUrl: scene.generatedVoiceover?.url,
          voiceoverDurationSeconds: scene.generatedVoiceover?.durationSeconds,
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
          sceneId: scene.id,
          path: videoPath,
          duration: scene.duration,
          subtitle: scene.dialogue || scene.description || '',
          isImage: true,
          transitionType: transitionConfig.type,
          transitionDuration,
          applyTransition: transitionConfig.applyTransition,
          voiceoverUrl: scene.generatedVoiceover?.url,
          voiceoverDurationSeconds: scene.generatedVoiceover?.durationSeconds,
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
    const videoOnlyPath = includeAudio
      ? path.join(tempDir, 'video-only.mp4')
      : outputPath;
    const timeline = await concatenateVideos(processedScenes, videoOnlyPath, subtitlePath);

    // 步驟 3.5: 音訊混音（可選）
    if (includeAudio) {
      const preparedAudioClips: PreparedAudioClip[] = [];
      const voiceoverVolume = normalizeVolume(audioMixSettings?.voiceoverVolume, 1.0);
      const musicVolume = normalizeVolume(audioMixSettings?.musicVolume, 0.32);
      const ducking = audioMixSettings?.ducking !== false;

      for (let i = 0; i < processedScenes.length; i++) {
        const scene = processedScenes[i];
        if (!scene.voiceoverUrl) continue;

        const voicePath = path.join(tempDir, `voice-${i + 1}.mp3`);
        await downloadFile(scene.voiceoverUrl, voicePath);
        preparedAudioClips.push({
          path: voicePath,
          role: 'voice',
          startSec: timeline.startTimes[i] ?? 0,
          durationSec: Math.max(
            0.2,
            Math.min(
              scene.duration,
              safeDuration(scene.voiceoverDurationSeconds, scene.duration)
            )
          ),
          volume: voiceoverVolume,
        });
      }

      if (generatedMusic?.url) {
        const bgmPath = path.join(tempDir, 'bgm.mp3');
        await downloadFile(generatedMusic.url, bgmPath);
        preparedAudioClips.push({
          path: bgmPath,
          role: 'music',
          startSec: 0,
          durationSec: Math.max(
            timeline.totalDuration,
            safeDuration(generatedMusic.durationSeconds, 0)
          ),
          volume: musicVolume,
        });
      }

      if (preparedAudioClips.length > 0) {
        console.log(`[FFmpeg] 步驟 3.5: 音訊混音 (${preparedAudioClips.length} 軌)`);
        await mixAudioIntoVideo(
          videoOnlyPath,
          outputPath,
          preparedAudioClips,
          timeline.totalDuration,
          ducking
        );
      } else {
        console.log('[FFmpeg] 步驟 3.5: 無可用音訊，輸出靜音影片');
        await copyFile(videoOnlyPath, outputPath);
      }
    }

    // 步驟 4: 清理暫時文件
    console.log('[FFmpeg] 步驟 4: 清理暫時文件');
    await rm(tempDir, { recursive: true, force: true });

    if (activeRunId) {
      completeGenerationRun(activeRunId, {
        status: 'completed',
        outputUrl: `/renders/${projectId}.mp4`,
        metadata: {
          duration: timeline.totalDuration,
          scenes: processedScenes.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      videoUrl: `/renders/${projectId}.mp4`,
      duration: timeline.totalDuration,
      scenes: processedScenes.length,
    });

  } catch (error) {
    console.error('[FFmpeg] 渲染錯誤:', error);

    // 清理暫時文件
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true }).catch(console.error);
    }

    if (activeRunId) {
      completeGenerationRun(activeRunId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '渲染失敗',
        metadata: error instanceof Error ? { stack: error.stack } : undefined,
      });
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
