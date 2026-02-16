'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Mic2, Music2, CheckCircle2, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fal } from '@fal-ai/client';
import type {
  ElevenLabsMusicPromptIdea,
  IndexTtsScenePlan,
  IndexTtsScenePlanningInput,
} from '@/lib/types/audio';
import type { Scene, Storyboard } from '@/lib/types/storyboard';

interface AudioGeneratorPanelProps {
  projectId: string;
  storyboard: Storyboard;
  onVoiceoversGenerated: (
    updates: Array<{
      sceneId: string;
      generatedVoiceover: Scene['generatedVoiceover'];
    }>
  ) => void;
  onMusicGenerated: (music: Storyboard['generatedMusic']) => void;
}

type MusicProvider = 'elevenlabs' | 'minimax';

interface PollAudioResult {
  url: string;
  durationSeconds?: number;
  raw: Record<string, unknown>;
}

function extractAudioUrl(raw: Record<string, unknown>): string | null {
  const audio = raw.audio;
  if (typeof audio === 'string' && audio.trim()) return audio.trim();
  if (audio && typeof audio === 'object') {
    const maybeUrl = (audio as { url?: unknown }).url;
    if (typeof maybeUrl === 'string' && maybeUrl.trim()) return maybeUrl.trim();
  }
  const audios = raw.audios;
  if (Array.isArray(audios) && audios.length > 0) {
    const first = audios[0] as { url?: unknown };
    if (typeof first?.url === 'string' && first.url.trim()) return first.url.trim();
  }
  const output = raw.output;
  if (output && typeof output === 'object') {
    const maybeUrl = (output as { url?: unknown }).url;
    if (typeof maybeUrl === 'string' && maybeUrl.trim()) return maybeUrl.trim();
  }
  const maybeOutputAudio = raw.output_audio;
  if (maybeOutputAudio && typeof maybeOutputAudio === 'object') {
    const maybeUrl = (maybeOutputAudio as { url?: unknown }).url;
    if (typeof maybeUrl === 'string' && maybeUrl.trim()) return maybeUrl.trim();
  }
  const url = raw.url;
  if (typeof url === 'string' && url.trim()) return url.trim();
  return null;
}

function extractAudioDurationSeconds(raw: Record<string, unknown>): number | undefined {
  const candidates: unknown[] = [
    raw.duration,
    raw.duration_seconds,
    raw.audio_duration,
    raw.durationSec,
    raw.audio && typeof raw.audio === 'object' ? (raw.audio as { duration?: unknown }).duration : undefined,
    Array.isArray(raw.audios) && raw.audios[0] && typeof raw.audios[0] === 'object'
      ? (raw.audios[0] as { duration?: unknown }).duration
      : undefined,
  ];

  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVoiceoverPlans(raw: unknown): IndexTtsScenePlan[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const plan = item as Record<string, unknown>;
      const payload = plan.payload;
      if (!payload || typeof payload !== 'object') return null;

      const payloadRecord = payload as Record<string, unknown>;
      const sceneId = typeof plan.sceneId === 'string' ? plan.sceneId.trim() : '';
      const prompt = typeof payloadRecord.prompt === 'string' ? payloadRecord.prompt.trim() : '';
      const audioUrl = typeof payloadRecord.audio_url === 'string' ? payloadRecord.audio_url.trim() : '';

      if (!sceneId || !prompt || !audioUrl) return null;

      return {
        sceneId,
        sceneNumber: Number(plan.sceneNumber) || 0,
        sourceLabel: plan.sourceLabel === 'dialogue' ? 'dialogue' : 'description',
        sourceText: typeof plan.sourceText === 'string' ? plan.sourceText : '',
        payload: {
          ...payloadRecord,
          audio_url: audioUrl,
          prompt,
        },
        reasoning: typeof plan.reasoning === 'string' ? plan.reasoning : undefined,
      } as IndexTtsScenePlan;
    })
    .filter((plan): plan is IndexTtsScenePlan => plan !== null);
}

