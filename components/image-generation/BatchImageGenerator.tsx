'use client';

import { useState } from 'react';
import { Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Scene, ProjectReference, StyleProfile } from '@/lib/types/storyboard';
import { buildStaticFrameDescription } from '@/lib/prompts/image-static';
import { getSceneRelevantReferences } from '@/lib/references/scene-references';

interface BatchImageGeneratorProps {
    scenes: Scene[];
    projectReferences?: ProjectReference[];
    styleProfile?: StyleProfile;
    onBatchComplete: (results: Map<string, { url: string; prompt: string; endFrameUrl?: string; endFramePrompt?: string }>) => void;
}

interface GenerationStatus {
    sceneId: string;
    status: 'pending' | 'generating' | 'generating_end_frame' | 'completed' | 'failed';
    imageUrl?: string;
    prompt?: string;
    endFrameUrl?: string;
    endFramePrompt?: string;
    error?: string;
}

export function BatchImageGenerator({
    scenes,
    projectReferences = [],
    styleProfile,
    onBatchComplete
}: BatchImageGeneratorProps) {
    const contentProjectReferences = projectReferences.filter(ref => ref.type !== 'style');
    const styleProjectReferences = projectReferences.filter(ref => ref.type === 'style');
    const selectedStyleReferenceUrls = styleProfile?.styleReferenceIds?.length
        ? styleProjectReferences
            .filter(ref => styleProfile.styleReferenceIds!.includes(ref.id))
            .map(ref => ref.url)
        : styleProjectReferences.map(ref => ref.url);

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

    const buildImagePrompt = (scene: Scene, isEndFrame: boolean = false) => {
        const parts = [];
        const sceneScopedContentRefs = getSceneRelevantReferences(scene, contentProjectReferences);

        if (styleProfile?.stylePrompt) {
            parts.push(`Style direction: ${styleProfile.stylePrompt}`);
        }
        if (styleProfile?.negativePrompt) {
            parts.push(`Negative constraints: ${styleProfile.negativePrompt}`);
        }

        // 1. 加入專案參考圖的描述作為上下文
        if (selectedStyleReferenceUrls.length > 0) {
            parts.push('Style references:');
            styleProjectReferences
                .filter(ref => selectedStyleReferenceUrls.includes(ref.url))
                .forEach(ref => {
                    parts.push(`[style] ${ref.description}`);
                });
            parts.push('Preserve rendering style, texture language, color treatment, and lighting grammar from style references.');
        }

        if (sceneScopedContentRefs.length > 0) {
            parts.push('Content references:');
            sceneScopedContentRefs.forEach(ref => {
                const nameTag = ref.name ? `<${ref.name}>` : ref.type;
                parts.push(`${nameTag}: ${ref.description}`);
                if (ref.mustKeepFeatures?.length) {
                    parts.push(`${nameTag} must keep: ${ref.mustKeepFeatures.join(', ')}`);
                }
                if (ref.ipProfile?.immutableRules?.length) {
                    parts.push(`${nameTag} hard rules: ${ref.ipProfile.immutableRules.join('; ')}`);
                }
                if (ref.ipProfile) {
                    parts.push(
                        `${nameTag} policy: identity=${ref.ipProfile.strictIdentity ? 'strict' : 'flexible'}, accessories=${ref.ipProfile.allowAccessoryChanges ? 'allowed' : 'locked'}`
                    );
                }
            });
        }

        const hasLockVisibleText = sceneScopedContentRefs.some(
            (ref) => ref.ipProfile?.textLogoPolicy === 'lock_visible_text'
        );
        const hasForbidNewText = sceneScopedContentRefs.some(
            (ref) => ref.ipProfile?.textLogoPolicy === 'forbid_new_text'
        );
        if (hasLockVisibleText) {
            parts.push('If brand text or logos are visible, keep them exactly legible and unchanged in spelling, shape, and placement.');
        }
        if (hasForbidNewText) {
            parts.push('Do not invent any new letters, numbers, brand marks, or package text.');
        }

        // 2. 加入場景描述（首幀或尾幀）
        parts.push(
            buildStaticFrameDescription(
                scene.description,
                isEndFrame ? scene.endFrameDescription : scene.description,
                isEndFrame
            )
        );
        parts.push('Generate one static frame only. Do not describe camera movement or temporal progression.');

        if (scene.referenceImage || contentProjectReferences.length > 0) {
            parts.push('Maintain the exact appearance, facial features, clothing, and style from the uploaded reference image.');
            parts.push('保持參考圖中的外觀、面部特徵、服裝和風格。');
        }

        return parts.join('. ');
    };

    const generateSingleImage = async (
        scene: Scene,
        isEndFrame: boolean = false,
        options?: { primaryReferenceUrl?: string; continuityReferenceUrl?: string }
    ) => {
        const sceneScopedContentRefs = getSceneRelevantReferences(scene, contentProjectReferences);
        const prompt = [
            buildImagePrompt(scene, isEndFrame),
            isEndFrame && options?.primaryReferenceUrl
                ? 'Use the provided start frame as the primary continuity reference. Only apply the explicit end-frame delta.'
                : '',
            isEndFrame
                ? 'Return a final-state still frame composition, not an intermediate motion step.'
                : '',
            !isEndFrame && options?.continuityReferenceUrl
                ? 'This scene should continue naturally from the previous scene end frame while preserving identity.'
                : '',
        ].filter(Boolean).join('. ');

        // 呼叫生成 API
        const response = await fetch('/api/fal/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                referenceImage: [
                    ...(options?.continuityReferenceUrl ? [options.continuityReferenceUrl] : []),
                    ...(options?.primaryReferenceUrl ? [options.primaryReferenceUrl] : []),
                    ...selectedStyleReferenceUrls,
                    ...(scene.referenceImage ? [scene.referenceImage] : []),
                    ...sceneScopedContentRefs.map(r => r.url)
                ], // 結合場景個別參考圖與專案級參考圖
                aspectRatio,
                resolution,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Generation failed');
        }
        if (!data.endpoint) {
            throw new Error('Missing endpoint from server');
        }

        // 輪詢狀態 - 使用 API 回傳的 endpoint
        const requestId = data.request_id;
        const endpoint = data.endpoint;

        const imageUrl = await pollStatus(requestId, endpoint);

        return { url: imageUrl, prompt };
    };

    const generateSceneImages = async (scene: Scene, previousContinuationEndFrameUrl?: string) => {
        updateStatus(scene.id, { status: 'generating' });

        try {
            // 1. 生成首幀
            const startFrame = await generateSingleImage(scene, false, {
                continuityReferenceUrl: previousContinuationEndFrameUrl,
            });

            updateStatus(scene.id, {
                imageUrl: startFrame.url,
                prompt: startFrame.prompt,
            });

            // 2. 如果需要尾幀，繼續生成
            if (scene.requiresEndFrame && scene.endFrameDescription) {
                updateStatus(scene.id, { status: 'generating_end_frame' });

                const endFrame = await generateSingleImage(scene, true, {
                    primaryReferenceUrl: startFrame.url,
                });

                updateStatus(scene.id, {
                    status: 'completed',
                    endFrameUrl: endFrame.url,
                    endFramePrompt: endFrame.prompt,
                });

                return {
                    url: startFrame.url,
                    prompt: startFrame.prompt,
                    endFrameUrl: endFrame.url,
                    endFramePrompt: endFrame.prompt,
                };
            }

            // 3. 不需要尾幀，標記完成
            updateStatus(scene.id, { status: 'completed' });

            return {
                url: startFrame.url,
                prompt: startFrame.prompt,
            };
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
        endpoint: string
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

            const delayMs = Math.min(15000, 2000 * Math.pow(1.5, attempts));
            const jitter = Math.floor(delayMs * 0.2 * Math.random());
            await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
            attempts++;
        }

        throw new Error('Generation timeout');
    };

    const handleBatchGenerate = async () => {
        setIsGenerating(true);

        try {
            // 初始化狀態
            scenesWithoutImages.forEach(scene => {
                updateStatus(scene.id, { status: 'pending' });
            });

            const results = new Map<string, { url: string; prompt: string; endFrameUrl?: string; endFramePrompt?: string }>();

            // 依序生成（避免超過 API 限制）
            for (const scene of scenesWithoutImages) {
                try {
                    const sceneIndex = scenes.findIndex(s => s.id === scene.id);
                    const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
                    const previousResult = previousScene ? results.get(previousScene.id) : undefined;
                    const previousContinuationEndFrameUrl = previousScene?.transitionToNext?.useEndFrameAsNextStart
                        ? (previousResult?.endFrameUrl || previousScene.generatedEndFrame?.url)
                        : undefined;

                    const result = await generateSceneImages(scene, previousContinuationEndFrameUrl);
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
            <div className="p-4 bg-[#5F9EA0]/10 dark:bg-[#5F9EA0]/10 rounded-lg border border-[#5F9EA0]/30 dark:border-[#5F9EA0]/30 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                            批次生成
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            為 {totalScenes} 個尚未生成的場景自動生成圖片
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            長寬比
                        </label>
                        <select
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value)}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                       text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                        >
                            <option value="16:9">16:9 (橫向)</option>
                            <option value="9:16">9:16 (直向)</option>
                            <option value="1:1">1:1 (正方形)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            解析度
                        </label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value as '1K' | '2K' | '4K')}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                       text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
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
                    className="w-full py-3 px-4 bg-[#143A5A] hover:bg-[#143A5A]/90
                    text-white font-medium rounded-lg
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all flex items-center justify-center gap-2 shadow-sm"
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
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">生成進度</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {scenesWithoutImages.map(scene => {
                            const status = statuses.get(scene.id);
                            if (!status) return null;

                            return (
                                <div
                                    key={scene.id}
                                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
                                >
                                    <div className="flex-shrink-0">
                                        {status.status === 'pending' && (
                                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700" />
                                        )}
                                        {status.status === 'generating' && (
                                            <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-700 dark:border-t-blue-500 rounded-full animate-spin" />
                                        )}
                                        {status.status === 'generating_end_frame' && (
                                            <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-700 dark:border-t-purple-500 rounded-full animate-spin" />
                                        )}
                                        {status.status === 'completed' && (
                                            <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
                                        )}
                                        {status.status === 'failed' && (
                                            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                                場景 {scene.sceneNumber}
                                            </p>
                                            {scene.requiresEndFrame && (
                                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                                    首尾幀
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">
                                            {status.status === 'generating_end_frame' ? '生成尾幀中...' : scene.description}
                                        </p>
                                        {status.error && (
                                            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{status.error}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 統計 */}
                    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                                完成: <span className="text-green-600 dark:text-green-400 font-medium">{completedCount}</span>
                            </span>
                            {failedCount > 0 && (
                                <span className="text-slate-600 dark:text-slate-400">
                                    失敗: <span className="text-red-600 dark:text-red-400 font-medium">{failedCount}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-500">
                            {completedCount + failedCount} / {totalScenes}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
