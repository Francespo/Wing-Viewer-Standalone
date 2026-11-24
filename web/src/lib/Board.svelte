<script lang="ts">
	import type { Board as BoardModel, Frame, ReplayPlayer, ReplayShip } from '$lib/replay';
	import { TOKEN_ABBR, TOKEN_COLOR, TOKEN_ORDER } from '$lib/replay';
	import { obstacleSprite } from '$lib/obstacle-art';
	import {
		arcWedgePath,
		arrow,
		baseCorners,
		FACTION_COLOR,
		MARKER_COLOR,
		MARKER_FACING_VECTOR,
		polyPoints,
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
		onselect
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
	} = $props();

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

<svg
	class="h-full w-full"
	viewBox={`0 0 ${board.width} ${board.height}`}
	preserveAspectRatio="xMidYMid meet"
	role="img"
	aria-label="game board"
>
	<rect x="0" y="0" width={board.width} height={board.height} fill="#070707" stroke="#2a2a2a" />

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
			{#if art}
				<image
					href={art.src}
					x={c.x - o.radius}
					y={c.y - o.radius}
					width={o.radius * 2}
					height={o.radius * 2}
					preserveAspectRatio="xMidYMid meet"
					clip-path={`url(#obstacle-${oi})`}
				/>
			{/if}
			<polygon
				{points}
				fill={art ? 'transparent' : (o.kind === 'gas' ? '#14201f' : '#1c1c18')}
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
			<polygon points={pt} fill={color} fill-opacity="0.3" stroke={color} stroke-width="2" />

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

				<!-- tokens -->
				{#each tokens(s) as t, i}
					<g transform={`translate(${c.x + base * 0.68} ${c.y - base * 0.4 + i * 13})`}>
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
						{#if t.count > 1}
							<text x="7.5" y="3.4" font-size="8" fill="#bbb">{t.count}</text>
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
</svg>
