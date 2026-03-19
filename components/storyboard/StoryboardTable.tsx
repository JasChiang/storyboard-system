'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Scene, TransitionType, type TransitionToNext } from '@/lib/types/storyboard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clapperboard,
  Clock3,
  Copy,
  Film,
  GripVertical,
  Link2,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Rows3,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  X,
  PanelTop,
} from 'lucide-react';

interface StoryboardTableProps {
  scenes: Scene[];
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
  onRegenerateScene?: (sceneId: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
  onInsertSceneAfter?: (sceneId: string) => void;
  onAppendScene?: () => void;
  onResetScene?: (sceneId: string) => void;
  onReorderScenes?: (orderedIds: string[]) => void;
  isRegeneratingSceneId?: string | null;
}

const TAG_PATTERN = /^<[^<>]+>$/;

const TRANSITION_LABELS: Record<TransitionType, { label: string; color: string; icon: string }> = {
  cut: { label: '硬切', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: '✂️' },
  dissolve: { label: '溶解', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '🔀' },
  fade_black: { label: '黑場', color: 'bg-gray-800 text-white dark:bg-gray-900 dark:text-gray-100', icon: '⬛' },
  fade_white: { label: '白場', color: 'bg-gray-100 text-gray-700 dark:bg-gray-200 dark:text-gray-800', icon: '⬜' },
  continuation: { label: '延續', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: '🔗' },
  match_cut: { label: '匹配', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: '🎯' },
  wipe: { label: '擦除', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: '➡️' },
  push: { label: '推出', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: '📤' },
};

const QA_CONFIG = {
  block: { label: '阻擋', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' },
  warn: { label: '警告', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300' },
  pass: { label: '通過', className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300' },
};

function summarize(text?: string, max = 110): string {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '—';
  return normalized.length > max ? `${normalized.slice(0, max).trim()}…` : normalized;
}

function shotTypeFromDescription(description: string): string | null {
  const lower = description.toLowerCase();
  if (/extreme\s*close[-\s]?up|極端特寫|超特寫/i.test(lower)) return 'ECU';
  if (/close[-\s]?up|特寫|近景/i.test(lower)) return 'CU';
  if (/medium\s*shot|中景|半身/i.test(lower)) return 'MS';
  if (/wide\s*shot|全景|大全景/i.test(lower)) return 'WS';
  if (/extreme\s*wide|超遠景|全場景/i.test(lower)) return 'EWS';
  return null;
}

function parseTagList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const normalized = value.replace(/^<|>$/g, '').trim();
      return normalized ? `<${normalized}>` : '';
    })
    .filter(Boolean);
}

function stringifyTagList(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.join(', ');
}

function validateSceneDraft(scene: Scene): string[] {
  const errors: string[] = [];
  const requiredTextFields: Array<[keyof Scene, label: string]> = [
    ['description', 'description'],
    ['cameraMovement', 'cameraMovement'],
    ['sceneIntent', 'sceneIntent'],
    ['startComposition', 'startComposition'],
    ['subjectMotion', 'subjectMotion'],
    ['continuityLock', 'continuityLock'],
    ['shotIntent', 'shotIntent'],
    ['continuityAnchor', 'continuityAnchor'],
  ];

  requiredTextFields.forEach(([key, label]) => {
    const value = scene[key];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${label} 不能為空`);
    }
  });

  if (!Number.isFinite(scene.duration) || scene.duration <= 0) {
    errors.push('duration 必須大於 0');
  }

  const validateTagArray = (label: string, values?: string[]) => {
    const invalid = (values || []).filter((tag) => !TAG_PATTERN.test((tag || '').trim()));
    if (invalid.length > 0) {
      errors.push(`${label} 標記格式錯誤：${invalid.join(', ')}`);
    }
  };

  validateTagArray('charactersUsed', scene.charactersUsed);
  validateTagArray('productsUsed', scene.productsUsed);
  validateTagArray('requiredReferences', scene.requiredReferences);

  if (scene.requiresEndFrame && !scene.endFrameDelta?.trim()) {
    errors.push('requiresEndFrame 開啟時，endFrameDelta 不能為空');
  }

  return errors;
}

function InfoBlock({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white/75 p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.35)] dark:bg-slate-950/45">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MetaLine({ label, value, tone = 'default' }: { label: string; value?: string; tone?: 'default' | 'accent' | 'warning' }) {
  if (!value?.trim()) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className={
        tone === 'accent'
          ? 'text-sm leading-relaxed text-violet-700 dark:text-violet-300'
          : tone === 'warning'
            ? 'text-sm leading-relaxed text-amber-700 dark:text-amber-300'
            : 'text-sm leading-relaxed text-slate-600 dark:text-slate-300'
      }>{value}</p>
    </div>
  );
}

function SceneDetailEditor({
  scene,
  onUpdate,
  onDelete,
  onRegenerate,
  onDuplicate,
  onInsertAfter,
  onResetScene,
  isRegenerating = false,
}: {
  scene: Scene;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onDuplicate?: () => void;
  onInsertAfter?: () => void;
  onResetScene?: () => void;
  isRegenerating?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'narrative' | 'continuity' | 'generation' | 'dialogue' | 'ending' | 'qa'>('narrative');
  const [editedScene, setEditedScene] = useState(scene);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedScene(scene);
    setValidationErrors([]);
    setShowMore(false);
    setIsEditing(false);
    setActiveTab('narrative');
  }, [scene]);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  const handleTransitionChange = (type: TransitionType) => {
    const nextTransition: TransitionToNext = {
      ...editedScene.transitionToNext,
      type,
      useEndFrameAsNextStart: type === 'continuation',
      continuitySourceMode: type === 'continuation'
        ? (editedScene.transitionToNext?.continuitySourceMode || 'auto')
        : 'none',
    };
    setEditedScene({ ...editedScene, transitionToNext: nextTransition });
  };

  const handleSave = () => {
    const errors = validateSceneDraft(editedScene);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    onUpdate(editedScene);
    setValidationErrors([]);
    setIsEditing(false);
  };

  const handleCopyPrompt = () => {
    const text = [scene.description, scene.cameraMovement, scene.dialogue].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    setShowMore(false);
  };

  const qaConfig = QA_CONFIG[scene.qaStatus || 'pass'];
  const transitionInfo = TRANSITION_LABELS[scene.transitionToNext?.type || 'dissolve'];

  if (!isEditing) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">#{scene.sceneNumber}</span>
              {shotTypeFromDescription(scene.description) && <Badge variant="outline">{shotTypeFromDescription(scene.description)}</Badge>}
              {scene.renderLane && <Badge variant="outline">{scene.renderLane}</Badge>}
              <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${qaConfig.className}`}>QA {qaConfig.label}</span>
              {scene.requiresEndFrame && <Badge className="bg-violet-500/12 text-violet-700 dark:text-violet-300">end frame</Badge>}
            </div>
            <p className="mt-4 text-base font-medium leading-7 text-slate-900 dark:text-slate-100">{scene.description || '—'}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />編輯
            </Button>
            {onRegenerate && (
              <Button type="button" variant="outline" size="sm" onClick={onRegenerate} disabled={isRegenerating}>
                {isRegenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                重生此場景
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onDelete}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />刪除
            </Button>
            <div className="relative" ref={moreRef}>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowMore((prev) => !prev)}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {showMore && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[170px] overflow-hidden rounded-xl border border-border/60 bg-white shadow-lg dark:bg-slate-800">
                  {onDuplicate && <button onClick={() => { onDuplicate(); setShowMore(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"><Copy className="h-3.5 w-3.5" />複製場景</button>}
                  {onInsertAfter && <button onClick={() => { onInsertAfter(); setShowMore(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"><Plus className="h-3.5 w-3.5" />下方插入場景</button>}
                  <button onClick={handleCopyPrompt} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"><Copy className="h-3.5 w-3.5" />複製提示詞</button>
                  {onResetScene && <button onClick={() => { onResetScene(); setShowMore(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"><RotateCcw className="h-3.5 w-3.5" />重置生成</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
          {[
            ['narrative', '敘事'],
            ['continuity', '連戲'],
            ['generation', '生成'],
            ['dialogue', '對白'],
            ['ending', '尾幀'],
            ['qa', 'QA / 參考'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${activeTab === key ? 'bg-primary text-primary-foreground' : 'border border-border/70 bg-white/70 text-slate-600 hover:bg-slate-50 dark:bg-slate-900/60 dark:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {activeTab === 'narrative' && (
            <InfoBlock icon={Clapperboard} label="敘事">
              <MetaLine label="鏡頭意圖" value={scene.sceneIntent} />
              <MetaLine label="拍攝目標" value={scene.shotIntent} />
              <MetaLine label="段落任務" value={scene.beatGoal} />
            </InfoBlock>
          )}

          {activeTab === 'continuity' && (
            <InfoBlock icon={Link2} label="連戲">
              <MetaLine label="首幀構圖" value={scene.startComposition} />
              <MetaLine label="主體動作" value={scene.subjectMotion} />
              <MetaLine label="連戲鎖定" value={scene.continuityLock} />
              <MetaLine label="連戲錨點" value={scene.continuityAnchor} />
              <MetaLine label="相較前鏡變化" value={scene.changeFromPrev} />
            </InfoBlock>
          )}

          {activeTab === 'generation' && (
            <InfoBlock icon={Wand2} label="生成">
              <MetaLine label="鏡頭運動" value={scene.cameraMovement} />
              <MetaLine label="視角意圖" value={scene.viewIntent} />
              <MetaLine label="主體視角提示" value={scene.referenceViewHints ? Object.entries(scene.referenceViewHints).map(([key, value]) => `${key}:${value}`).join('、') : ''} />
              <MetaLine label="參考優先序" value={scene.referencePriorityMode} />
              <MetaLine label="製作風險" value={scene.productionRisk} />
              <MetaLine label="交付用途" value={scene.deliveryIntent} />
              <MetaLine label="保留給後期" value={scene.reservedForPost} tone="accent" />
            </InfoBlock>
          )}

          {activeTab === 'dialogue' && (
            <InfoBlock icon={MessageSquareText} label="對白 / 音訊">
              <MetaLine label="對白" value={scene.dialogue} />
            </InfoBlock>
          )}

          {activeTab === 'ending' && (
            <InfoBlock icon={Film} label="尾幀 / 轉場">
              <MetaLine label="時長" value={`${scene.duration} 秒`} />
              {scene.requiresEndFrame ? (
                <>
                  <MetaLine label="尾幀描述" value={scene.endFrameDescription} />
                  <MetaLine label="尾幀變化" value={scene.endFrameDelta} tone="accent" />
                </>
              ) : (
                <MetaLine label="尾幀" value="未啟用" />
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${transitionInfo.color}`}>{transitionInfo.icon} {transitionInfo.label}</span>
                {scene.transitionToNext?.reason && <span className="text-sm text-slate-600 dark:text-slate-300">{scene.transitionToNext.reason}</span>}
              </div>
            </InfoBlock>
          )}

          {activeTab === 'qa' && (
            <InfoBlock icon={ShieldCheck} label="QA / 參考">
              {scene.qaIssues?.length ? scene.qaIssues.map((issue, index) => (
                <div key={`${issue}-${index}`} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{issue}</span>
                </div>
              )) : (
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />無額外 QA 問題</div>
              )}
              <div className="flex flex-wrap gap-1.5 pt-2">
                {(scene.charactersUsed || []).map((tag) => <Badge key={`c-${tag}`} variant="outline">{tag}</Badge>)}
                {(scene.productsUsed || []).map((tag) => <Badge key={`p-${tag}`} className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">{tag}</Badge>)}
                {(scene.requiredReferences || []).map((tag) => <Badge key={`r-${tag}`} className="bg-violet-500/12 text-violet-700 dark:text-violet-300">必用 {tag}</Badge>)}
              </div>
            </InfoBlock>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-kicker">Editing Scene #{scene.sceneNumber}</p>
          <h4 className="mt-2 text-lg font-semibold tracking-tight">完整編輯模式</h4>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { setEditedScene(scene); setValidationErrors([]); setIsEditing(false); }}>
            <X className="mr-1.5 h-3.5 w-3.5" />取消
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            <Check className="mr-1.5 h-3.5 w-3.5" />儲存
          </Button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {validationErrors.map((error, index) => <p key={`${error}-${index}`}>- {error}</p>)}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <InfoBlock icon={Clapperboard} label="Narrative">
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.description} onChange={(e) => setEditedScene({ ...editedScene, description: e.target.value })} rows={4} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.sceneIntent || ''} onChange={(e) => setEditedScene({ ...editedScene, sceneIntent: e.target.value })} placeholder="sceneIntent" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.shotIntent || ''} onChange={(e) => setEditedScene({ ...editedScene, shotIntent: e.target.value })} placeholder="shotIntent" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.beatGoal || ''} onChange={(e) => setEditedScene({ ...editedScene, beatGoal: e.target.value })} placeholder="beatGoal" rows={2} />
        </InfoBlock>

        <InfoBlock icon={Link2} label="Continuity">
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.startComposition || ''} onChange={(e) => setEditedScene({ ...editedScene, startComposition: e.target.value })} placeholder="startComposition" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.subjectMotion || ''} onChange={(e) => setEditedScene({ ...editedScene, subjectMotion: e.target.value })} placeholder="subjectMotion" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.continuityLock || ''} onChange={(e) => setEditedScene({ ...editedScene, continuityLock: e.target.value })} placeholder="continuityLock" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.continuityAnchor || ''} onChange={(e) => setEditedScene({ ...editedScene, continuityAnchor: e.target.value })} placeholder="continuityAnchor" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.changeFromPrev || ''} onChange={(e) => setEditedScene({ ...editedScene, changeFromPrev: e.target.value })} placeholder="changeFromPrev" rows={2} />
        </InfoBlock>

        <InfoBlock icon={Wand2} label="Generation">
          <input className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.cameraMovement} onChange={(e) => setEditedScene({ ...editedScene, cameraMovement: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.renderLane || 'hero'} onChange={(e) => setEditedScene({ ...editedScene, renderLane: e.target.value as Scene['renderLane'] })}>
              <option value="hero">路線：hero</option><option value="performance">performance</option><option value="continuity">continuity</option><option value="plate">plate</option><option value="insert">insert</option><option value="utility">utility</option>
            </select>
            <select className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.viewIntent || 'auto'} onChange={(e) => setEditedScene({ ...editedScene, viewIntent: e.target.value as Scene['viewIntent'] })}>
              <option value="auto">視角：自動</option><option value="front">正面</option><option value="three_quarter">3/4 側</option><option value="side">側面</option><option value="back">背面</option><option value="top">頂視</option>
            </select>
            <select className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.productionRisk || 'medium'} onChange={(e) => setEditedScene({ ...editedScene, productionRisk: e.target.value as Scene['productionRisk'] })}>
              <option value="low">risk：low</option><option value="medium">risk：medium</option><option value="high">risk：high</option>
            </select>
          </div>
          <select className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.referencePriorityMode || 'stage_balanced'} onChange={(e) => setEditedScene({ ...editedScene, referencePriorityMode: e.target.value as Scene['referencePriorityMode'] })}>
            <option value="stage_balanced">參考優先：stage_balanced</option>
            <option value="identity_first">identity_first</option>
            <option value="continuity_first">continuity_first</option>
            <option value="style_first">style_first</option>
          </select>
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.referenceViewHints ? Object.entries(editedScene.referenceViewHints).map(([k,v]) => `${k}:${v}`).join('\n') : ''} onChange={(e) => {
            const entries = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [key, ...rest] = line.split(':');
                const value = (rest.join(':').trim() || 'auto') as NonNullable<Scene['viewIntent']>;
                return [key.trim(), value] as const;
              });
            setEditedScene({ ...editedScene, referenceViewHints: Object.fromEntries(entries) });
          }} placeholder="<台灣男性>:front\n<Galaxy S26>:back" rows={3} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.deliveryIntent || ''} onChange={(e) => setEditedScene({ ...editedScene, deliveryIntent: e.target.value })} placeholder="deliveryIntent" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.reservedForPost || ''} onChange={(e) => setEditedScene({ ...editedScene, reservedForPost: e.target.value })} placeholder="reservedForPost" rows={2} />
        </InfoBlock>

        <InfoBlock icon={MessageSquareText} label="Dialogue / References">
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.dialogue} onChange={(e) => setEditedScene({ ...editedScene, dialogue: e.target.value })} rows={3} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={stringifyTagList(editedScene.charactersUsed)} onChange={(e) => setEditedScene({ ...editedScene, charactersUsed: parseTagList(e.target.value) })} placeholder="charactersUsed：<Alice>, <Bob>" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={stringifyTagList(editedScene.productsUsed)} onChange={(e) => setEditedScene({ ...editedScene, productsUsed: parseTagList(e.target.value) })} placeholder="productsUsed：<ProductX>" rows={2} />
          <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={stringifyTagList(editedScene.requiredReferences)} onChange={(e) => setEditedScene({ ...editedScene, requiredReferences: parseTagList(e.target.value) })} placeholder="requiredReferences：<Alice>, <ProductX>" rows={2} />
        </InfoBlock>

        <InfoBlock icon={Film} label="End Frame / Transition">
          <div className="grid gap-3 sm:grid-cols-2">
            <input type="number" className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.duration} onChange={(e) => { const parsed = Number.parseFloat(e.target.value); setEditedScene({ ...editedScene, duration: Number.isFinite(parsed) ? parsed : 0 }); }} step="0.1" />
            <select className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.transitionToNext?.type || 'dissolve'} onChange={(e) => handleTransitionChange(e.target.value as TransitionType)}>
              {Object.entries(TRANSITION_LABELS).map(([type, { label, icon }]) => <option key={type} value={type}>{icon} {label}</option>)}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={editedScene.requiresEndFrame || false} onChange={(e) => setEditedScene({ ...editedScene, requiresEndFrame: e.target.checked })} /> 需要尾幀</label>
          {editedScene.requiresEndFrame && (
            <>
              <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.endFrameDescription || ''} onChange={(e) => setEditedScene({ ...editedScene, endFrameDescription: e.target.value })} placeholder="endFrameDescription" rows={2} />
              <textarea className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm dark:bg-slate-900/70" value={editedScene.endFrameDelta || ''} onChange={(e) => setEditedScene({ ...editedScene, endFrameDelta: e.target.value })} placeholder="endFrameDelta" rows={2} />
            </>
          )}
        </InfoBlock>

        <InfoBlock icon={ShieldCheck} label="QA">
          {scene.qaIssues?.length ? scene.qaIssues.map((issue, index) => <div key={`${issue}-${index}`} className="flex items-start gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><span>{issue}</span></div>) : <div className="text-sm text-emerald-700 dark:text-emerald-300">無額外 QA 問題</div>}
        </InfoBlock>
      </div>
    </div>
  );
}

export function StoryboardTable({
  scenes,
  onUpdateScene,
  onDeleteScene,
  onRegenerateScene,
  onDuplicateScene,
  onInsertSceneAfter,
  onAppendScene,
  onResetScene,
  onReorderScenes,
  isRegeneratingSceneId,
}: StoryboardTableProps) {
  const dragSceneId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(scenes[0]?.id || null);

  useEffect(() => {
    if (!scenes.length) {
      setSelectedSceneId(null);
      return;
    }
    if (!selectedSceneId || !scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) || scenes[0] || null,
    [scenes, selectedSceneId]
  );

  const handleDragStart = (e: React.DragEvent, sceneId: string) => {
    dragSceneId.current = sceneId;
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(sceneId);
  };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const fromId = dragSceneId.current;
    if (!fromId || fromId === targetId || !onReorderScenes) return;
    const ids = scenes.map((s) => s.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, fromId);
    onReorderScenes(reordered);
  };
  const handleDragEnd = () => {
    dragSceneId.current = null;
    setDragOverId(null);
  };

  const qaBlocked = scenes.filter((scene) => scene.qaStatus === 'block').length;
  const qaWarn = scenes.filter((scene) => scene.qaStatus === 'warn').length;
  const endFrameCount = scenes.filter((scene) => scene.requiresEndFrame).length;

  if (scenes.length === 0) {
    return <div className="surface-panel p-12 text-center text-slate-500 dark:text-slate-400"><p className="text-lg font-semibold text-slate-700 dark:text-slate-200">尚未生成分鏡腳本</p><p className="mt-2 text-sm">請在上方輸入故事需求並生成</p></div>;
  }

  return (
    <div className="space-y-5">
      <div className="surface-panel overflow-hidden">
        <div className="border-b border-border/70 bg-gradient-to-r from-white/85 via-slate-50/80 to-white/75 px-6 py-5 dark:from-slate-900/60 dark:to-slate-800/40">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-kicker">Scene List</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Storyboard Scene Breakdown</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">上方先快速掃描節奏與風險，點一個 scene 後在下方看完整 production detail。{onReorderScenes ? '支援拖拉排序。' : ''}</p>
            </div>
            <div className="flex flex-col items-start gap-3 xl:items-end">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1.5"><Rows3 className="h-3.5 w-3.5" />{scenes.length} Scenes</Badge>
                <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />{endFrameCount} End-frame scenes</Badge>
                {(qaBlocked > 0 || qaWarn > 0) && <Badge className="gap-1.5 bg-amber-500/12 text-amber-700 dark:text-amber-300"><ShieldAlert className="h-3.5 w-3.5" />{qaBlocked + qaWarn} Need review</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {onReorderScenes && <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"><GripVertical className="h-3.5 w-3.5" />Drag to reorder</div>}
                {onAppendScene && <Button type="button" variant="outline" size="sm" onClick={onAppendScene}><Plus className="mr-1.5 h-3.5 w-3.5" />新增場景</Button>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {scenes.map((scene) => {
            const isSelected = scene.id === selectedScene?.id;
            const isDanger = scene.qaStatus === 'block';
            const isWarn = scene.qaStatus === 'warn';
            const shotType = shotTypeFromDescription(scene.description);
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => setSelectedSceneId(scene.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? 'border-primary/35 bg-primary/5 shadow-[0_16px_32px_-26px_rgba(37,99,235,0.35)]' : 'border-border/70 bg-white/80 hover:border-primary/20 hover:bg-slate-50/80 dark:bg-slate-950/40'} ${dragOverId === scene.id ? 'outline outline-2 outline-blue-400' : ''}`}
                draggable={!!onReorderScenes}
                onDragStart={onReorderScenes ? (e) => handleDragStart(e, scene.id) : undefined}
                onDragOver={onReorderScenes ? (e) => handleDragOver(e, scene.id) : undefined}
                onDrop={onReorderScenes ? (e) => handleDrop(e, scene.id) : undefined}
                onDragEnd={onReorderScenes ? handleDragEnd : undefined}
              >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">#{scene.sceneNumber}</span>
                      {shotType && <Badge variant="outline" className="h-5 px-1.5 py-0 font-mono text-[10px]">{shotType}</Badge>}
                      {scene.renderLane && <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">{scene.renderLane}</Badge>}
                      {scene.requiresEndFrame && <Badge className="bg-violet-500/12 text-violet-700 dark:text-violet-300">end frame</Badge>}
                      {scene.deliveryIntent && <Badge className="bg-cyan-500/12 text-cyan-700 dark:text-cyan-300">{scene.deliveryIntent}</Badge>}
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-900 dark:text-slate-100">{summarize(scene.description, 180)}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(scene.charactersUsed || []).slice(0, 3).map((tag) => <Badge key={`c-${scene.id}-${tag}`} variant="outline">{tag}</Badge>)}
                      {(scene.productsUsed || []).slice(0, 3).map((tag) => <Badge key={`p-${scene.id}-${tag}`} className="bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">{tag}</Badge>)}
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-4">
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Camera</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{summarize(scene.cameraMovement, 56)}</p></div>
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Dialogue</p><p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{summarize(scene.dialogue, 72)}</p></div>
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Duration</p><p className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"><Clock3 className="h-3.5 w-3.5" />{scene.duration} 秒</p></div>
                      <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">QA</p><p className={`mt-1 text-sm font-medium ${isDanger ? 'text-red-600 dark:text-red-300' : isWarn ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{scene.qaStatus || 'pass'}</p></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm text-slate-500 dark:text-slate-400"><span>{scene.transitionToNext?.type || 'dissolve'}</span><ChevronRight className={`h-4 w-4 transition ${isSelected ? 'text-primary' : ''}`} /></div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedScene && (
        <div className="surface-panel overflow-hidden border-primary/10 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
          <div className="border-b border-border/70 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-kicker">Scene Detail</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">目前編輯：Scene #{selectedScene.sceneNumber}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">完整 narrative / continuity / generation / transition / actions 都保留在這裡。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedScene.renderLane && <Badge variant="outline"><Clapperboard className="mr-1.5 h-3.5 w-3.5" />{selectedScene.renderLane}</Badge>}
                {selectedScene.requiresEndFrame && <Badge className="bg-violet-500/12 text-violet-700 dark:text-violet-300">end frame enabled</Badge>}
              </div>
            </div>
          </div>
          <SceneDetailEditor
            scene={selectedScene}
            onUpdate={(updates) => onUpdateScene(selectedScene.id, updates)}
            onDelete={() => onDeleteScene(selectedScene.id)}
            onRegenerate={onRegenerateScene ? () => onRegenerateScene(selectedScene.id) : undefined}
            onDuplicate={onDuplicateScene ? () => onDuplicateScene(selectedScene.id) : undefined}
            onInsertAfter={onInsertSceneAfter ? () => onInsertSceneAfter(selectedScene.id) : undefined}
            onResetScene={onResetScene ? () => onResetScene(selectedScene.id) : undefined}
            isRegenerating={isRegeneratingSceneId === selectedScene.id}
          />
        </div>
      )}
    </div>
  );
}
