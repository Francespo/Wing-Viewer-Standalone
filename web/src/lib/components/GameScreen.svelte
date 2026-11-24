<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Board as BoardModel, Frame, ReplayPlayer, ReplayResult, ReplayShip } from '$lib/replay';
	import Board from './Board.svelte';
	import EventLog, { type LogItem } from './EventLog.svelte';
	import MatchScoreboard from './MatchScoreboard.svelte';
	import Roster from './Roster.svelte';
	import ShipInspector from './ShipInspector.svelte';
	import TableTray from './TableTray.svelte';
	import { scoreboardRows, winnerName, formatLabel } from '$lib/view';

	let {
		board,
		ships,
		players,
		frames,
		index,
		format,
		seed,
		kind,
		error = null,
		result = null,
		prompt,
		controls,
		headerExtra,
		asideLabel = 'transcript',
		selectable = [],
		targets = [],
		onselect,
		optionalShip = null,
		onoptional,
		setupOptions = [],
		onselectpose,
		onrotatepose,
		onjump
	}: {
		board: BoardModel;
		ships: ReplayShip[];
		players: ReplayPlayer[];
		frames: Frame[];
		index: number;
		format: string;
		seed: number;
		kind: 'replay' | 'live';
		error?: string | null;
		/** The replay's final result. Live passes its own result panel instead. */
		result?: ReplayResult | null;
		/** Live only: the current engine question. */
		prompt?: Snippet;
		controls?: Snippet;
		headerExtra?: Snippet;
		asideLabel?: string;
		selectable?: number[];
		targets?: number[];
		onselect?: (id: number) => void;
		/** Ship with a pending optional card decision (v1 fast path). */
		optionalShip?: number | null;
		onoptional?: (choice: 'use' | 'skip') => void;
		/** Engine-produced legal setup poses, drawn as clickable board markers. */
		setupOptions?: import('$lib/live').OptionView[];
		onselectpose?: (id: string) => void;
		/** Return true when a rotation answered a live deployment question. */
		onrotatepose?: (id: number, deltaDeg: number) => boolean;
		/** Replay stepping. Live leaves it undefined: the prompt must stay current. */
		onjump?: (frame: number) => void;
	} = $props();

	const frame = $derived(frames[Math.min(index, Math.max(0, frames.length - 1))] ?? null);
	const atEnd = $derived(index >= frames.length - 1);
	const scoreboard = $derived(scoreboardRows(players, frame, result, atEnd));
	const finalWinner = $derived(winnerName(players, result));
	/** ROAD winner, from the engine's own player-order roll line in the log. */
	const roadWinner = $derived.by(() => {
		for (const item of transcript) {
			const m = /^(.+?) win(s)? the player-order roll/.exec(item.event.text);
			if (m) return m[1] as string;
		}
		return null;
	});
	/** Initiative rail (4GG parity): ships in engine-declared initiative order. */
	const initiativeRail = $derived(
		[...ships].sort((a, b) => b.initiative - a.initiative || a.id - b.id)
	);
	/** Non-blocking alert: dismissible, resets when a new error arrives. */
	let dismissedError = $state<string | null>(null);
	const showError = $derived(error !== null && dismissedError !== error);

	const transcript = $derived.by<LogItem[]>(() => {
		const out: LogItem[] = [];
		for (let i = 0; i <= Math.min(index, frames.length - 1); i++) {
			const f = frames[i];
			for (const e of f.events) {
				out.push({ frame: f.n, round: f.round, phase: f.phase, event: e });
			}
		}
		return out;
	});

	const activeName = $derived.by(() => {
		if (!frame || frame.active === null) return null;
		return ships.find((s) => s.id === frame.active)?.name ?? null;
	});

	/** TTS Interactive state (presentation only, no rule evaluation). */
	let inspectedId = $state<number | null>(null);
	let activeTemplate = $state<string | null>(null);
	let showRangeOverlay = $state(false);
	let visualRotOffsets = $state<Record<number, number>>({});

	/** Side-panel tabs. The board always stays visible; only these panels swap. */
	const TABS = [
		{ id: 'squad', label: 'My squad' },
		{ id: 'match', label: 'Match' },
		{ id: 'log', label: 'Log' }
	] as const;
	let activeTab = $state<(typeof TABS)[number]['id']>('match');

	function rotateShip(id: number, delta: number) {
		// D-171: during ship deployment the rotate buttons answer the engine's
		// question with a `pose-free:` id. Outside that question they remain a
		// visual-only aid; no heading is invented or posted in TypeScript.
		if (onrotatepose?.(id, delta)) return;
		visualRotOffsets = { ...visualRotOffsets, [id]: (visualRotOffsets[id] ?? 0) + delta };
	}

	function resetRotShip(id: number) {
		const next = { ...visualRotOffsets };
		delete next[id];
		visualRotOffsets = next;
	}

	$effect(() => {
		if (!frame || typeof document === 'undefined') return;
		const active = frame.active !== null ? frame.active : 'none';
		document.title = `R${frame.round} ${frame.phase}${active !== 'none' ? ` · ${activeName ?? active}` : ''}`;
	});
