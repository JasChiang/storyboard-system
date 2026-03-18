'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fal } from '@fal-ai/client';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { CHARACTER_STATUS_LABELS, type CharacterLibraryStatus } from '@/lib/characters/workflow';

interface CharacterCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void | Promise<void>;
  editingCharacter?: CharacterLibraryItem;
}

interface ViewUpload {
  angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
  url: string;
  description: string;
  mustKeepFeatures?: string[];
  identityCore?: string;
  styleTraits?: string;
  angleVisibility?: string;
}

const DEFAULT_IP_PROFILE = {
  profileVersion: 1,
  strictIdentity: true,
  allowAccessoryChanges: true,
  textLogoPolicy: 'lock_visible_text' as const,
  immutableRules: [] as string[],
  generationDefaults: {
    preferredVideoModel: 'kling' as const,
    preferredOutputAspectRatio: '16:9' as const,
    preferredKlingDuration: 5 as const,
    preferredSeedanceDuration: 5,
  },
};

const ANGLE_OPTIONS = [
  { value: 'front' as const, label: '正面', emoji: '⬛' },
  { value: 'side' as const, label: '側面', emoji: '◼️' },
  { value: 'three_quarter' as const, label: '3/4 側', emoji: '📐' },
  { value: 'back' as const, label: '背面', emoji: '⬜' },
  { value: 'top' as const, label: '頂部', emoji: '🔼' },
  { value: 'other' as const, label: '其他', emoji: '⚪' },
];

const TYPE_OPTIONS = [
  { value: 'character' as const, label: '角色', hint: '人物、動物角色' },
  { value: 'product' as const, label: '商品', hint: '產品、道具' },
  { value: 'environment' as const, label: '環境', hint: '場景、背景' },
  { value: 'style' as const, label: '風格', hint: '視覺風格參考' },
];

