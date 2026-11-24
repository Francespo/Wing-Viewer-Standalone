<script lang="ts">
	import type { DieFace } from '$lib/replay';

	let { face, side = 'attack' }: { face: DieFace; side?: 'attack' | 'defence' } = $props();

	const src = $derived.by(() => {
		if (side === 'defence') {
			if (face === 'evade') return '/models/die-face-evade.png';
			if (face === 'focus') return '/models/die-face-focus-green.png';
			return '/models/die-face-blank-green.png';
		}
		if (face === 'crit') return '/models/die-face-crit.png';
		if (face === 'hit') return '/models/die-face-hit.png';
		if (face === 'focus') return '/models/die-face-focus.png';
		return '/models/die-face-blank-red.png';
	});
</script>

<img
	{src}
	alt={`dice result: ${face}`}
	title={`${side} die: ${face}`}
	class="h-5 w-4 shrink-0 object-contain drop-shadow-sm"
/>
