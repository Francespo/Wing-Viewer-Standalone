<script lang="ts">
	import type { Board as BoardModel, Frame, ReplayPlayer, ReplayShip, ShipState } from '$lib/replay';
	import { TOKEN_ABBR, TOKEN_COLOR, TOKEN_ORDER } from '$lib/replay';
	import { obstacleSprite } from '$lib/obstacle-art';
	import { baseArtPath, obstacleDrawRect, shipBoardSprite, tokenIconPath } from '$lib/board-art';
	import type { Pt } from '$lib/board';
	import {
		arcWedgePath,
		arrow,
		baseCorners,
		forward,
		FACTION_COLOR,
		MARKER_COLOR,
		MARKER_FACING_VECTOR,
		polyPoints,
		right,
		toSvg
	} from '$lib/board';
	import {
		bountyLabel,
		dialRevealedLabel,
		hyperspaceLabel,
		seatLabel,
		shipColor,
		shipPlayer
	} from '$lib/view';

	let {
		board,
		ships,
		players = [],
		frame,
		selectable = [],
		targets = [],
		onselect,
		inspectedId = null,
		oninspect,
		activeTemplate = null,
		showRangeOverlay = false,
		visualRotOffsets = {},
		optionalShip = null,
		onoptional,
		setupOptions = [],
		onselectpose
	}: {
		board: BoardModel;
		ships: ReplayShip[];
		/** Player identity; empty for a replay written before owners existed. */
		players?: ReplayPlayer[];
		frame: Frame;
		/** Ship ids the current question can be answered by clicking. */
		selectable?: number[];
		/** Ship ids the current question is about; drawn as targets. */
		targets?: number[];
		onselect?: (id: number) => void;
		inspectedId?: number | null;
		oninspect?: (id: number) => void;
		activeTemplate?: string | null;
		showRangeOverlay?: boolean;
		visualRotOffsets?: Record<number, number>;
		optionalShip?: number | null;
		onoptional?: (choice: 'use' | 'skip') => void;
		setupOptions?: import('$lib/live').OptionView[];
		onselectpose?: (id: string) => void;
	} = $props();

	let mat = $state<'starfield' | 'tatooine'>('starfield');

	/** Viewer-only board controls. The viewBox is kept locally in Board so
	 *  GameScreen/replay stay untouched; the SVG does the hit-testing so clicks
	 *  still resolve while the board is flipped. */
	let containerEl = $state<HTMLDivElement | null>(null);
	let zoom = $state(1);
	let center = $state<Pt | null>(null);
	let flipped = $state(false);

	/** Snap-drag (viewer only). Pressing a legal-placement marker lifts a
	 *  lightweight ship-base ghost that follows the cursor; on release it snaps
	 *  to the nearest engine-provided pose marker and posts that option's id.
	 *  All geometry lives in the flipped group's local SVG coordinates, so it
	 *  stays correct when the board is rotated. No rules are evaluated here:
	 *  "nearest candidate" is the only decision made in the viewer. */
	let flipEl = $state<SVGGElement | null>(null);
	let dragSourceId = $state<string | null>(null);
	let dragStartClient = $state<Pt | null>(null);
	let dragPoint = $state<Pt | null>(null);
	let dragActive = $state(false);
	let suppressNextClick = false;
	const DRAG_THRESHOLD_PX = 4;

	const poseMarkers = $derived(
		setupOptions
			.filter((o) => o.pose)
			.map((o) => ({
				id: o.id,
				label: o.label,
				heading: o.pose!.heading,
				local: toSvg(board, o.pose!.x, o.pose!.y)
			}))
	);

	const ghostHeading = $derived(poseMarkers.find((m) => m.id === dragSourceId)?.heading ?? 0);

	/** Client (screen) point -> the flipped group's local SVG coordinates. Using
	 *  the group's own CTM keeps the drop point and the markers in the same space
	 *  even while the board is flipped or zoomed. */
	function pointerToLocal(event: PointerEvent): Pt | null {
		const g = flipEl;
		if (!g) return null;
		const ctm = g.getScreenCTM();
		if (!ctm) return null;
		const svg = g.ownerSVGElement;
		if (!svg) return null;
		const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
		return { x: local.x, y: local.y };
	}

	/** Nearest engine-provided pose by plain SVG Euclidean distance. */
	function nearestPose(point: Pt): string | null {
		let bestId: string | null = null;
		let bestD2 = Infinity;
		for (const m of poseMarkers) {
			const dx = m.local.x - point.x;
			const dy = m.local.y - point.y;
			const d2 = dx * dx + dy * dy;
			if (d2 < bestD2) {
				bestD2 = d2;
				bestId = m.id;
			}
		}
		return bestId;
	}

	/** Small ship-base polygon for the ghost, oriented by the source pose's
	 *  heading (engine degrees clockwise from +Y; SVG flips Y). */
	function ghostBasePoints(center: Pt, heading: number): string {
		const r = (heading * Math.PI) / 180;
		const nose = { x: Math.sin(r), y: -Math.cos(r) };
		const side = { x: Math.cos(r), y: Math.sin(r) };
		const hw = 13;
		const hl = 17;
		const corners = [
			{ x: center.x + nose.x * hl + side.x * hw, y: center.y + nose.y * hl + side.y * hw },
			{ x: center.x + nose.x * hl - side.x * hw, y: center.y + nose.y * hl - side.y * hw },
			{ x: center.x - nose.x * hl - side.x * hw, y: center.y - nose.y * hl - side.y * hw },
			{ x: center.x - nose.x * hl + side.x * hw, y: center.y - nose.y * hl + side.y * hw }
		];
		return corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
	}

	function startPoseDrag(event: PointerEvent, id: string) {
		if (event.button !== 0 || dragSourceId !== null) return;
		const local = pointerToLocal(event);
		if (!local) return;
		dragSourceId = id;
		dragStartClient = { x: event.clientX, y: event.clientY };
		dragPoint = local;
		dragActive = false;
		suppressNextClick = false;
		const el = event.currentTarget as SVGGElement;
		try {
			el.setPointerCapture(event.pointerId);
		} catch {
			// Pointer capture is best-effort; move/up still work without it.
		}
	}

	function movePoseDrag(event: PointerEvent) {
		if (dragSourceId === null) return;
		const local = pointerToLocal(event);
		if (!local) return;
		dragPoint = local;
		if (
			dragStartClient &&
			Math.hypot(
				event.clientX - dragStartClient.x,
				event.clientY - dragStartClient.y
			) > DRAG_THRESHOLD_PX
		) {
			dragActive = true;
		}
	}

	function endPoseDrag(event: PointerEvent) {
		if (dragSourceId === null) return;
		const drop = pointerToLocal(event) ?? dragPoint;
		const wasActive = dragActive;
		dragSourceId = null;
		dragStartClient = null;
		dragPoint = null;
		dragActive = false;
		const el = event.currentTarget as SVGGElement;
		try {
			if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
		} catch {
			// Ignore release failures; capture is dropped automatically on up.
		}
		if (wasActive && drop) {
			const chosen = nearestPose(drop);
			suppressNextClick = true;
			// Swallow the synthetic click that follows pointerup so the source
			// marker's click handler does not also post a selection.
			setTimeout(() => {
				suppressNextClick = false;
			}, 0);
			if (chosen !== null) onselectpose?.(chosen);
		}
	}

	function cancelPoseDrag(event: PointerEvent) {
		if (dragSourceId === null) return;
		dragSourceId = null;
		dragStartClient = null;
		dragPoint = null;
		dragActive = false;
		suppressNextClick = false;
		const el = event.currentTarget as SVGGElement;
		try {
			if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
		} catch {
			// Ignore.
		}
	}

	// A new game can swap the board dimensions under a mounted component.
	let prevW = -1;
	let prevH = -1;
	$effect(() => {
		if (prevW !== board.width || prevH !== board.height) {
			prevW = board.width;
			prevH = board.height;
			zoom = 1;
			center = null;
			flipped = false;
		}
	});

	const viewport = $derived.by(() => {
		const w = board.width / zoom;
		const h = board.height / zoom;
		if (!center) return { x: 0, y: 0, w: board.width, h: board.height };
		// `center` is in engine coordinates; the viewBox is in SVG coordinates
		// (Y flipped by toSvg). Clamp so the viewport never leaves the mat.
		const sx = center.x;
		const sy = board.height - center.y;
		return {
			x: Math.min(Math.max(sx - w / 2, 0), Math.max(0, board.width - w)),
			y: Math.min(Math.max(sy - h / 2, 0), Math.max(0, board.height - h)),
			w,
			h
		};
	});
	const viewBox = $derived(`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`);

	function centerOnActive() {
		const id = frame.active ?? inspectedId;
		if (id === null) return;
		const s = frame.ships.find((ship) => ship.id === id);
		if (!s) return;
		center = { x: s.x, y: s.y };
		zoom = Math.max(zoom, 2);
	}

	async function fullscreenBoard() {
		if (typeof containerEl?.requestFullscreen !== 'function') return;
		try {
			await containerEl.requestFullscreen();
		} catch {
			// Fullscreen can be denied by the browser; leave the board as-is.
		}
	}

	/** Printed template sizes (mm), mirrored from TableTray. Geometry only:
	 *  the viewer never checks which manoeuvre a ship may actually perform. */
	const TEMPLATE_GEOM: Record<string, { kind: 'straight' | 'bank' | 'turn'; mm: number }> = {
		s1: { kind: 'straight', mm: 40 },
		s2: { kind: 'straight', mm: 80 },
		s3: { kind: 'straight', mm: 120 },
		s4: { kind: 'straight', mm: 160 },
		s5: { kind: 'straight', mm: 200 },
		b1: { kind: 'bank', mm: 80 },
		b2: { kind: 'bank', mm: 130 },
		b3: { kind: 'bank', mm: 180 },
		t1: { kind: 'turn', mm: 35 },
		t2: { kind: 'turn', mm: 62.5 },
		t3: { kind: 'turn', mm: 90 }
	};

	/** The inspected ship, or the ship acting in this frame. */
	const focusShip = $derived.by(() => {
		const id = inspectedId ?? frame.active ?? null;
		return id === null ? null : (frame.ships.find((s) => s.id === id) ?? null);
	});
	const focusDef = $derived(focusShip ? shipDef(focusShip.id) : null);

	/** Straight-template footprint in engine coordinates, converted to SVG by
	 *  the shared `polyPoints` helper. Starts at the ship centre and runs forward. */
	function straightTemplatePoints(s: ShipState, length: number, width: number): string {
		const f = forward(s.heading);
		const rt = right(s.heading);
		const at = (fw: number, side: number): Pt => ({
			x: s.x + f.x * fw + rt.x * side,
			y: s.y + f.y * fw + rt.y * side
		});
		return polyPoints(
			[at(0, -width / 2), at(length, -width / 2), at(length, width / 2), at(0, width / 2)],
			board
		);
	}

	const states = $derived(frame.ships);
	const canSelect = $derived((id: number) => selectable.includes(id));

	function shipDef(id: number) {
		return ships.find((s) => s.id === id);
	}

	/** The writer's player record for a ship, when it sent `owner` (Aces).
	 *  Standard and the scenarios have no owner and keep the faction colour. */
	function playerFor(id: number) {
		const def = shipDef(id);
		return def ? shipPlayer(def, players) : undefined;
	}

	function colorFor(id: number): string {
		const def = shipDef(id);
		return def ? shipColor(def, players) : FACTION_COLOR.unknown;
	}

	/** The faction colour stays the secondary chassis colour for hull pips. */
	function chassisColor(id: number): string {
		const def = shipDef(id);
		return def ? FACTION_COLOR[def.faction] : FACTION_COLOR.unknown;
	}

	function pick(id: number) {
		if (canSelect(id)) onselect?.(id);
	}

	function role(id: number): 'attacker' | 'defender' | null {
		if (frame.highlight?.attackers?.includes(id)) return 'attacker';
		if (frame.highlight?.defenders?.includes(id)) return 'defender';
		return null;
	}

	/** Draw the firing arc only where it carries information: the ship acting in
	 *  this frame, or the two ships of an attack. Four overlapping 300 mm wedges
	 *  is noise, not information. */
	function showArc(id: number) {
		return frame.active === id || role(id) !== null;
	}

	function tokens(s: { tokens: Frame['ships'][number]['tokens'] }) {
		return TOKEN_ORDER.filter((t) => (s.tokens[t] ?? 0) > 0).map((t) => ({
			kind: t,
			count: s.tokens[t] ?? 0
		}));
	}
