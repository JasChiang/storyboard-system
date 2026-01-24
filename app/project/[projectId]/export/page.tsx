'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Scissors, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useProjectStore } from '@/stores/project-store';
import { VideoAnalyzer } from '@/components/export/VideoAnalyzer';
import { BlenderScriptViewer } from '@/components/export/BlenderScriptViewer';
import type { EditingSuggestion } from '@/lib/types/project';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [editingSuggestion, setEditingSuggestion] = useState<EditingSuggestion | null>(null);

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  const scenes = currentProject?.storyboard?.scenes || [];
  const scenesWithVideos = scenes.filter(s => s.generatedVideo);

  // 檢查完成度
  const hasStoryboard = !!currentProject?.storyboard;
  const hasImages = scenes.some(s => s.generatedImage);
  const hasVideos = scenesWithVideos.length > 0;

  const handleAnalysisComplete = (suggestion: EditingSuggestion) => {
    setEditingSuggestion(suggestion);

    // 保存到專案
    if (currentProject) {
      updateProject(projectId, {
        blenderScript: JSON.stringify(suggestion),
        status: 'complete',
      });
    }
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
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Scissors className="w-5 h-5 text-purple-400" />
                Blender 腳本匯出
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {currentProject.name} · AI 分析與自動剪輯
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 完成度檢查 */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-3">專案完成度</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                {hasStoryboard ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-zinc-600" />
                )}
                <span className={`text-sm ${hasStoryboard ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  分鏡腳本
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasImages ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-zinc-600" />
                )}
                <span className={`text-sm ${hasImages ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  圖片生成
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasVideos ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-zinc-600" />
                )}
                <span className={`text-sm ${hasVideos ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  影片生成 ({scenesWithVideos.length}/{scenes.length})
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* 左側：影片分析 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">步驟 1: AI 影片分析</h2>
            <VideoAnalyzer
              storyboard={currentProject.storyboard}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>

          {/* 右側：Blender 腳本 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">步驟 2: Blender 腳本</h2>
            <BlenderScriptViewer
              projectName={currentProject.name}
              scenes={scenes}
              editingSuggestion={editingSuggestion || undefined}
            />
          </div>
        </div>

        {/* 影片列表 */}
        {scenesWithVideos.length > 0 && (
          <div className="max-w-4xl mx-auto mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              已生成的影片 ({scenesWithVideos.length})
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {scenesWithVideos.map((scene) => (
                <div
                  key={scene.id}
                  className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 space-y-2"
                >
                  <video
                    src={scene.generatedVideo!.url}
                    className="w-full aspect-video rounded bg-zinc-900"
                    controls
                  />
                  <p className="text-xs text-zinc-400">場景 {scene.sceneNumber}</p>
                  <p className="text-xs text-zinc-600 truncate">
                    {scene.generatedVideo!.model === 'kling' ? 'Kling 2.6 Pro' : 'Seedance 1.5 Pro'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
