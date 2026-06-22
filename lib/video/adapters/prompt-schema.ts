export interface VideoPromptInput {
  /** Camera movement instruction */
  cameraMotion: string;
  /** Subject action / what changes in the scene */
  actionLines: string[];
  /** Identity preservation (concise, one sentence) */
  identityLine?: string;
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

/**
 * Build a natural-language video prompt from structured input.
 *
 * Output order follows Seedance best practices:
 *   (@token identity, if any) → Action/Motion → Camera → generic identity
 *
 * No section labels (like "Subject state:") — just clean sentences.
 */
export function buildVideoPromptFromParts(input: VideoPromptInput): string {
  const parts: string[] = [];
  const identity = input.identityLine?.trim();
  // @token-based identity (reference-to-video, e.g. "Keep identity consistent
  // with @图片1") is the single most important constraint, yet
  // enforceVideoPromptPolicy truncates by keeping the FRONT of the prompt.
  // Front-load the identity line when it carries @tokens so it survives
  // truncation; otherwise keep the generic identity sentence at the end where it
  // reads more naturally.
  const identityIsAtToken = Boolean(identity && identity.includes('@'));
  if (identity && identityIsAtToken) {
    parts.push(identity);
  }

  // 1. Action / motion lines (highest priority after @token identity)
  const actions = dedupe(input.actionLines);
  if (actions.length > 0) {
    parts.push(actions.join('. '));
  }

  // 2. Camera motion
  const camera = input.cameraMotion.replace(/\s+/g, ' ').trim();
  if (camera) {
    parts.push(camera);
  }

  // 3. Generic identity preservation (no @tokens) at the end
  if (identity && !identityIsAtToken) {
    parts.push(identity);
  }

  return parts.join('. ').replace(/\.+\s*\./g, '.').replace(/\s+/g, ' ').trim();
}
