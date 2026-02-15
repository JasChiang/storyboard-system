import type { StyleProfile } from '@/lib/types/storyboard';

export const DEFAULT_STYLE_PROFILE_ID = 'preset-product-hero-studio';

export const PRESET_STYLE_PROFILES: StyleProfile[] = [
  {
    id: 'preset-product-hero-studio',
    name: '商品主視覺棚拍',
    stylePrompt:
      'Premium commercial product photography, clean composition, controlled studio lighting, high texture fidelity, crisp edges, accurate logo and material details, professional ad visual quality.',
    negativePrompt:
      'No distorted logos, no melted geometry, no messy clutter, no duplicated product parts, no extra branding.',
    isPreset: true,
  },
  {
    id: 'preset-lifestyle-commercial',
    name: '生活情境商業風',
    stylePrompt:
      'Lifestyle commercial look, natural daylight, warm but realistic color grading, believable environment, product remains the hero while integrated into daily-life context.',
    negativePrompt:
      'No over-stylized fantasy rendering, no surreal proportions, no random props stealing focus from product.',
    isPreset: true,
  },
  {
    id: 'preset-cinematic-story',
    name: '電影敘事風格',
    stylePrompt:
      'Cinematic storytelling frame, intentional lighting contrast, filmic color pipeline, controlled depth of field, emotionally driven composition while preserving product identity.',
    negativePrompt:
      'No washed-out lighting, no flat snapshot aesthetics, no inconsistent product materials between scenes.',
    isPreset: true,
  },
  {
    id: 'preset-ugc-social-native',
    name: '社群 UGC 原生風',
    stylePrompt:
      'Social-native UGC visual language, casual realism, handheld-friendly composition, clean subject readability, platform-ready framing for short-form content.',
    negativePrompt:
      'No cinematic over-processing, no heavy VFX look, no unrealistic skin or product surfaces.',
    isPreset: true,
  },
  {
    id: 'preset-info-explainer-visual',
    name: '資訊解說視覺風',
    stylePrompt:
      'Clear explainer visual style, functional composition, uncluttered background, strong subject separation, consistency-first rendering for educational and feature explanation scenes.',
    negativePrompt:
      'No noisy background, no abstract art styling, no low-legibility scene layout.',
    isPreset: true,
  },
  {
    id: 'preset-clay-illustrated-brand',
    name: '黏土／插畫品牌風',
    stylePrompt:
      'Stylized clay-like illustrated brand world, tactile handcrafted material feeling, soft rounded forms, cohesive palette, playful yet commercial quality.',
    negativePrompt:
      'No photoreal skin pores, no harsh metallic realism, no mixed rendering engines in one project.',
    isPreset: true,
  },
  {
    id: 'preset-cute-3d-clay-figure',
    name: 'Q版 3D 黏土公仔',
    stylePrompt:
      'Cute 3D clay figurine style, chibi proportions, rounded geometry, pastel palette, soft global illumination, handcrafted tactile surfaces, clean and friendly storytelling composition.',
    negativePrompt:
      'No photorealistic skin texture, no harsh metallic reflections, no horror aesthetics, no broken anatomy, no excessive background clutter.',
    isPreset: true,
  },
  {
    id: 'preset-isometric-3d-story',
    name: '等距 3D 情境插畫',
    stylePrompt:
      'Isometric 3D illustration style, clear spatial hierarchy, clean geometric forms, balanced color blocks, readable product placement, and scene-first visual storytelling.',
    negativePrompt:
      'No perspective distortion, no chaotic camera angle, no inconsistent scale between objects, no noisy textures that reduce readability.',
    isPreset: true,
  },
  {
    id: 'preset-paper-craft-explainer',
    name: '紙藝資訊解說風',
    stylePrompt:
      'Layered paper-craft visual language, soft shadows between paper layers, crisp cutout edges, high legibility composition, and clear educational scene communication.',
    negativePrompt:
      'No photoreal rendering, no glossy plastic materials, no overly complex textures, no low-contrast text or subject separation.',
    isPreset: true,
  },
  {
    id: 'preset-mobile-accessory-minimal-studio',
    name: '手機配件・極簡棚拍',
    stylePrompt:
      'Minimal studio product photography for mobile accessories, neutral backdrop, controlled softbox highlights, precise edge definition, material fidelity, and premium commercial finish.',
    negativePrompt:
      'No warped geometry, no deformed logos, no random props, no fingerprints or dust artifacts, no mixed lighting color temperatures.',
    isPreset: true,
  },
  {
    id: 'preset-mobile-accessory-white-bg-ecom',
    name: '手機配件・白底電商',
    stylePrompt:
      'E-commerce white background product shot for phone accessories, centered composition, catalog-ready clarity, accurate dimensions, and consistent neutral color reproduction.',
    negativePrompt:
      'No dramatic shadows, no lifestyle props, no strong color cast, no perspective exaggeration, no partially cropped product body.',
    isPreset: true,
  },
  {
    id: 'preset-mobile-accessory-lifestyle',
    name: '手機配件・生活情境',
    stylePrompt:
      'Lifestyle commercial context for mobile accessories, believable daily-use moments, natural indoor/outdoor lighting, product remains clearly visible as hero within practical scenarios.',
    negativePrompt:
      'No surreal composition, no fantasy props, no over-stylized color grading, no subject ambiguity, no hidden key product details.',
    isPreset: true,
  },
  {
    id: 'preset-mobile-accessory-creator-review',
    name: '手機配件・開箱評測',
    stylePrompt:
      'Creator review and unboxing visual style for phone accessories, authentic tabletop setup, practical framing, clear hand-product interaction, social-native yet clean quality.',
    negativePrompt:
      'No overproduced cinematic look, no heavy VFX, no fake studio perfection, no illegible product branding, no distracting background mess.',
    isPreset: true,
  },
  {
    id: 'preset-tech-product-studio',
    name: '科技產品棚拍',
    stylePrompt:
      'Premium consumer tech product photography, ultra-clean studio environment, controlled gradient backdrops, precise specular highlights on metal and glass surfaces, accurate screen rendering with vivid UI content, perfect edge definition, professional tech ad quality with Apple-tier visual language.',
    negativePrompt:
      'No warped product geometry, no smudged screens, no deformed logos or text, no inconsistent reflections, no cluttered backgrounds, no off-brand color grading.',
    isPreset: true,
  },
  {
    id: 'preset-lifestyle-tech',
    name: '科技生活情境',
    stylePrompt:
      'Lifestyle tech visual storytelling, authentic daily-use context, warm indoor or soft outdoor lighting, product naturally integrated into believable modern living moments, hero product clearly visible while environment feels lived-in and aspirational.',
    negativePrompt:
      'No surreal styling, no fantasy props unrelated to tech use, no obscured product details, no harsh industrial lighting, no low-energy or dull composition.',
    isPreset: true,
  },
  {
    id: 'preset-cinematic-ad',
    name: '電影廣告大片',
    stylePrompt:
      'Cinematic commercial production quality, intentional dramatic lighting with motivated practical sources, wide cinematic color pipeline (teal-orange or desaturated high-contrast), shallow depth of field with precise focus pulls, emotionally resonant composition, every frame is a magazine cover while preserving product identity.',
    negativePrompt:
      'No flat or overexposed lighting, no amateur snapshot aesthetics, no inconsistent film grain, no distorted product proportions between shots, no color casts that misrepresent product color.',
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
