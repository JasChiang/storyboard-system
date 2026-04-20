'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Settings2 } from 'lucide-react';
import { ReferenceUploader } from './ReferenceUploader';
import { ImagePreview } from './ImagePreview';
import { Button } from '@/components/ui/button';
import type { Scene, ProjectReference, StyleProfile, SharedContinuityDirective } from '@/lib/types/storyboard';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';
import { buildImageGenerationPrompt } from '@/lib/prompts/image-prompt';
import { getReferenceTag, getSceneRequiredTags } from '@/lib/references/scene-references';
import { splitSceneReferencesByPriority } from '@/lib/references/reference-routing';
import { buildPrioritizedReferenceUrls } from '@/lib/references/reference-priority';
import { IMAGE_GENERATION_MODEL_LABELS, type ImageGenerationModel } from '@/lib/constants/image-models';
import { formatBlockersForAlert, getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

function areStringArraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

interface ImageGeneratorProps {
    projectId: string;
    scene: Scene;
    onImageGenerated: (
        imageUrl: string,
        prompt: string,
        endFrameUrl?: string,
        endFramePrompt?: string,
        startSeed?: number,
        endFrameSeed?: number
    ) => void;
    onEndFrameDescriptionChanged?: (description: string, enabled: boolean) => void;
    projectReferences?: ProjectReference[];
    allScenes?: Scene[];
    styleProfile?: StyleProfile;
    previousEndFrameUrl?: string;
    previousContinuationSource?: 'end' | 'start';
    previousSceneDescription?: string;
    nextSceneDescription?: string;
    externalGeneratingStart?: boolean;
    externalGeneratingEnd?: boolean;
    sharedAnchors?: string[];
    sharedContinuityDirectives?: SharedContinuityDirective[];
}

export function ImageGenerator({
    projectId,
    scene,
    onImageGenerated,
    onEndFrameDescriptionChanged,
    projectReferences = [],
    allScenes = [],
    styleProfile,
    previousEndFrameUrl,
    previousContinuationSource,
    previousSceneDescription,
    nextSceneDescription,
    externalGeneratingStart = false,
    externalGeneratingEnd = false,
    sharedAnchors = [],
    sharedContinuityDirectives = [],
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
    const [imageModel, setImageModel] = useState<ImageGenerationModel>('nano-banana-pro');
    const [seedMode, setSeedMode] = useState<'auto' | 'fixed' | 'end_from_start'>('end_from_start');
    const [manualSeedInput, setManualSeedInput] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptMode, setPromptMode] = useState<'append' | 'replace' | 'prepend'>('append');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isComposingEndFramePrompt, setIsComposingEndFramePrompt] = useState(false);
    const [aiEndFrameNotes, setAiEndFrameNotes] = useState('');
    const [manualEndFrameEnabled, setManualEndFrameEnabled] = useState<boolean>(
        !!scene.generatedEndFrame?.url || (!scene.requiresEndFrame && !!scene.endFrameDescription)
    );
    const [manualEndFrameDescription, setManualEndFrameDescription] = useState<string>(
        !scene.requiresEndFrame && scene.endFrameDescription ? scene.endFrameDescription : ''
    );
    // 專案參考圖選擇狀態
    const [selectedProjectRefs, setSelectedProjectRefs] = useState<string[]>([]);

    const selectedStyleReferenceUrls = styleProfile?.styleReferenceIds?.length
        ? styleProjectReferences
            .filter(ref => styleProfile.styleReferenceIds!.includes(ref.id))
            .map(ref => ref.url)
        : styleProjectReferences.map(ref => ref.url);
    const sceneCharactersKey = (scene.charactersUsed || []).join('|');
    const sceneProductsKey = (scene.productsUsed || []).join('|');
    const sceneRequiredRefsKey = (scene.requiredReferences || []).join('|');
    const sceneReferenceHintsKey = JSON.stringify(scene.referenceViewHints || {});
    const sceneReferenceScope = useMemo(() => ({
        description: scene.description,
        cameraMovement: scene.cameraMovement,
        shotIntent: scene.shotIntent,
        startComposition: scene.startComposition,
        viewIntent: scene.viewIntent,
        referenceViewHints: scene.referenceViewHints,
        referencePlan: scene.referencePlan,
        charactersUsed: scene.charactersUsed || [],
        productsUsed: scene.productsUsed || [],
        requiredReferences: scene.requiredReferences || [],
    }), [
        scene.description,
        scene.cameraMovement,
        scene.shotIntent,
        scene.startComposition,
        scene.viewIntent,
        scene.referenceViewHints,
        scene.referencePlan,
        scene.charactersUsed,
        scene.productsUsed,
        scene.requiredReferences,
    ]);
    const requiredReferenceTags = useMemo(
        () => getSceneRequiredTags({ requiredReferences: scene.requiredReferences || [] }),
        [scene.requiredReferences]
    );
    const requiredProjectRefIds = useMemo(() => {
        if (requiredReferenceTags.size === 0) return new Set<string>();
        const ids = contentProjectReferences
            .filter((ref) => {
                const tag = getReferenceTag(ref);
                return tag ? requiredReferenceTags.has(tag) : false;
            })
            .map((ref) => ref.id);
        return new Set(ids);
    }, [contentProjectReferences, requiredReferenceTags]);
    const selectedContentRefs = contentProjectReferences.filter(ref => selectedProjectRefs.includes(ref.id));
    const routedSceneRefs = splitSceneReferencesByPriority(sceneReferenceScope, selectedContentRefs, {
        fallbackPolicy: 'all_selected',
    });
    const sceneScopedContentRefs = routedSceneRefs.all;
    const sceneViewIntent = routedSceneRefs.viewIntent;
    const requiredScopedRefs = sceneScopedContentRefs.filter((ref) => requiredProjectRefIds.has(ref.id));
    const continuityMemoryLines = useMemo(
        () => buildContinuityMemoryLines(scene, allScenes, {
            stage: 'image_start',
            sharedAnchors,
            sharedContinuityDirectives,
        }),
        [allScenes, scene, sharedAnchors, sharedContinuityDirectives]
    );
    const scenePreferredAspectRatio = useMemo(() => {
        const withDefault = sceneScopedContentRefs.find((ref) => ref.ipProfile?.generationDefaults?.preferredOutputAspectRatio);
        return withDefault?.ipProfile?.generationDefaults?.preferredOutputAspectRatio;
    }, [sceneScopedContentRefs]);

    useEffect(() => {
        const requiredOnly = contentProjectReferences
            .filter((ref) => requiredProjectRefIds.has(ref.id))
            .map((ref) => ref.id);

        const sceneMatched = splitSceneReferencesByPriority(
            sceneReferenceScope,
            contentProjectReferences,
            { fallbackPolicy: 'non_environment' }
        );
        const sceneMatchedIds = [...sceneMatched.primary, ...sceneMatched.secondary].map((ref) => ref.id);
        const recommended = Array.from(new Set([...sceneMatchedIds, ...requiredOnly]));
        if (recommended.length > 0) {
            setSelectedProjectRefs((prev) => (areStringArraysEqual(prev, recommended) ? prev : recommended));
            return;
        }

        const fallback = contentProjectReferences[0]?.id ? [contentProjectReferences[0].id] : [];
        setSelectedProjectRefs((prev) => (areStringArraysEqual(prev, fallback) ? prev : fallback));
    }, [
        contentProjectReferences,
        requiredProjectRefIds,
        sceneReferenceScope,
        scene.id,
        sceneCharactersKey,
        sceneProductsKey,
        sceneRequiredRefsKey,
        sceneReferenceHintsKey,
    ]);

    useEffect(() => {
        if (scenePreferredAspectRatio) {
            setAspectRatio(scenePreferredAspectRatio);
        } else {
            setAspectRatio('16:9');
        }
    }, [scene.id, scenePreferredAspectRatio]);

    useEffect(() => {
        setAiEndFrameNotes('');
        setManualEndFrameEnabled(
            !!scene.generatedEndFrame?.url || (!scene.requiresEndFrame && !!scene.endFrameDescription)
        );
        setManualEndFrameDescription(
            !scene.requiresEndFrame && scene.endFrameDescription ? scene.endFrameDescription : ''
        );
    }, [scene.id, scene.generatedEndFrame?.url, scene.requiresEndFrame, scene.endFrameDescription]);

    const shouldUseEndFrame = scene.requiresEndFrame || manualEndFrameEnabled;
    const hasContinuationStart = Boolean(previousEndFrameUrl);
    const effectiveStartFrameUrl = previousEndFrameUrl || scene.generatedImage?.url;
    const startGenerationLoading = isGeneratingStart || externalGeneratingStart;
    const endGenerationLoading = isGeneratingEnd || externalGeneratingEnd;
    const isAnyGenerationLoading = startGenerationLoading || endGenerationLoading;
    const startFrameBlockers = useMemo(
        () => getSceneGenerationBlockers({
            stage: 'image_start',
            scene,
            projectReferences,
        }),
        [projectReferences, scene]
    );
    const endFrameBlockers = useMemo(
        () => getSceneGenerationBlockers({
            stage: 'image_end',
            scene,
            projectReferences,
            effectiveStartFrameUrl,
        }),
        [effectiveStartFrameUrl, projectReferences, scene]
    );

    // 取得選中的專案參考圖 URL（以 UI 勾選結果為唯一真實來源）
    const getSelectedReferenceUrls = (options?: { includeStartFrameForEnd?: boolean; includePreviousSceneContinuation?: boolean }): string[] => {
        const selectedRoutedRefs = splitSceneReferencesByPriority(sceneReferenceScope, selectedContentRefs, {
            fallbackPolicy: 'all_selected',
        });
        const selectedPrimaryRefs = selectedRoutedRefs.primary;
        const selectedSecondaryRefs = selectedRoutedRefs.secondary;
        const hasAnyContentRefs = selectedPrimaryRefs.length > 0 || selectedSecondaryRefs.length > 0;
        return buildPrioritizedReferenceUrls({
            model: imageModel,
            stage: options?.includeStartFrameForEnd ? 'image_end' : 'image_start',
            priorityMode: scene.referencePriorityByStage?.[options?.includeStartFrameForEnd ? 'image_end' : 'image_start'] || scene.referencePriorityMode,
            continuityReferenceUrl: options?.includePreviousSceneContinuation ? previousEndFrameUrl : undefined,
            startFrameReferenceUrl: options?.includeStartFrameForEnd
                ? (previousEndFrameUrl || scene.generatedImage?.url)
                : undefined,
            sceneReferenceUrl: referenceImage,
            requiredContentRefs: selectedPrimaryRefs,
            optionalContentRefs: selectedSecondaryRefs,
            styleReferenceUrls: selectedStyleReferenceUrls,
            prioritizeContentRefs: !options?.includeStartFrameForEnd,
            strictRequiredOnlyWhenPresent: false,
            includeStyleReferenceImages: !hasAnyContentRefs,
        });
    };

    // 構建圖片生成 prompt（支援首幀/尾幀）
    const buildImagePrompt = (isEndFrame: boolean = false) => {
        const effectiveEndFrameDescription =
            scene.endFrameDescription
            || manualEndFrameDescription
            || scene.description;
        const effectiveEndFrameDelta = scene.endFrameDelta || manualEndFrameDescription || '';

        const selectedStyleRefs = styleProjectReferences.filter((ref) =>
            selectedStyleReferenceUrls.includes(ref.url)
        );

        return buildImageGenerationPrompt({
            scene: {
                ...scene,
                endFrameDescription: effectiveEndFrameDescription,
                endFrameDelta: effectiveEndFrameDelta,
            },
            isEndFrame,
            hasStartFrame: !!(isEndFrame && scene.generatedImage?.url),
            customPrompt: customPrompt || undefined,
            promptMode,
            contentRefs: sceneScopedContentRefs,
            styleRefs: selectedStyleRefs,
            styleProfile,
            continuityMemoryLines,
            hasPreviousEndFrame: !!previousEndFrameUrl,
        });
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

    const getRequestedSeed = (isEndFrame: boolean): number | undefined => {
        if (seedMode === 'fixed') {
            const parsed = Number.parseInt(manualSeedInput.trim(), 10);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
        if (seedMode === 'end_from_start' && isEndFrame) {
            return scene.generatedImage?.seed;
        }
        return undefined;
    };

    const updateTaskStatus = async (taskId: string, updates: Record<string, unknown>) => {
        try {
            await fetch(`/api/workflow/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
        } catch (error) {
            console.error('Failed to update generation task', error);
        }
    };

    const handleGenerate = async (isEndFrame: boolean = false) => {
        if (isAnyGenerationLoading) {
            return;
        }
        const blockers = isEndFrame ? endFrameBlockers : startFrameBlockers;
        if (blockers.length > 0) {
            alert(`無法生成${isEndFrame ? '尾幀' : '首幀'}：\n${formatBlockersForAlert(blockers)}`);
            return;
        }

        if (isEndFrame && !effectiveStartFrameUrl) {
            alert('請先生成首幀，再生成尾幀');
            return;
        }

        const shouldReuseContinuationStart = !isEndFrame && hasContinuationStart && previousEndFrameUrl && !scene.generatedImage?.url;
        if (shouldReuseContinuationStart) {
            const reusedPrompt = `${buildImagePrompt(false)}. Start frame reused from previous scene ${previousContinuationSource === 'start' ? 'start frame' : 'end frame'} due to continuation transition.`;
            onImageGenerated(
                previousEndFrameUrl,
                reusedPrompt,
                scene.generatedEndFrame?.url,
                scene.generatedEndFrame?.prompt,
                scene.generatedImage?.seed,
                scene.generatedEndFrame?.seed
            );
            return;
        }

        let taskId: string | null = null;

        if (isEndFrame) {
            setIsGeneratingEnd(true);
        } else {
            setIsGeneratingStart(true);
        }

        try {
            const prompt = buildImagePrompt(isEndFrame);
            const referenceImages = getSelectedReferenceUrls({
                includeStartFrameForEnd: isEndFrame,
                includePreviousSceneContinuation: !isEndFrame,
            });
            const requestedSeed = getRequestedSeed(isEndFrame);
            if (seedMode === 'fixed' && typeof requestedSeed !== 'number') {
                throw new Error('請輸入有效的固定 Seed（整數）');
            }
            const taskMetadata = {
                aspectRatio,
                resolution,
                seedMode,
                requestedSeed,
                referenceImageCount: referenceImages.length,
                requiredReferenceTags: Array.from(requiredReferenceTags),
                referenceImages,
            };

            taskId = crypto.randomUUID();
            await fetch('/api/workflow/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: taskId,
                    projectId,
                    sceneId: scene.id,
                    stage: isEndFrame ? 'image_end' : 'image_start',
                    status: 'running',
                    model: imageModel,
                    prompt,
                    inputUrl: referenceImages[0] || referenceImage || previousEndFrameUrl || scene.generatedImage?.url,
                    metadata: taskMetadata,
                }),
            });

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: imageModel,
                    referenceImage: referenceImages, // 傳送所有選取的參考圖 URL
                    aspectRatio,
                    resolution,
                    seed: requestedSeed,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                await updateTaskStatus(taskId, {
                    status: 'failed',
                    error: data.error || 'Generation failed',
                });
                throw new Error(data.error || 'Generation failed');
            }
            if (!data.endpoint) {
                await updateTaskStatus(taskId, {
                    status: 'failed',
                    error: 'Missing endpoint from server',
                });
                throw new Error('Missing endpoint from server');
            }

            // 輪詢檢查狀態 - 使用 API 回傳的 endpoint
            const requestId = data.request_id;
            const endpoint = data.endpoint; // 從後端回傳的正確 endpoint
            await updateTaskStatus(taskId, {
                metadata: {
                    ...taskMetadata,
                    requestId,
                    endpoint,
                },
            });

            await pollStatus(requestId, endpoint, prompt, isEndFrame, taskId, taskMetadata);
        } catch (error) {
            if (taskId) {
                await updateTaskStatus(taskId, {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Generation failed',
                });
            }
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

    const handleComposeEndFrameWithAI = async () => {
        setIsComposingEndFramePrompt(true);
        try {
            const response = await fetch('/api/gemini/compose-image-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scene: {
                        id: scene.id,
                        sceneNumber: scene.sceneNumber,
                        description: scene.description,
                        cameraMovement: scene.cameraMovement,
                        sceneIntent: scene.sceneIntent,
                        startComposition: scene.startComposition,
                        subjectMotion: scene.subjectMotion,
                        continuityLock: scene.continuityLock,
                        beatGoal: scene.beatGoal,
                        shotIntent: scene.shotIntent,
                        continuityAnchor: scene.continuityAnchor,
                        changeFromPrev: scene.changeFromPrev,
                        viewIntent: scene.viewIntent,
                        referenceViewHints: scene.referenceViewHints,
                        referencePlan: scene.referencePlan,
                        requiredReferences: scene.requiredReferences,
                        charactersUsed: scene.charactersUsed,
                        productsUsed: scene.productsUsed,
                        requiresEndFrame: scene.requiresEndFrame,
                        endFrameDescription: scene.endFrameDescription,
                        endFrameDelta: scene.endFrameDelta,
                    },
                    manualEndFrameDescription,
                    references: sceneScopedContentRefs,
                    stylePrompt: styleProfile?.stylePrompt,
                    negativePrompt: styleProfile?.negativePrompt,
                    hasPreviousEndFrame: Boolean(previousEndFrameUrl),
                    startFramePrompt: scene.generatedImage?.prompt,
                    previousSceneDescription,
                    nextSceneDescription,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'AI compose failed');
            }

            const suggested = typeof data.suggestedEndFrameDescription === 'string'
                ? data.suggestedEndFrameDescription.trim()
                : '';
            if (!suggested) {
                throw new Error('AI 未回傳可用尾幀描述');
            }

            setManualEndFrameDescription(suggested);
            onEndFrameDescriptionChanged?.(suggested, true);
            setAiEndFrameNotes(typeof data.notes === 'string' ? data.notes : '');
        } catch (error) {
            console.error('Compose end-frame prompt error:', error);
            alert(error instanceof Error ? error.message : 'AI 組合失敗');
        } finally {
            setIsComposingEndFramePrompt(false);
        }
    };

    const pollStatus = async (
        requestId: string,
        endpoint: string,
        prompt: string,
        isEndFrame: boolean = false,
        taskId: string,
        taskMetadata: Record<string, unknown>
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
                const imageUrl = data.result?.images?.[0]?.url;
                const resultSeed = typeof data.result?.seed === 'number' ? data.result.seed : undefined;
                if (imageUrl) {
                    await updateTaskStatus(taskId, {
                        status: 'completed',
                        outputUrl: imageUrl,
                        metadata: {
                            ...taskMetadata,
                            requestId,
                            endpoint,
                            seed: resultSeed,
                        },
                    });
                    // 如果是尾幀，保留現有的首幀資訊
                    if (isEndFrame) {
                        const startFrameUrlForSave = scene.generatedImage?.url || previousEndFrameUrl || '';
                        const startFramePromptForSave = scene.generatedImage?.prompt
                            || (previousEndFrameUrl
                                ? `${buildImagePrompt(false)}. Start frame reused from previous scene ${previousContinuationSource === 'start' ? 'start frame' : 'end frame'} due to continuation transition.`
                                : '');
                        onImageGenerated(
                            startFrameUrlForSave,
                            startFramePromptForSave,
                            imageUrl,
                            prompt,
                            scene.generatedImage?.seed,
                            resultSeed
                        );
                    } else {
                        // 如果是首幀，保留現有的尾幀資訊
                        onImageGenerated(
                            imageUrl,
                            prompt,
                            scene.generatedEndFrame?.url,
                            scene.generatedEndFrame?.prompt,
                            resultSeed,
                            scene.generatedEndFrame?.seed
                        );
                    }
                } else {
                    await updateTaskStatus(taskId, {
                        status: 'failed',
                        error: 'Generation completed but no image URL returned',
                        attempts: attempts + 1,
                    });
                    throw new Error('Generation completed but no image URL returned');
                }
                return;
            } else if (data.status === 'FAILED') {
                await updateTaskStatus(taskId, {
                    status: 'failed',
                    error: data.error || 'Generation failed',
                    attempts: attempts + 1,
                });
                throw new Error(data.error || 'Generation failed');
            }

            const delayMs = Math.min(15000, 2000 * Math.pow(1.5, attempts));
            const jitter = Math.floor(delayMs * 0.2 * Math.random());
            await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
            attempts++;
        }

        await updateTaskStatus(taskId, {
            status: 'failed',
            error: 'Generation timeout',
            attempts: attempts,
        });
        throw new Error('Generation timeout');
    };

    const hasStartFrame = Boolean(effectiveStartFrameUrl);
    const hasEndFrame = Boolean(scene.generatedEndFrame?.url);
    const totalSelectedReferences = selectedProjectRefs.length + selectedStyleReferenceUrls.length + (referenceImage ? 1 : 0);
    const activeGenerationBlockers = shouldUseEndFrame ? [...startFrameBlockers, ...endFrameBlockers] : startFrameBlockers;

    return (
        <div className="space-y-5">
            <div className="surface-panel space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-kicker">Image Stage</p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            場景 {scene.sceneNumber}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{scene.description}</p>
                    </div>
                    {scene.videoMode === 'reference' ? (
                        <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            Reference→影片（無需尾幀）
                        </span>
                    ) : scene.requiresEndFrame && (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            首尾幀模式
                        </span>
                    )}
                </div>

                {scene.cameraMovement && scene.cameraMovement !== '無' && (
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">鏡頭運動</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{scene.cameraMovement}</p>
                    </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">首幀狀態</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {startGenerationLoading ? '生成中' : hasStartFrame ? '已完成' : '尚未生成'}
                        </p>
                    </div>
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">尾幀狀態</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {!shouldUseEndFrame ? '不需要' : endGenerationLoading ? '生成中' : hasEndFrame ? '已完成' : '尚未生成'}
                        </p>
                    </div>
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">套用參考數</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{totalSelectedReferences}</p>
                    </div>
                </div>

                {scene.videoMode === 'reference' && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300">
                        <p className="font-medium">此場景使用 Reference→影片模式</p>
                        <p className="mt-0.5 opacity-80">
                            影片頁將直接使用角色 / 商品參考圖生成，不需要尾幀。本頁仍可生成首幀作為靜態預覽 / 其他用途。
                        </p>
                    </div>
                )}

                {activeGenerationBlockers.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <p className="font-medium">生成已阻擋，請先修正：</p>
                        {activeGenerationBlockers.slice(0, 3).map((blocker, index) => (
                            <p key={`${blocker.code}-${index}`}>- {blocker.message}</p>
                        ))}
                    </div>
                )}
            </div>

            <div className="surface-panel space-y-2 p-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">首幀 (Start Frame)</h4>
                    {previousEndFrameUrl && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            沿用前場景{previousContinuationSource === 'start' ? '首幀' : '尾幀'}
                        </span>
                    )}
                </div>
                <ImagePreview
                    imageUrl={previousEndFrameUrl || scene.generatedImage?.url || null}
                    prompt={scene.generatedImage?.prompt}
                    seed={scene.generatedImage?.seed}
                    isLoading={startGenerationLoading}
                    onRegenerate={() => handleGenerate(false)}
                />
            </div>

            {!scene.requiresEndFrame && scene.videoMode !== 'reference' && (
                <div className="surface-soft space-y-2 p-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={manualEndFrameEnabled}
                            onChange={(event) => {
                                const enabled = event.target.checked;
                                setManualEndFrameEnabled(enabled);
                                if (!enabled) {
                                    setManualEndFrameDescription('');
                                    onEndFrameDescriptionChanged?.('', false);
                                } else {
                                    onEndFrameDescriptionChanged?.(manualEndFrameDescription.trim(), true);
                                }
                            }}
                            disabled={isAnyGenerationLoading}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        手動啟用尾幀（適合跨主體運鏡）
                    </label>
                    {manualEndFrameEnabled && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    可先讓 AI 草擬尾幀描述，再進行尾幀生成
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleComposeEndFrameWithAI}
                                    disabled={isAnyGenerationLoading || isComposingEndFramePrompt}
                                >
                                    {isComposingEndFramePrompt ? 'AI 生成中...' : 'AI 產生尾幀描述'}
                                </Button>
                            </div>
                            <textarea
                                value={manualEndFrameDescription}
                                onChange={(event) => setManualEndFrameDescription(event.target.value)}
                                onBlur={() => onEndFrameDescriptionChanged?.(manualEndFrameDescription.trim(), true)}
                                placeholder="尾幀補充描述（選填）。例如：最後畫面停在家人中景，冷氣仍在左上角可見。"
                                className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                rows={2}
                                disabled={isAnyGenerationLoading || isComposingEndFramePrompt}
                            />
                            {aiEndFrameNotes && (
                                <p className="text-xs italic text-slate-500 dark:text-slate-400">
                                    AI 備註：{aiEndFrameNotes}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {shouldUseEndFrame && (
                <div className="surface-soft space-y-2 border-purple-200/70 p-4 dark:border-purple-800/70">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400"></div>
                        <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300">尾幀 (End Frame)</h4>
                    </div>
                    <p className="text-xs italic text-slate-600 dark:text-slate-400">
                        {scene.endFrameDescription || manualEndFrameDescription || '未提供尾幀描述，將沿用場景描述'}
                    </p>
                    <ImagePreview
                        imageUrl={scene.generatedEndFrame?.url || null}
                        prompt={scene.generatedEndFrame?.prompt}
                        seed={scene.generatedEndFrame?.seed}
                        isLoading={endGenerationLoading}
                        onRegenerate={() => handleGenerate(true)}
                    />
                </div>
            )}

            <div className="surface-panel space-y-3 p-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">自訂提示詞 (選填)</label>
                    <div className="relative">
                        <select
                            value={promptMode}
                            onChange={(event) => setPromptMode(event.target.value as 'append' | 'replace' | 'prepend')}
                            disabled={isAnyGenerationLoading || !customPrompt}
                            className="appearance-none rounded-full border border-border/80 bg-white/75 py-1 pl-3 pr-8 text-xs text-slate-700 shadow-sm focus:border-primary/40 focus:outline-none dark:bg-slate-900/70 dark:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
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

                {customPrompt && (
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{getModeDescription()}</p>
                    </div>
                )}

                <textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    placeholder={getPlaceholder()}
                    className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                    rows={3}
                    disabled={isAnyGenerationLoading}
                />

                {customPrompt && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/85 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                        <label className="mb-1 block text-xs font-medium text-blue-600 dark:text-blue-300">
                            最終提示詞預覽：
                        </label>
                        <p className="text-xs italic leading-relaxed text-slate-600 dark:text-slate-300">
                            &quot;{buildImagePrompt()}&quot;
                        </p>
                    </div>
                )}
            </div>

            {styleProjectReferences.length > 0 && (
                <div className="surface-panel space-y-2 p-4">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        風格參考圖（自動套用）
                    </label>
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                        {styleProjectReferences.map((ref) => {
                            const isActive = selectedStyleReferenceUrls.includes(ref.url);
                            return (
                                <div
                                    key={ref.id}
                                    className={`relative overflow-hidden rounded-lg border-2 ${
                                        isActive
                                            ? 'border-emerald-600'
                                            : 'border-slate-200 opacity-60 dark:border-slate-700'
                                    }`}
                                >
                                    <img
                                        src={ref.url}
                                        alt={ref.description}
                                        className="h-16 w-full object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                                        <p className="truncate text-[10px] text-white">
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
                <div className="surface-panel space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">內容參考圖</label>
                            <p className="mt-1 text-xs text-slate-500">本鏡視角：{sceneViewIntent}。系統會優先選主參考，再補輔助參考。</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedProjectRefs([...routedSceneRefs.primary, ...routedSceneRefs.secondary].map((ref) => ref.id))}
                                disabled={isAnyGenerationLoading}
                                className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200"
                            >
                                重設推薦
                            </button>
                            <button
                                onClick={() => setSelectedProjectRefs(Array.from(requiredProjectRefIds))}
                                disabled={isAnyGenerationLoading}
                                className="rounded-full border border-border/70 bg-white/70 px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200"
                            >
                                只留必用
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {contentProjectReferences.map((ref) => {
                            const isSelected = selectedProjectRefs.includes(ref.id);
                            const isRequired = requiredProjectRefIds.has(ref.id);

                            return (
                                <button
                                    key={ref.id}
                                    onClick={() => {
                                        if (isSelected) {
                                            if (isRequired) return;
                                            setSelectedProjectRefs((prev) => prev.filter((id) => id !== ref.id));
                                        } else {
                                            setSelectedProjectRefs((prev) => [...prev, ref.id]);
                                        }
                                    }}
                                    disabled={isAnyGenerationLoading}
                                    className={`relative overflow-hidden rounded-lg border-2 transition-all disabled:cursor-not-allowed ${
                                        isSelected
                                            ? 'border-primary ring-2 ring-primary/25'
                                            : 'border-slate-200 opacity-60 hover:opacity-85 dark:border-slate-700'
                                    }`}
                                >
                                    <img
                                        src={ref.url}
                                        alt={ref.description}
                                        className="h-16 w-full object-cover"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                                        <p className="truncate text-[10px] text-white">
                                            {ref.name ? `<${ref.name}>` : ref.type}{ref.angle ? ` · ${ref.angle}` : ''}
                                        </p>
                                    </div>
                                    {isRequired && (
                                        <div className="absolute left-1 top-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                            必用
                                        </div>
                                    )}
                                    {!isRequired && routedSceneRefs.primary.some((item) => item.id === ref.id) && (
                                        <div className="absolute left-1 top-1 rounded-full bg-indigo-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                            主參考
                                        </div>
                                    )}
                                    {isSelected && (
                                        <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                            ✓
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-500">
                        已選 {selectedProjectRefs.length}/{contentProjectReferences.length} 張
                        {requiredProjectRefIds.size > 0 ? `（含 ${requiredProjectRefIds.size} 張必用參考）` : ''}
                        {routedSceneRefs.primary.length > 0 ? `｜主參考 ${routedSceneRefs.primary.length} 張` : ''}
                        {routedSceneRefs.secondary.length > 0 ? `｜輔助參考 ${routedSceneRefs.secondary.length} 張` : ''}
                    </p>
                </div>
            )}

            <div className="surface-panel p-4">
                <ReferenceUploader
                    value={referenceImage}
                    onChange={setReferenceImage}
                    disabled={isAnyGenerationLoading}
                />
            </div>

            <div className="space-y-3">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                >
                    <Settings2 className="h-4 w-4" />
                    進階設定
                </button>

                {showAdvanced && (
                    <div className="surface-soft grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">圖片模型</label>
                            <select
                                value={imageModel}
                                onChange={(event) => setImageModel(event.target.value as ImageGenerationModel)}
                                disabled={isAnyGenerationLoading}
                                className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            >
                                <option value="nano-banana-pro">{IMAGE_GENERATION_MODEL_LABELS['nano-banana-pro']}</option>
                                <option value="seedream-5-lite">{IMAGE_GENERATION_MODEL_LABELS['seedream-5-lite']}</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Seed 策略</label>
                            <select
                                value={seedMode}
                                onChange={(event) => setSeedMode(event.target.value as 'auto' | 'fixed' | 'end_from_start')}
                                disabled={isAnyGenerationLoading}
                                className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            >
                                <option value="auto">Auto (每次自動)</option>
                                <option value="fixed">固定同一 Seed</option>
                                <option value="end_from_start">尾幀用首幀 Seed</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">長寬比</label>
                            <select
                                value={aspectRatio}
                                onChange={(event) => setAspectRatio(event.target.value)}
                                disabled={isAnyGenerationLoading}
                                className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            >
                                <option value="16:9">16:9 (橫向)</option>
                                <option value="9:16">9:16 (直向)</option>
                                <option value="1:1">1:1 (正方形)</option>
                                <option value="4:3">4:3</option>
                                <option value="3:4">3:4</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">解析度</label>
                            <select
                                value={resolution}
                                onChange={(event) => setResolution(event.target.value as '1K' | '2K' | '4K')}
                                disabled={isAnyGenerationLoading}
                                className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            >
                                <option value="1K">1K (快速)</option>
                                <option value="2K">2K (推薦)</option>
                                <option value="4K">4K (最高品質)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">手動 Seed</label>
                            <input
                                type="number"
                                value={manualSeedInput}
                                onChange={(event) => setManualSeedInput(event.target.value)}
                                disabled={isAnyGenerationLoading || seedMode !== 'fixed'}
                                placeholder="例如 123456"
                                className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60 dark:bg-slate-900/65"
                            />
                            {seedMode === 'end_from_start' && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    尾幀生成時會使用首幀 seed：{scene.generatedImage?.seed ?? '尚未有首幀 seed'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className={`grid gap-3 ${shouldUseEndFrame ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Button
                    type="button"
                    onClick={() => handleGenerate(false)}
                    disabled={isAnyGenerationLoading || startFrameBlockers.length > 0}
                    className="h-11 w-full rounded-xl"
                >
                    {startGenerationLoading ? '生成首幀中...' : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            生成首幀
                        </>
                    )}
                </Button>

                {shouldUseEndFrame && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleGenerate(true)}
                        disabled={isAnyGenerationLoading || !effectiveStartFrameUrl || endFrameBlockers.length > 0}
                        className="h-11 w-full rounded-xl border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20"
                    >
                        {endGenerationLoading ? '生成尾幀中...' : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                生成尾幀
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
