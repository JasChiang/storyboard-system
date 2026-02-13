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
    <div className="border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isAvailable = step.available || isActive;

            const content = (
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : isAvailable
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-600'
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
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
