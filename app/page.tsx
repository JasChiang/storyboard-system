'use client';

import { useState, useEffect } from 'react';
import { Clapperboard, Plus, Sparkles, Film, Image as ImageIcon, Wand2, Users } from "lucide-react";
import { useProjectStore } from '@/stores/project-store';
import { ProjectCard } from '@/components/project/ProjectCard';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils'; // Assuming global util
import Link from 'next/link';

export default function Home() {
  const { projects, loadProjects, createProject, deleteProject } = useProjectStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = (name: string, description?: string) => {
    createProject(name, description);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Decor */}
      <div className="pointer-events-none fixed inset-0 flex justify-center overflow-hidden">
        <div className="h-[500px] w-[500px] bg-[#5F9EA0]/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 mix-blend-multiply dark:mix-blend-color-dodge animate-pulse duration-1000" />
        <div className="h-[500px] w-[500px] bg-[#143A5A]/20 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 mix-blend-multiply dark:mix-blend-color-dodge animate-pulse delay-700 duration-1000" />
      </div>

      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-white/50 backdrop-blur-xl dark:bg-black/50 supports-[backdrop-filter]:bg-white/20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#143A5A] rounded-lg shadow-lg shadow-[#143A5A]/20">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#143A5A] dark:text-[#5F9EA0]">
              Storyboard System
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/characters">
              <Button
                variant="outline"
                size="sm"
                className="shadow-sm hover:shadow-md transition-all"
              >
                <Users className="w-4 h-4 mr-2" />
                角色库
              </Button>
            </Link>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
              className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              新專案
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="relative mb-12 group">
                <div className="absolute inset-0 bg-[#5F9EA0] rounded-3xl blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
                  <Clapperboard className="w-20 h-20 text-slate-900 dark:text-white" />
                </div>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                AI 驅動的分鏡圖製作系統
              </h2>
              <p className="text-xl text-muted-foreground mb-12 max-w-2xl leading-relaxed">
                從文字到影片的一站式工作流。體驗 AI 帶來的極速創作快感。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl mb-16">
                <FeatureCard
                  icon={<Wand2 className="w-6 h-6 text-[#143A5A]" />}
                  title="智慧腳本"
                  description="AI 把故事瞬間轉化為專業分鏡表"
                  delay={0}
                />
                <FeatureCard
                  icon={<ImageIcon className="w-6 h-6 text-[#5F9EA0]" />}
                  title="圖像生成"
                  description="Fal AI 繪製高品質場景圖"
                  delay={100}
                />
                <FeatureCard
                  icon={<Film className="w-6 h-6 text-[#36454A]" />}
                  title="動態影片"
                  description="Kling/Seedance 賦予畫面生命"
                  delay={200}
                />
                <FeatureCard
                  icon={<Sparkles className="w-6 h-6 text-[#CC5500]" />}
                  title="自動剪輯"
                  description="Blender 腳本自動生成與合成"
                  delay={300}
                />
              </div>

              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                size="lg"
                className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300 bg-[#143A5A] hover:bg-[#143A5A]/90 border-0"
              >
                <Plus className="w-5 h-5 mr-2" />
                開始創作
              </Button>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-end justify-between border-b border-border/40 pb-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground">我的專案</h2>
                  <p className="text-muted-foreground mt-2">
                    管理您的分鏡創作 ({projects.length})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={deleteProject}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
  return (
    <div
      className="p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 bg-white dark:bg-slate-800 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}
