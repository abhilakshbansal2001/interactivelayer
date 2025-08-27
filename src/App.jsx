import { useState } from 'react';
import reactLogo from './assets/react.svg';
import carVideo from './assets/car.mp4';
import viteLogo from '/vite.svg';
import './App.css';
import InteractiveVideoPlayer from './interactiveVideo';

const exampleSources = [
	{ id: 'main', src: carVideo, type: 'video/mp4', poster: '' },
	// { id: 'altA', src: '/videoA.mp4', type: 'video/mp4' },
	// { id: 'altB', src: '/videoB.mp4', type: 'video/mp4' },
];

const exampleConfig = {
	segments: [
		{
			id: 'choice-1',
			start: 10,
			end: 13,
			requireChoice: true,
			loopOnNoChoice: true,
			// maxLoops: 2,
			defaultAction: { type: 'seek', to: 14 },
			hotspots: [
				{
					id: 'toA',
					label: 'Go to Scene A',
					rect: {
						top: '40%',
						left: '10%',
						width: '170px',
						height: '72px',
					},
          start:14,
					action: { type: 'seek', start: 14 , end: 16 },
          onEnd:67
				},
				{
					id: 'toB',
					label: 'Go to Scene B',
					rect: {
						top: '40%',
						left: '70%',
						width: '170px',
						height: '72px',
					},
          start:46,
					action: { type: 'seek', start: 46},
          onEnd :  67
				},
			],
      endOfChoice: 67
		},
		{
			id: 'choice-2',
			start: 69,
			end: 72,
			requireChoice: true,
			loopOnNoChoice: true,
			// maxLoops: 2,
			defaultAction: { type: 'seek', to: 14 },
			hotspots: [
				{
					id: 'toA',
					label: 'Go to Scene A',
					rect: {
						top: '40%',
						left: '10%',
						width: '170px',
						height: '72px',
					},
          start:73,
					action: { type: 'seek', start: 73, end: 113 },
          onEnd:125
				},
				{
					id: 'toB',
					label: 'Go to Scene B',
					rect: {
						top: '40%',
						left: '70%',
						width: '170px',
						height: '72px',
					},
          start:114,
					action: { type: 'seek', start: 114},
          onEnd:125
				},
			],
		},
	],
};

function App() {
	return (
		<>
			<InteractiveVideoPlayer
				sources={exampleSources}
				initialSourceId='main'
				config={exampleConfig}
				onEvent={() => {}}
				width={960}
				height={540}
				autoPlay
				controls
				muted={false}
			/>
		</>
	);
}

export default App;
