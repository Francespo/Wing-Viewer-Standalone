<script lang="ts">
	/**
	 * Read-only match scoreboard for the Match tab.
	 *
	 * Every value shown here is copied from data the viewer already holds:
	 * ship snapshots come from `frame.ships`, printed pilot/faction/initiative
	 * from the `ReplayShip` defs, owner identity from `meta.players`, and the
	 * per-player score lines from the engine's `frame.scores` / `meta.result`
	 * (already selected by `scoreboardRows`). Nothing computes a game rule —
	 * a section is simply omitted when the engine did not send its data.
	 */
	import type { Frame, ReplayPlayer, ReplayResult, ReplayShip } from '$lib/replay';
	import { TOKEN_ABBR, TOKEN_COLOR, TOKEN_ORDER } from '$lib/replay';
	import { FACTION_COLOR } from '$lib/board';
	import type { ScoreRow } from '$lib/view';
	import { playerColor, seatLabel, winnerName } from '$lib/view';

	let {
		ships,
		players = [],
		frame,
		scoreboard = [],
		result = null,
		atEnd = false
	}: {
		ships: ReplayShip[];
		players?: ReplayPlayer[];
		frame: Frame;
		/** Engine score lines, already selected by `scoreboardRows`. */
		scoreboard?: ScoreRow[];
		result?: ReplayResult | null;
		atEnd?: boolean;
	} = $props();

	const states = $derived(new Map(frame.ships.map((s) => [s.id, s])));
	const rows = $derived(
		ships.map((def) => ({
			def,
			state: states.get(def.id),
			player: def.owner === undefined ? undefined : players[def.owner]
		}))
	);

	/** Only show the token row when the engine actually sent tokens. */
	const anyTokens = $derived(
		rows.some((r) => r.state && TOKEN_ORDER.some((t) => (r.state!.tokens[t] ?? 0) > 0))
	);

	const winner = $derived(result && atEnd ? winnerName(players, result) : null);
	const scoreUnit = $derived(scoreboard[0]?.unit === 'bounty' ? 'bounty' : 'mission points');
</script>

<div class="flex flex-col gap-2 p-2" data-testid="match-scoreboard">
	{#if scoreboard.length}
		<section class="rounded-sm border border-border-dark bg-white/[0.02]">
			<div
				class="flex items-center justify-between gap-2 border-b border-border-dark px-2 py-1 text-[10px] uppercase tracking-widest text-secondary/60"
			>
				<span>score · {scoreUnit}</span>
				{#if winner}
					<span class="normal-case tracking-normal text-primary/80" title="engine result">{winner}</span>
				{/if}
			</div>
			<div class="flex flex-col gap-0.5 px-2 py-1.5">
				{#each scoreboard as row (row.index)}
					<div class="flex items-center gap-2">
						<span class="h-2 w-2 shrink-0 rounded-sm" style={`background:${row.color}`}></span>
						<span class="font-mono text-[10px] text-secondary/60">{row.label}</span>
						<span class="min-w-0 flex-1 truncate text-[11px] text-primary/90">{row.name}</span>
						<span class="text-[9px] uppercase text-secondary/45">{row.faction}</span>
						<span class="font-mono font-semibold text-primary" title={`${row.score} ${scoreUnit}`}>
							{row.score}
						</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="rounded-sm border border-border-dark">
		<div
			class="border-b border-border-dark bg-white/[0.02] px-2 py-1 text-[10px] uppercase tracking-widest text-secondary/60"
		>
			ships
		</div>
		<div class="flex flex-col">
			{#each rows as row (row.def.id)}
				{@const s = row.state}
				{@const color = row.player ? playerColor(row.player) : FACTION_COLOR[row.def.faction]}
				<div
					class="border-b border-border-dark/60 px-2 py-1.5 last:border-b-0"
					style={`opacity:${s && !s.alive ? 0.45 : 1}`}
				>
					<div class="flex items-center gap-1.5">
						<span class="h-2 w-2 shrink-0 rounded-sm" style={`background:${color}`}></span>
						{#if row.player}
							<span
								class="shrink-0 rounded-sm border px-1 font-mono text-[9px]"
								style={`color:${color}; border-color:${color}66`}
							>
								{seatLabel(row.player, row.def.owner ?? 0)}
							</span>
						{/if}
						<span class="min-w-0 flex-1 truncate text-[12px] text-primary/90">{row.def.name}</span>
						<span
							class="shrink-0 font-mono text-[10px] text-secondary/60"
							title={`initiative ${row.def.initiative}`}>I{row.def.initiative}</span
						>
						{#if s && !s.alive}
							<span class="rounded-sm bg-white/10 px-1 text-[9px] text-secondary">destroyed</span>
						{/if}
					</div>
					<div class="mt-0.5 truncate text-[9px] uppercase tracking-wide text-secondary/45">
						{row.def.faction} · {row.def.ship}{#if row.player} · {row.player.name}{/if}
					</div>
					{#if s}
						<div class="mt-1 flex flex-wrap items-center gap-2">
							<span class="font-mono text-[10px]" style={`color:${s.shields > 0 ? '#3ad1ff' : '#555'}`} title="shields">
								shield {s.shields}
							</span>
							<span class="font-mono text-[10px]" style={`color:${s.hull <= 1 ? '#ff5555' : '#ddd'}`} title="hull">
								hull {s.hull}
							</span>
							{#if s.damage > 0}
								<span class="rounded-sm bg-rebel/20 px-1 text-[9px] text-rebel" title="facedown damage">
									dmg {s.damage}
								</span>
							{/if}
							{#if s.crits}
								<span class="rounded-sm bg-rebel/30 px-1 text-[9px] text-rebel" title="faceup critical damage">
									crit {s.crits}
								</span>
							{/if}
							{#if s.bounty_tokens !== undefined}
								<span class="rounded-sm border border-yellow-500/40 px-1 text-[9px] text-yellow-400" title="bounty tokens">
									B{s.bounty_tokens}
								</span>
							{/if}
							{#if s.energy !== undefined}
								<span class="font-mono text-[9px] text-secondary/70" title="huge-ship energy">
									energy {s.energy}{row.def.energy_capacity !== undefined
										? `/${row.def.energy_capacity}`
										: ''}
								</span>
							{/if}
						</div>
						{#if anyTokens && TOKEN_ORDER.some((t) => (s.tokens[t] ?? 0) > 0)}
							<div class="mt-1 flex flex-wrap gap-1">
								{#each TOKEN_ORDER.filter((t) => (s.tokens[t] ?? 0) > 0) as t (t)}
									<span
										class="rounded-sm border px-1 py-0.5 text-[9px] font-bold"
										style={`color:${TOKEN_COLOR[t]}; border-color:${TOKEN_COLOR[t]}55`}
										title={t}
									>
										{TOKEN_ABBR[t]}{s.tokens[t]! > 1 ? s.tokens[t] : ''}
									</span>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{/each}
		</div>
	</section>
</div>
