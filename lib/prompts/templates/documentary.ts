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
4. 對話/旁白 (dialogue) - 訪談內容或旁白文字
5. 時長建議 (duration)
6. 備註 (notes) - 拍攝提示、音效需求

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
                        }
                    },
                    required: ['sceneNumber', 'description', 'cameraMovement', 'dialogue', 'duration']
                }
            }
        },
        required: ['title', 'scenes']
    }
};
