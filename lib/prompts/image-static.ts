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

const RELATIVE_PREFIX_PATTERNS: RegExp[] = [
  /^(same|still|remain(?:s)?|now|then|after(?:ward)?|previously|as before)\b[\s,:-]*/i,
  /^(同樣|依舊|仍然|保持|現在|接著|然後|之後|回到|改為|移到|移至)[\s,:，。-]*/,
];

const RELATIVE_ONLY_PATTERNS: RegExp[] = [
  /^(same|still|unchanged|as before|maintained)\.?$/i,
  /^(同樣|依舊|不變|保持不變|維持不變|保持一致|維持一致)。?$/,
];

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。！？;；])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function looksLikeMotionSentence(sentence: string): boolean {
  return MOTION_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));
}

function stripRelativePrefix(sentence: string): string {
  let output = sentence.trim();
  RELATIVE_PREFIX_PATTERNS.forEach((pattern) => {
    output = output.replace(pattern, '').trim();
  });
  return output;
}

function normalizeStaticSentence(sentence: string): string {
  if (!sentence) return '';
  if (looksLikeMotionSentence(sentence)) return '';

  const stripped = stripRelativePrefix(sentence)
    .replace(/\b(after|then|during|while)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return '';
  if (RELATIVE_ONLY_PATTERNS.some((pattern) => pattern.test(stripped))) return '';
  return stripped;
}

function uniqueSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  return sentences.filter((sentence) => {
    const key = sentence.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sanitizeStaticFrameDescription(text: string): string {
  const source = text?.trim() || '';
  if (!source) return '';

  const sentences = splitSentences(source)
    .map(normalizeStaticSentence)
    .filter(Boolean);
  const cleaned = uniqueSentences(sentences).join(' ').trim();

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
