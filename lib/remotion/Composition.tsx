import { AbsoluteFill, Sequence } from 'remotion';
import { SceneClip } from './SceneClip';
import { Subtitle } from './Subtitle';
import { Transition } from './Transition';
import type { RemotionCompositionProps } from './types';

function buildTimeline(scenes: RemotionCompositionProps['scenes']) {
  const timeline: {
    scene: RemotionCompositionProps['scenes'][number];
    startFrame: number;
    incomingTransition?: RemotionCompositionProps['scenes'][number]['transition'];
  }[] = [];

  let currentFrame = 0;

  scenes.forEach((scene, index) => {
    const previousTransition = index > 0 ? scenes[index - 1].transition : undefined;
    const overlap = previousTransition?.durationInFrames ?? 0;
    const startFrame = Math.max(0, currentFrame - overlap);

    timeline.push({
      scene,
      startFrame,
      incomingTransition: previousTransition,
    });

    currentFrame = startFrame + scene.durationInFrames;
  });

  return timeline;
}

export function Composition({ scenes }: RemotionCompositionProps) {
  const timeline = buildTimeline(scenes);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {timeline.map(({ scene, startFrame, incomingTransition }) => {
        const content = (
          <>
            <SceneClip {...scene} />
            {scene.subtitle?.text ? (
              <Subtitle
                text={scene.subtitle.text}
                durationInFrames={scene.durationInFrames}
                style={scene.subtitle.style}
              />
            ) : null}
          </>
        );

        return (
          <Sequence
            key={scene.id}
            from={startFrame}
            durationInFrames={scene.durationInFrames}
          >
            {incomingTransition ? (
              <Transition
                type={incomingTransition.type}
                durationInFrames={incomingTransition.durationInFrames}
              >
                {content}
              </Transition>
            ) : (
              content
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