export function CharacterCreateDialog({
  isOpen,
  onClose,
  onSave,
  editingCharacter,
}: CharacterCreateDialogProps) {
  const [name, setName] = useState(editingCharacter?.name || '');
  const [type, setType] = useState<CharacterLibraryItem['type']>(editingCharacter?.type || 'character');
  const [description, setDescription] = useState(editingCharacter?.description || '');
  const [status, setStatus] = useState<CharacterLibraryStatus>(editingCharacter?.status || 'draft');
  const [guidelines, setGuidelines] = useState(editingCharacter?.guidelines || '');
  const [tags, setTags] = useState<string[]>(editingCharacter?.tags || []);
  const [views, setViews] = useState<ViewUpload[]>(editingCharacter?.views || []);
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingAngle, setUploadingAngle] = useState<ViewUpload['angle'] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);
  const [showIpSettings, setShowIpSettings] = useState(false);
  const [profileVersion, setProfileVersion] = useState(
    editingCharacter?.ipProfile?.profileVersion ?? DEFAULT_IP_PROFILE.profileVersion
  );
  const [strictIdentity, setStrictIdentity] = useState(
    editingCharacter?.ipProfile?.strictIdentity ?? DEFAULT_IP_PROFILE.strictIdentity
  );
  const [allowAccessoryChanges, setAllowAccessoryChanges] = useState(
    editingCharacter?.ipProfile?.allowAccessoryChanges ?? DEFAULT_IP_PROFILE.allowAccessoryChanges
  );
  const [textLogoPolicy, setTextLogoPolicy] = useState<'lock_visible_text' | 'forbid_new_text'>(
    editingCharacter?.ipProfile?.textLogoPolicy ?? DEFAULT_IP_PROFILE.textLogoPolicy
  );
  const [immutableRulesText, setImmutableRulesText] = useState(
    (editingCharacter?.ipProfile?.immutableRules || []).join('\n')
  );
  const [preferredVideoModel, setPreferredVideoModel] = useState<'kling' | 'seedance'>(
    editingCharacter?.ipProfile?.generationDefaults?.preferredVideoModel
    ?? DEFAULT_IP_PROFILE.generationDefaults.preferredVideoModel
  );
  const [preferredOutputAspectRatio, setPreferredOutputAspectRatio] = useState<'16:9' | '9:16' | '1:1'>(
    editingCharacter?.ipProfile?.generationDefaults?.preferredOutputAspectRatio
    ?? DEFAULT_IP_PROFILE.generationDefaults.preferredOutputAspectRatio
  );
  const [preferredKlingDuration, setPreferredKlingDuration] = useState<5 | 10>(
    editingCharacter?.ipProfile?.generationDefaults?.preferredKlingDuration
    ?? DEFAULT_IP_PROFILE.generationDefaults.preferredKlingDuration
  );
  const [preferredSeedanceDuration, setPreferredSeedanceDuration] = useState<number>(
    editingCharacter?.ipProfile?.generationDefaults?.preferredSeedanceDuration
    ?? DEFAULT_IP_PROFILE.generationDefaults.preferredSeedanceDuration
  );

  useEffect(() => {
    if (!isOpen) return;
    setShowIpSettings(Boolean(editingCharacter));

    if (editingCharacter) {
      setName(editingCharacter.name || '');
      setType(editingCharacter.type || 'character');
      setDescription(editingCharacter.description || '');
      setStatus(editingCharacter.status || 'draft');
      setGuidelines(editingCharacter.guidelines || '');
      setTags(editingCharacter.tags || []);
      setViews(editingCharacter.views || []);
      setProfileVersion(editingCharacter.ipProfile?.profileVersion ?? DEFAULT_IP_PROFILE.profileVersion);
      setStrictIdentity(editingCharacter.ipProfile?.strictIdentity ?? DEFAULT_IP_PROFILE.strictIdentity);
      setAllowAccessoryChanges(editingCharacter.ipProfile?.allowAccessoryChanges ?? DEFAULT_IP_PROFILE.allowAccessoryChanges);
      setTextLogoPolicy(editingCharacter.ipProfile?.textLogoPolicy ?? DEFAULT_IP_PROFILE.textLogoPolicy);
      setImmutableRulesText((editingCharacter.ipProfile?.immutableRules || []).join('\n'));
      setPreferredVideoModel(
        editingCharacter.ipProfile?.generationDefaults?.preferredVideoModel
        ?? DEFAULT_IP_PROFILE.generationDefaults.preferredVideoModel
      );
      setPreferredOutputAspectRatio(
        editingCharacter.ipProfile?.generationDefaults?.preferredOutputAspectRatio
        ?? DEFAULT_IP_PROFILE.generationDefaults.preferredOutputAspectRatio
      );
      setPreferredKlingDuration(
        editingCharacter.ipProfile?.generationDefaults?.preferredKlingDuration
        ?? DEFAULT_IP_PROFILE.generationDefaults.preferredKlingDuration
      );
      setPreferredSeedanceDuration(
        editingCharacter.ipProfile?.generationDefaults?.preferredSeedanceDuration
        ?? DEFAULT_IP_PROFILE.generationDefaults.preferredSeedanceDuration
      );
    } else {
      setName('');
      setType('character');
      setDescription('');
    setStatus('draft');
      setStatus('draft');
      setGuidelines('');
      setTags([]);
      setViews([]);
      setProfileVersion(DEFAULT_IP_PROFILE.profileVersion);
      setStrictIdentity(DEFAULT_IP_PROFILE.strictIdentity);
      setAllowAccessoryChanges(DEFAULT_IP_PROFILE.allowAccessoryChanges);
      setTextLogoPolicy(DEFAULT_IP_PROFILE.textLogoPolicy);
      setImmutableRulesText('');
      setPreferredVideoModel(DEFAULT_IP_PROFILE.generationDefaults.preferredVideoModel);
      setPreferredOutputAspectRatio(DEFAULT_IP_PROFILE.generationDefaults.preferredOutputAspectRatio);
      setPreferredKlingDuration(DEFAULT_IP_PROFILE.generationDefaults.preferredKlingDuration);
      setPreferredSeedanceDuration(DEFAULT_IP_PROFILE.generationDefaults.preferredSeedanceDuration);
    }
  }, [isOpen, editingCharacter]);

  if (!isOpen) return null;

  const handleFileSelect = async (angle: ViewUpload['angle'], file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片文件');
      return;
    }

    setIsUploading(true);
    setUploadingAngle(angle);

    try {
      const uploadedUrl = await fal.storage.upload(file);

      // 使用 AI 分析圖片
      setIsAnalyzing(true);
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/openrouter/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          angle,
          type,
          userNote: `${name} - ${angle}`,
        }),
      });

      const data = await response.json();
      const aiDescription = response.ok ? data.description : `${name} 的 ${ANGLE_OPTIONS.find(a => a.value === angle)?.label}`;

      setViews([...views, {
        angle,
        url: uploadedUrl,
        description: aiDescription,
        mustKeepFeatures: data.analysis?.mustKeep || [],
        identityCore: data.analysis?.identityCore,
        styleTraits: data.analysis?.styleTraits,
        angleVisibility: data.analysis?.angleVisibility,
      }]);
    } catch (error) {
      console.error('上傳錯誤:', error);
      alert(error instanceof Error ? error.message : '上傳失敗');
    } finally {
      setIsUploading(false);
      setUploadingAngle(null);
      setIsAnalyzing(false);
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleRemoveView = (angle: ViewUpload['angle']) => {
    setViews(views.filter(v => v.angle !== angle));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('請輸入名稱');
      return;
    }

    if (views.length === 0) {
      alert('至少上傳一個視角的圖片');
      return;
    }

    await onSave({
      name: name.trim(),
      type,
      status: editingCharacter?.status || 'draft',
      description: description.trim() || `${name} - ${TYPE_OPTIONS.find(t => t.value === type)?.label}`,
      guidelines: guidelines.trim() || undefined,
      tags,
      views,
      ipProfile: {
        profileVersion: Number.isFinite(profileVersion) ? Math.max(1, Math.floor(profileVersion)) : 1,
        strictIdentity,
        allowAccessoryChanges,
        textLogoPolicy,
        immutableRules: immutableRulesText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        generationDefaults: {
          preferredVideoModel,
          preferredOutputAspectRatio,
          preferredKlingDuration,
          preferredSeedanceDuration: Math.max(4, Math.min(12, Math.round(preferredSeedanceDuration || 5))),
        },
      },
    });

    // 重置表單
    setName('');
    setType('character');
    setDescription('');
    setGuidelines('');
    setTags([]);
    setViews([]);
    setProfileVersion(DEFAULT_IP_PROFILE.profileVersion);
    setStrictIdentity(DEFAULT_IP_PROFILE.strictIdentity);
    setAllowAccessoryChanges(DEFAULT_IP_PROFILE.allowAccessoryChanges);
    setTextLogoPolicy(DEFAULT_IP_PROFILE.textLogoPolicy);
    setImmutableRulesText('');
    setPreferredVideoModel(DEFAULT_IP_PROFILE.generationDefaults.preferredVideoModel);
    setPreferredOutputAspectRatio(DEFAULT_IP_PROFILE.generationDefaults.preferredOutputAspectRatio);
    setPreferredKlingDuration(DEFAULT_IP_PROFILE.generationDefaults.preferredKlingDuration);
    setPreferredSeedanceDuration(DEFAULT_IP_PROFILE.generationDefaults.preferredSeedanceDuration);
    onClose();
  };

  const generateProfileField = async (target: 'description' | 'guidelines') => {
    if (!name.trim()) {
      alert('請先輸入名稱');
      return;
    }

    if (target === 'description') {
      setIsGeneratingDescription(true);
    } else {
      setIsGeneratingGuidelines(true);
    }

    try {
      const response = await fetch('/api/openrouter/generate-character-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          views,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '生成失敗');
      }

      if (target === 'description') {
        setDescription(data.description || '');
      } else {
        setGuidelines(data.guidelines || '');
      }
    } catch (error) {
      console.error('Generate profile field error:', error);
      alert(error instanceof Error ? error.message : '生成失敗');
    } finally {
      if (target === 'description') {
        setIsGeneratingDescription(false);
      } else {
        setIsGeneratingGuidelines(false);
      }
    }
  };

  const uploadedAngleSet = new Set(views.map((view) => view.angle));
  const missingAngles = ANGLE_OPTIONS.filter((angle) => !uploadedAngleSet.has(angle.value));
  const requiredFieldsReady = name.trim().length > 0 && views.length > 0;
  const formProgress = Math.min(
    100,
    (name.trim() ? 30 : 0)
    + (description.trim() ? 20 : 0)
    + (guidelines.trim() ? 10 : 0)
    + (views.length > 0 ? 25 : 0)
    + (tags.length > 0 ? 15 : 0)
  );
  const selectedTypeOption = TYPE_OPTIONS.find((option) => option.value === type);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="surface-panel flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-white/90 dark:border-white/10">
        {/* 標題列 */}
        <div className="flex items-start justify-between border-b border-border/70 p-6">
          <div>
            <p className="text-kicker">Character Profile</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {editingCharacter ? '編輯角色' : '新增角色'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedTypeOption?.label} · {selectedTypeOption?.hint}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-border/70 bg-white/70 p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:bg-slate-900/65 dark:text-slate-300"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區（可捲動） */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">完成度</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{formProgress}%</p>
            </div>
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">已上傳視角</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {views.length}/{ANGLE_OPTIONS.length}
              </p>
            </div>
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">待補視角</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {missingAngles.length > 0
                  ? missingAngles.slice(0, 3).map((angle) => angle.label).join(' / ')
                  : '已完整'}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            先填名稱與描述即可快速建檔；圖片與進階 IP 規則可後續補齊。
          </p>

          {/* 基本資訊 */}
          <div className="surface-soft space-y-4 p-5">
            <div>
              <label className="block text-sm font-medium mb-2">名稱 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：小熊吉祥物、iPhone 15"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">品質狀態</label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(['draft', 'reviewed', 'production_ready', 'archived'] as CharacterLibraryStatus[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition-all ${status === option ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}
                  >
                    <div className="font-medium">{CHARACTER_STATUS_LABELS[option]}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {option === 'draft' ? '尚未驗證，可先存檔。' : option === 'reviewed' ? '已做人工檢查。' : option === 'production_ready' ? '可作為 anchor reference。' : '不再參與新專案。'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">類型 *</label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      type === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {opt.hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">描述</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateProfileField('description')}
                  disabled={isGeneratingDescription || isUploading || isAnalyzing}
                >
                  {isGeneratingDescription ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 生成描述
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="角色的整體描述、特徵、用途等..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">角色規則 / 限制</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateProfileField('guidelines')}
                  disabled={isGeneratingGuidelines || isUploading || isAnalyzing}
                >
                  {isGeneratingGuidelines ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 生成規則
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                placeholder="例如：不可穿鞋、永遠微笑、手上必須拿藍色杯子..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                會加入到生成提示詞中，確保角色遵守設定
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <button
                type="button"
                onClick={() => setShowIpSettings((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">進階 IP 套件設定</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    用於穩定品牌角色/商品一致性與生成預設值（選填）。
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                  {showIpSettings ? '收合' : '展開'}
                  {showIpSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>

              {showIpSettings && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">規範版本</label>
                      <input
                        type="number"
                        min={1}
                        value={profileVersion}
                        onChange={(e) => setProfileVersion(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">文字 / Logo 規則</label>
                      <select
                        value={textLogoPolicy}
                        onChange={(e) => setTextLogoPolicy(e.target.value as 'lock_visible_text' | 'forbid_new_text')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="lock_visible_text">可見時必須完全一致</option>
                        <option value="forbid_new_text">禁止新增任何新文字</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={strictIdentity}
                        onChange={(e) => setStrictIdentity(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                      />
                      強一致（身份與外觀鎖定）
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowAccessoryChanges}
                        onChange={(e) => setAllowAccessoryChanges(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                      />
                      允許配件變化
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">硬規則（每行一條）</label>
                    <textarea
                      value={immutableRulesText}
                      onChange={(e) => setImmutableRulesText(e.target.value)}
                      rows={3}
                      placeholder={'例：\nLogo 位置不可移動\n主體比例不可改變'}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                               bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                               resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">預設影片模型</label>
                      <select
                        value={preferredVideoModel}
                        onChange={(e) => setPreferredVideoModel(e.target.value as 'kling' | 'seedance')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="kling">Kling</option>
                        <option value="seedance">Seedance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">預設輸出比例</label>
                      <select
                        value={preferredOutputAspectRatio}
                        onChange={(e) => setPreferredOutputAspectRatio(e.target.value as '16:9' | '9:16' | '1:1')}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Kling 預設秒數</label>
                      <select
                        value={preferredKlingDuration}
                        onChange={(e) => setPreferredKlingDuration(Number(e.target.value) as 5 | 10)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={5}>5 秒</option>
                        <option value={10}>10 秒</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Seedance 預設秒數</label>
                      <input
                        type="number"
                        min={4}
                        max={12}
                        value={preferredSeedanceDuration}
                        onChange={(e) => setPreferredSeedanceDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                                 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">標籤</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="輸入標籤後按 Enter"
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button onClick={handleAddTag} disabled={!currentTag.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-700
                               text-sm rounded-lg"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 視角圖片上傳 */}
          <div className="surface-soft p-5">
            <label className="block text-sm font-medium mb-3">視角圖片 *</label>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {ANGLE_OPTIONS.map(angle => {
                const existingView = views.find(v => v.angle === angle.value);

                return (
                  <div key={angle.value} className="space-y-2">
                    <div
                      className="relative aspect-square border-2 border-dashed border-slate-300 dark:border-slate-600
                               rounded-lg overflow-hidden group hover:border-blue-400 transition-colors"
                    >
                      {existingView ? (
                        <>
                          <img
                            src={existingView.url}
                            alt={angle.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                                        transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleRemoveView(angle.value)}
                              className="p-2 bg-red-500 hover:bg-red-600 rounded-lg"
                            >
                              <X className="w-5 h-5 text-white" />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-white text-xs">
                            {angle.emoji} {angle.label}
                          </div>
                        </>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                          {isUploading && uploadingAngle === angle.value ? (
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                          ) : (
                            <>
                              <span className="text-3xl mb-2">{angle.emoji}</span>
                              <span className="text-sm font-medium">{angle.label}</span>
                              <span className="text-xs text-slate-500 mt-1">點擊上傳</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(angle.value, file);
                            }}
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>

                    {existingView?.description && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                        {existingView.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isAnalyzing && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4 animate-pulse" />
                AI 正在分析圖片...
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-between gap-3 border-t border-border/70 p-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {requiredFieldsReady ? '可儲存' : '至少需填寫名稱並上傳一張視角圖'}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || views.length === 0 || isUploading || isGeneratingDescription || isGeneratingGuidelines}
            >
              {editingCharacter ? '保存修改' : '建立角色'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
