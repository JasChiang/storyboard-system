import type { StyleProfile } from '@/lib/types/storyboard';

export const DEFAULT_STYLE_PROFILE_ID = 'preset-product-hero-studio';

export const PRESET_STYLE_PROFILES: StyleProfile[] = [
  {
    id: 'preset-product-hero-studio',
    name: '商品主視覺棚拍',
    stylePrompt:
      'Premium commercial product photography with video-ready starter frame, clean composition, controlled studio lighting, high texture fidelity, crisp edges, accurate logo/material details, and stable geometry for downstream camera motion.',
    negativePrompt:
      'No distorted logos, no melted geometry, no messy clutter, no duplicated product parts, no extra branding, no extreme macro blur hiding key edges.',
    isPreset: true,
  },
  {
    id: 'preset-lifestyle-commercial',
    name: '生活情境商業風',
    stylePrompt:
      'Lifestyle commercial look optimized for image-to-video, natural daylight, warm but realistic color grading, believable environment, clear subject readability, and stable world layout while product remains the hero.',
    negativePrompt:
      'No over-stylized fantasy rendering, no surreal proportions, no random props stealing focus from product, no heavy blur or occlusion on the main subject.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-look-lock',
    name: '影片導向・參考圖保真',
    stylePrompt:
      'Video-ready look-lock style, preserve reference rendering language and character/product geometry, clear unobstructed subject readability, stable world layout, consistent lighting/materials, and continuity-first commercial composition.',
    negativePrompt:
      'No style transfer away from reference look, no photoreal conversion unless reference is photoreal, no extreme lens distortion, no heavy blur hiding key geometry, no tiny or heavily occluded main subject.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-cinematic-lock',
    name: '影片導向・保真電影打光',
    stylePrompt:
      'Cinematic but continuity-safe lighting, motivated key-fill-rim setup with moderate contrast, preserve original rendering medium from references, clear subject-background separation, and start/end-frame consistency readiness.',
    negativePrompt:
      'No aggressive teal-orange cast, no crushed blacks or clipped highlights, no dramatic restyling that changes reference medium, no inconsistent grain, no identity drift.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-social-narrative',
    name: '影片導向・社群敘事',
    stylePrompt:
      'Social-native narrative framing for short-form video, clear action space, natural perspective, stable camera-ready composition, clean face/hand/product readability, and consistent wardrobe/material detail for multi-shot continuity.',
    negativePrompt:
      'No chaotic composition, no overprocessed cinematic filters, no abrupt style mismatch between scenes, no clutter blocking key subject cues.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-product-demo',
    name: '影片導向・產品示範',
    stylePrompt:
      'Product demonstration starter frame, tripod-friendly composition, accurate proportions, legible logo/text, controlled reflections, stable environment geometry, and clear hand-product interaction zone for downstream motion.',
    negativePrompt:
      'No warped geometry, no illegible or mirrored branding, no perspective exaggeration, no extreme macro blur, no props covering key product edges.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-dialogue-portrait',
    name: '影片導向・對話人像',
    stylePrompt:
      'Dialogue-ready portrait framing with unobstructed face and mouth visibility, upper-body clarity, balanced key light for expression readability, stable background structure, and continuity-safe skin/material rendering.',
    negativePrompt:
      'No face occlusion by props/hair, no profile-only framing that hides mouth, no harsh shadows across lips/eyes, no unstable facial stylization across shots.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-transition-safe',
    name: '影片導向・轉場雙幀一致',
    stylePrompt:
      'Transition-safe frame design for start/end control, keep rendering engine and palette consistent, anchor static environment geometry and subject scale, and maintain composition stability for smooth image-to-video interpolation.',
    negativePrompt:
      'No abrupt style shifts, no lighting temperature jumps, no background layout changes, no subject scale jumps, no inconsistent continuity cues.',
    isPreset: true,
  },
  {
    id: 'preset-cinematic-story',
    name: '電影敘事風格',
    stylePrompt:
      'Cinematic storytelling frame with continuity-safe contrast, filmic but balanced color pipeline, controlled depth of field, emotionally driven composition, and strict preservation of reference rendering medium and product identity.',
    negativePrompt:
      'No washed-out lighting, no flat snapshot aesthetics, no inconsistent product materials between scenes, no photoreal conversion unless the reference is already photoreal.',
    isPreset: true,
  },
  {
    id: 'preset-ugc-social-native',
    name: '社群 UGC 原生風',
    stylePrompt:
      'Social-native UGC visual language optimized for short-form motion, casual realism, handheld-friendly but stable composition, clean subject readability, and continuity-safe lighting for multi-shot consistency.',
    negativePrompt:
      'No cinematic over-processing, no heavy VFX look, no unrealistic skin or product surfaces, no abrupt style mismatch across consecutive shots.',
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
      'Minimal studio product framing for mobile accessories, neutral backdrop, controlled softbox highlights, precise edge definition, material fidelity, continuity-safe geometry, and motion-friendly negative space.',
    negativePrompt:
      'No warped geometry, no deformed logos, no random props, no fingerprints or dust artifacts, no mixed lighting color temperatures, no perspective exaggeration.',
    isPreset: true,
  },
  {
    id: 'preset-mobile-accessory-white-bg-ecom',
    name: '手機配件・白底電商',
    stylePrompt:
      'E-commerce white-background product shot adapted for image-to-video, centered yet motion-ready composition, catalog-ready clarity, accurate dimensions, neutral color reproduction, and stable shadow geometry.',
    negativePrompt:
      'No dramatic shadows, no lifestyle props, no strong color cast, no perspective exaggeration, no partially cropped product body, no blown highlights.',
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
      'Premium consumer tech product photography with video-ready continuity, ultra-clean studio environment, controlled gradient backdrops, precise specular highlights on metal/glass surfaces, accurate screen rendering, perfect edge definition, and stable product geometry for downstream motion.',
    negativePrompt:
      'No warped product geometry, no smudged screens, no deformed logos or text, no inconsistent reflections, no cluttered backgrounds, no off-brand color grading, no unreadable screen content.',
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
      'Cinematic commercial production quality with motivated practical lighting, moderate high-contrast grading, controlled depth of field, emotionally resonant composition, and strict preservation of reference rendering medium for video continuity.',
    negativePrompt:
      'No flat or overexposed lighting, no amateur snapshot aesthetics, no inconsistent film grain, no distorted product proportions between shots, no aggressive teal-orange cast, no photoreal conversion unless reference is photoreal.',
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
