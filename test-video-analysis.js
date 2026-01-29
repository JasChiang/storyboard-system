/**
 * 測試腳本：驗證 Gemini 是否真的分析影片內容
 * 使用 REST API 而非 SDK
 */

import { readFileSync } from 'fs';

// 讀取 .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const apiKeyMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
const GEMINI_API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : null;

if (!GEMINI_API_KEY) {
    console.error('❌ 找不到 GEMINI_API_KEY');
    process.exit(1);
}
const TEST_VIDEO_URL = 'https://v3b.fal.media/files/b/0a8c31e6/14ysUTGkDjasWlk0x_Jea_output.mp4';

// 故意給錯誤的場景描述
const FAKE_SCENE_DESCRIPTION = {
    id: 'test-scene-1',
    sceneNumber: 1,
    description: '一隻貓在草地上奔跑，陽光明媚，背景是藍天白雲',
    cameraMovement: '跟隨拍攝，鏡頭追著貓移動',
    duration: 5
};

async function analyzeVideoDirectly() {
    console.log('🧪 開始測試 Gemini 影片分析能力\n');
    console.log('測試影片:', TEST_VIDEO_URL);
    console.log('假的場景描述:', FAKE_SCENE_DESCRIPTION.description);
    console.log('\n' + '='.repeat(60) + '\n');

    const prompt = `# 測試任務
我給你一個影片 URL 和一個場景描述。

## 場景描述（可能是錯的）：
${JSON.stringify(FAKE_SCENE_DESCRIPTION, null, 2)}

## 你的任務：
請**實際觀看影片**，然後告訴我：
1. 你在影片中看到了什麼？（詳細描述畫面內容、顏色、動作）
2. 場景描述是否正確？如果不正確，哪裡不對？

請以 JSON 格式回答：
\`\`\`json
{
  "whatISee": "我實際看到的畫面內容...",
  "descriptionCorrect": true/false,
  "differences": "如果描述不正確，列出差異..."
}
\`\`\``;

    console.log('🔍 調用 Gemini API...\n');

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            fileData: {
                                mimeType: 'video/mp4',
                                fileUri: TEST_VIDEO_URL
                            }
                        },
                        { text: prompt }
                    ]
                }]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error('❌ API 錯誤:', JSON.stringify(data, null, 2));
        throw new Error('API call failed');
    }

    const responseText = data.candidates[0].content.parts[0].text;

    console.log('📊 Gemini 回應:\n');
    console.log(responseText);

    // 嘗試解析 JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        console.log('\n' + '='.repeat(60));
        console.log('✅ 測試結果:');
        console.log('='.repeat(60));
        console.log('Gemini 看到的內容:', result.whatISee);
        console.log('描述是否正確:', result.descriptionCorrect ? '✓ 正確' : '✗ 不正確');
        if (result.differences) {
            console.log('差異:', result.differences);
        }
        console.log('='.repeat(60));

        if (!result.descriptionCorrect) {
            console.log('\n🎉 測試通過！Gemini 確實有分析影片內容，而非只看文字描述。');
        } else {
            console.log('\n⚠️  測試失敗！Gemini 可能沒有真正分析影片。');
        }
    }
}

analyzeVideoDirectly().catch(error => {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
});
