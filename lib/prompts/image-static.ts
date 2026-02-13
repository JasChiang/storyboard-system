const MOTION_SENTENCE_PATTERNS: RegExp[] = [
  /\b(pan|panning|tilt|zoom|dolly|truck|orbit|track(?:ing)?|push(?:\s+in|\s+out)?|pull(?:\s+in|\s+out)?)\b/i,
  /\b(camera\s+move|camera\s+movement|camera\s+motion|movement\s+to)\b/i,
  /\b(after|then|during|while|as\s+the\s+camera)\b/i,
  /(鏡頭|運鏡|平移|推進|拉遠|環繞|跟拍|移動到|轉到|切到|橫移|縱移)/,
];

const RELATIVE_CUE_PATTERNS: RegExp[] = [
  /\b(same|still|remain|remains|now|shifted|moved|after|then)\b/i,
  /(同樣|依舊|保持|仍然|改為|移到|移至|之後|接著|現在)/,
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function looksLikeMotionSentence(sentence: string): boolean {
  return MOTION_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));
}

function removeMotionSentences(text: string): string {
  const sentences = splitSentences(text);
  const filtered = sentences.filter((sentence) => !looksLikeMotionSentence(sentence));
  return filtered.join(' ').trim();
}

export function sanitizeStaticFrameDescription(text: string): string {
  const source = text?.trim() || '';
  if (!source) return '';

  const cleaned = removeMotionSentences(source)
    .replace(/\b(after|then|during|while)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || source;
}

export function buildStaticFrameDescription(
  baseDescription: string,
  frameDescription: string | undefined,
  isEndFrame: boolean
): string {
  const base = sanitizeStaticFrameDescription(baseDescription || '');
  const frame = sanitizeStaticFrameDescription(frameDescription || '');

  if (!isEndFrame) return frame || base;
  if (!frame) return base;

  const hasRelativeCue = RELATIVE_CUE_PATTERNS.some((pattern) => pattern.test(frameDescription || ''));
  if (!hasRelativeCue) return frame;

  if (!base) return frame;
  return `${base} Final frame target: ${frame}`.trim();
}

