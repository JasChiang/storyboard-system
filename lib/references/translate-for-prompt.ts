import type { ProjectReference } from '@/lib/types/storyboard';

/**
 * Ask the server to translate any CJK-heavy fields on these references to concise English
 * suitable for image prompts. Uses a SQLite-backed cache keyed by text hash, so each unique
 * CJK string is translated at most once across the whole system.
 *
 * On any failure (network / server error), returns the original refs unchanged so that
 * generation can still proceed — translation is best-effort.
 */
export async function translateReferencesForPrompt(
  refs: ProjectReference[]
): Promise<ProjectReference[]> {
  if (!Array.isArray(refs) || refs.length === 0) return refs;
  try {
    const response = await fetch('/api/gemini/translate-references', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refs }),
    });
    if (!response.ok) return refs;
    const data = (await response.json()) as { refs?: ProjectReference[] };
    return Array.isArray(data.refs) && data.refs.length === refs.length ? data.refs : refs;
  } catch (error) {
    console.warn('[translateReferencesForPrompt] falling back to original refs:', error);
    return refs;
  }
}
