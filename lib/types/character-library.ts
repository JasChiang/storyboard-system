/**
 * 全局角色庫（Global Character Library）
 * 用於儲存可重複使用的 IP 角色、商品、風格等參考資源
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
  preferredVideoModel?: 'kling' | 'seedance';
  preferredOutputAspectRatio?: '16:9' | '9:16' | '1:1';
  preferredKlingDuration?: 5 | 10;
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

export interface CharacterLibraryItem {
  id: string;
  name: string;                    // 角色名稱（如 "吉祥物小熊"）
  type: 'character' | 'product' | 'environment' | 'style';
  status: CharacterLibraryStatus;  // workflow 品質狀態
  description: string;              // 全局描述
  guidelines?: string;              // 規則/限制（提供給生成提示詞）
  tags: string[];                   // 標籤（用於搜尋和分類）

  // 多視角參考圖
  views: CharacterLibraryView[];

  // Versioning
  version: number;                 // 角色庫 item 版本（更新 views / 規則時遞增）
  currentSnapshotId?: string;      // 快照 id，供專案引用時鎖定來源版本

  // 中繼資料
  ipProfile?: CharacterIpProfile;     // IP 套件設定（版本、硬規則、預設參數）
  createdAt: string;
  updatedAt: string;
  usageCount: number;               // 被引用次數
}

export interface CharacterLibraryView {
  angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
  url: string;                    // Fal Storage URL（供模型參考使用）
  description: string;            // 該視角的描述
  mustKeepFeatures?: string[];    // 該視角不可變特徵
  identityCore?: string;
  styleTraits?: string;
  angleVisibility?: string;
  archivedLocalPath?: string;     // 本地備份路徑（.data/local-media 下的相對路徑）
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
 * 將角色庫專案轉換為 ProjectReference 格式
 */
export function characterLibraryItemToProjectReference(
  item: CharacterLibraryItem,
  selectedAngle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other' = 'front'
): ProjectReference {
  const view = item.views.find(v => v.angle === selectedAngle) || item.views[0];

  if (!view) {
    throw new Error(`角色 ${item.name} 沒有可用的視角圖片`);
  }

  const usageRole = inferFallbackUsageRole(item);
  const reference: ProjectReference = {
    id: crypto.randomUUID(),
    url: view.url,
    description: view.description,
    type: item.type,
    name: item.name,
    angle: view.angle,
    descriptionSource: 'ai',
    guidelines: item.guidelines,
    mustKeepFeatures: view.mustKeepFeatures,
    identityCore: view.identityCore,
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

export function characterLibraryItemToProjectReferences(
  item: CharacterLibraryItem,
  mode: 'front' | 'all' = 'front'
): ProjectReference[] {
  if (mode === 'front') {
    return [characterLibraryItemToProjectReference(item, 'front')];
  }

  return item.views.map((view) => {
    const usageRole = inferFallbackUsageRole(item);
    const reference: ProjectReference = {
      id: crypto.randomUUID(),
      url: view.url,
      description: view.description,
      type: item.type,
      name: item.name,
      angle: view.angle,
      descriptionSource: 'ai',
      guidelines: item.guidelines,
      mustKeepFeatures: view.mustKeepFeatures,
      identityCore: view.identityCore,
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
  });
}
