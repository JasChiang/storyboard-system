'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { StoryPromptInput } from '@/components/storyboard/StoryPromptInput';
import { StoryboardTable } from '@/components/storyboard/StoryboardTable';
import { PacingTimeline } from '@/components/storyboard/PacingTimeline';
import { HookVariantPanel } from '@/components/storyboard/HookVariantPanel';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { Scene, Storyboard, StoryboardGenerationResponse, ProjectReference, CreativeReview, HookVariant } from '@/lib/types/storyboard';
import { DEFAULT_STYLE_PROFILE_ID } from '@/lib/constants/style-profiles';
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Zap, Undo2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoryboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, isCurrentProjectLoading, setCurrentProject, updateProject } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [creativeReview, setCreativeReview] = useState<CreativeReview | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [hookVariants, setHookVariants] = useState<HookVariant[]>([]);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [deletedSceneStack, setDeletedSceneStack] = useState<{ scene: Scene; index: number }[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(false);
  const promptCollapsedInitRef = useRef(false);

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  // 有分鏡腳本時自動收合 StoryPromptInput（只在第一次載入時觸發）
  useEffect(() => {
    if (promptCollapsedInitRef.current) return;
    if (currentProject?.storyboard?.scenes?.length) {
      setIsPromptCollapsed(true);
      promptCollapsedInitRef.current = true;
    }
  }, [currentProject]);

  const handleGenerate = async (
    prompt: string,
    templateId: string,
    references: ProjectReference[],
    targetDurationSec: number,
    targetSceneCount?: number
  ) => {
    setIsGenerating(true);
    setGenerationNotice(null);

    try {
      console.log('發送請求到:', '/api/openrouter/generate-storyboard');
      console.log('請求參數:', {
        prompt: prompt.substring(0, 50) + '...',
        templateId,
        refsCount: references.length,
        targetDurationSec,
        targetSceneCount,
      });

      const response = await fetch('/api/openrouter/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: prompt,
          templateId,
          references,
          targetDurationSec,
          targetSceneCount,
        }),
      });

      if (!response.ok) {
        let errorMessage = '生成失敗';
        try {
          const error = await response.json();
          errorMessage = error.details || error.error || '生成失敗';
        } catch {
          // 如果回應不是 JSON，嘗試讀取純文字
          const text = await response.text();
          errorMessage = text || `請求失敗 (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const data: StoryboardGenerationResponse = result.data;

      // 轉換為 Scene 格式並生成 ID
      const rawScenes: Scene[] = data.scenes.map((scene, index) => ({
        ...scene,
        id: `scene-${Date.now()}-${index}`,
      }));

      // 建立 Storyboard（包含參考圖）
      const storyboard: Storyboard = {
        id: `storyboard-${Date.now()}`,
        projectId,
        title: data.title,
        originalPrompt: prompt,
        templateUsed: result.templateUsed,
        scenes: rawScenes,
        projectReferences: references.length > 0 ? references : undefined,
        selectedStyleProfileId: DEFAULT_STYLE_PROFILE_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // QA Gate：先驗證再寫入，避免後續圖片/影片流程吃到不穩定腳本
      const qaResponse = await fetch('/api/workflow/qa/validate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, storyboard }),
      });
      const qaJson = qaResponse.ok ? await qaResponse.json() : null;
      const qaReport = qaJson?.data;
      const highIssues = Array.isArray(qaReport?.issues)
        ? qaReport.issues.filter((i: { severity: string }) => i.severity === 'high')
        : [];
      const scenes = applyQaStatusToScenes(rawScenes, qaReport?.issues);
      storyboard.scenes = scenes;

      // 更新專案
      updateProject(projectId, {
        storyboard,
        targetDurationSec,
        status: 'storyboard',
      });

      if (highIssues.length > 0) {
        setGenerationNotice({
          type: 'warning',
          message: `已生成 ${scenes.length} 個場景，但 QA 發現 ${highIssues.length} 個高風險問題，建議先在分鏡表修正再往下生成。`,
        });
      } else {
        setGenerationNotice({
          type: 'success',
          message: `成功生成 ${scenes.length} 個場景的分鏡腳本。`,
        });
      }
    } catch (error) {
      console.error('生成錯誤:', error);
      setGenerationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '生成失敗，請檢查服務設定與網路連線',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyQaStatusToScenes = (
    scenes: Scene[],
    issues: Array<{ sceneId?: string; sceneNumber?: number; severity: 'high' | 'medium' | 'low'; message: string }> = []
  ): Scene[] => {
    return scenes.map((scene) => {
      const sceneIssues = issues.filter((i) => i.sceneId === scene.id || i.sceneNumber === scene.sceneNumber);
      const hasHigh = sceneIssues.some((i) => i.severity === 'high');
      const hasMedium = sceneIssues.some((i) => i.severity === 'medium');
      return {
        ...scene,
        qaStatus: hasHigh ? 'block' : hasMedium ? 'warn' : 'pass',
        qaIssues: sceneIssues.map((i) => i.message),
      };
    });
  };

  const handleRegenerateScene = async (sceneId: string) => {
    if (!currentProject?.storyboard) return;
    const targetScene = currentProject.storyboard.scenes.find((s) => s.id === sceneId);
    if (!targetScene) return;

    setRegeneratingSceneId(sceneId);
    try {
      const response = await fetch('/api/openrouter/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: currentProject.storyboard.originalPrompt,
          templateId: currentProject.storyboard.templateUsed,
          references: currentProject.storyboard.projectReferences || [],
          sceneNumber: targetScene.sceneNumber,
          scene: targetScene,
          scenesContext: currentProject.storyboard.scenes.map((s) => ({
            sceneNumber: s.sceneNumber,
            description: s.description,
            cameraMovement: s.cameraMovement,
            dialogue: s.dialogue,
            duration: s.duration,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || '重生場景失敗');
      }

      const payload = await response.json();
      const regenerated = payload?.data?.scene as Partial<Scene> | undefined;
      if (!regenerated) throw new Error('重生結果缺少 scene');

      const mergedScenes = currentProject.storyboard.scenes.map((scene) =>
        scene.id === sceneId
          ? {
            ...scene,
            ...regenerated,
            id: scene.id,
            sceneNumber: scene.sceneNumber,
            generatedImage: undefined,
            generatedEndFrame: undefined,
            generatedVideo: undefined,
            generatedVoiceover: undefined,
            motionPrompt: undefined,
            videoPromptDraft: undefined,
            videoPromptDraftNotes: undefined,
          }
          : scene
      );

      const qaResponse = await fetch('/api/workflow/qa/validate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          storyboard: {
            ...currentProject.storyboard,
            scenes: mergedScenes,
          },
        }),
      });
      const qaJson = qaResponse.ok ? await qaResponse.json() : null;
      const qaIssues = qaJson?.data?.issues || [];
      const scenesWithQa = applyQaStatusToScenes(mergedScenes, qaIssues);

      updateProject(projectId, {
        storyboard: {
          ...currentProject.storyboard,
          scenes: scenesWithQa,
          updatedAt: new Date().toISOString(),
        },
      });
      setGenerationNotice({
        type: 'success',
        message: `已重生場景 ${targetScene.sceneNumber}，並重新套用 QA。`,
      });
    } catch (error) {
      setGenerationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '重生場景失敗',
      });
    } finally {
      setRegeneratingSceneId(null);
    }
  };

  const handleAutoFixBlockedScenes = async () => {
    if (!currentProject?.storyboard) return;

    setIsAutoFixing(true);
    setGenerationNotice(null);

    try {
      const response = await fetch('/api/workflow/qa/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          storyboard: currentProject.storyboard,
        }),
      });
      const payload = await response.json().catch(() => null) as {
        data?: {
          storyboard?: Storyboard;
          blockedBefore?: number;
          blockedAfter?: number;
          fixedSceneIds?: string[];
          skippedSceneIds?: string[];
        };
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || '自動修復失敗');
      }

      const updatedStoryboard = payload?.data?.storyboard;
      if (!updatedStoryboard) {
        throw new Error('自動修復回傳缺少 storyboard');
      }

      updateProject(projectId, {
        storyboard: updatedStoryboard,
        status: 'storyboard',
      });

      const blockedBefore = Number(payload?.data?.blockedBefore || 0);
      const blockedAfter = Number(payload?.data?.blockedAfter || 0);
      const fixedCount = Number(payload?.data?.fixedSceneIds?.length || 0);
      const skippedCount = Number(payload?.data?.skippedSceneIds?.length || 0);

      if (blockedBefore === 0) {
        setGenerationNotice({
          type: 'success',
          message: '目前沒有被 QA 阻擋的場景。',
        });
      } else if (blockedAfter === 0) {
        setGenerationNotice({
          type: 'success',
          message: `自動修復完成：已處理 ${fixedCount} 個場景，所有阻擋問題已解除。`,
        });
      } else {
        setGenerationNotice({
          type: 'warning',
          message: `已嘗試修復 ${fixedCount} 個場景（略過 ${skippedCount} 個），仍有 ${blockedAfter} 個高風險問題需手動調整。`,
        });
      }
    } catch (error) {
      setGenerationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : '自動修復失敗',
      });
    } finally {
      setIsAutoFixing(false);
    }
  };

  const handleAnalyzeCreativity = async () => {
    if (!currentProject?.storyboard?.scenes?.length) return;
    setIsReviewing(true);
    try {
      const response = await fetch('/api/openrouter/creative-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes: currentProject.storyboard.scenes }),
      });
      if (!response.ok) throw new Error('分析失敗');
      const payload = await response.json();
      const review: CreativeReview = payload.data;
      setCreativeReview(review);

      // Merge hookScore into scenes
      const updatedScenes = currentProject.storyboard.scenes.map((scene) => {
        const sr = review.sceneReviews.find(r => r.sceneNumber === scene.sceneNumber);
        if (!sr) return scene;
        return {
          ...scene,
          hookScore: sr.hookScore as Scene['hookScore'],
          hookScoreReason: sr.hookScoreReason,
          retentionRisk: sr.retentionRisk,
        };
      });
      updateProject(projectId, {
        storyboard: { ...currentProject.storyboard, scenes: updatedScenes, updatedAt: new Date().toISOString() },
      });
      setGenerationNotice({ type: 'success', message: '廣告效果分析完成，已更新 Hook 評分。' });
    } catch (error) {
      setGenerationNotice({ type: 'error', message: error instanceof Error ? error.message : '分析失敗' });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleGenerateHookVariants = async () => {
    if (!currentProject?.storyboard?.scenes?.length) return;
    setIsGeneratingHooks(true);
    try {
      const scene1 = currentProject.storyboard.scenes[0];
      const response = await fetch('/api/openrouter/hook-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: currentProject.storyboard.originalPrompt,
          references: '',
          existingScene1: scene1,
        }),
      });
      if (!response.ok) throw new Error('生成 Hook 變體失敗');
      const payload = await response.json();
      setHookVariants(payload.data?.variants || []);
    } catch (error) {
      setGenerationNotice({ type: 'error', message: error instanceof Error ? error.message : '生成 Hook 變體失敗' });
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleApplyHookVariant = (variant: HookVariant) => {
    if (!currentProject?.storyboard) return;
    const scene1 = currentProject.storyboard.scenes[0];
    if (!scene1) return;
    const updatedScenes = currentProject.storyboard.scenes.map((s) =>
      s.id === scene1.id
        ? {
          ...s,
          ...variant.scene,
          id: s.id,
          sceneNumber: s.sceneNumber,
          generatedImage: undefined,
          generatedEndFrame: undefined,
          generatedVideo: undefined,
          generatedVoiceover: undefined,
          motionPrompt: undefined,
        }
        : s
    );
    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: updatedScenes, updatedAt: new Date().toISOString() },
    });
    setHookVariants([]);
    setGenerationNotice({ type: 'success', message: `已套用「${variant.variantLabel}」Hook 開場。` });
  };

  const sceneNeedsRegeneration = (previous: Scene, next: Scene): boolean => {
    const isChanged = (a: unknown, b: unknown) => JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
    return (
      isChanged(previous.description, next.description)
      || isChanged(previous.cameraMovement, next.cameraMovement)
      || isChanged(previous.dialogue, next.dialogue)
      || isChanged(previous.duration, next.duration)
      || isChanged(previous.requiresEndFrame, next.requiresEndFrame)
      || isChanged(previous.endFrameDescription, next.endFrameDescription)
      || isChanged(previous.endFrameDelta, next.endFrameDelta)
      || isChanged(previous.endFrameDeltaSpec, next.endFrameDeltaSpec)
      || isChanged(previous.transitionToNext, next.transitionToNext)
      || isChanged(previous.requiredReferences, next.requiredReferences)
      || isChanged(previous.charactersUsed, next.charactersUsed)
      || isChanged(previous.productsUsed, next.productsUsed)
      || isChanged(previous.sceneIntent, next.sceneIntent)
      || isChanged(previous.startComposition, next.startComposition)
      || isChanged(previous.subjectMotion, next.subjectMotion)
      || isChanged(previous.continuityLock, next.continuityLock)
      || isChanged(previous.beatGoal, next.beatGoal)
      || isChanged(previous.shotIntent, next.shotIntent)
      || isChanged(previous.continuityAnchor, next.continuityAnchor)
      || isChanged(previous.changeFromPrev, next.changeFromPrev)
    );
  };

  const clearSceneGeneratedAssets = (scene: Scene): Scene => ({
    ...scene,
    generatedImage: undefined,
    generatedEndFrame: undefined,
    generatedVideo: undefined,
    generatedVoiceover: undefined,
    motionPrompt: undefined,
    videoPromptDraft: undefined,
    videoPromptDraftNotes: undefined,
  });

  const createBlankScene = (sceneNumber: number): Scene => ({
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sceneNumber,
    description: '',
    cameraMovement: 'Static shot',
    sceneIntent: '',
    startComposition: '',
    subjectMotion: '',
    continuityLock: '',
    dialogue: '',
    duration: 5,
    beatGoal: '',
    shotIntent: '',
    continuityAnchor: '',
    requiredReferences: [],
    charactersUsed: [],
    productsUsed: [],
    changeFromPrev: sceneNumber === 1 ? 'N/A' : '',
    requiresEndFrame: false,
    endFrameDescription: '',
    endFrameDelta: '',
    transitionToNext: {
      type: 'dissolve',
      reason: '手動新增場景，預設溶解轉場。',
      duration: 0.5,
      useEndFrameAsNextStart: false,
      continuitySourceMode: 'none',
    },
    qaStatus: 'warn',
    qaIssues: ['新場景尚未完善，請補齊描述、運鏡與結構欄位。'],
  });

  const insertSceneAt = (insertAtIndex: number) => {
    if (!currentProject?.storyboard) return;

    const scenes = currentProject.storyboard.scenes;
    const safeIndex = Math.max(0, Math.min(insertAtIndex, scenes.length));
    const newScene = createBlankScene(safeIndex + 1);
    const updatedScenes = [
      ...scenes.slice(0, safeIndex),
      newScene,
      ...scenes.slice(safeIndex),
    ].map((scene, index) => ({
      ...scene,
      sceneNumber: index + 1,
      changeFromPrev: index === 0 ? 'N/A' : (scene.changeFromPrev || ''),
    }));

    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: updatedScenes, updatedAt: new Date().toISOString() },
    });
    setGenerationNotice({
      type: 'warning',
      message: `已新增場景 ${safeIndex + 1}，請補齊描述與指示後再生成素材。`,
    });
  };

  const handleDuplicateScene = (sceneId: string) => {
    if (!currentProject?.storyboard) return;
    const scenes = currentProject.storyboard.scenes;
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) return;
    const original = scenes[idx];
    const clone: Scene = clearSceneGeneratedAssets({
      ...original,
      id: `scene-${Date.now()}-clone`,
    });
    const newScenes = [...scenes.slice(0, idx + 1), clone, ...scenes.slice(idx + 1)].map((s, i) => ({
      ...s,
      sceneNumber: i + 1,
    }));
    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: newScenes, updatedAt: new Date().toISOString() },
    });
    setGenerationNotice({
      type: 'warning',
      message: `已複製場景 ${original.sceneNumber}，新場景需重新生成圖片/影片。`,
    });
  };

  const handleInsertSceneAfter = (sceneId: string) => {
    if (!currentProject?.storyboard) return;
    const idx = currentProject.storyboard.scenes.findIndex((scene) => scene.id === sceneId);
    if (idx === -1) return;
    insertSceneAt(idx + 1);
  };

  const handleAppendScene = () => {
    if (!currentProject?.storyboard) return;
    insertSceneAt(currentProject.storyboard.scenes.length);
  };

  const handleReorderScenes = (orderedIds: string[]) => {
    if (!currentProject?.storyboard) return;
    const sceneMap = new Map(currentProject.storyboard.scenes.map(s => [s.id, s]));
    const reordered = orderedIds
      .map((id, i) => {
        const scene = sceneMap.get(id);
        if (!scene) return null;
        return { ...scene, sceneNumber: i + 1 };
      })
      .filter((s): s is Scene => s !== null);
    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: reordered, updatedAt: new Date().toISOString() },
    });
  };

  const handleResetScene = (sceneId: string) => {
    if (!currentProject?.storyboard) return;
    const updatedScenes = currentProject.storyboard.scenes.map(s =>
      s.id === sceneId
        ? {
          ...s,
          generatedImage: undefined,
          generatedEndFrame: undefined,
          generatedVideo: undefined,
          generatedVoiceover: undefined,
          motionPrompt: undefined,
          videoPromptDraft: undefined,
          videoPromptDraftNotes: undefined,
        }
        : s
    );
    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: updatedScenes, updatedAt: new Date().toISOString() },
    });
  };

  const handleUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
    if (!currentProject?.storyboard) return;
    let invalidatedSceneNumber: number | null = null;

    const updatedScenes = currentProject.storyboard.scenes.map((scene) =>
      scene.id === sceneId
        ? (() => {
          const mergedScene: Scene = {
          ...scene,
          ...updates,
          generatedEndFrame: updates.requiresEndFrame === false ? undefined : scene.generatedEndFrame,
          endFrameDescription: updates.requiresEndFrame === false
            ? ''
            : (updates.endFrameDescription ?? scene.endFrameDescription),
          endFrameDelta: updates.requiresEndFrame === false
            ? ''
            : (updates.endFrameDelta ?? scene.endFrameDelta),
          };

          if (!sceneNeedsRegeneration(scene, mergedScene)) {
            return mergedScene;
          }

          invalidatedSceneNumber = scene.sceneNumber;
          return clearSceneGeneratedAssets(mergedScene);
        })()
        : scene
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
    });

    if (invalidatedSceneNumber !== null) {
      setGenerationNotice({
        type: 'warning',
        message: `已更新場景 ${invalidatedSceneNumber}，舊圖片/影片已清除，請重新生成。`,
      });
    }
  };

  const handleDeleteScene = (sceneId: string) => {
    if (!currentProject?.storyboard) return;

    const scenes = currentProject.storyboard.scenes;
    const idx = scenes.findIndex(s => s.id === sceneId);
    if (idx === -1) return;

    const deletedScene = scenes[idx];
    const updatedScenes = scenes.filter(s => s.id !== sceneId).map((s, i) => ({ ...s, sceneNumber: i + 1 }));

    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: updatedScenes, updatedAt: new Date().toISOString() },
    });

    // Push to undo stack
    setDeletedSceneStack(prev => [...prev, { scene: deletedScene, index: idx }]);
    setGenerationNotice({ type: 'warning', message: `已刪除場景 ${deletedScene.sceneNumber}` });

    // Auto-clear after 5s
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setDeletedSceneStack([]);
      setGenerationNotice(null);
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!currentProject?.storyboard || deletedSceneStack.length === 0) return;
    const last = deletedSceneStack[deletedSceneStack.length - 1];
    const scenes = currentProject.storyboard.scenes;
    const restored = [...scenes.slice(0, last.index), last.scene, ...scenes.slice(last.index)].map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    updateProject(projectId, {
      storyboard: { ...currentProject.storyboard, scenes: restored, updatedAt: new Date().toISOString() },
    });
    setDeletedSceneStack(prev => prev.slice(0, -1));
    setGenerationNotice(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const blockedSceneCount = currentProject?.storyboard?.scenes.filter((scene) => scene.qaStatus === 'block').length || 0;
  const warnSceneCount = currentProject?.storyboard?.scenes.filter((scene) => scene.qaStatus === 'warn').length || 0;
  const passSceneCount = currentProject?.storyboard?.scenes.filter((scene) => !scene.qaStatus || scene.qaStatus === 'pass').length || 0;
  const totalSceneCount = currentProject?.storyboard?.scenes.length || 0;

  if (isCurrentProjectLoading && !currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">載入中...</p>
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

  return (
    <>
      <header className="app-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/project/${projectId}`}>
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
              </Link>
              <div>
                <p className="text-kicker">Storyboard</p>
                <h1 className="text-2xl font-semibold">{currentProject.name}</h1>
                <p className="text-sm text-muted-foreground">分鏡腳本編輯</p>
              </div>
            </div>

          </div>
        </div>
      </header>

      <ProjectStepNavigator
        projectId={projectId}
        project={currentProject}
        currentStep="storyboard"
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {generationNotice && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                generationNotice.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300'
                  : generationNotice.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'
                    : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p>{generationNotice.message}</p>
                <button
                  type="button"
                  onClick={() => setGenerationNotice(null)}
                  className="text-xs opacity-70 hover:opacity-100"
                >
                  關閉
                </button>
              </div>
            </div>
          )}

          <div className="surface-soft p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-inset p-3">
                <p className="text-kicker">Scenes</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{totalSceneCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">目前分鏡場景總數</p>
              </div>
              <div className="surface-inset p-3">
                <p className="text-kicker">QA Pass</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{passSceneCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">可直接進入圖片生成</p>
              </div>
              <div className="surface-inset p-3">
                <p className="text-kicker">Need Fix</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{blockedSceneCount + warnSceneCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">阻擋 + 警告場景數</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                建議先把 <strong>阻擋</strong> 場景降到 0 再往下一步，避免後面批次流程中斷。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {/* 暫時操作（undo / 修復） */}
                {deletedSceneStack.length > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={handleUndoDelete}>
                    <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                    還原刪除
                  </Button>
                )}
                {blockedSceneCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoFixBlockedScenes}
                    disabled={isAutoFixing || !!regeneratingSceneId}
                  >
                    {isAutoFixing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    一鍵修復阻擋 ({blockedSceneCount})
                  </Button>
                )}

                {/* AI 工具分組 */}
                {totalSceneCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground/60 select-none">AI</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAnalyzeCreativity}
                      disabled={isReviewing}
                    >
                      {isReviewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      分析廣告效果
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateHookVariants}
                      disabled={isGeneratingHooks}
                    >
                      {isGeneratingHooks ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5" />}
                      生成 Hook 變體
                    </Button>
                  </div>
                )}

                {/* 主流程 */}
                <Link href={`/project/${projectId}/images`}>
                  <Button size="sm" disabled={totalSceneCount === 0}>
                    下一步：生成分鏡圖片
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* 故事輸入 */}
          <div className="surface-soft overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPromptCollapsed(prev => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {totalSceneCount > 0 ? '重新生成分鏡腳本' : '生成分鏡腳本'}
                </span>
                {totalSceneCount > 0 && (
                  <span className="text-xs text-muted-foreground">（會覆蓋現有場景）</span>
                )}
              </div>
              {isPromptCollapsed
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronUp className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            {!isPromptCollapsed && (
              <div className="border-t border-border/40">
                <StoryPromptInput
                  onGenerate={async (...args) => {
                    await handleGenerate(...args);
                    setIsPromptCollapsed(true);
                  }}
                  isLoading={isGenerating}
                  initialTargetDurationSec={currentProject?.targetDurationSec}
                  initialPrompt={currentProject?.storyboard?.originalPrompt}
                />
              </div>
            )}
          </div>

          {/* 節奏時間軸 */}
          {totalSceneCount > 0 && (
            <PacingTimeline
              scenes={currentProject.storyboard?.scenes || []}
              onSceneClick={(sceneId) => {
                const el = document.getElementById(`scene-row-${sceneId}`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          )}

          {/* Hook 變體面板 */}
          {(hookVariants.length > 0 || isGeneratingHooks) && (
            <HookVariantPanel
              variants={hookVariants}
              onApply={handleApplyHookVariant}
              isLoading={isGeneratingHooks}
            />
          )}

          {/* 創意評估摘要 */}
          {creativeReview && (
            <div className="surface-soft rounded-xl p-4 text-sm">
              <p className="text-kicker mb-2">Creative Review</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><span className="font-medium text-foreground">情感弧線：</span><span className="text-muted-foreground">{creativeReview.emotionalArc}</span></div>
                <div><span className="font-medium text-foreground">節奏評估：</span><span className="text-muted-foreground">{creativeReview.pacing}</span></div>
                <div><span className="font-medium text-foreground">最強場景：</span><span className="text-muted-foreground">#{creativeReview.strongestScene}</span></div>
                <div><span className="font-medium text-foreground">最弱場景：</span><span className="text-muted-foreground">#{creativeReview.weakestScene}</span></div>
              </div>
            </div>
          )}

          {/* 分鏡表格 */}
          <StoryboardTable
            scenes={currentProject.storyboard?.scenes || []}
            onUpdateScene={handleUpdateScene}
            onDeleteScene={handleDeleteScene}
            onRegenerateScene={handleRegenerateScene}
            onDuplicateScene={handleDuplicateScene}
            onInsertSceneAfter={handleInsertSceneAfter}
            onAppendScene={handleAppendScene}
            onResetScene={handleResetScene}
            onReorderScenes={handleReorderScenes}
            isRegeneratingSceneId={regeneratingSceneId}
          />

        </div>
      </main>
    </>
  );
}
