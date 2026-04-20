'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Film, CheckCircle2, Search } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useProjectStore } from '@/stores/project-store';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { getWorkflowProgress } from '@/lib/project/workflow';
import { VideoGenerator } from '@/components/video-generation/VideoGenerator';
import { LibrarySyncNotice } from '@/components/characters/LibrarySyncNotice';
import { Button } from '@/components/ui/button';
import { resolveContinuationSource } from '@/lib/utils/transition';
import type { ProjectReference } from '@/lib/types/storyboard';

type VideoModel = 'kling' | 'seedance';

type WorkflowTaskStage = 'video';
type WorkflowTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

interface WorkflowTask {
  id: string;
  sceneId?: string;
  stage: WorkflowTaskStage;
  status: WorkflowTaskStatus;
  model?: string;
  prompt?: string;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export default function VideosPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, isCurrentProjectLoading, setCurrentProject, updateProject } = useProjectStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [sceneQuery, setSceneQuery] = useState('');
  const [generationTasks, setGenerationTasks] = useState<WorkflowTask[]>([]);
  const appliedRecoveredKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/workflow/tasks?projectId=${encodeURIComponent(projectId)}&stage=video&recoverRunning=1`);
        if (!response.ok) return;

        const payload = (await response.json()) as { data?: WorkflowTask[] };
        if (!cancelled) {
          setGenerationTasks(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch video workflow tasks', error);
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(fetchTasks, 3000);
        }
      }
    };

    void fetchTasks();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [projectId]);

  const scenes = useMemo(
    () => currentProject?.storyboard?.scenes ?? [],
    [currentProject?.storyboard?.scenes]
  );
  const blockedScenes = scenes.filter((s) => s.qaStatus === 'block');
  const progress = getWorkflowProgress(currentProject);
  const filteredScenes = useMemo(() => {
    const query = sceneQuery.trim().toLowerCase();
    if (!query) return scenes;
    return scenes.filter((scene) => {
      const normalizedSceneNo = String(scene.sceneNumber);
      const normalizedDesc = scene.description.toLowerCase();
      return normalizedSceneNo.includes(query) || normalizedDesc.includes(query);
    });
  }, [sceneQuery, scenes]);
  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  const latestVideoTaskMap = useMemo(() => {
    const map = new Map<string, WorkflowTask>();
    const sortedTasks = [...generationTasks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    for (const task of sortedTasks) {
      if (!task.sceneId || task.stage !== 'video') continue;
      if (!map.has(task.sceneId)) {
        map.set(task.sceneId, task);
      }
    }

    return map;
  }, [generationTasks]);

  const getSceneGenerationState = useCallback((sceneId: string) => {
    const task = latestVideoTaskMap.get(sceneId);
    return {
      isGenerating: task?.status === 'running',
    };
  }, [latestVideoTaskMap]);

  // 統計資訊
  const scenesWithImages = scenes.filter(s => Boolean(s.generatedImage?.url));
  const scenesWithVideos = scenes.filter(s => Boolean(s.generatedVideo?.url));
  const generatingSceneCount = scenes.filter((scene) => getSceneGenerationState(scene.id).isGenerating).length;
  const selectedSceneInFilterIndex = filteredScenes.findIndex((scene) => scene.id === selectedSceneId);
  const hasEffectiveStartFrame = useCallback((sceneId: string) => {
    const sceneIndex = scenes.findIndex((scene) => scene.id === sceneId);
    if (sceneIndex === -1) return false;
    const scene = scenes[sceneIndex];
    const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
    const previousEndFrameUrl = resolveContinuationSource(previousScene).url;

    return Boolean(previousEndFrameUrl || scene.generatedImage?.url);
  }, [scenes]);

  useEffect(() => {
    if (scenes.length === 0) {
      setSelectedSceneId(null);
      return;
    }

    if (selectedSceneId && scenes.some((scene) => scene.id === selectedSceneId)) {
      return;
    }

    const firstReadyScene = scenes.find((scene) => scene.qaStatus !== 'block' && hasEffectiveStartFrame(scene.id));
    setSelectedSceneId(firstReadyScene?.id || null);
  }, [hasEffectiveStartFrame, scenes, selectedSceneId]);

  const moveSelectedScene = useCallback((offset: -1 | 1) => {
    if (filteredScenes.length === 0 || selectedSceneInFilterIndex === -1) return;
    const targetIndex = selectedSceneInFilterIndex + offset;
    if (targetIndex < 0 || targetIndex >= filteredScenes.length) return;

    const targetScene = filteredScenes[targetIndex];
    if (!targetScene) return;
    if (targetScene.qaStatus === 'block' || !hasEffectiveStartFrame(targetScene.id)) return;
    setSelectedSceneId(targetScene.id);
  }, [filteredScenes, hasEffectiveStartFrame, selectedSceneInFilterIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        moveSelectedScene(-1);
      }

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
        event.preventDefault();
        moveSelectedScene(1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveSelectedScene]);

  useEffect(() => {
    if (filteredScenes.length === 0) return;
    if (selectedSceneId && filteredScenes.some((scene) => scene.id === selectedSceneId)) return;

    const firstReadyInFilter = filteredScenes.find((scene) => scene.qaStatus !== 'block' && hasEffectiveStartFrame(scene.id));
    setSelectedSceneId(firstReadyInFilter?.id || null);
  }, [filteredScenes, hasEffectiveStartFrame, selectedSceneId]);

  const applyRecoveredVideoTask = useCallback((
    task: Pick<WorkflowTask, 'sceneId' | 'prompt' | 'model' | 'metadata'>,
    videoUrl: string
  ) => {
    if (!currentProject?.storyboard || !task.sceneId || !videoUrl.trim()) return;

    const trimmedUrl = videoUrl.trim();
    const durationCandidate = task.metadata?.durationSeconds;
    const durationSeconds = typeof durationCandidate === 'number' ? durationCandidate : undefined;
    const savedMotionPrompt = typeof task.metadata?.motionPrompt === 'string'
      ? task.metadata.motionPrompt
      : undefined;

    const nextScenes = currentProject.storyboard.scenes.map((scene) => {
      if (scene.id !== task.sceneId) return scene;

      const model = task.model === 'kling' || task.model === 'seedance'
        ? task.model
        : (scene.generatedVideo?.model || 'kling');
      const prompt = task.prompt || scene.generatedVideo?.prompt || '';
      const sameUrl = scene.generatedVideo?.url === trimmedUrl;
      const samePrompt = (scene.generatedVideo?.prompt || '') === prompt;
      const sameModel = scene.generatedVideo?.model === model;
      const sameDuration = typeof durationSeconds === 'number'
        ? scene.generatedVideo?.durationSeconds === durationSeconds
        : true;
      if (sameUrl && samePrompt && sameModel && sameDuration) {
        return scene;
      }

      return {
        ...scene,
        generatedVideo: {
          url: trimmedUrl,
          model,
          prompt,
          durationSeconds: typeof durationSeconds === 'number'
            ? durationSeconds
            : scene.generatedVideo?.durationSeconds,
          timestamp: new Date().toISOString(),
        },
        motionPrompt: savedMotionPrompt || scene.motionPrompt || scene.cameraMovement,
      };
    });

    const changed = nextScenes.some((scene, index) => scene !== currentProject.storyboard!.scenes[index]);
    if (!changed) return;

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: nextScenes,
        updatedAt: new Date().toISOString(),
      },
      status: 'videos',
    });
  }, [currentProject, projectId, updateProject]);

  useEffect(() => {
    if (!currentProject?.storyboard) return;

    generationTasks.forEach((task) => {
      if (!task.sceneId) return;
      if (task.stage !== 'video') return;
      if (task.status !== 'completed') return;
      if (!task.outputUrl || !task.outputUrl.trim()) return;

      const key = `${task.id}:${task.outputUrl}`;
      if (appliedRecoveredKeysRef.current.has(key)) return;
      appliedRecoveredKeysRef.current.add(key);
      applyRecoveredVideoTask(task, task.outputUrl);
    });
  }, [applyRecoveredVideoTask, currentProject?.storyboard, generationTasks]);

  const handleVideoGenerated = (
    sceneId: string,
    videoUrl: string,
    motionPrompt: string,
    composedPrompt: string,
    model: VideoModel,
    durationSeconds: number
  ) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? {
          ...scene,
          generatedVideo: {
            url: videoUrl,
            model,
            prompt: composedPrompt,
            durationSeconds,
            timestamp: new Date().toISOString(),
          },
          motionPrompt,
        }
        : scene
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
      status: 'videos',
    });
  };

  const handleReferencesReplaced = (nextReferences: ProjectReference[]) => {
    if (!currentProject?.storyboard) return;
    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        projectReferences: nextReferences,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleVideoModeChanged = (sceneId: string, mode: 'standard' | 'reference') => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId ? { ...scene, videoMode: mode } : scene
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleVideoPromptDraftChanged = (
    sceneId: string,
    draftPrompt: string,
    notes?: string
  ) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? {
          ...scene,
          videoPromptDraft: draftPrompt,
          videoPromptDraftNotes: notes,
        }
        : scene
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  if (isCurrentProjectLoading && !currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg text-muted-foreground font-medium">載入專案中...</p>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">找不到專案或已被刪除</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  if (!currentProject.storyboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">請先建立分鏡腳本</p>
          <Link
            href={`/project/${projectId}/storyboard`}
            className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            前往分鏡編輯
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/project/${projectId}`}
                className="surface-soft rounded-lg p-2 transition-colors hover:border-primary/25"
              >
                <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </Link>
              <div>
                <p className="text-kicker">Video Generation</p>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary" />
                  影片生成
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentProject.name} · {scenes.length} 個場景
                </p>
              </div>
            </div>

            {/* 統計 */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  已生成圖片: <span className="text-blue-500 font-medium">{scenesWithImages.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  已生成影片: <span className="text-green-500 font-medium">{scenesWithVideos.length}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ProjectStepNavigator
        projectId={projectId}
        project={currentProject}
        currentStep="videos"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <LibrarySyncNotice
            projectReferences={currentProject.storyboard?.projectReferences || []}
            onReferencesReplaced={handleReferencesReplaced}
          />
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="surface-soft p-4">
            <p className="text-kicker">Image Ready</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{scenesWithImages.length}/{scenes.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">可用於影片生成的場景</p>
          </div>
          <div className="surface-soft p-4">
            <p className="text-kicker">Video Done</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{scenesWithVideos.length}/{scenes.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">已完成的影片場景</p>
          </div>
          <div className="surface-soft p-4">
            <p className="text-kicker">In Queue</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{generatingSceneCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">正在生成中的影片場景</p>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-6">
          {/* Scene List */}
          <div className="col-span-12 lg:col-span-4 space-y-3">
            <div className="surface-soft p-3">
              <p className="px-1 text-sm font-medium text-slate-600 dark:text-slate-300">選擇場景</p>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={sceneQuery}
                  onChange={(e) => setSceneQuery(e.target.value)}
                  placeholder="搜尋場景編號或描述..."
                  className="w-full rounded-xl border border-border/70 bg-white/75 py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/35 dark:bg-slate-900/65"
                />
              </div>
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                快捷鍵：`↑/↓` 或 `j/k` 切換場景
              </p>
            </div>
            <div className="space-y-2 max-h-[calc(100vh-230px)] overflow-y-auto pr-2">
              {filteredScenes.length === 0 && (
                <div className="surface-soft p-5 text-center text-sm text-muted-foreground">
                  沒有符合條件的場景
                </div>
              )}
              {filteredScenes.map((scene) => {
                const sceneIndex = scenes.findIndex((s) => s.id === scene.id);
                const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
                const previousContinuation = resolveContinuationSource(previousScene);
                const previousContinuationUrl = previousContinuation.url;
                const previousContinuationSource = previousContinuation.source;
                const effectiveStartFrameUrl = previousContinuationUrl || scene.generatedImage?.url;
                const hasImage = !!effectiveStartFrameUrl;
                const hasVideo = Boolean(scene.generatedVideo?.url);
                const sceneGenerationState = getSceneGenerationState(scene.id);
                const isLocked = scene.qaStatus === 'block' || !hasImage;

                return (
                  <button
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    disabled={isLocked}
                    className={`
                      w-full text-left p-4 rounded-lg border transition-all
                      ${isLocked
                        ? 'opacity-60 cursor-not-allowed border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10'
                        : ''}
                      ${selectedSceneId === scene.id
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800'
                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }
                    `}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        場景 {scene.sceneNumber}
                      </span>
                      <div className="flex items-center gap-1">
                        {sceneGenerationState.isGenerating && (
                          <div
                            className="h-2 w-2 animate-pulse rounded-full bg-amber-400"
                            title="影片生成中"
                          />
                        )}
                        {hasImage && (
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-400" title="已生成圖片" />
                        )}
                        {hasVideo && (
                          <div title="已生成影片">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                      {scene.description}
                    </p>
                    {scene.qaStatus === 'block' && (
                      <p className="mb-2 text-xs text-red-600 dark:text-red-300">
                        QA 阻擋：請先回分鏡頁修正或重生此場景
                      </p>
                    )}
                    {!hasImage && scene.qaStatus !== 'block' && (
                      <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
                        尚未有首幀圖片，請先到圖片頁生成
                      </p>
                    )}

                    {effectiveStartFrameUrl && (
                      <div className="space-y-1.5">
                        <div className="relative aspect-video overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                          <Image
                            src={effectiveStartFrameUrl}
                            alt={`Scene ${scene.sceneNumber}`}
                            fill
                            sizes="(max-width: 1024px) 33vw, 300px"
                            className="object-cover"
                            loading={selectedSceneId === scene.id ? 'eager' : 'lazy'}
                            unoptimized
                          />
                        </div>
                        {previousContinuationUrl && (
                          <p className="text-[10px] text-purple-600 dark:text-purple-400">
                            起始幀來源：場景 {previousScene?.sceneNumber}
                            {previousContinuationSource === 'start' ? ' 首幀' : ' 尾幀'}
                          </p>
                        )}
                        {scene.generatedEndFrame && (
                          <>
                            <p className="flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400">
                              <span className="inline-block h-1 w-1 rounded-full bg-purple-600 dark:bg-purple-400"></span>
                              尾幀
                            </p>
                            <div className="relative aspect-video overflow-hidden rounded border border-purple-200 dark:border-purple-700">
                              <Image
                                src={scene.generatedEndFrame.url}
                                alt={`Scene ${scene.sceneNumber} End Frame`}
                                fill
                                sizes="(max-width: 1024px) 33vw, 300px"
                                className="object-cover"
                                loading={selectedSceneId === scene.id ? 'eager' : 'lazy'}
                                unoptimized
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Video Generator */}
          <div className="col-span-12 lg:col-span-8">
            {selectedScene ? (() => {
              // 計算 previousEndFrameUrl（用於 continuation 轉場）
              const sceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
              const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
              const previousContinuation = resolveContinuationSource(previousScene);
              const previousEndFrameUrl = previousContinuation.url;
              const previousContinuationSource = previousContinuation.source;
              const selectedSceneGenerationState = getSceneGenerationState(selectedScene.id);

              return (
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm">
                  <div className="surface-soft mb-4 flex items-center justify-between p-3">
                    <div>
                      <p className="text-kicker">Scene Focus</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        場景 {selectedScene.sceneNumber} · {selectedSceneInFilterIndex + 1}/{Math.max(filteredScenes.length, 1)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={selectedSceneInFilterIndex <= 0}
                        onClick={() => moveSelectedScene(-1)}
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        上一個
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={selectedSceneInFilterIndex === -1 || selectedSceneInFilterIndex >= filteredScenes.length - 1}
                        onClick={() => moveSelectedScene(1)}
                      >
                        下一個
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {selectedScene.qaStatus === 'block' && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      此場景被 QA 阻擋，請先回「分鏡腳本」修正或單場景重生。
                    </div>
                  )}
                  {/* Continuation 提示 */}
                  {previousEndFrameUrl && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        🔗 <strong>Continuation 轉場</strong>：將使用場景 {previousScene?.sceneNumber}
                        {previousContinuationSource === 'start' ? ' 首幀' : ' 尾幀'}
                        作為起始畫面
                      </p>
                    </div>
                  )}
                  {selectedSceneGenerationState.isGenerating && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                      此場景影片正在背景生成中，重新整理或關閉頁面後會自動恢復狀態。
                    </div>
                  )}
                  <VideoGenerator
                    projectId={projectId}
                    scene={selectedScene}
                    previousEndFrameUrl={previousEndFrameUrl}
                    externalGenerating={selectedSceneGenerationState.isGenerating}
                    projectReferences={currentProject.storyboard?.projectReferences}
                    allScenes={scenes}
                    sharedAnchors={currentProject.storyboard?.sharedAnchors}
                    sharedContinuityDirectives={currentProject.storyboard?.sharedContinuityDirectives}
                    onPromptDraftChanged={(draftPrompt, notes) =>
                      handleVideoPromptDraftChanged(selectedScene.id, draftPrompt, notes)
                    }
                    onVideoModeChanged={(mode) => handleVideoModeChanged(selectedScene.id, mode)}
                    onVideoGenerated={(url, motionPrompt, composedPrompt, model, durationSeconds) =>
                      handleVideoGenerated(selectedScene.id, url, motionPrompt, composedPrompt, model, durationSeconds)
                    }
                  />
                </div>
              );
            })() : (
              <div className="h-full flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                <div className="text-center">
                  <Film className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">請從左側選擇場景</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                    需要先生成場景圖片才能生成影片
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 提示訊息 */}
        {blockedScenes.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/30 rounded-lg">
            <p className="text-amber-700 dark:text-amber-300 text-sm">
              目前有 {blockedScenes.length} 個場景被 QA 阻擋，影片頁已禁止直接生成，請先回分鏡頁修正。
            </p>
          </div>
        )}
        {scenesWithImages.length === 0 && (
          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-500/30 rounded-lg">
            <p className="text-amber-600 dark:text-amber-400 text-sm">
              ⚠️ 尚未生成任何場景圖片，請先前往「圖片」頁面生成場景圖片
            </p>
            <Link
              href={`/project/${projectId}/images`}
              className="mt-2 inline-block text-sm text-amber-600 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200 underline"
            >
              前往圖片頁面 →
            </Link>
          </div>
        )}
      </main>

      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-5">
          <Link
            href={`/project/${projectId}/images`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            上一步：生成圖片
          </Link>

          {progress.hasVideos ? (
            <Link
              href={`/project/${projectId}/export`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              下一步：影片匯出
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
              title="請先生成至少一個場景影片"
            >
              下一步：影片匯出
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
