'use client';

import { useMemo, useState } from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import type { TimelineRow, TimelineAction, TimelineEffect } from '@xzdarcy/timeline-engine';
import type { Scene, TransitionType } from '@/lib/types/storyboard';
import {
  scenesToTimelineRows,
  timelineRowsToScenes,
  updateSceneDuration,
  updateSceneTransition,
  type TimelineActionWithData,
} from '@/lib/utils/remotion-timeline';

interface RemotionTimelineProps {
  scenes: Scene[];
  onScenesChange: (scenes: Scene[]) => void;
}

const transitionOptions: { value: TransitionType; label: string }[] = [
  { value: 'dissolve', label: 'Dissolve' },
  { value: 'wipe', label: 'Wipe' },
  { value: 'push', label: 'Slide' },
  { value: 'fade_black', label: 'Fade to Black' },
  { value: 'fade_white', label: 'Fade to White' },
  { value: 'cut', label: 'Cut' },
];

const effects: Record<string, TimelineEffect> = {
  video: { id: 'video', name: 'Video' },
  transition: { id: 'transition', name: 'Transition' },
  subtitle: { id: 'subtitle', name: 'Subtitle' },
};

export function RemotionTimeline({ scenes, onScenesChange }: RemotionTimelineProps) {
  const [selectedAction, setSelectedAction] = useState<TimelineActionWithData | null>(null);

  const timelineData = useMemo(() => scenesToTimelineRows(scenes), [scenes]);
  const editorData = timelineData.rows;
  const totalDuration = timelineData.duration;

  const handleTimelineChange = (rows: TimelineRow[]) => {
    const updatedScenes = timelineRowsToScenes(rows, scenes);
    onScenesChange(updatedScenes);
  };

  const handleActionClick = (_: React.MouseEvent, param: { action: TimelineAction }) => {
    setSelectedAction(param.action as TimelineActionWithData);
  };

  const handleDurationInput = (sceneId: string, value: number) => {
    onScenesChange(updateSceneDuration(scenes, sceneId, value));
  };

  const handleTransitionType = (sceneId: string, type: TransitionType) => {
    const current = scenes.find(scene => scene.id === sceneId);
    onScenesChange(updateSceneTransition(scenes, sceneId, { type, duration: current?.transitionToNext?.duration ?? 0.5 }));
  };

  const handleTransitionDuration = (sceneId: string, value: number, fallbackType: TransitionType) => {
    onScenesChange(updateSceneTransition(scenes, sceneId, { type: fallbackType, duration: value }));
  };

  const renderAction = (action: TimelineAction, row: TimelineRow) => {
    const data = (action as TimelineActionWithData).data;
    const isTransition = action.effectId === 'transition';
    const isSubtitle = action.effectId === 'subtitle';

    return (
      <div className="h-full w-full px-3 py-2 flex items-center gap-3 text-xs text-white">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {isTransition
              ? data?.transitionType || 'Transition'
              : isSubtitle
              ? 'Subtitle'
              : `Scene ${data?.sceneNumber ?? ''}`}
          </div>
          <div className="opacity-70 truncate">
            {isTransition
              ? `${(action.end - action.start).toFixed(2)}s`
              : data?.subtitle || ''}
          </div>
        </div>
        {!isTransition && data?.src ? (
          <img
            src={data.src}
            alt="thumb"
            className="h-8 w-12 rounded object-cover opacity-80"
          />
        ) : null}
      </div>
    );
  };

  const selectedSceneId = selectedAction?.data?.sceneId;
  const selectedScene = selectedSceneId
    ? scenes.find(scene => scene.id === selectedSceneId)
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950/90 p-4">
        <Timeline
          editorData={editorData}
          effects={effects}
          scale={1}
          scaleSplitCount={4}
          scaleWidth={80}
          startLeft={40}
          minScaleCount={Math.max(20, Math.ceil(totalDuration))}
          maxScaleCount={Math.max(40, Math.ceil(totalDuration) + 20)}
          rowHeight={56}
          autoScroll
          gridSnap
          dragLine
          enableRowDrag={false}
          getActionRender={renderAction}
          onClickActionOnly={handleActionClick}
          onChange={handleTimelineChange}
          style={{ width: '100%', height: 320 }}
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          片段屬性
        </h4>
        {!selectedAction || !selectedScene ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            點選時間軸中的片段以編輯長度或轉場。
          </p>
        ) : selectedAction.effectId === 'video' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">場景時長 (秒)</label>
              <input
                type="number"
                min={0.5}
                step={0.1}
                value={selectedScene.duration}
                onChange={(e) => handleDurationInput(selectedScene.id, Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">場景描述</label>
              <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                {selectedScene.description}
              </div>
            </div>
          </div>
        ) : selectedAction.effectId === 'transition' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">轉場類型</label>
              <select
                value={selectedScene.transitionToNext?.type || 'dissolve'}
                onChange={(e) => handleTransitionType(selectedScene.id, e.target.value as TransitionType)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                {transitionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">轉場時長 (秒)</label>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={selectedScene.transitionToNext?.duration ?? 0.5}
                onChange={(e) =>
                  handleTransitionDuration(
                    selectedScene.id,
                    Number(e.target.value),
                    selectedScene.transitionToNext?.type || 'dissolve'
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400">字幕內容</label>
              <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                {selectedScene.dialogue || selectedScene.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
