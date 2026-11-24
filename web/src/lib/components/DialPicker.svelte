<script lang="ts">
	import type { OptionView } from '$lib/live';

	let {
		options,
		busy = false,
		onselect
	}: { options: OptionView[]; busy?: boolean; onselect: (id: string) => void } = $props();

	const groups = $derived.by(() => {
		const map = new Map<string, OptionView[]>();
		for (const option of options) {
			const key = option.group ?? 'Maneuvers';
			const list = map.get(key) ?? [];
			list.push(option);
			map.set(key, list);
		}
		return [...map.entries()];
	});
</script>

<div class="space-y-2.5">
	{#each groups as [group, choices] (group)}
		<div>
			<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/50">{group}</div>
			<div class="flex flex-wrap gap-1.5">
				{#each choices as option (option.id)}
					<button
						type="button"
						disabled={busy}
						class="rounded-sm border border-border-dark bg-white/[0.03] px-2 py-1 text-[11px] text-primary/90 transition-colors hover:border-white/40 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
						onclick={() => onselect(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