</script>

<div class="flex h-screen flex-col bg-terminal-bg text-primary">
	<!-- header -->
	<header class="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-dark px-4 py-2">
		<div class="flex items-baseline gap-2">
			<span class="text-sm font-semibold tracking-wide">WING-ENGINE</span>
			<span class="text-[10px] uppercase tracking-widest text-secondary/60">{kind}</span>
		</div>

		<div class="flex items-center gap-3 text-[11px] text-secondary">
			<span class="rounded-sm border border-border-dark px-1.5 py-0.5" title={format}>{formatLabel(format)}</span>
			<span>seed <span class="font-mono text-primary/80">{seed}</span></span>
			{#if roadWinner}
				<span
					class="rounded-sm border border-republic/40 bg-republic/10 px-1.5 py-0.5 text-[10px] text-republic"
					title={`${roadWinner} won the round-1 player-order (ROAD) roll`}
					data-testid="road-marker"
				>
					ROAD: {roadWinner}
				</span>
			{/if}
			<span class="text-secondary/40">|</span>
			<span class="flex items-center gap-0.5" data-testid="initiative-rail" title="Initiative order">
				{#each initiativeRail as s (s.id)}
					<span
						class="rounded-sm border px-1 font-mono text-[10px] {frame?.active === s.id ? 'border-republic bg-republic/20 text-republic' : 'border-border-dark text-secondary/60'}"
						aria-label={`Activate ${s.name}`}
						title={`${s.name} · initiative ${s.initiative}`}
					>{s.initiative}</span>
				{/each}
			</span>
			{#if scoreboard.some((row) => row.unit === 'bounty')}
				<span class="text-[10px] uppercase tracking-widest text-secondary/45">bounty</span>
			{/if}
			{#each scoreboard as row (row.index)}
				<span
					class="flex items-center gap-1"
					title={`${row.label} · ${row.faction} · ${row.score} ${row.unit === 'bounty' ? 'bounty tokens' : 'mission points'}`}
				>
					<span class="inline-block h-2 w-2 rounded-sm" style={`background:${row.color}`}></span>
					{#if row.label && players[row.index]?.seat !== undefined}
						<span class="font-mono text-[10px] text-secondary/60">{row.label}</span>
					{/if}
					{row.name}
					<span class="text-secondary/50">{row.score}</span>
				</span>
			{/each}
		</div>

		<div class="ml-auto flex flex-wrap items-center gap-3">
			{#if frame}
				<span class="font-mono text-[11px] text-secondary">
					R{frame.round} · {frame.phase}
					{#if activeName}<span class="text-primary/80"> · {activeName}</span>{/if}
				</span>
			{/if}
			{@render headerExtra?.()}
		</div>
	</header>

	{#if showError && error}
		<div
			class="m-4 flex items-start gap-3 rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-sm text-rebel"
		>
			<span class="min-w-0 flex-1">{error}</span>
			<button
				type="button"
				class="shrink-0 rounded-sm border border-rebel/40 px-2 py-0.5 text-xs hover:border-rebel"
				aria-label="Dismiss"
				onclick={() => (dismissedError = error)}
			>
				dismiss
			</button>
		</div>
	{/if}
	{#if result && atEnd}
		<div
			class="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-border-dark bg-terminal-panel px-4 py-2 text-[11px]"
			data-testid="result"
		>
			<span class="text-sm text-primary">{result.winner === null ? 'No winner' : `${finalWinner} wins`}</span>
			<span class="uppercase tracking-widest text-secondary/50">
				final {scoreboard[0]?.unit === 'bounty' ? 'bounty' : 'mission points'}
			</span>
			{#each scoreboard as row (row.index)}
				<span class="flex items-center gap-1 text-secondary">
					<span class="h-2 w-2 rounded-sm" style={`background:${row.color}`}></span>
					<span class="font-mono text-[10px] text-secondary/60">{row.label}</span>
					{row.name}
					<span class="font-mono text-primary/90">{row.score}</span>
				</span>
			{/each}
		</div>
	{/if}
	{#if !frame}
		<div class="flex flex-1 items-center justify-center text-sm text-secondary">loading…</div>
	{:else}
		<main class="flex min-h-0 flex-1 flex-col lg:flex-row">
			<!-- table furniture + board: both always visible, independent of the tabs -->
			<section class="relative flex min-h-0 flex-1 flex-col gap-2 p-2.5 lg:flex-row">
				<div class="flex w-full shrink-0 flex-col gap-2 lg:w-60">
					<TableTray
						{activeTemplate}
						{showRangeOverlay}
						ontemplate={(id) => (activeTemplate = id)}
						onrange={(show) => (showRangeOverlay = show)}
					/>
				</div>
				<div
					class="flex min-h-[280px] min-w-0 flex-1 items-center justify-center rounded-sm border border-border-dark bg-terminal-panel p-2"
				>
					<Board
						{board}
						{ships}
						{players}
						{frame}
						{selectable}
						{targets}
						{onselect}
						{optionalShip}
						{onoptional}
						{setupOptions}
						{onselectpose}
						{inspectedId}
						oninspect={(id) => (inspectedId = id)}
						{activeTemplate}
						{showRangeOverlay}
						{visualRotOffsets}
					/>
				</div>

				{#if frame.moves?.length}
					<div
						class="pointer-events-none absolute left-[16rem] top-5 hidden rounded-sm border border-border-dark bg-black/80 px-2 py-1 text-[11px] text-secondary md:block"
					>
						{frame.moves.length} manoeuvre{frame.moves.length > 1 ? 's' : ''}
						{#if frame.moves.some((m: { partial: boolean }) => m.partial)}
							· <span class="text-resistance">partial</span>
						{/if}
					</div>
				{/if}
			</section>

			<!-- Tabbed side panels. My squad = roster, Match = scoreboard + inspector
			     + prompt, Log = transcript. The board above is never hidden. -->
			<aside
				class="flex w-full shrink-0 flex-col border-t border-border-dark lg:h-full lg:w-[440px] lg:border-l lg:border-t-0"
			>
				<div
					role="tablist"
					aria-label={asideLabel}
					class="flex shrink-0 border-b border-border-dark bg-terminal-panel"
				>
					{#each TABS as tab (tab.id)}
						<button
							type="button"
							role="tab"
							id={`tab-${tab.id}`}
							aria-controls={`panel-${tab.id}`}
							aria-selected={activeTab === tab.id}
							class="flex-1 border-b-2 px-2 py-2 text-[11px] uppercase tracking-wider transition-colors {activeTab ===
							tab.id
								? 'border-primary text-primary'
								: 'border-transparent text-secondary/60 hover:text-primary/80'}"
							onclick={() => (activeTab = tab.id)}
						>
							{tab.label}
						</button>
					{/each}
				</div>

				{#if activeTab === 'squad'}
					<div
						role="tabpanel"
						id="panel-squad"
						aria-labelledby="tab-squad"
						class="flex min-h-0 flex-1 flex-col"
					>
						<div
							class="shrink-0 border-b border-border-dark px-3 py-1.5 text-[10px] uppercase tracking-widest text-secondary/60"
						>
							roster
						</div>
						<div class="scroll-thin min-h-0 flex-1 overflow-y-auto">
							<Roster
								{ships}
								{players}
								{frame}
								{transcript}
								{inspectedId}
								{onselect}
								oninspect={(id) => (inspectedId = id)}
							/>
						</div>
					</div>
				{:else if activeTab === 'match'}
					<div
						role="tabpanel"
						id="panel-match"
						aria-labelledby="tab-match"
						class="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto"
					>
						<MatchScoreboard
							{ships}
							{players}
							{frame}
							{scoreboard}
							{result}
							{atEnd}
						/>
						<ShipInspector
							{ships}
							{frame}
							{inspectedId}
							{activeTemplate}
							{showRangeOverlay}
							rotOffset={visualRotOffsets[inspectedId ?? frame.active ?? ships[0]?.id ?? 0] ?? 0}
							onselectship={(id) => (inspectedId = id)}
							onrotate={rotateShip}
							onresetrot={resetRotShip}
							ontemplate={(id) => (activeTemplate = id)}
							onrange={(show) => (showRangeOverlay = show)}
						/>
						{#if prompt}
							{@render prompt()}
						{/if}
					</div>
				{:else}
					<div
						role="tabpanel"
						id="panel-log"
						aria-labelledby="tab-log"
						class="min-h-0 flex-1 overflow-y-auto px-3 py-2"
					>
						<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/60">
							{asideLabel}
						</div>
						<EventLog items={transcript} current={frame.n} onjump={onjump ?? (() => {})} />
					</div>
				{/if}

				{#if controls}
					<div class="shrink-0 border-t border-border-dark p-3">
						{@render controls()}
					</div>
				{/if}
			</aside>
		</main>
	{/if}
</div>
