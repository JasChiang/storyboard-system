'use client';

import { useState } from 'react';
import { Sparkles, Settings2 } from 'lucide-react';
import { ReferenceUploader } from './ReferenceUploader';
import { ImagePreview } from './ImagePreview';
import type { Scene } from '@/lib/types/storyboard';

interface ImageGeneratorProps {
    scene: Scene;
    onImageGenerated: (imageUrl: string, prompt: string) => void;
}

export function ImageGenerator({ scene, onImageGenerated }: ImageGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [referenceImage, setReferenceImage] = useState<string | null>(
        scene.referenceImage || null
    );
    const [aspectRatio, setAspectRatio] = useState<string>('16:9');
    const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
    const [customPrompt, setCustomPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // 構建圖片生成 prompt
    const buildImagePrompt = () => {
        const parts = [];

        if (customPrompt) {
            parts.push(customPrompt);
        } else {
            // 只使用靜態場景描述，不包含運鏡指令
            parts.push(scene.description);
        }

        // 如果有參考圖，加強保持外觀特徵的指令
        if (referenceImage) {
            parts.push('Maintain the exact appearance, facial features, clothing, and style from the reference image.');
            parts.push('保持參考圖中的外觀、面部特徵、服裝和風格。');
        }

        return parts.join(' ');
    };

    const handleGenerate = async () => {
        setIsGenerating(true);

        try {
            const prompt = buildImagePrompt();

            // 獲取 API Key
            const apiKey = localStorage.getItem('fal_api_key');
            if (!apiKey) {
                alert('請先在設定中輸入 Fal AI API Key');
                return;
            }

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    referenceImage,
                    aspectRatio,
                    resolution,
                    apiKey,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Generation failed');
            }

            // 輪詢檢查狀態 - 使用 API 回傳的 endpoint
            const requestId = data.request_id;
            const endpoint = data.endpoint; // 從後端回傳的正確 endpoint

            await pollStatus(requestId, endpoint, apiKey, prompt);
        } catch (error) {
            console.error('Generate error:', error);
            alert(error instanceof Error ? error.message : '生成失敗');
        } finally {
            setIsGenerating(false);
        }
    };

    const pollStatus = async (
        requestId: string,
        endpoint: string,
        apiKey: string,
        prompt: string
    ) => {
        const maxAttempts = 60; // 最多等 5 分鐘
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
                if (imageUrl) {
                    onImageGenerated(imageUrl, prompt);
                }
                return;
            } else if (data.status === 'FAILED') {
                throw new Error(data.error || 'Generation failed');
            }

            // 等待 5 秒後重試
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }

        throw new Error('Generation timeout');
    };

    return (
        <div className="space-y-4">
            {/* 場景資訊 */}
            <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-2">
                    場景 {scene.sceneNumber}
                </h3>
                <p className="text-sm text-zinc-400">{scene.description}</p>
                {scene.cameraMovement && scene.cameraMovement !== '無' && (
                    <p className="text-xs text-zinc-500 mt-1">
                        鏡頭運動: {scene.cameraMovement}
                    </p>
                )}
            </div>

            {/* 圖片預覽 */}
            <ImagePreview
                imageUrl={scene.generatedImage?.url || null}
                prompt={scene.generatedImage?.prompt}
                isLoading={isGenerating}
                onRegenerate={handleGenerate}
            />

            {/* 自訂 Prompt */}
            <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">
                    自訂提示詞 (選填)
                </label>
                <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="預設使用場景描述，也可自訂..."
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg
                   text-sm text-zinc-200 placeholder-zinc-600
                   focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                   transition-colors resize-none"
                    rows={3}
                    disabled={isGenerating}
                />
            </div>

            {/* 參考圖上傳 */}
            <ReferenceUploader
                value={referenceImage}
                onChange={setReferenceImage}
                disabled={isGenerating}
            />

            {/* 進階設定 */}
            <div className="space-y-3">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                    <Settings2 className="w-4 h-4" />
                    進階設定
                </button>

                {showAdvanced && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900/30 rounded-lg border border-zinc-800">
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
                                <option value="4:3">4:3</option>
                                <option value="3:4">3:4</option>
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
                )}
            </div>

            {/* 生成按鈕 */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 
                 hover:from-purple-700 hover:to-pink-700
                 text-white font-medium rounded-lg
                 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-all flex items-center justify-center gap-2"
            >
                {isGenerating ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        生成中...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        生成圖片
                    </>
                )}
            </button>
        </div>
    );
}
