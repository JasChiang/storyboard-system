/**
 * 全局角色庫（Global Character Library）
 * 用於儲存可重複使用的 IP 角色、商品、風格等參考資源
 *
 * Schema v2（2026-04-22）：改為「圖管身份、結構化負面指令、動作安全表」三欄分離，
 * 取代 v1 的散文 description + guidelines + mustKeepFeatures 混寫。舊欄位保留為
 * @deprecated fallback，所有下游 consumer 優先讀新欄位、fallback 舊欄位。
 */

import type { ProjectReference } from './storyboard';
import { buildStructuredIdentityLock } from '@/lib/references/identity-lock';
import {
  inferFallbackAnchorRole,
  inferFallbackUsageRole,
  normalizeCharacterStatus,
  type CharacterLibraryStatus,
} from '@/lib/characters/workflow';

export type IpTextLogoPolicy = 'lock_visible_text' | 'forbid_new_text';

export interface CharacterGenerationDefaults {
  preferredVideoModel?: 'seedance';
  preferredOutputAspectRatio?: '16:9' | '9:16' | '1:1';
  preferredSeedanceDuration?: number; // 4-12
}

export interface CharacterIpProfile {
  profileVersion: number;
  strictIdentity: boolean;
  allowAccessoryChanges: boolean;
  textLogoPolicy: IpTextLogoPolicy;
  immutableRules?: string[];
  generationDefaults?: CharacterGenerationDefaults;
}

/**
 * 渲染媒介 — 角色「被設計時的」視覺語言。用來限制可搭配的 style preset
 * 並防止模型自動 3D 化／寫實化扁平吉祥物。
 */
export type RenderingMedium =
  | 'flat_2d'     // 向量扁平，粗黑輪廓
  | 'cel_3d'      // 3D 但套賽璐璐陰影
  | 'clay_3d'     // 黏土／毛氈／手作材質
  | 'photoreal'   // 寫實攝影
  | 'painterly'   // 繪畫筆觸
  | 'mixed';      // 其他

/**
 * 模型常見失敗的部位級別清單。注入提示詞時會展開成：
 *   "{part}: <correctShape>. Avoid: <commonFailures.join(', ')>."
 * 這是解 gpt-image-2 / Seedream 在極端姿勢下的 drift 主武器。
 */
export interface CharacterDriftHotspot {
  part: string;                  // 'hands' | 'feet' | 'eyes' | 'torso' | 任意自訂
  correctShape?: string;         // 2-3 句，正確形狀描述
  commonFailures: string[];      // 模型常見失敗：['articulated fingers', 'rounded 3D shoes']
}

/**
 * 動作安全表 — 根據實測結果固化的 prior 規避規則。
 */
export interface CharacterActionSafety {
  forbiddenVerbs?: string[];                                   // 觸發 prior 的動詞
  rewriteRules?: Array<{ trigger: string; rewrite: string }>;  // 'hold' → 'balanced on open mitten palm'
  anatomyConstraints?: string[];                               // 'no fingers', 'no separated limbs'
}

/**
 * 雙層特徵設計：外層（身份鎖定，不可變）+ 內層（表情載體，可隨 mood 切換）。
 * 典型例子：吉祥物的眼睛 — 外層（顏色/輪廓）身份固定，內層白色形狀可變（O / 橫線 / 星星 / …）。
 * 讓 prompt builder 在知道 mood 時，只改「內層」而絕不動「外層」。
 */
export interface FeatureVariantPreset {
  mood: string;          // 'neutral' | 'happy_closed' | 'sleepy' | 'excited' | 'wink_left' | 自訂
  innerFill: string;     // 該情緒下的內層描述；prompt 會以此取代 default
  description?: string;  // 選填，給 UI 顯示或作者註記用
}

export interface FeatureVariantGroup {
  /** 外層不可變的描述（身份鎖）— prompt 裡會強化這句「never modify」。 */
  identityLayer: string;
  /** 內層在 neutral / default 情境下的描述。 */
  defaultInner: string;
  /** 可切換的 mood preset。 */
  presets: FeatureVariantPreset[];
}

