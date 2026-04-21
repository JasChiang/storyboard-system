import { NextRequest, NextResponse } from 'next/server';
import type { ProjectReference } from '@/lib/types/storyboard';
import { translateCjkRequests, isMostlyCjk, type TranslationRequest } from '@/lib/translation/cjk-translator';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

function splitGuidelines(value: string): string[] {
  return value
    .split(/\n|；|;|。/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { refs?: ProjectReference[] };
    const refs = Array.isArray(body.refs) ? body.refs : [];
    if (refs.length === 0) {
      return NextResponse.json({ refs: [] });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Server GEMINI_API_KEY is not set');
    }

    const requests: TranslationRequest[] = [];

    refs.forEach((ref) => {
      if (!ref?.id) return;
      if (ref.identityCore && isMostlyCjk(ref.identityCore)) {
        requests.push({ id: `${ref.id}::identityCore`, field: 'identityCore', text: ref.identityCore });
      }
      if (ref.description && isMostlyCjk(ref.description)) {
        requests.push({ id: `${ref.id}::description`, field: 'description', text: ref.description });
      }
      (ref.mustKeepFeatures || []).forEach((feature, idx) => {
        if (feature && isMostlyCjk(feature)) {
          requests.push({
            id: `${ref.id}::mustKeepFeature::${idx}`,
            field: 'mustKeepFeature',
            text: feature,
          });
        }
      });
      if (ref.guidelines) {
        splitGuidelines(ref.guidelines).forEach((clause, idx) => {
          if (isMostlyCjk(clause)) {
            requests.push({
              id: `${ref.id}::guideline::${idx}`,
              field: 'guideline',
              text: clause,
            });
          }
        });
      }
    });

    if (requests.length === 0) {
      return NextResponse.json({ refs });
    }

    const translations = await translateCjkRequests(requests, apiKey);

    const translated = refs.map((ref) => {
      if (!ref?.id) return ref;
      const next: ProjectReference = { ...ref };

      const ic = translations.get(`${ref.id}::identityCore`);
      if (ic && ic !== ref.identityCore) next.identityCore = ic;

      const desc = translations.get(`${ref.id}::description`);
      if (desc && desc !== ref.description) next.description = desc;

      if (ref.mustKeepFeatures?.length) {
        next.mustKeepFeatures = ref.mustKeepFeatures.map((feature, idx) => {
          const translated = translations.get(`${ref.id}::mustKeepFeature::${idx}`);
          return translated || feature;
        });
      }

      if (ref.guidelines) {
        const clauses = splitGuidelines(ref.guidelines);
        const translatedClauses = clauses.map((clause, idx) =>
          translations.get(`${ref.id}::guideline::${idx}`) || clause
        );
        if (translatedClauses.some((t, i) => t !== clauses[i])) {
          next.guidelines = translatedClauses.join('; ');
        }
      }

      return next;
    });

    return NextResponse.json({ refs: translated });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to translate references' });
  }
}
