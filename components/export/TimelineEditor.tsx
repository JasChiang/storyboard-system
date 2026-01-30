'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Save, Download, RotateCcw, MoveHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Storyboard, Scene } from '@/lib/types/storyboard';

interface TimelineEditorProps {
  projectId: string;
  projectName: string;
  storyboard: Storyboard;
  onSave?: (updatedScenes: Scene[]) => void;
}

export function TimelineEditor({
  projectId,
  projectName,
  storyboard,
  onSave,
}: TimelineEditorProps) {
  const [scenes, setScenes] = useState<Scene[]>(storyboard.scenes);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const draggedItemRef = useRef<number | null>(null);

  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const pixelsPerSecond = 60;

  const handleDragStart = (index: number) => {
    draggedItemRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemRef.current === null || draggedItemRef.current === index) return;

    const newScenes = [...scenes];
    const draggedScene = newScenes[draggedItemRef.current];
    newScenes.splice(draggedItemRef.current, 1);
    newScenes.splice(index, 0, draggedScene);
    setScenes(newScenes);
    draggedItemRef.current = index;
  };

  const handleDragEnd = () => {
    draggedItemRef.current = null;
  };

  const handleDurationChange = (sceneId: string, newDuration: number) => {
    setScenes(scenes.map(scene =>
      scene.id === sceneId ? { ...scene, duration: Math.max(0.5, newDuration) } : scene
    ));
  };

  const handleDeleteScene = (sceneId: string) => {
    setScenes(scenes.filter(scene => scene.id !== sceneId));
  };

  const handleSave = () => {
    onSave?.(scenes);
    alert('場景已保存！');
  };

  const handleReset = () => {
    setScenes(storyboard.scenes);
    setSelectedSceneId(null);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/ffmpeg/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          scenes,
          projectTitle: projectName,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert('視頻渲染已開始！請切換到 FFmpeg 渲染模式查看進度。');
      } else {
        const error = await response.json();
        alert(`渲染失敗: ${error.error}`);
      }
    } catch (error) {
      alert('渲染失敗');
    } finally {
      setIsExporting(false);
    }
  };

  let cumulativeTime = 0;

  return (
    <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            時間軸編輯器
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            拖拽調整場景順序和時長
          </p>
        </div>

        {/* 控制按鈕 */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={isExporting}
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            重置
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={isExporting}
          >
            <Save className="w-4 h-4 mr-1" />
            保存
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 mr-1" />
            {isExporting ? '渲染中...' : '導出視頻'}
          </Button>
        </div>
      </div>

      {/* 統計信息 */}
      <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{scenes.length}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">場景數</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {scenes.filter(s => s.generatedVideo || s.generatedImage).length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">已生成素材</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDuration.toFixed(1)}s</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">總時長</div>
        </div>
      </div>

      {/* 時間軸視圖 */}
      <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 overflow-x-auto">
        <div className="min-w-max">
          {/* 時間刻度 */}
          <div className="flex items-center h-8 mb-2 border-b border-slate-300 dark:border-slate-600">
            {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => (
              <div
                key={i}
                className="text-xs text-slate-500 dark:text-slate-400"
                style={{ width: `${pixelsPerSecond}px` }}
              >
                {i}s
              </div>
            ))}
          </div>

          {/* 場景軌道 */}
          <div className="space-y-2">
            <div className="flex gap-1">
              {scenes.map((scene, index) => {
                const startTime = cumulativeTime;
                cumulativeTime += scene.duration;

                return (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`
                      relative h-20 cursor-move rounded-lg border-2 transition-all
                      ${selectedSceneId === scene.id
                        ? 'border-blue-500 shadow-lg'
                        : 'border-slate-300 dark:border-slate-600 hover:border-blue-300'
                      }
                      ${scene.generatedVideo
                        ? 'bg-blue-500 dark:bg-blue-600'
                        : scene.generatedImage
                        ? 'bg-purple-500 dark:bg-purple-600'
                        : 'bg-slate-400 dark:bg-slate-700'
                      }
                    `}
                    style={{ width: `${scene.duration * pixelsPerSecond}px` }}
                  >
                    {/* 場景預覽 */}
                    {(scene.generatedImage?.url || scene.generatedVideo?.url) && (
                      <img
                        src={scene.generatedImage?.url || scene.generatedVideo?.url}
                        alt={`Scene ${scene.sceneNumber}`}
                        className="absolute inset-0 w-full h-full object-cover rounded-lg opacity-40"
                      />
                    )}

                    {/* 場景信息 */}
                    <div className="relative h-full p-2 flex flex-col justify-between text-white">
                      <div className="text-xs font-bold">場景 {scene.sceneNumber}</div>
                      <div className="text-xs">{scene.duration.toFixed(1)}s</div>
                    </div>

                    {/* 拖拽手柄 */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2">
                      <MoveHorizontal className="w-4 h-4 text-white opacity-50" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 選中場景的詳細編輯 */}
      {selectedSceneId && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          {(() => {
            const scene = scenes.find(s => s.id === selectedSceneId);
            if (!scene) return null;

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    場景 {scene.sceneNumber} 詳細設置
                  </h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteScene(scene.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    刪除
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-blue-800 dark:text-blue-300">時長 (秒)</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.1"
                      value={scene.duration}
                      onChange={(e) => handleDurationChange(scene.id, parseFloat(e.target.value))}
                      className="mt-1 w-full px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-blue-800 dark:text-blue-300">類型</label>
                    <div className="mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded text-sm">
                      {scene.generatedVideo ? '視頻' : scene.generatedImage ? '圖片' : '未生成'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-blue-800 dark:text-blue-300">描述</label>
                  <div className="mt-1 px-3 py-2 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded text-sm">
                    {scene.description}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 說明 */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
        <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-2">
          編輯功能：
        </h4>
        <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <li>🎬 拖拽場景卡片調整順序</li>
          <li>⏱️ 點擊場景後可調整時長</li>
          <li>✂️ 選中場景後可刪除</li>
          <li>💾 編輯完成後記得保存</li>
          <li>🎥 保存後可直接導出為視頻</li>
        </ul>
      </div>
    </div>
  );
}
