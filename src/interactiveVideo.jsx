import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * InteractiveVideoPlayer
 * - Multiple clickable hotspots
 * - Branching: seek to timestamp or switch to another video source
 * - Loop the choice window until the user selects (with optional default action after N loops)
 * - Config-driven (no hardcoding)
 * - Mobile/touch friendly, keyboard accessible, analytics hooks
 *
 * Tailwind is available for styling by default in this canvas.
 */

/**
 * ------------------ CONFIG SHAPES ------------------
 *
 * sources: Array<{
 *   id: string;
 *   src: string;      // e.g. "/video.mp4"
 *   type?: string;    // e.g. "video/mp4" (optional)
 *   poster?: string;  // optional poster image
 * }>
 *
 * config: {
 *   segments: Array<{
 *     id: string;               // unique segment id
 *     start: number;            // start time (seconds) within current source
 *     end: number;              // end time (seconds) within current source
 *     requireChoice?: boolean;  // if true, force a choice before continuing
 *     loopOnNoChoice?: boolean; // if true, seek back to `start` if no choice made
 *     maxLoops?: number;        // optional: after N loops, auto-pick defaultAction if provided
 *     defaultAction?: Action;   // optional auto selection when loops exceeded
 *     hotspots: Array<Hotspot>;
 *   }>
 * }
 *
 * Hotspot: {
 *   id: string;
 *   label?: string;                       // visible text on the area/button
 *   rect: { top: string; left: string; width: string; height: string; } // CSS values (%, px, etc.)
 *   visible?: boolean;                    // default true
 *   action: Action;
 * }
 *
 * Action: {
 *   type: "seek" | "switchSource";
 *   to?: number;          // for type === "seek" (seconds)
 *   sourceId?: string;    // for type === "switchSource"
 *   startAt?: number;     // optional: when switching source, where to start (seconds)
 * }
 */

function clamp(v, min, max) {
	return Math.max(min, Math.min(max, v));
}

