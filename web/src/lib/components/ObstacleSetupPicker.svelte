<script lang="ts">
	import type { OptionView } from '$lib/live';

	let {
		options,
		busy = false,
		onselect
	}: { options: OptionView[]; busy?: boolean; onselect: (id: string) => void } = $props();

	/** Groups and labels are engine-produced: the browser never names an
	 *  obstacle type or decides what "at random" means (D-172). */
	const groups = $derived.by(() => {
		const map = new Map<string, OptionView[]>();
		for (const option of options) {
			const key = option.group ?? 'Obstacle type';
			const list = map.get(key) ?? [];
			list.push(option);
			map.set(key, list);
		}
		return [...map.entries()];
	});
</script>

<div data-testid="obstacle-setup-picker" class="space-y-2">
	{#each groups as [group, choices] (group)}
		<div>
			<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/50">{group}</div>
			<div class="grid grid-cols-2 gap-1">
				{#each choices as option (option.id)}
					<button
						type="button"
						disabled={busy}
						title={option.label}
						class="rounded-sm border border-border-dark bg-white/[0.03] px-2 py-1 text-left font-mono text-[10px] text-primary/90 transition-colors hover:border-white/40 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
						onclick={() => onselect(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
