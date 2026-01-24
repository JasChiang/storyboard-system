'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Grid3x3, List } from 'lucide-react';
import Link from 'next/link';
import { useProjectStore } from '@/stores/project-store';
import { ImageGenerator } from '@/components/image-generation/ImageGenerator';
import { BatchImageGenerator } from '@/components/image-generation/BatchImageGenerator';
import type { Scene } from '@/lib/types/storyboard';

export default function ImagesPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'individual' | 'batch'>('individual');

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  const scenes = currentProject?.storyboard?.scenes || [];
  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  const handleImageGenerated = (sceneId: string, imageUrl: string, prompt: string) => {
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

  const handleBatchComplete = (results: Map<string, { url: string; prompt: string }>) => {
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
            className="mt-4 inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 
                     text-white rounded-lg transition-colors"
          >
            前往分鏡編輯
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/project/${projectId}`}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  分鏡圖片生成
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {currentProject.name} · {scenes.length} 個場景
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
              <button
                onClick={() => setViewMode('individual')}
                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  flex items-center gap-2
                  ${viewMode === 'individual'
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
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
                    ? 'bg-purple-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
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

      <main className="container mx-auto px-4 py-8">
        {viewMode === 'individual' ? (
          <div className="grid grid-cols-12 gap-6">
            {/* Scene List */}
            <div className="col-span-4 space-y-3">
              <h2 className="text-sm font-medium text-zinc-400 px-2">選擇場景</h2>
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                {scenes.map((scene) => (
                  <button
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`
                      w-full text-left p-4 rounded-lg border transition-all
                      ${selectedSceneId === scene.id
                        ? 'bg-purple-900/30 border-purple-500'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-zinc-300">
                        場景 {scene.sceneNumber}
                      </span>
                      {scene.generatedImage && (
                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                          已生成
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-500 line-clamp-2">
                      {scene.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Generator */}
            <div className="col-span-8">
              {selectedScene ? (
                <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-6">
                  <ImageGenerator
                    scene={selectedScene}
                    onImageGenerated={(url, prompt) =>
                      handleImageGenerated(selectedScene.id, url, prompt)
                    }
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center bg-zinc-900/50 rounded-lg border border-zinc-800">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">請從左側選擇場景</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <BatchImageGenerator
              scenes={scenes}
              onBatchComplete={handleBatchComplete}
            />

            {/* Scene Grid Preview */}
            <div className="mt-8">
              <h2 className="text-sm font-medium text-zinc-400 mb-4">場景預覽</h2>
              <div className="grid grid-cols-3 gap-4">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 space-y-2"
                  >
                    <div className="aspect-video bg-zinc-900 rounded overflow-hidden">
                      {scene.generatedImage ? (
                        <img
                          src={scene.generatedImage.url}
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-zinc-700" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      場景 {scene.sceneNumber}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
