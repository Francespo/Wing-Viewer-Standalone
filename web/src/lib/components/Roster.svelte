<script lang="ts">
	import type { Frame, ReplayPlayer, ReplayShip } from '$lib/replay';
	import { TOKEN_ABBR, TOKEN_COLOR, TOKEN_ORDER, rosterCards } from '$lib/replay';
	import { FACTION_COLOR } from '$lib/board';
	import { hugeTrackers, playerColor, seatLabel } from '$lib/view';
	import { DAMAGE_CARD_FILES } from '$lib/damage-cards';
	import type { LogItem } from './EventLog.svelte';

	let {
		ships,
		players = [],
		frame,
		transcript = [],
		inspectedId = null,
		onselect,
		oninspect
	}: {
		ships: ReplayShip[];
		players?: ReplayPlayer[];
		frame: Frame;
		/** Full log so the real face-up critical card can be named per ship. */
		transcript?: LogItem[];
		inspectedId?: number | null;
		onselect?: (id: number) => void;
		oninspect?: (id: number) => void;
	} = $props();

	/** Face-up critical card name per ship, from engine-produced transcript text. */
	const critNames = $derived.by(() => {
		const out = new Map<number, string[]>();
		for (const item of transcript) {
			const m = /suffers a critical: (.+?)\./.exec(item.event.text);
			if (!m) continue;
			const file = DAMAGE_CARD_FILES[m[1].trim()];
			if (!file) continue;
			const ids = item.event.ships ?? [];
			for (const id of ids) out.set(id, [...(out.get(id) ?? []), file]);
		}
		return out;
	});

	const trackers = $derived(hugeTrackers(ships, frame));
	const rows = $derived(
		ships.map((def) => ({
			def,
			state: frame.ships.find((s) => s.id === def.id),
			player: def.owner === undefined ? undefined : players[def.owner],
			cards: rosterCards(def),
			huge: trackers.find((tracker) => tracker.id === def.id)
		}))
	);
</script>