</script>

<div class="relative h-full w-full" bind:this={containerEl} data-testid="board-container">
	<svg
		class="h-full w-full"
		viewBox={viewBox}
		preserveAspectRatio="xMidYMid meet"
		role="img"
		aria-label="game board"
	>
	<!-- Everything drawn on the mat lives in this group so the flip button can
	     rotate it about the board centre. SVG hit-testing follows the transform,
	     so ship clicks keep resolving while flipped. -->
	<g bind:this={flipEl} transform={flipped ? `rotate(180 ${board.width / 2} ${board.height / 2})` : undefined}>
	<rect x="0" y="0" width={board.width} height={board.height} fill="#070707" stroke="#2a2a2a" />
	<image
		href={mat === 'tatooine' ? '/models/mat-tatooine.png' : '/models/mat-starfield.jpg'}
		x="0"
		y="0"
		width={board.width}
		height={board.height}
		preserveAspectRatio="xMidYMid slice"
		opacity="0.85"
	/>

	<!-- Engine-produced legal setup/ship-deployment poses, drawn as clickable
	     markers and used as the snap targets for the drag ghost. -->
	{#each poseMarkers as marker (marker.id)}
		{@const pc = marker.local}
		<g
			class={dragSourceId === marker.id ? 'cursor-grabbing' : 'cursor-grab'}
			role="button"
			tabindex="0"
			data-pose={marker.id}
			aria-label={`legal placement ${marker.label}`}
			style="touch-action:none"
			onpointerdown={(event) => startPoseDrag(event, marker.id)}
			onpointermove={movePoseDrag}
			onpointerup={endPoseDrag}
			onpointercancel={cancelPoseDrag}
			onclick={(event) => {
				event.stopPropagation();
				if (suppressNextClick) { suppressNextClick = false; return; }
				onselectpose?.(marker.id);
			}}
			onkeydown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onselectpose?.(marker.id); } }}
		>
			<circle cx={pc.x} cy={pc.y} r="4" fill="#3fe0c5" fill-opacity="0.25" stroke="#3fe0c5" stroke-width="0.8" />
			<circle cx={pc.x} cy={pc.y} r="1.5" fill="#3fe0c5" />
		</g>
	{/each}

	<!-- Drag ghost: a translucent base that follows the pointer in the same
	     local SVG space as the markers. Presentation only; the drop resolves to
	     whichever existing option marker is geometrically nearest. -->
	{#if dragActive && dragPoint}
		<g data-testid="pose-drag-ghost" pointer-events="none">
			<polygon
				points={ghostBasePoints(dragPoint, ghostHeading)}
				fill="#3fe0c5"
				fill-opacity="0.25"
				stroke="#3fe0c5"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
			<circle cx={dragPoint.x} cy={dragPoint.y} r="2.5" fill="#3fe0c5" />
		</g>
	{/if}

	<g stroke="#ffffff" stroke-opacity="0.05" stroke-width="1">
		{#each Array.from({ length: Math.floor(board.width / 100) }, (_, i) => (i + 1) * 100) as x}
			<line x1={x} y1="0" x2={x} y2={board.height} />
		{/each}
		{#each Array.from({ length: Math.floor(board.height / 100) }, (_, i) => (i + 1) * 100) as y}
			<line x1="0" y1={y} x2={board.width} y2={y} />
		{/each}
	</g>

	{#each frame.features ?? board.features ?? [] as f}
		{@const c = toSvg(board, f.x, f.y)}
		{@const marker = f.marker_color ? MARKER_COLOR[f.marker_color] : '#7dd3fc'}
		{@const facing = f.facing ? MARKER_FACING_VECTOR[f.facing] : null}
		{@const tip = facing
			? toSvg(board, f.x + facing.x * f.radius * 1.35, f.y + facing.y * f.radius * 1.35)
			: null}
		{@const labelAnchor =
			f.x < board.width * 0.15 ? 'start' : f.x > board.width * 0.85 ? 'end' : 'middle'}
		<!-- A scenario feature is a marker, not an obstacle: a ring and a
		     crosshair, never a filled obstacle circle. No range ring is drawn
		     because range is a rule and the viewer does not compute rules.
		     A player marker is drawn in the colour the engine sent (red for the
		     first player, blue for the second). -->
		<circle
			cx={c.x}
			cy={c.y}
			r={f.radius}
			fill="none"
			stroke={marker}
			stroke-width="2.5"
		/>
		<circle
			cx={c.x}
			cy={c.y}
			r={f.radius * 0.55}
			fill="none"
			stroke="#7dd3fc"
			stroke-opacity="0.65"
			stroke-width="1.2"
			stroke-dasharray="3 3"
		/>
		{#if f.kind === 'hyperspace marker'}
			<!-- Aces High's four markers: the engine sends the printed size class
			     and the corner the blank half faces (D-074/D-078). The viewer
			     draws the ring, a pointer toward that corner and the label; it
			     never derives a placement box, range or respawn pose. -->
			<g>
				<circle
					cx={c.x}
					cy={c.y}
					r={f.radius * 1.65}
					fill="none"
					stroke="#c084fc"
					stroke-opacity="0.55"
					stroke-width="1.2"
					stroke-dasharray="2 4"
				/>
				{#if facing && tip}
					<line
						x1={c.x}
						y1={c.y}
						x2={tip.x}
						y2={tip.y}
						stroke="#e879f9"
						stroke-opacity="0.8"
						stroke-width="1.5"
						stroke-dasharray="3 3"
					/>
					<circle cx={tip.x} cy={tip.y} r="3" fill="#e879f9" />
				{/if}
				<text
					x={c.x}
					y={c.y - f.radius * 1.65 - 6}
					text-anchor={labelAnchor}
					font-size="12"
					font-family="Inter, sans-serif"
					fill="#e879f9"
					style="paint-order:stroke;stroke:#000;stroke-width:4px;stroke-opacity:.85"
				>
					{hyperspaceLabel(f)}
				</text>
			</g>
		{/if}
		{#if f.charge}
			<!-- A data cache's charge token, on its Active or Inactive side (XWA
			     Scenarios p.7 "DATA CACHE"). The engine sends the side; the
			     viewer never spends or recovers it. -->
			<circle
				cx={c.x + f.radius * 0.8}
				cy={c.y - f.radius * 0.8}
				r={f.radius * 0.28}
				fill={f.charge === 'active' ? '#7CFC00' : '#0b0b0b'}
				stroke={f.charge === 'active' ? '#7CFC00' : '#f59e0b'}
				stroke-width="1.6"
			>
				<title>data cache charge: {f.charge}</title>
			</circle>
		{/if}
		{#if f.marker_color}
			<circle cx={c.x} cy={c.y} r={f.radius * 0.45} fill={marker} fill-opacity="0.9" />
			<circle
				cx={c.x}
				cy={c.y}
				r={f.radius * 0.45}
				fill="none"
				stroke="#0b0b0b"
				stroke-width="1"
			/>
		{/if}
		<line
			x1={c.x - f.radius * 1.35}
			y1={c.y}
			x2={c.x + f.radius * 1.35}
			y2={c.y}
			stroke={marker}
			stroke-opacity="0.5"
			stroke-width="1"
		/>
		<line
			x1={c.x}
			y1={c.y - f.radius * 1.35}
			x2={c.x}
			y2={c.y + f.radius * 1.35}
			stroke={marker}
			stroke-opacity="0.5"
			stroke-width="1"
		/>
	{/each}

	{#each board.obstacles as o, oi}
		{@const c = toSvg(board, o.x, o.y)}
		{@const art = obstacleSprite(o.kind, oi)}
		{@const draw = art ? obstacleDrawRect(o, art) : null}
		{@const points = o.outline?.map(([px, py]) => {
			const s = toSvg(board, o.x + px / 100, o.y + py / 100);
			return `${s.x.toFixed(2)},${s.y.toFixed(2)}`;
		}).join(' ')}
		{#if points}
			<!-- The engine's exact silhouette, not a circle. The 3D scan texture is
			     clipped to it so the picture and the rules footprint coincide. -->
			<defs>
				<clipPath id={`obstacle-${oi}`}>
					<polygon {points} />
				</clipPath>
			</defs>
			{#if art && draw}
				<!-- Scale fix: the sprite is drawn at the outline's real-mm bounding
				     box (the silhouette is fit to 40 mm), not a `2 * radius` square.
				     `none` makes the scan fill its own clip polygon exactly. -->
				<image
					href={art.src}
					x={c.x - draw.w / 2}
					y={c.y - draw.h / 2}
					width={draw.w}
					height={draw.h}
					preserveAspectRatio="none"
					clip-path={`url(#obstacle-${oi})`}
				>
					<title>{`${o.kind} obstacle · TTS ${art.key} scan · ${draw.w.toFixed(2)}×${draw.h.toFixed(2)} mm`}</title>
				</image>
			{/if}
			<polygon
				{points}
				fill={draw ? 'transparent' : (o.kind === 'gas' ? '#14201f' : '#1c1c18')}
				stroke={o.kind === 'gas' ? '#2f4f4f' : '#3a3a33'}
				stroke-width="1.5"
			/>
		{:else}
			<!-- Replays written before silhouettes keep the circular fallback. -->
			<circle
				cx={c.x}
				cy={c.y}
				r={o.radius}
				fill={o.kind === 'gas' ? '#14201f' : o.kind === 'debris' ? '#181818' : '#1c1c18'}
				stroke={o.kind === 'gas' ? '#2f4f4f' : '#3a3a33'}
				stroke-width="2"
			/>
		{/if}
	{/each}

	<!-- arcs: only for the ship acting and the ships of an attack -->
	{#each states.filter((s) => s.alive && showArc(s.id)) as s}
		{@const def = shipDef(s.id)}
		{#if def && def.arc !== 'none'}
			<path
				d={arcWedgePath(s, board, 300, def.arc === 'bullseye' ? 12 : 45)}
				fill={FACTION_COLOR[def.faction]}
				fill-opacity="0.06"
				stroke={FACTION_COLOR[def.faction]}
				stroke-opacity="0.22"
				stroke-width="1"
			/>
			{#if def.arc === 'front_rear' || def.arc === 'turret'}
				<path
					d={arcWedgePath(s, board, 300, 45, 180)}
					fill={FACTION_COLOR[def.faction]}
					fill-opacity="0.035"
					stroke={FACTION_COLOR[def.faction]}
					stroke-opacity="0.14"
					stroke-width="1"
				/>
			{/if}
		{/if}
	{/each}

	{#each frame.moves ?? [] as m}
		{@const a = arrow(m.from, m.to, board)}
		<g>
			<path
				d={a.path}
				stroke={m.partial ? '#ff8c00' : '#9a9a9a'}
				stroke-width="2"
				stroke-dasharray={m.partial ? '7 5' : undefined}
				fill="none"
			/>
			<path d={a.head} fill={m.partial ? '#ff8c00' : '#9a9a9a'} />
		</g>
	{/each}

	{#each states as s}
		{@const def = shipDef(s.id)}
		{@const player = playerFor(s.id)}
		{@const color = colorFor(s.id)}
		{@const chassis = chassisColor(s.id)}
		{@const seat = player ? (player.seat ?? (def?.owner ?? 0) + 1) : 0}
		{@const bounty = bountyLabel(s.bounty_tokens)}
		{@const revealedDial = dialRevealedLabel(s)}
		{@const base = def?.base ?? 40}
		{@const baseLength = def?.base_length ?? base}
		{@const pt = polyPoints(baseCorners(s, base, baseLength), board)}
		{@const c = toSvg(board, s.x, s.y)}
		{@const sprite = def ? shipBoardSprite(def) : null}
		{@const baseArt = def ? baseArtPath(base, def.faction, player?.faction, baseLength) : null}
		{@const rootOffset = visualRotOffsets[s.id] ?? 0}
		{@const labelAnchor =
			player && c.x < board.width * 0.15
				? 'start'
				: player && c.x > board.width * 0.85
					? 'end'
					: 'middle'}
		{@const r = role(s.id)}
		{@const selectableHere = canSelect(s.id)}
		<g
			opacity={s.alive ? 1 : 0.22}
			class={selectableHere ? 'cursor-pointer' : undefined}
			role={selectableHere ? 'button' : undefined}
			aria-label={selectableHere
				? `select ${player ? `P${seat} ` : ''}${def?.name ?? `ship ${s.id}`}`
				: undefined}
			onclick={() => pick(s.id)}
		>
			{#if targets.includes(s.id) && s.alive}
				<polygon
					points={pt}
					fill="none"
					stroke="#ffd166"
					stroke-width="3"
					stroke-dasharray="6 4"
					stroke-opacity="0.95"
				/>
			{/if}
			{#if frame.active === s.id || r}
				<polygon
					points={pt}
					fill="none"
					stroke={r === 'attacker' ? '#ff8c00' : r === 'defender' ? '#ff3333' : '#ffffff'}
					stroke-width="2.5"
					stroke-opacity="0.95"
				/>
			{/if}
			{#if baseArt}
				<!-- Real TTS faction base under the engine footprint outline. The
				     writer's owner/player faction wins, matching shipColor/shipPlayer;
				     no base PNG exists for a huge rectangular base. -->
				<image
					href={baseArt}
					x={c.x - base / 2}
					y={c.y - baseLength / 2}
					width={base}
					height={baseLength}
					preserveAspectRatio="none"
					transform={`rotate(${s.heading} ${c.x} ${c.y})`}
				>
					<title>{`${def?.faction ?? 'unknown'} ${base} mm TTS base`}</title>
				</image>
			{/if}
			<polygon points={pt} fill={color} fill-opacity={baseArt ? 0.12 : 0.3} stroke={color} stroke-width="2" />

			{#if sprite}
				<!-- Real scanned TTS ship, drawn at its render window `win_mm` 1:1 in
				     board SVG space. It is NEVER scaled to the engine base; `fp_mm`
				     is footprint metadata only. The polygon above stays as the exact
				     footprint outline and as the fallback when there is no scan. -->
				<image
					href={sprite.src}
					x={c.x - sprite.win_mm / 2}
					y={c.y - sprite.win_mm / 2}
					width={sprite.win_mm}
					height={sprite.win_mm}
					preserveAspectRatio="xMidYMid meet"
					transform={`rotate(${s.heading + rootOffset} ${c.x} ${c.y})`}
				>
					<title>{`${def?.name ?? `#${s.id}`} · ${sprite.win_mm} mm render window · footprint ${sprite.fp_mm ? `${sprite.fp_mm.join('×')} mm` : 'n/a'}`}</title>
				</image>
			{/if}

			{#if optionalShip === s.id}
				<g role="button" aria-label="Use ability" tabindex="0"
					onclick={(event) => { event.stopPropagation(); onoptional?.('use'); }}
					onkeydown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onoptional?.('use'); } }}>
					<rect x={c.x - 36} y={c.y - base - 54} width="36" height="17" rx="3" fill="#0c2a29" stroke="#3fe0c5" stroke-width="1.2" />
					<text x={c.x - 18} y={c.y - base - 42} text-anchor="middle" font-size="10" font-weight="700" fill="#3fe0c5">USA ↵</text>
				</g>
				<g role="button" aria-label="Skip ability" tabindex="0"
					onclick={(event) => { event.stopPropagation(); onoptional?.('skip'); }}
					onkeydown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onoptional?.('skip'); } }}>
					<rect x={c.x} y={c.y - base - 54} width="36" height="17" rx="3" fill="#0a0a0a" stroke="#666" stroke-width="1.2" />
					<text x={c.x + 18} y={c.y - base - 42} text-anchor="middle" font-size="10" font-weight="700" fill="#aaa">NO Esc</text>
				</g>
			{/if}

			{#if player}
				<!-- The seat badge (D-078). Aces is a free-for-all, so two ships can
				     share a faction and chassis; the colour and P-number come from
				     the writer, not from a faction table. -->
				<g transform={`translate(${c.x - base * 0.95} ${c.y})`}>
					<circle r="8" fill="#0b0b0b" stroke={color} stroke-width="2" />
					<text
						text-anchor="middle"
						y="3.4"
						font-size="9"
						font-weight="700"
						fill={color}
					>
						{seatLabel(player, def?.owner ?? 0)}
					</text>
					<title>{`P${seat} · ${player.name} · ${player.faction}`}</title>
				</g>
			{/if}

			{#if revealedDial}
				<!-- A dial a card revealed to the acting player. The text is the
				     engine's maneuver label; the viewer only places the badge. -->
				<g transform={`translate(${c.x} ${c.y - base * 0.8})`}>
					<rect
						x="-46"
						y="-9"
						width="92"
						height="18"
						rx="4"
						fill="#0b0b0b"
						stroke="#ffd166"
						stroke-width="1.5"
					/>
					<text text-anchor="middle" y="4" font-size="8" font-weight="700" fill="#ffd166">
						{revealedDial}
					</text>
					<title>{`Looked-at dial: ${s.dial_revealed}`}</title>
				</g>
			{/if}

			<!-- nose -->
			<line
				x1={c.x}
				y1={c.y}
				x2={c.x + Math.sin((s.heading * Math.PI) / 180) * base * 0.55}
				y2={c.y - Math.cos((s.heading * Math.PI) / 180) * base * 0.55}
				stroke="#ffffff"
				stroke-opacity="0.9"
				stroke-width="2.5"
			/>

			{#if s.towing !== undefined && s.alive}
				<!-- The player marker next to the ship that shows it is towing a
				     supply cache (XWA Scenarios p.4 "SCENARIO ACTION: [TOW]").
				     The cache is off the board, on the ship card; the marker is
				     the engine's towing state, drawn in the colour it sent. -->
				<circle
					cx={c.x + base * 0.62}
					cy={c.y + base * 0.62}
					r={base * 0.22}
					fill={s.towing_color ? MARKER_COLOR[s.towing_color] : '#7dd3fc'}
					stroke="#0b0b0b"
					stroke-width="1.5"
				/>
			{/if}

			{#if s.ancient_knowledge && s.alive}
				<!-- The Ancient Knowledge condition (XWA Scenarios p.7 "ANCIENT
				     KNOWLEDGE CONDITION"). The engine owns assignment and removal;
				     the viewer only draws the indicator. -->
				<g transform={`translate(${c.x - base * 0.62} ${c.y + base * 0.62})`}>
					<circle r="6" fill="#0d0d0d" stroke="#f0abfc" stroke-width="1.3" />
					<text
						text-anchor="middle"
						y="3.4"
						font-size="9"
						font-weight="700"
						fill="#f0abfc"
					>
						A
					</text>
					<title>Ancient Knowledge condition</title>
				</g>
			{/if}

			{#if s.alive}
				<text
					x={c.x}
					y={c.y - base * 0.78}
					text-anchor={labelAnchor}
					font-size="15"
					fill="#f2f2f2"
					font-family="Inter, sans-serif"
					style="paint-order:stroke;stroke:#000;stroke-width:4px;stroke-opacity:.85"
				>
					{def?.name ?? `#${s.id}`}
				</text>

				<!-- hull pips: shields first (cyan), then the faction/chassis colour.
				     In Aces the base is the seat colour and this stays the secondary
				     faction colour, so the two identities do not collapse (D-078). -->
				{#if def}
					{@const n = Math.min(def.hull + def.shields, 8)}
					<g>
						{#each Array.from({ length: n }, (_, i) => i) as i}
							{@const isShield = i < s.shields}
							{@const filled = isShield ? true : i - s.shields < s.hull}
							<circle
								cx={c.x - (n * 9) / 2 + i * 9 + 4}
								cy={c.y + base * 0.66}
								r="3.4"
								fill={filled ? (isShield ? '#3ad1ff' : chassis) : 'none'}
								stroke={isShield ? '#3ad1ff' : chassis}
								stroke-width="1"
								stroke-opacity={filled ? 1 : 0.45}
							/>
						{/each}
					</g>
				{/if}

				{#if bounty}
					<!-- Public bounty tokens on this ship's card (D-078). The engine
					     owns the score; the badge only displays the count. -->
					<g transform={`translate(${c.x} ${c.y + base * 1.02})`}>
						<rect
							x="-14"
							y="-8"
							width="28"
							height="16"
							rx="4"
							fill="#0b0b0b"
							stroke="#facc15"
							stroke-width="1.6"
						/>
						<text text-anchor="middle" y="3.6" font-size="10" font-weight="700" fill="#facc15">
							{bounty}
						</text>
						<title>{`${s.bounty_tokens} bounty token${(s.bounty_tokens ?? 0) === 1 ? '' : 's'}`}</title>
					</g>
				{/if}

				<!-- tokens: real TTS icon PNGs, with the old coloured badge as the
				     fallback for any token kind without an extracted icon. The
				     engine-owned count stays as a text overlay either way. -->
				{#each tokens(s) as t, i}
					{@const icon = tokenIconPath(t.kind)}
					<g transform={`translate(${c.x + base * 0.68} ${c.y - base * 0.4 + i * 13})`}>
						{#if icon}
							<image href={icon} x="-7" y="-7" width="14" height="14" preserveAspectRatio="xMidYMid meet">
								<title>{`${t.kind} token ×${t.count}`}</title>
							</image>
						{:else}
							<circle r="6" fill="#0d0d0d" stroke={TOKEN_COLOR[t.kind]} stroke-width="1.3" />
							<text
								text-anchor="middle"
								y="3.4"
								font-size="9"
								font-weight="700"
								fill={TOKEN_COLOR[t.kind]}
							>
								{TOKEN_ABBR[t.kind]}
							</text>
						{/if}
						{#if t.count > 1}
							<text x="8" y="3.4" font-size="8" fill="#bbb" style="paint-order:stroke;stroke:#000;stroke-width:2px">{t.count}</text>
						{/if}
					</g>
				{/each}

				{#if s.lock !== null}
					{@const target = states.find((o) => o.id === s.lock)}
					{#if target}
						{@const t = toSvg(board, target.x, target.y)}
						<line
							x1={c.x}
							y1={c.y}
							x2={t.x}
							y2={t.y}
							stroke="#ffd166"
							stroke-opacity="0.5"
							stroke-width="1.4"
							stroke-dasharray="4 4"
						/>
					{/if}
				{/if}
			{/if}
		</g>
	{/each}

	<!-- TTS ruler/template overlay. Pure presentation: the printed template
	     footprint and fixed-distance ruler guides are drawn with the shared
	     mm→SVG helpers; the viewer never evaluates a rule or a range band. -->
	{#if focusShip}
		{@const focus = toSvg(board, focusShip.x, focusShip.y)}
		<g
			data-testid="ruler-overlay"
			data-template={activeTemplate ?? ''}
			data-range={showRangeOverlay}
			pointer-events="none"
		>
			{#if activeTemplate && TEMPLATE_GEOM[activeTemplate]}
				{@const geom = TEMPLATE_GEOM[activeTemplate]}
				{#if geom.kind === 'straight'}
					<polygon
						points={straightTemplatePoints(focusShip, geom.mm, focusDef?.base ?? 40)}
						fill="#3fe0c5"
						fill-opacity="0.1"
						stroke="#3fe0c5"
						stroke-opacity="0.85"
						stroke-width="1.5"
						stroke-dasharray="5 3"
					/>
				{:else}
					<!-- Bank = 45° sweep, turn = 90° sweep. -->
					<path
						d={arcWedgePath(focusShip, board, geom.mm, geom.kind === 'bank' ? 45 : 90)}
						fill="#3fe0c5"
						fill-opacity="0.08"
						stroke="#3fe0c5"
						stroke-opacity="0.8"
						stroke-width="1.5"
						stroke-dasharray="5 3"
					/>
				{/if}
				<image
					href={`/models/ruler-${activeTemplate}.png`}
					x={focus.x - 45}
					y={focus.y - 45}
					width="90"
					height="90"
					opacity="0.35"
					preserveAspectRatio="xMidYMid meet"
					transform={`rotate(${focusShip.heading} ${focus.x} ${focus.y})`}
				>
					<title>{`${activeTemplate} template (presentation only)`}</title>
				</image>
			{/if}
			{#if showRangeOverlay}
				<!-- Fixed-distance printed ruler guides. Drawing them is geometry,
				     not a decision about whether a target is in range. -->
				{#each [100, 200, 300] as r, i}
					<circle
						cx={focus.x}
						cy={focus.y}
						r={r}
						fill="none"
						stroke="#ffd166"
						stroke-opacity="0.55"
						stroke-width="1.5"
						stroke-dasharray="6 5"
					/>
					<text x={focus.x + 6} y={focus.y - r + 13} font-size="12" fill="#ffd166" opacity="0.85">
						R{i + 1}
					</text>
				{/each}
				<image
					href="/models/ruler-range13.png"
					x={focus.x - 55}
					y={focus.y - 14}
					width="110"
					height="28"
					opacity="0.3"
					preserveAspectRatio="xMidYMid meet"
					transform={`rotate(${focusShip.heading} ${focus.x} ${focus.y})`}
				>
					<title>Range 1–3 ruler (presentation only)</title>
				</image>
			{/if}
		</g>
	{/if}
	</g>

	<foreignObject x={board.width - 150} y="8" width="142" height="28">
		<button
			xmlns="http://www.w3.org/1999/xhtml"
			type="button"
			class="rounded-sm border border-border-dark bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-white/40 hover:text-white"
			aria-label="Toggle printed play mat"
			title="Toggle between the starfield and Tatooine printed mats (presentation only)"
			onclick={() => (mat = mat === 'tatooine' ? 'starfield' : 'tatooine')}
		>
			▦ mat: {mat}
		</button>
	</foreignObject>
	</svg>

	<!-- Board controls live in HTML, outside the flipped SVG group, so they stay
	     upright and clickable regardless of pan/zoom/flip. -->
	<div class="absolute left-2 top-2 z-10 flex gap-1" data-testid="board-controls">
		<button
			type="button"
			class="rounded-sm border border-border-dark bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-white/40 hover:text-white"
			aria-label="Fullscreen board"
			title="Show the board fullscreen"
			onclick={fullscreenBoard}
		>
			⛶ full
		</button>
		<button
			type="button"
			class="rounded-sm border border-border-dark bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-white/40 hover:text-white"
			aria-label="Center on active ship"
			title="Center the board on the active ship"
			onclick={centerOnActive}
		>
			⌖ center
		</button>
		<button
			type="button"
			class="rounded-sm border border-border-dark bg-black/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-secondary hover:border-white/40 hover:text-white"
			aria-label="Flip board"
			aria-pressed={flipped}
			title="Flip the board 180° (presentation only)"
			onclick={() => (flipped = !flipped)}
		>
			↻ flip
		</button>
	</div>
</div>