function normalizeMusicPromptIdeas(raw: unknown): ElevenLabsMusicPromptIdea[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rawItem = item as Record<string, unknown>;
      const prompt = typeof rawItem.prompt === 'string' ? rawItem.prompt.trim() : '';
      if (!prompt) return null;
      const energyRaw = typeof rawItem.energy === 'string' ? rawItem.energy.trim().toLowerCase() : '';
      const energy = energyRaw === 'low' || energyRaw === 'medium' || energyRaw === 'high'
        ? energyRaw
        : undefined;
      return {
        prompt,
        reasoning: typeof rawItem.reasoning === 'string' ? rawItem.reasoning.trim() : undefined,
        mood: typeof rawItem.mood === 'string' ? rawItem.mood.trim() : undefined,
        energy,
      } as ElevenLabsMusicPromptIdea;
    })
    .filter((item): item is ElevenLabsMusicPromptIdea => item !== null);
}

function normalizeVoiceoverPayloadForSubmit(payload: IndexTtsScenePlan['payload']): IndexTtsScenePlan['payload'] {
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  const normalized: IndexTtsScenePlan['payload'] = {
    ...payload,
    prompt,
  };

  if (typeof payload.emotion_prompt === 'string') {
    const emotionPrompt = payload.emotion_prompt.trim();
    if (emotionPrompt) {
      normalized.emotion_prompt = emotionPrompt;
    } else {
      delete normalized.emotion_prompt;
    }
  }

  return normalized;
}

