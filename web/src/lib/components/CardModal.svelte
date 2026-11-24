<!-- Enlarged pilot card viewer. Presentation only: the image is the same PNG
     the inspector already shows, and every stat/name comes straight from the
     ReplayShip contract. No ability, ship-ability or maneuver text is invented. -->
<script lang="ts">
	import type { ReplayShip } from '$lib/replay';
	import { rosterCards } from '$lib/replay';

	let {
		ship,
		imageUrl,
		imageAlt,
		onclose
	}: {
		ship: ReplayShip;
		imageUrl: string;
		imageAlt: string;
		onclose: () => void;
	} = $props();

	const cards = $derived(rosterCards(ship));

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
	<!-- Backdrop is a real button: click closes, no a11y/static-element warnings. -->
	<button
		type="button"
		class="absolute inset-0 h-full w-full cursor-default"
		aria-label="Close card details"
		onclick={onclose}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		aria-label={`${ship.name} card details`}
		class="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-md border border-border-dark bg-terminal-panel shadow-2xl"
	>
		<div class="flex items-center justify-between gap-2 border-b border-border-dark px-3 py-2">
			<div class="min-w-0">
				<div class="truncate text-sm font-semibold text-primary">{ship.name}</div>
				<div class="truncate text-[10px] uppercase tracking-wider text-secondary/60">
					{ship.ship} · {ship.faction}
				</div>
			</div>
			<button
				type="button"
				class="shrink-0 rounded-sm border border-border-dark px-2 py-0.5 font-mono text-sm text-secondary hover:border-white/50 hover:text-primary"
				aria-label="Close card details"
				onclick={onclose}
			>
				✕
			</button>
		</div>

		<div class="scroll-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:flex-row">
			<img
				src={imageUrl}
				alt={imageAlt}
				class="mx-auto h-auto w-56 max-w-full shrink-0 rounded-[5px] border border-white/20 object-contain shadow-lg sm:mx-0"
			/>
			<div class="min-w-0 flex-1">
				<div class="mb-1.5 text-[10px] uppercase tracking-widest text-secondary/60">stats</div>
				<div class="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
					<div class="rounded-sm border border-border-dark bg-black/40 px-2 py-1">
						<span class="text-secondary/60">hull</span>
						<span class="float-right text-primary">{ship.hull}</span>
					</div>
					<div class="rounded-sm border border-border-dark bg-black/40 px-2 py-1">
						<span class="text-secondary/60">shields</span>
						<span class="float-right text-sky-300">{ship.shields}</span>
					</div>
					<div class="rounded-sm border border-border-dark bg-black/40 px-2 py-1">
						<span class="text-secondary/60">agility</span>
						<span class="float-right text-primary">{ship.agility}</span>
					</div>
					<div class="rounded-sm border border-border-dark bg-black/40 px-2 py-1">
						<span class="text-secondary/60">initiative</span>
						<span class="float-right text-primary">{ship.initiative}</span>
					</div>
					<div class="col-span-2 rounded-sm border border-border-dark bg-black/40 px-2 py-1">
						<span class="text-secondary/60">arc</span>
						<span class="float-right text-primary">{ship.arc.replace(/_/g, ' ')}</span>
					</div>
				</div>

				{#if cards.length}
					<div class="mb-1.5 mt-3 text-[10px] uppercase tracking-widest text-secondary/60">
						equipped cards
					</div>
					<div class="flex flex-wrap gap-1">
						{#each cards as card (card.xws)}
							<span
								class="rounded-sm border border-border-dark bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-secondary/80"
								title={card.title}
							>
								{card.label}
							</span>
						{/each}
					</div>
					<!-- Printed text is the engine's, shown verbatim. A card with
					     no text gets no section, so nothing is invented here. -->
					{#each cards as card (card.xws)}
						{#if card.text !== undefined}
							<div class="mt-2 rounded-sm border border-border-dark bg-black/40 px-2 py-1.5">
								<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/60">
									{card.label} · text
								</div>
								<p class="whitespace-pre-line font-mono text-[11px] leading-relaxed text-secondary/90">
									{card.text}
								</p>
							</div>
						{/if}
					{/each}
				{/if}

				<!-- The printed dial is engine data: one string per manoeuvre,
				     wrapped as-is. No-card ships have no `maneuvers`, so this
				     section is absent and nothing is fabricated here. -->
				{#if ship.maneuvers?.length}
					<div class="mb-1.5 mt-3 text-[10px] uppercase tracking-widest text-secondary/60">
						maneuvers
					</div>
					<div class="flex flex-wrap gap-1">
						{#each ship.maneuvers as maneuver}
							<span
								class="rounded-sm border border-border-dark bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-secondary/80"
							>
								{maneuver}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
