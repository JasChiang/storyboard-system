'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Film, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useProjectStore } from '@/stores/project-store';
import { VideoGenerator } from '@/components/video-generation/VideoGenerator';

type VideoModel = 'kling' | 'seedance';

export default function VideosPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  const scenes = currentProject?.storyboard?.scenes || [];
  const selectedScene = scenes.find(s => s.id === selectedSceneId);

  // 統計資訊
  const scenesWithImages = scenes.filter(s => s.generatedImage);
  const scenesWithVideos = scenes.filter(s => s.generatedVideo);

  const handleVideoGenerated = (
    sceneId: string,
    videoUrl: string,
    prompt: string,
    model: VideoModel
  ) => {
    if (!currentProject?.storyboard) return;

    const updatedScenes = currentProject.storyboard.scenes.map(scene =>
      scene.id === sceneId
        ? {
          ...scene,
          generatedVideo: {
            url: videoUrl,
            model,
            prompt,
            timestamp: new Date().toISOString(),
          },
          motionPrompt: prompt,
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
                  <Film className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Scene List */}
          <div className="col-span-4 space-y-3">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 px-2">選擇場景</h2>
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              {scenes.map((scene) => {
                const hasImage = !!scene.generatedImage;
                const hasVideo = !!scene.generatedVideo;

                return (
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
                      <div className="flex items-center gap-1">
                        {hasImage && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400"
                            title="已生成圖片" />
                        )}
                        {hasVideo && (
                          <div title="已生成影片">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                      {scene.description}
                    </p>

                    {/* 預覽縮圖 */}
                    {scene.generatedImage && (
                      <div className="space-y-1.5">
                        <div className="aspect-video rounded overflow-hidden border border-slate-200 dark:border-slate-700">
                          <img
                            src={scene.generatedImage.url}
                            alt={`Scene ${scene.sceneNumber}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {scene.generatedEndFrame && (
                          <>
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                              <span className="inline-block w-1 h-1 bg-purple-600 dark:bg-purple-400 rounded-full"></span>
                              尾幀
                            </p>
                            <div className="aspect-video rounded overflow-hidden border border-purple-200 dark:border-purple-700">
                              <img
                                src={scene.generatedEndFrame.url}
                                alt={`Scene ${scene.sceneNumber} End Frame`}
                                className="w-full h-full object-cover"
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
          <div className="col-span-8">
            {selectedScene ? (() => {
              // 計算 previousEndFrameUrl（用於 continuation 轉場）
              const sceneIndex = scenes.findIndex(s => s.id === selectedSceneId);
              const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
              const previousEndFrameUrl = previousScene?.transitionToNext?.useEndFrameAsNextStart
                ? previousScene.generatedEndFrame?.url
                : undefined;

              return (
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-6 backdrop-blur-sm">
                  {/* Continuation 提示 */}
                  {previousEndFrameUrl && (
                    <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        🔗 <strong>Continuation 轉場</strong>：將使用場景 {previousScene?.sceneNumber} 的尾幀作為起始畫面
                      </p>
                    </div>
                  )}
                  <VideoGenerator
                    scene={selectedScene}
                    previousEndFrameUrl={previousEndFrameUrl}
                    projectReferences={currentProject.storyboard?.projectReferences}
                    onVideoGenerated={(url, prompt, model) =>
                      handleVideoGenerated(selectedScene.id, url, prompt, model)
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
    </>
  );
}
