import { PromptTemplate } from '@/lib/types/storyboard';

export const DEFAULT_STORYBOARD_TEMPLATE: PromptTemplate = {
    id: 'default',
    name: '標準分鏡模板',
    description: '適用於一般影片的分鏡生成',
    systemPrompt: `你是專業的分鏡師和導演。根據使用者提供的故事需求，生成詳細的分鏡腳本表格。

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
   - 如果使用者會提供參考圖（角色外觀、服裝等），description 應該專注於場景、環境、姿態、情緒，而不需要詳細描述角色的外觀特徵（如髮型、臉型、服裝細節）
   - 可以用「角色」、「主角」等通用詞彙，讓參考圖提供外觀細節

3. 鏡頭運動 (cameraMovement) - 描述鏡頭的動態運動，如：
   - 推軌 (Dolly in/out)
   - 搖鏡 (Pan left/right)
   - 縮放 (Zoom in/out)
   - 升降 (Crane up/down)
   - 環繞 (Orbit around)
   - 固定 (Static shot)
   ⚠️ 注意：cameraMovement 只描述鏡頭運動，不要包含畫面內容

4. 🆕 智慧首尾幀判斷 (requiresEndFrame) - 根據以下邏輯判斷是否需要生成「尾幀」：
   
   【判斷規則】：
   a) 一般原則：
      - 如果運鏡幅度大（>30% 畫面位移或視角改變），設 requiresEndFrame = true
      - 如果是人物對話或細微動作（表情變化、手勢），設 requiresEndFrame = false（避免臉部變形）
   
   b) 🔥 商品/剛體特殊規則（Product Rules）：
      - 如果畫面核心是「特定商品」（如手機、飲料、Logo），且鏡頭運動主要為平移或推軌（Pan/Dolly），
        請務必設 requiresEndFrame = false。
        （原因：避免首尾幀的 Logo 細節不一致導致影片生成時產生果凍效應）
      - 只有在「商品發生物理狀態改變」時（如：打開蓋子、被壓扁、液體流出），才設 requiresEndFrame = true。
   
   c) 範例：
      - ✅ requiresEndFrame = true: 鏡頭從室內推到室外、角色從畫面左邊跑到右邊消失、商品包裝被打開
      - ❌ requiresEndFrame = false: 雙人對話、特寫表情、商品旋轉展示、推軌近景
   
5. 尾幀描述 (endFrameDescription) - 只在 requiresEndFrame = true 時填寫：
   - ⚠️ 重要：必須撰寫「完整的獨立場景描述」，包含所有視覺元素
   - 必須包含：環境、光線、構圖、色調、視角（複製自 description）
   - 只替換「改變的部分」（如：物體位置、狀態、人物動作）
   - ❌ 禁止使用：「同樣的」、「相同角度」、「依舊」等相對描述詞
   - ✅ 正確範例：將 description 的場景設定完整複製，只修改變化的物件
   - 如果 requiresEndFrame = false，此欄位必須留空 ("")

6. 對話/旁白 (dialogue) - 該場景的對白或旁白文字
7. 時長建議 (duration) - 以秒為單位的建議時長
8. 備註 (notes) - 任何額外的製作提示、特效需求等

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
                        requiresEndFrame: {
                            type: 'boolean',
                            description: 'AI 判斷是否需要生成尾幀（依據運鏡幅度與商品規則）'
                        },
                        endFrameDescription: {
                            type: 'string',
                            description: '尾幀的靜態畫面描述（只在 requiresEndFrame = true 時填寫，否則留空）'
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
