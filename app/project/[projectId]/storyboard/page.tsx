'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { apiKeyStorage } from '@/lib/db/local-storage';
import { StoryPromptInput } from '@/components/storyboard/StoryPromptInput';
import { StoryboardTable } from '@/components/storyboard/StoryboardTable';
import { Scene, Storyboard, StoryboardGenerationResponse } from '@/lib/types/storyboard';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoryboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  useEffect(() => {
    setCurrentProject(projectId);

    // 載入 API 金鑰
    const keys = apiKeyStorage.getAll();
    if (keys.openrouter) {
      setApiKey(keys.openrouter);
    } else {
      setShowApiKeyInput(true);
    }
  }, [projectId, setCurrentProject]);

  const handleGenerate = async (prompt: string, templateId: string) => {
    if (!apiKey) {
      alert('請先設定 OpenRouter API 金鑰');
      setShowApiKeyInput(true);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch('/api/openrouter/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: prompt, templateId, apiKey }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || '生成失敗');
      }

      const result = await response.json();
      const data: StoryboardGenerationResponse = result.data;

      // 轉換為 Scene 格式並生成 ID
      const scenes: Scene[] = data.scenes.map((scene, index) => ({
        ...scene,
        id: `scene-${Date.now()}-${index}`,
      }));

      // 建立 Storyboard
      const storyboard: Storyboard = {
        id: `storyboard-${Date.now()}`,
        projectId,
        title: data.title,
        originalPrompt: prompt,
        templateUsed: result.templateUsed,
        scenes,
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
      alert(error instanceof Error ? error.message : '生成失敗，請檢查 API 金鑰和網路連線');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
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

  const handleSaveApiKey = () => {
    apiKeyStorage.set({ openrouter: apiKey });
    setShowApiKeyInput(false);
    alert('API 金鑰已保存');
  };

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-slate-600 dark:text-slate-400">載入中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            >
              <Settings className="w-4 h-4 mr-2" />
              API 設定
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* API 金鑰設定 */}
          {showApiKeyInput && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <h3 className="font-semibold mb-3">OpenRouter API 金鑰設定</h3>
              <div className="flex gap-3">
                <input
                  type="password"
                  className="flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-slate-800"
                  placeholder="sk-or-v1-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button onClick={handleSaveApiKey}>
                  保存
                </Button>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                金鑰將保存在瀏覽器本地，不會上傳到伺服器
              </p>
            </div>
          )}

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
    </div>
  );
}
