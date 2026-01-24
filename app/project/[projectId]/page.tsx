'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/project-store';
import { Clapperboard, ArrowLeft, Image, Video, FileCode } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-slate-600 dark:text-slate-400">載入中...</p>
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
    },
    {
      id: 'images',
      icon: Image,
      title: '圖片生成',
      description: '為每個場景生成分鏡圖片',
      href: `/project/${projectId}/images`,
      available: !!currentProject.storyboard,
    },
    {
      id: 'videos',
      icon: Video,
      title: '影片生成',
      description: '將分鏡圖轉換為動態影片',
      href: `/project/${projectId}/videos`,
      available: currentProject.storyboard?.scenes.some(s => s.generatedImage),
    },
    {
      id: 'export',
      icon: FileCode,
      title: 'Blender 腳本',
      description: '生成自動剪輯腳本',
      href: `/project/${projectId}/export`,
      available: currentProject.storyboard?.scenes.some(s => s.generatedVideo),
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{currentProject.name}</h1>
              {currentProject.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  {currentProject.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold mb-6">製作流程</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Link
                  key={step.id}
                  href={step.href}
                  className={`block group ${!step.available && 'pointer-events-none opacity-50'}`}
                >
                  <div className="relative p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-xl transition-all border-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500">
                    <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                        <Icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>

                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {step.description}
                        </p>

                        {!step.available && (
                          <div className="mt-2 inline-block px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded">
                            需完成前序步驟
                          </div>
                        )}
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
