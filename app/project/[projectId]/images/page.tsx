'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Grid3x3, List, Loader2, Search, Play } from 'lucide-react';
import { QuickPreviewPlayer } from '@/components/images/QuickPreviewPlayer';
import Link from 'next/link';
import Image from 'next/image';
import { useProjectStore } from '@/stores/project-store';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { ImageGenerator } from '@/components/image-generation/ImageGenerator';
import { BatchImageGenerator } from '@/components/image-generation/BatchImageGenerator';
import { StyleProfileSelector } from '@/components/image-generation/StyleProfileSelector';
import { ConsistencyPanel } from '@/components/consistency/ConsistencyPanel';
import { LibrarySyncNotice } from '@/components/characters/LibrarySyncNotice';
import { Button } from '@/components/ui/button';
import { DEFAULT_STYLE_PROFILE_ID, findStyleProfileById } from '@/lib/constants/style-profiles';
import { getWorkflowProgress } from '@/lib/project/workflow';
import { resolveContinuationSource } from '@/lib/utils/transition';
import type { ProjectReference, SceneConsistencyReport, StyleProfile } from '@/lib/types/storyboard';

type WorkflowTaskStage = 'image_start' | 'image_end' | 'video';
type WorkflowTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

interface WorkflowTask {
  id: string;
  sceneId?: string;
  stage: WorkflowTaskStage;
  status: WorkflowTaskStatus;
  prompt?: string;
  outputUrl?: string;
  metadata?: Record<string, unknown>;
  updatedAt: string;
}

