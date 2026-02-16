'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface ImagePreviewProps {
    imageUrl: string | null;
    prompt?: string;
    isLoading?: boolean;
    onRegenerate?: () => void;
}

// Keep a lightweight module-level cache so remounted previews do not flash loading
// for URLs that have already been loaded once in this session.
const loadedImageUrlCache = new Set<string>();

export function ImagePreview({
    imageUrl,
    prompt,
    isLoading = false,
    onRegenerate
}: ImagePreviewProps) {
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
        if (!imageUrl) {
            setImageLoaded(false);
            return;
        }

        // Fast path for previously loaded URLs in this session.
        if (loadedImageUrlCache.has(imageUrl)) {
            setImageLoaded(true);
            return;
        }

        // Probe browser cache first to avoid unnecessary spinner flashes.
        const probe = new window.Image();
        probe.src = imageUrl;
        if (probe.complete) {
            loadedImageUrlCache.add(imageUrl);
            setImageLoaded(true);
            return;
        }

        setImageLoaded(false);
    }, [imageUrl]);

    if (isLoading) {
        return (
            <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 
                      flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-700 dark:text-blue-500 animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">生成圖片中...</p>
                </div>
            </div>
        );
    }

    if (!imageUrl) {
        return (
            <div className="relative w-full aspect-video bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 
                      flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Sparkles className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-500">尚未生成圖片</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="relative group">
                <img
                    src={imageUrl}
                    alt={prompt || 'Generated image'}
                    loading="eager"
                    className={`
            w-full aspect-video object-contain rounded-lg border border-slate-200 dark:border-slate-700 
            bg-slate-100 dark:bg-slate-900/50 transition-opacity duration-300
            ${imageLoaded ? 'opacity-100' : 'opacity-0'}
          `}
                    onLoad={() => {
                        loadedImageUrlCache.add(imageUrl);
                        setImageLoaded(true);
                    }}
                />

                {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                )}

                {onRegenerate && (
                    <button
                        onClick={onRegenerate}
                        className="absolute bottom-3 right-3 px-4 py-2 
                     bg-blue-700 hover:bg-blue-800 
                     text-white text-sm font-medium rounded-lg
                     opacity-0 group-hover:opacity-100 transition-opacity
                     flex items-center gap-2 shadow-sm"
                    >
                        <Sparkles className="w-4 h-4" />
                        重新生成
                    </button>
                )}
            </div>

            {prompt && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">Prompt</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{prompt}</p>
                </div>
            )}
        </div>
    );
}
