'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Storyboard } from '@/lib/types/storyboard';
import type { EditingSuggestion } from '@/lib/types/project';
import { convertToOpenReelProjectFile, serializeOpenReelProjectFile } from '@/lib/utils/openreel-converter';

const OPENREEL_URL = process.env.NEXT_PUBLIC_OPENREEL_URL || 'http://localhost:5173';

type AspectRatio = '16:9' | '9:16' | '1:1';

async function detectAspectRatioFromUrl(url: string): Promise<AspectRatio> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const timer = setTimeout(() => { video.src = ''; resolve('16:9'); }, 5000);
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      const w = video.videoWidth;
      const h = video.videoHeight;
      video.src = '';
      if (!w || !h) return resolve('16:9');
      const r = w / h;
      if (Math.abs(r - 9 / 16) < 0.15) return resolve('9:16');
      if (Math.abs(r - 1) < 0.1) return resolve('1:1');
      resolve('16:9');
    };
    video.onerror = () => { clearTimeout(timer); resolve('16:9'); };
    video.src = url;
  });
}

interface OpenReelEditorProps {
  projectId: string;
  projectName: string;
  storyboard: Storyboard;
  aspectRatio?: AspectRatio;
  editingSuggestion?: EditingSuggestion | null;
  savedProjectJson?: string | null;
  onSaveProjectJson?: (json: string) => void;
}

type OpenReelMessage =
  | { type: 'OPENREEL_READY' }
  | { type: 'OPENREEL_EXPORT_PROJECT'; payload: { projectJson: string } }
  | {
      type: 'OPENREEL_IMPORT_PROGRESS';
      payload: {
        status: 'processing' | 'cached' | 'downloading' | 'complete';
        totalItems: number;
        processedItems: number;
        currentItemId: string;
        currentItemName: string;
        currentItemType: 'video' | 'image' | 'audio';
        currentItemPercent: number | null;
        overallPercent: number;
        bytesLoaded?: number;
        bytesTotal?: number | null;
        fromCache?: boolean;
      };
    }
  | { type: 'OPENREEL_IMPORT_SUCCESS'; payload: { totalItems: number; failedItems: number } }
  | { type: 'OPENREEL_IMPORT_ERROR'; payload: { error: string } };

type ImportProgress = Extract<OpenReelMessage, { type: 'OPENREEL_IMPORT_PROGRESS' }>['payload'];

function shortHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function buildStableOpenReelProjectId(projectId: string): string {
  return `project-${projectId}`;
}

function normalizeSavedProjectJsonProjectId(
  projectJson: string,
  projectId: string,
): string {
  try {
    const parsed = JSON.parse(projectJson) as { project?: { id?: unknown } };
    if (!parsed || typeof parsed !== 'object' || !parsed.project || typeof parsed.project !== 'object') {
      return projectJson;
    }
    const stableId = buildStableOpenReelProjectId(projectId);
    if (parsed.project.id === stableId) {
      return projectJson;
    }
    parsed.project.id = stableId;
    return JSON.stringify(parsed);
  } catch {
    return projectJson;
  }
}

