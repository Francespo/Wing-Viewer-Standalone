<script lang="ts">
	import type { OptionView } from '$lib/live';
	import { optionalChoices } from '$lib/optional-fast';

	let {
		options,
		busy = false,
		onselect
	}: { options: OptionView[]; busy?: boolean; onselect: (id: string) => void } = $props();

	const choices = $derived(optionalChoices(options));
	const useLabel = $derived(options.find((option) => option.id === choices.use)?.label ?? 'Use');
	const skipLabel = $derived(options.find((option) => option.id === choices.skip)?.label ?? 'Skip');
</script>

<!-- Non-blocking, anchored to the prompt: no modal, the board stays visible. -->
<div class="flex flex-wrap items-center gap-2" data-testid="optional-fast">
	{#if choices.use}
		<button
			type="button"
			disabled={busy}
			class="rounded-sm border border-republic/60 bg-republic/10 px-3 py-2 text-[12px] text-primary transition-colors hover:border-republic disabled:cursor-wait disabled:opacity-50"
			onclick={() => onselect(choices.use!)}
		>
			{useLabel} <span class="ml-2 font-mono text-[10px] text-secondary/60">↵ Enter</span>
		</button>
	{/if}
	{#if choices.skip}
		<button
			type="button"
			disabled={busy}
			class="rounded-sm border border-border-dark px-3 py-2 text-[12px] text-secondary transition-colors hover:border-white/40 hover:text-white disabled:cursor-wait disabled:opacity-50"
			onclick={() => onselect(choices.skip!)}
		>
			{skipLabel} <span class="ml-2 font-mono text-[10px] text-secondary/60">Esc</span>
		</button>
	{/if}
	<span class="text-[10px] text-secondary/50">Enter usa · Esc salta · nessuna preferenza salvata</span>
</div>