<div class="flex flex-col gap-1.5 p-2">
	{#each rows as row (row.def.id)}
		{@const s = row.state}
		{#if s}
			{@const color = row.player ? playerColor(row.player) : FACTION_COLOR[row.def.faction]}
			{@const active = frame.active === row.def.id}
			{@const inspected = inspectedId === row.def.id}
			{@const equipped = rosterCards(row.def)}
			<button
				type="button"
				class="rounded-sm border px-2 py-1.5 text-left transition-colors"
				style={`border-color:${active ? '#ffffff' : inspected ? color : '#262626'}; background:${active ? 'rgba(255,255,255,.07)' : inspected ? 'rgba(255,255,255,.03)' : 'transparent'}; opacity:${s.alive ? 1 : 0.4}`}
				onclick={() => {
					oninspect?.(row.def.id);
					onselect?.(row.def.id);
				}}
				title={`${row.player ? `${seatLabel(row.player, row.def.owner ?? 0)} · ${row.player.faction} · ` : ''}${row.def.ship} · initiative ${row.def.initiative}`}
			>
				<div class="flex items-center gap-1.5">
					<span class="h-2 w-2 shrink-0 rounded-sm" style={`background:${color}`}></span>
					{#if row.player}
						<!-- The seat badge is the primary identity in a free-for-all;
						     the faction remains a secondary label (D-078). -->
						<span
							class="shrink-0 rounded-sm border px-1 font-mono text-[9px]"
							style={`color:${color}; border-color:${color}66`}
						>
							{seatLabel(row.player, row.def.owner ?? 0)}
						</span>
					{/if}
					<span class="min-w-0 flex-1 truncate text-[12px] text-primary/90">{row.def.name}</span>
					<span class="shrink-0 font-mono text-[10px] text-secondary/60">I{row.def.initiative}</span>
				</div>
				{#if row.player}
					<div class="mt-0.5 truncate text-[9px] uppercase tracking-wide text-secondary/45">
						{row.player.faction} · {row.def.ship}
					</div>
				{/if}
				<div class="mt-1 flex items-center gap-2">
					<!-- Face-down damage + face-up crit mini cards (deck only, identities stay hidden per the projection). -->
					<span class="flex -space-x-1.5" title="damage deck">
						{#each Array.from({ length: Math.max(0, Math.min(6, (s.damage ?? 0) - (s.crits ?? 0))) }, (_, i) => i) as i (i)}
							<img
								src="/models/damage-back.png"
								alt={`facedown damage card ${i + 1}`}
								class="h-4 w-3 rounded-[2px] border border-white/20 object-cover"
								style="transform:rotate({(i - 2) * 4}deg)"
							/>
						{/each}
						{#each Array.from({ length: Math.min(6, s.crits ?? 0) }, (_, i) => i) as i (i)}
							{@const real = critNames.get(s.id)?.[i]}
							<img
								src={real ? `/models/damage/${real}.png` : '/models/redcrit.png'}
								alt={real ? `critical: ${real.replace(/([a-z])([A-Z])/g, '$1 $2')}` : `faceup crit card ${i + 1}`}
								title={real ? real.replace(/([a-z])([A-Z])/g, '$1 $2') : 'critical damage'}
								class="h-5 w-3.5 rounded-[2px] border border-rebel/60 object-cover"
								style="transform:rotate({(i - 2) * 4}deg)"
							/>
						{/each}
					</span>
					<span class="flex items-center gap-1" title="shields">
						<span class="h-2 w-2 rounded-full" style={`background:${s.shields > 0 ? '#3ad1ff' : 'transparent'}; border:1px solid #3ad1ff${s.shields > 0 ? '' : '55'}`}></span>
						<span class="font-mono text-[10px]" style={`color:${s.shields > 0 ? '#3ad1ff' : '#555'}`}>
							{s.shields}
						</span>
					</span>
					<span class="flex items-center gap-1" title="hull">
						<span class="h-2 w-2 rounded-sm" style={`background:${s.hull > 0 ? color : 'transparent'}; border:1px solid ${color}${s.hull > 0 ? '' : '55'}`}></span>
						<span class="font-mono text-[10px]" style={`color:${s.hull <= 1 ? '#ff5555' : '#ddd'}`}>
							{s.hull}
						</span>
					</span>
					{#if s.damage > 0}
						<span class="rounded-sm bg-rebel/20 px-1 text-[9px] text-rebel">dmg {s.damage}</span>
					{/if}
					{#if s.crits}
						<span class="rounded-sm bg-rebel/30 px-1 text-[9px] text-rebel">crit {s.crits}</span>
					{/if}
					{#if !s.alive}
						<span class="rounded-sm bg-white/10 px-1 text-[9px] text-secondary">destroyed</span>
					{/if}
				</div>
				{#if row.huge}
					<div
						class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-secondary/70"
						data-testid={`huge-tracker-${row.def.id}`}
					>
						<span
							class="rounded-sm border border-border-dark px-1 font-mono"
							title="huge ship base length"
						>
							{row.huge.baseLength} mm
						</span>
						<span title="current shields">S {row.huge.shields}</span>
						{#if row.huge.energy !== null}
							<span title="current energy / printed capacity">
								E {row.huge.energy}{row.huge.energyCapacity !== null
									? `/${row.huge.energyCapacity}`
									: ''}
							</span>
						{/if}
						{#if row.huge.energyRecurring !== null}
							<span title="printed recurring energy symbols">
								rec E{row.huge.energyRecurring}
							</span>
						{/if}
						{#if row.huge.shieldRecurring !== null}
							<span title="printed recurring shield symbols">
								rec S{row.huge.shieldRecurring}
							</span>
						{/if}
					</div>
				{/if}
				{#if row.cards.length > 0}
					<div class="mt-1 flex flex-wrap gap-1" data-testid="roster-cards">
						{#if equipped.length}
							<div class="flex flex-wrap gap-1" data-testid="upgrade-chips">
								{#each equipped as card (card.xws)}
									<span class="rounded-sm border border-border-dark bg-white/[0.03] px-1 py-0.5 text-[9px] text-secondary/80" title={card.title}>{card.label}</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				{#if TOKEN_ORDER.some((t) => (s.tokens[t] ?? 0) > 0)}
					<div class="mt-1 flex flex-wrap gap-1">
						{#each TOKEN_ORDER.filter((t) => (s.tokens[t] ?? 0) > 0) as t (t)}
							<span
								class="inline-flex items-center gap-0.5 rounded-sm border border-border-dark px-1 py-0.5 text-[9px] font-bold"
								style={`color:${TOKEN_COLOR[t]}; border-color:${TOKEN_COLOR[t]}55`}
								title={`${TOKEN_ABBR[t]} · ${t}`}
							>
								<img src={`/models/icon-${t}.png`} alt={t} class="h-3.5 w-3.5 rounded-[2px]" />
								{s.tokens[t]! > 1 ? s.tokens[t] : ''}
							</span>
						{/each}
					</div>
				{/if}
			</button>
		{/if}
	{/each}
</div>
