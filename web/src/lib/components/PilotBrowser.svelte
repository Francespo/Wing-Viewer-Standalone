<script lang="ts">
	import {
		customPilotShipLabel,
		filterCustomPilots,
		type CustomPilot,
		type PilotFilter
	} from '$lib/live';

	let {
		pilots,
		onadd,
		onassign = null,
		assignIndex = null,
		atMax = false,
		unavailable = () => null
	}: {
		pilots: CustomPilot[];
		onadd: (pilot: CustomPilot) => void;
		onassign?: ((pilot: CustomPilot) => void) | null;
		assignIndex?: number | null;
		atMax?: boolean;
		unavailable?: (pilot: CustomPilot) => string | null;
	} = $props();

	let name = $state('');
	let faction = $state('');
	let chassis = $state('');
	let minInitiative = $state('');
	let maxInitiative = $state('');
	let minPoints = $state('');
	let maxPoints = $state('');

	function bound(value: string): number | null {
		if (value.trim() === '') return null;
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	}

	const factions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const pilot of pilots) seen.set(pilot.faction, pilot.faction_label);
		return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
	});

	const chassisOptions = $derived.by(() => {
		const seen = new Map<string, string>();
		for (const pilot of pilots) seen.set(pilot.chassis, pilot.ship);
		return [...seen.entries()].sort(
			(a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])
		);
	});

	const filter = $derived<PilotFilter>({
		name,
		faction,
		chassis,
		minInitiative: bound(minInitiative),
		maxInitiative: bound(maxInitiative),
		minPoints: bound(minPoints),
		maxPoints: bound(maxPoints)
	});

	const matches = $derived(filterCustomPilots(pilots, filter));
	const assigning = $derived(onassign !== null && assignIndex !== null);
	const assignTarget = $derived(assigning ? (assignIndex ?? 0) + 1 : null);

	function clearFilters() {
		name = '';
		faction = '';
		chassis = '';
		minInitiative = '';
		maxInitiative = '';
		minPoints = '';
		maxPoints = '';
	}

	function choose(pilot: CustomPilot) {
		if (assigning && onassign) onassign(pilot);
		else onadd(pilot);
	}
</script>

<div class="mt-2 rounded-sm border border-border-dark/60 p-1.5" data-testid="pilot-browser">
	<div class="text-[10px] uppercase tracking-widest text-secondary/50">
		pilot browser · {pilots.length} available
		{#if assigning}
			· assigning ship {assignTarget}
		{/if}
	</div>
	<div class="mt-1 grid gap-1 sm:grid-cols-2">
		<label class="block text-[10px] text-secondary/70">
			<span>Name</span>
			<input
				type="search"
				bind:value={name}
				placeholder="pilot name"
				data-testid="pilot-filter-name"
				class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary placeholder:text-secondary/40 hover:border-white/40 focus:text-white"
			/>
		</label>
		<label class="block text-[10px] text-secondary/70">
			<span>Faction</span>
			<select
				bind:value={faction}
				data-testid="pilot-filter-faction"
				class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
			>
				<option value="">All factions</option>
				{#each factions as [id, label] (id)}
					<option value={id}>{label}</option>
				{/each}
			</select>
		</label>
		<label class="block text-[10px] text-secondary/70">
			<span>Chassis</span>
			<select
				bind:value={chassis}
				data-testid="pilot-filter-chassis"
				class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
			>
				<option value="">All chassis</option>
				{#each chassisOptions as [xws, ship] (xws)}
					<option value={xws}>{ship}</option>
				{/each}
			</select>
		</label>
		<div class="grid grid-cols-2 gap-1">
			<label class="block text-[10px] text-secondary/70">
				<span>Initiative min</span>
				<input
					type="number"
					min="0"
					max="9"
					value={minInitiative}
					oninput={(event) => (minInitiative = event.currentTarget.value)}
					data-testid="pilot-filter-initiative-min"
					class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
				/>
			</label>
			<label class="block text-[10px] text-secondary/70">
				<span>Initiative max</span>
				<input
					type="number"
					min="0"
					max="9"
					value={maxInitiative}
					oninput={(event) => (maxInitiative = event.currentTarget.value)}
					data-testid="pilot-filter-initiative-max"
					class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
				/>
			</label>
			<label class="block text-[10px] text-secondary/70">
				<span>Points min</span>
				<input
					type="number"
					min="0"
					max="50"
					value={minPoints}
					oninput={(event) => (minPoints = event.currentTarget.value)}
					data-testid="pilot-filter-points-min"
					class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
				/>
			</label>
			<label class="block text-[10px] text-secondary/70">
				<span>Points max</span>
				<input
					type="number"
					min="0"
					max="50"
					value={maxPoints}
					oninput={(event) => (maxPoints = event.currentTarget.value)}
					data-testid="pilot-filter-points-max"
					class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
				/>
			</label>
		</div>
	</div>
	<div class="mt-1 flex flex-wrap items-center justify-between gap-1">
		<span class="font-mono text-[10px] text-secondary/70" aria-live="polite" data-testid="pilot-filter-count">
			{matches.length} of {pilots.length} pilots match
		</span>
		<button
			type="button"
			class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] text-secondary hover:border-white/40 hover:text-white"
			data-testid="pilot-filter-clear"
			onclick={clearFilters}
		>
			clear filters
		</button>
	</div>
	{#if matches.length === 0}
		<p
			class="mt-1 rounded-sm border border-border-dark/60 px-1.5 py-1 text-[10px] text-secondary/60"
			data-testid="pilot-filter-empty"
		>
			No pilots match these filters.
		</p>
	{:else}
		<ul class="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1" data-testid="pilot-filter-results">
			{#each matches as pilot (pilot.id)}
				{@const reason = unavailable(pilot)}
				{@const full = !assigning && atMax}
				{@const disabled = reason !== null || full}
				<li>
					<button
						type="button"
						disabled={disabled}
						title={reason ?? (full ? 'this side already has the maximum 8 ships' : undefined)}
						onclick={() => choose(pilot)}
						class="flex w-full flex-wrap items-baseline justify-between gap-1 rounded-sm border border-border-dark/60 px-1.5 py-0.5 text-left text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						<span class="text-primary/90">{pilot.name}</span>
						<span class="text-secondary/60">
							{customPilotShipLabel(pilot)} · I{pilot.initiative} · {pilot.points} pts · loadout {pilot.loadout}
							{#if pilot.force_capacity > 0}· force {pilot.force_capacity}{/if}
						</span>
						<span class="text-resistance/80">
							{assigning ? `assign to ship ${assignTarget}` : 'add ship'}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
