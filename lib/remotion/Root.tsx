import { Composition as RemotionComposition, registerRoot } from 'remotion';
import { Composition } from './Composition';
import type { RemotionCompositionProps } from './types';

const defaultProps: RemotionCompositionProps = {
  scenes: [],
  width: 1920,
  height: 1080,
  fps: 30,
  totalFrames: 1,
};

export const RemotionRoot = (): JSX.Element => (
  <RemotionComposition
    id="main"
    component={Composition}
    defaultProps={defaultProps}
    durationInFrames={defaultProps.totalFrames}
    fps={defaultProps.fps}
    width={defaultProps.width}
    height={defaultProps.height}
    calculateMetadata={({ props }) => {
      return {
        durationInFrames: Math.max(props.totalFrames || 1, 1),
        fps: props.fps || defaultProps.fps,
        width: props.width || defaultProps.width,
        height: props.height || defaultProps.height,
      };
    }}
  />
);

registerRoot(RemotionRoot);
