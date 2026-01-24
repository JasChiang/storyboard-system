# 圖片生成提示詞模式說明

本文檔說明圖片生成時三種提示詞模式的使用方式和適用場景。

---

## 三種提示詞模式

### 1. 增強模式 (Append) - 預設推薦

**組合方式**：`場景描述 + 自訂內容`

**適用場景**：
- 保留原始場景概念，只是增強細節
- 添加質感、光線、風格等補充描述
- 微調圖片品質和氛圍

**範例**：

**場景描述**：
```
黑色背景中，MEGA KING行動電源緩慢旋轉，展現高級質感
```

**自訂輸入**：
```
柔和側光，產品攝影，8K 超高清，專業攝影棚
```

**最終提示詞**：
```
黑色背景中，MEGA KING行動電源緩慢旋轉，展現高級質感. 柔和側光，產品攝影，8K 超高清，專業攝影棚
```

**結果**：保留原始產品和背景設定，但提升了攝影品質和光線效果。

---

### 2. 覆蓋模式 (Replace)

**組合方式**：`只使用自訂內容`

**適用場景**：
- 完全改變視覺風格
- 使用不同的背景或環境
- 進行風格實驗和創意嘗試

**範例**：

**場景描述**：
```
黑色背景中，MEGA KING行動電源緩慢旋轉，展現高級質感
```

**自訂輸入**：
```
Futuristic power bank floating in cyberpunk city, neon lights, blade runner style, cinematic, 8K
```

**最終提示詞**：
```
Futuristic power bank floating in cyberpunk city, neon lights, blade runner style, cinematic, 8K
```

**結果**：完全不同的科幻風格，原始場景描述被完全替換。

**注意事項**：
- 場景描述會被完全忽略
- 需要自行確保提示詞完整（包含主體、環境、風格等）
- 適合進階用戶

---

### 3. 優先模式 (Prepend)

**組合方式**：`自訂內容 + 場景描述`

**適用場景**：
- 強調特定風格或氛圍
- 保留場景概念，但優先考慮視覺風格
- 為整個場景設定統一基調

**範例**：

**場景描述**：
```
黑色背景中，MEGA KING行動電源緩慢旋轉，展現高級質感
```

**自訂輸入**：
```
Cinematic product shot, dramatic lighting, shallow depth of field, professional studio
```

**最終提示詞**：
```
Cinematic product shot, dramatic lighting, shallow depth of field, professional studio. 黑色背景中，MEGA KING行動電源緩慢旋轉，展現高級質感
```

**結果**：保留產品和動作，但整體呈現電影感的專業攝影風格。

---

## 使用建議

### 新手用戶
- 建議使用**增強模式**
- 只需添加簡單的品質關鍵詞
- 例如：「高品質，8K，專業攝影」

### 進階用戶
- **增強模式**：微調現有場景
- **優先模式**：設定特定風格基調
- **覆蓋模式**：完全自訂創意

### 最佳實踐

#### 增強模式範例
```
高品質產品攝影
柔和側光，自然光線
8K 解析度，極致細節
專業攝影棚設置
```

#### 覆蓋模式範例
```
A sleek black power bank on a wooden desk, 
warm ambient lighting, cozy home office setting, 
shallow depth of field, Sony A7R IV, 50mm f/1.4, 
professional product photography, 8K
```

#### 優先模式範例
```
Minimalist style, clean composition, soft pastel colors
Cinematic lighting, high-end fashion photography aesthetic
Dramatic shadows, artistic composition
```

---

## 即時預覽功能

系統提供即時預覽功能，讓您在生成前：
1. 查看最終提示詞內容
2. 確認模式是否正確
3. 調整自訂內容以達到最佳效果

**預覽位置**：自訂提示詞輸入框下方的藍色區塊

---

## 常見問題

### Q1: 為什麼模式選擇器是灰色的？
**A**: 只有在輸入自訂提示詞後，模式選擇器才會啟用。

### Q2: 三種模式哪個最好？
**A**: 沒有絕對的「最好」，取決於您的需求：
- 微調 → 增強模式
- 重新定義 → 覆蓋模式
- 風格優先 → 優先模式

### Q3: 參考圖會受影響嗎？
**A**: 不會，參考圖的保持指令會自動添加到所有模式的最終提示詞中。

### Q4: 批次生成支援模式選擇嗎？
**A**: 目前批次生成只支援場景描述，暫不支援自訂提示詞和模式選擇。

---

## 技術細節

### 提示詞組合邏輯

```typescript
if (!customPrompt) {
    // 沒有自訂內容
    return scene.description;
} else {
    switch (promptMode) {
        case 'append':
            return scene.description + '. ' + customPrompt;
        case 'replace':
            return customPrompt;
        case 'prepend':
            return customPrompt + '. ' + scene.description;
    }
}

// 參考圖指令會自動添加（如果有）
```

### 模式預設值
- 預設使用**增強模式 (append)**
- 最安全且最直覺的選擇
- 適合大多數使用場景

---

## 更新日誌

### Version 1.0 (2026-01-24)
- 新增三種提示詞模式選擇
- 添加即時預覽功能
- 智能佔位符提示
- 動態模式說明
