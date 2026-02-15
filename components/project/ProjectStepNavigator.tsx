'use client';

import Link from 'next/link';
import { Clapperboard, Image, Video, FileCode } from 'lucide-react';
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
            const isAvailable = step.available || isActive;

            const content = (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-primary/30 bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_hsl(var(--primary)/0.95)]'
                    : isAvailable
                    ? 'pill-nav'
                    : 'cursor-not-allowed border-border/60 bg-muted/55 text-muted-foreground'
                }`}
              >
                <step.Icon className="h-4 w-4" />
                <span>{index + 1}. {step.title}</span>
              </span>
            );

            return (
              <div key={step.id} className="flex items-center gap-2">
                {isAvailable ? (
                  <Link href={step.href}>{content}</Link>
                ) : (
                  content
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
