'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Save } from 'lucide-react';
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
  | { type: 'OPENREEL_IMPORT_ERROR'; payload: { error: string } };

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
  const [isReady, setIsReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [pendingSend, setPendingSend] = useState(false);
  const [resolvedAspectRatio, setResolvedAspectRatio] = useState<AspectRatio>(aspectRatioProp ?? '16:9');

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
    });
    return serializeOpenReelProjectFile(projectFile);
  };

  const projectJson = useMemo(() => {
    if (!forceRegenerate && savedProjectJson && savedProjectJson.trim().length > 0) {
      return savedProjectJson;
    }
    return buildProjectJson();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectJson, storyboard, projectName, editingSuggestion, forceRegenerate, resolvedAspectRatio]);

  const postMessage = (message: Record<string, unknown>) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(message, '*');
  };

  const handleSendProject = (overrideJson?: string) => {
    if (!iframeRef.current?.contentWindow) {
      setPendingSend(true);
      setStatusMessage('OpenReel 尚未就緒，稍後自動載入...');
      return;
    }
    const payloadJson = overrideJson ?? projectJson;
    try {
      const parsed = JSON.parse(payloadJson);
      const firstMedia = parsed?.project?.mediaLibrary?.items?.[0];
      console.log('[OpenReelEditor] first media url:', firstMedia?.originalUrl);
      console.log(
        '[OpenReelEditor] first scene video url:',
        storyboard.scenes[0]?.generatedVideo?.url,
        'image url:',
        storyboard.scenes[0]?.generatedImage?.url
      );
    } catch (error) {
      console.warn('[OpenReelEditor] failed to parse project json', error);
    }
    setStatusMessage('正在載入 OpenReel 專案...');
    setPendingSend(false);
    postMessage({
      type: 'OPENREEL_IMPORT_PROJECT',
      payload: {
        projectId,
        projectJson: payloadJson,
      },
    });
  };

  const handleRequestExport = () => {
    setStatusMessage('正在取得 OpenReel 專案...');
    postMessage({ type: 'OPENREEL_REQUEST_EXPORT' });
  };

  useEffect(() => {
    const handler = (event: MessageEvent<OpenReelMessage>) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (event.data.type === 'OPENREEL_READY') {
        setIsReady(true);
        if (pendingSend) {
          handleSendProject();
        }
      }

      if (event.data.type === 'OPENREEL_EXPORT_PROJECT') {
        if (event.data.payload.projectJson) {
          setStatusMessage('已儲存 OpenReel 專案。');
          onSaveProjectJson?.(event.data.payload.projectJson);
        } else {
          setStatusMessage('保存失敗：OpenReel 回傳空的專案資料。');
        }
      }

      if (event.data.type === 'OPENREEL_IMPORT_ERROR') {
        setStatusMessage(`OpenReel 匯入失敗：${event.data.payload.error}`);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [projectJson, onSaveProjectJson]);

  useEffect(() => {
    if (!isReady) return;
    handleSendProject();
  }, [projectJson, isReady]);

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
              onSaveProjectJson?.('');
              setForceRegenerate(true);
              setStatusMessage('已重置保存的專案，重新生成中...');
              const freshJson = buildProjectJson();
              setTimeout(() => handleSendProject(freshJson), 0);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重新生成
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
