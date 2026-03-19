'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Settings2 } from 'lucide-react';
import { ReferenceUploader } from './ReferenceUploader';
import { ImagePreview } from './ImagePreview';
import { Button } from '@/components/ui/button';
import type { Scene, ProjectReference, StyleProfile, SharedContinuityDirective } from '@/lib/types/storyboard';
import { buildStaticFrameDescription, sanitizeStaticFrameDescription } from '@/lib/prompts/image-static';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';
import { normalizePromptParts } from '@/lib/prompts/prompt-normalizer';
import { buildSceneDirectiveLines } from '@/lib/prompts/scene-directives';
import { buildStyleDirectiveLines } from '@/lib/prompts/style-directives';
import { getReferenceTag, getSceneRequiredTags } from '@/lib/references/scene-references';
import { splitSceneReferencesByPriority } from '@/lib/references/reference-routing';
import { buildPrioritizedReferenceUrls } from '@/lib/references/reference-priority';
import { buildIdentityLockPromptLine, buildStructuredIdentityLock } from '@/lib/references/identity-lock';
import { IMAGE_GENERATION_MODEL_LABELS, type ImageGenerationModel } from '@/lib/constants/image-models';
import { formatBlockersForAlert, getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

function truncatePromptLine(value: string, max = 260): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max - 3)}...`;
}

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
    const sceneReferenceScope = {
        description: scene.description,
        cameraMovement: scene.cameraMovement,
        shotIntent: scene.shotIntent,
        startComposition: scene.startComposition,
        viewIntent: scene.viewIntent,
        charactersUsed: scene.charactersUsed || [],
        productsUsed: scene.productsUsed || [],
        requiredReferences: scene.requiredReferences || [],
    };
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
    const optionalScopedRefs = sceneScopedContentRefs.filter((ref) => !requiredProjectRefIds.has(ref.id));
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
        if (requiredOnly.length > 0) {
            setSelectedProjectRefs((prev) => (areStringArraysEqual(prev, requiredOnly) ? prev : requiredOnly));
            return;
        }

        const sceneMatched = splitSceneReferencesByPriority(
            {
                description: scene.description,
                cameraMovement: scene.cameraMovement,
                shotIntent: scene.shotIntent,
                startComposition: scene.startComposition,
                viewIntent: scene.viewIntent,
                charactersUsed: scene.charactersUsed || [],
                productsUsed: scene.productsUsed || [],
                requiredReferences: scene.requiredReferences || [],
            },
            contentProjectReferences,
            { fallbackPolicy: 'non_environment' }
        );
        const sceneMatchedIds = [...sceneMatched.primary, ...sceneMatched.secondary].map((ref) => ref.id);
        if (sceneMatchedIds.length > 0) {
            setSelectedProjectRefs((prev) => (areStringArraysEqual(prev, sceneMatchedIds) ? prev : sceneMatchedIds));
            return;
        }

        const fallback = contentProjectReferences[0]?.id ? [contentProjectReferences[0].id] : [];
        setSelectedProjectRefs((prev) => (areStringArraysEqual(prev, fallback) ? prev : fallback));
    }, [
        contentProjectReferences,
        requiredProjectRefIds,
        scene.id,
        scene.description,
        scene.charactersUsed,
        scene.productsUsed,
        scene.requiredReferences,
        sceneCharactersKey,
        sceneProductsKey,
        sceneRequiredRefsKey,
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
        const selectedRequiredRefs = selectedPrimaryRefs.filter((ref) => requiredProjectRefIds.has(ref.id));
        const selectedOptionalPrimaryRefs = selectedPrimaryRefs.filter((ref) => !requiredProjectRefIds.has(ref.id));
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
            requiredContentRefs: [...selectedRequiredRefs, ...selectedOptionalPrimaryRefs],
            optionalContentRefs: selectedSecondaryRefs,
            styleReferenceUrls: selectedStyleReferenceUrls,
            prioritizeContentRefs: !options?.includeStartFrameForEnd,
            strictRequiredOnlyWhenPresent: true,
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
        const effectiveDeltaSpec = scene.endFrameDeltaSpec;
        const hasExplicitDelta = Boolean(effectiveEndFrameDelta.trim());
        const cameraMovementLower = (scene.cameraMovement || '').toLowerCase();
        const hasCharacterRefs = sceneScopedContentRefs.some((ref) => ref.type === 'character');
        const hasProductRefs = sceneScopedContentRefs.some((ref) => ref.type === 'product');
        const hasIdentityRefs = hasCharacterRefs || hasProductRefs;
        const hasLockVisibleText = sceneScopedContentRefs.some(
            (ref) => ref.ipProfile?.textLogoPolicy === 'lock_visible_text'
        );
        const hasForbidNewText = sceneScopedContentRefs.some(
            (ref) => ref.ipProfile?.textLogoPolicy === 'forbid_new_text'
        );
        const hasReferenceInputs = Boolean(
            referenceImage
            || sceneScopedContentRefs.length > 0
            || selectedStyleReferenceUrls.length > 0
            || (isEndFrame && scene.generatedImage?.url)
            || (!isEndFrame && previousEndFrameUrl)
        );
        const lockedReferenceLine = requiredScopedRefs.length > 0
            ? `Locked references for this shot: ${requiredScopedRefs.map((ref) => ref.name ? `<${ref.name}>` : ref.type).join(', ')}.`
            : '';
        const primaryRefLine = routedSceneRefs.primary.length > 0
            ? `Primary reference views for this shot: ${routedSceneRefs.primary.map((ref) => `${ref.name ? `<${ref.name}>` : ref.type}${ref.angle ? `(${ref.angle})` : ''}`).join(', ')}.`
            : '';
        const secondaryRefLine = routedSceneRefs.secondary.length > 0
            ? `Secondary supporting references: ${routedSceneRefs.secondary.map((ref) => `${ref.name ? `<${ref.name}>` : ref.type}${ref.angle ? `(${ref.angle})` : ''}`).join(', ')}.`
            : '';
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
            target.push(`View intent for this shot: ${sceneViewIntent}. Match the image viewpoint accordingly.`);
            if (primaryRefLine) target.push(primaryRefLine);
            if (secondaryRefLine) target.push(secondaryRefLine);
            if (lockedReferenceLine) {
                target.push(lockedReferenceLine);
            }
            target.push('Reference usage protocol: uploaded content references are hard constraints for identity, geometry, materials, logos, and visible text.');
            target.push('If text instructions conflict with locked references, locked references win.');
            target.push('If multiple reference images are different angles of the same product/character, keep one unified identity and do not blend with other designs.');
        };

        // Tail frame "delta-only" mode:
        // Use start frame as ground truth and only describe required changes.
        if (isEndFrame && scene.generatedImage?.url) {
            const deltaParts: string[] = [];
            const safeCustomPrompt = customPrompt ? sanitizeStaticFrameDescription(customPrompt) : '';

            if (!safeCustomPrompt) {
                deltaParts.push(effectiveEndFrameDelta || effectiveEndFrameDescription);
            } else {
                switch (promptMode) {
                    case 'replace':
                        deltaParts.push(safeCustomPrompt);
                        break;
                    case 'append':
                        deltaParts.push(effectiveEndFrameDelta || effectiveEndFrameDescription);
                        deltaParts.push(safeCustomPrompt);
                        break;
                    case 'prepend':
                        deltaParts.push(safeCustomPrompt);
                        deltaParts.push(effectiveEndFrameDelta || effectiveEndFrameDescription);
                        break;
                }
            }

            const minimalParts: string[] = [];
            pushReferenceHardConstraints(minimalParts);
            minimalParts.push(...buildStyleDirectiveLines(styleProfile, { stage: 'image_end' }));
            minimalParts.push(...buildSceneDirectiveLines(scene));
            minimalParts.push(...continuityMemoryLines);

            minimalParts.push('Use the generated start frame as the single source of truth.');
            minimalParts.push(
                'Maintain the exact appearance of all referenced subjects from the provided reference images; for products, preserve geometry, proportions, materials, color, logo/text, and control layout.'
            );
            minimalParts.push(
                '保持所有參考主體的外觀一致；若是商品，必須維持幾何形狀、比例、材質、顏色、Logo/文字與按鍵介面布局。'
            );
            minimalParts.push('Camera movement/reframing is allowed, but keep scene geometry and object continuity physically consistent.');
            minimalParts.push('Keep static environment layout unchanged: walls, bed, nightstand, lamp, curtain, and furniture must keep the same world relationships.');
            if (hasCharacterRefs) {
                minimalParts.push('Keep character continuity unchanged unless explicitly requested: face structure, body proportions, outfit silhouette/materials, and accessories must remain the same.');
            }
            if (hasProductRefs) {
                minimalParts.push('Keep product continuity unchanged unless explicitly requested: geometry, proportions, material finish, colorway, logo/text placement, and control layout (buttons/ports/camera arrangement) must remain the same.');
            }
            minimalParts.push('Keep movable-object continuity unchanged unless explicitly requested: phone/props position, orientation, and interaction state must remain consistent with start frame.');
            minimalParts.push(`Apply only this end-frame delta: ${deltaParts.join('. ')}`);
            if (effectiveDeltaSpec?.reframingGoal) {
                minimalParts.push(`Reframing target: ${effectiveDeltaSpec.reframingGoal}`);
            }
            if (effectiveDeltaSpec?.subjectScaleChangePct) {
                minimalParts.push(`Subject screen-size change target: ${effectiveDeltaSpec.subjectScaleChangePct}`);
            }
            if (effectiveDeltaSpec?.newVisibleArea) {
                minimalParts.push(`New visible area target: ${effectiveDeltaSpec.newVisibleArea}`);
            }
            if (effectiveDeltaSpec?.mustNotChange?.length) {
                minimalParts.push(`Must not change: ${effectiveDeltaSpec.mustNotChange.join(', ')}`);
            }
            minimalParts.push('Only make minimal local edits required by the delta; do not globally recompose the scene.');
            minimalParts.push('Do not move existing objects unless the delta explicitly requests it.');
            if (hasExplicitDelta) {
                minimalParts.push('The final frame must show a clearly noticeable composition change from the start frame according to the delta.');
                minimalParts.push('Do not return a near-duplicate of the start frame when delta requests reframing.');
            }
            if (/dolly|push in|pull out|zoom|拉近|拉遠|變焦/.test(cameraMovementLower)) {
                minimalParts.push('Camera move must be interpreted as camera reframing/parallax, not object scaling.');
                minimalParts.push('Do not scale, stretch, or enlarge the product/body to fake camera movement.');
            }
            if (/pan|tilt|平移|搖鏡|轉向/.test(cameraMovementLower)) {
                minimalParts.push('Pan/tilt must preserve world-space object positions; only framing window changes.');
                minimalParts.push('Do not translate anchored objects to fake pan/tilt.');
            }
            minimalParts.push('Return one final-state still frame, not a transition sequence.');

            if (hasLockVisibleText || hasForbidNewText) {
                minimalParts.push('If logos/text are visible, keep spelling, shape, and placement unchanged unless explicitly requested.');
            }

            minimalParts.push('允許鏡頭重構圖，但必須維持首圖空間與物件連續性。');
            minimalParts.push('僅依尾圖差異指令做最小局部改動，不得整體重排場景。');
            minimalParts.push(`尾圖差異指令：${deltaParts.join('。')}`);

            return normalizePromptParts(minimalParts, 5000);
        }

        const parts: string[] = [];
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
            consistencyGuardrails.push(
                'Keep product part topology unchanged: component count/layout (doors, seams, handles, feet, buttons, ports, camera clusters) must match references exactly.'
            );
        }
        if (!hasIdentityRefs && !referenceImage) {
            consistencyGuardrails.push(
                'Keep key object identity and layout continuity stable unless explicitly requested.'
            );
        }
        pushReferenceHardConstraints(parts);
        parts.push(...buildStyleDirectiveLines(styleProfile, { stage: isEndFrame ? 'image_end' : 'image_start' }));
        parts.push(...buildSceneDirectiveLines(scene));
        parts.push(...continuityMemoryLines);

        // 先放入場景主描述，避免長提示詞被截斷時遺失核心構圖要求
        const sceneDescription = buildStaticFrameDescription(
            scene.description,
            isEndFrame ? effectiveEndFrameDescription : scene.description,
            isEndFrame
        );
        if (!customPrompt) {
            parts.push(sceneDescription);
        } else {
            switch (promptMode) {
                case 'replace':
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    break;
                case 'append':
                    parts.push(sceneDescription);
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    break;
                case 'prepend':
                    parts.push(sanitizeStaticFrameDescription(customPrompt));
                    parts.push(sceneDescription);
                    break;
            }
        }
        parts.push('Generate one static frame only. Do not describe camera movement or temporal progression.');
        parts.push(...consistencyGuardrails);
        if (isEndFrame && scene.generatedImage?.url) {
            parts.push('Use the generated start frame as the primary continuity reference.');
            parts.push('Start-frame continuity has higher priority than generic stylistic interpretation.');
            parts.push('Camera movement/reframing is allowed, but keep the scene geometry physically consistent.');
            parts.push('Lock room geometry and environment layout across frames: keep all static objects (walls, bed, nightstand, lamp, curtain, furniture) in consistent world positions, scale, and orientation relative to each other.');
            parts.push('Preserve spatial relationships and depth ordering between static objects from the start frame.');
            parts.push('Preserve subject continuity from the start frame: keep character identity, body orientation, approximate body placement, and pose state unchanged unless explicitly requested.');
            parts.push('Preserve movable-object continuity from the start frame: keep phone/props location, orientation, and interaction state unchanged unless explicitly requested in the end-frame delta.');
            parts.push('Only apply minimal local edits explicitly requested by the end-frame delta; do not globally recompose the scene.');
            parts.push('If adding a new object, insert it into the existing composition without moving or resizing existing objects.');
            parts.push('Keep everything the same as the primary reference image. Only change what is explicitly described in the end-frame delta.');
            parts.push('Only change what is explicitly described in the end-frame delta; keep identity, product geometry, logo placement, and material characteristics unchanged.');
            parts.push('Return a final-state still frame composition, not a transition process.');
            parts.push('首圖連續性優先於一般風格詮釋。');
            parts.push('允許鏡頭位移與重構圖，但場景幾何關係必須維持一致。');
            parts.push('保持首圖空間幾何關係不變：牆面、床、床頭櫃、檯燈、窗簾等固定物件彼此位置、比例、朝向不可改動。');
            parts.push('保持首圖人物連續性：人物身份、身體朝向、大致位置與姿態狀態不可改動，除非尾圖描述明確要求。');
            parts.push('保持首圖可移動物件連續性：手機與道具的位置、朝向與互動狀態不可改動，除非尾圖描述明確要求。');
            parts.push('僅允許對明確指定區域做最小幅度編修，不得重排場景。');
        }
        if (!isEndFrame && previousEndFrameUrl) {
            parts.push('This scene continues from the previous scene end frame.');
            parts.push('Keep everything the same as the previous scene end frame unless this prompt explicitly changes it.');
            parts.push('Keep subject identity and key object consistency while updating only composition and action as described.');
        }

        // 1. 加入專案參考圖的描述作為上下文（內容參考優先於風格參考）
        if (selectedProjectRefs.length > 0) {
            if (sceneScopedContentRefs.length > 0) {
                parts.push('Content references:');
                sceneScopedContentRefs.forEach(ref => {
                    const nameTag = ref.name ? `<${ref.name}>` : ref.type;
                    const guidelineText = ref.guidelines ? ` (Rules: ${ref.guidelines})` : '';
                    parts.push(`${nameTag}: ${truncatePromptLine(ref.description, 220)}${guidelineText}`);
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
                if (selectedContentRefs.length > sceneScopedContentRefs.length) {
                    parts.push('Ignore non-tagged references for this shot; keep only the scene-mentioned identities.');
                }
            }
        }

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

        if (hasLockVisibleText) {
            parts.push('If brand text or logos are visible, keep them exactly legible and unchanged in spelling, shape, and placement.');
        }
        if (hasForbidNewText) {
            parts.push('Do not invent any new letters, numbers, brand marks, or package text.');
        }

        return normalizePromptParts(parts, 5000);
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
                    {scene.requiresEndFrame && (
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

            {!scene.requiresEndFrame && (
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
