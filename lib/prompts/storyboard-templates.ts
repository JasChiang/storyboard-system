import { PromptTemplate } from '../types/storyboard';

export const DEFAULT_STORYBOARD_TEMPLATE: PromptTemplate = {
  id: 'default',
  name: '標準分鏡模板',
  description: '適用於一般影片的分鏡生成',
  systemPrompt: `你是專業的分鏡師和導演。根據用戶提供的故事需求，生成詳細的分鏡腳本表格。

請為每個場景提供：
1. 場景編號 (sceneNumber) - 從 1 開始的連續編號
2. 場景描述 (description) - 詳細描述畫面內容，包含環境、角色、動作、光線、氛圍
3. 鏡頭運動 (cameraMovement) - 如：推軌、搖鏡、特寫、廣角、俯視、仰視等
4. 對話/旁白 (dialogue) - 該場景的對白或旁白文字
5. 時長建議 (duration) - 以秒為單位的建議時長
6. 備註 (notes) - 任何額外的製作提示、特效需求等

請確保場景之間有良好的敘事連貫性和視覺節奏。場景描述要足夠詳細，能夠直接用於圖像生成。`,

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
              description: '場景的詳細視覺描述'
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

請為每個場景提供詳細的視覺描述、鏡頭運動、文案/旁白、時長建議和備註。`,

  outputSchema: DEFAULT_STORYBOARD_TEMPLATE.outputSchema
};

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

請為每個場景提供富有創意的視覺描述、動態鏡頭設計、對應的歌詞段落、時長和特效備註。`,

  outputSchema: DEFAULT_STORYBOARD_TEMPLATE.outputSchema
};

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

請為每個場景提供寫實的場景描述、適合的鏡頭運動、旁白文字、建議時長和拍攝備註。`,

  outputSchema: DEFAULT_STORYBOARD_TEMPLATE.outputSchema
};

export const TEMPLATES: PromptTemplate[] = [
  DEFAULT_STORYBOARD_TEMPLATE,
  COMMERCIAL_TEMPLATE,
  MUSIC_VIDEO_TEMPLATE,
  DOCUMENTARY_TEMPLATE,
];
