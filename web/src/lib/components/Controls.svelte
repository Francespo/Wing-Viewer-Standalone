<script lang="ts">
	let {
		index,
		total,
		playing,
		onfirst,
		onprev,
		onnext,
		onlast,
		onseek,
		ontoggle
	}: {
		index: number;
		total: number;
		playing: boolean;
		onfirst: () => void;
		onprev: () => void;
		onnext: () => void;
		onlast: () => void;
		onseek: (n: number) => void;
		ontoggle: () => void;
	} = $props();

	const btn =
		'flex h-8 min-w-8 items-center justify-center rounded-sm border border-border-dark px-2 text-sm text-primary/80 transition-colors hover:border-white/40 hover:text-white disabled:opacity-30 disabled:hover:border-border-dark';
</script>

<div class="flex items-center gap-2">
	<button class={btn} onclick={onfirst} disabled={index === 0} title="first frame (Home)">⏮</button>
	<button class={btn} onclick={onprev} disabled={index === 0} title="previous frame (←)">◀</button>
	<button class={btn} onclick={ontoggle} title="play / pause (Space)">
		{playing ? '⏸' : '▶'}
	</button>
	<button class={btn} onclick={onnext} disabled={index >= total - 1} title="next frame (→)">▶</button>
	<button class={btn} onclick={onlast} disabled={index >= total - 1} title="last frame (End)">⏭</button>

	<input
		class="mx-2 h-1 flex-1 cursor-pointer appearance-none rounded bg-white/15 accent-white"
		type="range"
		min="0"
		max={Math.max(0, total - 1)}
		value={index}
		oninput={(e) => onseek(Number((e.currentTarget as HTMLInputElement).value))}
		aria-label="frame"
	/>

	<span class="shrink-0 font-mono text-[11px] text-secondary">
		{index + 1}<span class="text-secondary/40">/{total}</span>
	</span>
</div>
