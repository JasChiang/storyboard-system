'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { Clapperboard, ArrowLeft, Image, Video, FileCode } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function ProjectPage() {
  const router = useRouter();
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

  const steps = [
    {
      id: 'storyboard',
      icon: Clapperboard,
      title: '分鏡腳本',
      description: '生成和編輯分鏡腳本',
      href: `/project/${projectId}/storyboard`,
      available: true,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'images',
      icon: Image,
      title: '圖片生成',
      description: '為每個場景生成分鏡圖片',
      href: `/project/${projectId}/images`,
      available: !!currentProject.storyboard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      id: 'videos',
      icon: Video,
      title: '影片生成',
      description: '將分鏡圖轉換為動態影片',
      href: `/project/${projectId}/videos`,
      available: currentProject.storyboard?.scenes.some(s => s.generatedImage),
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      id: 'export',
      icon: FileCode,
      title: 'Blender 腳本',
      description: '生成自動剪輯腳本',
      href: `/project/${projectId}/export`,
      available: currentProject.storyboard?.scenes.some(s => s.generatedVideo),
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 flex justify-center overflow-hidden -z-10">
        <div className="h-[400px] w-[400px] bg-primary/20 rounded-full blur-[128px] translate-y-[-50%] translate-x-[50%] opacity-50" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
            </Link>
            <div className="h-6 w-px bg-border/60" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">{currentProject.name}</h1>
              {currentProject.description && (
                <p className="text-sm text-muted-foreground">
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
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">製作流程</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              按照以下步驟，完成從分鏡腳本到影片生成的完整創作流程。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={cn(
                    "block group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 p-1 transition-all hover:bg-muted/50 hover:shadow-lg hover:border-primary/20",
                    !step.available && "pointer-events-none opacity-60 grayscale"
                  )}
                >
                  <div className="relative h-full rounded-xl bg-background/50 p-6 transition-colors group-hover:bg-background/80">
                    <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      {index + 1}
                    </div>

                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
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
                          {!step.available && (
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
    </div>
  );
}
