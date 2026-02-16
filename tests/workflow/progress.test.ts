import { describe, expect, it } from 'vitest';
import { getWorkflowProgress } from '@/lib/project/workflow';
import type { Project } from '@/lib/types/project';

function buildProject(): Project {
  return {
    id: 'project-1',
    name: 'Progress Test',
    status: 'images',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    storyboard: {
      id: 'storyboard-1',
      projectId: 'project-1',
      title: 'Storyboard',
      originalPrompt: 'test',
      templateUsed: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scenes: [
        {
          id: 'scene-1',
          sceneNumber: 1,
          description: 'Scene 1',
          cameraMovement: 'Static',
          dialogue: '',
          duration: 5,
          generatedImage: {
            url: '',
            prompt: 'empty-url-image',
            timestamp: new Date().toISOString(),
          },
          generatedVideo: {
            url: '',
            model: 'kling',
            prompt: 'empty-url-video',
            timestamp: new Date().toISOString(),
          },
        },
        {
          id: 'scene-2',
          sceneNumber: 2,
          description: 'Scene 2',
          cameraMovement: 'Static',
          dialogue: '',
          duration: 5,
          generatedImage: {
            url: 'https://example.com/image.png',
            prompt: 'valid-image',
            timestamp: new Date().toISOString(),
          },
        },
      ],
    },
  };
}

describe('workflow progress', () => {
  it('counts only scenes with non-empty media URLs', () => {
    const project = buildProject();
    const progress = getWorkflowProgress(project);

    expect(progress.totalScenes).toBe(2);
    expect(progress.scenesWithImages).toBe(1);
    expect(progress.scenesWithVideos).toBe(0);
    expect(progress.hasImages).toBe(false);
    expect(progress.hasVideos).toBe(false);
  });
});
