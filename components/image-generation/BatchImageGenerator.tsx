'use client';

import { useState } from 'react';
import { Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Scene, ProjectReference, StyleProfile, SharedContinuityDirective } from '@/lib/types/storyboard';
import { buildStaticFrameDescription } from '@/lib/prompts/image-static';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';
import { normalizePromptParts } from '@/lib/prompts/prompt-normalizer';
import { buildSceneDirectiveLines } from '@/lib/prompts/scene-directives';
import { buildStyleDirectiveLines } from '@/lib/prompts/style-directives';
import { getReferenceTag, getSceneRelevantReferences, getSceneRequiredTags } from '@/lib/references/scene-references';
import { splitSceneReferencesByPriority } from '@/lib/references/reference-routing';
import { buildPrioritizedReferenceUrls } from '@/lib/references/reference-priority';
import { buildIdentityLockPromptLine, buildStructuredIdentityLock } from '@/lib/references/identity-lock';
import { IMAGE_GENERATION_MODEL_LABELS, type ImageGenerationModel } from '@/lib/constants/image-models';
import { resolveContinuationSource } from '@/lib/utils/transition';
import { formatBlockersForAlert, getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

function truncatePromptLine(value: string, max = 260): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max - 3)}...`;
}

interface BatchImageGeneratorProps {
    projectId: string;
    scenes: Scene[];
    projectReferences?: ProjectReference[];
    styleProfile?: StyleProfile;
    sharedAnchors?: string[];
    sharedContinuityDirectives?: SharedContinuityDirective[];
    onBatchComplete: (
        results: Map<string, { url: string; prompt: string; startSeed?: number; endFrameUrl?: string; endFramePrompt?: string; endFrameSeed?: number }>
    ) => void;
}

interface GenerationStatus {
    sceneId: string;
    status: 'pending' | 'generating' | 'generating_end_frame' | 'completed' | 'failed';
    imageUrl?: string;
    prompt?: string;
    endFrameUrl?: string;
    endFramePrompt?: string;
    startSeed?: number;
    endFrameSeed?: number;
    error?: string;
}

interface ContinuationContext {
    url: string;
    source: 'end' | 'start';
}

export function BatchImageGenerator({
    projectId,
    scenes,
    projectReferences = [],
    styleProfile,
    sharedAnchors = [],
    sharedContinuityDirectives = [],
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
    const [imageModel, setImageModel] = useState<ImageGenerationModel>('nano-banana-pro');

    const scenesToProcess = scenes.filter((scene) => {
        const needsStartFrame = !scene.generatedImage?.url;
        const wantsEndFrame = scene.requiresEndFrame || !!scene.endFrameDescription;
        const needsEndFrame = wantsEndFrame && !scene.generatedEndFrame?.url;
        return needsStartFrame || needsEndFrame;
    });
    const totalScenes = scenesToProcess.length;

    const updateStatus = (sceneId: string, update: Partial<GenerationStatus>) => {
        setStatuses(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(sceneId) || { sceneId, status: 'pending' as const };
            newMap.set(sceneId, { ...current, ...update });
            return newMap;
        });
    };

    const buildImagePrompt = (scene: Scene, isEndFrame: boolean = false) => {
        const parts: string[] = [];
        const routedSceneRefs = splitSceneReferencesByPriority(scene, contentProjectReferences, {
            fallbackPolicy: 'non_environment',
        });
        const sceneScopedContentRefs = routedSceneRefs.all;
        const hasCharacterRefs = sceneScopedContentRefs.some((ref) => ref.type === 'character');
        const hasProductRefs = sceneScopedContentRefs.some((ref) => ref.type === 'product');
        const hasIdentityRefs = hasCharacterRefs || hasProductRefs;
        const requiredTags = getSceneRequiredTags(scene);
        const requiredContentRefs = sceneScopedContentRefs.filter((ref) => {
            const tag = getReferenceTag(ref);
            return tag ? requiredTags.has(tag) : false;
        });
        const lockedReferenceLine = requiredContentRefs.length > 0
            ? `Locked references for this shot: ${requiredContentRefs.map((ref) => ref.name ? `<${ref.name}>` : ref.type).join(', ')}.`
            : '';
        const primaryRefLine = routedSceneRefs.primary.length > 0
            ? `Primary reference views for this shot: ${routedSceneRefs.primary.map((ref) => `${ref.name ? `<${ref.name}>` : ref.type}${ref.angle ? `(${ref.angle})` : ''}`).join(', ')}.`
            : '';
        const secondaryRefLine = routedSceneRefs.secondary.length > 0
            ? `Secondary supporting references: ${routedSceneRefs.secondary.map((ref) => `${ref.name ? `<${ref.name}>` : ref.type}${ref.angle ? `(${ref.angle})` : ''}`).join(', ')}.`
            : '';
        const consistencyGuardrails = [
            'Describe the scene in natural language, not keyword stuffing.',
            'Anchor identity and product geometry to reference images.',
            'Do not introduce new characters, props, logos, or text unless explicitly requested.',
        ];
        if (hasCharacterRefs) {
            consistencyGuardrails.push(
                'Keep face structure, hairstyle, body proportions, outfit silhouette/materials, and accessories unchanged unless explicitly requested.'
            );
        }
        if (hasProductRefs) {
            consistencyGuardrails.push(
                'Keep product identity unchanged: geometry, proportions, material finish, colorway, logo/text placement, and control layout (buttons/ports/camera arrangement) must remain the same unless explicitly requested.'
            );
        }
        if (!hasIdentityRefs && !scene.referenceImage) {
            consistencyGuardrails.push(
                'Keep key object identity and layout continuity stable unless explicitly requested.'
            );
        }
        const hasReferenceInputs = Boolean(
            scene.referenceImage
            || sceneScopedContentRefs.length > 0
            || selectedStyleReferenceUrls.length > 0
        );
        const continuityMemoryLines = buildContinuityMemoryLines(scene, scenes, {
            stage: isEndFrame ? 'image_end' : 'image_start',
            sharedAnchors,
            sharedContinuityDirectives,
        });
        const pushReferenceHardConstraints = (target: string[]) => {
            if (!hasReferenceInputs) return;
            target.push('Priority order: 1) locked reference identity/geometry/logo-text fidelity 2) scene composition directives 3) style treatment.');
            target.push('Reference images are provided via image_urls in this request. Treat them as visual ground truth, not optional inspiration.');
            target.push('If rendered output conflicts with reference identity or geometry, follow the reference images.');
            target.push(
                'Maintain the exact appearance of all referenced subjects from the provided reference images; for products, preserve geometry, proportions, materials, color, logo/text, and control layout.'
            );
            target.push(
                'For locked product references, never deform geometry, proportions, materials, logos/text, or control layout.'
            );
            target.push('Do not merge, split, add, or remove major product parts. Keep door count, door split ratio, and seam positions exactly as reference.');
            target.push(
                '保持所有參考主體的外觀一致；若是商品，必須維持幾何形狀、比例、材質、顏色、Logo/文字與按鍵介面布局。'
            );
            target.push(
                'Across any visual style preset, style directives may change rendering language only; locked subject identity and topology must remain exact.'
            );
            target.push(
                'Keep locked character identity exact (face/hair/body proportions/outfit silhouette/accessories) and locked product topology exact (part count/layout/seams/handles/feet/buttons/ports/cameras/logo/text).'
            );
            target.push(
                'If style negatives conflict with locked material identity, preserve locked material cues and only reduce excessive glare/noise.'
            );
            target.push(
                '不論套用任何風格模板，僅可改變渲染語彙，不可改變鎖定主體的身份與零件拓撲（角色臉型髮型與身形比例、商品門片/門縫/把手/底腳/按鍵與 Logo 位置）。'
            );
            target.push(`View intent for this shot: ${routedSceneRefs.viewIntent}. Match the image viewpoint accordingly.`);
            if (primaryRefLine) target.push(primaryRefLine);
            if (secondaryRefLine) target.push(secondaryRefLine);
            if (lockedReferenceLine) {
                target.push(lockedReferenceLine);
            }
            target.push('Reference usage protocol: uploaded content references are hard constraints for identity, geometry, materials, logos, and visible text.');
            target.push('If text instructions conflict with locked references, locked references win.');
            target.push('If multiple reference images are different angles of the same product/character, keep one unified identity and do not blend with other designs.');
        };

        pushReferenceHardConstraints(parts);
        parts.push(...buildStyleDirectiveLines(styleProfile, { stage: isEndFrame ? 'image_end' : 'image_start' }));
        parts.push(...buildSceneDirectiveLines(scene));
        parts.push(...continuityMemoryLines);

        // 核心畫面描述與約束先輸出，避免長提示詞被截斷時遺失
        parts.push(
            buildStaticFrameDescription(
                scene.description,
                isEndFrame
                    ? (scene.endFrameDescription
                        || (scene.endFrameDelta ? `${scene.description}。僅變更：${scene.endFrameDelta}` : scene.description))
                    : scene.description,
                isEndFrame
            )
        );
        if (isEndFrame && scene.endFrameDelta) {
            const cameraMovementLower = (scene.cameraMovement || '').toLowerCase();
            parts.push(`Apply only this end-frame delta: ${scene.endFrameDelta}`);
            if (scene.endFrameDeltaSpec?.reframingGoal) {
                parts.push(`Reframing target: ${scene.endFrameDeltaSpec.reframingGoal}`);
            }
            if (scene.endFrameDeltaSpec?.subjectScaleChangePct) {
                parts.push(`Subject screen-size change target: ${scene.endFrameDeltaSpec.subjectScaleChangePct}`);
            }
            if (scene.endFrameDeltaSpec?.newVisibleArea) {
                parts.push(`New visible area target: ${scene.endFrameDeltaSpec.newVisibleArea}`);
            }
            if (scene.endFrameDeltaSpec?.mustNotChange?.length) {
                parts.push(`Must not change: ${scene.endFrameDeltaSpec.mustNotChange.join(', ')}`);
            }
            parts.push('Only make minimal local edits required by the delta; do not globally recompose the scene.');
            parts.push('The final frame must show a clearly noticeable composition change from the start frame according to the delta.');
            parts.push('Do not return a near-duplicate of the start frame when delta requests reframing.');
            if (/dolly|push in|pull out|zoom|拉近|拉遠|變焦/.test(cameraMovementLower)) {
                parts.push('Camera move must be interpreted as camera reframing/parallax, not object scaling.');
                parts.push('Do not scale, stretch, or enlarge objects to fake camera movement.');
            }
            if (/pan|tilt|平移|搖鏡|轉向/.test(cameraMovementLower)) {
                parts.push('Pan/tilt must preserve world-space object positions; only framing changes.');
                parts.push('Do not translate anchored objects to fake pan/tilt.');
            }
        }
        parts.push('Generate one static frame only. Do not describe camera movement or temporal progression.');
        parts.push(...consistencyGuardrails);

        // 1. 加入專案參考圖的描述作為上下文（內容參考優先於風格參考）
        if (sceneScopedContentRefs.length > 0) {
            parts.push('Content references:');
            sceneScopedContentRefs.forEach(ref => {
                const nameTag = ref.name ? `<${ref.name}>` : ref.type;
                parts.push(`${nameTag}: ${truncatePromptLine(ref.description, 220)}`);
                const structuredLock = ref.structuredIdentityLock || buildStructuredIdentityLock(ref);
                if (structuredLock) {
                    parts.push(truncatePromptLine(buildIdentityLockPromptLine(structuredLock, nameTag), 320));
                }
                if (ref.mustKeepFeatures?.length) {
                    parts.push(`${nameTag} must keep: ${ref.mustKeepFeatures.slice(0, 8).join(', ')}`);
                }
                if (ref.ipProfile?.immutableRules?.length) {
                    parts.push(`${nameTag} hard rules: ${ref.ipProfile.immutableRules.slice(0, 5).join('; ')}`);
                }
                if (ref.ipProfile) {
                    parts.push(
                        `${nameTag} policy: identity=${ref.ipProfile.strictIdentity ? 'strict' : 'flexible'}, accessories=${ref.ipProfile.allowAccessoryChanges ? 'allowed' : 'locked'}`
                    );
                }
            });
        }

        if (selectedStyleReferenceUrls.length > 0) {
            parts.push('Style references:');
            styleProjectReferences
                .filter(ref => selectedStyleReferenceUrls.includes(ref.url))
                .forEach(ref => {
                    parts.push(`[style] ${ref.description}`);
                });
            parts.push('Preserve rendering style, texture language, color treatment, and lighting grammar from style references.');
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

        return normalizePromptParts(parts, 5000);
    };

    const generateSingleImage = async (
        scene: Scene,
        isEndFrame: boolean = false,
        options?: { primaryReferenceUrl?: string; continuityReferenceUrl?: string }
    ) => {
        const routedSceneRefs = splitSceneReferencesByPriority(scene, contentProjectReferences, {
            fallbackPolicy: 'non_environment',
        });
        const sceneScopedContentRefs = routedSceneRefs.all;
        const requiredTags = getSceneRequiredTags(scene);
        const requiredContentRefs = sceneScopedContentRefs.filter((ref) => {
            const tag = getReferenceTag(ref);
            return tag ? requiredTags.has(tag) : false;
        });
        const optionalContentRefs = sceneScopedContentRefs.filter((ref) => !requiredContentRefs.some((item) => item.id === ref.id));
        const hasAnyContentRefs = requiredContentRefs.length > 0 || optionalContentRefs.length > 0;
        const referenceImages = buildPrioritizedReferenceUrls({
            model: imageModel,
            stage: isEndFrame ? 'image_end' : 'image_start',
            priorityMode: scene.referencePriorityByStage?.[isEndFrame ? 'image_end' : 'image_start'] || scene.referencePriorityMode,
            continuityReferenceUrl: options?.continuityReferenceUrl,
            startFrameReferenceUrl: options?.primaryReferenceUrl,
            sceneReferenceUrl: scene.referenceImage,
            requiredContentRefs: routedSceneRefs.primary.filter((ref) => requiredTags.has(getReferenceTag(ref))),
            optionalContentRefs: routedSceneRefs.primary.filter((ref) => !requiredTags.has(getReferenceTag(ref))).concat(routedSceneRefs.secondary),
            styleReferenceUrls: selectedStyleReferenceUrls,
            prioritizeContentRefs: !isEndFrame,
            strictRequiredOnlyWhenPresent: true,
            includeStyleReferenceImages: !hasAnyContentRefs,
        });
        const prompt = normalizePromptParts([
            buildImagePrompt(scene, isEndFrame),
            isEndFrame && options?.primaryReferenceUrl
                ? 'Use the provided start frame as the primary continuity reference. Keep everything the same as the primary reference image. Only apply the explicit end-frame delta.'
                : '',
            isEndFrame
                ? 'Return a final-state still frame composition, not an intermediate motion step.'
                : '',
            !isEndFrame && options?.continuityReferenceUrl
                ? 'This scene should continue naturally from the previous scene end frame while preserving identity. Keep everything the same as the previous scene end frame unless this prompt explicitly changes it.'
                : '',
        ], 5000);
        const stage = isEndFrame ? 'image_end' : 'image_start';
        const taskId = crypto.randomUUID();
        const taskMetadata = {
            aspectRatio,
            resolution,
            referenceImageCount: referenceImages.length,
            referenceImages,
            isBatch: true,
        };

        await fetch('/api/workflow/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: taskId,
                projectId,
                sceneId: scene.id,
                stage,
                status: 'running',
                model: imageModel,
                prompt,
                inputUrl: referenceImages[0] || scene.referenceImage,
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
                referenceImage: referenceImages, // 結合場景個別參考圖與專案級參考圖
                aspectRatio,
                resolution,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            await fetch(`/api/workflow/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'failed',
                    error: data.error || 'Generation failed',
                }),
            });
            throw new Error(data.error || 'Generation failed');
        }
        if (!data.endpoint) {
            await fetch(`/api/workflow/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'failed',
                    error: 'Missing endpoint from server',
                }),
            });
            throw new Error('Missing endpoint from server');
        }

        // 輪詢狀態 - 使用 API 回傳的 endpoint
        const requestId = data.request_id;
        const endpoint = data.endpoint;
        await fetch(`/api/workflow/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metadata: {
                    ...taskMetadata,
                    requestId,
                    endpoint,
                },
            }),
        });

        const { imageUrl, seed } = await pollStatus(requestId, endpoint, taskId, taskMetadata);

        return { url: imageUrl, prompt, seed };
    };

    const generateSceneImages = async (scene: Scene, continuationContext?: ContinuationContext) => {
        const wantsEndFrame = scene.requiresEndFrame || !!scene.endFrameDescription;
        const continuationUrl = continuationContext?.url;
        // Continuation scenes always need their start frame refreshed with the latest previous scene source.
        const needsStartFrame = !scene.generatedImage?.url || Boolean(continuationUrl);
        const needsEndFrame = wantsEndFrame && !scene.generatedEndFrame?.url;

        updateStatus(scene.id, { status: needsStartFrame ? 'generating' : 'generating_end_frame' });

        try {
            type GeneratedFrame = { url: string; prompt: string; seed?: number };
            // 1. 生成或沿用首幀
            const startFrame: GeneratedFrame = needsStartFrame
                ? (
                    continuationUrl
                        ? {
                            url: continuationUrl,
                            prompt: `${buildImagePrompt(scene, false)}. Start frame reused from previous scene ${continuationContext?.source === 'start' ? 'start frame' : 'end frame'} due to continuation transition.`,
                            seed: undefined,
                        }
                        : await generateSingleImage(scene, false, {
                            continuityReferenceUrl: continuationUrl,
                        })
                )
                : {
                    url: scene.generatedImage!.url,
                    prompt: scene.generatedImage?.prompt || '',
                    seed: scene.generatedImage?.seed,
                };

            if (needsStartFrame) {
                updateStatus(scene.id, {
                    imageUrl: startFrame.url,
                    prompt: startFrame.prompt,
                    startSeed: startFrame.seed,
                });
            }

            // 2. 如果需要且尚未有尾幀，繼續生成
            if (needsEndFrame) {
                updateStatus(scene.id, { status: 'generating_end_frame' });

                const endFrame = await generateSingleImage(scene, true, {
                    primaryReferenceUrl: startFrame.url,
                });

                updateStatus(scene.id, {
                    status: 'completed',
                    endFrameUrl: endFrame.url,
                    endFramePrompt: endFrame.prompt,
                    endFrameSeed: endFrame.seed,
                });

                return {
                    url: startFrame.url,
                    prompt: startFrame.prompt,
                    startSeed: startFrame.seed,
                    endFrameUrl: endFrame.url,
                    endFramePrompt: endFrame.prompt,
                    endFrameSeed: endFrame.seed,
                };
            }

            // 3. 不需要生成尾幀，標記完成
            updateStatus(scene.id, { status: 'completed' });

            return {
                url: startFrame.url,
                prompt: startFrame.prompt,
                startSeed: startFrame.seed,
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
        endpoint: string,
        taskId: string,
        taskMetadata: Record<string, unknown>
    ): Promise<{ imageUrl: string; seed?: number }> => {
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
                const seed = typeof data.result?.seed === 'number' ? data.result.seed : undefined;
                await fetch(`/api/workflow/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'completed',
                        outputUrl: imageUrl,
                        metadata: {
                            ...taskMetadata,
                            requestId,
                            endpoint,
                            seed,
                        },
                    }),
                });
                return { imageUrl, seed };
            } else if (data.status === 'FAILED') {
                await fetch(`/api/workflow/tasks/${taskId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'failed',
                        error: data.error || 'Generation failed',
                    }),
                });
                throw new Error(data.error || 'Generation failed');
            }

            const delayMs = Math.min(15000, 2000 * Math.pow(1.5, attempts));
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

    const handleBatchGenerate = async () => {
        setIsGenerating(true);

        try {
            // 初始化狀態
            scenesToProcess.forEach(scene => {
                updateStatus(scene.id, { status: 'pending' });
            });

            const results = new Map<string, { url: string; prompt: string; startSeed?: number; endFrameUrl?: string; endFramePrompt?: string; endFrameSeed?: number }>();

            // 依序生成（避免超過 API 限制）
            for (const scene of scenesToProcess) {
                try {
                    const sceneIndex = scenes.findIndex(s => s.id === scene.id);
                    const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
                    const previousResult = previousScene ? results.get(previousScene.id) : undefined;
                    const previousContinuation = resolveContinuationSource(previousScene);
                    const continuationUrl = previousContinuation.url
                        ? (
                            previousContinuation.source === 'start'
                                ? (previousResult?.url || previousContinuation.url)
                                : (previousResult?.endFrameUrl || previousContinuation.url)
                        )
                        : undefined;
                    const continuationContext = continuationUrl
                        ? {
                            url: continuationUrl,
                            source: previousContinuation.source || 'end',
                        }
                        : undefined;

                    const wantsEndFrame = scene.requiresEndFrame || !!scene.endFrameDescription;
                    const needsStartFrame = !scene.generatedImage?.url || Boolean(continuationUrl);
                    const needsEndFrame = wantsEndFrame && !scene.generatedEndFrame?.url;
                    const startFrameBlockers = needsStartFrame
                        ? getSceneGenerationBlockers({
                            stage: 'image_start',
                            scene,
                            projectReferences,
                        })
                        : [];
                    const endFrameBlockers = needsEndFrame
                        ? getSceneGenerationBlockers({
                            stage: 'image_end',
                            scene,
                            projectReferences,
                            effectiveStartFrameUrl: continuationUrl || scene.generatedImage?.url,
                            allowPendingStartFrame: needsStartFrame,
                        })
                        : [];
                    const blockers = [...startFrameBlockers, ...endFrameBlockers];
                    if (blockers.length > 0) {
                        const firstError = blockers[0]?.message || 'Blocked by generation guard';
                        updateStatus(scene.id, {
                            status: 'failed',
                            error: firstError,
                        });
                        console.warn(`Skip scene ${scene.sceneNumber} due to blockers:\n${formatBlockersForAlert(blockers)}`);
                        continue;
                    }

                    const result = await generateSceneImages(scene, continuationContext);
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
                            為 {totalScenes} 個待處理場景自動生成圖片（缺首幀或缺尾幀）
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            圖片模型
                        </label>
                        <select
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value as ImageGenerationModel)}
                            disabled={isGenerating}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                       text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                        >
                            <option value="nano-banana-pro">{IMAGE_GENERATION_MODEL_LABELS['nano-banana-pro']}</option>
                            <option value="seedream-5-lite">{IMAGE_GENERATION_MODEL_LABELS['seedream-5-lite']}</option>
                        </select>
                    </div>

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
                        {scenesToProcess.map(scene => {
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
