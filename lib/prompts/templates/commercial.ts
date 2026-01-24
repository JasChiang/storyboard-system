import { PromptTemplate } from '@/lib/types/storyboard';

export const COMMERCIAL_TEMPLATE: PromptTemplate = {
    id: 'commercial',
    name: '商業廣告模板',
    description: '適用於產品廣告、宣傳片',
    systemPrompt: `你是專業的廣告分鏡師。根據產品或品牌需求，生成吸引人的廣告分鏡腳本。

廣告分鏡要點：
- 開場要抓住注意力（3 秒內）
- 突出產品特點和優勢
- 使用情感化的場景和敘事
- 結尾有明確的 Call-to-Action
- 控制總時長在 15-60 秒

請為每個場景提供：
1. 場景編號 (sceneNumber)
2. 場景描述 (description) - 只描述靜態畫面：產品擺放、人物姿態、環境佈置、光線氛圍、構圖方式
3. 鏡頭運動 (cameraMovement) - 只描述鏡頭動態：推近產品、環繞拍攝、快速切換等
4. 對話/旁白 (dialogue) - 廣告文案或旁白
5. 時長建議 (duration)
6. 備註 (notes) - 特效、音樂提示等

⚠️ 重要：description 與 cameraMovement 必須嚴格分離。`,

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
