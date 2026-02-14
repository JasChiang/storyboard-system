'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, Grid3x3, List } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useProjectStore } from '@/stores/project-store';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { ImageGenerator } from '@/components/image-generation/ImageGenerator';
import { BatchImageGenerator } from '@/components/image-generation/BatchImageGenerator';
import { StyleProfileSelector } from '@/components/image-generation/StyleProfileSelector';
import { DEFAULT_STYLE_PROFILE_ID, findStyleProfileById } from '@/lib/constants/style-profiles';
import { getWorkflowProgress } from '@/lib/project/workflow';
import type { StyleProfile } from '@/lib/types/storyboard';

export default function ImagesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'individual' | 'batch'>('individual');
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [selectedStyleProfileId, setSelectedStyleProfileId] = useState<string>(DEFAULT_STYLE_PROFILE_ID);
  const [customStyleProfiles, setCustomStyleProfiles] = useState<StyleProfile[]>([]);

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    if (!currentProject?.storyboard) return;
    setSelectedStyleProfileId(
      currentProject.storyboard.selectedStyleProfileId || DEFAULT_STYLE_PROFILE_ID
    );
    setCustomStyleProfiles(currentProject.storyboard.customStyleProfiles || []);
  }, [currentProject?.storyboard]);

  const scenes = currentProject?.storyboard?.scenes || [];
  const blockedScenes = scenes.filter((s) => s.qaStatus === 'block');
  const processableScenes = scenes.filter((s) => s.qaStatus !== 'block');
  const progress = getWorkflowProgress(currentProject);
  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  const selectedSceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
  const previousScene = selectedSceneIndex > 0 ? scenes[selectedSceneIndex - 1] : null;
  const nextScene = selectedSceneIndex >= 0 && selectedSceneIndex < scenes.length - 1
    ? scenes[selectedSceneIndex + 1]
    : null;
  const previousEndFrameUrl = previousScene?.transitionToNext?.useEndFrameAsNextStart
    ? previousScene.generatedEndFrame?.url
    : undefined;
  const activeStyleProfile = findStyleProfileById(selectedStyleProfileId, customStyleProfiles);

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

  const handleImageGenerated = (sceneId: string, imageUrl: string, prompt: string, endFrameUrl?: string, endFramePrompt?: string) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? {
          ...scene,
          generatedImage: {
            url: imageUrl,
            prompt,
            timestamp: new Date().toISOString(),
          },
          generatedEndFrame: endFrameUrl ? {
            url: endFrameUrl,
            prompt: endFramePrompt || '',
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

  const handleBatchComplete = (results: Map<string, { url: string; prompt: string; endFrameUrl?: string; endFramePrompt?: string }>) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene => {
      const result = results.get(scene.id);
      if (result) {
        return {
          ...scene,
          generatedImage: {
            url: result.url,
            prompt: result.prompt,
            timestamp: new Date().toISOString(),
          },
          // 如果有尾幀，也儲存尾幀資訊（不再依賴 requiresEndFrame）
          generatedEndFrame: result.endFrameUrl ? {
            url: result.endFrameUrl,
            prompt: result.endFramePrompt || '',
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

  if (!currentProject?.storyboard) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400">請先建立分鏡腳本</p>
          <Link
            href={`/project/${projectId}/storyboard`}
            className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 
                     text-white rounded-lg transition-colors"
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
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/50 backdrop-blur-xl dark:bg-black/50 supports-[backdrop-filter]:bg-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/project/${projectId}`}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  分鏡圖片生成
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {currentProject.name} · {scenes.length} 個場景
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('individual')}
                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  flex items-center gap-2
                  ${viewMode === 'individual'
                    ? 'bg-blue-600 text-white shadow-sm'
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
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  flex items-center gap-2
                  ${viewMode === 'batch'
                    ? 'bg-blue-600 text-white shadow-sm'
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
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Style Profile</p>
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
            <div className="col-span-4 space-y-3">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 px-2">選擇場景</h2>
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {scenes.map((scene) => (
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
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-20 h-14 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
                        {scene.generatedImage?.url ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={scene.generatedImage.url}
                              alt={`場景 ${scene.sceneNumber}`}
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            場景 {scene.sceneNumber}
                          </span>
                        {scene.generatedImage ? (
                            <span className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded">
                              已生成
                            </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 rounded">
                            未生成
                          </span>
                        )}
                        {scene.qaStatus === 'block' && (
                          <span className="text-[11px] px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 rounded">
                            QA 阻擋
                          </span>
                        )}
                      </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                          {scene.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        風格：{activeStyleProfile?.name || '預設'}
                      </span>
                      {scene.generatedEndFrame && (
                        <span className="text-[11px] px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          有尾幀
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Generator */}
            <div className="col-span-8">
              {selectedScene ? (
                <div className="space-y-4">
                  {selectedScene.qaStatus === 'block' && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      此場景被 QA 阻擋，請先回「分鏡腳本」修正或使用單場景重生，再生成圖片。
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-4 backdrop-blur-sm">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">目前預覽</p>
                      <div className="aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                        {selectedScene.generatedImage?.url ? (
                          <div className="relative w-full h-full">
                            <Image
                              src={selectedScene.generatedImage.url}
                              alt={`Scene ${selectedScene.sceneNumber}`}
                              fill
                              sizes="(max-width: 1024px) 50vw, 480px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-sm text-slate-500 dark:text-slate-400">尚未生成圖片</span>
                          </div>
                        )}
                      </div>
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

                  {selectedScene.qaStatus !== 'block' && (
                    <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm">
                      <ImageGenerator
                        key={selectedScene.id}
                        projectId={projectId}
                        scene={selectedScene}
                        onImageGenerated={(url, prompt, endFrameUrl, endFramePrompt) =>
                          handleImageGenerated(selectedScene.id, url, prompt, endFrameUrl, endFramePrompt)
                        }
                        onEndFrameDescriptionChanged={(description, enabled) =>
                          handleEndFrameDescriptionChanged(selectedScene.id, description, enabled)
                        }
                        projectReferences={currentProject.storyboard?.projectReferences}
                        styleProfile={activeStyleProfile}
                        previousEndFrameUrl={previousEndFrameUrl}
                        previousSceneDescription={previousScene?.description}
                        nextSceneDescription={nextScene?.description}
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
              scenes={processableScenes}
              projectReferences={currentProject.storyboard?.projectReferences}
              styleProfile={activeStyleProfile}
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
                      {scene.generatedImage ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={scene.generatedImage.url}
                            alt={`Scene ${scene.sceneNumber}`}
                            fill
                            sizes="(max-width: 1024px) 33vw, 240px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-slate-300 dark:text-slate-700" />
                        </div>
                      )}
                    </div>

                    {/* 尾幀（如果存在） */}
                    {scene.generatedEndFrame && (
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
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        場景 {scene.sceneNumber}
                      </p>
                      {scene.requiresEndFrame && (
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
    </>
  );
}
