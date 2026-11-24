<script lang="ts">
	import type { DieFace, FrameEvent, Tone } from '$lib/replay';
	import { TOKEN_ABBR, TOKEN_COLOR } from '$lib/replay';
	import DiceFace from './DiceFace.svelte';

	export interface LogItem {
		frame: number;
		round: number;
		phase: string;
		event: FrameEvent;
	}

	let {
		items,
		current,
		onjump
	}: { items: LogItem[]; current: number; onjump: (frame: number) => void } = $props();

	const TONE_COLOR: Record<Tone, string> = {
		system: '#666666',
		move: '#9a9a9a',
		action: '#3ad1ff',
		attack: '#ff8c00',
		damage: '#ff4444',
		token: '#bbbbbb',
		score: '#e6d690',
		ability: '#a78bfa',
		destroy: '#ff2d2d'
	};

	const TONE_GLYPH: Record<Tone, string> = {
		system: '·',
		move: '➜',
		action: '◆',
		attack: '✦',
		damage: '✖',
		token: '◉',
		score: '★',
		ability: '❖',
		destroy: '☠'
	};

	// Rows carry their own "is this the first line of a new round/phase" flag.
	// Computing it here beats tracking state inside the template.
	const rows = $derived.by(() => {
		let last = '';
		return items.map((item, i) => {
			const label = `R${item.round} · ${item.phase}`;
			const showGroup = label !== last;
			last = label;
			return { ...item, i, label, showGroup };
		});
	});

	let listEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		void current;
		const el = listEl;
		if (!el) return;
		requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight;
		});
	});
</script>

<div class="scroll-thin h-full overflow-y-auto pr-2" bind:this={listEl}>
	{#each rows as row (row.i)}
		{#if row.showGroup}
			<div
				class="sticky top-0 z-10 mt-3 mb-1 bg-terminal-bg/95 py-1 text-[11px] uppercase tracking-widest text-secondary/70"
			>
				{row.label}
			</div>
		{/if}
		<button
			type="button"
			class="mb-0.5 flex w-full items-start gap-2 rounded-sm border-l-2 px-2 py-1 text-left transition-colors hover:bg-white/5"
			style={`border-color:${TONE_COLOR[row.event.tone]}; opacity:${row.frame === current ? 1 : 0.72}`}
			onclick={() => onjump(row.frame)}
		>
			<span
				class="mt-0.5 w-3 shrink-0 text-center text-[11px]"
				style={`color:${TONE_COLOR[row.event.tone]}`}
			>
				{TONE_GLYPH[row.event.tone]}
			</span>
			<span class="min-w-0 flex-1 text-[12.5px] leading-snug text-primary/90">
				{row.event.text}

				{#if row.event.dice}
					<span class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
						{#if row.event.dice.attack}
							<span class="flex items-center gap-1">
								<span class="text-[9px] uppercase tracking-wider text-secondary/60">atk</span>
								{#each row.event.dice.attack as f, i (i)}
									<DiceFace face={f} side="attack" />
								{/each}
							</span>
						{/if}
						{#if row.event.dice.defence}
							<span class="flex items-center gap-1">
								<span class="text-[9px] uppercase tracking-wider text-secondary/60">def</span>
								{#each row.event.dice.defence as f, i (i)}
									<DiceFace face={f} side="defence" />
								{/each}
							</span>
						{/if}
					</span>
				{/if}

				{#if row.event.tokens}
					<span class="mt-1 flex flex-wrap gap-1">
						{#each Object.entries(row.event.tokens) as [kind, delta], i (i)}
							{#if delta}
								<span
									class="inline-flex items-center gap-1 rounded-sm border border-border-dark px-1 py-0.5 text-[10px]"
									style={`color:${TOKEN_COLOR[kind as keyof typeof TOKEN_COLOR]}; border-color:${TOKEN_COLOR[kind as keyof typeof TOKEN_COLOR]}44`}
									title={kind}
								>
									<img src={`/models/icon-${kind}.png`} alt={kind} class="h-3.5 w-3.5 rounded-[2px]" />
									<span class="font-mono" style={`color:${delta > 0 ? '#9ae6b4' : '#fc8181'}`}
										>{delta > 0 ? '+' : ''}{delta}</span
									>
								</span>
							{/if}
						{/each}
					</span>
				{/if}
			</span>
			<span class="shrink-0 self-center font-mono text-[9px] text-secondary/40" title="frame">
				{row.frame}
			</span>
		</button>
	{/each}
</div>
