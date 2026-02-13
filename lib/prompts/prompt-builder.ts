import type { PromptTemplate, ProjectReference } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';

/**
 * 根據參考圖資訊構建增強的系統提示詞
 */
export function buildSystemPrompt(
    template: PromptTemplate,
    references?: ProjectReference[]
): string {
    let prompt = template.systemPrompt;

    if (references && references.length > 0) {
        const consolidatedRules = buildConsolidatedReferenceRules(references);
        // 整理角色、商品和環境參考
        const characterRefs = references.filter(r => r.type === 'character');
        const productRefs = references.filter(r => r.type === 'product');
        const environmentRefs = references.filter(r => r.type === 'environment');
        const styleRefs = references.filter(r => r.type === 'style');

        prompt += `\n\n---\n\n## 使用者已提供的參考圖\n\n`;

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
                const guidelineText = r.guidelines ? ` | 規則：${r.guidelines}` : '';
                const identityText = r.identityCore ? ` | 核心：${r.identityCore}` : '';
                const mustKeepText = r.mustKeepFeatures?.length
                    ? ` | 不可改變：${r.mustKeepFeatures.join('、')}`
                    : '';
                const ipVersionText = r.ipProfile?.profileVersion ? ` | IP版本：v${r.ipProfile.profileVersion}` : '';
                const ipRuleText = r.ipProfile?.immutableRules?.length
                    ? ` | IP硬規則：${r.ipProfile.immutableRules.join('；')}`
                    : '';
                prompt += `- **<${charName}>**${angleInfo}: ${r.description}${identityText}${mustKeepText}${guidelineText}${ipVersionText}${ipRuleText}\n`;
            });
            prompt += '\n';
        }

        if (productRefs.length > 0) {
            prompt += `### 商品參考\n`;
            productRefs.forEach(r => {
                const prodName = r.name || '未命名商品';
                const angleInfo = r.angle ? ` [${angleMap[r.angle] || r.angle}]` : '';
                const identityText = r.identityCore ? ` | 核心：${r.identityCore}` : '';
                const mustKeepText = r.mustKeepFeatures?.length
                    ? ` | 不可改變：${r.mustKeepFeatures.join('、')}`
                    : '';
                const guidelineText = r.guidelines ? ` | 規則：${r.guidelines}` : '';
                const ipVersionText = r.ipProfile?.profileVersion ? ` | IP版本：v${r.ipProfile.profileVersion}` : '';
                const ipRuleText = r.ipProfile?.immutableRules?.length
                    ? ` | IP硬規則：${r.ipProfile.immutableRules.join('；')}`
                    : '';
                prompt += `- **<${prodName}>**${angleInfo}: ${r.description}${identityText}${mustKeepText}${guidelineText}${ipVersionText}${ipRuleText}\n`;
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

        if (consolidatedRules.length > 0) {
            prompt += `### 合併後一致性規則（多視角/多來源已整併）\n`;
            consolidatedRules.forEach(rule => {
                const coreText = rule.identityCore ? ` | 核心：${rule.identityCore}` : '';
                const mustKeepText = rule.mustKeepFeatures.length
                    ? ` | 不可改變：${rule.mustKeepFeatures.join('、')}`
                    : '';
                const guidelineText = rule.guidelines.length
                    ? ` | 規範：${rule.guidelines.join('；')}`
                    : '';
                prompt += `- ${rule.tag}${coreText}${mustKeepText}${guidelineText}\n`;
            });
            prompt += '\n';
        }

        // 加入額外規範
        prompt += `## ⚠️ 參考圖一致性規範

由於使用者已提供參考圖，請遵循以下規則：

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

5. **不可變特徵優先**：
   - 若參考圖提供「不可改變」條目，請在所有場景中保持一致
   - 只允許描述「位置、姿態、構圖、情緒、光線」的變化
   - 不可重新定義角色/商品的核心外觀

6. **結構化追蹤**：
   - 每個場景需輸出 \`charactersUsed\`（如 ["<Alice>"]）
   - 每個場景需輸出 \`productsUsed\`（如 ["<iPhone>"]）
   - 每個場景需輸出 \`changeFromPrev\`（若為第一場可填 "N/A"）

7. **一致性合併優先序**：
   - 若同角色/商品有多視角或多份參考，請以「合併後一致性規則」為最高準則
   - 不可在 description 重新定義已合併的核心外觀特徵

✅ 正確範例：「Medium shot. <Alice> 在畫面左側，手持 <iPhone>，面向右方。柔和側光照射在 <iPhone> 的金屬邊框上。」
❌ 錯誤範例：「Alice（短髮女性）拿著黑色的 iPhone 16 Pro」
`;
    }

    return prompt;
}
