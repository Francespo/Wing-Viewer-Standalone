<script lang="ts">
	import type { PlacementView } from '$lib/live';

	let {
		placements,
		busy = false,
		onselect
	}: {
		placements: PlacementView[];
		busy?: boolean;
		onselect: (id: string) => void;
	} = $props();

	// One index per ship, in the engine's order. The compound id is built here
	// from indices only; no position, overlap or zone rule is evaluated in TS.
	let picked = $state<number[]>([]);
	$effect(() => {
		placements;
		picked = placements.map(() => 0);
	});

	function key(placement: PlacementView, index: number): string {
		const pose = placement.candidates[index] ?? placement.default;
		return `${pose.x},${pose.y},${pose.heading_tenths ?? pose.heading * 10}`;
	}

	function usedElsewhere(ship: number, index: number): boolean {
		const k = key(placements[ship], index);
		return picked.some((choice, other) => other !== ship && key(placements[other], choice) === k);
	}

	function confirmAll() {
		if (busy || picked.length !== placements.length) return;
		onselect(`batch:${picked.map((index) => `pose:${index}`).join('|')}`);
	}
</script>

<div data-testid="batch-ship-pose-picker" class="space-y-2">
	<p class="text-[10px] text-secondary/60">
		Pick a legal position for each ship, then confirm them all at once.
	</p>
	{#each placements as placement, ship (placement.ship)}
		<label class="flex items-center justify-between gap-2 text-[11px] text-primary/90">
			<span class="font-mono text-secondary/70">ship {placement.ship}</span>
			<select
				bind:value={picked[ship]}
				disabled={busy}
				class="min-w-0 flex-1 rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-1 font-mono text-[10px] text-primary hover:border-white/40"
			>
				{#each placement.candidates as pose, index (index)}
					<option value={index} disabled={usedElsewhere(ship, index)}>
						({pose.x} mm, {pose.y} mm) · {pose.heading}°
					</option>
				{/each}
			</select>
		</label>
	{/each}
	<div class="flex items-center gap-2">
		<button
			type="button"
			disabled={busy}
			class="rounded-sm border border-republic/40 bg-republic/10 px-2 py-1 text-[11px] text-republic hover:bg-republic/20 disabled:cursor-wait disabled:opacity-50"
			onclick={confirmAll}
		>
			Confirm placements
		</button>
		<span class="text-[10px] text-secondary/50">one answer, one action</span>
	</div>
</div>
