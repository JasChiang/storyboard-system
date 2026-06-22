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
 *   Action/Motion → Camera → Identity constraint
 *
 * No section labels (like "Subject state:") — just clean sentences.
 */
export function buildVideoPromptFromParts(input: VideoPromptInput): string {
  const parts: string[] = [];

  // 1. Action / motion lines first (highest priority for both models)
  const actions = dedupe(input.actionLines);
  if (actions.length > 0) {
    parts.push(actions.join('. '));
  }

  // 2. Camera motion
  const camera = input.cameraMotion.replace(/\s+/g, ' ').trim();
  if (camera) {
    parts.push(camera);
  }

  // 3. Identity preservation (concise)
  if (input.identityLine?.trim()) {
    parts.push(input.identityLine.trim());
  }

  return parts.join('. ').replace(/\.+\s*\./g, '.').replace(/\s+/g, ' ').trim();
}
