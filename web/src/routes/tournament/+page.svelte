<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ApiError,
		PLAY_FORMATS,
		getFormats,
		type FormatInfo
	} from '$lib/live';
	import {
		canStartRound,
		createTournament,
		getPairingGame,
		getTournament,
		nextRoundNumber,
		replaceTournamentPlayers,
		reportTournamentResult,
		roundComplete,
		roundRows,
		startTournamentRound,
		standingSummary,
		startPairingGame,
		tournamentCapabilityFromHash,
		tournamentIdFromSearch,
		tournamentOrganizerUrl,
		tournamentShareUrl,
		type PairingGameResponse,
		type StandingRow,
		type TournamentEvent,
		type TournamentPlayer,
		type TournamentSnapshot
	} from '$lib/tournament';

	let formats = $state<FormatInfo[]>([]);
	let eventName = $state('Friday Night Swiss');
	let formatChoice = $state('standard-50p');
	let event = $state<TournamentEvent | null>(null);
	let standings = $state<StandingRow[]>([]);
	let capability = $state('');
	let shareUrl = $state('');
	let playersDraft = $state<TournamentPlayer[]>([]);
	let draftName = $state('');
	let draftSquad = $state('');
	let resultChoices = $state<Record<string, 'a' | 'b' | 'draw'>>({});
	type SideChoice = '' | '0' | '1';
	let engineSides = $state<Record<string, { a: SideChoice; b: SideChoice }>>({});
	let engineGames = $state<Record<string, PairingGameResponse>>({});
	let busy = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);

	const formatChoices = $derived(
		formats.length > 0
			? formats.map((format) => ({ id: format.spec.id, label: format.spec.name }))
			: PLAY_FORMATS.map((format) => ({ id: format.id, label: format.label }))
	);
	const formatLabel = $derived.by(() => {
		const current = event;
		if (!current) return '';
		return formatChoices.find((choice) => choice.id === current.format)?.label ?? current.format;
	});
	const nextRound = $derived(event ? nextRoundNumber(event) : 1);
	const playersLocked = $derived((event?.rounds.length ?? 0) > 0);
	const organizer = $derived(capability.length > 0);

	function message(value: unknown): string {
		return value instanceof ApiError
			? value.message
			: value instanceof Error
				? value.message
				: String(value);
	}

	function applySnapshot(snapshot: TournamentSnapshot) {
		event = snapshot.event;
		standings = snapshot.standings;
		playersDraft = snapshot.event.players.map((player) => ({ ...player }));
		shareUrl = tournamentShareUrl(snapshot.event.id, window.location.href);
		resultChoices = {};
		engineSides = {};
	}

	async function boot() {
		try {
			formats = await getFormats();
			if (!formats.some((format) => format.spec.id === formatChoice)) {
				formatChoice = formats[0]?.spec.id ?? 'standard-50p';
			}
		} catch {
			// The static selector is a valid fallback; the server still validates
			// the format id on create.
		}
		const id = tournamentIdFromSearch(window.location.search);
		if (!id) return;
		const fromHash = tournamentCapabilityFromHash(window.location.hash);
		try {
			applySnapshot(await getTournament(id));
			capability = fromHash ?? '';
			if (fromHash) void discoverLinkedGames();
			if (fromHash) {
				window.history.replaceState(
					window.history.state,
					'',
					tournamentOrganizerUrl(id, fromHash, window.location.href)
				);
			}
		} catch (err) {
			error = message(err);
		}
	}

	onMount(() => {
		void boot();
	});

	async function createEvent() {
		if (!eventName.trim()) {
			error = 'event name must not be empty';
			return;
		}
		busy = true;
		error = null;
		try {
			const created = await createTournament(eventName.trim(), formatChoice);
			capability = created.capability;
			engineGames = {};
			applySnapshot({ event: created.event, standings: created.standings });
			playersDraft = [];
			window.history.replaceState(
				window.history.state,
				'',
				tournamentOrganizerUrl(created.id, created.capability, window.location.href)
			);
			shareUrl = tournamentShareUrl(created.id, window.location.href);
			notice = 'event created; add at least two players before starting round 1.';
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	function addPlayer() {
		const name = draftName.trim();
		if (!name) {
			error = 'player name must not be empty';
			return;
		}
		playersDraft = [
			...playersDraft,
			{ name, squad_id: draftSquad.trim() || null }
		];
		draftName = '';
		draftSquad = '';
		error = null;
	}

	function removePlayer(index: number) {
		playersDraft = playersDraft.filter((_, player) => player !== index);
	}

	function replacePlayer(index: number, field: 'name' | 'squad_id', value: string) {
		playersDraft = playersDraft.map((player, playerIndex) =>
			playerIndex === index
				? { ...player, [field]: field === 'squad_id' ? value.trim() || null : value }
				: player
		);
	}

	async function savePlayers() {
		if (!event || !capability) return;
		busy = true;
		error = null;
		try {
			applySnapshot(await replaceTournamentPlayers(event.id, capability, playersDraft));
			notice = 'player list saved.';
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	async function startRound() {
		if (!event || !capability) return;
		busy = true;
		error = null;
		try {
			const snapshot = await startTournamentRound(event.id, capability);
			applySnapshot(snapshot);
			notice = `round ${snapshot.event.rounds.length} started.`;
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	function resultKey(round: number, pairing: number): string {
		return `${round}:${pairing}`;
	}

	function engineGameKey(round: number, pairing: number): string {
		return resultKey(round, pairing);
	}

	function engineLink(round: number, pairing: number): PairingGameResponse | null {
		return engineGames[engineGameKey(round, pairing)] ?? null;
	}

	function sideChoice(round: number, pairing: number, side: 'a' | 'b'): SideChoice {
		return engineSides[resultKey(round, pairing)]?.[side] ?? '';
	}

	function chooseSide(
		round: number,
		pairing: number,
		side: 'a' | 'b',
		value: string
	) {
		if (value !== '' && value !== '0' && value !== '1') return;
		const key = resultKey(round, pairing);
		const current = engineSides[key] ?? { a: '', b: '' };
		engineSides = { ...engineSides, [key]: { ...current, [side]: value } };
	}

	function sidesReady(round: number, pairing: number): boolean {
		const sides = engineSides[resultKey(round, pairing)];
		return (
			(sides?.a === '0' || sides?.a === '1') &&
			(sides?.b === '0' || sides?.b === '1')
		);
	}

	function engineResultText(link: PairingGameResponse): string {
		if (!link.result) return link.status;
		if (link.result.winner === 0) return 'engine: player A wins';
		if (link.result.winner === 1) return 'engine: player B wins';
		return 'engine: draw';
	}

	function engineStatusText(round: number, pairing: number): string {
		const link = engineLink(round, pairing);
		return link ? engineResultText(link) : '';
	}

	async function discoverLinkedGames() {
		if (!event || !capability) return;
		const current = event.rounds[event.rounds.length - 1];
		if (!current) return;
		for (const [pairing, row] of current.pairings.entries()) {
			if (row.b === null || row.result !== null) continue;
			try {
				const linked = await getPairingGame(
					event.id,
					capability,
					current.number,
					pairing
				);
				engineGames = { ...engineGames, [engineGameKey(current.number, pairing)]: linked };
				if (linked.result) {
					event = linked.event;
					standings = linked.standings;
				}
			} catch (err) {
				if (!(err instanceof ApiError && err.status === 404)) continue;
			}
		}
	}

	async function startEngineGame(round: number, pairing: number) {
		if (!event || !capability) return;
		const sides = engineSides[resultKey(round, pairing)];
		if (
			!(sides?.a === '0' || sides?.a === '1') ||
			!(sides?.b === '0' || sides?.b === '1')
		) {
			error = 'choose side 0 or 1 for both players before starting the engine game.';
			return;
		}
		busy = true;
		error = null;
		try {
			const linked = await startPairingGame(
				event.id,
				capability,
				round,
				pairing,
				Number(sides.a),
				Number(sides.b),
				7
			);
			applySnapshot(linked);
			engineGames = {
				...engineGames,
				[engineGameKey(round, pairing)]: linked
			};
			notice = `engine game started for table ${pairing + 1}.`;
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	async function refreshEngineGame(round: number, pairing: number) {
		if (!event || !capability) return;
		busy = true;
		error = null;
		try {
			const linked = await getPairingGame(event.id, capability, round, pairing);
			applySnapshot(linked);
			engineGames = {
				...engineGames,
				[engineGameKey(round, pairing)]: linked
			};
			notice = linked.result
				? 'engine result recorded in the standings.'
				: `engine game is still ${linked.status}.`;
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	function chooseResult(round: number, pairing: number, value: string) {
		if (value !== 'a' && value !== 'b' && value !== 'draw') return;
		resultChoices = { ...resultChoices, [resultKey(round, pairing)]: value };
	}

	async function submitResult(round: number, pairing: number) {
		if (!event || !capability) return;
		const choice = resultChoices[resultKey(round, pairing)];
		if (!choice) {
			error = 'choose a winner or a draw before reporting.';
			return;
		}
		busy = true;
		error = null;
		try {
			applySnapshot(
				await reportTournamentResult(event.id, capability, round, pairing, choice)
			);
			notice = `round ${round}, table ${pairing + 1} reported.`;
		} catch (err) {
			error = message(err);
		} finally {
			busy = false;
		}
	}

	async function copyShareUrl() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			notice = 'public event link copied.';
		} catch {
			notice = 'could not copy; select the link text instead.';
		}
	}
</script>

<div class="min-h-screen bg-terminal-bg text-primary">
	<header class="flex flex-wrap items-center gap-3 border-b border-border-dark px-4 py-2">
		<div class="flex items-baseline gap-2">
			<span class="text-sm font-semibold tracking-wide">WING-ENGINE</span>
			<span class="text-[10px] uppercase tracking-widest text-secondary/60">tournament</span>
		</div>
		<nav class="ml-auto flex items-center gap-2 text-[11px]">
			{#if event}
				<a class="text-secondary hover:text-white" href="/tournament">new event</a>
			{/if}
			<a class="text-secondary hover:text-white" href="/play">play</a>
			<a class="text-secondary hover:text-white" href="/">replays</a>
		</nav>
	</header>

	<main class="mx-auto flex max-w-6xl flex-col gap-4 p-4">
		{#if error}
			<div
				class="rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-sm text-rebel"
				data-testid="tournament-error"
			>
				{error}
			</div>
		{/if}
		{#if notice}
			<div
				class="rounded-sm border border-resistance/40 bg-resistance/10 p-3 text-sm text-resistance"
				data-testid="tournament-notice"
			>
				{notice}
			</div>
		{/if}

		{#if !event}
			<section class="rounded-sm border border-border-dark bg-terminal-panel p-4">
				<h1 class="text-lg text-primary">New Swiss event</h1>
				<p class="mt-1 text-[11px] text-secondary/70">
					Create an event, add players and saved-squad ids, then start one round at a
					time. Results are entered manually; the engine does not own a tournament game
					yet.
				</p>
				<div class="mt-4 flex flex-wrap items-end gap-3">
					<label class="flex min-w-64 flex-col gap-1 text-[10px] uppercase tracking-widest text-secondary/60">
						event name
						<input
							bind:value={eventName}
							class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 text-[12px] normal-case tracking-normal text-primary"
							placeholder="Friday Night Swiss"
						/>
					</label>
					<label class="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-secondary/60">
						format
						<select
							bind:value={formatChoice}
							class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 text-[12px] normal-case tracking-normal text-primary"
						>
							{#each formatChoices as choice (choice.id)}
								<option value={choice.id}>{choice.label}</option>
							{/each}
						</select>
					</label>
					<button
						type="button"
						onclick={createEvent}
						disabled={busy}
						class="rounded-sm border border-border-dark px-3 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
					>
						{busy ? 'creating…' : 'create event'}
					</button>
				</div>
			</section>
		{:else}
			<section class="rounded-sm border border-border-dark bg-terminal-panel p-4">
				<div class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 class="text-lg text-primary">{event.name}</h1>
						<p class="mt-1 text-[11px] text-secondary/70">
							{formatLabel} · <span class="font-mono">{event.id}</span> · {event.players.length}
							players · {event.rounds.length} rounds
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						{#if organizer}
							<span class="rounded-sm border border-resistance/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-resistance">
								organizer
							</span>
						{:else}
							<span class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-secondary/60">
								read only
							</span>
						{/if}
					</div>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<input
						readonly
						value={shareUrl}
						data-testid="tournament-share-url"
						class="min-w-0 flex-1 rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 font-mono text-[10px] text-secondary"
					/>
					<button
						type="button"
						onclick={copyShareUrl}
						class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white"
					>
						copy public link
					</button>
				</div>
				{#if organizer}
					<p class="mt-2 text-[10px] text-secondary/50">
						The organizer capability is in this page's fragment. Keep this URL private;
						the public link above is read-only.
					</p>
				{:else}
					<p class="mt-2 text-[10px] text-secondary/50">
						This is a shared read-only link. Open the organizer URL (with
						<span class="font-mono">#cap=…</span>) to start rounds or report results.
					</p>
				{/if}
			</section>

			<section class="rounded-sm border border-border-dark bg-terminal-panel p-4">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 class="text-[11px] uppercase tracking-widest text-secondary/60">players</h2>
					{#if playersLocked}
						<span class="text-[10px] text-secondary/50">locked after round 1 starts</span>
					{/if}
				</div>
				{#if organizer && !playersLocked}
					<div class="mt-3 flex flex-col gap-2">
						{#each playersDraft as player, index (index)}
							<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
								<input
									value={player.name}
									oninput={(change) =>
										replacePlayer(index, 'name', change.currentTarget.value)}
									placeholder="player name"
									class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 text-[12px]"
								/>
								<input
									value={player.squad_id ?? ''}
									oninput={(change) =>
										replacePlayer(index, 'squad_id', change.currentTarget.value)}
									placeholder="optional saved-squad id (16 hex)"
									class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 font-mono text-[11px]"
								/>
								<button
									type="button"
									onclick={() => removePlayer(index)}
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-rebel/60 hover:text-rebel"
								>
									remove
								</button>
							</div>
						{/each}
						<div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
							<input
								bind:value={draftName}
								placeholder="add player"
								class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 text-[12px]"
							/>
							<input
								bind:value={draftSquad}
								placeholder="saved-squad id (optional)"
								class="rounded-sm border border-border-dark bg-terminal-bg px-2 py-1 font-mono text-[11px]"
							/>
							<button
								type="button"
								onclick={addPlayer}
								class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white"
							>
								add
							</button>
						</div>
						<div>
							<button
								type="button"
								onclick={savePlayers}
								disabled={busy || playersDraft.length < 2}
								class="rounded-sm border border-border-dark px-3 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
							>
								{busy ? 'saving…' : 'save players'}
							</button>
						</div>
					</div>
				{:else}
					<ul class="mt-3 flex flex-col gap-1 text-[12px]">
						{#each event.players as player, index (index)}
							<li class="flex items-center gap-2">
								<span class="text-secondary/50">{index + 1}.</span>
								<span>{player.name}</span>
								{#if player.squad_id}
									<span class="font-mono text-[10px] text-secondary/50">
										squad {player.squad_id}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="rounded-sm border border-border-dark bg-terminal-panel p-4">
				<h2 class="text-[11px] uppercase tracking-widest text-secondary/60">rounds</h2>
				{#if event.rounds.length === 0}
					<p class="mt-2 text-[11px] text-secondary/60">
						No round has started. Add at least two players, then start round 1.
					</p>
				{/if}
				<div class="mt-3 flex flex-col gap-3">
					{#each event.rounds as round (round.number)}
						<div class="rounded-sm border border-border-dark bg-terminal-bg p-3">
							<div class="flex items-center justify-between gap-2">
								<h3 class="text-[12px] text-primary">round {round.number}</h3>
								{#if roundComplete(round)}
									<span class="text-[10px] uppercase tracking-widest text-resistance">complete</span>
								{:else}
									<span class="text-[10px] uppercase tracking-widest text-secondary/50">in progress</span>
								{/if}
							</div>
							<div class="mt-2 flex flex-col gap-2">
								{#each roundRows(event, round) as row (row.table)}
									<div class="grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
										<span class="font-mono text-[10px] text-secondary/50">table {row.table}</span>
										<span class="text-[12px]">
											{row.left}
											{#if row.byline}
												<span class="text-secondary/50">— bye</span>
											{:else}
												<span class="text-secondary/50">vs</span>
												{row.right}
											{/if}
										</span>
										{#if row.reported}
											<span class="text-[11px] text-secondary">{row.result}</span>
										{:else if organizer}
											<div class="flex flex-col gap-2">
												{#if engineLink(round.number, row.index)}
													<div class="flex flex-wrap items-center gap-2 text-[10px]">
														<a
															href={`/play?id=${engineLink(round.number, row.index)?.game}`}
															class="rounded-sm border border-resistance/40 px-1.5 py-0.5 text-resistance hover:border-resistance"
														>
															open engine game
														</a>
														<span class="text-secondary/70">
															{engineStatusText(round.number, row.index)}
														</span>
														<button
															type="button"
															disabled={busy}
															onclick={() => refreshEngineGame(round.number, row.index)}
															class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
														>
															refresh result
														</button>
													</div>
												{:else if !row.byline}
													<div class="flex flex-wrap items-center gap-1.5 text-[10px]">
														<span class="text-secondary/70">{row.left}</span>
														<select
															value={sideChoice(round.number, row.index, 'a')}
															onchange={(change) =>
																chooseSide(round.number, row.index, 'a', change.currentTarget.value)}
															class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[10px] text-secondary"
														>
															<option value="">choose side</option>
															<option value="0">side 0</option>
															<option value="1">side 1</option>
														</select>
														<span class="text-secondary/50">vs</span>
														<span class="text-secondary/70">{row.right}</span>
														<select
															value={sideChoice(round.number, row.index, 'b')}
															onchange={(change) =>
																chooseSide(round.number, row.index, 'b', change.currentTarget.value)}
															class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[10px] text-secondary"
														>
															<option value="">choose side</option>
															<option value="0">side 0</option>
															<option value="1">side 1</option>
														</select>
														<button
															type="button"
															disabled={busy || !sidesReady(round.number, row.index)}
															onclick={() => startEngineGame(round.number, row.index)}
															class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
														>
															start engine game
														</button>
													</div>
												{/if}
												<div class="flex items-center gap-2">
													<select
														value={resultChoices[resultKey(round.number, row.index)] ?? ''}
														onchange={(change) =>
															chooseResult(round.number, row.index, change.currentTarget.value)}
														class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[10px] text-secondary"
													>
														<option value="">result</option>
														<option value="a">{row.left} wins</option>
														<option value="b">{row.right} wins</option>
														<option value="draw">draw</option>
													</select>
													<button
														type="button"
														disabled={busy}
														onclick={() => submitResult(round.number, row.index)}
														class="rounded-sm border border-border-dark px-2 py-0.5 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
													>
														report
													</button>
												</div>
											</div>
										{:else}
											<span class="text-[11px] text-secondary/50">not reported</span>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				{#if organizer}
					<div class="mt-3 flex flex-wrap items-center gap-3">
						<button
							type="button"
							onclick={startRound}
							disabled={busy || !canStartRound(event)}
							class="rounded-sm border border-border-dark px-3 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
						>
							{busy ? 'starting…' : `start round ${nextRound}`}
						</button>
						{#if !canStartRound(event)}
							{#if event.players.length < 2}
								<span class="text-[10px] text-secondary/50">
									add and save at least two players first.
								</span>
							{:else if event.rounds.length > 0}
								<span class="text-[10px] text-secondary/50">
									report all results before the next round.
								</span>
							{/if}
						{/if}
					</div>
				{/if}
			</section>

			<section class="rounded-sm border border-border-dark bg-terminal-panel p-4">
				<h2 class="text-[11px] uppercase tracking-widest text-secondary/60">standings</h2>
				<p class="mt-1 text-[10px] text-secondary/50">
					points, wins, opponent points; head-to-head only when exactly two players are tied.
				</p>
				<div class="mt-3 overflow-x-auto">
					<table class="w-full text-left text-[11px]">
						<thead class="text-[10px] uppercase tracking-widest text-secondary/50">
							<tr>
								<th class="py-1 pr-3">#</th>
								<th class="py-1 pr-3">player</th>
								<th class="py-1 pr-3">record</th>
								<th class="py-1 pr-3">points</th>
								<th class="py-1 pr-3">opp</th>
								<th class="py-1 pr-3">byes</th>
							</tr>
						</thead>
						<tbody>
							{#each standings as row (row.player)}
								<tr class="border-t border-border-dark/60">
									<td class="py-1 pr-3 font-mono text-secondary/60">{row.rank}</td>
									<td class="py-1 pr-3">
										{row.name}
										{#if row.squad_id}
											<span class="ml-2 font-mono text-[9px] text-secondary/40">
												{row.squad_id}
											</span>
										{/if}
									</td>
									<td class="py-1 pr-3 text-secondary">{standingSummary(row)}</td>
									<td class="py-1 pr-3 font-mono">{row.points}</td>
									<td class="py-1 pr-3 font-mono text-secondary">{row.opponent_points}</td>
									<td class="py-1 pr-3 font-mono text-secondary">{row.byes}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if standings.length === 0}
					<p class="mt-2 text-[11px] text-secondary/50">Add players to see standings.</p>
				{/if}
			</section>
		{/if}
	</main>
</div>
