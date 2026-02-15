'use client';

import { Loader2, Zap, HelpCircle, BookOpen } from 'lucide-react';
import type { HookVariant } from '@/lib/types/storyboard';
import { Button } from '@/components/ui/button';

interface HookVariantPanelProps {
  variants: HookVariant[];
  onApply: (variant: HookVariant) => void;
  isLoading?: boolean;
}

const variantConfig: Record<HookVariant['variantType'], { icon: typeof Zap; label: string; color: string; bg: string }> = {
  shock: {
    icon: Zap,
    label: '震驚型',
    color: 'text-red-600 dark:text-red-400',
    bg: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
  },
  question: {
    icon: HelpCircle,
    label: '懸念型',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  },
  story: {
    icon: BookOpen,
    label: '故事型',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20',
  },
};

export function HookVariantPanel({ variants, onApply, isLoading }: HookVariantPanelProps) {
  if (isLoading) {
    return (
      <div className="surface-soft rounded-xl p-6">
        <p className="text-kicker mb-2">Hook Variants</p>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">正在生成 3 種 Hook 變體...</span>
        </div>
      </div>
    );
  }

  if (variants.length === 0) return null;

  return (
    <div className="surface-soft rounded-xl p-4">
      <div className="mb-4">
        <p className="text-kicker">Hook Variants</p>
        <p className="mt-1 text-sm font-medium text-foreground">Hook 開場變體</p>
        <p className="mt-0.5 text-xs text-muted-foreground">選擇一種替換場景 1 的開場方式</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {variants.map((variant) => {
          const config = variantConfig[variant.variantType] || variantConfig.shock;
          const Icon = config.icon;

          return (
            <div
              key={variant.variantType}
              className={`rounded-xl border p-4 ${config.bg}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span className={`text-sm font-semibold ${config.color}`}>
                  {variant.variantLabel || config.label}
                </span>
              </div>

              {variant.scene.description && (
                <p className="mb-2 line-clamp-3 text-xs leading-5 text-foreground">
                  {variant.scene.description}
                </p>
              )}

              {variant.scene.cameraMovement && (
                <p className="mb-1 text-xs text-muted-foreground">
                  鏡頭：{variant.scene.cameraMovement}
                </p>
              )}

              {variant.scene.dialogue && (
                <p className="mb-3 line-clamp-2 text-xs italic text-muted-foreground">
                  「{variant.scene.dialogue}」
                </p>
              )}

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => onApply(variant)}
              >
                套用此開場
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
