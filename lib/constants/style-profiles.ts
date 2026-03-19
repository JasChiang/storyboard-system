import type { StyleProfile } from '@/lib/types/storyboard';

export const DEFAULT_STYLE_PROFILE_ID = 'preset-product-hero-studio';

export const PRESET_STYLE_PROFILES: StyleProfile[] = [
  {
    id: 'preset-product-hero-studio',
    name: '商業・商品主視覺',
    usage: '商品主視覺／上市 KV／產品開場首鏡',
    productionPreset: '單一產品主導畫面、品牌與 Logo 清楚可讀、幾何穩定、適合做 packshot 與後續動態延展。',
    continuityStrategy: '優先鎖定產品幾何、Logo 位置與主視覺輪廓；跨鏡只允許受控的光線與構圖微調。',
    defaultRenderLane: 'hero',
    recommendedStages: ['image_start', 'image_end', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: premium commercial product hero starter frame. Composition goal: one-product dominant layout, logo legibility, strong edge definition, motion-safe geometry, and negative space that supports downstream copy or UI overlays.',
      image_end: 'Rendering style: premium commercial product hero end frame. Composition goal: preserve exact hero identity and material response while only applying the requested framing or state delta.',
      video: 'Rendering style: premium commercial product hero motion preset. Composition goal: preserve exact geometry, logo placement, reflections, and silhouette during smooth cinematic camera movement.',
    },
    stageNegativeOverrides: {
      video: 'No logo distortion, no melted geometry, no duplicated product parts, no abrupt lighting shifts, no brand drift, no extra text or branding.',
    },
    stylePrompt:
      'Premium commercial product hero photography with crisp silhouette control, clean studio composition, accurate logo and material detail, premium specular handling, and stable geometry designed for downstream image-to-video motion.',
    negativePrompt:
      'No warped geometry, no deformed logos, no clutter, no duplicated parts, no random props, no extreme macro blur hiding hero edges, no extra branding.',
    isPreset: true,
  },
  {
    id: 'preset-lifestyle-commercial',
    name: '商業・生活情境',
    usage: '生活情境示範／使用場景／社群廣告敘事',
    productionPreset: '可信的生活環境、產品在情境中仍清楚可讀，並保持適合短影音的連續性。',
    continuityStrategy: '維持場景配置、人物穿搭與互動邏輯穩定，讓產品在真實生活情境中仍是主角。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: lifestyle commercial starter frame. Composition goal: believable modern environment, product clearly readable, natural daylight or practical lighting, and stable spatial layout for sequence expansion.',
      video: 'Rendering style: lifestyle commercial motion preset. Composition goal: preserve actor-product interaction clarity, environmental continuity, and product readability during movement.',
    },
    stylePrompt:
      'Lifestyle commercial storytelling with believable daily-use context, natural modern lighting, stable environment continuity, and clear product-in-use readability without losing emotional warmth.',
    negativePrompt:
      'No surreal fantasy styling, no chaotic props stealing focus, no heavy blur or occlusion on the hero subject, no awkward perspective distortion, no abrupt style shifts scene to scene.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-fidelity',
    name: '影片・保真',
    usage: '參考圖保真／連戲優先／image-to-video 穩定轉換',
    productionPreset: '優先保留參考圖風格、光線、比例與首尾幀穩定度，讓影片生成更安全。',
    continuityStrategy: '以參考圖 look-lock、場景連續性與主體比例穩定為最高優先，降低過度風格化造成的漂移。',
    defaultRenderLane: 'continuity',
    recommendedStages: ['image_start', 'image_end', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: video-fidelity starter frame. Composition goal: preserve reference rendering language, clear subject readability, stable world layout, and interpolation-safe start frame design.',
      image_end: 'Rendering style: video-fidelity end frame. Composition goal: keep the exact rendering medium, palette, and environment geometry while only applying the requested end-state delta.',
      video: 'Rendering style: continuity-first motion preset. Composition goal: preserve reference look, subject scale, lighting logic, and transition-safe layout throughout the motion clip.',
    },
    stageNegativeOverrides: {
      video: 'No restyling away from references, no abrupt palette shift, no lighting temperature jumps, no background layout drift, no subject scale jumps, no identity drift.',
    },
    stylePrompt:
      'Video-ready look-lock style that preserves reference rendering language, stable environment geometry, consistent lighting and material response, and continuity-first composition for smooth motion generation.',
    negativePrompt:
      'No style transfer away from the reference medium, no photoreal conversion unless the source is already photoreal, no aggressive teal-orange grading, no abrupt style shifts, no lens distortion hiding key geometry.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-product-demo',
    name: '影片・產品示範',
    usage: '功能示範／操作解說／hands-on walkthrough／評測插鏡',
    productionPreset: '畫面穩定、操作區清楚、手與產品互動可讀，適合 demo 與 explainer 類型影片。',
    continuityStrategy: '優先保證操作按鍵、手部與產品互動關係清楚，而不是追求過度風格化。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'image_end', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: product demonstration starter frame. Composition goal: clearly visible controls, legible branding, hand-product readability, stable perspective, and tripod-safe framing.',
      image_end: 'Rendering style: product demonstration end frame. Composition goal: preserve the same environment and interaction logic while applying only the requested delta.',
      video: 'Rendering style: product demonstration motion preset. Composition goal: preserve hand-product continuity, readable controls, stable reflections, and practical explainer framing during motion.',
    },
    stylePrompt:
      'Product demonstration visual language with practical framing, legible controls and branding, stable environment geometry, accurate proportions, and clear hand-product interaction for downstream motion or editing.',
    negativePrompt:
      'No warped geometry, no illegible or mirrored branding, no perspective exaggeration, no props blocking key controls, no shallow blur hiding interaction zones.',
    isPreset: true,
  },
  {
    id: 'preset-video-ready-social-narrative',
    name: '影片・社群敘事',
    usage: '短影音敘事／對話型廣告／creator 風格內容',
    productionPreset: '以人物、手勢、表情與產品可讀性為優先，符合手機觀看與短影音節奏。',
    continuityStrategy: '優先確保臉部、嘴型、手部與產品在短影音框架下清晰可見，並維持穿搭與場景邏輯一致。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: social narrative starter frame. Composition goal: mobile-first readability, clean facial acting, visible hands and product, and stable framing for short-form continuation.',
      video: 'Rendering style: social narrative motion preset. Composition goal: preserve people-first clarity, stable camera-ready composition, and short-form continuity without overprocessing.',
    },
    stylePrompt:
      'Social-native narrative framing for short-form video with clear action space, clean face and hand readability, practical product visibility, and continuity-safe lighting and wardrobe detail.',
    negativePrompt:
      'No chaotic composition, no profile-only framing hiding mouth movement, no heavy cinematic overprocessing, no clutter blocking key subject cues, no abrupt style mismatch across scenes.',
    isPreset: true,
  },
  {
    id: 'preset-info-explainer-visual',
    name: '解說・資訊視覺',
    usage: '產品解說／功能拆解／教學型敘事',
    productionPreset: '資訊優先、畫面乾淨、層級清楚，重點是看得懂而不是太戲劇化。',
    continuityStrategy: '維持資訊層級、物件位置與焦點安排穩定，讓每個鏡頭都能快速理解。',
    defaultRenderLane: 'utility',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Clear explainer visual language with uncluttered backgrounds, strong subject separation, functional composition, and consistency-first readability for educational or feature explanation scenes.',
    negativePrompt:
      'No noisy backgrounds, no abstract fine-art styling, no low-legibility layout, no visual clutter hiding the core action or product.',
    isPreset: true,
  },
  {
    id: 'preset-paper-craft-explainer',
    name: '解說・紙藝資訊',
    usage: '友善解說／教育型 cutout 故事／資訊圖像風格內容',
    productionPreset: '紙藝分層明確、陰影柔和、資訊清楚，適合可愛但有條理的解說內容。',
    continuityStrategy: '維持紙張厚度、分層順序與光線方向一致，讓紙藝視覺語言在整支片中保持統一。',
    defaultRenderLane: 'utility',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Layered paper-craft explainer style with crisp cutout edges, subtle inter-layer shadows, clean educational composition, and soft handcrafted texture that stays highly legible in motion.',
    negativePrompt:
      'No photoreal rendering, no glossy plastic material, no overly dense paper detail, no low-contrast separation between layers and subject.',
    isPreset: true,
  },
  {
    id: 'preset-ecom-white-background',
    name: '商業・白底電商',
    usage: '電商目錄／商城素材／價格卡與 catalog 內容',
    productionPreset: '白底乾淨、色彩中性、尺寸與陰影穩定，適合 catalogue 與商品頁使用。',
    continuityStrategy: '鎖定產品比例、白底乾淨度與陰影輪廓，讓所有素材維持同一套電商視覺語言。',
    defaultRenderLane: 'hero',
    recommendedStages: ['image_start', 'image_end'],
    stagePromptOverrides: {
      image_start: 'Rendering style: white-background e-commerce starter frame. Composition goal: centered or neatly balanced product framing, exact dimension readability, catalog-safe clarity, and stable shadow geometry.',
      image_end: 'Rendering style: white-background e-commerce end frame. Composition goal: preserve exact product shape, scale, and clean white background while applying only a minor framing or state change.',
    },
    stylePrompt:
      'E-commerce white-background product photography with neutral color reproduction, catalog-ready clarity, accurate dimensions, clean edge separation, and stable shadow geometry that remains motion-safe.',
    negativePrompt:
      'No dramatic shadows, no lifestyle props, no strong color cast, no perspective exaggeration, no blown highlights, no partial crop hiding important product edges.',
    isPreset: true,
  },
  {
    id: 'preset-creator-review',
    name: '商業・開箱評測',
    usage: '開箱／評測／桌面實拍風格／review 插鏡',
    productionPreset: '桌面場景自然、互動真實、社群感強，但仍保留清楚的產品可讀性。',
    continuityStrategy: '維持桌面配置、手與產品互動邏輯及自然評測氛圍，而不是過度棚拍。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Creator review and unboxing visual language with authentic tabletop context, practical framing, clear hand-product interaction, and clean social-native realism that still preserves product readability.',
    negativePrompt:
      'No overproduced cinematic treatment, no heavy VFX look, no fake luxury perfection, no illegible branding, no distracting background mess covering the hero product.',
    isPreset: true,
  },
  {
    id: 'preset-cinematic-ad',
    name: '商業・電影廣告大片',
    usage: '高端品牌片／形象廣告／戲劇化商業敘事',
    productionPreset: '廣告電影感、光線與情緒更強，但仍要維持品牌與產品辨識度。',
    continuityStrategy: '保持產品身份、場景架構與渲染媒介一致，同時允許更高級的電影式構圖與光線。',
    defaultRenderLane: 'hero',
    recommendedStages: ['image_start', 'video'],
    stagePromptOverrides: {
      image_start: 'Rendering style: cinematic brand film starter frame. Composition goal: emotionally resonant composition, motivated practical lighting, premium brand tone, and continuity-safe geometry for later motion.',
      video: 'Rendering style: cinematic brand film motion preset. Composition goal: preserve product and environment continuity while allowing premium cinematic movement and dramatic but controlled lighting.',
    },
    stylePrompt:
      'Cinematic commercial production quality with motivated lighting, moderate high-contrast grading, emotional but brand-safe composition, and strict preservation of product identity and rendering medium for video continuity.',
    negativePrompt:
      'No flat snapshot lighting, no amateur staging, no inconsistent film grain, no distorted product proportions, no overly aggressive teal-orange cast, no photoreal conversion unless the references are already photoreal.',
    isPreset: true,
  },
  {
    id: 'preset-cute-3d-clay-figure',
    name: '風格・Q版黏土 3D',
    usage: '可愛吉祥物敘事／親子品牌內容／友善商業影片',
    productionPreset: 'Q版比例、圓潤輪廓與手作黏土質感是核心，整體要可愛、乾淨、穩定。',
    continuityStrategy: '鎖定 Q 版比例、輪廓、手作材質與柔和色盤，避免跨鏡頭風格漂移。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Cute 3D clay figurine style with chibi proportions, rounded geometry, pastel palette, soft global illumination, handcrafted tactile surfaces, and clean friendly storytelling composition.',
    negativePrompt:
      'No photoreal skin, no harsh metallic reflections, no horror tone, no broken anatomy, no cluttered background stealing focus from the stylized characters or product.',
    isPreset: true,
  },
  {
    id: 'preset-isometric-3d-story',
    name: '風格・等距 3D 插畫',
    usage: '系統示意／空間敘事／產品生態圖解',
    productionPreset: '空間層次清楚、物件比例穩定、適合展示多元元素之間的關係。',
    continuityStrategy: '維持尺度邏輯、空間層次與幾何乾淨度一致，讓整體像同一套系統插畫。',
    defaultRenderLane: 'plate',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Isometric 3D illustration style with clear spatial hierarchy, clean geometric forms, balanced color blocks, readable product placement, and scene-first visual storytelling.',
    negativePrompt:
      'No perspective distortion, no chaotic camera angle, no inconsistent object scale, no noisy textures that reduce readability, no clutter hiding the key spatial story.',
    isPreset: true,
  },
  {
    id: 'preset-japanese-cel-anime',
    name: '風格・日式賽璐璐動畫',
    usage: '動畫敘事／角色導向品牌短片／對話鏡頭',
    productionPreset: '線條清楚、表情與手勢可讀、適合對話與角色表演的動畫風格。',
    continuityStrategy: '維持線條粗細、眼口比例、服裝色塊與臉部結構一致，確保相鄰鏡頭的動畫連續性。',
    defaultRenderLane: 'performance',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Japanese cel anime rendering with clean outlines, disciplined two-to-three-tone shading, readable facial acting, clear hand gestures, and dialogue-safe framing optimized for sequence continuity.',
    negativePrompt:
      'No photoreal pores, no painterly smudge rendering, no random line-weight shifts, no facial drift, no glow bloom hiding line art, no unstable costume color blocks.',
    isPreset: true,
  },
  {
    id: 'preset-stylized-feature-3d',
    name: '風格・高級動畫電影 3D',
    usage: '高質感動畫品牌片／角色驅動敘事／電影感風格 3D',
    productionPreset: '高級動畫電影感、材質穩定、造型有設計感，但仍要支援順暢連戲。',
    continuityStrategy: '維持材質反應、角色身份幾何與世界配置一致，同時保留電影級質感與構圖。',
    defaultRenderLane: 'hero',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Stylized feature-animation 3D with premium cinematic lighting, expressive but clean shape design, stable material response, and strong story-beat readability for motion-ready sequences.',
    negativePrompt:
      'No uncanny photoreal skin, no hyper-detailed pores, no unstable global-illumination noise, no dramatic style jumps shot to shot, no clutter obscuring the main beat.',
    isPreset: true,
  },
  {
    id: 'preset-ukiyoe-modern-narrative',
    name: '進階・江戶浮世繪木版畫',
    usage: '進階日式藝術方向／文化感敘事／特殊美術需求',
    productionPreset: '保留木版畫語言、構圖規律與傳統色彩節制，適合有明確文化風格需求的專案。',
    continuityStrategy: '維持輪廓粗細、套色感、圖案配置與傳統色盤穩定，避免不同鏡頭像不同畫派。',
    defaultRenderLane: 'hero',
    recommendedStages: ['image_start', 'video'],
    stylePrompt:
      'Authentic Edo-period ukiyo-e woodblock print language with hand-carved keylines, flat pigment blocks, bokashi gradation, visible washi-paper texture, restrained indigo-vermilion-earth palette, and silhouette-first storytelling composition.',
    negativePrompt:
      'No photoreal lighting, no glossy 3D reflections, no lens blur or bokeh, no contemporary typography, no mixed rendering engines, no modern digital painting brushwork.',
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