export function AudioGeneratorPanel({
  projectId,
  storyboard,
  onVoiceoversGenerated,
  onMusicGenerated,
}: AudioGeneratorPanelProps) {
  const [isPlanningVoiceovers, setIsPlanningVoiceovers] = useState(false);
  const [isPlanningMusicPrompts, setIsPlanningMusicPrompts] = useState(false);
  const [isGeneratingVoiceovers, setIsGeneratingVoiceovers] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicProvider, setMusicProvider] = useState<MusicProvider>('elevenlabs');
  const [musicPrompt, setMusicPrompt] = useState(
    'Cinematic commercial background music, warm modern tone, no vocals, clean mix, suitable for product storytelling.'
  );
  const [minimaxLyricsPrompt, setMinimaxLyricsPrompt] = useState('');
  const [musicDurationSec, setMusicDurationSec] = useState<number>(
    Math.max(8, Math.round(storyboard.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0)))
  );
  const [voiceRefUrl, setVoiceRefUrl] = useState('');
  const [emotionalVoiceRefUrl, setEmotionalVoiceRefUrl] = useState('');
  const [isUploadingVoiceRef, setIsUploadingVoiceRef] = useState(false);
  const [isUploadingEmotionalVoiceRef, setIsUploadingEmotionalVoiceRef] = useState(false);
  const [voiceDirection, setVoiceDirection] = useState(
    '以自然口語旁白呈現，語速穩定，貼合商業影片節奏，避免過度誇張。'
  );
  const [voiceoverPlans, setVoiceoverPlans] = useState<IndexTtsScenePlan[]>([]);
  const [musicPromptIdeas, setMusicPromptIdeas] = useState<ElevenLabsMusicPromptIdea[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const voiceRefInputRef = useRef<HTMLInputElement>(null);
  const emotionalVoiceRefInputRef = useRef<HTMLInputElement>(null);

  const scenesWithVideo = useMemo(
    () => storyboard.scenes.filter((scene) => Boolean(scene.generatedVideo?.url)),
    [storyboard.scenes]
  );
  const scenesWithVoiceover = useMemo(
    () => storyboard.scenes.filter((scene) => Boolean(scene.generatedVoiceover?.url)),
    [storyboard.scenes]
  );

  const existingVoiceRefUrl = useMemo(() => {
    const fromPayload = storyboard.scenes.find((scene) => scene.generatedVoiceover?.requestPayload?.audio_url)
      ?.generatedVoiceover?.requestPayload?.audio_url;
    return (fromPayload || '').trim();
  }, [storyboard.scenes]);

  const existingEmotionalVoiceRefUrl = useMemo(() => {
    const fromPayload = storyboard.scenes.find((scene) => scene.generatedVoiceover?.requestPayload?.emotional_audio_url)
      ?.generatedVoiceover?.requestPayload?.emotional_audio_url;
    return (fromPayload || '').trim();
  }, [storyboard.scenes]);

  useEffect(() => {
    if (!voiceRefUrl && existingVoiceRefUrl) {
      setVoiceRefUrl(existingVoiceRefUrl);
    }
  }, [existingVoiceRefUrl, voiceRefUrl]);

  useEffect(() => {
    if (!emotionalVoiceRefUrl && existingEmotionalVoiceRefUrl) {
      setEmotionalVoiceRefUrl(existingEmotionalVoiceRefUrl);
    }
  }, [existingEmotionalVoiceRefUrl, emotionalVoiceRefUrl]);

  const voiceoverPlanInputs = useMemo<IndexTtsScenePlanningInput[]>(() => {
    return scenesWithVideo.reduce<IndexTtsScenePlanningInput[]>((acc, scene) => {
      const dialogue = (scene.dialogue || '').trim();
      const description = (scene.description || '').trim();
      const sourceText = dialogue || description;
      if (!sourceText) return acc;

      acc.push({
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        duration: scene.duration || 1,
        description,
        dialogue,
        notes: scene.notes,
        sourceLabel: dialogue ? 'dialogue' : 'description',
        sourceText,
      });
      return acc;
    }, []);
  }, [scenesWithVideo]);

  const voiceoverPlanMap = useMemo(
    () => new Map(voiceoverPlans.map((item) => [item.sceneId, item])),
    [voiceoverPlans]
  );

  const sceneIdsWithVoiceover = useMemo(
    () => new Set(scenesWithVoiceover.map((scene) => scene.id)),
    [scenesWithVoiceover]
  );
  const voiceoverMissingCount = voiceoverPlanInputs.filter(
    (scene) => !sceneIdsWithVoiceover.has(scene.sceneId)
  ).length;
  const missingPlanCount = voiceoverPlanInputs.filter((item) => !voiceoverPlanMap.has(item.sceneId)).length;
  const hasMusic = Boolean(storyboard.generatedMusic?.url);
  const totalStoryDuration = useMemo(
    () => Math.max(1, Math.round(storyboard.scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0))),
    [storyboard.scenes]
  );
  const musicIdeaSceneInputs = useMemo(() => {
    return storyboard.scenes
      .map((scene) => ({
        sceneNumber: scene.sceneNumber,
        duration: scene.duration || 1,
        description: (scene.description || '').trim(),
        dialogue: (scene.dialogue || '').trim(),
        notes: (scene.notes || '').trim(),
        cameraMovement: (scene.cameraMovement || '').trim(),
      }))
      .filter((scene) => scene.description || scene.dialogue || scene.notes)
      .slice(0, 12);
  }, [storyboard.scenes]);

  const voiceoverInputsSignature = useMemo(
    () => JSON.stringify(voiceoverPlanInputs.map((item) => ({
      sceneId: item.sceneId,
      sceneNumber: item.sceneNumber,
      duration: item.duration,
      sourceLabel: item.sourceLabel,
      sourceText: item.sourceText,
    }))),
    [voiceoverPlanInputs]
  );

  useEffect(() => {
    setVoiceoverPlans([]);
  }, [voiceRefUrl, emotionalVoiceRefUrl, voiceDirection, voiceoverInputsSignature]);

  useEffect(() => {
    setMusicPromptIdeas([]);
  }, [musicPrompt, musicProvider, musicIdeaSceneInputs.length]);

  const uploadAudioReference = async (
    file: File,
    mode: 'voice' | 'emotional'
  ) => {
    if (!file.type.startsWith('audio/')) {
      throw new Error('請上傳音訊檔案（audio/*）');
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new Error('音訊檔案過大，請上傳小於 25MB 的檔案');
    }

    if (mode === 'voice') {
      setIsUploadingVoiceRef(true);
      setStatusMessage('上傳聲音參考檔中...');
    } else {
      setIsUploadingEmotionalVoiceRef(true);
      setStatusMessage('上傳情緒參考檔中...');
    }

    try {
      const uploadedUrl = await fal.storage.upload(file);
      if (mode === 'voice') {
        setVoiceRefUrl(uploadedUrl);
      } else {
        setEmotionalVoiceRefUrl(uploadedUrl);
      }
      setStatusMessage('音訊上傳完成。');
    } finally {
      if (mode === 'voice') {
        setIsUploadingVoiceRef(false);
      } else {
        setIsUploadingEmotionalVoiceRef(false);
      }
    }
  };

  const handleVoiceRefFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    try {
      await uploadAudioReference(file, 'voice');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '主聲音參考上傳失敗');
    } finally {
      if (voiceRefInputRef.current) {
        voiceRefInputRef.current.value = '';
      }
    }
  };

  const handleEmotionalVoiceRefFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    try {
      await uploadAudioReference(file, 'emotional');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '情緒參考上傳失敗');
    } finally {
      if (emotionalVoiceRefInputRef.current) {
        emotionalVoiceRefInputRef.current.value = '';
      }
    }
  };

  const pollAudioStatus = async (requestId: string, endpoint: string): Promise<PollAudioResult> => {
    const maxAttempts = 100;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch('/api/fal/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          endpoint,
          type: 'audio',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Audio status check failed');
      }

      if (payload.status === 'COMPLETED') {
        const raw = payload.result as Record<string, unknown>;
        const url = extractAudioUrl(raw);
        if (!url) {
          throw new Error('Audio generation completed but no audio URL returned');
        }
        return {
          url,
          durationSeconds: extractAudioDurationSeconds(raw),
          raw,
        };
      }

      if (payload.status === 'FAILED') {
        throw new Error(payload.error || 'Audio generation failed');
      }

      const delayMs = Math.min(15000, 2000 * Math.pow(1.4, attempts));
      await wait(delayMs);
      attempts += 1;
    }

    throw new Error('Audio generation timeout');
  };

  const buildVoiceoverPlans = async (): Promise<IndexTtsScenePlan[]> => {
    const normalizedAudioUrl = voiceRefUrl.trim();
    if (!normalizedAudioUrl) {
      throw new Error('請先上傳主聲音參考檔');
    }
    if (voiceoverPlanInputs.length === 0) {
      throw new Error('目前沒有可生成旁白的場景（需先有影片且有對白/描述）。');
    }

    setIsPlanningVoiceovers(true);
    setErrorMessage(null);
    setStatusMessage('AI 正在分析場景並生成旁白參數...');

    try {
      const response = await fetch('/api/openrouter/generate-voiceover-params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboardTitle: storyboard.title,
          originalPrompt: storyboard.originalPrompt,
          voiceDirection: voiceDirection.trim() || undefined,
          audioUrl: normalizedAudioUrl,
          emotionalAudioUrl: emotionalVoiceRefUrl.trim() || undefined,
          scenes: voiceoverPlanInputs,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'AI 旁白參數生成失敗');
      }

      const plans = normalizeVoiceoverPlans(payload?.data?.plans);
      if (plans.length === 0) {
        throw new Error('AI 回傳空的旁白參數');
      }

      setVoiceoverPlans(plans);
      setStatusMessage(`AI 旁白參數已更新：${plans.length} 個場景。`);
      return plans;
    } finally {
      setIsPlanningVoiceovers(false);
    }
  };

  const buildMusicPromptIdeas = async (): Promise<ElevenLabsMusicPromptIdea[]> => {
    if (musicIdeaSceneInputs.length === 0) {
      throw new Error('目前缺少可供分析的場景內容，無法產生音樂提示詞建議。');
    }

    setIsPlanningMusicPrompts(true);
    setErrorMessage(null);
    setStatusMessage('AI 正在分析分鏡並產生 ElevenLabs 音樂提示詞建議...');

    try {
      const response = await fetch('/api/openrouter/generate-music-prompt-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyboardTitle: storyboard.title,
          originalPrompt: storyboard.originalPrompt,
          currentPrompt: musicPrompt.trim() || undefined,
          targetDurationSec: totalStoryDuration,
          scenes: musicIdeaSceneInputs,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'AI 音樂提示詞建議生成失敗');
      }

      const ideas = normalizeMusicPromptIdeas(payload?.data?.ideas).slice(0, 3);
      if (ideas.length === 0) {
        throw new Error('AI 沒有回傳可用的音樂提示詞建議');
      }

      setMusicPromptIdeas(ideas);
      return ideas;
    } finally {
      setIsPlanningMusicPrompts(false);
    }
  };

  const handleAnalyzeAndUpdateParams = async () => {
    if (isBusy) return;
    setErrorMessage(null);

    const tasks: string[] = [];
    const errors: string[] = [];
    let voiceUpdatedCount = 0;
    let musicUpdatedCount = 0;

    const canAnalyzeVoice = voiceoverPlanInputs.length > 0 && Boolean(voiceRefUrl.trim());
    const canAnalyzeMusic = musicProvider === 'elevenlabs' && musicIdeaSceneInputs.length > 0;

    if (!canAnalyzeVoice && !canAnalyzeMusic) {
      if (!voiceRefUrl.trim()) {
        setErrorMessage('請先上傳主聲音參考檔，或先切到 ElevenLabs 以取得音樂提示詞建議。');
      } else {
        setErrorMessage('目前沒有可分析的旁白/音樂資料。');
      }
      return;
    }

    try {
      if (canAnalyzeVoice) {
        tasks.push('旁白');
        const plans = await buildVoiceoverPlans();
        voiceUpdatedCount = plans.length;
      } else if (voiceoverPlanInputs.length > 0) {
        errors.push('略過旁白參數更新（未上傳主聲音參考檔）');
      }

      if (canAnalyzeMusic) {
        tasks.push('音樂');
        const ideas = await buildMusicPromptIdeas();
        musicUpdatedCount = ideas.length;
      } else if (musicProvider === 'elevenlabs') {
        errors.push('略過音樂提示詞建議（缺少可分析場景）');
      }

      if (tasks.length > 0) {
        const parts: string[] = [];
        if (voiceUpdatedCount > 0) parts.push(`旁白 ${voiceUpdatedCount} 場`);
        if (musicUpdatedCount > 0) parts.push(`音樂建議 ${musicUpdatedCount} 筆`);
        setStatusMessage(`AI 分析完成：${parts.join('，') || '已更新'}。`);
      }
      if (errors.length > 0) {
        setErrorMessage(errors.join('；'));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'AI 分析更新失敗');
    }
  };

  const handleGenerateVoiceovers = async () => {
    const normalizedAudioUrl = voiceRefUrl.trim();
    if (!normalizedAudioUrl) {
      setErrorMessage('Index TTS 2 需要主聲音參考檔，請先上傳。');
      return;
    }
    if (voiceoverPlanInputs.length === 0) {
      setErrorMessage('目前沒有可生成旁白的場景（需先有影片且有對白/描述）。');
      return;
    }

    setIsGeneratingVoiceovers(true);
    setErrorMessage(null);
    setStatusMessage('開始生成場景旁白...');

    try {
      let plans = voiceoverPlans;
      const hasMissingPlan = voiceoverPlanInputs.some((scene) => !voiceoverPlanMap.has(scene.sceneId));
      if (plans.length === 0 || hasMissingPlan) {
        plans = await buildVoiceoverPlans();
      }

      const planMap = new Map(plans.map((plan) => [plan.sceneId, plan]));
      const firstEmptyPromptScene = voiceoverPlanInputs.find((scene) => {
        const plan = planMap.get(scene.sceneId);
        if (!plan) return false;
        return !normalizeVoiceoverPayloadForSubmit(plan.payload).prompt;
      });
      if (firstEmptyPromptScene) {
        throw new Error(`場景 ${firstEmptyPromptScene.sceneNumber} 的旁白文字為空，請先補上。`);
      }
      const updates: Array<{
        sceneId: string;
        generatedVoiceover: Scene['generatedVoiceover'];
      }> = [];

      for (let i = 0; i < voiceoverPlanInputs.length; i++) {
        const sceneInput = voiceoverPlanInputs[i];
        const plan = planMap.get(sceneInput.sceneId);
        if (!plan) continue;
        const requestInput = normalizeVoiceoverPayloadForSubmit(plan.payload);

        setStatusMessage(`旁白生成中 (${i + 1}/${voiceoverPlanInputs.length})：場景 ${sceneInput.sceneNumber}`);

        const response = await fetch('/api/fal/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'voiceover',
            provider: 'index-tts-2',
            input: requestInput,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || `場景 ${sceneInput.sceneNumber} 旁白提交失敗`);
        }

        const requestId = payload.request_id as string;
        const endpoint = payload.endpoint as string;
        if (!requestId || !endpoint) {
          throw new Error(`場景 ${sceneInput.sceneNumber} 旁白缺少 request_id/endpoint`);
        }

        const result = await pollAudioStatus(requestId, endpoint);
        updates.push({
          sceneId: sceneInput.sceneId,
          generatedVoiceover: {
            url: result.url,
            model: 'index-tts-2',
            script: requestInput.prompt,
            prompt: requestInput.emotion_prompt || undefined,
            requestPayload: requestInput,
            reasoning: plan.reasoning,
            durationSeconds: result.durationSeconds,
            timestamp: new Date().toISOString(),
          },
        });
      }

      if (updates.length === 0) {
        setStatusMessage('沒有新的旁白被生成。');
        return;
      }

      onVoiceoversGenerated(updates);
      setStatusMessage(`旁白生成完成：已更新 ${updates.length} 個場景。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '旁白生成失敗');
    } finally {
      setIsGeneratingVoiceovers(false);
    }
  };

  const updateVoiceoverPlanPayload = (
    sceneId: string,
    updater: (payload: IndexTtsScenePlan['payload']) => IndexTtsScenePlan['payload']
  ) => {
    setVoiceoverPlans((prev) => prev.map((plan) => {
      if (plan.sceneId !== sceneId) return plan;
      return {
        ...plan,
        payload: updater(plan.payload),
      };
    }));
  };

  const handleGenerateMusic = async () => {
    const prompt = musicPrompt.trim();
    if (!prompt) {
      setErrorMessage('請先輸入音樂提示詞。');
      return;
    }

    setIsGeneratingMusic(true);
    setErrorMessage(null);
    setStatusMessage('背景音樂生成中...');

    try {
      const response = await fetch('/api/fal/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'music',
          provider: musicProvider,
          prompt,
          durationSec: musicProvider === 'elevenlabs' ? musicDurationSec : undefined,
          lyricsPrompt: musicProvider === 'minimax' ? minimaxLyricsPrompt.trim() || undefined : undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '背景音樂提交失敗');
      }

      const requestId = payload.request_id as string;
      const endpoint = payload.endpoint as string;
      if (!requestId || !endpoint) {
        throw new Error('背景音樂缺少 request_id/endpoint');
      }

      const result = await pollAudioStatus(requestId, endpoint);
      onMusicGenerated({
        url: result.url,
        model: musicProvider === 'elevenlabs' ? 'elevenlabs-music' : 'minimax-music-v2',
        prompt,
        durationSeconds: result.durationSeconds,
        timestamp: new Date().toISOString(),
      });
      setStatusMessage('背景音樂生成完成。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '背景音樂生成失敗');
    } finally {
      setIsGeneratingMusic(false);
    }
  };

  const isBusy = isPlanningVoiceovers
    || isPlanningMusicPrompts
    || isGeneratingVoiceovers
    || isGeneratingMusic
    || isUploadingVoiceRef
    || isUploadingEmotionalVoiceRef;

  return (
    <div className="max-w-4xl mx-auto mb-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-5 space-y-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">音訊生成（FAL）</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            專案 {projectId.slice(0, 8)}...：可批量生成場景旁白，或生成整支背景音樂。
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-right">
          <p>旁白：{scenesWithVoiceover.length}/{voiceoverPlanInputs.length}</p>
          <p>背景音樂：{hasMusic ? '已生成' : '未生成'}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">場景旁白（Index TTS 2）</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            對有影片且有文字內容的場景批量生成 VO。缺少旁白場景：{voiceoverMissingCount}
          </p>

          <div className="space-y-2">
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              聲音參考（必填，會自動上傳成 audio_url）
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => voiceRefInputRef.current?.click()}
                disabled={isBusy}
                className="shrink-0"
              >
                {isUploadingVoiceRef ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    上傳主聲音
                  </>
                )}
              </Button>
              {voiceRefUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setVoiceRefUrl('')}
                  disabled={isBusy}
                  className="text-slate-600 dark:text-slate-300"
                >
                  <X className="mr-1 h-4 w-4" />
                  清除
                </Button>
              )}
            </div>
            <input
              ref={voiceRefInputRef}
              type="file"
              accept="audio/*"
              onChange={handleVoiceRefFileChange}
              disabled={isBusy}
              className="hidden"
            />
            {voiceRefUrl ? (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2 space-y-1.5">
                <audio src={voiceRefUrl} controls className="w-full h-8" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 break-all">{voiceRefUrl}</p>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">尚未上傳主聲音參考檔</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-600 dark:text-slate-300">
              情緒參考音檔（可選，會自動上傳成 emotional_audio_url）
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => emotionalVoiceRefInputRef.current?.click()}
                disabled={isBusy}
                className="shrink-0"
              >
                {isUploadingEmotionalVoiceRef ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    上傳中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    上傳情緒音檔
                  </>
                )}
              </Button>
              {emotionalVoiceRefUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmotionalVoiceRefUrl('')}
                  disabled={isBusy}
                  className="text-slate-600 dark:text-slate-300"
                >
                  <X className="mr-1 h-4 w-4" />
                  清除
                </Button>
              )}
            </div>
            <input
              ref={emotionalVoiceRefInputRef}
              type="file"
              accept="audio/*"
              onChange={handleEmotionalVoiceRefFileChange}
              disabled={isBusy}
              className="hidden"
            />
            {emotionalVoiceRefUrl && (
              <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2 space-y-1.5">
                <audio src={emotionalVoiceRefUrl} controls className="w-full h-8" />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 break-all">{emotionalVoiceRefUrl}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-600 dark:text-slate-300">旁白導演指令（給 AI）</label>
            <textarea
              value={voiceDirection}
              onChange={(event) => setVoiceDirection(event.target.value)}
              disabled={isBusy}
              rows={3}
              className="w-full rounded-lg border border-border/70 bg-white/85 dark:bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
            />
          </div>

          <Button
            onClick={handleAnalyzeAndUpdateParams}
            disabled={isBusy || (
              (voiceoverPlanInputs.length === 0 || !voiceRefUrl.trim())
              && !(musicProvider === 'elevenlabs' && musicIdeaSceneInputs.length > 0)
            )}
            variant="outline"
            className="w-full"
          >
            {isPlanningVoiceovers || isPlanningMusicPrompts ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 分析更新中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                AI 分析並更新參數（旁白 + 音樂）
              </>
            )}
          </Button>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                送出內容預覽（Index TTS `input`）
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {voiceoverPlanInputs.length} 筆{missingPlanCount > 0 ? `，待 AI ${missingPlanCount} 筆` : ''}
              </span>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {voiceoverPlanInputs.length === 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  目前沒有可送出的旁白內容。
                </p>
              )}

              {voiceoverPlanInputs.map((item) => {
                const plan = voiceoverPlanMap.get(item.sceneId);
                return (
                  <div
                    key={item.sceneId}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-2"
                  >
                    <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      場景 {item.sceneNumber} · source: {item.sourceLabel} · {item.duration}s
                    </p>
                    {!plan ? (
                      <>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                          {item.sourceText}
                        </p>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                          尚未產生 AI payload
                        </p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">來源文字</p>
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                            {item.sourceText}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] text-slate-500 dark:text-slate-400">
                            旁白文字（prompt，可編輯）
                          </label>
                          <textarea
                            value={plan.payload.prompt}
                            onChange={(event) => {
                              const value = event.target.value;
                              updateVoiceoverPlanPayload(item.sceneId, (payload) => ({
                                ...payload,
                                prompt: value,
                              }));
                            }}
                            disabled={isBusy}
                            rows={2}
                            className="w-full rounded-md border border-border/70 bg-white/85 dark:bg-slate-900/70 px-2 py-1.5 text-[11px] leading-snug focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
                          />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-500 dark:text-slate-400">
                              語氣提示（emotion_prompt，可選）
                            </label>
                            <textarea
                              value={plan.payload.emotion_prompt || ''}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateVoiceoverPlanPayload(item.sceneId, (payload) => {
                                  if (!value.trim()) {
                                    const nextPayload = { ...payload };
                                    delete nextPayload.emotion_prompt;
                                    return nextPayload;
                                  }
                                  return {
                                    ...payload,
                                    emotion_prompt: value,
                                    should_use_prompt_for_emotion: true,
                                  };
                                });
                              }}
                              disabled={isBusy}
                              rows={2}
                              className="w-full rounded-md border border-border/70 bg-white/85 dark:bg-slate-900/70 px-2 py-1.5 text-[11px] leading-snug focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-500 dark:text-slate-400">
                              語氣強度（strength 0~1，可選）
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={typeof plan.payload.strength === 'number' ? plan.payload.strength : ''}
                              onChange={(event) => {
                                const raw = event.target.value;
                                updateVoiceoverPlanPayload(item.sceneId, (payload) => {
                                  if (!raw.trim()) {
                                    const nextPayload = { ...payload };
                                    delete nextPayload.strength;
                                    return nextPayload;
                                  }
                                  const parsed = Number(raw);
                                  if (!Number.isFinite(parsed)) return payload;
                                  return {
                                    ...payload,
                                    strength: Math.max(0, Math.min(1, parsed)),
                                  };
                                });
                              }}
                              disabled={isBusy}
                              className="w-full rounded-md border border-border/70 bg-white/85 dark:bg-slate-900/70 px-2 py-1.5 text-[11px] leading-snug focus:outline-none focus:ring-2 focus:ring-ring/30"
                            />
                          </div>
                        </div>

                        <details className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-2 py-1.5">
                          <summary className="cursor-pointer text-[10px] text-slate-500 dark:text-slate-400">
                            查看原始 payload JSON
                          </summary>
                          <pre className="mt-1 text-[10px] leading-snug text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words overflow-x-auto">
                            {JSON.stringify(plan.payload, null, 2)}
                          </pre>
                        </details>

                        {plan.reasoning && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            AI：{plan.reasoning}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              實際請求格式：{' '}
              <code className="font-mono">
                {`{"kind":"voiceover","provider":"index-tts-2","input":{"audio_url":"...","prompt":"..."}}`}
              </code>
            </p>
          </div>

          <Button
            onClick={handleGenerateVoiceovers}
            disabled={isBusy || voiceoverPlanInputs.length === 0 || !voiceRefUrl.trim()}
            className="w-full"
          >
            {isGeneratingVoiceovers ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成旁白中...
              </>
            ) : (
              <>
                <Mic2 className="mr-2 h-4 w-4" />
                批量生成旁白
              </>
            )}
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3 bg-white/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">背景音樂（BGM）</h3>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-600 dark:text-slate-300">模型</label>
            <select
              value={musicProvider}
              onChange={(event) => setMusicProvider(event.target.value as MusicProvider)}
              disabled={isBusy}
              className="w-full rounded-lg border border-border/70 bg-white/85 dark:bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
            >
              <option value="elevenlabs">ElevenLabs Music（可控秒數）</option>
              <option value="minimax">MiniMax Music v2</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs text-slate-600 dark:text-slate-300">音樂提示詞</label>
            <textarea
              value={musicPrompt}
              onChange={(event) => setMusicPrompt(event.target.value)}
              disabled={isBusy}
              rows={4}
              className="w-full rounded-lg border border-border/70 bg-white/85 dark:bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
            />
          </div>

          {musicProvider === 'elevenlabs' && musicPromptIdeas.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  AI 音樂提示詞建議（ElevenLabs）
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {musicPromptIdeas.length} 筆
                </span>
              </div>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {musicPromptIdeas.map((idea, index) => (
                  <div
                    key={`${index}-${idea.prompt.slice(0, 24)}`}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-2"
                  >
                    <p className="text-[11px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                      {idea.prompt}
                    </p>
                    {(idea.mood || idea.energy) && (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {idea.mood ? `mood: ${idea.mood}` : ''}{idea.mood && idea.energy ? ' · ' : ''}{idea.energy ? `energy: ${idea.energy}` : ''}
                      </p>
                    )}
                    {idea.reasoning && (
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        AI：{idea.reasoning}
                      </p>
                    )}
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => setMusicPrompt(idea.prompt)}
                        className="h-7 text-[11px]"
                      >
                        套用這個提示詞
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {musicProvider === 'elevenlabs' && (
            <div className="space-y-2">
              <label className="block text-xs text-slate-600 dark:text-slate-300">目標長度（秒）</label>
              <input
                type="number"
                min={3}
                max={600}
                step={1}
                value={musicDurationSec}
                onChange={(event) => setMusicDurationSec(Number(event.target.value))}
                disabled={isBusy}
                className="w-full rounded-lg border border-border/70 bg-white/85 dark:bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          )}

          {musicProvider === 'minimax' && (
            <div className="space-y-2">
              <label className="block text-xs text-slate-600 dark:text-slate-300">歌詞提示（可選）</label>
              <textarea
                value={minimaxLyricsPrompt}
                onChange={(event) => setMinimaxLyricsPrompt(event.target.value)}
                disabled={isBusy}
                rows={2}
                className="w-full rounded-lg border border-border/70 bg-white/85 dark:bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-y"
              />
            </div>
          )}

          <Button
            onClick={handleGenerateMusic}
            disabled={isBusy || !musicPrompt.trim()}
            className="w-full"
          >
            {isGeneratingMusic ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成音樂中...
              </>
            ) : (
              <>
                <Music2 className="mr-2 h-4 w-4" />
                生成背景音樂
              </>
            )}
          </Button>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-800 dark:text-green-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {errorMessage}
        </div>
      )}
    </div>
  );
}
