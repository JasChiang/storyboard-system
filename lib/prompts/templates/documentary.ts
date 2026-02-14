import { PromptTemplate } from '@/lib/types/storyboard';

export const DOCUMENTARY_TEMPLATE: PromptTemplate = {
    id: 'documentary',
    name: '紀錄片模板',
    description: '適用於紀錄片、訪談影片',
    systemPrompt: `你是專業的紀錄片分鏡師。根據主題和內容，規劃真實感和敘事性兼具的分鏡腳本。

紀錄片分鏡要點：
- 真實自然的場景選擇
- 訪談與 B-Roll 鏡頭的搭配
- 使用環境音和旁白
- 建立清晰的敘事線
- 捕捉關鍵時刻和細節

請為每個場景提供：
1. 場景編號 (sceneNumber)
2. 場景描述 (description) - 靜態畫面：拍攝地點、人物狀態、環境細節、光線條件、構圖選擇
3. 鏡頭運動 (cameraMovement) - 動態運鏡：跟拍、手持晃動、穩定器移動、固定機位等
3.5 結構化欄位：sceneIntent、startComposition、subjectMotion、continuityLock
4. 對話/旁白 (dialogue) - 訪談內容或旁白文字
5. 時長建議 (duration)
6. 備註 (notes) - 拍攝提示、音效需求
7. 角色引用 (charactersUsed) - 本場景使用的角色標記陣列（如 ["<Host>"]）
8. 商品引用 (productsUsed) - 本場景使用的商品標記陣列（如 ["<ProductA>"]）
9. 場景差異 (changeFromPrev) - 相對前一場景的關鍵變化（第一場填 "N/A"）
10. 尾幀差異 (endFrameDelta) - 若 requiresEndFrame=true，僅描述相對首幀的改變；否則留空

⚠️ 關鍵：description 只寫靜態畫面內容，cameraMovement 只寫鏡頭運動方式。`,

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
                            description: '此鏡頭要完成的敘事目標'
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
                        }
                    },
                    required: ['sceneNumber', 'description', 'cameraMovement', 'sceneIntent', 'startComposition', 'subjectMotion', 'continuityLock', 'requiresEndFrame', 'endFrameDelta', 'dialogue', 'duration', 'charactersUsed', 'productsUsed', 'changeFromPrev']
                }
            }
        },
        required: ['title', 'scenes']
    }
};
