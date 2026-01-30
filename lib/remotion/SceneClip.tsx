import { AbsoluteFill, Img, Video, interpolate, useCurrentFrame } from 'remotion';
import type { RemotionSceneProps } from './types';

export function SceneClip({
  src,
  type,
  durationInFrames,
  from,
  fit = 'cover',
}: RemotionSceneProps) {
  const frame = useCurrentFrame();
  const safeDuration = Math.max(durationInFrames, 1);
  const zoom = type === 'image'
    ? interpolate(frame, [0, safeDuration], [1, 1.06], {
        extrapolateRight: 'clamp',
      })
    : 1;
  const panY = type === 'image'
    ? interpolate(frame, [0, safeDuration], [0, -12], {
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      {type === 'video' ? (
        <Video
          src={src}
          startFrom={Math.max(0, from)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
        />
      ) : (
        <Img
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: fit,
            transform: `scale(${zoom}) translateY(${panY}px)`,
            transformOrigin: 'center',
          }}
        />
      )}
    </AbsoluteFill>
  );
}
