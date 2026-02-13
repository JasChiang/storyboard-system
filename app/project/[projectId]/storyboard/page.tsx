'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { StoryPromptInput } from '@/components/storyboard/StoryPromptInput';
import { StoryboardTable } from '@/components/storyboard/StoryboardTable';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { Scene, Storyboard, StoryboardGenerationResponse, ProjectReference } from '@/lib/types/storyboard';
import { DEFAULT_STYLE_PROFILE_ID } from '@/lib/constants/style-profiles';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoryboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);

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
      const scenes: Scene[] = data.scenes.map((scene, index) => ({
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
        scenes,
        projectReferences: references.length > 0 ? references : undefined,
        selectedStyleProfileId: DEFAULT_STYLE_PROFILE_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 更新專案
      updateProject(projectId, {
        storyboard,
        status: 'storyboard',
      });

      alert(`成功生成 ${scenes.length} 個場景的分鏡腳本！`);
    } catch (error) {
      console.error('生成錯誤:', error);
      alert(error instanceof Error ? error.message : '生成失敗，請檢查服務設定與網路連線');
    } finally {
      setIsGenerating(false);
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

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">載入中...</p>
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/50 backdrop-blur-xl dark:bg-black/50 supports-[backdrop-filter]:bg-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/project/${projectId}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{currentProject.name}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">分鏡腳本編輯</p>
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
          />

          {/* 下一步按鈕 */}
          {currentProject.storyboard && currentProject.storyboard.scenes.length > 0 && (
            <div className="flex justify-end">
              <Link href={`/project/${projectId}/images`}>
                <Button size="lg">
                  下一步：生成分鏡圖片
                </Button>
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
