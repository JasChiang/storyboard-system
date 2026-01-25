'use client';

import { useState } from 'react';
import { Play, Loader2, Film } from 'lucide-react';

interface VideoPreviewProps {
    videoUrl: string | null;
    prompt?: string;
    model?: 'kling' | 'seedance';
    isLoading?: boolean;
    onRegenerate?: () => void;
}

export function VideoPreview({
    videoUrl,
    prompt,
    model,
    isLoading = false,
    onRegenerate,
}: VideoPreviewProps) {
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    if (isLoading) {
        return (
            <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 
                      flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">生成影片中...</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">這可能需要幾分鐘時間</p>
                </div>
            </div>
        );
    }

    if (!videoUrl) {
        return (
            <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 
                      flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Film className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-500">尚未生成影片</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative group">
                <video
                    src={videoUrl}
                    className={`
            w-full aspect-video rounded-lg border border-slate-200 dark:border-slate-700 
            bg-black transition-opacity duration-300
            ${videoLoaded ? 'opacity-100' : 'opacity-0'}
          `}
                    controls
                    loop
                    onLoadedData={() => setVideoLoaded(true)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                >
                    您的瀏覽器不支援影片播放
                </video>

                {!videoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                )}

                {!isPlaying && videoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 bg-white/20 dark:bg-white/10 rounded-full flex items-center justify-center
                          backdrop-blur-md border border-white/30 shadow-lg">
                            <Play className="w-8 h-8 text-white ml-1" fill="white" />
                        </div>
                    </div>
                )}

                {onRegenerate && (
                    <button
                        onClick={onRegenerate}
                        className="absolute bottom-3 right-3 px-4 py-2 
                     bg-purple-600 hover:bg-purple-700 
                     text-white text-sm font-medium rounded-lg
                     opacity-0 group-hover:opacity-100 transition-opacity
                     flex items-center gap-2 shadow-sm"
                    >
                        <Film className="w-4 h-4" />
                        重新生成
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                {prompt && (
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Motion Prompt</p>
                        <p className="text-sm text-slate-900 dark:text-slate-200">{prompt}</p>
                    </div>
                )}

                {model && (
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">模型</p>
                        <p className="text-sm text-slate-900 dark:text-slate-200">
                            {model === 'kling' ? 'Kling 2.6 Pro' : 'Seedance 1.5 Pro'}
                        </p>
                    </div>
                )}
            </div>

            {/* 下載按鈕 */}
            <a
                href={videoUrl}
                download
                className="block w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700
                 text-white text-sm font-medium rounded-lg text-center
                 transition-colors shadow-sm"
            >
                下載影片
            </a>
        </div>
    );
}