export function OpenReelEditor({
  projectId,
  projectName,
  storyboard,
  aspectRatio: aspectRatioProp,
  editingSuggestion,
  savedProjectJson,
  onSaveProjectJson,
}: OpenReelEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const pendingProjectJsonRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const [resolvedAspectRatio, setResolvedAspectRatio] = useState<AspectRatio>(aspectRatioProp ?? '16:9');
  const [lastLoadInfo, setLastLoadInfo] = useState<{
    hash: string;
    loadedAt: string;
    includesAiSuggestion: boolean;
    aiSceneCount: number;
  } | null>(null);

  const firstVideoUrl = storyboard.scenes[0]?.generatedVideo?.url;
  const firstImageUrl = storyboard.scenes[0]?.generatedImage?.url;

  useEffect(() => {
    if (aspectRatioProp) return;
    const url = firstVideoUrl || firstImageUrl;
    if (!url) return;
    detectAspectRatioFromUrl(url).then(setResolvedAspectRatio);
  }, [firstVideoUrl, firstImageUrl, aspectRatioProp]);

  const buildProjectJson = () => {
    const projectFile = convertToOpenReelProjectFile(storyboard, projectName, {
      aspectRatio: resolvedAspectRatio,
      editingSuggestion: editingSuggestion ?? undefined,
      sourceProjectId: projectId,
    });
    return serializeOpenReelProjectFile(projectFile);
  };

  const normalizedSavedProjectJson = useMemo(() => {
    const saved = savedProjectJson?.trim();
    if (!saved) return null;
    return normalizeSavedProjectJsonProjectId(saved, projectId);
  }, [projectId, savedProjectJson]);

  const hasSavedProject = !!normalizedSavedProjectJson;

  const projectJson = useMemo(() => {
    if (!forceRegenerate && normalizedSavedProjectJson) {
      return normalizedSavedProjectJson;
    }
    return buildProjectJson();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSavedProjectJson, storyboard, projectName, editingSuggestion, forceRegenerate, resolvedAspectRatio, projectId]);

  useEffect(() => {
    setForceRegenerate(false);
  }, [projectId]);

  const postMessage = useCallback((message: Record<string, unknown>) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(message, '*');
  }, []);

  const handleSendProject = useCallback((overrideJson?: string) => {
    if (!iframeRef.current?.contentWindow || !isReady) {
      pendingProjectJsonRef.current = overrideJson ?? projectJson;
      setPendingSend(true);
      setImportProgress(null);
      setStatusMessage('OpenReel 尚未就緒，稍後自動載入...');
      return;
    }
    const payloadJson = overrideJson ?? projectJson;
    const includesAiSuggestion = !!editingSuggestion?.scenes?.length;
    const aiSceneCount = editingSuggestion?.scenes?.length || 0;
    const hash = shortHash(payloadJson);
    setStatusMessage('正在載入 OpenReel 專案...');
    setImportProgress(null);
    setPendingSend(false);
    pendingProjectJsonRef.current = null;
    setLastLoadInfo({
      hash,
      loadedAt: new Date().toLocaleTimeString(),
      includesAiSuggestion,
      aiSceneCount,
    });
    postMessage({
      type: 'OPENREEL_IMPORT_PROJECT',
      payload: {
        projectId,
        projectJson: payloadJson,
      },
    });
  }, [editingSuggestion?.scenes?.length, isReady, postMessage, projectId, projectJson]);

  const handleRequestExport = useCallback(() => {
    setStatusMessage('正在取得 OpenReel 專案...');
    setImportProgress(null);
    postMessage({ type: 'OPENREEL_REQUEST_EXPORT' });
  }, [postMessage]);

  useEffect(() => {
    const handler = (event: MessageEvent<OpenReelMessage>) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'OPENREEL_READY') {
        setIsReady(true);
        if (pendingSend) {
          handleSendProject(pendingProjectJsonRef.current ?? undefined);
        }
      }

      if (event.data.type === 'OPENREEL_EXPORT_PROJECT') {
        if (event.data.payload.projectJson) {
          setStatusMessage('已儲存 OpenReel 專案。');
          setForceRegenerate(false);
          onSaveProjectJson?.(event.data.payload.projectJson);
        } else {
          setStatusMessage('保存失敗：OpenReel 回傳空的專案資料。');
        }
      }

      if (event.data.type === 'OPENREEL_IMPORT_PROGRESS') {
        const payload = event.data.payload;
        setImportProgress(payload);

        const totalText = payload.totalItems > 0
          ? `${payload.processedItems}/${payload.totalItems}`
          : `${payload.processedItems}`;

        if (payload.status === 'cached') {
          setStatusMessage(`素材同步中 ${totalText}（已命中快取）`);
        } else if (payload.status === 'downloading') {
          const currentPercent =
            payload.currentItemPercent === null ? '下載中' : `${Math.round(payload.currentItemPercent)}%`;
          setStatusMessage(`素材下載中 ${totalText} · ${payload.currentItemName} · ${currentPercent}`);
        } else if (payload.status === 'processing') {
          setStatusMessage(`正在處理素材 ${totalText} · ${payload.currentItemName}`);
        } else {
          setStatusMessage(`素材同步中 ${totalText}`);
        }
      }

      if (event.data.type === 'OPENREEL_IMPORT_SUCCESS') {
        const failedItems = event.data.payload.failedItems || 0;
        if (failedItems > 0) {
          setStatusMessage(`OpenReel 載入完成，但有 ${failedItems} 段素材下載失敗，預覽可能出現黑畫面。`);
        } else {
          setStatusMessage('OpenReel 專案載入完成，素材已同步。');
        }
        setImportProgress((prev) =>
          prev
            ? {
                ...prev,
                status: 'complete',
                overallPercent: 100,
                currentItemPercent: 100,
              }
            : prev,
        );
      }

      if (event.data.type === 'OPENREEL_IMPORT_ERROR') {
        setImportProgress(null);
        setStatusMessage(`OpenReel 匯入失敗：${event.data.payload.error}`);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleSendProject, onSaveProjectJson, pendingSend]);

  useEffect(() => {
    if (!isReady) return;
    handleSendProject();
  }, [handleSendProject, isReady, projectJson]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">OpenReel 線上編輯器</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            編輯後可從 OpenReel 匯出影片，或保存專案回本系統。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setForceRegenerate(true);
              setStatusMessage('已開啟新草稿版本（未覆蓋已保存版本）...');
              const freshJson = buildProjectJson();
              setTimeout(() => handleSendProject(freshJson), 0);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            開新草稿
          </Button>
          <Button
            variant="outline"
            disabled={!hasSavedProject}
            onClick={() => {
              if (!normalizedSavedProjectJson) return;
              setForceRegenerate(false);
              setStatusMessage('已還原至已保存版本。');
              setTimeout(() => handleSendProject(normalizedSavedProjectJson), 0);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            還原已保存
          </Button>
          <Button variant="outline" onClick={handleRequestExport}>
            <Save className="mr-2 h-4 w-4" />
            保存專案
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(OPENREEL_URL, '_blank', 'noopener')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            新視窗開啟
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {statusMessage}
        </div>
      )}

      {importProgress && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span>
              素材同步：{importProgress.totalItems > 0
                ? `${importProgress.processedItems}/${importProgress.totalItems}`
                : importProgress.processedItems}
              {' · '}
              {importProgress.currentItemName || '準備中'}
            </span>
            <span>{Math.round(importProgress.overallPercent)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, importProgress.overallPercent))}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {importProgress.fromCache
              ? '已從本機快取讀取素材'
              : importProgress.currentItemPercent === null
                ? '目前檔案下載中'
                : `目前檔案 ${Math.round(importProgress.currentItemPercent)}%`}
            {typeof importProgress.bytesLoaded === 'number' && (
              <>
                {' · '}
                {formatBytes(importProgress.bytesLoaded)}
                {typeof importProgress.bytesTotal === 'number' && importProgress.bytesTotal > 0
                  ? ` / ${formatBytes(importProgress.bytesTotal)}`
                  : ''}
              </>
            )}
          </div>
        </div>
      )}

      {lastLoadInfo && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          已送入 OpenReel：版本 {lastLoadInfo.hash} · 時間 {lastLoadInfo.loadedAt} ·
          {lastLoadInfo.includesAiSuggestion
            ? ` 含 AI 建議（${lastLoadInfo.aiSceneCount} 場景）`
            : ' 不含 AI 建議'}
        </div>
      )}

      <div className="w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black">
        <iframe
          ref={iframeRef}
          src={OPENREEL_URL}
          className="w-full h-[80vh]"
          title="OpenReel Editor"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
