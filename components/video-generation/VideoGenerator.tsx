'use client';

import { useState, useEffect } from 'react';
import { Film, Settings2 } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { MotionPromptEditor } from './MotionPromptEditor';
import { VideoPreview } from './VideoPreview';
import type { Scene } from '@/lib/types/storyboard';

type VideoModel = 'kling' | 'seedance';

interface VideoGeneratorProps {
    scene: Scene;
    onVideoGenerated: (videoUrl: string, prompt: string, model: VideoModel) => void;
}

export function VideoGenerator({ scene, onVideoGenerated }: VideoGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [model, setModel] = useState<VideoModel>('kling');
    // 優先使用 AI 生成的運鏡指令，如果沒有則使用已儲存的 motionPrompt
    const [motionPrompt, setMotionPrompt] = useState(
        scene.motionPrompt || scene.cameraMovement || ''
    );
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Kling 選項
    const [klingDuration, setKlingDuration] = useState<5 | 10>(5);
    const [klingAspectRatio, setKlingAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [klingEnableSound, setKlingEnableSound] = useState(false);

    // Seedance 選項
    const [seedanceDuration, setSeedanceDuration] = useState(5);
    const [seedanceAspectRatio, setSeedanceAspectRatio] = useState<'21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'>('16:9');
    const [seedanceResolution, setSeedanceResolution] = useState<'480p' | '720p' | '1080p'>('720p');
    const [seedanceEnableAudio, setSeedanceEnableAudio] = useState(false);

    // 當場景變化時，同步更新 motionPrompt
    useEffect(() => {
        const newMotionPrompt = scene.motionPrompt || scene.cameraMovement || '';
        setMotionPrompt(newMotionPrompt);
    }, [scene.id, scene.motionPrompt, scene.cameraMovement]);

    const handleGenerate = async () => {
        // 檢查是否有生成的圖片
        if (!scene.generatedImage?.url) {
            alert('請先生成場景圖片');
            return;
        }

        if (!motionPrompt.trim()) {
            alert('請輸入動作提示詞');
            return;
        }

        setIsGenerating(true);

        try {
            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: scene.generatedImage.url,
                    prompt: motionPrompt,
                    model,
                    duration: model === 'kling' ? klingDuration : seedanceDuration,
                    aspectRatio: model === 'kling' ? klingAspectRatio : seedanceAspectRatio,
                    resolution: model === 'seedance' ? seedanceResolution : undefined,
                    enableSound: model === 'kling' ? klingEnableSound : undefined,
                    enableAudio: model === 'seedance' ? seedanceEnableAudio : undefined,
                    endImageUrl: scene.generatedEndFrame?.url,  // 如果有尾幀，傳遞給 API
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Generation failed');
            }
            if (!data.endpoint) {
                throw new Error('Missing endpoint from server');
            }

            // 輪詢檢查狀態
            const requestId = data.request_id;
            const endpoint = data.endpoint;

            await pollStatus(requestId, endpoint);
        } catch (error) {
            console.error('Generate error:', error);
            alert(error instanceof Error ? error.message : '生成失敗');
        } finally {
            setIsGenerating(false);
        }
    };

    const pollStatus = async (
        requestId: string,
        endpoint: string
    ) => {
        const maxAttempts = 120; // 最多等 10 分鐘（影片生成較慢）
        let attempts = 0;

        while (attempts < maxAttempts) {
            const response = await fetch('/api/fal/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    endpoint,
                    type: 'video',
                }),
            });

            const data = await response.json();

            if (data.status === 'COMPLETED') {
                const videoUrl = data.result.video?.url;
                if (videoUrl) {
                    onVideoGenerated(videoUrl, motionPrompt, model);
                }
                return;
            } else if (data.status === 'FAILED') {
                throw new Error(data.error || 'Generation failed');
            }

            const delayMs = Math.min(20000, 3000 * Math.pow(1.5, attempts));
            const jitter = Math.floor(delayMs * 0.2 * Math.random());
            await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
            attempts++;
        }

        throw new Error('Generation timeout');
    };

    return (
        <div className="space-y-4">
            {/* 場景資訊 */}
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                <div>
                    <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                        場景 {scene.sceneNumber}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{scene.description}</p>
                </div>

                {/* 首幀 */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">首幀 (Start Frame)</h4>
                        {scene.requiresEndFrame && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                首尾幀模式
                            </span>
                        )}
                    </div>
                    {scene.generatedImage ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                            <img
                                src={scene.generatedImage.url}
                                alt={`Scene ${scene.sceneNumber}`}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 px-2 py-1 bg-green-500/90 text-white text-xs rounded shadow-sm">
                                已生成
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700
                            flex items-center justify-center">
                            <p className="text-sm text-slate-500 dark:text-slate-500">尚未生成首幀</p>
                        </div>
                    )}
                </div>

                {/* 尾幀（如果存在） */}
                {scene.generatedEndFrame && (
                    <div className="space-y-2 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-purple-600 dark:bg-purple-400 rounded-full"></div>
                            <h4 className="text-xs font-medium text-purple-700 dark:text-purple-300">尾幀 (End Frame)</h4>
                        </div>
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-purple-300 dark:border-purple-700">
                            <img
                                src={scene.generatedEndFrame.url}
                                alt={`Scene ${scene.sceneNumber} End Frame`}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2 px-2 py-1 bg-purple-500/90 text-white text-xs rounded shadow-sm">
                                已生成
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 影片預覽 */}
            <VideoPreview
                videoUrl={scene.generatedVideo?.url || null}
                prompt={scene.generatedVideo?.prompt}
                model={scene.generatedVideo?.model}
                isLoading={isGenerating}
                onRegenerate={handleGenerate}
            />

            {/* 模型選擇 */}
            <ModelSelector
                value={model}
                onChange={setModel}
                disabled={isGenerating}
            />

            {/* 動作提示詞 */}
            <MotionPromptEditor
                value={motionPrompt}
                onChange={setMotionPrompt}
                disabled={isGenerating}
                sceneDescription={scene.description}
            />

            {/* 進階設定 */}
            <div className="space-y-3">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                >
                    <Settings2 className="w-4 h-4" />
                    進階設定
                </button>

                {showAdvanced && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
                        {model === 'kling' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            影片長度
                                        </label>
                                        <select
                                            value={klingDuration}
                                            onChange={(e) => setKlingDuration(Number(e.target.value) as 5 | 10)}
                                            disabled={isGenerating}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                               text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                                        >
                                            <option value={5}>5 秒</option>
                                            <option value={10}>10 秒</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            長寬比
                                        </label>
                                        <select
                                            value={klingAspectRatio}
                                            onChange={(e) => setKlingAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                                            disabled={isGenerating}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                               text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                                        >
                                            <option value="16:9">16:9 (橫向)</option>
                                            <option value="9:16">9:16 (直向)</option>
                                            <option value="1:1">1:1 (正方形)</option>
                                        </select>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={klingEnableSound}
                                        onChange={(e) => setKlingEnableSound(e.target.checked)}
                                        disabled={isGenerating}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900
                             text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">啟用音效</span>
                                </label>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            長寬比
                                        </label>
                                        <select
                                            value={seedanceAspectRatio}
                                            onChange={(e) => setSeedanceAspectRatio(e.target.value as '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16')}
                                            disabled={isGenerating}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                               text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                                        >
                                            <option value="21:9">21:9 (電影)</option>
                                            <option value="16:9">16:9 (橫向)</option>
                                            <option value="4:3">4:3 (傳統)</option>
                                            <option value="1:1">1:1 (正方形)</option>
                                            <option value="3:4">3:4 (直向)</option>
                                            <option value="9:16">9:16 (直向全螢幕)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            解析度
                                        </label>
                                        <select
                                            value={seedanceResolution}
                                            onChange={(e) => setSeedanceResolution(e.target.value as '480p' | '720p' | '1080p')}
                                            disabled={isGenerating}
                                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                               text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                                        >
                                            <option value="480p">480p (快速)</option>
                                            <option value="720p">720p (平衡)</option>
                                            <option value="1080p">1080p (高畫質)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        影片長度 (4-12 秒)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={4}
                                            max={12}
                                            value={seedanceDuration}
                                            onChange={(e) => setSeedanceDuration(Number(e.target.value))}
                                            disabled={isGenerating}
                                            className="flex-1"
                                        />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 w-12 text-right">
                                            {seedanceDuration} 秒
                                        </span>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={seedanceEnableAudio}
                                        onChange={(e) => setSeedanceEnableAudio(e.target.checked)}
                                        disabled={isGenerating}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900
                             text-blue-600 focus:ring-blue-600 focus:ring-offset-0"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">啟用音訊</span>
                                </label>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* 生成按鈕 */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating || !scene.generatedImage}
                className="w-full py-3 px-4 bg-[#143A5A] hover:bg-[#143A5A]/90 
                 text-white font-medium rounded-lg
                 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
                {isGenerating ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        生成中...
                    </>
                ) : (
                    <>
                        <Film className="w-5 h-5" />
                        生成影片
                    </>
                )}
            </button>

            {!scene.generatedImage && (
                <p className="text-xs text-center text-amber-600 dark:text-amber-400">
                    ⚠️ 請先在「圖片」頁面生成場景圖片
                </p>
            )}
        </div>
    );
}
