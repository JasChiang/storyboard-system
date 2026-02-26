import { PromptTemplate } from '@/lib/types/storyboard';

export const MUSIC_VIDEO_TEMPLATE: PromptTemplate = {
    id: 'music_video',
    name: '音樂MV模板',
    description: '適用於音樂影片、MV 製作',
    systemPrompt: `你是專業的 MV 導演和分鏡師。根據音樂風格和歌詞內容，創作視覺化的分鏡腳本。

MV 分鏡要點：
- 緊扣歌曲節奏和情緒
- 創造視覺化的意象和隱喻
- 使用多樣化的鏡頭語言
- 注重色彩和光線的運用
- 可包含表演場景和敘事場景

請為每個場景提供：
1. 場景編號 (sceneNumber)
2. 場景描述 (description) - 靜態畫面：場景佈置、人物造型、色彩基調、光影效果、構圖美學
3. 鏡頭運動 (cameraMovement) - 動態運鏡：旋轉、推拉、搖移、快速剪接等
3.5 結構化欄位：sceneIntent、startComposition、subjectMotion、continuityLock
4. 對話/旁白 (dialogue) - 對應的歌詞段落
5. 時長建議 (duration)
6. 備註 (notes) - 特效、後製提示
7. 角色引用 (charactersUsed) - 本場景使用的角色標記陣列
8. 商品引用 (productsUsed) - 本場景使用的商品標記陣列
9. 場景差異 (changeFromPrev) - 相對前一場景的關鍵變化（第一場填 "N/A"）
10. 尾幀差異 (endFrameDelta) - 若 requiresEndFrame=true，僅描述相對首幀改變；否則留空

⚠️ 注意：description 描述靜態視覺，cameraMovement 描述鏡頭動作，兩者分開。`,

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
                            description: '場景的靜態視覺描述'
                        },
                        cameraMovement: {
                            type: 'string',
                            description: '鏡頭運動方式'
                        },
                        sceneIntent: {
                            type: 'string',
                            description: '此鏡頭要傳遞的情緒/敘事目標'
                        },
                        startComposition: {
                            type: 'string',
                            description: '首幀構圖摘要'
                        },
                        subjectMotion: {
                            type: 'string',
                            description: '主體允許動作範圍'
                        },
                        continuityLock: {
                            type: 'string',
                            description: '需要維持不變的連續性約束'
                        },
                        shotIntent: {
                            type: 'string',
                            description: '鏡頭在整體敘事中的任務（一句話）'
                        },
                        continuityAnchor: {
                            type: 'string',
                            description: '跨鏡頭必須維持的一個關鍵連續性錨點'
                        },
                        requiresEndFrame: {
                            type: 'boolean',
                            description: 'AI 判斷是否需要生成尾幀'
                        },
                        endFrameDescription: {
                            type: 'string',
                            description: '尾幀描述（requiresEndFrame=true 時填寫）- 必須包含完整場景設定，不使用相對描述詞'
                        },
                        endFrameDelta: {
                            type: 'string',
                            description: '尾幀相對首幀的差異描述（requiresEndFrame=true 時填寫）'
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
                            description: '對話或旁白'
                        },
                        duration: {
                            type: 'number',
                            description: '場景時長（秒）'
                        },
                        notes: {
                            type: 'string',
                            description: '額外備註'
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
                            description: '相對前一場景的變化摘要（第一場景填 N/A）'
                        },
                        requiredReferences: {
                            type: 'array',
                            items: { type: 'string' },
                            description: '本鏡頭必須使用的參考標記（如 ["<Singer>", "<PropA>"]）'
                        },
                        transitionToNext: {
                            type: 'object',
                            description: '與下一場景的轉場設定',
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
                                    description: '轉場時長（秒），預設 0.5'
                                },
                                useEndFrameAsNextStart: {
                                    type: 'boolean',
                                    description: '是否讓下一場景使用此場景的 endFrame 作為開始幀'
                                }
                            },
                            required: ['type', 'reason']
                        }
                    },
                    required: ['sceneNumber', 'description', 'cameraMovement', 'sceneIntent', 'startComposition', 'subjectMotion', 'continuityLock', 'shotIntent', 'continuityAnchor', 'requiresEndFrame', 'endFrameDelta', 'dialogue', 'duration', 'charactersUsed', 'productsUsed', 'changeFromPrev', 'requiredReferences', 'transitionToNext']
                }
            }
        },
        required: ['title', 'scenes']
    }
};
