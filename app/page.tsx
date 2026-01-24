'use client';

import { useState, useEffect } from 'react';
import { Clapperboard, Plus } from "lucide-react";
import { useProjectStore } from '@/stores/project-store';
import { ProjectCard } from '@/components/project/ProjectCard';
import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { Button } from '@/components/ui/button';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clapperboard className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold">分鏡圖系統</h1>
            </div>
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

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {projects.length === 0 ? (
            <div className="text-center py-16">
              <div className="max-w-2xl mx-auto">
                <div className="mb-8">
                  <Clapperboard className="w-24 h-24 mx-auto text-slate-300 dark:text-slate-700" />
                </div>
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI 驅動的分鏡圖製作系統
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
                  從文字到影片，一站式分鏡腳本製作工作流
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  <FeatureCard
                    icon="📝"
                    title="分鏡腳本生成"
                    description="使用 AI 將故事轉換為專業的分鏡腳本表格"
                  />
                  <FeatureCard
                    icon="🎨"
                    title="分鏡圖片生成"
                    description="透過 Fal AI 自動生成高品質分鏡圖片"
                  />
                  <FeatureCard
                    icon="🎬"
                    title="影片生成"
                    description="使用 Kling 或 Seedance 將圖片轉為動態影片"
                  />
                  <FeatureCard
                    icon="✂️"
                    title="自動剪輯腳本"
                    description="AI 分析影片並生成 Blender 自動剪輯腳本"
                  />
                </div>

                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  size="lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  開始新專案
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold">我的專案</h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  共 {projects.length} 個專案
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-slate-200 dark:border-slate-700">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