export default function InteractiveVideoPlayer({
	sources = [{ id: 'main', src: '/video.mp4', type: 'video/mp4' }],
	initialSourceId = 'main',
	config = {
		segments: [
			// Example segment (replace with your config)
			// {
			//   id: "choice-1",
			//   start: 10,
			//   end: 15,
			//   requireChoice: true,
			//   loopOnNoChoice: true,
			//   maxLoops: 3,
			//   defaultAction: { type: "seek", to: 30 },
			//   hotspots: [
			//     { id: "a", label: "Scene A", rect: { top: "40%", left: "20%", width: "120px", height: "80px" }, action: { type: "seek", to: 30 } },
			//     { id: "b", label: "Scene B", rect: { top: "60%", left: "55%", width: "140px", height: "100px" }, action: { type: "seek", to: 60 } },
			//   ]
			// }
		],
	},
	ui = {
		hotspotStyle: '', // tailwind classes for hotspot boxes
		buttonClass: 'px-3 py-2 rounded-2xl shadow text-sm font-medium',
		choiceGlow: true,
		fadeMs: 200,
	},
	onEvent = (evt) => {}, // analytics hook: { type, payload }
	width = 960,
	height = 540,
	autoPlay = true,
	controls = true,
	muted = false,
	loop = false,
}) {
	const videoRef = useRef(null);
	const [currentSourceId, setCurrentSourceId] = useState(initialSourceId);
	const [ready, setReady] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [activeSegmentId, setActiveSegmentId] = useState(null);
	const [activeHotspot, setActiveHotspot] = useState(null);
	const [loopCountBySeg, setLoopCountBySeg] = useState({});
	const [userChoseInSegment, setUserChoseInSegment] = useState(false);
	const [showOverlays, setShowOverlays] = useState(true);

	const currentSource = useMemo(
		() =>
			sources.find((s) => s.id === currentSourceId) ||
			sources[0],
		[sources, currentSourceId]
	);

	const activeSegment = useMemo(() => {
		return (
			config.segments.find(
				(seg) =>
					currentTime >= seg.start &&
					currentTime <= seg.end
			) || null
		);
	}, [config.segments, currentTime]);

	// Attach timeupdate listener
	useEffect(() => {
		const v = videoRef.current;
		if (!v) return;

		const onTime = () => setCurrentTime(v.currentTime || 0);
		const onLoaded = () => setReady(true);
		v.addEventListener('timeupdate', onTime);
		v.addEventListener('loadedmetadata', onLoaded);
		return () => {
			v.removeEventListener('timeupdate', onTime);
			v.removeEventListener('loadedmetadata', onLoaded);
		};
	}, [currentSourceId]);

	useEffect(() => {
		if (activeHotspot) {
			console.log(activeHotspot, "Aca");
			if (activeHotspot.action?.end && currentTime > activeHotspot?.action.end + 0.05) {
				const seg = config.segments.find(
					(s) => s.id === activeSegmentId
				);
				console.log(activeSegmentId);
				setActiveHotspot(null);
				seekTo(activeHotspot?.onEnd);
			}
		} else {
			// setActiveHotspot()
		}
	}, [currentTime, activeHotspot]);

	// Segment entry/exit effects
	useEffect(() => {
		if (activeSegment) {
			// entering or staying in a segment
			if (activeSegmentId !== activeSegment.id) {
				// entered a new segment → reset choice state and maybe show overlays
				setActiveSegmentId(activeSegment.id);
				setUserChoseInSegment(false);
				setShowOverlays(true);
				onEvent({
					type: 'segment.enter',
					payload: {
						segmentId: activeSegment.id,
					},
				});
			}
		} else {
			// left any segment: if previous segment required choice and none made, handle looping/default
			if (activeSegmentId) {
				const seg = config.segments.find(
					(s) => s.id === activeSegmentId
				);
				if (
					seg &&
					seg.requireChoice &&
					seg.loopOnNoChoice &&
					!userChoseInSegment
				) {
					const loops =
						(loopCountBySeg[seg.id] || 0) +
						1;
					// Update loop counter
					setLoopCountBySeg((prev) => ({
						...prev,
						[seg.id]: loops,
					}));
					onEvent({
						type: 'segment.loop',
						payload: {
							segmentId: seg.id,
							loops,
						},
					});

					// Decide: loop again or auto default
					const reachedMax =
						typeof seg.maxLoops ===
							'number' &&
						loops >= seg.maxLoops;
					if (reachedMax && seg.defaultAction) {
						performAction(
							seg.defaultAction
						);
						onEvent({
							type: 'segment.autoselect',
							payload: {
								segmentId: seg.id,
							},
						});
					} else {
						// Seek back to the start of the segment
						seekTo(seg.start);
					}
				}
				setActiveSegmentId(null);
				setShowOverlays(false);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSegment, currentTime]);

	function seekTo(seconds) {
		const v = videoRef.current;
		if (!v) return;
		const t = clamp(seconds, 0, v.duration || seconds + 0.01);
		console.log(t, 't');
		v.currentTime = t;
		v.play().catch(() => {});
	}

	function performAction(action) {
        console.log(action, 'Action');
		if (!action) return;
		if (action.type === 'seek' && typeof action.start === 'number') {
			seekTo(action.start);
		} else if (action.type === 'switchSource' && action.sourceId) {
			switchSource(action.sourceId, action.startAt ?? 0);
		}
	}

	function switchSource(sourceId, startAt = 0) {
		setCurrentSourceId(sourceId);
		setReady(false);
		setTimeout(() => {
			const v = videoRef.current;
			if (!v) return;
			v.currentTime = startAt;
			v.play().catch(() => {});
		}, 0);
		onEvent({
			type: 'source.switch',
			payload: { sourceId, startAt },
		});
	}

	function onHotspotClick(hotspot, segment) {
		setUserChoseInSegment(true);
		setShowOverlays(false);
		onEvent({
			type: 'hotspot.click',
			payload: {
				hotspotId: hotspot.id,
				segmentId: segment?.id,
			},
		});
		performAction(hotspot.action);
		setActiveHotspot(hotspot);
	}

	function onChoiceEnd(hotspot, segment) {
		setUserChoseInSegment(true);
		setShowOverlays(false);
		onEvent({
			type: 'hotspot.click',
			payload: {
				hotspotId: hotspot.id,
				segmentId: segment?.id,
			},
		});
		performAction(hotspot.action);
	}

	// Keyboard support: numbers 1..n trigger visible hotspots
	useEffect(() => {
		const handleKey = (e) => {
			if (!activeSegment || !showOverlays) return;
			if (e.key >= '1' && e.key <= '9') {
				const idx = Number(e.key) - 1;
				const hs = (
					activeSegment.hotspots || []
				).filter((h) => h.visible !== false)[idx];
				if (hs) {
					e.preventDefault();
					onHotspotClick(hs, activeSegment);
				}
			}
		};
		window.addEventListener('keydown', handleKey);
		return () => window.removeEventListener('keydown', handleKey);
	}, [activeSegment, showOverlays]);

	// Ensure we never run past a requireChoice segment's end while overlays hidden and no choice
	// useEffect(() => {
	// 	if (!activeSegment || !activeSegment.requireChoice) return;
	// 	const v = videoRef.current;
	// 	if (!v) return;

	// 	const onFrame = () => {
	// 		if (!activeSegment) return;
	// 		// If we've passed the end without a choice, snap back (safety net)
	// 		if (
	// 			!userChoseInSegment &&
	// 			v.currentTime > activeSegment.end + 0.05
	// 		) {
	// 			seekTo(activeSegment.start);
	// 		}
	// 		requestAnimationFrame(onFrame);
	// 	};
	// 	const raf = requestAnimationFrame(onFrame);
	// 	return () => cancelAnimationFrame(raf);
	// }, [activeSegment, userChoseInSegment]);

	return (
		<div className='w-full flex flex-col items-center gap-3'>
			<div
				className='relative'
				style={{
					width: `${width}px`,
					height: `${height}px`,
					backgroundColor: 'gray',
				}}
			>
				{/* Video */}
				<video
					ref={videoRef}
					className='rounded-2xl shadow w-full h-full bg-black'
					src={currentSource?.src}
					poster={currentSource?.poster}
					controls={controls}
					muted={muted}
					autoPlay={autoPlay}
					playsInline
					loop={loop}
				/>

				{/* Overlays */}
				<AnimatePresence>
					{activeSegment && showOverlays && (
						<motion.div
							key={activeSegment.id}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{
								duration:
									(ui.fadeMs ??
										200) /
									1000,
							}}
							className='absolute inset-0 pointer-events-none'
						>
							{(
								activeSegment.hotspots ||
								[]
							)
								.filter(
									(h) =>
										h.visible !==
										false
								)
								.map((h) => (
									<button
										key={
											h.id
										}
										className={
											`absolute pointer-events-auto focus:outline-none ${ui.buttonClass} ` +
											(ui.choiceGlow
												? 'ring-2 ring-white/60 hover:ring-white/90'
												: '')
										}
										style={{
											top: h
												.rect
												.top,
											left: h
												.rect
												.left,
											width: h
												.rect
												.width,
											height: h
												.rect
												.height,
											display: 'flex',
											alignItems: 'center',
											justifyContent:
												'center',
											background: 'rgba(0,0,0,0.35)',
											backdropFilter:
												'blur(2px)',
										}}
										onClick={() =>
											onHotspotClick(
												h,
												activeSegment
											)
										}
										aria-label={
											h.label ||
											'Choice'
										}
									>
										<span className='text-white text-sm font-semibold drop-shadow'>
											{h.label ||
												''}
										</span>
									</button>
								))}

							{/* Timer bar (optional visual) */}
							<div className='absolute bottom-2 left-2 right-2 h-1.5 bg-white/25 rounded-full overflow-hidden'>
								<div
									className='h-full bg-white/80'
									style={{
										width: `${
											activeSegment
												? clamp(
														((currentTime -
															activeSegment.start) /
															Math.max(
																0.001,
																activeSegment.end -
																	activeSegment.start
															)) *
															100,
														0,
														100
												  )
												: 0
										}%`,
									}}
								/>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Debug / Controls (remove in prod) */}
			<div className='text-xs text-gray-500 flex gap-3 items-center'>
				<span>
					Source:{' '}
					<strong>{currentSource?.id}</strong>
				</span>
				<span>| Time: {currentTime.toFixed(2)}s</span>
				{activeSegment && (
					<span>
						| Segment:{' '}
						<strong>
							{activeSegment.id}
						</strong>{' '}
						({activeSegment.start}s–
						{activeSegment.end}s)
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * ------------------ EXAMPLE USAGE ------------------
 * Replace the sources and exampleConfig with your assets.
 */

// const exampleSources = [
// 	{ id: 'main', src: '/video.mp4', type: 'video/mp4', poster: '' },
// 	{ id: 'altA', src: '/videoA.mp4', type: 'video/mp4' },
// 	{ id: 'altB', src: '/videoB.mp4', type: 'video/mp4' },
// ];

// const exampleConfig = {
// 	segments: [
// 		{
// 			id: 'choice-1',
// 			start: 5,
// 			end: 10,
// 			requireChoice: true,
// 			loopOnNoChoice: true,
// 			maxLoops: 2,
// 			defaultAction: { type: 'seek', to: 25 },
// 			hotspots: [
// 				{
// 					id: 'toA',
// 					label: 'Go to Scene A',
// 					rect: {
// 						top: '40%',
// 						left: '15%',
// 						width: '170px',
// 						height: '72px',
// 					},
// 					action: { type: 'seek', to: 30 },
// 				},
// 				{
// 					id: 'toB',
// 					label: 'Go to Scene B',
// 					rect: {
// 						top: '60%',
// 						left: '60%',
// 						width: '170px',
// 						height: '72px',
// 					},
// 					action: { type: 'seek', to: 60 },
// 				}
// 			],
// 		}

// 	]
// };

function analyticsLogger(evt) {
	// Replace with GA/Mixpanel/etc.
	// console.log("analytics", evt);
}

// export default function Demo() {
//   return (
//     <div className="min-h-screen bg-neutral-950 text-white p-6">
//       <h1 className="text-2xl font-semibold mb-4">Interactive Video Player — Demo</h1>
//       <p className="text-sm text-white/70 mb-6 max-w-3xl">
//         Clickable hotspots, branching (seek and switch source), and loop-on-no-choice. Use keys 1–9 to select hotspots when visible.
//       </p>

//       <InteractiveVideoPlayer
//         sources={exampleSources}
//         initialSourceId="main"
//         config={exampleConfig}
//         onEvent={analyticsLogger}
//         width={960}
//         height={540}
//         autoPlay
//         controls
//         muted={false}
//       />

//       <div className="mt-6 text-white/60 text-sm">
//         <p>To integrate in your app, import <code>InteractiveVideoPlayer</code> and pass your own <code>sources</code> and <code>config</code>.</p>
//       </div>
//     </div>
//   );
// }
