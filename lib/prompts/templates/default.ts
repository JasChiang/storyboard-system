import { PromptTemplate } from '@/lib/types/storyboard';
import { buildStoryboardOutputSchema } from '@/lib/prompts/storyboard-contract';
import { SHARED_STORYBOARD_BLOCKS } from '@/lib/prompts/shared-blocks';

export const DEFAULT_STORYBOARD_TEMPLATE: PromptTemplate = {
    id: 'default',
    name: '標準分鏡模板',
    description: '適用於一般影片的分鏡生成',
    systemPrompt: `你是專業的分鏡師和導演。根據使用者提供的故事需求，生成詳細的分鏡腳本表格。

產出策略（固定遵循）：
- 目標平台：YouTube Shorts / Instagram Reels / TikTok
- 創意強度：中（在不破壞品牌與角色一致性的前提下，主動補齊合理敘事）
- 預設場景數：4-6 場（製作成本優先，避免過度切分）
- 一致性優先級：角色與商品核心外觀 > 敘事創意
- 首尾幀策略：保守。若無明確必要，優先 requiresEndFrame = false

${SHARED_STORYBOARD_BLOCKS}

請確保場景之間有良好的敘事連貫性和視覺節奏。`,

    outputSchema: buildStoryboardOutputSchema()
};
