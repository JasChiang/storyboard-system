import { PromptTemplate } from '@/lib/types/storyboard';

export const COMMERCIAL_TEMPLATE: PromptTemplate = {
    id: 'commercial',
    name: '商業廣告模板',
    description: '適用於產品廣告、宣傳片',
    systemPrompt: `你是專業的商業廣告分鏡師，專精於產品展示與品牌故事。生成吸引人的廣告分鏡腳本。

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

4. 🔥 智慧首尾幀判斷 (requiresEndFrame) - **商業廣告特別嚴格規則**：
   
   【商品拍攝專用判斷】：
   a) ⚠️ **商品 Logo/文字保護規則**（最高優先級）：
      - 如果場景包含「可識別的品牌 Logo」、「產品包裝文字」或「任何需要清晰展示的標誌」，
        且鏡頭運動為「旋轉」、「環繞」、"推軌"、"搖鏡" 時，
        **必須設 requiresEndFrame = false**。
      - 原因：避免首尾幀的像素級差異導致 Logo 在影片中產生「液化效應」(Liquify Effect)。
   
   b) 🎯 **唯一例外** - 只有以下情況設 requiresEndFrame = true：
      - 商品發生「物理狀態改變」：打開/關閉、倒出液體、撕開包裝、按壓變形
      - 鏡頭從「完全不同的場景」切換：室內→戶外、產品 A→產品 B
      - 大幅度景深變化：特寫→全景（>50% 構圖改變）
   
   c) 💡 範例：
      - ❌ requiresEndFrame = false: "可樂罐 360° 旋轉"、"手機環繞展示"、"推近 Logo"
      - ✅ requiresEndFrame = true: "打開可樂罐蓋子"、"從工廠場景切到戶外廣告牌"
   
5. 尾幀描述 (endFrameDescription) - 只在 requiresEndFrame = true 時填寫
   - ⚠️ 關鍵：撰寫「完整的獨立場景描述」，不要用相對描述詞
   - 從 description 複製：環境、光線、構圖、色調、視角
   - 只修改：物體狀態的改變（如：包裝打開、液體倒出）
   - ❌ 禁止：「同樣」、「相同」、「依舊」等詞彙
   - ✅ 範例：完整重寫場景，只改變化的元素
6. 對話/旁白 (dialogue) - 廣告文案或旁白
7. 時長建議 (duration)
8. 備註 (notes) - 特效、音樂提示等

9. 🆕 與下一場景的轉場設定 (transitionToNext) - **商業廣告轉場策略**：

   【轉場類型說明】：
   - cut: 硬切 - 快節奏、動感（適合促銷廣告）
   - dissolve: 交叉溶解 - 優雅過渡（適合品牌形象片）
   - fade_black: 淡入黑場 - 段落分隔、結尾鋪墊
   - fade_white: 淡入白場 - 科技感、純淨感（適合美妝、科技產品）
   - continuation: 延續 - 產品動作連續（適合開箱、使用示範）
   - match_cut: 匹配剪接 - 創意轉場（產品形狀→Logo）
   - wipe: 擦除 - 有方向感的切換
   - push: 推出 - 動態感強

   【商業廣告專用判斷邏輯】：
   a) 產品展示 → 產品使用場景：
      → type = "dissolve" 或 "match_cut"
      
   b) 使用場景 → 滿意表情：
      → type = "cut"（快節奏）或 "dissolve"（情感延續）
      
   c) 多個產品特點輪播：
      → type = "cut" + 快節奏
      
   d) 產品動作連續（如：開瓶、倒飲料、喝下）：
      → type = "continuation"
      → useEndFrameAsNextStart = true
      → requiresEndFrame = true
      
   e) 最後一個場景（CTA 或品牌 Logo）：
      → type = "fade_black" 或 "fade_white"

   必須在 reason 欄位說明選擇此轉場類型的原因。

⚠️ 記住：商業廣告對品牌形象要求極高，寧可犧牲動態流暢度，也不能讓 Logo 變形。`,

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
                            description: 'AI 判斷是否需要生成尾幀（商業廣告嚴格遵守 Logo 保護規則）'
                        },
                        endFrameDescription: {
                            type: 'string',
                            description: '尾幀描述（只在 requiresEndFrame = true 時填寫）'
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
                    required: ['sceneNumber', 'description', 'cameraMovement', 'requiresEndFrame', 'dialogue', 'duration', 'transitionToNext']
                }
            }
        },
        required: ['title', 'scenes']
    }
};

