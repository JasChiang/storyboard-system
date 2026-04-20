'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Loader2 } from 'lucide-react';
import type {
    ProjectReference,
    Scene,
    SceneConsistencyEntityCheck,
    SceneConsistencyReport,
} from '@/lib/types/storyboard';
import { buildConsistencyEntities, summarizeConsistencyReport } from '@/lib/workflow/consistency-validator';

interface ConsistencyPanelProps {
    scene: Scene;
    projectReferences: ProjectReference[];
    frameType?: 'start' | 'end';
    onReportUpdated?: (report: SceneConsistencyReport) => void;
    compact?: boolean;
}

function severityStyle(severity: 'pass' | 'warn' | 'fail'): { bg: string; text: string; Icon: typeof CheckCircle2 } {
    switch (severity) {
        case 'pass':
            return {
                bg: 'bg-emerald-100 dark:bg-emerald-900/25',
                text: 'text-emerald-700 dark:text-emerald-300',
                Icon: CheckCircle2,
            };
        case 'warn':
            return {
                bg: 'bg-amber-100 dark:bg-amber-900/25',
                text: 'text-amber-700 dark:text-amber-300',
                Icon: AlertTriangle,
            };
        case 'fail':
            return {
                bg: 'bg-red-100 dark:bg-red-900/25',
                text: 'text-red-700 dark:text-red-300',
                Icon: XCircle,
            };
    }
}

export function ConsistencyPanel({
    scene,
    projectReferences,
    frameType = 'start',
    onReportUpdated,
    compact = false,
}: ConsistencyPanelProps) {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const frameImageUrl = frameType === 'end'
        ? scene.generatedEndFrame?.url
        : scene.generatedImage?.url;

    const entities = useMemo(
        () => buildConsistencyEntities(scene, projectReferences),
        [scene, projectReferences]
    );

    const report = scene.consistencyReport;
    const canCheck = Boolean(frameImageUrl) && entities.length > 0;

    const handleCheck = async () => {
        if (!frameImageUrl) {
            setError('請先生成場景圖片');
            return;
        }
        if (entities.length === 0) {
            setError('此場景無可比對的角色 / 商品參考圖');
            return;
        }
        setIsChecking(true);
        setError(null);
        try {
            const response = await fetch('/api/openrouter/check-consistency', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sceneId: scene.id,
                    sceneNumber: scene.sceneNumber,
                    frameImageUrl,
                    frameType,
                    entities,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '一致性檢驗失敗');
            if (data.report && onReportUpdated) onReportUpdated(data.report as SceneConsistencyReport);
        } catch (err) {
            setError(err instanceof Error ? err.message : '一致性檢驗失敗');
        } finally {
            setIsChecking(false);
        }
    };

    const renderEntityCheck = (check: SceneConsistencyEntityCheck) => {
        const style = severityStyle(check.severity);
        const Icon = style.Icon;
        return (
            <div key={check.tag} className={`rounded-lg ${style.bg} px-3 py-2 text-xs`}>
                <div className={`flex items-center gap-1.5 font-medium ${style.text}`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span>{check.tag}</span>
                    <span className="opacity-70">· {Math.round(check.score * 100)}%</span>
                    {check.referenceAngle && (
                        <span className="opacity-60">· {check.referenceAngle}</span>
                    )}
                </div>
                {check.differences.length > 0 && (
                    <ul className={`mt-1 list-disc pl-4 ${style.text} opacity-90`}>
                        {check.differences.map((diff, idx) => (
                            <li key={idx}>{diff}</li>
                        ))}
                    </ul>
                )}
                {check.severity !== 'fail' && check.matched.length > 0 && (
                    <p className={`mt-1 ${style.text} opacity-70`}>
                        保持：{check.matched.slice(0, 3).join('、')}
                    </p>
                )}
            </div>
        );
    };

    if (compact && !report) {
        return (
            <button
                type="button"
                onClick={handleCheck}
                disabled={!canCheck || isChecking}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
                {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                檢驗一致性
            </button>
        );
    }

    return (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/30">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-500" />
                    <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        一致性檢驗（{frameType === 'end' ? '尾幀' : '首幀'}）
                    </h4>
                </div>
                <button
                    type="button"
                    onClick={handleCheck}
                    disabled={!canCheck || isChecking}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isChecking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    {report ? '重新檢驗' : '開始檢驗'}
                </button>
            </div>

            {!canCheck && !report && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {!frameImageUrl
                        ? '請先生成場景圖片'
                        : '此場景無可比對的角色 / 商品參考圖（charactersUsed / productsUsed 為空，或對應 ProjectReference 無上傳圖片）'}
                </p>
            )}

            {error && (
                <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/25 dark:text-red-300">
                    {error}
                </p>
            )}

            {report && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className={severityStyle(report.overall).text}>
                            {summarizeConsistencyReport(report)}
                        </span>
                        <span className="text-slate-400">
                            {new Date(report.checkedAt).toLocaleString()} · {report.modelUsed}
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        {report.entityChecks.map(renderEntityCheck)}
                    </div>
                    {report.notes && (
                        <p className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {report.notes}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
