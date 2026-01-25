import type { PromptTemplate, ProjectReference } from '@/lib/types/storyboard';

/**
 * 根據參考圖資訊構建增強的系統提示詞
 */
export function buildSystemPrompt(
    template: PromptTemplate,
    references?: ProjectReference[]
): string {
    let prompt = template.systemPrompt;

    if (references && references.length > 0) {
        // 整理角色、商品和環境參考
        const characterRefs = references.filter(r => r.type === 'character');
        const productRefs = references.filter(r => r.type === 'product');
        const environmentRefs = references.filter(r => r.type === 'environment');
        const styleRefs = references.filter(r => r.type === 'style');

        prompt += `\n\n---\n\n## 用戶已提供的參考圖\n\n`;

        const angleMap: Record<string, string> = {
            'front': 'Front View (正面)',
            'side': 'Side View (側面)',
            'three_quarter': '3/4 View (3/4側)',
            'back': 'Back View (背面)',
            'top': 'Top View (頂視)',
            'other': 'Other View'
        };

        if (characterRefs.length > 0) {
            prompt += `### 角色參考\n`;
            characterRefs.forEach(r => {
                const charName = r.name || '未命名角色';
                const angleInfo = r.angle ? ` [${angleMap[r.angle] || r.angle}]` : '';
                prompt += `- **<${charName}>**${angleInfo}: ${r.description}\n`;
            });
            prompt += '\n';
        }

        if (productRefs.length > 0) {
            prompt += `### 商品參考\n`;
            productRefs.forEach(r => {
                const prodName = r.name || '未命名商品';
                const angleInfo = r.angle ? ` [${angleMap[r.angle] || r.angle}]` : '';
                prompt += `- **<${prodName}>**${angleInfo}: ${r.description}\n`;
            });
            prompt += '\n';
        }

        if (environmentRefs.length > 0) {
            prompt += `### 環境參考\n`;
            environmentRefs.forEach(r => {
                prompt += `- ${r.description}\n`;
            });
            prompt += '\n';
        }

        if (styleRefs.length > 0) {
            prompt += `### 風格參考\n`;
            styleRefs.forEach(r => {
                prompt += `- ${r.description}\n`;
            });
            prompt += '\n';
        }

        // 加入額外規範
        prompt += `## ⚠️ 參考圖一致性規範

由於用戶已提供參考圖，請遵循以下規則：

1. **標記引用**：在 description 中使用 \`<名稱>\` 格式引用角色或商品
${characterRefs.map(r => `   - 使用 \`<${r.name || '角色'}>\` 指代該角色`).join('\n')}
${productRefs.map(r => `   - 使用 \`<${r.name || '商品'}>\` 指代該商品`).join('\n')}

2. **外觀省略**：不要描述角色或商品的外觀細節（如髮型、服裝、顏色、材質），這些已由參考圖定義

3. **專注描述**：description 應專注於：
   - 角色/商品在畫面中的位置（左側/右側/中央/前景/背景）
   - 面向的方向（facing left/right/camera/away）
   - 姿態、動作狀態、表情（針對角色）
   - 光線反射、擺放角度（針對商品）
   - 與其他元素的相對位置

4. **位置精確**：必須明確描述每個元素在畫面中的位置

✅ 正確範例：「Medium shot. <Alice> 在畫面左側，手持 <iPhone>，面向右方。柔和側光照射在 <iPhone> 的金屬邊框上。」
❌ 錯誤範例：「Alice（短髮女性）拿著黑色的 iPhone 16 Pro」
`;
    }

    return prompt;
}
