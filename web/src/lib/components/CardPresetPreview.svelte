<script lang="ts">
	import {
		presetSides,
		previewMultiShips,
		previewShips,
		type CardPreset,
		type LoadoutCatalog,
		type PilotSelections,
		type PresetShip,
		type SlotSelections
	} from '$lib/live';

	let {
		preset,
		catalog = null,
		selections = {},
		multiSelections = null,
		pilotSelections = {},
		shipPoints = {},
		hotseat = false,
		customShips = null
	}: {
		preset: CardPreset;
		catalog?: LoadoutCatalog | null;
		selections?: Record<number, string>;
		multiSelections?: SlotSelections | null;
		pilotSelections?: PilotSelections;
		shipPoints?: Record<number, number>;
		hotseat?: boolean;
		customShips?: PresetShip[] | null;
	} = $props();
	const previewed = $derived(
		customShips ??
			(multiSelections && catalog
				? previewMultiShips(preset, catalog, multiSelections, hotseat, pilotSelections)
				: previewShips(preset, catalog, selections, hotseat))
	);
	const sides = $derived(presetSides({ ships: previewed }));
</script>

<div
	class="rounded-sm border border-border-dark bg-terminal-panel/60 p-3 text-left"
	data-testid="preset-preview"
>
	<div class="flex flex-wrap items-center gap-2">
		<span class="text-[11px] uppercase tracking-widest text-resistance">{preset.label}</span>
		<span class="rounded-sm border border-border-dark px-1.5 py-0.5 font-mono text-[10px] text-secondary/70">
			{preset.id}
		</span>
	</div>
	<p class="mt-1 text-[11px] text-secondary/70">{preset.description}</p>
	<div class="mt-3 grid gap-3 sm:grid-cols-2">
		{#each sides as side (side.player)}
			<div>
				<div class="text-[10px] uppercase tracking-widest text-secondary/50">
					Player {side.player + 1}
				</div>
				<ul class="mt-1 space-y-2">
					{#each side.ships as ship (ship.pilot)}
						<li data-testid="preset-ship">
							<div class="text-[11px] text-primary">
								{ship.pilot}
								{#if ship.index !== undefined && shipPoints[ship.index] !== undefined}
									<span class="ml-1 font-mono text-[10px] text-secondary/60">
										{shipPoints[ship.index]} pts
									</span>
								{/if}
							</div>
							<div class="text-[10px] text-secondary/60">
								{#if ship.faction}{ship.faction} · {/if}{ship.ship}
							</div>
							{#if ship.cards.length > 0}
								<ul class="mt-1 flex flex-wrap gap-1">
									{#each ship.cards as card (card.xws)}
										<li
											class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] text-secondary"
											title={`${card.name} (${card.xws}) · ${card.slot}`}
										>
											{card.name}
											<span class="text-secondary/50">· {card.slot}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<div class="mt-1 text-[10px] text-secondary/40">no cards</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>
</div>
