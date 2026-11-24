<script lang="ts">
	/** Viewer-only reading aid. Highlights an existing element by scrolling and
	 *  focusing it: no pointer interception, no answer, no auto-advance. */
	import { untrack } from 'svelte';
	import type { GameResult, Question } from '$lib/live';
	import type { Frame } from '$lib/replay';
	import { TOUR_STEPS, stepIndexFor, type TourStep } from '$lib/tour';

	let {
		question = null,
		frame = null,
		result = null,
		initialStep = null,
		onclose
	}: {
		question?: Question | null;
		frame?: Frame | null;
		result?: GameResult | null;
		/** Precomputed by the parent when possible; otherwise derived here. */
		initialStep?: TourStep | null;
		onclose: () => void;
	} = $props();

	// Open on the step matching the state at mount; later state changes do not
	// yank the reader to another step (they only change its waiting flag).
	let index = $state(
		untrack(() =>
			initialStep
				? TOUR_STEPS.findIndex((candidate) => candidate.id === initialStep.id)
				: stepIndexFor(question, frame, result)
		)
	);
	const step: TourStep = $derived(TOUR_STEPS[index]);
	const active = $derived(step.match({ question, frame, result }));

	let highlighted: HTMLElement | null = null;
	$effect(() => {
		highlighted?.classList.remove('tour-ring');
		highlighted = null;
		const el = document.querySelector<HTMLElement>(`[data-testid="${step.anchor}"]`);
		if (!el) return;
		el.classList.add('tour-ring');
		el.scrollIntoView({ block: 'center', behavior: 'smooth' });
		el.focus();
		highlighted = el;
		return () => el.classList.remove('tour-ring');
	});

	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onclose();
		}
	}

	function move(delta: number) {
		index = Math.min(Math.max(index + delta, 0), TOUR_STEPS.length - 1);
	}
</script>

<svelte:window onkeydown={onKey} />

<div
	class="fixed bottom-4 right-4 z-50 w-80 rounded-sm border border-republic/50 bg-terminal-panel p-3 text-[11px] text-primary shadow-xl"
	role="dialog"
	aria-modal="true"
	aria-labelledby="tour-title"
	data-testid="tour-overlay"
>
	<div class="flex items-baseline justify-between gap-2">
		<h2 id="tour-title" class="text-[12px] font-semibold text-republic">{step.title}</h2>
		<span class="font-mono text-[10px] text-secondary/60">{index + 1} / {TOUR_STEPS.length}</span>
	</div>
	<p class="mt-2 leading-relaxed text-secondary/80">{step.body}</p>
	{#if !active}
		<p
			class="mt-2 rounded-sm border border-border-dark px-2 py-1 text-[10px] italic text-secondary/60"
			data-testid="tour-waiting"
		>
			waiting for this step to occur — skip for now · in attesa di questo passo — salta per ora
		</p>
	{/if}
	<div class="mt-3 flex items-center justify-between gap-2">
		<button
			type="button"
			class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-40"
			disabled={index === 0}
			onclick={() => move(-1)}
		>
			Back
		</button>
		<div class="flex gap-2">
			{#if index < TOUR_STEPS.length - 1}
				<button
					type="button"
					class="rounded-sm border border-republic/50 bg-republic/10 px-2 py-1 text-[11px] text-republic hover:border-republic"
					onclick={() => move(1)}
				>
					Next
				</button>
			{/if}
			<button
				type="button"
				class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
				onclick={onclose}
			>
				Done
			</button>
		</div>
	</div>
</div>

<style>
	:global(.tour-ring) {
		outline: 2px solid #facc15;
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
