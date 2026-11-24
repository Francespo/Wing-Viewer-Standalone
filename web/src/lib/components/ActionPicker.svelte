<script lang="ts">
	import type { OptionView } from '$lib/live';

	let {
		options,
		busy = false,
		onselect
	}: { options: OptionView[]; busy?: boolean; onselect: (id: string) => void } = $props();
</script>

<div class="flex flex-wrap gap-1.5">
	{#each options as option (option.id)}
		<button
			type="button"
			disabled={busy}
			class={`rounded-sm border px-2.5 py-1.5 text-[12px] transition-colors disabled:cursor-wait disabled:opacity-50 ${
				option.decline
					? 'border-white/10 text-secondary/70 hover:border-white/25'
					: 'border-border-dark text-primary/90 hover:border-white/40 hover:bg-white/[0.08]'
			}`}
			onclick={() => onselect(option.id)}
		>
			{option.label}
			{#if option.action}
				<span class="ml-1.5 text-[9px] uppercase tracking-wide text-secondary/50">{option.action}</span>
			{/if}
		</button>
	{/each}
</div>
