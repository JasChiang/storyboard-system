'use client';

import { useState, useEffect, useMemo } from 'react';
import { Film, Settings2, Sparkles } from 'lucide-react';
import { ModelSelector } from './ModelSelector';
import { MotionPromptEditor } from './MotionPromptEditor';
import { VideoPreview } from './VideoPreview';
import { Button } from '@/components/ui/button';
import type { Scene, ProjectReference, SharedContinuityDirective } from '@/lib/types/storyboard';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';
import { splitSceneReferencesByPriority } from '@/lib/references/reference-routing';
import { buildKlingPrompt } from '@/lib/video/adapters/kling';
import { buildSeedancePrompt } from '@/lib/video/adapters/seedance';
import { enforceVideoPromptPolicy } from '@/lib/video/prompt-policy';
import { formatBlockersForAlert, getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

type VideoModel = 'kling' | 'seedance';
type PromptMode = 'deterministic' | 'ai_composer';
type KlingVariant = 'v26' | 'o3' | 'o1' | 'o1_ref';
type SeedanceVariant = 'v15' | 'v20' | 'v20_ref' | 'v20_fast_ref';

const KLING_REFERENCE_VARIANTS: ReadonlyArray<KlingVariant> = ['o1_ref'];
const SEEDANCE_REFERENCE_VARIANTS: ReadonlyArray<SeedanceVariant> = ['v20_ref', 'v20_fast_ref'];
const KLING_REF_MAX = 7;
const SEEDANCE_REF_MAX = 9;

interface VideoGeneratorProps {
    projectId: string;
    scene: Scene;
    previousEndFrameUrl?: string; // 當前一場景為 continuation 時，傳入其延續來源幀 URL（尾幀或首幀）
    externalGenerating?: boolean;
    projectReferences?: ProjectReference[];
    allScenes?: Scene[];
    sharedAnchors?: string[];
    sharedContinuityDirectives?: SharedContinuityDirective[];
    onPromptDraftChanged?: (draftPrompt: string, notes?: string) => void;
    onVideoModeChanged?: (mode: 'standard' | 'reference') => void;
    onVideoGenerated: (
        videoUrl: string,
        motionPrompt: string,
        composedPrompt: string,
        model: VideoModel,
        durationSeconds: number
    ) => void;
}

function isComposedPromptPollution(value: string): boolean {
    const text = (value || '').trim();
    if (!text) return false;
    return /^Kling visual direction\b/i.test(text)
        || /^Seedance scene direction\b/i.test(text)
        || /\bShot goal:\b/i.test(text)
        || /\bIdentity invariants:\b/i.test(text);
}

function resolveEditableMotionPrompt(data: {
    motionPrompt?: string;
    cameraMovement?: string;
}): string {
    const saved = data.motionPrompt || '';
    if (saved && !isComposedPromptPollution(saved)) {
        return saved;
    }
    return data.cameraMovement || '';
}

export function VideoGenerator({
    projectId,
    scene,
    previousEndFrameUrl,
    externalGenerating = false,
    projectReferences = [],
    allScenes = [],
    sharedAnchors = [],
    sharedContinuityDirectives = [],
    onPromptDraftChanged,
    onVideoModeChanged,
    onVideoGenerated
}: VideoGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [model, setModel] = useState<VideoModel>('kling');
    // 優先使用 AI 生成的運鏡指令，如果沒有則使用已儲存的 motionPrompt
    const [motionPrompt, setMotionPrompt] = useState(
        resolveEditableMotionPrompt({
            motionPrompt: scene.motionPrompt,
            cameraMovement: scene.cameraMovement,
        })
    );
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [promptMode, setPromptMode] = useState<PromptMode>('deterministic');
    const [isComposingPrompt, setIsComposingPrompt] = useState(false);
    const [aiComposedPrompt, setAiComposedPrompt] = useState(scene.videoPromptDraft || '');
    const [aiComposeNotes, setAiComposeNotes] = useState(scene.videoPromptDraftNotes || '');

    // Kling 選項
    const [klingDuration, setKlingDuration] = useState<5 | 10>(5);
    const [klingAspectRatio, setKlingAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
    const [klingEnableSound, setKlingEnableSound] = useState(false);
    const [klingVariant, setKlingVariant] = useState<KlingVariant>('v26');

    // Seedance 選項
    const [seedanceVariant, setSeedanceVariant] = useState<SeedanceVariant>('v20');
    const [seedanceDuration, setSeedanceDuration] = useState(5);
    const [seedanceAspectRatio, setSeedanceAspectRatio] = useState<'21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16'>('16:9');
    const [seedanceResolution, setSeedanceResolution] = useState<'480p' | '720p' | '1080p'>('720p');
    const [seedanceEnableAudio, setSeedanceEnableAudio] = useState(false);
    const isGenerationLocked = isGenerating || externalGenerating;
    const endFrameUrl = scene.generatedEndFrame?.url;
    const shouldUseEndFrameForVideo = Boolean(
        endFrameUrl && (scene.requiresEndFrame || scene.endFrameDelta || scene.endFrameDescription)
    );
    const effectiveStartFrameUrl = previousEndFrameUrl || scene.generatedImage?.url;
    const contentRefs = useMemo(
        () => projectReferences.filter(ref => ref.type !== 'style'),
        [projectReferences]
    );
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
    const scopedRefs = useMemo(
        () => splitSceneReferencesByPriority(sceneReferenceScope, contentRefs, { fallbackPolicy: 'non_environment' }).all,
        [sceneReferenceScope, contentRefs]
    );
    const isKlingReferenceMode = model === 'kling' && KLING_REFERENCE_VARIANTS.includes(klingVariant);
    const isSeedanceReferenceMode = model === 'seedance' && SEEDANCE_REFERENCE_VARIANTS.includes(seedanceVariant);
    const isReferenceMode = isKlingReferenceMode || isSeedanceReferenceMode;
    const referenceImageUrls = useMemo(() => {
        if (!isReferenceMode) return [] as string[];
        const max = isKlingReferenceMode ? KLING_REF_MAX : SEEDANCE_REF_MAX;
        const seen = new Set<string>();
        const collected: string[] = [];
        for (const ref of scopedRefs) {
            const url = ref.url?.trim();
            if (!url || seen.has(url)) continue;
            seen.add(url);
            collected.push(url);
            if (collected.length >= max) break;
        }
        return collected;
    }, [isReferenceMode, isKlingReferenceMode, scopedRefs]);
    const continuityMemoryLines = useMemo(
        () => buildContinuityMemoryLines(scene, allScenes, {
            stage: 'video',
            sharedAnchors,
            sharedContinuityDirectives,
        }),
        [allScenes, scene, sharedAnchors, sharedContinuityDirectives]
    );
    const generationBlockers = useMemo(
        () => getSceneGenerationBlockers({
            stage: 'video',
            scene,
            projectReferences,
            effectiveStartFrameUrl,
        }),
        [effectiveStartFrameUrl, projectReferences, scene]
    );

    // 當場景變化時，同步更新 motionPrompt
    useEffect(() => {
        const newMotionPrompt = resolveEditableMotionPrompt({
            motionPrompt: scene.motionPrompt,
            cameraMovement: scene.cameraMovement,
        });
        setMotionPrompt(newMotionPrompt);
        setAiComposedPrompt(scene.videoPromptDraft || '');
        setAiComposeNotes(scene.videoPromptDraftNotes || '');
    }, [scene.id, scene.motionPrompt, scene.cameraMovement, scene.videoPromptDraft, scene.videoPromptDraftNotes]);

    // 切換場景時，若該場景已記錄 videoMode='reference'，則套用對應 ref variant
    useEffect(() => {
        if (scene.videoMode !== 'reference') return;
        setKlingVariant((prev) => (KLING_REFERENCE_VARIANTS.includes(prev) ? prev : 'o1_ref'));
        setSeedanceVariant((prev) => (SEEDANCE_REFERENCE_VARIANTS.includes(prev) ? prev : 'v20_ref'));
    }, [scene.id, scene.videoMode]);

    // 將目前的 reference / standard 模式回寫到場景，讓圖片頁可同步隱藏尾幀流程
    useEffect(() => {
        if (!onVideoModeChanged) return;
        const nextMode: 'standard' | 'reference' = isReferenceMode ? 'reference' : 'standard';
        const persistedMode = scene.videoMode || 'standard';
        if (nextMode !== persistedMode) {
            onVideoModeChanged(nextMode);
        }
    }, [isReferenceMode, scene.videoMode, onVideoModeChanged]);

    useEffect(() => {
        const profileWithDefaults = scopedRefs.find((ref) => ref.ipProfile?.generationDefaults);
        const defaults = profileWithDefaults?.ipProfile?.generationDefaults;
        if (!defaults) return;

        if (defaults.preferredVideoModel) {
            setModel(defaults.preferredVideoModel);
        }
        if (defaults.preferredOutputAspectRatio) {
            setKlingAspectRatio(defaults.preferredOutputAspectRatio);
            setSeedanceAspectRatio(defaults.preferredOutputAspectRatio);
        }
        if (defaults.preferredKlingDuration) {
            setKlingDuration(defaults.preferredKlingDuration);
        }
        if (typeof defaults.preferredSeedanceDuration === 'number') {
            setSeedanceDuration(Math.max(4, Math.min(12, Math.round(defaults.preferredSeedanceDuration))));
        }
    }, [scene.id, scopedRefs]);

    const buildVideoPrompt = (activeMotionPrompt: string) => {
        if (model === 'kling') {
            return buildKlingPrompt({ scene, motionPrompt: activeMotionPrompt, scopedRefs, continuityMemoryLines });
        }
        return buildSeedancePrompt({ scene, motionPrompt: activeMotionPrompt, scopedRefs, continuityMemoryLines });
    };

    const composePromptWithAI = async (activeMotionPrompt: string): Promise<string> => {
        setIsComposingPrompt(true);
        try {
            const response = await fetch('/api/gemini/compose-video-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    scene: {
                        id: scene.id,
                        sceneNumber: scene.sceneNumber,
                        description: scene.description,
                        cameraMovement: scene.cameraMovement,
                        sceneIntent: scene.sceneIntent,
                        startComposition: scene.startComposition,
                        subjectMotion: scene.subjectMotion,
                        continuityLock: scene.continuityLock,
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
                    },
                    motionPrompt: activeMotionPrompt,
                    references: scopedRefs,
                    continuityMemoryLines,
                    hasPreviousEndFrame: Boolean(previousEndFrameUrl),
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'AI prompt compose failed');
            }
            const composed = typeof data.composedPrompt === 'string' ? data.composedPrompt.trim() : '';
            if (!composed) {
                throw new Error('AI 未回傳可用提示詞');
            }
            setAiComposedPrompt(composed);
            setAiComposeNotes(typeof data.notes === 'string' ? data.notes : '');
            onPromptDraftChanged?.(composed, typeof data.notes === 'string' ? data.notes : '');
            if ((!motionPrompt.trim() || motionPrompt.trim() === activeMotionPrompt) && typeof data.suggestedMotionPrompt === 'string') {
                setMotionPrompt(data.suggestedMotionPrompt.trim());
            }
            return composed;
        } finally {
            setIsComposingPrompt(false);
        }
    };

    const handleGenerate = async () => {
        if (scene.qaStatus === 'block') {
            alert('此場景被 QA 阻擋，請先回分鏡頁修正。');
            return;
        }
        if (generationBlockers.length > 0) {
            alert(`無法生成影片：\n${formatBlockersForAlert(generationBlockers)}`);
            return;
        }

        // image-to-video 模式需要起幀；reference-to-video 模式只需要參考圖
        if (!isReferenceMode && !effectiveStartFrameUrl) {
            alert('請先生成場景圖片');
            return;
        }
        if (isReferenceMode && referenceImageUrls.length === 0) {
            alert('Reference-to-video 模式需要至少一張專案參考圖（角色/商品）');
            return;
        }

        setIsGenerating(true);

        try {
            const requestedDurationSeconds = model === 'kling' ? klingDuration : seedanceDuration;
            const resolvedMotionPrompt = motionPrompt.trim()
                || scene.cameraMovement?.trim()
                || scene.description?.trim()
                || 'Keep camera motion smooth and physically plausible.';
            if (!motionPrompt.trim()) {
                setMotionPrompt(resolvedMotionPrompt);
            }
            const rawPrompt = promptMode === 'ai_composer'
                ? (aiComposedPrompt.trim() || await composePromptWithAI(resolvedMotionPrompt))
                : buildVideoPrompt(resolvedMotionPrompt);
            const promptPolicy = enforceVideoPromptPolicy(rawPrompt, model);
            const composedPrompt = promptPolicy.prompt;
            const taskId = crypto.randomUUID();
            await fetch('/api/workflow/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: taskId,
                    projectId,
                    sceneId: scene.id,
                    stage: 'video',
                    status: 'running',
                    model,
                    prompt: composedPrompt,
                    inputUrl: effectiveStartFrameUrl,
                    metadata: {
                        promptPolicy,
                        durationSeconds: requestedDurationSeconds,
                        motionPrompt: resolvedMotionPrompt,
                    },
                }),
            });
            // Continuation 轉場邏輯：如果有 previousEndFrameUrl，使用它作為起始幀
            // reference-to-video 模式 start frame 可選；image-to-video 模式必須
            const startImageUrl = effectiveStartFrameUrl || '';
            if (!isReferenceMode && !startImageUrl.trim()) {
                throw new Error('Missing start image URL');
            }

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: startImageUrl,
                    prompt: composedPrompt,
                    model,
                    klingVariant: model === 'kling' ? klingVariant : undefined,
                    seedanceVariant: model === 'seedance' ? seedanceVariant : undefined,
                    duration: model === 'kling' ? klingDuration : seedanceDuration,
                    aspectRatio: model === 'kling' ? klingAspectRatio : seedanceAspectRatio,
                    resolution: model === 'seedance' ? seedanceResolution : undefined,
                    enableSound: model === 'kling' ? klingEnableSound : undefined,
                    enableAudio: model === 'seedance' ? seedanceEnableAudio : undefined,
                    endImageUrl: !isReferenceMode && shouldUseEndFrameForVideo ? scene.generatedEndFrame?.url : undefined,
                    referenceImageUrls: isReferenceMode ? referenceImageUrls : undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (taskId) {
                    await fetch(`/api/workflow/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'failed',
                            error: data.error || 'Generation failed',
                            attempts: 1,
                        }),
                    });
                }
                throw new Error(data.error || 'Generation failed');
            }
            if (!data.endpoint) {
                throw new Error('Missing endpoint from server');
            }

            // 輪詢檢查狀態
            const requestId = data.request_id;
            const endpoint = data.endpoint;
            await fetch(`/api/workflow/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    metadata: {
                        promptPolicy,
                        durationSeconds: requestedDurationSeconds,
                        motionPrompt: resolvedMotionPrompt,
                        requestId,
                        endpoint,
                    },
                }),
            });

            await pollStatus(requestId, endpoint, composedPrompt, taskId, requestedDurationSeconds, resolvedMotionPrompt);
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
        composedPrompt: string,
        taskId: string,
        durationSeconds: number,
        usedMotionPrompt: string
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
            if (!response.ok) {
                throw new Error(data.error || 'Status check failed');
            }

            if (data.status === 'COMPLETED') {
                const videoUrl = data.result?.video?.url;
                if (videoUrl) {
                    await fetch(`/api/workflow/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'completed',
                            outputUrl: videoUrl,
                            metadata: {
                                durationSeconds,
                                motionPrompt: usedMotionPrompt,
                                requestId,
                                endpoint,
                            },
                        }),
                    });
                    onVideoGenerated(videoUrl, usedMotionPrompt, composedPrompt, model, durationSeconds);
                } else {
                    await fetch(`/api/workflow/tasks/${taskId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            status: 'failed',
                            error: 'Generation completed but no video URL returned',
                            attempts: attempts + 1,
                        }),
                    });
                    throw new Error('Generation completed but no video URL returned');
                }
                return;
            } else if (data.status === 'FAILED') {
                await fetch(`/api/workflow/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'failed',
                        error: data.error || 'Generation failed',
                        attempts: attempts + 1,
                    }),
                });
                throw new Error(data.error || 'Generation failed');
            }

            const delayMs = Math.min(20000, 3000 * Math.pow(1.5, attempts));
            const jitter = Math.floor(delayMs * 0.2 * Math.random());
            await new Promise(resolve => setTimeout(resolve, delayMs + jitter));
            attempts++;
        }

        await fetch(`/api/workflow/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'failed',
                error: 'Generation timeout',
                attempts,
            }),
        });
        throw new Error('Generation timeout');
    };

    const hasStartFrame = Boolean(effectiveStartFrameUrl);
    const hasEndFrame = Boolean(endFrameUrl);
    const hasGeneratedVideo = Boolean(scene.generatedVideo?.url);
    const canGenerateVideo = isReferenceMode
        ? referenceImageUrls.length > 0
        : Boolean(effectiveStartFrameUrl);

    return (
        <div className="space-y-5">
            <div className="surface-panel space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-kicker">Video Stage</p>
                        <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                            場景 {scene.sceneNumber}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{scene.description}</p>
                    </div>
                    {scene.requiresEndFrame && (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            首尾幀模式
                        </span>
                    )}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">首幀</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {hasStartFrame ? '已就緒' : isReferenceMode ? '不使用' : '尚未就緒'}
                        </p>
                    </div>
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">尾幀</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {isReferenceMode ? '不使用' : shouldUseEndFrameForVideo ? (hasEndFrame ? '已就緒' : '尚未就緒') : '不使用'}
                        </p>
                    </div>
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">影片輸出</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {isGenerationLocked ? '生成中' : hasGeneratedVideo ? '已完成' : '尚未生成'}
                        </p>
                    </div>
                </div>

                {isReferenceMode && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-300">
                        <p className="font-medium">
                            Reference-to-Video 模式（{referenceImageUrls.length}/{isKlingReferenceMode ? KLING_REF_MAX : SEEDANCE_REF_MAX} 張參考圖）
                        </p>
                        <p className="mt-0.5 text-[11px] opacity-80">
                            自動帶入場景相關的角色 / 商品參考圖，不使用起幀 / 尾幀
                        </p>
                    </div>
                )}

                {generationBlockers.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <p className="font-medium">影片生成已阻擋，請先修正：</p>
                        {generationBlockers.slice(0, 3).map((blocker, index) => (
                            <p key={`${blocker.code}-${index}`}>- {blocker.message}</p>
                        ))}
                    </div>
                )}

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-medium text-slate-700 dark:text-slate-300">首幀 (Start Frame)</h4>
                        {previousEndFrameUrl && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                沿用前景尾幀
                            </span>
                        )}
                    </div>
                    {effectiveStartFrameUrl ? (
                        <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70">
                            <img
                                src={effectiveStartFrameUrl}
                                alt={`Scene ${scene.sceneNumber}`}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="flex aspect-video items-center justify-center rounded-xl border border-border/70 bg-slate-50 dark:bg-slate-900">
                            <p className="text-sm text-slate-500 dark:text-slate-400">尚未生成首幀</p>
                        </div>
                    )}
                </div>

                {shouldUseEndFrameForVideo && endFrameUrl && (
                    <div className="space-y-2 rounded-xl border border-purple-200 bg-purple-50/80 p-3 dark:border-purple-800 dark:bg-purple-900/15">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400"></div>
                            <h4 className="text-xs font-medium text-purple-700 dark:text-purple-300">尾幀 (End Frame)</h4>
                        </div>
                        <div className="relative aspect-video overflow-hidden rounded-lg border border-purple-300 dark:border-purple-700">
                            <img
                                src={endFrameUrl}
                                alt={`Scene ${scene.sceneNumber} End Frame`}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="surface-panel p-4">
                <VideoPreview
                    videoUrl={scene.generatedVideo?.url || null}
                    prompt={scene.generatedVideo?.prompt}
                    model={scene.generatedVideo?.model}
                    isLoading={isGenerationLocked}
                    onRegenerate={handleGenerate}
                />
            </div>

            <div className="surface-panel p-4">
                <ModelSelector
                    value={model}
                    onChange={setModel}
                    disabled={isGenerationLocked}
                />
            </div>

            <div className="surface-panel space-y-3 p-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200">提示詞組合模式</h4>
                    <div className="inline-flex rounded-full border border-border/70 p-1">
                        <button
                            type="button"
                            onClick={() => setPromptMode('deterministic')}
                            disabled={isGenerationLocked || isComposingPrompt}
                            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                                promptMode === 'deterministic'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            Deterministic
                        </button>
                        <button
                            type="button"
                            onClick={() => setPromptMode('ai_composer')}
                            disabled={isGenerationLocked || isComposingPrompt}
                            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                                promptMode === 'ai_composer'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                            }`}
                        >
                            AI Composer
                        </button>
                    </div>
                </div>

                {promptMode === 'ai_composer' && (
                    <div className="space-y-3">
                        <Button
                            type="button"
                            onClick={() => {
                                const fallbackMotionPrompt = motionPrompt.trim()
                                    || scene.cameraMovement?.trim()
                                    || scene.description?.trim()
                                    || 'Keep camera motion smooth and physically plausible.';
                                void composePromptWithAI(fallbackMotionPrompt).catch((error) => {
                                    alert(error instanceof Error ? error.message : 'AI 組合失敗');
                                });
                            }}
                            disabled={isGenerationLocked || isComposingPrompt}
                            className="w-fit rounded-xl"
                        >
                            {isComposingPrompt ? (
                                <>
                                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                    AI 組合中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    產生 AI 提示詞
                                </>
                            )}
                        </Button>
                        <textarea
                            value={aiComposedPrompt}
                            onChange={(event) => setAiComposedPrompt(event.target.value)}
                            placeholder="點擊上方按鈕，讓 AI 根據場景與參考規則組合可直接送 Kling/Seedance 的提示詞"
                            className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            rows={6}
                            disabled={isGenerationLocked || isComposingPrompt}
                        />
                        {aiComposeNotes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                AI 備註：{aiComposeNotes}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="surface-panel p-4">
                <MotionPromptEditor
                    value={motionPrompt}
                    onChange={setMotionPrompt}
                    disabled={isGenerationLocked}
                    sceneDescription={scene.description}
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
                    <div className="surface-soft space-y-4 p-4">
                        {model === 'kling' ? (
                            <>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            Kling 版本
                                        </label>
                                        <select
                                            value={klingVariant}
                                            onChange={(event) => setKlingVariant(event.target.value as KlingVariant)}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                        >
                                            <option value="v26">Kling 2.6 Pro（起+尾幀）</option>
                                            <option value="o3">Kling O3 Pro（起+尾幀）</option>
                                            <option value="o1">Kling O1（起+尾幀）</option>
                                            <option value="o1_ref">Kling O1 Reference（多參考圖，最多 7 張）</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            影片長度
                                        </label>
                                        <select
                                            value={klingDuration}
                                            onChange={(event) => setKlingDuration(Number(event.target.value) as 5 | 10)}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
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
                                            onChange={(event) => setKlingAspectRatio(event.target.value as '16:9' | '9:16' | '1:1')}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                        >
                                            <option value="16:9">16:9 (橫向)</option>
                                            <option value="9:16">9:16 (直向)</option>
                                            <option value="1:1">1:1 (正方形)</option>
                                        </select>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={klingEnableSound}
                                        onChange={(event) => setKlingEnableSound(event.target.checked)}
                                        disabled={isGenerationLocked}
                                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                                    />
                                    啟用音效
                                </label>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Seedance 版本
                                    </label>
                                    <select
                                        value={seedanceVariant}
                                        onChange={(event) => setSeedanceVariant(event.target.value as SeedanceVariant)}
                                        disabled={isGenerationLocked}
                                        className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                    >
                                        <option value="v20">Seedance 2.0（起+尾幀）</option>
                                        <option value="v20_ref">Seedance 2.0 Reference（多參考圖，最多 9 張）</option>
                                        <option value="v20_fast_ref">Seedance 2.0 Fast Reference（快速低成本版）</option>
                                        <option value="v15">Seedance 1.5 Pro（legacy）</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            長寬比
                                        </label>
                                        <select
                                            value={seedanceAspectRatio}
                                            onChange={(event) => setSeedanceAspectRatio(event.target.value as '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16')}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
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
                                            onChange={(event) => setSeedanceResolution(event.target.value as '480p' | '720p' | '1080p')}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
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
                                            onChange={(event) => setSeedanceDuration(Number(event.target.value))}
                                            disabled={isGenerationLocked}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right text-sm text-slate-700 dark:text-slate-300">
                                            {seedanceDuration} 秒
                                        </span>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={seedanceEnableAudio}
                                        onChange={(event) => setSeedanceEnableAudio(event.target.checked)}
                                        disabled={isGenerationLocked}
                                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                                    />
                                    啟用音訊
                                </label>
                            </>
                        )}
                    </div>
                )}
            </div>

            <Button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerationLocked || !canGenerateVideo || generationBlockers.length > 0}
                className="h-11 w-full rounded-xl"
            >
                {isGenerationLocked ? (
                    <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                        生成中...
                    </>
                ) : (
                    <>
                        <Film className="mr-2 h-4 w-4" />
                        生成影片
                    </>
                )}
            </Button>

            {!canGenerateVideo && (
                <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                    {!hasStartFrame ? '請先在「圖片」頁面生成場景圖片' : '目前無法生成影片'}
                </p>
            )}
        </div>
    );
}