export default function ImagesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, isCurrentProjectLoading, setCurrentProject, updateProject } = useProjectStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'individual' | 'batch'>('individual');
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string>(DEFAULT_STYLE_PROFILE_ID);
  const [customStyleProfiles, setCustomStyleProfiles] = useState<StyleProfile[]>([]);
  const [generationTasks, setGenerationTasks] = useState<WorkflowTask[]>([]);
  const [sceneQuery, setSceneQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const appliedRecoveredKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/workflow/tasks?projectId=${encodeURIComponent(projectId)}&recoverRunning=1`);
        if (!response.ok) return;

        const payload = (await response.json()) as { data?: WorkflowTask[] };
        if (!cancelled) {
          setGenerationTasks(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch workflow tasks', error);
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

  useEffect(() => {
    if (!currentProject?.storyboard) return;
    setSelectedStyleProfileId(
      currentProject.storyboard.selectedStyleProfileId || DEFAULT_STYLE_PROFILE_ID
    );
    setCustomStyleProfiles(currentProject.storyboard.customStyleProfiles || []);
  }, [currentProject?.storyboard]);

  const scenes = useMemo(
    () => currentProject?.storyboard?.scenes ?? [],
    [currentProject?.storyboard?.scenes]
  );
  const blockedScenes = scenes.filter((s) => s.qaStatus === 'block');
  const processableScenes = scenes.filter((s) => s.qaStatus !== 'block');
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
  const sceneByNumber = useMemo(
    () => new Map(scenes.map((scene) => [scene.sceneNumber, scene] as const)),
    [scenes]
  );
  const latestImageTaskMap = useMemo(() => {
    const map = new Map<string, WorkflowTask>();
    const sortedTasks = [...generationTasks].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    for (const task of sortedTasks) {
      if (!task.sceneId || (task.stage !== 'image_start' && task.stage !== 'image_end')) {
        continue;
      }
      const key = `${task.sceneId}:${task.stage}`;
      if (!map.has(key)) {
        map.set(key, task);
      }
    }

    return map;
  }, [generationTasks]);

  const getSceneGenerationState = (sceneId: string) => {
    const startTask = latestImageTaskMap.get(`${sceneId}:image_start`);
    const endTask = latestImageTaskMap.get(`${sceneId}:image_end`);
    return {
      isGeneratingStart: startTask?.status === 'running',
      isGeneratingEnd: endTask?.status === 'running',
    };
  };

  const selectedSceneGenerationState = selectedScene
    ? getSceneGenerationState(selectedScene.id)
    : { isGeneratingStart: false, isGeneratingEnd: false };
  const selectedSceneInFilterIndex = filteredScenes.findIndex((scene) => scene.id === selectedSceneId);
  const generatedSceneCount = scenes.filter((scene) => Boolean(scene.generatedImage?.url)).length;
  const generatingSceneCount = scenes.filter((scene) => {
    const state = getSceneGenerationState(scene.id);
    return state.isGeneratingStart || state.isGeneratingEnd;
  }).length;

  const selectedSceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
  const previousScene = selectedScene
    ? (sceneByNumber.get(selectedScene.sceneNumber - 1) || (selectedSceneIndex > 0 ? scenes[selectedSceneIndex - 1] : null))
    : null;
  const nextScene = selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1
    ? scenes[selectedSceneIndex + 1]
    : null;
  const previousContinuation = resolveContinuationSource(previousScene);
  const previousEndFrameUrl = previousContinuation.url;
  const previousContinuationSource = previousContinuation.source;
  const selectedEffectiveStartFrameUrl = previousEndFrameUrl || selectedScene?.generatedImage?.url;
  const activeStyleProfile = findStyleProfileById(selectedStyleProfileId, customStyleProfiles);

  const applyRecoveredImageTask = useCallback((
    task: Pick<WorkflowTask, 'sceneId' | 'stage' | 'prompt'>,
    imageUrl: string,
    seed?: number
  ) => {
    if (!currentProject?.storyboard || !task.sceneId || !imageUrl.trim()) return;

    const trimmedUrl = imageUrl.trim();
    const nextScenes = currentProject.storyboard.scenes.map((scene) => {
      if (scene.id !== task.sceneId) return scene;

      if (task.stage === 'image_start') {
        const sameUrl = scene.generatedImage?.url === trimmedUrl;
        const samePrompt = (scene.generatedImage?.prompt || '') === (task.prompt || scene.generatedImage?.prompt || '');
        const sameSeed = typeof seed === 'number' ? scene.generatedImage?.seed === seed : true;
        if (sameUrl && samePrompt && sameSeed) {
          return scene;
        }

        return {
          ...scene,
          generatedImage: {
            url: trimmedUrl,
            prompt: task.prompt || scene.generatedImage?.prompt || '',
            seed: typeof seed === 'number' ? seed : scene.generatedImage?.seed,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const sameUrl = scene.generatedEndFrame?.url === trimmedUrl;
      const samePrompt = (scene.generatedEndFrame?.prompt || '') === (task.prompt || scene.generatedEndFrame?.prompt || '');
      const sameSeed = typeof seed === 'number' ? scene.generatedEndFrame?.seed === seed : true;
      if (sameUrl && samePrompt && sameSeed) {
        return scene;
      }

      return {
        ...scene,
        generatedEndFrame: {
          url: trimmedUrl,
          prompt: task.prompt || scene.generatedEndFrame?.prompt || '',
          seed: typeof seed === 'number' ? seed : scene.generatedEndFrame?.seed,
          timestamp: new Date().toISOString(),
        },
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
      status: 'images',
    });
  }, [currentProject, projectId, updateProject]);

  const moveSelectedScene = useCallback((offset: -1 | 1) => {
    if (filteredScenes.length === 0 || selectedSceneInFilterIndex === -1) return;
    const targetIndex = selectedSceneInFilterIndex + offset;
    if (targetIndex < 0 || targetIndex >= filteredScenes.length) return;

    const targetScene = filteredScenes[targetIndex];
    if (!targetScene || targetScene.qaStatus === 'block') return;
    setSelectedSceneId(targetScene.id);
  }, [filteredScenes, selectedSceneInFilterIndex]);

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

    const firstAvailable = filteredScenes.find((scene) => scene.qaStatus !== 'block');
    setSelectedSceneId(firstAvailable?.id || filteredScenes[0].id);
  }, [filteredScenes, selectedSceneId]);

  useEffect(() => {
    if (scenes.length === 0) {
      setSelectedSceneId(null);
      return;
    }

    if (selectedSceneId && scenes.some((scene) => scene.id === selectedSceneId)) {
      return;
    }

    const firstProcessableScene = scenes.find((scene) => scene.qaStatus !== 'block');
    setSelectedSceneId(firstProcessableScene?.id || scenes[0].id);
  }, [scenes, selectedSceneId]);

  useEffect(() => {
    if (!currentProject?.storyboard) return;

    generationTasks.forEach((task) => {
      if (!task.sceneId) return;
      if (task.status !== 'completed') return;
      if (task.stage !== 'image_start' && task.stage !== 'image_end') return;
      if (!task.outputUrl || !task.outputUrl.trim()) return;

      const key = `${task.id}:${task.outputUrl}`;
      if (appliedRecoveredKeysRef.current.has(key)) return;
      appliedRecoveredKeysRef.current.add(key);

      const seedValue = task.metadata?.seed;
      const seed = typeof seedValue === 'number' ? seedValue : undefined;
      applyRecoveredImageTask(task, task.outputUrl, seed);
    });
  }, [applyRecoveredImageTask, currentProject?.storyboard, generationTasks]);

  const persistStyleSettings = (nextId: string, nextCustomProfiles: StyleProfile[]) => {
    if (!currentProject?.storyboard) return;

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        selectedStyleProfileId: nextId,
        customStyleProfiles: nextCustomProfiles.length > 0 ? nextCustomProfiles : undefined,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleStyleProfileChange = (nextId: string) => {
    setSelectedStyleProfileId(nextId);
    persistStyleSettings(nextId, customStyleProfiles);
  };

  const handleCustomStyleProfilesChange = (profiles: StyleProfile[]) => {
    setCustomStyleProfiles(profiles);
    persistStyleSettings(selectedStyleProfileId, profiles);
  };

  const handleImageGenerated = (
    sceneId: string,
    imageUrl: string,
    prompt: string,
    endFrameUrl?: string,
    endFramePrompt?: string,
    startSeed?: number,
    endFrameSeed?: number
  ) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? {
          ...scene,
          generatedImage: imageUrl ? {
            url: imageUrl,
            prompt,
            seed: startSeed,
            timestamp: new Date().toISOString(),
          } : scene.generatedImage,
          generatedEndFrame: endFrameUrl ? {
            url: endFrameUrl,
            prompt: endFramePrompt || '',
            seed: endFrameSeed,
            timestamp: new Date().toISOString(),
          } : scene.generatedEndFrame, // 保留現有尾幀
        }
        : scene
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
      status: 'images',
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

  const handleConsistencyReportUpdated = (sceneId: string, report: SceneConsistencyReport) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? { ...scene, consistencyReport: report }
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

  const handleEndFrameDescriptionChanged = (sceneId: string, description: string, enabled: boolean) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene => {
      if (scene.id !== sceneId) return scene;

      if (scene.requiresEndFrame) {
        return scene;
      }

      return {
        ...scene,
        endFrameDescription: enabled ? (description || undefined) : undefined,
        endFrameDelta: enabled ? (description || undefined) : undefined,
        generatedEndFrame: enabled ? scene.generatedEndFrame : undefined,
      };
    });

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleBatchComplete = (
    results: Map<string, { url: string; prompt: string; startSeed?: number; endFrameUrl?: string; endFramePrompt?: string; endFrameSeed?: number }>
  ) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene => {
      const result = results.get(scene.id);
      if (result) {
        return {
          ...scene,
          generatedImage: result.url ? {
            url: result.url,
            prompt: result.prompt,
            seed: result.startSeed,
            timestamp: new Date().toISOString(),
          } : scene.generatedImage,
          // 如果有尾幀，也儲存尾幀資訊（不再依賴 requiresEndFrame）
          generatedEndFrame: result.endFrameUrl ? {
            url: result.endFrameUrl,
            prompt: result.endFramePrompt || '',
            seed: result.endFrameSeed,
            timestamp: new Date().toISOString(),
          } : scene.generatedEndFrame,
        };
      }
      return scene;
    });

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
      status: 'images',
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
                <p className="text-kicker">Image Generation</p>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  分鏡圖片生成
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentProject.name} · {scenes.length} 個場景
                </p>
              </div>
            </div>

            {/* Preview Flow Button */}
            {scenes.some(s => Boolean(s.generatedImage?.url)) && (
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
              >
                <Play className="h-4 w-4" />
                Preview Flow
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="surface-soft flex items-center gap-2 p-1">
              <button
                onClick={() => setViewMode('individual')}
                className={`
                  rounded-full px-3 py-1.5 text-sm font-medium transition-all
                  flex items-center gap-2
                  ${viewMode === 'individual'
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_18px_-12px_hsl(var(--primary)/0.95)]'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }
                `}
              >
                <List className="w-4 h-4" />
                單張生成
              </button>
              <button
                onClick={() => setViewMode('batch')}
                className={`
                  rounded-full px-3 py-1.5 text-sm font-medium transition-all
                  flex items-center gap-2
                  ${viewMode === 'batch'
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_18px_-12px_hsl(var(--primary)/0.95)]'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }
                `}
              >
                <Grid3x3 className="w-4 h-4" />
                批次生成
              </button>
            </div>
          </div>
        </div>
      </header>

      <ProjectStepNavigator
        projectId={projectId}
        project={currentProject}
        currentStep="images"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto mb-6 space-y-3">
          <LibrarySyncNotice
            projectReferences={currentProject.storyboard?.projectReferences || []}
            onReferencesReplaced={handleReferencesReplaced}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-soft p-4">
              <p className="text-kicker">Image Progress</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{generatedSceneCount}/{scenes.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">已生成首幀的場景數</p>
            </div>
            <div className="surface-soft p-4">
              <p className="text-kicker">In Queue</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{generatingSceneCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">目前正在生成（含尾幀）</p>
            </div>
            <div className="surface-soft p-4">
              <p className="text-kicker">QA Blocked</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{blockedScenes.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">需先回分鏡修正的場景</p>
            </div>
          </div>
          <div className="surface-soft p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-kicker">Style Profile</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  {activeStyleProfile?.name || '未設定'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  全場景套用
                </span>
                <button
                  type="button"
                  onClick={() => setShowStylePanel((prev) => !prev)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {showStylePanel ? '收合風格設定' : '展開風格設定'}
                </button>
              </div>
            </div>
          </div>

          {showStylePanel && (
            <StyleProfileSelector
              selectedProfileId={selectedStyleProfileId}
              customProfiles={customStyleProfiles}
              onChange={handleStyleProfileChange}
              onCustomProfilesChange={handleCustomStyleProfilesChange}
            />
          )}
        </div>

        {viewMode === 'individual' ? (
          <div className="grid grid-cols-12 gap-6">
            {/* Scene List */}
            <div className="col-span-12 lg:col-span-4 space-y-3">
              <div className="surface-soft p-3">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 px-1">選擇場景</p>
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
                  const sourceIndex = scenes.findIndex((s) => s.id === scene.id);
                  const prev = sceneByNumber.get(scene.sceneNumber - 1) || (sourceIndex > 0 ? scenes[sourceIndex - 1] : null);
                  const inheritedStartUrl = resolveContinuationSource(prev).url;
                  const sceneStartPreviewUrl = inheritedStartUrl || scene.generatedImage?.url;
                  const sceneGenerationState = getSceneGenerationState(scene.id);
                  const isSceneGenerating = sceneGenerationState.isGeneratingStart || sceneGenerationState.isGeneratingEnd;
                  return (
                    <button
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      disabled={scene.qaStatus === 'block'}
                      className={`
                        w-full text-left p-4 rounded-lg border transition-all
                        ${scene.qaStatus === 'block'
                          ? 'opacity-60 cursor-not-allowed border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10'
                          : ''}
                        ${selectedSceneId === scene.id
                          ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800'
                          : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }
                      `}
                    >
                      <div className="mb-2 flex items-start gap-3">
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                          {sceneStartPreviewUrl ? (
                            <div className="relative h-full w-full">
                              <Image
                                src={sceneStartPreviewUrl}
                                alt={`場景 ${scene.sceneNumber}`}
                                fill
                                sizes="96px"
                                className="object-cover"
                                loading={selectedSceneId === scene.id ? 'eager' : 'lazy'}
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Sparkles className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                              場景 {scene.sceneNumber}
                            </span>
                            {isSceneGenerating ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                生成中
                              </span>
                            ) : sceneStartPreviewUrl ? (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] text-green-700 dark:bg-green-500/20 dark:text-green-400">
                                已生成
                              </span>
                            ) : (
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                未生成
                              </span>
                            )}
                            {scene.qaStatus === 'block' && (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-500/20 dark:text-red-300">
                                QA 阻擋
                              </span>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                            {scene.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          風格：{activeStyleProfile?.name || '預設'}
                        </span>
                        {sceneGenerationState.isGeneratingEnd ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            尾幀生成中
                          </span>
                        ) : scene.generatedEndFrame && (
                          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[11px] text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            有尾幀
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image Generator */}
            <div className="col-span-12 lg:col-span-8">
              {selectedScene ? (
                <div className="space-y-4">
                  <div className="surface-soft flex items-center justify-between p-3">
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
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      此場景被 QA 阻擋，請先回「分鏡腳本」修正或使用單場景重生，再生成圖片。
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 backdrop-blur-sm">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">目前預覽</p>
                      <div className="aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        {selectedEffectiveStartFrameUrl ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={selectedEffectiveStartFrameUrl}
                              alt={`Scene ${selectedScene.sceneNumber}`}
                              fill
                              sizes="(max-width: 1024px) 50vw, 480px"
                              className="object-cover"
                              loading="eager"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">尚未生成圖片</span>
                          </div>
                        )}
                      </div>
                      {previousEndFrameUrl && (
                        <p className="text-[11px] text-purple-600 dark:text-purple-400">
                          起始幀來源：場景 {previousScene?.sceneNumber}
                          {previousContinuationSource === 'end' ? ' 尾幀' : ' 首幀'}
                          （Continuation）
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">場景摘要</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-4">
                          {selectedScene.description}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">目前風格模板</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {activeStyleProfile?.name || '預設'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">上次提示詞摘要</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-6">
                          {selectedScene.generatedImage?.prompt || '尚未生成，將使用場景描述 + 風格模板自動組合提示詞。'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedScene.generatedImage?.url && (
                    <ConsistencyPanel
                      key={`consistency-${selectedScene.id}-${selectedScene.generatedImage.url}`}
                      scene={selectedScene}
                      projectReferences={currentProject.storyboard?.projectReferences || []}
                      frameType={selectedScene.consistencyReport?.frameType === 'end' ? 'end' : 'start'}
                      onReportUpdated={(report) => handleConsistencyReportUpdated(selectedScene.id, report)}
                    />
                  )}

                  {selectedScene.qaStatus !== 'block' && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm">
                      <ImageGenerator
                        key={selectedScene.id}
                        projectId={projectId}
                        scene={selectedScene}
                        onImageGenerated={(url, prompt, endFrameUrl, endFramePrompt, startSeed, endFrameSeed) =>
                          handleImageGenerated(selectedScene.id, url, prompt, endFrameUrl, endFramePrompt, startSeed, endFrameSeed)
                        }
                        onEndFrameDescriptionChanged={(description, enabled) =>
                          handleEndFrameDescriptionChanged(selectedScene.id, description, enabled)
                        }
                        projectReferences={currentProject.storyboard?.projectReferences}
                        allScenes={scenes}
                        styleProfile={activeStyleProfile}
                        previousEndFrameUrl={previousEndFrameUrl}
                        previousContinuationSource={previousContinuationSource}
                        previousSceneDescription={previousScene?.description}
                        nextSceneDescription={nextScene?.description}
                        externalGeneratingStart={selectedSceneGenerationState.isGeneratingStart}
                        externalGeneratingEnd={selectedSceneGenerationState.isGeneratingEnd}
                        sharedAnchors={currentProject.storyboard?.sharedAnchors}
                        sharedContinuityDirectives={currentProject.storyboard?.sharedContinuityDirectives}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">請從左側選擇場景</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {blockedScenes.length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                有 {blockedScenes.length} 個場景被 QA 阻擋，批次生成會自動跳過它們。
              </div>
            )}
            <BatchImageGenerator
              projectId={projectId}
              scenes={processableScenes}
              projectReferences={currentProject.storyboard?.projectReferences}
              styleProfile={activeStyleProfile}
              sharedAnchors={currentProject.storyboard?.sharedAnchors}
              sharedContinuityDirectives={currentProject.storyboard?.sharedContinuityDirectives}
              onBatchComplete={handleBatchComplete}
            />

            {/* Scene Grid Preview */}
            <div className="mt-8">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">場景預覽</h2>
              <div className="grid grid-cols-3 gap-4">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 backdrop-blur-sm"
                  >
                    {/* 首幀 */}
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                      {scene.generatedImage?.url ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={scene.generatedImage.url}
                            alt={`Scene ${scene.sceneNumber}`}
                            fill
                            sizes="(max-width: 1024px) 33vw, 240px"
                            className="object-cover"
                            loading={selectedSceneId === scene.id ? 'eager' : 'lazy'}
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                        </div>
                      )}
                    </div>

                    {/* 尾幀（如果存在） */}
                    {scene.generatedEndFrame?.url && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
                          尾幀
                        </p>
                        <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                          <div className="relative w-full h-full">
                            <Image
                              src={scene.generatedEndFrame.url}
                              alt={`Scene ${scene.sceneNumber} End Frame`}
                              fill
                              sizes="(max-width: 1024px) 33vw, 240px"
                              className="object-cover"
                              loading={selectedSceneId === scene.id ? 'eager' : 'lazy'}
                              unoptimized
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        場景 {scene.sceneNumber}
                      </p>
                      {scene.videoMode === 'reference' ? (
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded">
                          Ref→影片
                        </span>
                      ) : scene.requiresEndFrame && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          首尾幀
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <div className="container mx-auto px-4 pb-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-5">
          <Link
            href={`/project/${projectId}/storyboard`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            上一步：分鏡腳本
          </Link>

          {progress.hasImages ? (
            <Link
              href={`/project/${projectId}/videos`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              下一步：生成影片
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-slate-200 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed"
              title="請先生成至少一個場景圖片"
            >
              下一步：生成影片
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Preview Player */}
      {showPreview && (
        <QuickPreviewPlayer
          scenes={scenes}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