/**
 * Mood / 表情變體清單。
 * 通用結構，以後可擴充 mouth、stickers、body decals 等。
 * Prompt builder 會在 scene 指定 mood 時，於 invariant layers 之後追加一行
 * "Only change the inner layer to '{preset.innerFill}', keep '{identityLayer}' unchanged."
 */
export interface CharacterFeatureVariants {
  eyes?: FeatureVariantGroup;
  mouth?: FeatureVariantGroup;
  // 保留給其他部位：body_decal、cheeks、antenna 等
}

export interface CharacterLibraryItem {
  id: string;
  name: string;                    // 角色名稱（如 "吉祥物小熊"）
  type: 'character' | 'product' | 'environment' | 'style';
  status: CharacterLibraryStatus;  // workflow 品質狀態
  tags?: string[];                 // 標籤（保留給未來搜尋；v1 起未實作消費）

  // ---- v2 Identity ----
  /**
   * 一句話英文名詞短語，prompt 第一句。≤200 字。
   * 例："a round white vinyl-robot mascot with two asymmetric O-shaped eyes"
   */
  identityAnchor?: string;

  /** 角色被設計時的渲染媒介；限制可搭配的 style preset。 */
  renderingMedium?: RenderingMedium;

  /** 短，附加到 prompt 結尾的風格指令。例："flat 2D vector, thick black outlines, no gradients" */
  styleDirective?: string;

  /** 短名詞短語清單；取代 v1 的 mustKeepFeatures。 */
  preserveList?: string[];

  /** Per-part 結構化 drift 防禦。 */
  driftHotspots?: CharacterDriftHotspot[];

  /** 動作 prior 規避表。 */
  actionSafety?: CharacterActionSafety;

  /** 雙層特徵的表情變體（眼睛/嘴巴等）— prompt builder 在有 mood 時取對應 preset。 */
  featureVariants?: CharacterFeatureVariants;

  // ---- Multi-view references (primary identity carrier) ----
  views: CharacterLibraryView[];

  // ---- Versioning ----
  version: number;                 // 更新 views / 規則時遞增
  currentSnapshotId?: string;      // 專案引用時鎖定來源版本

  // ---- 中繼資料 ----
  ipProfile?: CharacterIpProfile;
  createdAt: string;
  updatedAt: string;
  usageCount: number;

  // ---- v1 Deprecated（保留作 fallback；migration 完成後移除） ----
  /** @deprecated v2：改用 `identityAnchor` + `preserveList`。 */
  description?: string;
  /** @deprecated v2：改用 `driftHotspots` + `ipProfile.immutableRules`。 */
  guidelines?: string;
  /** @deprecated v2：改用 `preserveList`。 */
  mustKeepFeatures?: string[];
  /** @deprecated v2：合併進 `identityAnchor`。 */
  identityCore?: string;
}

export type CharacterViewAngle =
  | 'front'
  | 'side'         // 舊資料：未區分左右（左右對稱角色也用這個）
  | 'side_left'    // 左側面（角色的左半身朝向鏡頭）
  | 'side_right'   // 右側面（角色的右半身朝向鏡頭）
  | 'three_quarter'
  | 'back'
  | 'top'
  | 'other';

export interface CharacterLibraryView {
  angle: CharacterViewAngle;
  url: string;                    // Fal Storage URL（供模型參考使用）
  archivedLocalPath?: string;     // 本地備份路徑（.data/local-media 下的相對路徑）

  // ---- v2 Structured per-angle metadata ----
  /** 此視角可明確看到的特徵清單。例：["front face", "torso S-swirl", "both arms"] */
  visibleFeatures?: string[];
  /** 此視角不可見的特徵，用來抑制 prompt 裡不合理的保留要求。 */
  hiddenFeatures?: string[];

