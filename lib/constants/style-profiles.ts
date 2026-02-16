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
    id: 'preset-calarts-2d-animation',
    name: '加州學院 2D 動畫',
    stylePrompt:
      'Rendering style: CalArts-inspired 2D animation language. Composition goal: bold silhouette readability, expressive poses, clean linework, and flat cel shading for action clarity. Continuity lock: stable face proportions, consistent outfit shapes, and simplified background geometry across scenes for image-to-video interpolation.',
    negativePrompt:
      'No photoreal skin/materials, no painterly oil textures, no noisy crosshatching, no anatomy drift between scenes, no clutter blocking the subject.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-cel-anime',
    name: '日式賽璐璐動畫',
    stylePrompt:
      'Rendering style: Japanese cel anime with clean ink outlines and 2-3 tone shading ramps. Composition goal: clear facial acting, readable hand gestures, and dialogue-safe framing. Continuity lock: consistent line thickness, stable eye/mouth geometry, and unchanged wardrobe materials across adjacent scenes.',
    negativePrompt:
      'No photoreal pores, no painterly smudge rendering, no random line-weight shifts, no facial feature drift, no overbloom hiding line art.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-anime-film-atmosphere',
    name: '日式電影動畫空氣感',
    stylePrompt:
      'Rendering style: Japanese animated-feature atmosphere with soft gradients and controlled aerial perspective. Composition goal: emotionally rich environments while keeping the subject clearly legible. Continuity lock: stable horizon and architecture layout, consistent color temperature, and preserved identity geometry for start/end-frame workflows.',
    negativePrompt:
      'No overexposed glow washout, no photoreal conversion, no heavy grain flicker, no environment geometry warping between shots.',
    isPreset: true,
  },
  {
    id: 'preset-retro-shoujo-editorial',
    name: '復古少女漫畫社論風',
    stylePrompt:
      'Rendering style: retro shoujo manga editorial aesthetic with elegant line accents and restrained decorative motifs. Composition goal: subject-first framing with clean storytelling hierarchy. Continuity lock: consistent facial structure, hair silhouette, and costume block colors while preserving scene readability for motion generation.',
    negativePrompt:
      'No dense screentone noise, no text overlays, no photoreal skin rendering, no decorative clutter covering key action.',
    isPreset: true,
  },
  {
    id: 'preset-ukiyoe-modern-narrative',
    name: '浮世繪現代敘事風',
    stylePrompt:
      'Rendering style: ukiyo-e inspired woodblock visual language adapted for modern storyboards. Composition goal: flat color planes, carved-ink contour logic, and restrained palettes with strong focal hierarchy. Continuity lock: stable subject scale, horizon alignment, and recurring motif consistency across scenes.',
    negativePrompt:
      'No photoreal shading, no glossy 3D reflections, no mixed rendering engines, no perspective distortion jumps, no random texture noise.',
    isPreset: true,
  },
  {
    id: 'preset-nihonga-sumi-modern',
    name: '新和風墨彩（Nihonga）',
    stylePrompt:
      'Rendering style: modern Nihonga and sumi-e hybrid with disciplined brush contours and mineral-pigment-like color fields. Composition goal: elegant negative space and high subject readability. Continuity lock: consistent brush rhythm, stable silhouette edges, and unchanged identity anchors across all shots.',
    negativePrompt:
      'No muddy low-contrast silhouettes, no uncontrolled watercolor bleeding over subject edges, no photoreal skin/material conversion.',
    isPreset: true,
  },
  {
    id: 'preset-polycon-lowpoly-3d',
    name: 'Polycon 低多邊形 3D',
    stylePrompt:
      'Rendering style: polycon low-poly 3D with faceted geometry and clean material blocks. Composition goal: clear spatial hierarchy and readable action zones for camera motion. Continuity lock: stable topology density, consistent polygon language, and fixed object scale relationships across scenes.',
    negativePrompt:
      'No high-frequency texture noise, no photoreal PBR micro-detailing, no melted meshes, no inconsistent polygon density between shots.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-3d-toon-anime',
    name: '日系 3D Toon 動畫',
    stylePrompt:
      'Rendering style: Japanese-inspired 3D toon animation with crisp shading ramps and soft rim lighting. Composition goal: expressive character acting while preserving product/prop readability. Continuity lock: unchanged face topology, hair volume, and costume silhouettes for sequential shot coherence.',
    negativePrompt:
      'No realistic skin scattering, no harsh metallic realism, no random shader switching, no geometry drift in face, hands, or props.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-miniature-diorama',
    name: '日式微縮模型場景',
    stylePrompt:
      'Rendering style: Japanese miniature diorama aesthetic with handcrafted scale cues and tactile materials. Composition goal: organized depth layers and clear hero-subject placement for motion-ready framing. Continuity lock: stable environment blocks, consistent miniature scale logic, and repeatable lighting direction across shots.',
    negativePrompt:
      'No full-scale photoreal realism, no cluttered micro-props hiding the subject, no depth-of-field overblur that obscures story action.',
    isPreset: true,
  },
  {
    id: 'preset-stylized-feature-3d',
    name: '高級動畫電影 3D',
    stylePrompt:
      'Rendering style: stylized feature-animation 3D with cinematic yet continuity-safe lighting and expressive shape design. Composition goal: premium visual impact while maintaining clean readability for story beats. Continuity lock: consistent material response, stable character identity geometry, and fixed world layout for downstream video generation.',
    negativePrompt:
      'No uncanny photoreal skin, no hyper-detailed pores, no unstable global-illumination noise, no dramatic style jumps shot to shot.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-mecha-toon-3d',
    name: '日系機甲動畫 3D',
    stylePrompt:
      'Rendering style: Japanese mecha-inspired 3D toon shading with clean panel segmentation and controlled specular accents. Composition goal: strong silhouette readability, clear foreground-midground-background separation, and action-ready staging. Continuity lock: stable hard-surface topology, unchanged emblem placement, and consistent material classes across all scenes.',
    negativePrompt:
      'No photoreal metal micro-scratches, no warped mechanical joints, no random decal/text generation, no inconsistent panel line density, no cluttered FX obscuring key geometry.',
    isPreset: true,
  },
  {
    id: 'preset-jrpg-painted-3d',
    name: 'JRPG 手繪 3D 幻想',
    stylePrompt:
      'Rendering style: JRPG-inspired painterly 3D with stylized forms, soft atmospheric depth, and curated color harmony. Composition goal: cinematic exploration framing with readable characters and props. Continuity lock: fixed character proportions, consistent costume pattern blocks, and stable environment landmarks for sequential shot coherence.',
    negativePrompt:
      'No photoreal conversion, no muddy low-contrast silhouettes, no random texture style switching, no environment layout jumps between scenes.',
    isPreset: true,
  },
  {
    id: 'preset-kawaii-plush-mascot-3d',
    name: '吉祥物絨毛 3D',
    stylePrompt:
      'Rendering style: kawaii plush mascot 3D with soft fabric fibers, rounded forms, and gentle bounce-ready proportions. Composition goal: clear emotional readability and product-safe framing with clean background separation. Continuity lock: stable stitch patterns, unchanged facial feature placement, and consistent fabric tone response across scenes.',
    negativePrompt:
      'No plastic toy gloss, no photoreal skin, no horror deformation, no noisy fur artifacts, no prop clutter hiding mascot silhouette.',
    isPreset: true,
  },
  {
    id: 'preset-washi-papercraft-diorama',
    name: '和風紙雕立體場景',
    stylePrompt:
      'Rendering style: Japanese washi papercraft diorama with layered cutout depth, subtle fiber texture, and soft inter-layer shadowing. Composition goal: high readability of subject and action path while keeping decorative elegance. Continuity lock: consistent paper thickness language, stable layer order, and repeatable light direction across shots.',
    negativePrompt:
      'No glossy plastic sheen, no photoreal camera realism, no dense tiny details that flicker in motion, no low-contrast subject separation.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-broadcast-explainer-3d',
    name: '日式解說動畫 3D',
    stylePrompt:
      'Rendering style: Japanese broadcast explainer 3D with clean geometric forms, friendly motion-graphic sensibility, and practical color coding. Composition goal: information-first clarity with strong focal hierarchy and storyboard readability. Continuity lock: stable iconography language, consistent object scale rules, and unchanged key UI/prop placements scene to scene.',
    negativePrompt:
      'No dense text overlays, no photoreal material rendering, no chaotic multi-style mixing, no perspective distortions that hurt instructional clarity.',
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
