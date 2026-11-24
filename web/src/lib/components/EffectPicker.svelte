<script lang="ts">
	import type { OptionView } from '$lib/live';

	let {
		options,
		busy = false,
		onselect
	}: { options: OptionView[]; busy?: boolean; onselect: (id: string) => void } = $props();
</script>

<div class="flex flex-col gap-1.5" data-testid="effect-picker">
	{#each options as option (option.id)}
		{@const unavailable = option.available === false}
		<button
			type="button"
			disabled={busy || unavailable}
			title={unavailable
				? 'The engine found no legal way to resolve this printed branch'
				: undefined}
			class={`flex items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5 text-left text-[12px] transition-colors ${
				unavailable
					? 'cursor-not-allowed border-white/5 text-secondary/35'
					: option.decline
						? 'border-white/10 text-secondary/70 hover:border-white/25'
						: 'border-border-dark text-primary/90 hover:border-white/40 hover:bg-white/[0.08]'
			} ${busy ? 'cursor-wait opacity-50' : ''}`}
			onclick={() => onselect(option.id)}
		>
			<span class="min-w-0 flex-1">{option.label}</span>
			{#if unavailable}
				<span class="rounded-sm border border-border-dark px-1 text-[9px] uppercase tracking-wide text-secondary/50">
					unavailable
				</span>
			{:else if option.decline}
				<span class="rounded-sm border border-border-dark px-1 text-[9px] uppercase tracking-wide text-secondary/50">
					decline
				</span>
			{/if}
		</button>
	{/each}
</div>
