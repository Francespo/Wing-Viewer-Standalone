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
			const key = option.group ?? 'Legal placements';
			const list = map.get(key) ?? [];
			list.push(option);
			map.set(key, list);
		}
		return [...map.entries()];
	});
</script>

<div data-testid="setup-pose-picker" class="space-y-2">
	<p class="text-[10px] text-secondary/60">
		Click a highlighted spot on the board, or open the coordinate list.
	</p>
	<!-- Board-first: the board markers are the primary control; the long list is
	     a fallback for keyboard users and is collapsed by default. -->
	<details class="rounded-sm border border-border-dark px-2 py-1">
		<summary class="cursor-pointer text-[10px] text-secondary hover:text-white">
			coordinate list · {options.length} legal placements
		</summary>
		{#each groups as [group, choices] (group)}
			<div class="mt-2">
				<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/50">{group}</div>
				<div class="scroll-thin grid max-h-40 grid-cols-2 gap-1 overflow-y-auto pr-1">
					{#each choices as option (option.id)}
						<button
							type="button"
							disabled={busy}
							title={`Legal placement ${option.label}`}
							class="rounded-sm border border-border-dark bg-white/[0.03] px-2 py-1 text-left font-mono text-[10px] text-primary/90 transition-colors hover:border-white/40 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
							onclick={() => onselect(option.id)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>
		{/each}
	</details>
</div>
