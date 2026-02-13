'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Settings2 } from 'lucide-react';
import { ReferenceUploader } from './ReferenceUploader';
import { ImagePreview } from './ImagePreview';
import type { Scene, ProjectReference, StyleProfile } from '@/lib/types/storyboard';
import { buildStaticFrameDescription, sanitizeStaticFrameDescription } from '@/lib/prompts/image-static';
import { getSceneRelevantReferences } from '@/lib/references/scene-references';

interface ImageGeneratorProps {
    scene: Scene;
    onImageGenerated: (imageUrl: string, prompt: string, endFrameUrl?: string, endFramePrompt?: string) => void;
    projectReferences?: ProjectReference[];
    styleProfile?: StyleProfile;
    previousEndFrameUrl?: string;
}

export function ImageGenerator({
    scene,
    onImageGenerated,
    projectReferences = [],
    styleProfile,
    previousEndFrameUrl,
}: ImageGeneratorProps) {
    const contentProjectReferences = projectReferences.filter(ref => ref.type !== 'style');
    const styleProjectReferences = projectReferences.filter(ref => ref.type === 'style');
    const [isGeneratingStart, setIsGeneratingStart] = useState(false);
    const [isGeneratingEnd, setIsGeneratingEnd] = useState(false);
    const [referenceImage, setReferenceImage] = useState<string | null>(
        scene.referenceImage || null
    );
    const [aspectRatio, setAspectRatio] = useState<string>('16:9');
    const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptMode, setPromptMode] = useState<'append' | 'replace' | 'prepend'>('append');
    const [showAdvanced, setShowAdvanced] = useState(false);
    // 專案參考圖選擇狀態
    const [selectedProjectRefs, setSelectedProjectRefs] = useState<string[]>(
        contentProjectReferences.map(r => r.id)  // 預設全選（不含 style refs）
    );

    const selectedStyleReferenceUrls = styleProfile?.styleReferenceIds?.length
        ? styleProjectReferences
            .filter(ref => styleProfile.styleReferenceIds!.includes(ref.id))
            .map(ref => ref.url)
        : styleProjectReferences.map(ref => ref.url);
    const selectedContentRefs = contentProjectReferences.filter(ref => selectedProjectRefs.includes(ref.id));
    const sceneScopedContentRefs = getSceneRelevantReferences(scene, selectedContentRefs);
    const scenePreferredAspectRatio = useMemo(() => {
        const withDefault = sceneScopedContentRefs.find((ref) => ref.ipProfile?.generationDefaults?.preferredOutputAspectRatio);
        return withDefault?.ipProfile?.generationDefaults?.preferredOutputAspectRatio;
    }, [sceneScopedContentRefs]);

    useEffect(() => {
        if (scenePreferredAspectRatio) {
            setAspectRatio(scenePreferredAspectRatio);
        } else {
            setAspectRatio('16:9');
        }
    }, [scene.id, scenePreferredAspectRatio]);

    // 取得選中的專案參考圖 URL
    const getSelectedReferenceUrls = (options?: { includeStartFrameForEnd?: boolean; includePreviousSceneEnd?: boolean }): string[] => {
        const urls: string[] = [];
        if (options?.includePreviousSceneEnd && previousEndFrameUrl) {
            urls.push(previousEndFrameUrl);
        }
        if (options?.includeStartFrameForEnd && scene.generatedImage?.url) {
            urls.push(scene.generatedImage.url);
        }
        urls.push(...selectedStyleReferenceUrls);
        sceneScopedContentRefs.forEach(ref => urls.push(ref.url));
        if (referenceImage) {
            urls.push(referenceImage);
        }
        return urls;
    };

    // 構建圖片生成 prompt（支援首幀/尾幀）
    const buildImagePrompt = (isEndFrame: boolean = false) => {
        const parts = [];

        if (styleProfile?.stylePrompt) {
            parts.push(`Style direction: ${styleProfile.stylePrompt}`);
        }
        if (styleProfile?.negativePrompt) {
            parts.push(`Negative constraints: ${styleProfile.negativePrompt}`);
        }

        // 1. 加入專案參考圖的描述作為上下文
        const selectedStyleRefs = styleProjectReferences.filter((ref) =>
            selectedStyleReferenceUrls.includes(ref.url)
        );
        if (selectedStyleRefs.length > 0) {
            parts.push('Style references:');
            selectedStyleRefs.forEach(ref => {
                parts.push(`[style] ${ref.description}`);
            });
            parts.push('Preserve rendering style, texture language, color treatment, and lighting grammar from style references.');
        }

        if (selectedProjectRefs.length > 0) {
            if (sceneScopedContentRefs.length > 0) {
                parts.push('Content references:');
                sceneScopedContentRefs.forEach(ref => {
                    const nameTag = ref.name ? `<${ref.name}>` : ref.type;
                    const guidelineText = ref.guidelines ? ` (Rules: ${ref.guidelines})` : '';
                    parts.push(`${nameTag}: ${ref.description}${guidelineText}`);
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
                if (selectedContentRefs.length > sceneScopedContentRefs.length) {
                    parts.push('Ignore non-tagged references for this shot; keep only the scene-mentioned identities.');
                }
            }
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

        // 2. 選擇正確的描述（首幀或尾幀）
        const sceneDescription = buildStaticFrameDescription(
            scene.description,
            isEndFrame ? scene.endFrameDescription : scene.description,
            isEndFrame
        );

        // 3. 加入主要場景描述和自訂提示詞
        if (!customPrompt) {
            // 沒有自訂內容，直接使用場景描述
            parts.push(sceneDescription);
        } else {
            // 有自訂內容，根據模式處理
            switch (promptMode) {
                case 'replace':
                    // 只使用自訂內容
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    break;

                case 'append':
                    // 場景描述 + 自訂內容
                    parts.push(sceneDescription);
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    break;

                case 'prepend':
                    // 自訂內容 + 場景描述
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    parts.push(sceneDescription);
                    break;
            }
        }

        parts.push('Generate one static frame only. Do not describe camera movement or temporal progression.');

        // 4. 如果有場景參考圖，加強保持外觀特徵的指令
        if (referenceImage || selectedProjectRefs.length > 0) {
            parts.push('Maintain the exact appearance, facial features, clothing, and style from the uploaded reference image.');
            parts.push('保持參考圖中的外觀、面部特徵、服裝和風格。');
        }
        if (isEndFrame && scene.generatedImage?.url) {
            parts.push('Use the generated start frame as the primary continuity reference.');
            parts.push('Only change what is explicitly described in the end-frame delta; keep identity, product geometry, logo placement, and material characteristics unchanged.');
            parts.push('Return a final-state still frame composition, not a transition process.');
        }
        if (!isEndFrame && previousEndFrameUrl) {
            parts.push('This scene continues from the previous scene end frame.');
            parts.push('Keep subject identity and key object consistency while updating only composition and action as described.');
        }

        return parts.join('. ');
    };

    // 取得模式說明
    const getModeDescription = () => {
        switch (promptMode) {
            case 'append':
                return '場景描述 + 自訂內容（適合微調細節）';
            case 'replace':
                return '只使用自訂內容（完全重新定義）';
            case 'prepend':
                return '自訂內容 + 場景描述（強調重點）';
        }
    };

    // 取得佔位符提示
    const getPlaceholder = () => {
        switch (promptMode) {
            case 'append':
                return '例如：高品質產品攝影, 柔和側光, 8K 解析度';
            case 'replace':
                return '例如：A futuristic smartphone floating in space, neon lighting';
            case 'prepend':
                return '例如：Cinematic style, dramatic lighting, professional photography';
        }
    };

    const handleGenerate = async (isEndFrame: boolean = false) => {
        if (isEndFrame) {
            setIsGeneratingEnd(true);
        } else {
            setIsGeneratingStart(true);
        }

        try {
            const prompt = buildImagePrompt(isEndFrame);

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    referenceImage: getSelectedReferenceUrls({
                        includeStartFrameForEnd: isEndFrame,
                        includePreviousSceneEnd: !isEndFrame,
                    }), // 傳送所有選取的參考圖 URL
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

            // 輪詢檢查狀態 - 使用 API 回傳的 endpoint
            const requestId = data.request_id;
            const endpoint = data.endpoint; // 從後端回傳的正確 endpoint

            await pollStatus(requestId, endpoint, prompt, isEndFrame);
        } catch (error) {
            console.error('Generate error:', error);
            alert(error instanceof Error ? error.message : '生成失敗');
        } finally {
            if (isEndFrame) {
                setIsGeneratingEnd(false);
            } else {
                setIsGeneratingStart(false);
            }
        }
    };

    const pollStatus = async (
        requestId: string,
        endpoint: string,
        prompt: string,
        isEndFrame: boolean = false
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
                }),
            });

            const data = await response.json();

            if (data.status === 'COMPLETED') {
                const imageUrl = data.result.images[0]?.url;
                if (imageUrl) {
                    // 如果是尾幀，保留現有的首幀資訊
                    if (isEndFrame) {
                        onImageGenerated(
                            scene.generatedImage?.url || '',
                            scene.generatedImage?.prompt || '',
                            imageUrl,
                            prompt
                        );
                    } else {
                        // 如果是首幀，保留現有的尾幀資訊
                        onImageGenerated(
                            imageUrl,
                            prompt,
                            scene.generatedEndFrame?.url,
                            scene.generatedEndFrame?.prompt
                        );
                    }
                }
                return;
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

    return (
        <div className="space-y-4">
            {/* 場景資訊 */}
            <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">
                    場景 {scene.sceneNumber}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{scene.description}</p>
                {scene.cameraMovement && scene.cameraMovement !== '無' && (
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        鏡頭運動: {scene.cameraMovement}
                    </p>
                )}
            </div>

            {/* 首幀預覽 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">首幀 (Start Frame)</h4>
                    {scene.requiresEndFrame && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                            需要尾幀
                        </span>
                    )}
                </div>
                <ImagePreview
                    imageUrl={scene.generatedImage?.url || null}
                    prompt={scene.generatedImage?.prompt}
                    isLoading={isGeneratingStart}
                    onRegenerate={() => handleGenerate(false)}
                />
            </div>

            {/* 尾幀預覽（如果需要） */}
            {scene.requiresEndFrame && scene.endFrameDescription && (
                <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full"></div>
                        <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300">尾幀 (End Frame)</h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        {scene.endFrameDescription}
                    </p>
                    <ImagePreview
                        imageUrl={scene.generatedEndFrame?.url || null}
                        prompt={scene.generatedEndFrame?.prompt}
                        isLoading={isGeneratingEnd}
                        onRegenerate={() => handleGenerate(true)}
                    />
                </div>
            )}

            {/* 自訂提示詞區塊 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        自訂提示詞 (選填)
                    </label>

                    {/* 模式選擇 */}
                    <div className="relative">
                        <select
                            value={promptMode}
                            onChange={(e) => setPromptMode(e.target.value as 'append' | 'replace' | 'prepend')}
                            disabled={(isGeneratingStart || isGeneratingEnd) || !customPrompt}
                            className="appearance-none pl-3 pr-8 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                                     text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600
                                     disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <option value="append">增強模式</option>
                            <option value="replace">覆蓋模式</option>
                            <option value="prepend">優先模式</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 模式說明 */}
                {customPrompt && (
                    <div className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {getModeDescription()}
                        </p>
                    </div>
                )}

                <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={getPlaceholder()}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg
                   text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400
                   focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600
                   transition-colors resize-none"
                    rows={3}
                    disabled={isGeneratingStart || isGeneratingEnd}
                />

                {/* 即時預覽最終 Prompt */}
                {customPrompt && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <label className="text-xs text-blue-600 dark:text-blue-300 font-medium block mb-1">
                            最終提示詞預覽：
                        </label>
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                            &quot;{buildImagePrompt()}&quot;
                        </p>
                    </div>
                )}
            </div>

            {/* 專案參考圖（來自分鏡階段） */}
            {styleProjectReferences.length > 0 && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        風格參考圖（自動套用）
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {styleProjectReferences.map((ref) => {
                            const isActive = selectedStyleReferenceUrls.includes(ref.url);
                            return (
                                <div
                                    key={ref.id}
                                    className={`
                                        relative rounded-lg overflow-hidden border-2
                                        ${isActive
                                            ? 'border-emerald-600'
                                            : 'border-slate-200 dark:border-slate-700 opacity-60'
                                        }
                                    `}
                                >
                                    <img
                                        src={ref.url}
                                        alt={ref.description}
                                        className="w-full h-16 object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/70">
                                        <p className="text-[10px] text-white truncate">
                                            {ref.name ? `<${ref.name}>` : 'style'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500">
                        套用中：{selectedStyleReferenceUrls.length}/{styleProjectReferences.length} 張
                    </p>
                </div>
            )}

            {contentProjectReferences.length > 0 && (
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        內容參考圖
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {contentProjectReferences.map((ref) => (
                            <button
                                key={ref.id}
                                onClick={() => {
                                    if (selectedProjectRefs.includes(ref.id)) {
                                        setSelectedProjectRefs(prev => prev.filter(id => id !== ref.id));
                                    } else {
                                        setSelectedProjectRefs(prev => [...prev, ref.id]);
                                    }
                                }}
                                disabled={isGeneratingStart || isGeneratingEnd}
                                className={`
                                    relative rounded-lg overflow-hidden border-2 transition-all
                                    ${selectedProjectRefs.includes(ref.id)
                                        ? 'border-blue-600 ring-2 ring-blue-600/30'
                                        : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-80'
                                    }
                                    disabled:cursor-not-allowed shadow-sm
                                `}
                            >
                                <img
                                    src={ref.url}
                                    alt={ref.description}
                                    className="w-full h-16 object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/70">
                                    <p className="text-[10px] text-white truncate">
                                        {ref.name ? `<${ref.name}>` : ref.type}
                                    </p>
                                </div>
                                {selectedProjectRefs.includes(ref.id) && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-[10px]">✓</span>
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500">
                        點擊選擇/取消要使用的參考圖（已選 {selectedProjectRefs.length}/{contentProjectReferences.length}）
                    </p>
                </div>
            )}

            {/* 額外參考圖上傳 */}
            <ReferenceUploader
                value={referenceImage}
                onChange={setReferenceImage}
                disabled={isGeneratingStart || isGeneratingEnd}
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
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                長寬比
                            </label>
                            <select
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                disabled={isGeneratingStart || isGeneratingEnd}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                         text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                            >
                                <option value="16:9">16:9 (橫向)</option>
                                <option value="9:16">9:16 (直向)</option>
                                <option value="1:1">1:1 (正方形)</option>
                                <option value="4:3">4:3</option>
                                <option value="3:4">3:4</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                解析度
                            </label>
                            <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value as '1K' | '2K' | '4K')}
                                disabled={isGeneratingStart || isGeneratingEnd}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                         text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
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
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => handleGenerate(false)}
                    disabled={isGeneratingStart || isGeneratingEnd}
                    className="py-3 px-4 bg-blue-600 hover:bg-blue-700
                     text-white font-medium rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                    {isGeneratingStart ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            生成中...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            生成首幀
                        </>
                    )}
                </button>

                {scene.requiresEndFrame && scene.endFrameDescription && (
                    <button
                        onClick={() => handleGenerate(true)}
                        disabled={isGeneratingStart || isGeneratingEnd}
                        className="py-3 px-4 bg-purple-600 hover:bg-purple-700
                         text-white font-medium rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isGeneratingEnd ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                生成尾幀
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
