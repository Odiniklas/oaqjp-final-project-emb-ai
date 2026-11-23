import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { Video } from './Video.jsx';

const Root = () => <Composition id="Short" component={Video} width={1080} height={1920} fps={30} durationInFrames={900}
  defaultProps={{ scenes: [], words: [], style: {}, audio: null, duration: 30, aiLabel: 'Stimme: KI', channel: '' }}
  calculateMetadata={({ props }) => ({ durationInFrames: Math.ceil(props.duration * 30), width: props.width || 1080, height: props.height || 1920, fps: props.fps || 30 })} />;
registerRoot(Root);
