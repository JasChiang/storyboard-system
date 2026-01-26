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
4. 對話/旁白 (dialogue) - 對應的歌詞段落
5. 時長建議 (duration)
6. 備註 (notes) - 特效、後製提示

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
                        requiresEndFrame: {
                            type: 'boolean',
                            description: 'AI 判斷是否需要生成尾幀'
                        },
                        endFrameDescription: {
                            type: 'string',
                            description: '尾幀描述（requiresEndFrame=true 時填寫）- 必須包含完整場景設定，不使用相對描述詞'
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
                    required: ['sceneNumber', 'description', 'cameraMovement', 'requiresEndFrame', 'dialogue', 'duration']
                }
            }
        },
        required: ['title', 'scenes']
    }
};
