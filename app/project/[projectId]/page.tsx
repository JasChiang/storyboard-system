'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { Clapperboard, ArrowLeft, ArrowRight, Image, Video, FileCode } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getWorkflowProgress } from '@/lib/project/workflow';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { currentProject, setCurrentProject } = useProjectStore();

  useEffect(() => {
    setCurrentProject(projectId);
  }, [projectId, setCurrentProject]);

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg text-muted-foreground font-medium">載入中...</p>
        </div>
      </div>
    );
  }

  const progress = getWorkflowProgress(currentProject);

  const steps = [
    {
      id: 'storyboard',
      icon: Clapperboard,
      title: '分鏡腳本',
      description: '生成和編輯分鏡腳本',
      href: `/project/${projectId}/storyboard`,
      available: true,
      completed: progress.hasStoryboard,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'images',
      icon: Image,
      title: '圖片生成',
      description: `為每個場景生成分鏡圖片 (${progress.scenesWithImages}/${progress.totalScenes})`,
      href: `/project/${projectId}/images`,
      available: progress.hasStoryboard,
      completed: progress.hasImages,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'videos',
      icon: Video,
      title: '影片生成',
      description: `將分鏡圖轉換為動態影片 (${progress.scenesWithVideos}/${progress.totalScenes})`,
      href: `/project/${projectId}/videos`,
      available: progress.hasImages,
      completed: progress.hasVideos,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      id: 'export',
      icon: FileCode,
      title: '剪輯與匯出',
      description: 'AI 建議 + OpenReel / FFmpeg / Blender',
      href: `/project/${projectId}/export`,
      available: progress.hasVideos,
      completed: currentProject.status === 'complete' || Boolean(currentProject.editingSuggestions),
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ];
  const nextStep = steps.find((step) => step.available && !step.completed) || steps[steps.length - 1];

  return (
    <>
      <header className="app-header">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
            </Link>
            <div className="h-6 w-px bg-border/60" />
            <div>
              <p className="text-kicker">Project</p>
              <h1 className="text-xl font-semibold tracking-tight">{currentProject.name}</h1>
              {currentProject.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {currentProject.description}
                </p>
              )}
            </div>

            <div className="ml-auto">
              <Badge variant="secondary" className="font-normal">
                {currentProject.status === 'draft' ? '草稿' : '進行中'}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="surface-hero mb-8 text-center">
            <p className="text-kicker">Production Workflow</p>
            <h2 className="mb-4 mt-3 text-3xl font-semibold tracking-tight">製作流程</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              按照以下步驟，完成從分鏡腳本到影片生成的完整創作流程。
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Badge variant="outline">已完成 {steps.filter((step) => step.completed).length}/4 步驟</Badge>
              <Link href={nextStep.href}>
                <Button size="sm">
                  接續流程：{nextStep.title}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "surface-panel block group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/25",
                    !step.available && "pointer-events-none opacity-60 grayscale"
                  )}
                >
                  <div className="relative h-full">
                    <div className="surface-inset absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground transition-colors group-hover:text-primary">
                      {index + 1}
                    </div>

                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "surface-inset flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                        step.bg,
                        step.color
                      )}>
                        <Icon className="h-6 w-6" />
                      </div>

                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                            {step.title}
                          </h3>
                          {step.completed && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300">
                              已完成
                            </Badge>
                          )}
                          {!step.completed && step.available && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300">
                              進行中
                            </Badge>
                          )}
                          {!step.available && !step.completed && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900">
                              待解鎖
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
