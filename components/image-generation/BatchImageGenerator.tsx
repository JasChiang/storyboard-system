'use client';

import { useState } from 'react';
import { Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Scene } from '@/lib/types/storyboard';

interface BatchImageGeneratorProps {
    scenes: Scene[];
    onBatchComplete: (results: Map<string, { url: string; prompt: string }>) => void;
}

interface GenerationStatus {
    sceneId: string;
    status: 'pending' | 'generating' | 'completed' | 'failed';
    imageUrl?: string;
    prompt?: string;
    error?: string;
}

export function BatchImageGenerator({ scenes, onBatchComplete }: BatchImageGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [statuses, setStatuses] = useState<Map<string, GenerationStatus>>(new Map());
    const [aspectRatio, setAspectRatio] = useState<string>('16:9');
    const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');

    const scenesWithoutImages = scenes.filter(s => !s.generatedImage);
    const totalScenes = scenesWithoutImages.length;

    const updateStatus = (sceneId: string, update: Partial<GenerationStatus>) => {
        setStatuses(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(sceneId) || { sceneId, status: 'pending' as const };
            newMap.set(sceneId, { ...current, ...update });
            return newMap;
        });
    };

    const buildImagePrompt = (scene: Scene) => {
        const parts = [scene.description];
        if (scene.cameraMovement && scene.cameraMovement !== '無') {
            parts.push(`Camera: ${scene.cameraMovement}`);
        }
        return parts.join('. ');
    };

    const generateSingleImage = async (scene: Scene, apiKey: string) => {
        updateStatus(scene.id, { status: 'generating' });

        try {
            const prompt = buildImagePrompt(scene);

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    referenceImage: scene.referenceImage || null,
                    aspectRatio,
                    resolution,
                    apiKey,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Generation failed');
            }

            // 輪詢狀態
            const requestId = data.request_id;
            const endpoint = scene.referenceImage
                ? 'fal-ai/nano-banana-pro/edit'
                : 'fal-ai/nano-banana-pro';

            const imageUrl = await pollStatus(requestId, endpoint, apiKey);

            updateStatus(scene.id, {
                status: 'completed',
                imageUrl,
                prompt,
            });

            return { url: imageUrl, prompt };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '生成失敗';
            updateStatus(scene.id, {
                status: 'failed',
                error: errorMsg,
            });
            throw error;
        }
    };

    const pollStatus = async (
        requestId: string,
        endpoint: string,
        apiKey: string
    ): Promise<string> => {
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch('/api/fal/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    endpoint,
                    type: 'image',
                    apiKey,
                }),
            });

            const data = await response.json();

            if (data.status === 'COMPLETED') {
                const imageUrl = data.result.images[0]?.url;
                if (!imageUrl) throw new Error('No image URL in response');
                return imageUrl;
            } else if (data.status === 'FAILED') {
                throw new Error(data.error || 'Generation failed');
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        throw new Error('Generation timeout');
    };

    const handleBatchGenerate = async () => {
        setIsGenerating(true);

        try {
            const apiKey = localStorage.getItem('fal_api_key');
            if (!apiKey) {
                alert('請先在設定中輸入 Fal AI API Key');
                return;
            }

            // 初始化狀態
            scenesWithoutImages.forEach(scene => {
                updateStatus(scene.id, { status: 'pending' });
            });

            const results = new Map<string, { url: string; prompt: string }>();

            // 依序生成（避免超過 API 限制）
            for (const scene of scenesWithoutImages) {
                try {
                    const result = await generateSingleImage(scene, apiKey);
                    results.set(scene.id, result);
                } catch (error) {
                    console.error(`Failed to generate image for scene ${scene.sceneNumber}:`, error);
                    // 繼續下一個
                }
            }

            onBatchComplete(results);
        } catch (error) {
            console.error('Batch generation error:', error);
            alert(error instanceof Error ? error.message : '批次生成失敗');
        } finally {
            setIsGenerating(false);
        }
    };

    const completedCount = Array.from(statuses.values()).filter(s => s.status === 'completed').length;
    const failedCount = Array.from(statuses.values()).filter(s => s.status === 'failed').length;

    return (
        <div className="space-y-4">
            {/* 設定卡片 */}
            <div className="p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/30">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            批次生成
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">
                            為 {totalScenes} 個尚未生成的場景自動生成圖片
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            長寬比
                        </label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg
                       text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                        >
                            <option value="16:9">16:9 (橫向)</option>
                            <option value="9:16">9:16 (直向)</option>
                            <option value="1:1">1:1 (正方形)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            解析度
                        </label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as '1K' | '2K' | '4K')}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg
                       text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
                        >
                            <option value="1K">1K (快速)</option>
                            <option value="2K">2K (推薦)</option>
                            <option value="4K">4K (最高品質)</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleBatchGenerate}
                    disabled={isGenerating || totalScenes === 0}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 
                   hover:from-purple-700 hover:to-pink-700
                   text-white font-medium rounded-lg
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            生成中 ({completedCount}/{totalScenes})
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            開始批次生成
                        </>
                    )}
                </button>
            </div>

            {/* 進度列表 */}
            {statuses.size > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-zinc-300">生成進度</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {scenesWithoutImages.map(scene => {
                            const status = statuses.get(scene.id);
                            if (!status) return null;

                            return (
                                <div
                                    key={scene.id}
                                    className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800"
                                >
                                    <div className="flex-shrink-0">
                                        {status.status === 'pending' && (
                                            <div className="w-5 h-5 rounded-full bg-zinc-700" />
                                        )}
                                        {status.status === 'generating' && (
                                            <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                        )}
                                        {status.status === 'completed' && (
                                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                                        )}
                                        {status.status === 'failed' && (
                                            <AlertCircle className="w-5 h-5 text-red-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-zinc-200">
                                            場景 {scene.sceneNumber}
                                        </p>
                                        <p className="text-xs text-zinc-500 truncate">
                                            {scene.description}
                                        </p>
                                        {status.error && (
                                            <p className="text-xs text-red-400 mt-1">{status.error}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 統計 */}
                    <div className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-zinc-400">
                                完成: <span className="text-green-400 font-medium">{completedCount}</span>
                            </span>
                            {failedCount > 0 && (
                                <span className="text-zinc-400">
                                    失敗: <span className="text-red-400 font-medium">{failedCount}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-zinc-500">
                            {completedCount + failedCount} / {totalScenes}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
