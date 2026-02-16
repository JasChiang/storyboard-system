'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Clapperboard, Plus, Sparkles, Film, Image as ImageIcon, Wand2, Users, ArrowRight } from "lucide-react";
import { useProjectStore } from '@/stores/project-store';
import { ProjectCard } from '@/components/project/ProjectCard';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  const { projects, loadProjects, createProject, deleteProject } = useProjectStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = (name: string, description?: string, targetDurationSec?: number) => {
    createProject(name, description, targetDurationSec);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="app-header w-full">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="surface-soft flex h-10 w-10 items-center justify-center rounded-xl">
              <Clapperboard className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              Storyboard System
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/characters">
              <Button variant="outline" size="sm">
                <Users className="w-4 h-4 mr-2" />
                角色庫
              </Button>
            </Link>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              新專案
            </Button>
          </div>
        </div>
      </header>

      <main className="container relative z-10 mx-auto px-4 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto">
          {projects.length === 0 ? (
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center">
              <section className="surface-hero w-full max-w-4xl">
                <p className="text-kicker">Creative Engine</p>
                <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  把一段想法，直接轉成可剪輯的分鏡工作流
                </h2>
                <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                  極簡介面、清楚節點、連續生成。從腳本、圖像到影片輸出，保持一條流暢創作路徑。
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
                    <Plus className="w-5 h-5 mr-1.5" />
                    開始創作
                  </Button>
                  <Link href="/characters">
                    <Button variant="outline" size="lg">
                      探索角色庫
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </section>
              <div className="grid w-full max-w-5xl grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <FeatureCard
                  icon={<Wand2 className="w-6 h-6 text-primary" />}
                  title="智慧腳本"
                  description="AI 把故事瞬間轉化為專業分鏡表"
                  delay={0}
                />
                <FeatureCard
                  icon={<ImageIcon className="w-6 h-6 text-sky-600 dark:text-sky-300" />}
                  title="圖像生成"
                  description="Fal AI 繪製高品質場景圖"
                  delay={100}
                />
                <FeatureCard
                  icon={<Film className="w-6 h-6 text-slate-700 dark:text-slate-300" />}
                  title="動態影片"
                  description="Kling/Seedance 賦予畫面生命"
                  delay={200}
                />
                <FeatureCard
                  icon={<Sparkles className="w-6 h-6 text-cyan-600 dark:text-cyan-300" />}
                  title="自動剪輯"
                  description="Blender 腳本自動生成與合成"
                  delay={300}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <section className="surface-panel px-6 py-7 sm:px-8">
                <div>
                  <p className="text-kicker">Workspace</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">我的專案</h2>
                  <p className="mt-2 text-muted-foreground">
                    管理你的分鏡製作流程，共 {projects.length} 個專案。
                  </p>
                </div>
              </section>

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

function FeatureCard({ icon, title, description, delay }: { icon: ReactNode; title: string; description: string; delay: number }) {
  return (
    <div
      className="surface-panel group p-5 text-left transition-all duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="surface-inset mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
