import type { CSSProperties } from 'react';

export type RemotionTransitionType = 'fade' | 'wipe' | 'slide';

export interface RemotionSceneProps {
  id: string;
  src: string;
  type: 'video' | 'image';
  durationInFrames: number;
  from: number;
  fit?: 'cover' | 'contain';
  transition?: {
    type: RemotionTransitionType;
    durationInFrames: number;
  };
  subtitle?: {
    text: string;
    style?: CSSProperties;
  };
}

export interface RemotionCompositionProps {
  scenes: RemotionSceneProps[];
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
}
