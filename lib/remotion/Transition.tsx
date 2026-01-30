import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { RemotionTransitionType } from './types';

interface TransitionProps {
  type: RemotionTransitionType;
  durationInFrames: number;
  children: ReactNode;
}

export function Transition({ type, durationInFrames, children }: TransitionProps) {
  const frame = useCurrentFrame();
  const safeDuration = Math.max(durationInFrames, 1);
  const progress = interpolate(frame, [0, safeDuration], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const style: CSSProperties = {
    width: '100%',
    height: '100%',
  };

  if (type === 'fade') {
    style.opacity = progress;
  } else if (type === 'wipe') {
    const percent = Math.round(progress * 100);
    style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  } else if (type === 'slide') {
    style.transform = `translateX(${(1 - progress) * 100}%)`;
  }

  return (
    <AbsoluteFill style={style}>
      {children}
    </AbsoluteFill>
  );
}
