import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { CSSProperties } from 'react';

interface SubtitleProps {
  text: string;
  durationInFrames: number;
  style?: CSSProperties;
}

export function Subtitle({ text, durationInFrames, style }: SubtitleProps) {
  const frame = useCurrentFrame();
  const safeDuration = Math.max(durationInFrames, 1);
  const fadeFrames = Math.min(10, Math.floor(safeDuration / 4));
  const opacity = interpolate(
    frame,
    [0, fadeFrames, safeDuration - fadeFrames, safeDuration],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{
      justifyContent: 'flex-end',
      alignItems: 'center',
      padding: '5% 8%',
      pointerEvents: 'none',
      opacity,
    }}>
      <div
        style={{
          maxWidth: '90%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: '#fff',
          fontSize: '1.6rem',
          lineHeight: 1.4,
          padding: '12px 18px',
          borderRadius: 12,
          textAlign: 'center',
          ...style,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
