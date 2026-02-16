'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Scissors, CheckCircle2, XCircle, Zap, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useProjectStore } from '@/stores/project-store';
import { ProjectStepNavigator } from '@/components/project/ProjectStepNavigator';
import { VideoAnalyzer } from '@/components/export/VideoAnalyzer';
import { BlenderScriptViewer } from '@/components/export/BlenderScriptViewer';
import { FFmpegRenderer } from '@/components/export/FFmpegRenderer';
import { OpenReelEditor } from '@/components/export/OpenReelEditor';
import { AudioGeneratorPanel } from '@/components/export/AudioGeneratorPanel';
import type { EditingSuggestion } from '@/lib/types/project';
import type { Scene, Storyboard } from '@/lib/types/storyboard';

export default function ExportPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject, updateProject } = useProjectStore();
  const [editingSuggestion, setEditingSuggestion] = useState<EditingSuggestion | null>(null);
  const [renderMode, setRenderMode] = useState<'openreel' | 'ffmpeg' | 'blender'>('openreel');

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  useEffect(() => {
    setEditingSuggestion(currentProject?.editingSuggestions || null);
  }, [currentProject?.editingSuggestions, currentProject?.id]);

  const scenes = currentProject?.storyboard?.scenes || [];
  const scenesWithVideos = scenes.filter(s => Boolean(s.generatedVideo?.url));
  const hasEditingSuggestionCoverage = useMemo(() => {
    if (!editingSuggestion?.scenes?.length || scenesWithVideos.length === 0) return false;
    const suggestedSceneIds = new Set(editingSuggestion.scenes.map(scene => scene.sceneId));
    return scenesWithVideos.every(scene => suggestedSceneIds.has(scene.id));
  }, [editingSuggestion, scenesWithVideos]);

  // 檢查完成度
  const hasStoryboard = !!currentProject?.storyboard;
  const hasImages = scenes.length > 0 && scenes.every(s => Boolean(s.generatedImage?.url));
  const hasVideos = scenes.length > 0 && scenesWithVideos.length === scenes.length;

  const handleAnalysisComplete = (suggestion: EditingSuggestion) => {
    setEditingSuggestion(suggestion);

    // 保存到專案
    if (currentProject) {
      updateProject(projectId, {
        editingSuggestions: suggestion,
        status: 'complete',
      });
    }
  };

  const handleVoiceoversGenerated = (
    updates: Array<{
      sceneId: string;
      generatedVoiceover: Scene['generatedVoiceover'];
    }>
  ) => {
    if (!currentProject?.storyboard || updates.length === 0) return;

    const updateMap = new Map(updates.map((item) => [item.sceneId, item.generatedVoiceover]));
    const updatedScenes = currentProject.storyboard.scenes.map((scene) => {
      const generatedVoiceover = updateMap.get(scene.id);
      if (!generatedVoiceover) return scene;
      return {
        ...scene,
        generatedVoiceover,
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

  const handleMusicGenerated = (generatedMusic: Storyboard['generatedMusic']) => {
    if (!currentProject?.storyboard || !generatedMusic) return;

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        generatedMusic,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const handleAudioDraftChange = useCallback((audioPlanningDraft: Storyboard['audioPlanningDraft']) => {
    if (!currentProject?.storyboard || !audioPlanningDraft) return;

    updateProject(projectId, {
      storyboard: {
        ...currentProject.storyboard,
        audioPlanningDraft,
        updatedAt: new Date().toISOString(),
      },
    });
  }, [currentProject?.storyboard, projectId, updateProject]);

  if (!currentProject?.storyboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">請先建立分鏡腳本</p>
          <Link
            href={`/project/${projectId}/storyboard`}
            className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      <header className="app-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/project/${projectId}`}
              className="surface-soft rounded-lg p-2 transition-colors hover:border-primary/25"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </Link>
            <div>
              <p className="text-kicker">Export</p>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Scissors className="w-5 h-5 text-primary" />
                影片匯出
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {currentProject.name} · {renderMode === 'openreel' ? 'OpenReel 線上編輯' : renderMode === 'ffmpeg' ? 'FFmpeg 快速渲染' : 'Blender 專業匯出'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <ProjectStepNavigator
        projectId={projectId}
        project={currentProject}
        currentStep="export"
      />

      <main className="container mx-auto px-4 py-8">
        <AudioGeneratorPanel
          projectId={projectId}
          storyboard={currentProject.storyboard}
          onVoiceoversGenerated={handleVoiceoversGenerated}
          onMusicGenerated={handleMusicGenerated}
          onAudioDraftChange={handleAudioDraftChange}
        />

        {/* 渲染模式選擇 */}
        <div className="max-w-4xl mx-auto mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            選擇渲染方式
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {/* OpenReel */}
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
                    我要精細剪輯
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">OpenReel · 需 15-30 分鐘</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                完整線上剪輯器，手動調整每一個細節。
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 多軌時間軸剪輯</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 轉場、字幕、音訊控制</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 可儲存並繼續編輯</li>
              </ul>
            </button>

            {/* FFmpeg */}
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
                    我要快速看到成品
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">FFmpeg · 約 30 秒完成</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                一鍵自動合成，立刻下載成片。
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 伺服器端自動渲染</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 自動套用 AI 剪輯建議</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 支援轉場與字幕疊加</li>
              </ul>
            </button>

            {/* Blender */}
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
                    我是專業後製
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Blender · 需 Blender 環境</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                匯出 Python 腳本，在 Blender 中精修。
              </p>
              <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 完整節點控制權</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 支援複雜特效與調色</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" /> 可整合自訂 shader</li>
              </ul>
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

        {renderMode !== 'blender' && hasVideos && (
          <div className="max-w-4xl mx-auto mb-8 space-y-4">
            <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI 剪輯建議</h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {hasEditingSuggestionCoverage
                  ? '已取得可用建議，OpenReel/FFmpeg 會直接套用。可手動重新分析更新結果。'
                  : '尚未完成分析，請手動點擊「開始分析影片」後再套用建議。'}
              </p>
            </div>

            <VideoAnalyzer
              key={`analysis-${projectId}-${scenesWithVideos.length}-${hasEditingSuggestionCoverage ? 'ready' : 'pending'}`}
              storyboard={currentProject.storyboard}
              onAnalysisComplete={handleAnalysisComplete}
              autoStart={false}
            />
          </div>
        )}

        {/* OpenReel 編輯模式 */}
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
              editingSuggestion={editingSuggestion}
            />
          </div>
        )}

        {/* Blender 匯出模式 */}
        {renderMode === 'blender' && (
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            {/* 左側：影片分析 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">步驟 1: AI 影片分析</h2>
              <VideoAnalyzer
                storyboard={currentProject.storyboard}
                onAnalysisComplete={handleAnalysisComplete}
              />
            </div>

            {/* 右側：Blender 腳本 */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">步驟 2: Blender 腳本</h2>
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
