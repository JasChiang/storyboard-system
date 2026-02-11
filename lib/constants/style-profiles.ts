import type { StyleProfile } from '@/lib/types/storyboard';

export const DEFAULT_STYLE_PROFILE_ID = 'preset-product-hero-studio';

export const PRESET_STYLE_PROFILES: StyleProfile[] = [
  {
    id: 'preset-product-hero-studio',
    name: 'Product Hero Studio',
    stylePrompt:
      'Premium commercial product photography, clean composition, controlled studio lighting, high texture fidelity, crisp edges, accurate logo and material details, professional ad visual quality.',
    negativePrompt:
      'No distorted logos, no melted geometry, no messy clutter, no duplicated product parts, no extra branding.',
    isPreset: true,
  },
  {
    id: 'preset-lifestyle-commercial',
    name: 'Lifestyle Commercial',
    stylePrompt:
      'Lifestyle commercial look, natural daylight, warm but realistic color grading, believable environment, product remains the hero while integrated into daily-life context.',
    negativePrompt:
      'No over-stylized fantasy rendering, no surreal proportions, no random props stealing focus from product.',
    isPreset: true,
  },
  {
    id: 'preset-cinematic-story',
    name: 'Cinematic Story',
    stylePrompt:
      'Cinematic storytelling frame, intentional lighting contrast, filmic color pipeline, controlled depth of field, emotionally driven composition while preserving product identity.',
    negativePrompt:
      'No washed-out lighting, no flat snapshot aesthetics, no inconsistent product materials between scenes.',
    isPreset: true,
  },
  {
    id: 'preset-ugc-social-native',
    name: 'UGC Social Native',
    stylePrompt:
      'Social-native UGC visual language, casual realism, handheld-friendly composition, clean subject readability, platform-ready framing for short-form content.',
    negativePrompt:
      'No cinematic over-processing, no heavy VFX look, no unrealistic skin or product surfaces.',
    isPreset: true,
  },
  {
    id: 'preset-info-explainer-visual',
    name: 'Info Explainer Visual',
    stylePrompt:
      'Clear explainer visual style, functional composition, uncluttered background, strong subject separation, consistency-first rendering for educational and feature explanation scenes.',
    negativePrompt:
      'No noisy background, no abstract art styling, no low-legibility scene layout.',
    isPreset: true,
  },
  {
    id: 'preset-clay-illustrated-brand',
    name: 'Clay / Illustrated Brand',
    stylePrompt:
      'Stylized clay-like illustrated brand world, tactile handcrafted material feeling, soft rounded forms, cohesive palette, playful yet commercial quality.',
    negativePrompt:
      'No photoreal skin pores, no harsh metallic realism, no mixed rendering engines in one project.',
    isPreset: true,
  },
];

export function findStyleProfileById(
  profileId: string | undefined,
  customProfiles: StyleProfile[] | undefined
): StyleProfile | undefined {
  if (!profileId) return undefined;
  return [...PRESET_STYLE_PROFILES, ...(customProfiles || [])].find(
    (profile) => profile.id === profileId
  );
}
