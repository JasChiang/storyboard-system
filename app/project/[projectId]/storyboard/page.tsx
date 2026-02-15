'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { StoryPromptInput } from '@/components/storyboard/StoryPromptInput';
import { StoryboardTable } from '@/components/storyboard/StoryboardTable';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { Scene, Storyboard, StoryboardGenerationResponse, ProjectReference } from '@/lib/types/storyboard';
import { DEFAULT_STYLE_PROFILE_ID } from '@/lib/constants/style-profiles';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoryboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [generationNotice, setGenerationNotice] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  const handleGenerate = async (
    prompt: string,
    templateId: string,
    references: ProjectReference[],
    targetDurationSec: number
  ) => {
    setIsGenerating(true);
    setGenerationNotice(null);

    try {
      console.log('發送請求到:', '/api/openrouter/generate-storyboard');
      console.log('請求參數:', {
        prompt: prompt.substring(0, 50) + '...',
        templateId,
        refsCount: references.length,
        targetDurationSec
      });

      const response = await fetch('/api/openrouter/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt, templateId, references, targetDurationSec }),
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

  const handleUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map((scene) =>
      scene.id === sceneId
        ? {
          ...scene,
          ...updates,
          generatedEndFrame: updates.requiresEndFrame === false ? undefined : scene.generatedEndFrame,
          endFrameDescription: updates.requiresEndFrame === false
            ? ''
            : (updates.endFrameDescription ?? scene.endFrameDescription),
          endFrameDelta: updates.requiresEndFrame === false
            ? ''
            : (updates.endFrameDelta ?? scene.endFrameDelta),
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

  const handleDeleteScene = (sceneId: string) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.filter(
      (scene) => scene.id !== sceneId
    );

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const blockedSceneCount = currentProject?.storyboard?.scenes.filter((scene) => scene.qaStatus === 'block').length || 0;
  const warnSceneCount = currentProject?.storyboard?.scenes.filter((scene) => scene.qaStatus === 'warn').length || 0;
  const passSceneCount = currentProject?.storyboard?.scenes.filter((scene) => !scene.qaStatus || scene.qaStatus === 'pass').length || 0;
  const totalSceneCount = currentProject?.storyboard?.scenes.length || 0;

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">載入中...</p>
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

            <div />
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
                建議先把 `阻擋` 場景降到 0 再往下一步，避免後面批次流程中斷。
              </p>
              <div className="flex items-center gap-2">
                {blockedSceneCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAutoFixBlockedScenes}
                    disabled={isAutoFixing || !!regeneratingSceneId}
                  >
                    {isAutoFixing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    一鍵修復阻擋 ({blockedSceneCount})
                  </Button>
                )}
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
          <StoryPromptInput
            onGenerate={handleGenerate}
            isLoading={isGenerating}
          />

          {/* 分鏡表格 */}
          <StoryboardTable
            scenes={currentProject.storyboard?.scenes || []}
            onUpdateScene={handleUpdateScene}
            onDeleteScene={handleDeleteScene}
            onRegenerateScene={handleRegenerateScene}
            isRegeneratingSceneId={regeneratingSceneId}
          />

        </div>
      </main>
    </>
  );
}
