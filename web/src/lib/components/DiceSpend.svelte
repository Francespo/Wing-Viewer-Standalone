<script lang="ts">
	import type { DieFace } from '$lib/replay';
	import type { OptionView, Question } from '$lib/live';
	import DiceFace from './DiceFace.svelte';

	let {
		question,
		options,
		busy = false,
		onselect
	}: {
		question: Question;
		options: OptionView[];
		busy?: boolean;
		onselect: (id: string) => void;
	} = $props();

	const FACE_COLOR: Record<DieFace, string> = {
		hit: '#ff5555',
		crit: '#ff2d2d',
		focus: '#ffb347',
		evade: '#3ad1ff',
		blank: '#4a4a4a'
	};

	const attack = $derived(question.dice?.attack ?? []);
	const defence = $derived(question.dice?.defence ?? []);
	const faces = $derived(attack.length ? attack : defence);
	const isDefence = $derived(attack.length === 0 && defence.length > 0);
	const canPickDice = $derived(options.some((o) => /l1/.test(o.id)));

	/** Bit i = die i. Zero means "no choice": the engine keeps its legacy
	 *  blank-only reroll. Selection is player input; legality stays in Rust. */
	let chosenMask = $state(0);

	$effect(() => {
		void question;
		chosenMask = 0;
	});

	function toggle(i: number) {
		chosenMask ^= 1 << i;
	}

	function pick(option: OptionView) {
		const isLock = /l1/.test(option.id);
		// Only a lock reroll can use a chosen subset; focus/evade/Force spends
		// keep the engine-produced id untouched.
		const id = isLock && chosenMask !== 0 ? `${option.id}-d${chosenMask.toString(16)}` : option.id;
		onselect(id);
	}
</script>

<div class="mb-2 flex flex-col gap-2">
	{#if faces.length}
		<div class="flex items-center gap-3">
			<span class="text-[9px] uppercase tracking-widest text-secondary/50">
				{isDefence ? 'defence' : 'attack'} dice
			</span>
			<div class="flex flex-wrap items-center gap-1.5">
				{#each faces as face, i (i)}
					<button
						type="button"
						disabled={busy || !canPickDice}
						class="relative flex h-7 w-6 items-center justify-center rounded-sm border transition-colors"
						style={`border-color:${chosenMask & (1 << i) ? '#ffd166' : `${FACE_COLOR[face]}66`}; background:${chosenMask & (1 << i) ? 'rgba(255,209,102,.18)' : 'rgba(0,0,0,.4)'}; cursor:${canPickDice ? 'pointer' : 'default'}`}
						title={canPickDice
							? `Die ${i + 1}: ${face} — click to ${chosenMask & (1 << i) ? 'exclude from' : 'include in'} the target-lock reroll`
							: `Die ${i + 1}: ${face}`}
						onclick={() => toggle(i)}
					>
						<DiceFace {face} side={isDefence ? 'defence' : 'attack'} />
						{#if canPickDice}
							<span
								class="absolute -right-1 -top-1 rounded-[2px] border border-border-dark bg-black px-[2px] font-mono text-[8px] text-secondary"
							>
								{i + 1}
							</span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if canPickDice}
		<p class="font-mono text-[10px] text-secondary/70">
			{#if chosenMask === 0}
				click dice to choose which ones the target lock rerolls
			{:else}
				reroll dice {faces
					.map((_, i) => (chosenMask & (1 << i) ? i + 1 : null))
					.filter((n) => n !== null)
					.join(', ')}
				· click a die again to deselect
			{/if}
		</p>
	{/if}
</div>

<div class="flex flex-wrap gap-1.5">
	{#each options as option (option.id)}
		{@const isForce = option.id.endsWith('force')}
		{@const isLock = /l1/.test(option.id)}
		<button
			type="button"
			disabled={busy}
			data-force={isForce ? 'true' : undefined}
			class="rounded-sm border px-2 py-1 text-[11px] transition-colors hover:border-white/40 hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50 {isForce
				? 'border-fuchsia-400/60 text-fuchsia-200'
				: isLock
					? 'border-amber-400/60 text-amber-200'
					: 'border-border-dark text-primary/90'}"
			onclick={() => pick(option)}
		>
			{option.label}
			{#if isLock && chosenMask !== 0}
				<span class="ml-1 font-mono text-[9px] opacity-80">({chosenMask.toString(2).split('').reverse().filter((b) => b === '1').length})</span>
			{/if}
		</button>
	{/each}
</div>
