'use client';

import Link from 'next/link';
import { Clapperboard, Image, Video, FileCode, AlertTriangle } from 'lucide-react';
import type { Project } from '@/lib/types/project';
import { getWorkflowProgress } from '@/lib/project/workflow';

type StepId = 'storyboard' | 'images' | 'videos' | 'export';

interface ProjectStepNavigatorProps {
  projectId: string;
  project: Project;
  currentStep: StepId;
}

interface StepItem {
  id: StepId;
  title: string;
  href: string;
  available: boolean;
  Icon: typeof Clapperboard;
}

export function ProjectStepNavigator({
  projectId,
  project,
  currentStep,
}: ProjectStepNavigatorProps) {
  const progress = getWorkflowProgress(project);

  const steps: StepItem[] = [
    {
      id: 'storyboard',
      title: '分鏡',
      href: `/project/${projectId}/storyboard`,
      available: true,
      Icon: Clapperboard,
    },
    {
      id: 'images',
      title: '圖片',
      href: `/project/${projectId}/images`,
      available: progress.hasStoryboard,
      Icon: Image,
    },
    {
      id: 'videos',
      title: '影片',
      href: `/project/${projectId}/videos`,
      available: progress.hasImages,
      Icon: Video,
    },
    {
      id: 'export',
      title: '匯出',
      href: `/project/${projectId}/export`,
      available: progress.hasVideos,
      Icon: FileCode,
    },
  ];

  return (
    <div className="border-b border-border/40 bg-white/55 backdrop-blur-xl dark:bg-slate-950/45">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isAvailable = step.available;

            const content = (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary/30 bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_hsl(var(--primary)/0.95)]'
                    : isAvailable
                    ? 'pill-nav'
                    : 'border-border/60 bg-muted/55 text-muted-foreground opacity-70'
                }`}
              >
                {!isAvailable && !isActive ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                ) : (
                  <step.Icon className="h-4 w-4" />
                )}
                <span>{index + 1}. {step.title}</span>
              </span>
            );

            return (
              <div key={step.id} className="flex items-center gap-2">
                {isAvailable || isActive ? (
                  <Link href={step.href}>{content}</Link>
                ) : (
                  <span aria-disabled="true" title="請先完成前一步驟">
                    {content}
                  </span>
                )}
                {index < steps.length - 1 && (
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
