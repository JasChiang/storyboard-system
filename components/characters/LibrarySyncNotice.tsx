'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw, ChevronDown, ChevronUp, Loader2, AlertCircle, Sparkles, Info } from 'lucide-react';
import type { LibraryReferenceDiff } from '@/lib/characters/library-sync';
import type { ProjectReference } from '@/lib/types/storyboard';

interface LibrarySyncNoticeProps {
    projectReferences: ProjectReference[];
    onReferencesReplaced: (nextReferences: ProjectReference[]) => void;
}

export function LibrarySyncNotice({ projectReferences, onReferencesReplaced }: LibrarySyncNoticeProps) {
    const [diffs, setDiffs] = useState<LibraryReferenceDiff[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasChecked, setHasChecked] = useState(false);

    const referencesSignature = useMemo(
        () => projectReferences
            .filter((ref) => ref.sourceCharacterLibraryItemId)
            .map((ref) => [
                ref.id,
                ref.sourceCharacterLibraryItemId,
                ref.sourceCharacterLibraryVersion ?? '',
                ref.sourceCharacterSnapshotId ?? '',
                ref.angle ?? '',
                ref.identityCore ?? '',
                (ref.mustKeepFeatures || []).join(','),
            ].join(':'))
            .sort()
            .join('|'),
        [projectReferences]
    );

    const check = useCallback(async (refs: ProjectReference[]) => {
        try {
            const response = await fetch('/api/data/character-library/check-updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ references: refs }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || '檢查更新失敗');
            setDiffs(Array.isArray(payload.diffs) ? payload.diffs : []);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '檢查更新失敗');
        } finally {
            setHasChecked(true);
        }
    }, []);

    useEffect(() => {
        if (!referencesSignature) {
            setDiffs([]);
            setError(null);
            setHasChecked(true);
            return;
        }
        void check(projectReferences);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [referencesSignature, check]);

    const applyDiff = async (diff: LibraryReferenceDiff) => {
        setIsApplying(true);
        setError(null);
        try {
            const primaryRef = projectReferences.find((ref) => diff.affectedReferenceIds.includes(ref.id));
            const response = await fetch('/api/data/character-library/resolve-selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selections: [
                        {
                            id: diff.libraryItemId,
                            angle: primaryRef?.angle || 'front',
                            isAnchor: Boolean(primaryRef?.isAnchor),
                            usageRole: primaryRef?.usageRole || 'supporting',
                        },
                    ],
                    includeAllViews: true,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || '更新失敗');

            const freshRefs: ProjectReference[] = Array.isArray(payload.references) ? payload.references : [];
            const retained = projectReferences.filter(
                (ref) => ref.sourceCharacterLibraryItemId !== diff.libraryItemId
            );
            onReferencesReplaced([...retained, ...freshRefs]);
            setDiffs((prev) => prev.filter((d) => d.libraryItemId !== diff.libraryItemId));
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新失敗');
        } finally {
            setIsApplying(false);
        }
    };

    const applyAll = async () => {
        setIsApplying(true);
        setError(null);
        try {
            const selections = diffs.map((diff) => {
                const primaryRef = projectReferences.find((ref) => diff.affectedReferenceIds.includes(ref.id));
                return {
                    id: diff.libraryItemId,
                    angle: primaryRef?.angle || 'front',
                    isAnchor: Boolean(primaryRef?.isAnchor),
                    usageRole: primaryRef?.usageRole || 'supporting',
                };
            });
            const response = await fetch('/api/data/character-library/resolve-selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selections, includeAllViews: true }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || '更新失敗');

            const freshRefs: ProjectReference[] = Array.isArray(payload.references) ? payload.references : [];
            const outdatedIds = new Set(diffs.map((d) => d.libraryItemId));
            const retained = projectReferences.filter(
                (ref) => !ref.sourceCharacterLibraryItemId || !outdatedIds.has(ref.sourceCharacterLibraryItemId)
            );
            onReferencesReplaced([...retained, ...freshRefs]);
            setDiffs([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : '更新失敗');
        } finally {
            setIsApplying(false);
        }
    };

    if (!hasChecked) return null;
    if (diffs.length === 0) {
        if (!error) return null;
        return (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="flex-1">
                    <p className="font-medium">檢查角色庫更新失敗</p>
                    <p className="mt-0.5 opacity-90">{error}</p>
                </div>
                <button type="button" onClick={() => void check(projectReferences)} className="text-xs underline hover:no-underline">重試</button>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/40 dark:bg-amber-900/15">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                    <Sparkles className="mt-0.5 h-4 w-4" />
                    <div>
                        <p className="font-medium">
                            角色庫有 {diffs.length} 個參考有新版
                        </p>
                        <p className="mt-0.5 text-xs opacity-80">
                            {diffs.map((d) => d.name).join('、')}・是否套用到本專案由你決定。
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white/60 px-2.5 py-1 text-xs text-amber-800 hover:bg-white dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expanded ? '收合' : '查看差異'}
                    </button>
                    <button
                        type="button"
                        onClick={applyAll}
                        disabled={isApplying}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                        全部套用
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-2 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/25 dark:text-red-300">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </div>
            )}

            {expanded && (
                <div className="mt-3 space-y-2">
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-200/70 bg-white/70 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                        <Info className="mt-0.5 h-3 w-3 shrink-0" />
                        <p>
                            套用後會以角色庫最新內容覆蓋本專案的引用（包含 identityCore / mustKeepFeatures 等自訂欄位），並依首個受影響引用的 anchor 設定套用到所有視角。
                        </p>
                    </div>
                    {diffs.map((diff) => (
                        <div
                            key={diff.libraryItemId}
                            className="rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs dark:border-amber-900/40 dark:bg-slate-900/40"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">{diff.name}</span>
                                    <span className="ml-2 text-slate-500 dark:text-slate-400">
                                        ({diff.type})
                                    </span>
                                    {typeof diff.currentVersion === 'number' && (
                                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                                            v{diff.currentVersion} → v{diff.latestVersion}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => applyDiff(diff)}
                                    disabled={isApplying}
                                    className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800"
                                >
                                    只套用此項
                                </button>
                            </div>
                            {diff.changes.length > 0 && (
                                <ul className="mt-1 list-disc pl-4 text-slate-600 dark:text-slate-300">
                                    {diff.changes.map((change, idx) => (
                                        <li key={idx}>{change}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
