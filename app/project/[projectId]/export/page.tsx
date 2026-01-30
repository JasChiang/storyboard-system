'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Scissors, CheckCircle2, XCircle, Zap, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useProjectStore } from '@/stores/project-store';
import { VideoAnalyzer } from '@/components/export/VideoAnalyzer';
import { BlenderScriptViewer } from '@/components/export/BlenderScriptViewer';
import { FFmpegRenderer } from '@/components/export/FFmpegRenderer';
import { OpenReelEditor } from '@/components/export/OpenReelEditor';
import type { EditingSuggestion } from '@/lib/types/project';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [editingSuggestion, setEditingSuggestion] = useState<EditingSuggestion | null>(null);
  const [renderMode, setRenderMode] = useState<'openreel' | 'ffmpeg' | 'blender'>('openreel');

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
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scissors className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                视频导出
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {currentProject.name} · {renderMode === 'openreel' ? 'OpenReel 線上編輯' : renderMode === 'ffmpeg' ? 'FFmpeg 快速渲染' : 'Blender 专业导出'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* 渲染模式选择 */}
        <div className="max-w-4xl mx-auto mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            选择渲染方式
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setRenderMode('openreel')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                renderMode === 'openreel'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white/50 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  renderMode === 'openreel' ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  <Wand2 className={`w-6 h-6 ${
                    renderMode === 'openreel' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    OpenReel 線上編輯
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">推荐</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                完整線上剪輯器，支援多軌時間軸、轉場與字幕。
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                可保存專案並直接匯出
              </div>
            </button>

            <button
              onClick={() => setRenderMode('ffmpeg')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                renderMode === 'ffmpeg'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white/50 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  renderMode === 'ffmpeg' ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  <Zap className={`w-6 h-6 ${
                    renderMode === 'ffmpeg' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    FFmpeg 快速渲染
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">快速</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                自动合成所有场景，包含转场和字幕。一键完成。
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                服务器端渲染，极速
              </div>
            </button>

            <button
              onClick={() => setRenderMode('blender')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                renderMode === 'blender'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white/50 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${
                  renderMode === 'blender' ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  <Scissors className={`w-6 h-6 ${
                    renderMode === 'blender' ? 'text-white' : 'text-slate-600 dark:text-slate-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Blender 专业导出
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">进阶</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                导出 Python 脚本，在 Blender 中手动精修。支持复杂特效。
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                完全控制，高级调色
              </div>
            </button>
          </div>
        </div>

        {/* 完成度檢查 */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="p-4 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">專案完成度</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                {hasStoryboard ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                )}
                <span className={`text-sm ${hasStoryboard ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                  分鏡腳本
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasImages ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                )}
                <span className={`text-sm ${hasImages ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                  圖片生成
                </span>
              </div>
              <div className="flex items-center gap-2">
                {hasVideos ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400 dark:text-slate-600" />
                )}
                <span className={`text-sm ${hasVideos ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                  影片生成 ({scenesWithVideos.length}/{scenes.length})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OpenReel 编辑模式 */}
        {renderMode === 'openreel' && (
          <div className="relative left-1/2 right-1/2 w-screen -mx-[50vw] px-4 sm:px-6 lg:px-8">
            <div className="max-w-none">
              <OpenReelEditor
                projectId={projectId}
                projectName={currentProject.name}
                storyboard={currentProject.storyboard}
                editingSuggestion={editingSuggestion}
                savedProjectJson={currentProject.openreelProjectJson}
                onSaveProjectJson={(json) => {
                  updateProject(projectId, { openreelProjectJson: json });
                }}
              />
            </div>
          </div>
        )}

        {/* FFmpeg 渲染模式 */}
        {renderMode === 'ffmpeg' && (
          <div className="max-w-4xl mx-auto">
            <FFmpegRenderer
              projectId={projectId}
              projectName={currentProject.name}
              storyboard={currentProject.storyboard}
            />
          </div>
        )}

        {/* Blender 导出模式 */}
        {renderMode === 'blender' && (
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* 左側：影片分析 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">步骤 1: AI 影片分析</h2>
              <VideoAnalyzer
                storyboard={currentProject.storyboard}
                onAnalysisComplete={handleAnalysisComplete}
              />
            </div>

            {/* 右側：Blender 腳本 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">步骤 2: Blender 脚本</h2>
              <BlenderScriptViewer
                projectName={currentProject.name}
                scenes={scenes}
                editingSuggestion={editingSuggestion || undefined}
              />
            </div>
          </div>
        )}

        {/* 影片列表 */}
        {scenesWithVideos.length > 0 && (
          <div className="max-w-4xl mx-auto mt-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              已生成的影片 ({scenesWithVideos.length})
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {scenesWithVideos.map((scene) => (
                <div
                  key={scene.id}
                  className="bg-white/50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 backdrop-blur-sm"
                >
                  <video
                    src={scene.generatedVideo!.url}
                    className="w-full aspect-video rounded bg-slate-900"
                    controls
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">場景 {scene.sceneNumber}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-600 truncate">
                    {scene.generatedVideo!.model === 'kling' ? 'Kling 2.6 Pro' : 'Seedance 1.5 Pro'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
