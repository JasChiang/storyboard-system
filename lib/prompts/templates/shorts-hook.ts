import { PromptTemplate } from '@/lib/types/storyboard';

export const SHORTS_HOOK_TEMPLATE: PromptTemplate = {
    id: 'shorts_hook',
    name: 'Shorts 病毒短片模板',
    description: '適用於 YouTube Shorts / TikTok / Instagram Reels 病毒式短片',
    systemPrompt: `你是專精病毒式短影片的分鏡師，深度理解 Shorts/TikTok/Reels 的觀眾留存機制。

產出策略（固定遵循）：
- 目標平台：YouTube Shorts / TikTok / Instagram Reels（9:16 豎版）
- 創意強度：高（最大化鉤子強度與分享慾望）
- 預設場景數：3-5 場（極致緊湊）
- 一致性優先級：節奏衝擊感 > 品牌一致性

Shorts 極致規則（必須全部遵守）：
1. 第一幀必須能當縮圖：清晰主體、強對比、明確焦點
2. 前 0.5 秒禁黑幕/漸入：直接從高衝擊力畫面開始
3. 首句對話必須完整且獨立成立（即使無上下文也有意義）
4. 「瞬間翻轉」設計：在 1/3 到 2/3 處設置意外轉折
5. 場景數：3-5 場，每場 1-4 秒，總長不超過 60 秒
6. 極致緊湊節奏：無廢話，每秒都有資訊密度

Hook Intensity Rules（第一場景必選最強的一種）：
- Shock Hook: 震驚/意外/不可思議的開場畫面（最強）
- Question Hook: 強力懸念問句，觀眾必須看完才知道答案
- Story Hook: 「我一直以為...直到...」的故事起點

瞬間翻轉設計：
- 第 2-3 場景製造出乎意料的反轉
- 結尾要有「分享衝動」（Shareable Moment）
- 可在 notes 加入 [TWIST: description] 標記翻轉點

螢幕比例：9:16 豎版構圖
- 主體佔畫面 60-80%
- 避免橫向分布的元素
- 文字/字幕預留空間在畫面上下 15%

請為每個場景提供：
1. 場景編號 (sceneNumber)
2. 場景描述 (description) - 靜態畫面（9:16 豎版構圖）
3. 鏡頭運動 (cameraMovement)
3.5 結構化欄位：
   - sceneIntent: 此秒要讓觀眾感受/思考什麼
   - startComposition: 首幀構圖（豎版比例）
   - subjectMotion: 主體動作
   - continuityLock: 連續性約束
4. 智慧首尾幀判斷 (requiresEndFrame) - Shorts 傾向 false（快切優先）
5. 尾幀描述 (endFrameDescription)
5.5 尾幀差異 (endFrameDelta)
6. 對話/旁白 (dialogue) - 第一句必須完整且強力
7. 時長建議 (duration) - 1-4 秒
8. 備註 (notes) - 含 [TWIST:] 或 [HOOK:] 標記
10. 角色引用 (charactersUsed)
11. 商品引用 (productsUsed)
12. 場景差異 (changeFromPrev)
9. 轉場設定 (transitionToNext) - 優先 cut（快節奏）

⚠️ 禁止：開場淡入、無意義過場、超過 4 秒的靜態鏡頭`,

    outputSchema: {
        type: 'object',
        properties: {
            title: {
                type: 'string',
                description: '分鏡腳本的標題'
            },
            scenes: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        sceneNumber: {
                            type: 'integer',
                            description: '場景編號'
                        },
                        description: {
                            type: 'string',
                            description: '場景的靜態視覺描述（9:16 豎版構圖）'
                        },
                        cameraMovement: {
                            type: 'string',
                            description: '鏡頭運動方式'
                        },
                        sceneIntent: {
                            type: 'string',
                            description: '此秒要讓觀眾感受/思考什麼'
                        },
                        startComposition: {
                            type: 'string',
                            description: '首幀構圖摘要（豎版比例）'
                        },
                        subjectMotion: {
                            type: 'string',
                            description: '主體動作範圍'
                        },
                        continuityLock: {
                            type: 'string',
                            description: '連續性約束'
                        },
                        requiresEndFrame: {
                            type: 'boolean',
                            description: 'AI 判斷是否需要生成尾幀（Shorts 傾向 false）'
                        },
                        endFrameDescription: {
                            type: 'string',
                            description: '尾幀描述（只在 requiresEndFrame = true 時填寫）'
                        },
                        endFrameDelta: {
                            type: 'string',
                            description: '尾幀相對首幀的差異描述'
                        },
                        endFrameDeltaSpec: {
                            type: 'object',
                            description: '尾幀差異的半結構化規格',
                            properties: {
                                reframingGoal: { type: 'string' },
                                subjectScaleChangePct: { type: 'string' },
                                newVisibleArea: { type: 'string' },
                                mustNotChange: { type: 'array', items: { type: 'string' } },
                            },
                        },
                        dialogue: {
                            type: 'string',
                            description: '對話或旁白（第一句必須完整有力）'
                        },
                        duration: {
                            type: 'number',
                            description: '場景時長（秒，建議 1-4）'
                        },
                        notes: {
                            type: 'string',
                            description: '備註（含 [TWIST:] 或 [HOOK:] 標記）'
                        },
                        charactersUsed: {
                            type: 'array',
                            items: { type: 'string' },
                            description: '本場景使用的角色標記列表'
                        },
                        productsUsed: {
                            type: 'array',
                            items: { type: 'string' },
                            description: '本場景使用的商品標記列表'
                        },
                        changeFromPrev: {
                            type: 'string',
                            description: '相對前一場景的變化摘要'
                        },
                        transitionToNext: {
                            type: 'object',
                            description: '與下一場景的轉場設定（優先 cut）',
                            properties: {
                                type: {
                                    type: 'string',
                                    enum: ['cut', 'dissolve', 'fade_black', 'fade_white', 'continuation', 'match_cut', 'wipe', 'push'],
                                    description: '轉場類型'
                                },
                                reason: {
                                    type: 'string',
                                    description: 'AI 選擇此轉場的原因'
                                },
                                duration: {
                                    type: 'number',
                                    description: '轉場時長（秒），預設 0.3'
                                },
                                useEndFrameAsNextStart: {
                                    type: 'boolean',
                                    description: '是否讓下一場景使用此場景的 endFrame 作為開始幀'
                                }
                            },
                            required: ['type', 'reason']
                        }
                    },
                    required: ['sceneNumber', 'description', 'cameraMovement', 'sceneIntent', 'startComposition', 'subjectMotion', 'continuityLock', 'requiresEndFrame', 'endFrameDelta', 'dialogue', 'duration', 'charactersUsed', 'productsUsed', 'changeFromPrev', 'transitionToNext']
                }
            }
        },
        required: ['title', 'scenes']
    }
};
