<script lang="ts">
	import Controls from '$lib/components/Controls.svelte';
	import GameScreen from '$lib/components/GameScreen.svelte';
	import { DEFAULT_REPLAY_FIXTURE, REPLAY_FIXTURES } from '$lib/fixtures';
	import { loadReplay, validateReplay, type Frame, type Replay } from '$lib/replay';

	let replay = $state<Replay | null>(null);
	let error: string | null = $state(null);
	let index = $state(0);
	let playing = $state(false);
	let speed = $state(700);
	// A deep link may open a committed fixture directly: `/?format=aces-high`
	// and, for a screenshot/debug position, `&frame=465`. Without a query the
	// default stays Standard frame 0.
	const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
	const initialFixture =
		REPLAY_FIXTURES.find((f) => f.format === params.get('format'))?.url ?? DEFAULT_REPLAY_FIXTURE;
	const requestedFrame = Number(params.get('frame') ?? 0);
	/** The fixture button that is active; null after a load-file pick. */
	let fixture = $state<string | null>(initialFixture);

	const frames = $derived<Frame[]>(replay ? replay.frames : []);

	function go(n: number) {
		if (!replay) return;
		index = Math.max(0, Math.min(n, replay.frames.length - 1));
	}
	function next() {
		go(index + 1);
	}
	function prev() {
		go(index - 1);
	}
	function first() {
		go(0);
	}
	function last() {
		if (replay) go(replay.frames.length - 1);
	}
	function toggle() {
		playing = !playing;
	}

	/** Open one committed fixture. Standard is the default; Aces High and the
	 *  two Epic formats are the same viewer with extra data fields, not a
	 *  second code path (D-078). */
	async function open(url: string, start = 0) {
		playing = false;
		try {
			replay = await loadReplay(url);
			index = Math.max(0, Math.min(start, replay.frames.length - 1));
			fixture = url;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}

	open(initialFixture, Number.isInteger(requestedFrame) ? requestedFrame : 0);

	$effect(() => {
		if (!playing) return;
		if (index >= frames.length - 1) {
			playing = false;
			return;
		}
		const t = setTimeout(() => go(index + 1), speed);
		return () => clearTimeout(t);
	});

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			// The picker is the second door into the board, so it validates too.
			replay = validateReplay(JSON.parse(text));
			index = 0;
			fixture = null;
			playing = false;
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			next();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prev();
		} else if (e.key === 'Home') {
			e.preventDefault();
			first();
		} else if (e.key === 'End') {
			e.preventDefault();
			last();
		} else if (e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}}
/>

{#if error && !replay}
	<div class="m-4 rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-sm text-rebel">
		{error}
	</div>
{:else if !replay}
	<div class="flex h-screen items-center justify-center bg-terminal-bg text-sm text-secondary">
		loading…
	</div>
{:else}
	<GameScreen
		board={replay.board}
		ships={replay.ships}
		players={replay.meta.players}
		frames={replay.frames}
		{index}
		format={replay.meta.format}
		seed={replay.meta.seed}
		result={replay.meta.result ?? null}
		kind="replay"
		{error}
		onjump={go}
	>
		{#snippet headerExtra()}
			<div class="flex items-center gap-1">
				{#each REPLAY_FIXTURES as f (f.url)}
					<button
						type="button"
						class="rounded-sm border px-2 py-1 text-[11px] transition-colors"
						class:border-white={fixture === f.url}
						class:text-white={fixture === f.url}
						class:border-border-dark={fixture !== f.url}
						class:text-secondary={fixture !== f.url}
						title={f.label}
						onclick={() => open(f.url)}
					>
						{f.short}
					</button>
				{/each}
				<label
					class="cursor-pointer rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
				>
					load replay
					<input class="hidden" type="file" accept="application/json,.json" onchange={onFile} />
				</label>
			</div>
		{/snippet}

		{#snippet controls()}
			<Controls
				{index}
				total={frames.length}
				{playing}
				onfirst={first}
				onprev={prev}
				onnext={next}
				onlast={last}
				onseek={go}
				ontoggle={toggle}
			/>
			<div class="mt-2 flex items-center justify-between text-[10px] text-secondary/50">
				<span>← → step · Home/End · Space play</span>
				<label class="flex items-center gap-1">
					speed
					<input
						type="range"
						min="60"
						max="1200"
						step="60"
						value={1200 - speed + 60}
						class="h-1 w-20 appearance-none rounded bg-white/15"
						oninput={(e) => {
							speed = 1260 - Number((e.currentTarget as HTMLInputElement).value);
						}}
					/>
				</label>
			</div>
		{/snippet}
	</GameScreen>
{/if}
