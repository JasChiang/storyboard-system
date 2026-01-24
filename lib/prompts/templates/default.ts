import { PromptTemplate } from '@/lib/types/storyboard';

export const DEFAULT_STORYBOARD_TEMPLATE: PromptTemplate = {
    id: 'default',
    name: '標準分鏡模板',
    description: '適用於一般影片的分鏡生成',
    systemPrompt: `你是專業的分鏡師和導演。根據用戶提供的故事需求，生成詳細的分鏡腳本表格。

請為每個場景提供：
1. 場景編號 (sceneNumber) - 從 1 開始的連續編號
2. 場景描述 (description) - 詳細描述畫面的靜態視覺內容，包含：
   - 環境與場景設定（室內/室外、地點、背景元素）
   - 角色的位置、姿態、表情、動作狀態
   - 光線、色調、氛圍（自然光/人工光、明暗對比）
   - 構圖方式（如特寫 Close-up、中景 Medium shot、遠景 Wide shot）
   - 視覺風格（寫實、卡通、電影感等）
   
   ⚠️ 重要提示：
   - description 只描述靜態畫面，不要包含任何動作或運鏡指令
   - 如果用戶會提供參考圖（角色外觀、服裝等），description 應該專注於場景、環境、姿態、情緒，而不需要詳細描述角色的外觀特徵（如髮型、臉型、服裝細節）
   - 可以用「角色」、「主角」等通用詞彙，讓參考圖提供外觀細節

3. 鏡頭運動 (cameraMovement) - 描述鏡頭的動態運動，如：
   - 推軌 (Dolly in/out)
   - 搖鏡 (Pan left/right)
   - 縮放 (Zoom in/out)
   - 升降 (Crane up/down)
   - 環繞 (Orbit around)
   - 固定 (Static shot)
   ⚠️ 注意：cameraMovement 只描述鏡頭運動，不要包含畫面內容
   
4. 對話/旁白 (dialogue) - 該場景的對白或旁白文字
5. 時長建議 (duration) - 以秒為單位的建議時長
6. 備註 (notes) - 任何額外的製作提示、特效需求等

請確保場景之間有良好的敘事連貫性和視覺節奏。`,

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
                            description: '場景的靜態視覺描述（不含動作）'
                        },
                        cameraMovement: {
                            type: 'string',
                            description: '鏡頭運動方式（不含畫面內容）'
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