  // ---- v1 Deprecated ----
  /** @deprecated v2：改用 `visibleFeatures` + item-level `preserveList`。 */
  description?: string;
  /** @deprecated v2：改用 item-level `preserveList`。 */
  mustKeepFeatures?: string[];
  /** @deprecated v2：改用 item-level `identityAnchor`。 */
  identityCore?: string;
  /** @deprecated v2：改用 item-level `styleDirective`。 */
  styleTraits?: string;
  /** @deprecated v2：改用 `visibleFeatures` + `hiddenFeatures`。 */
  angleVisibility?: string;
}

export function resolveCharacterViewPreviewUrl(view: CharacterLibraryView): string {
  if (view.archivedLocalPath) {
    return `/api/local-media?path=${encodeURIComponent(view.archivedLocalPath)}`;
  }
  return view.url;
}

export interface CharacterLibrary {
  items: CharacterLibraryItem[];
  version: number;                  // 用於未来迁移
}

/**
 * 將 CharacterLibraryItem + 單一 view 轉換為 ProjectReference。
 * 同步填入 v2 結構化欄位與 v1 deprecated fallback 欄位，讓新舊 consumer 都能運作。
 */
function buildReferenceFromItemView(item: CharacterLibraryItem, view: CharacterLibraryView): ProjectReference {
  const usageRole = inferFallbackUsageRole(item);

  // v2 欄位優先；缺則從 v1 推導（migration 尚未完成的角色）
  const identityAnchor = item.identityAnchor || item.identityCore || view.identityCore;
  const preserveList = item.preserveList?.length
    ? item.preserveList
    : item.mustKeepFeatures?.length
      ? item.mustKeepFeatures
      : view.mustKeepFeatures;

  const fallbackDescription = view.description || item.description || '';

  const reference: ProjectReference = {
    id: crypto.randomUUID(),
    url: view.url,
    description: fallbackDescription,
    type: item.type,
    name: item.name,
    angle: view.angle,
    descriptionSource: 'ai',

    // v2 structured
    identityAnchor,
    renderingMedium: item.renderingMedium,
    styleDirective: item.styleDirective || view.styleTraits,
    preserveList,
    driftHotspots: item.driftHotspots,
    actionSafety: item.actionSafety,
    featureVariants: item.featureVariants,
    visibleFeatures: view.visibleFeatures,
    hiddenFeatures: view.hiddenFeatures,

    // v1 deprecated — kept for back-compat consumers
    guidelines: item.guidelines,
    mustKeepFeatures: preserveList,
    identityCore: identityAnchor,
    styleTraits: view.styleTraits,
    angleVisibility: view.angleVisibility,

    ipProfile: item.ipProfile,
    sourceCharacterLibraryItemId: item.id,
    sourceCharacterStatus: normalizeCharacterStatus(item.status),
    sourceCharacterLibraryVersion: item.version,
    sourceCharacterSnapshotId: item.currentSnapshotId,
    isAnchor: inferFallbackAnchorRole(item),
    usageRole,
  };

  return {
    ...reference,
    structuredIdentityLock: buildStructuredIdentityLock(reference),
  };
}

/**
 * 將角色庫專案轉換為 ProjectReference 格式
 */
export function characterLibraryItemToProjectReference(
  item: CharacterLibraryItem,
  selectedAngle: CharacterViewAngle = 'front'
): ProjectReference {
  const view = item.views.find(v => v.angle === selectedAngle) || item.views[0];
  if (!view) {
    throw new Error(`角色 ${item.name} 沒有可用的視角圖片`);
  }
  return buildReferenceFromItemView(item, view);
}

export function characterLibraryItemToProjectReferences(
  item: CharacterLibraryItem,
  mode: 'front' | 'all' = 'front'
): ProjectReference[] {
  if (mode === 'front') {
    return [characterLibraryItemToProjectReference(item, 'front')];
  }
  return item.views.map((view) => buildReferenceFromItemView(item, view));
}
