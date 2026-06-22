'use client';

import { useState, useEffect, useMemo } from 'react';
import { Film, Settings2, Sparkles } from 'lucide-react';
import { MotionPromptEditor } from './MotionPromptEditor';
import { VideoPreview } from './VideoPreview';
import { Button } from '@/components/ui/button';
import type { Scene, ProjectReference, SharedContinuityDirective, SceneRefSource, SceneRefSourceUsage } from '@/lib/types/storyboard';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';
import { splitSceneReferencesByPriority } from '@/lib/references/reference-routing';
import { buildSeedancePrompt } from '@/lib/video/adapters/seedance';
import { enforceVideoPromptPolicy } from '@/lib/video/prompt-policy';
import { formatBlockersForAlert, getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

type VideoModel = 'seedance';
type PromptMode = 'deterministic' | 'ai_composer';
type SeedanceVariant =
    | 'v20_i2v'
    | 'v20_i2v_fast'
    | 'v20_ref'
    | 'v20_ref_fast'
    | 'v20_t2v'
    | 'v20_t2v_fast';

const SEEDANCE_REFERENCE_VARIANTS: ReadonlyArray<SeedanceVariant> = ['v20_ref', 'v20_ref_fast'];
const SEEDANCE_TEXT_VARIANTS: ReadonlyArray<SeedanceVariant> = ['v20_t2v', 'v20_t2v_fast'];
const SEEDANCE_FAST_VARIANTS: ReadonlyArray<SeedanceVariant> = ['v20_i2v_fast', 'v20_ref_fast', 'v20_t2v_fast'];
const SEEDANCE_REF_MAX = 9;
const SEEDANCE_VIDEO_REF_MAX = 3;
const SEEDANCE_AUDIO_REF_MAX = 3;
const SEEDANCE_MIXED_TOTAL_MAX = 12;

const USAGE_OPTIONS: Array<{ value: SceneRefSourceUsage; label: string; kinds: SceneRefSource['kind'][] }> = [
    { value: 'identity', label: '身份一致性', kinds: ['image', 'video'] },
    { value: 'camera', label: '運鏡復刻', kinds: ['video'] },
    { value: 'motion', label: '動作復刻', kinds: ['video', 'image'] },
    { value: 'effect', label: '特效 / 轉場', kinds: ['video'] },
    { value: 'voice', label: '音色', kinds: ['audio', 'video'] },
    { value: 'music', label: '配樂 / 節奏', kinds: ['audio', 'video'] },
    { value: 'environment', label: '場景 / 環境', kinds: ['image', 'video'] },
];

type SeedanceAspectRatio = 'auto' | '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
type SeedanceResolution = '480p' | '720p' | '1080p';

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
    onVideoModeChanged?: (mode: 'standard' | 'reference' | 'text') => void;
    onCapabilityUpdated?: (updates: Partial<Pick<Scene, 'videoCapability' | 'extendsSceneId' | 'editSourceSceneId' | 'oneShot'>>) => void;
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
    return /^Seedance scene direction\b/i.test(text)
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
    onCapabilityUpdated,
    onVideoGenerated
}: VideoGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const model: VideoModel = 'seedance';
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

    // Seedance 選項
    const [seedanceVariant, setSeedanceVariant] = useState<SeedanceVariant>('v20_i2v');
    const [seedanceDuration, setSeedanceDuration] = useState(5);
    const [seedanceAspectRatio, setSeedanceAspectRatio] = useState<SeedanceAspectRatio>('16:9');
    const [seedanceResolution, setSeedanceResolution] = useState<SeedanceResolution>('720p');
    const [seedanceEnableAudio, setSeedanceEnableAudio] = useState(false);

    // Seedance 多模態 ref 輸入（ref 模式下可手動加入影片 / 音訊 URL）
    const [videoRefUrlsText, setVideoRefUrlsText] = useState('');
    const [audioRefUrlsText, setAudioRefUrlsText] = useState('');
    // 每張自動帶入的 image ref 的 usage — key 為 ref id
    const [imageRefUsageMap, setImageRefUsageMap] = useState<Record<string, SceneRefSourceUsage>>({});
    // 延長模式的新增秒數
    const [extensionSeconds, setExtensionSeconds] = useState(5);
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
    const isSeedanceReferenceMode = SEEDANCE_REFERENCE_VARIANTS.includes(seedanceVariant);
    const isSeedanceTextMode = SEEDANCE_TEXT_VARIANTS.includes(seedanceVariant);
    const isSeedanceFastVariant = SEEDANCE_FAST_VARIANTS.includes(seedanceVariant);
    const isReferenceMode = isSeedanceReferenceMode;
    const referenceImageUrls = useMemo(() => {
        if (!isReferenceMode) return [] as string[];
        const max = SEEDANCE_REF_MAX;
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
    }, [isReferenceMode, scopedRefs]);
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
        setSeedanceVariant((prev) => (SEEDANCE_REFERENCE_VARIANTS.includes(prev) ? prev : 'v20_ref'));
    }, [scene.id, scene.videoMode]);

    // 將目前的 reference / standard / text 模式回寫到場景，讓圖片頁可同步隱藏首尾幀流程
    useEffect(() => {
        if (!onVideoModeChanged) return;
        const nextMode: 'standard' | 'reference' | 'text' = isSeedanceTextMode
            ? 'text'
            : isReferenceMode
                ? 'reference'
                : 'standard';
        const persistedMode = scene.videoMode || 'standard';
        if (nextMode !== persistedMode) {
            onVideoModeChanged(nextMode);
        }
    }, [isReferenceMode, isSeedanceTextMode, scene.videoMode, onVideoModeChanged]);

    useEffect(() => {
        const profileWithDefaults = scopedRefs.find((ref) => ref.ipProfile?.generationDefaults);
        const defaults = profileWithDefaults?.ipProfile?.generationDefaults;
        if (!defaults) return;

        if (defaults.preferredOutputAspectRatio) {
            setSeedanceAspectRatio(defaults.preferredOutputAspectRatio);
        }
        if (typeof defaults.preferredSeedanceDuration === 'number') {
            setSeedanceDuration(Math.max(4, Math.min(15, Math.round(defaults.preferredSeedanceDuration))));
        }
    }, [scene.id, scopedRefs]);

    // Fast variants only support up to 720p — auto-downgrade if user switches into a fast variant while on 1080p.
    useEffect(() => {
        if (isSeedanceFastVariant && seedanceResolution === '1080p') {
            setSeedanceResolution('720p');
        }
    }, [isSeedanceFastVariant, seedanceResolution]);

    const parseUrlList = (text: string, max: number): string[] => {
        if (!text) return [];
        const urls = text
            .split(/[\n,]+/)
            .map((raw) => raw.trim())
            .filter(Boolean);
        return Array.from(new Set(urls)).slice(0, max);
    };

    const parsedVideoRefUrls = useMemo(() => {
        if (!isSeedanceReferenceMode) return [] as string[];
        const manual = parseUrlList(videoRefUrlsText, SEEDANCE_VIDEO_REF_MAX);
        // 延長 / 編輯能力：自動把來源鏡的 generatedVideo.url 插到第一位，保證 @視頻1 指向它
        const capability = scene.videoCapability;
        const sourceSceneId = capability === 'extension'
            ? scene.extendsSceneId
            : capability === 'edit'
                ? scene.editSourceSceneId
                : undefined;
        const sourceUrl = sourceSceneId
            ? (allScenes || []).find((s) => s.id === sourceSceneId)?.generatedVideo?.url
            : undefined;
        if (!sourceUrl) return manual;
        const deduped = [sourceUrl, ...manual.filter((u) => u !== sourceUrl)];
        return deduped.slice(0, SEEDANCE_VIDEO_REF_MAX);
    }, [isSeedanceReferenceMode, videoRefUrlsText, scene.videoCapability, scene.extendsSceneId, scene.editSourceSceneId, allScenes]);
    const parsedAudioRefUrls = useMemo(
        () => (isSeedanceReferenceMode ? parseUrlList(audioRefUrlsText, SEEDANCE_AUDIO_REF_MAX) : []),
        [isSeedanceReferenceMode, audioRefUrlsText]
    );

    // 依 @圖片 N / @視頻 N / @音頻 N 官方規則，依序給每個 ref 分配 atIndex（從 1 起）
    const builtRefSources = useMemo<SceneRefSource[]>(() => {
        if (!isSeedanceReferenceMode) return [];
        const sources: SceneRefSource[] = [];
        referenceImageUrls.forEach((url, idx) => {
            // 透過 scopedRefs 找回 ref 物件（以 url 對應）
            const matchedRef = scopedRefs.find((ref) => ref.url === url);
            const refId = matchedRef?.id || `image-${idx + 1}`;
            const usage = imageRefUsageMap[refId] || 'identity';
            sources.push({ refId, kind: 'image', usage, atIndex: idx + 1 });
        });
        parsedVideoRefUrls.forEach((url, idx) => {
            sources.push({ refId: `video-${idx + 1}:${url}`, kind: 'video', usage: 'camera', atIndex: idx + 1 });
        });
        parsedAudioRefUrls.forEach((url, idx) => {
            sources.push({ refId: `audio-${idx + 1}:${url}`, kind: 'audio', usage: 'music', atIndex: idx + 1 });
        });
        return sources;
    }, [isSeedanceReferenceMode, referenceImageUrls, imageRefUsageMap, parsedVideoRefUrls, parsedAudioRefUrls, scopedRefs]);

    const totalRefCount = referenceImageUrls.length + parsedVideoRefUrls.length + parsedAudioRefUrls.length;
    const isRefMixOverflow = isSeedanceReferenceMode && totalRefCount > SEEDANCE_MIXED_TOTAL_MAX;

    // 可作為延長 / 編輯來源的場景（必須有 generatedVideo.url 且非當前場景）
    const videoSourceCandidates = useMemo(() => {
        return (allScenes || [])
            .filter((s) => s.id !== scene.id && Boolean(s.generatedVideo?.url))
            .map((s) => ({
                id: s.id,
                sceneNumber: s.sceneNumber,
                url: s.generatedVideo!.url,
                label: `Scene ${s.sceneNumber}`,
            }));
    }, [allScenes, scene.id]);

    const buildVideoPrompt = (activeMotionPrompt: string) => {
        return buildSeedancePrompt({
            scene,
            motionPrompt: activeMotionPrompt,
            scopedRefs,
            continuityMemoryLines,
            refSources: builtRefSources.length > 0 ? builtRefSources : undefined,
            videoMode: isSeedanceTextMode ? 'text' : isSeedanceReferenceMode ? 'reference' : 'standard',
            extensionDurationSeconds: scene.videoCapability === 'extension' ? extensionSeconds : undefined,
        });
    };

    const composePromptWithAI = async (activeMotionPrompt: string): Promise<string> => {
        setIsComposingPrompt(true);
        try {
            // Build the exact @token map so Gemini binds reference-to-video inputs
            // positionally (@图片N / @视频N / @音频N) instead of composing prose-only.
            const AT_PREFIX: Record<SceneRefSource['kind'], string> = { image: '图片', video: '视频', audio: '音频' };
            const USAGE_LABEL: Record<string, string> = {
                identity: 'identity/身份', camera: 'camera/运镜', motion: 'motion/动作',
                effect: 'effect/特效', voice: 'voice/音色', music: 'music/配乐', environment: 'environment/场景',
            };
            const refTokenHints = builtRefSources
                .filter((s) => typeof s.atIndex === 'number' && s.atIndex > 0)
                .map((s) => {
                    const token = `@${AT_PREFIX[s.kind]}${s.atIndex}`;
                    const name = scopedRefs.find((r) => r.id === s.refId)?.name;
                    return `${token} = ${USAGE_LABEL[s.usage] || s.usage}${name ? ` (<${name}>)` : ''}`;
                });
            const videoMode: Scene['videoMode'] = isSeedanceTextMode ? 'text' : isSeedanceReferenceMode ? 'reference' : 'standard';
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
                    videoMode,
                    refTokenHints,
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

        // image-to-video 模式需要起幀；reference-to-video 模式只需要參考圖；text-to-video 不需要起幀或參考圖
        if (!isReferenceMode && !isSeedanceTextMode && !effectiveStartFrameUrl) {
            alert('請先生成場景圖片');
            return;
        }
        if (isReferenceMode && referenceImageUrls.length === 0 && parsedVideoRefUrls.length === 0 && parsedAudioRefUrls.length === 0) {
            alert('Reference-to-video 模式需要至少一個參考素材（圖片 / 影片 / 音訊）');
            return;
        }
        if (isRefMixOverflow) {
            alert(`Seedance ref 模式合計上限 ${SEEDANCE_MIXED_TOTAL_MAX} 個素材（目前 ${totalRefCount}），請減少參考。`);
            return;
        }

        setIsGenerating(true);

        try {
            const requestedDurationSeconds = seedanceDuration;
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
            // reference-to-video 與 text-to-video 模式不強制起幀；image-to-video 模式必須
            const startImageUrl = effectiveStartFrameUrl || '';
            if (!isReferenceMode && !isSeedanceTextMode && !startImageUrl.trim()) {
                throw new Error('Missing start image URL');
            }

            // 呼叫生成 API
            const response = await fetch('/api/fal/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageUrl: startImageUrl,
                    prompt: composedPrompt,
                    model: 'seedance',
                    seedanceVariant,
                    duration: seedanceDuration,
                    aspectRatio: seedanceAspectRatio,
                    resolution: seedanceResolution,
                    enableAudio: seedanceEnableAudio,
                    endImageUrl: !isReferenceMode && !isSeedanceTextMode && shouldUseEndFrameForVideo ? scene.generatedEndFrame?.url : undefined,
                    referenceImageUrls: isReferenceMode ? referenceImageUrls : undefined,
                    referenceVideoUrls: isSeedanceReferenceMode && parsedVideoRefUrls.length > 0 ? parsedVideoRefUrls : undefined,
                    referenceAudioUrls: isSeedanceReferenceMode && parsedAudioRefUrls.length > 0 ? parsedAudioRefUrls : undefined,
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
    const canGenerateVideo = isSeedanceTextMode
        ? true
        : isSeedanceReferenceMode
            ? (referenceImageUrls.length + parsedVideoRefUrls.length + parsedAudioRefUrls.length) > 0 && !isRefMixOverflow
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
                            {hasStartFrame ? '已就緒' : (isReferenceMode || isSeedanceTextMode) ? '不使用' : '尚未就緒'}
                        </p>
                    </div>
                    <div className="surface-inset px-3 py-2">
                        <p className="text-xs text-slate-500">尾幀</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {(isReferenceMode || isSeedanceTextMode) ? '不使用' : shouldUseEndFrameForVideo ? (hasEndFrame ? '已就緒' : '尚未就緒') : '不使用'}
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
                            Reference-to-Video 模式（{referenceImageUrls.length}/{SEEDANCE_REF_MAX} 張參考圖）
                        </p>
                        <p className="mt-0.5 text-[11px] opacity-80">
                            自動帶入場景相關的角色 / 商品參考圖，不使用起幀 / 尾幀
                        </p>
                    </div>
                )}

                {isSeedanceTextMode && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                        <p className="font-medium">Text-to-Video 模式</p>
                        <p className="mt-0.5 text-[11px] opacity-80">
                            純文字生成，不使用起幀 / 尾幀 / 參考圖；請在下方「提示詞」區完整描述場景內容。
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
                            placeholder="點擊上方按鈕，讓 AI 根據場景與參考規則組合可直接送 Seedance 的提示詞"
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

            <div className="surface-panel space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">影片生成模式</h4>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            可用參考圖：{scopedRefs.filter((ref) => Boolean(ref.url?.trim())).length} 張（角色 / 商品）
                        </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        目前：{isSeedanceTextMode ? 'Text-to-Video 模式' : isReferenceMode ? 'Reference 模式' : '起始幀模式'}
                    </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => setSeedanceVariant('v20_i2v')}
                        disabled={isGenerationLocked}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            !isReferenceMode && !isSeedanceTextMode
                                ? 'border-primary/40 bg-primary/10 text-foreground'
                                : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <p className="font-medium">起始幀模式（image-to-video）</p>
                        <p className="mt-0.5 opacity-80">使用本場景已生成的首幀（必要時搭配尾幀）來生成影片，主體直接沿用畫面構圖。</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeedanceVariant('v20_ref')}
                        disabled={isGenerationLocked}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            isReferenceMode
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                                : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <p className="font-medium">Reference 模式（多參考圖→影片）推薦</p>
                        <p className="mt-0.5 opacity-80">直接帶入角色 / 商品參考圖（最多 {SEEDANCE_REF_MAX} 張），對保持角色臉部、商品 logo 一致最有效，且不再需要尾幀。</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => setSeedanceVariant('v20_t2v')}
                        disabled={isGenerationLocked}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                            isSeedanceTextMode
                                ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                                : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <p className="font-medium">Text-to-Video 模式（純文字）</p>
                        <p className="mt-0.5 opacity-80">不需要首幀或參考圖，僅由提示詞從零生成影片。適合概念探索或沒有現成素材時。</p>
                    </button>
                </div>
            </div>

            {isSeedanceReferenceMode && (
                <div className="surface-panel space-y-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Seedance 多模態參考素材</h4>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                圖片 {referenceImageUrls.length}/{SEEDANCE_REF_MAX}　影片 {parsedVideoRefUrls.length}/{SEEDANCE_VIDEO_REF_MAX}　音訊 {parsedAudioRefUrls.length}/{SEEDANCE_AUDIO_REF_MAX}　合計 {totalRefCount}/{SEEDANCE_MIXED_TOTAL_MAX}
                            </p>
                        </div>
                        {isRefMixOverflow && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                合計超過 {SEEDANCE_MIXED_TOTAL_MAX} 檔上限
                            </span>
                        )}
                    </div>

                    {referenceImageUrls.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                圖片參考（自動帶入場景相關角色 / 商品，可逐張指定用途）
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {referenceImageUrls.map((url, idx) => {
                                    const matchedRef = scopedRefs.find((ref) => ref.url === url);
                                    const refId = matchedRef?.id || `image-${idx + 1}`;
                                    const currentUsage = imageRefUsageMap[refId] || 'identity';
                                    return (
                                        <div key={refId} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white/60 p-2 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                @圖片{idx + 1}
                                            </span>
                                            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                                                {matchedRef?.name || '未命名參考'}
                                            </span>
                                            <select
                                                value={currentUsage}
                                                onChange={(e) => setImageRefUsageMap((prev) => ({ ...prev, [refId]: e.target.value as SceneRefSourceUsage }))}
                                                disabled={isGenerationLocked}
                                                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] dark:border-slate-600 dark:bg-slate-800"
                                            >
                                                {USAGE_OPTIONS.filter((opt) => opt.kinds.includes('image')).map((opt) => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                            影片參考 URLs（每行一個，最多 {SEEDANCE_VIDEO_REF_MAX} 個；2-15 秒、解析度 ≤720p、單檔 &lt;50MB）
                        </label>
                        <textarea
                            value={videoRefUrlsText}
                            onChange={(e) => setVideoRefUrlsText(e.target.value)}
                            placeholder="https://… (mp4 / mov)"
                            disabled={isGenerationLocked}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                        />
                        {parsedVideoRefUrls.length > 0 && (
                            <p className="text-[11px] text-slate-500">
                                將以 {parsedVideoRefUrls.map((_, i) => `@視頻${i + 1}`).join(' / ')} 送進提示詞
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                            音訊參考 URLs（每行一個，最多 {SEEDANCE_AUDIO_REF_MAX} 個；總時長 ≤15 秒，單檔 &lt;15MB）
                        </label>
                        <textarea
                            value={audioRefUrlsText}
                            onChange={(e) => setAudioRefUrlsText(e.target.value)}
                            placeholder="https://… (mp3 / wav)"
                            disabled={isGenerationLocked}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 font-mono text-[11px] text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                        />
                        {parsedAudioRefUrls.length > 0 && (
                            <p className="text-[11px] text-slate-500">
                                將以 {parsedAudioRefUrls.map((_, i) => `@音頻${i + 1}`).join(' / ')} 送進提示詞
                            </p>
                        )}
                    </div>
                </div>
            )}

            {onCapabilityUpdated && (
                <div className="surface-panel space-y-3 p-4">
                    <div>
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Seedance 進階能力</h4>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            指定 Seedance 2.0 的專屬能力：延長同一鏡、在既有片段上編輯、或鎖定一鏡到底。
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">能力類型</label>
                            <select
                                value={scene.videoCapability || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const capability = val ? (val as NonNullable<Scene['videoCapability']>) : undefined;
                                    const updates: Partial<Pick<Scene, 'videoCapability' | 'extendsSceneId' | 'editSourceSceneId' | 'oneShot'>> = {
                                        videoCapability: capability,
                                    };
                                    if (capability !== 'extension') updates.extendsSceneId = undefined;
                                    if (capability !== 'edit') updates.editSourceSceneId = undefined;
                                    onCapabilityUpdated(updates);
                                }}
                                disabled={isGenerationLocked}
                                className="w-full rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                            >
                                <option value="">（無 / 一般生成）</option>
                                <option value="consistency">consistency（身份鎖定）</option>
                                <option value="camera_ref">camera_ref（運鏡複刻）</option>
                                <option value="effect_ref">effect_ref（特效 / 轉場）</option>
                                <option value="extension">extension（延長同一鏡）</option>
                                <option value="edit">edit（在現有片段上編輯）</option>
                                <option value="emotion">emotion（情緒演繹）</option>
                            </select>
                        </div>

                        {scene.videoCapability === 'extension' && (
                            <>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                        要延長的來源鏡（必須已生成影片）
                                    </label>
                                    <select
                                        value={scene.extendsSceneId || ''}
                                        onChange={(e) => onCapabilityUpdated({ extendsSceneId: e.target.value || undefined })}
                                        disabled={isGenerationLocked || videoSourceCandidates.length === 0}
                                        className="w-full rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                    >
                                        <option value="">—</option>
                                        {videoSourceCandidates.map((c) => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                    {videoSourceCandidates.length === 0 && (
                                        <p className="text-[11px] text-amber-600">沒有可延長的來源（其他場景尚未生成影片）</p>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                        新增秒數（3-10s）
                                    </label>
                                    <input
                                        type="number"
                                        min={3}
                                        max={10}
                                        value={extensionSeconds}
                                        onChange={(e) => setExtensionSeconds(Math.max(3, Math.min(10, Number(e.target.value) || 5)))}
                                        disabled={isGenerationLocked}
                                        className="w-full rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                    />
                                </div>
                            </>
                        )}

                        {scene.videoCapability === 'edit' && (
                            <div className="space-y-1 sm:col-span-1">
                                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                                    要編輯的來源鏡
                                </label>
                                <select
                                    value={scene.editSourceSceneId || ''}
                                    onChange={(e) => onCapabilityUpdated({ editSourceSceneId: e.target.value || undefined })}
                                    disabled={isGenerationLocked || videoSourceCandidates.length === 0}
                                    className="w-full rounded-lg border border-border/80 bg-white/80 px-2 py-1.5 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                >
                                    <option value="">—</option>
                                    {videoSourceCandidates.map((c) => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                                {videoSourceCandidates.length === 0 && (
                                    <p className="text-[11px] text-amber-600">沒有可編輯的來源（其他場景尚未生成影片）</p>
                                )}
                            </div>
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={Boolean(scene.oneShot)}
                            onChange={(e) => onCapabilityUpdated({ oneShot: e.target.checked || undefined })}
                            disabled={isGenerationLocked}
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        一鏡到底（插入「一镜到底 + 全程不切镜头」指令，與 transition = continuation 搭配最佳）
                    </label>
                </div>
            )}

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
                                        <option value="v20_i2v">Seedance 2.0 Image-to-Video（起+尾幀）</option>
                                        <option value="v20_i2v_fast">Seedance 2.0 Fast Image-to-Video（快速版，最高 720p）</option>
                                        <option value="v20_ref">Seedance 2.0 Reference-to-Video（多參考：最多 9 圖 / 3 片 / 3 音）</option>
                                        <option value="v20_ref_fast">Seedance 2.0 Fast Reference-to-Video（快速版）</option>
                                        <option value="v20_t2v">Seedance 2.0 Text-to-Video（純文字生成）</option>
                                        <option value="v20_t2v_fast">Seedance 2.0 Fast Text-to-Video（快速版）</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                            長寬比
                                        </label>
                                        <select
                                            value={seedanceAspectRatio}
                                            onChange={(event) => setSeedanceAspectRatio(event.target.value as SeedanceAspectRatio)}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                        >
                                            <option value="auto">Auto（依來源 / 參考圖決定）</option>
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
                                            解析度{isSeedanceFastVariant && <span className="ml-1 text-[11px] text-slate-500">（Fast 版本最高 720p）</span>}
                                        </label>
                                        <select
                                            value={seedanceResolution}
                                            onChange={(event) => setSeedanceResolution(event.target.value as SeedanceResolution)}
                                            disabled={isGenerationLocked}
                                            className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                                        >
                                            <option value="480p">480p (快速)</option>
                                            <option value="720p">720p (平衡)</option>
                                            {!isSeedanceFastVariant && (
                                                <option value="1080p">1080p (高畫質)</option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        影片長度 (4-15 秒)
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={4}
                                            max={15}
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
                    {isReferenceMode
                        ? '請在專案參考圖區加入至少一張角色 / 商品圖'
                        : !hasStartFrame ? '請先在「圖片」頁面生成場景圖片' : '目前無法生成影片'}
                </p>
            )}
        </div>
    );
}
