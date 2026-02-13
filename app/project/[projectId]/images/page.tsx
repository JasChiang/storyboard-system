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
  const progress = getWorkflowProgress(currentProject);
  const selectedScene = scenes.find(s => s.id === selectedSceneId);
  const selectedSceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
  const previousScene = selectedSceneIndex > 0 ? scenes[selectedSceneIndex - 1] : null;
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
          generatedEndFrame: !scene.requiresEndFrame
            ? undefined
            : endFrameUrl ? {
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
          // 如果有尾幀，也儲存尾幀資訊
          generatedEndFrame: !scene.requiresEndFrame
            ? undefined
            : result.endFrameUrl ? {
            url: result.endFrameUrl,
            prompt: result.endFramePrompt || '',
            timestamp: new Date().toISOString(),
          } : undefined,
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
        <div className="max-w-3xl mx-auto mb-6">
          <StyleProfileSelector
            selectedProfileId={selectedStyleProfileId}
            customProfiles={customStyleProfiles}
            onChange={handleStyleProfileChange}
            onCustomProfilesChange={handleCustomStyleProfilesChange}
          />
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
                    className={`
                      w-full text-left p-4 rounded-lg border transition-all
                      ${selectedSceneId === scene.id
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-1 ring-blue-200 dark:ring-blue-800'
                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        場景 {scene.sceneNumber}
                      </span>
                      {scene.generatedImage && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded">
                          已生成
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                      {scene.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Generator */}
            <div className="col-span-8">
              {selectedScene ? (
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm">
                  <ImageGenerator
                    scene={selectedScene}
                    onImageGenerated={(url, prompt, endFrameUrl, endFramePrompt) =>
                      handleImageGenerated(selectedScene.id, url, prompt, endFrameUrl, endFramePrompt)
                    }
                    projectReferences={currentProject.storyboard?.projectReferences}
                    styleProfile={activeStyleProfile}
                    previousEndFrameUrl={previousEndFrameUrl}
                  />
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
            <BatchImageGenerator
              scenes={scenes}
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
