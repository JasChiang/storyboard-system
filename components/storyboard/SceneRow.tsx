'use client';

import { useState } from 'react';
import { Scene, TransitionType } from '@/lib/types/storyboard';
import { Pencil, Trash2, Check, X, Copy, Star, RotateCcw } from 'lucide-react';

interface SceneRowProps {
  scene: Scene;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onDuplicate?: () => void;
  onResetScene?: () => void;
  isRegenerating?: boolean;
  isDraggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

// 根據場景描述推斷景別
function inferShotType(description: string): string | null {
  const lower = description.toLowerCase();
  if (/extreme\s*close[-\s]?up|極端特寫|超特寫/i.test(lower)) return 'ECU';
  if (/close[-\s]?up|特寫|近景/i.test(lower)) return 'CU';
  if (/medium\s*shot|中景|半身/i.test(lower)) return 'MS';
  if (/wide\s*shot|全景|大全景/i.test(lower)) return 'WS';
  if (/extreme\s*wide|超遠景|全場景/i.test(lower)) return 'EWS';
  return null;
}

// 轉場類型顯示設定
const TRANSITION_LABELS: Record<TransitionType, { label: string; color: string; icon: string }> = {
  cut: { label: '硬切', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: '✂️' },
  dissolve: { label: '溶解', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '🔀' },
  fade_black: { label: '黑場', color: 'bg-gray-800 text-white dark:bg-gray-900 dark:text-gray-100', icon: '⬛' },
  fade_white: { label: '白場', color: 'bg-gray-100 text-gray-700 dark:bg-gray-200 dark:text-gray-800', icon: '⬜' },
  continuation: { label: '延續', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: '🔗' },
  match_cut: { label: '匹配', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: '🎯' },
  wipe: { label: '擦除', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: '➡️' },
  push: { label: '推出', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: '📤' },
};

export function SceneRow({
  scene,
  onUpdate,
  onDelete,
  onRegenerate,
  onDuplicate,
  onResetScene,
  isRegenerating = false,
  isDraggable,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SceneRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScene, setEditedScene] = useState(scene);

  const handleSave = () => {
    onUpdate(editedScene);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedScene(scene);
    setIsEditing(false);
  };

  const handleTransitionChange = (type: TransitionType) => {
    const updates = {
      ...editedScene,
      transitionToNext: {
        ...editedScene.transitionToNext,
        type,
        // 自動設定 continuation 的相關選項
        useEndFrameAsNextStart: type === 'continuation',
      },
    };
    // 如果選擇 continuation，自動勾選 requiresEndFrame
    if (type === 'continuation') {
      updates.requiresEndFrame = true;
    }
    setEditedScene(updates);
  };

  if (isEditing) {
    return (
      <tr
        className="bg-slate-100/70 dark:bg-slate-900/55"
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <td className="px-4 py-3">
          <div className="inline-flex rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300">
            #{scene.sceneNumber}
          </div>
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.description}
            onChange={(e) => setEditedScene({ ...editedScene, description: e.target.value })}
            rows={3}
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.cameraMovement}
            onChange={(e) => setEditedScene({ ...editedScene, cameraMovement: e.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.dialogue}
            onChange={(e) => setEditedScene({ ...editedScene, dialogue: e.target.value })}
            rows={2}
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            className="w-24 rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.duration}
            onChange={(e) => setEditedScene({ ...editedScene, duration: parseFloat(e.target.value) })}
            step="0.1"
          />
        </td>
        <td className="px-4 py-3">
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={editedScene.requiresEndFrame || false}
                onChange={(e) => {
                  const nextChecked = e.target.checked;
                  const nextTransition = editedScene.transitionToNext?.type === 'continuation' && !nextChecked
                    ? {
                      ...editedScene.transitionToNext,
                      type: 'dissolve' as TransitionType,
                      useEndFrameAsNextStart: false,
                      reason: 'Switched from continuation because end frame was disabled.',
                    }
                    : editedScene.transitionToNext;

                  setEditedScene({
                    ...editedScene,
                    requiresEndFrame: nextChecked,
                    endFrameDescription: nextChecked ? (editedScene.endFrameDescription || editedScene.description) : '',
                    endFrameDelta: nextChecked ? (editedScene.endFrameDelta || '') : '',
                    transitionToNext: nextTransition,
                  });
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              需要尾幀
            </label>
            {editedScene.requiresEndFrame && (
              <div className="space-y-1">
                <textarea
                  className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
                  value={editedScene.endFrameDescription || ''}
                  onChange={(e) => setEditedScene({ ...editedScene, endFrameDescription: e.target.value })}
                  placeholder="尾幀完整描述"
                  rows={2}
                />
                <textarea
                  className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
                  value={editedScene.endFrameDelta || ''}
                  onChange={(e) => setEditedScene({ ...editedScene, endFrameDelta: e.target.value })}
                  placeholder="尾幀差異（只寫相對首幀改變）"
                  rows={2}
                />
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <select
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.transitionToNext?.type || 'dissolve'}
            onChange={(e) => handleTransitionChange(e.target.value as TransitionType)}
          >
            {Object.entries(TRANSITION_LABELS).map(([type, { label, icon }]) => (
              <option key={type} value={type}>
                {icon} {label}
              </option>
            ))}
          </select>
          {editedScene.transitionToNext?.reason && (
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">
              {editedScene.transitionToNext.reason}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg border border-green-200 bg-green-100 p-1.5 text-green-700 transition hover:bg-green-200 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40"
              title="保存"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              title="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const transitionType = scene.transitionToNext?.type || 'dissolve';
  const transitionInfo = TRANSITION_LABELS[transitionType];
  const shotType = inferShotType(scene.description);

  const retentionRiskDot: Record<string, string> = {
    low: 'bg-green-400',
    medium: 'bg-amber-400',
    high: 'bg-red-500',
  };

  const handleCopyPrompt = () => {
    const text = [scene.description, scene.cameraMovement, scene.dialogue].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <tr
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-700 dark:hover:bg-slate-700/40 ${isDragOver ? 'outline outline-2 outline-blue-400 outline-offset-[-2px]' : ''} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col items-start gap-1.5">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            #{scene.sceneNumber}
          </div>
          {shotType && (
            <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {shotType}
            </span>
          )}
          {scene.retentionRisk && (
            <span
              className={`inline-block h-2 w-2 rounded-full ${retentionRiskDot[scene.retentionRisk]}`}
              title={`流失風險: ${scene.retentionRisk}`}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-md text-sm leading-6 text-slate-800 dark:text-slate-100">
          {scene.description}
        </div>
        {scene.hookScore && (
          <div className="mt-1.5 flex items-center gap-1" title={scene.hookScoreReason || `Hook 強度 ${scene.hookScore}/5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < scene.hookScore! ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
              />
            ))}
            <span className="ml-1 text-xs text-muted-foreground">Hook {scene.hookScore}</span>
          </div>
        )}
        {scene.qaStatus && (
          <div className="mt-2">
            <span
              className={`inline-flex rounded-md border px-2 py-1 text-xs ${
                scene.qaStatus === 'block'
                  ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : scene.qaStatus === 'warn'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
              }`}
            >
              QA: {scene.qaStatus === 'block' ? '阻擋' : scene.qaStatus === 'warn' ? '警告' : '通過'}
            </span>
          </div>
        )}
        {scene.qaIssues && scene.qaIssues.length > 0 && (
          <div className="mt-1 max-w-md text-xs text-slate-600 dark:text-slate-400 line-clamp-2" title={scene.qaIssues.join('\n')}>
            {scene.qaIssues[0]}
          </div>
        )}
        {scene.consistencyWarnings && scene.consistencyWarnings.length > 0 && (
          <div className="mt-2 space-y-1">
            <span className="inline-flex rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
              一致性待確認 ({scene.consistencyWarnings.length})
            </span>
            <div className="max-w-md text-xs text-rose-600 dark:text-rose-400 line-clamp-2" title={scene.consistencyWarnings.join('\n')}>
              {scene.consistencyWarnings[0]}
            </div>
          </div>
        )}
        {scene.notes && (
          <div className="mt-2 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            備註: {scene.notes}
          </div>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-[220px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {scene.cameraMovement}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-xs text-sm text-slate-700 dark:text-slate-200">
          {scene.dialogue || <span className="text-slate-400 dark:text-slate-500">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {scene.duration}秒
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        {scene.requiresEndFrame ? (
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              ✓ 首尾幀
            </span>
            {scene.endFrameDescription && (
              <div className="max-w-xs line-clamp-2 text-xs text-slate-500 dark:text-slate-400" title={scene.endFrameDescription}>
                尾幀: {scene.endFrameDescription}
              </div>
            )}
            {scene.endFrameDelta && (
              <div className="max-w-xs line-clamp-2 text-xs text-violet-600 dark:text-violet-300" title={scene.endFrameDelta}>
                差異: {scene.endFrameDelta}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="space-y-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${transitionInfo.color}`}>
            {transitionInfo.icon} {transitionInfo.label}
          </span>
          {scene.transitionToNext?.useEndFrameAsNextStart && (
            <div className="text-xs font-medium text-green-600 dark:text-green-400">
              → 延續至下一幕
            </div>
          )}
          {scene.transitionToNext?.reason && (
            <div className="max-w-xs line-clamp-2 text-xs text-slate-500 dark:text-slate-400" title={scene.transitionToNext.reason}>
              {scene.transitionToNext.reason}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-blue-200 bg-blue-100 p-1.5 text-blue-700 transition hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
            title="編輯"
          >
            <Pencil className="h-4 w-4" />
          </button>
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              title="複製場景"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleCopyPrompt}
            className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            title="複製 Prompt"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          {onResetScene && (
            <button
              onClick={onResetScene}
              className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/40"
              title="重置生成（清除圖片/影片）"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 bg-red-100 p-1.5 text-red-700 transition hover:bg-red-200 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
            title="刪除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="rounded-lg border border-indigo-200 bg-indigo-100 p-1.5 text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
              title="重生此場景"
            >
              {isRegenerating ? '...' : '↻'}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
