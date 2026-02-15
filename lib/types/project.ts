import { Storyboard } from './storyboard';

export type ProjectStatus = 'draft' | 'storyboard' | 'images' | 'videos' | 'complete';

export interface Project {
  id: string;
  name: string;
  description?: string;
  storyboard?: Storyboard;
  blenderScript?: string;
  editingSuggestions?: EditingSuggestion;
  openreelProjectJson?: string;
  status: ProjectStatus;
  videoType?: string;
  targetDurationSec?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EditingSuggestion {
  summary: string;
  scenes: SceneEditSuggestion[];
  timeline: TimelineMarker[];
  audioNotes: string;
  transitionDuration?: number;
}

export interface SceneEditSuggestion {
  sceneId: string;
  visualConfirmation?: string;  // Gemini 描述看到的影片內容（用於驗證）
  inPoint: number;              // 入點 (秒)
  outPoint: number;             // 出點 (秒)
  transition: string;           // 轉場效果
  effects: string[];            // 視覺效果列表
  modifiers?: string[];         // Blender 調色修飾器（可選）
  speedFactor?: number;         // 速度倍率（1.0 = 正常）
  transitionDuration?: number;  // 此場景到下一場景的轉場時長（秒）
}

export interface TimelineMarker {
  time: number;                 // 時間點 (秒)
  type: 'cut' | 'transition' | 'effect';
  description: string;
}

// Gemini 上傳的檔案資訊
export interface UploadedVideoFile {
  name: string;
  uri: string;
  mimeType: string;
  sceneId: string;              // 對應的場景 ID
}
