<!-- TTS table furniture: real 3D maneuver templates (s1-s5, b1-b3, t1-t3),
     real 3D range rulers (range13, range15), 3D GlitterDice renders (attack/defence),
     and the TTS damage deck. Interactive: clicking a template or range ruler
     toggles its true-scale overlay on the active/inspected ship on the board. -->
<script lang="ts">
	let {
		activeTemplate = null,
		showRangeOverlay = false,
		ontemplate,
		onrange
	}: {
		activeTemplate?: string | null;
		showRangeOverlay?: boolean;
		ontemplate?: (id: string | null) => void;
		onrange?: (show: boolean) => void;
	} = $props();

	const TILE = [
		{ id: 's1', kind: 'straight', len: 40, label: 'S1' },
		{ id: 's2', kind: 'straight', len: 80, label: 'S2' },
		{ id: 's3', kind: 'straight', len: 120, label: 'S3' },
		{ id: 's4', kind: 'straight', len: 160, label: 'S4' },
		{ id: 's5', kind: 'straight', len: 200, label: 'S5' },
		{ id: 'b1', kind: 'bank', r: 80, label: 'B1' },
		{ id: 'b2', kind: 'bank', r: 130, label: 'B2' },
		{ id: 'b3', kind: 'bank', r: 180, label: 'B3' },
		{ id: 't1', kind: 'turn', r: 35, label: 'T1' },
		{ id: 't2', kind: 'turn', r: 62.5, label: 'T2' },
		{ id: 't3', kind: 'turn', r: 90, label: 'T3' }
	] as const;

	const ATK_FACES = ['hit', 'crit', 'focus', 'blank-red'] as const;
	const DEF_FACES = ['evade', 'focus-green', 'blank-green'] as const;
	let atkFaceIdx = $state(0);
	let defFaceIdx = $state(0);
</script>

<section
	aria-label="Table furniture: templates, rulers, dice"
	class="flex flex-col gap-2 text-[10px] uppercase tracking-widest text-secondary/70"
>
	<div class="rounded-sm border border-border-dark bg-terminal-panel">
		<div class="flex items-center justify-between border-b border-border-dark px-2 py-1">
			<span>manoeuvre templates</span>
			{#if activeTemplate}
				<button
					type="button"
					class="font-mono text-[9px] text-primary/80 hover:text-white"
					onclick={() => ontemplate?.(null)}
				>
					clear ({activeTemplate})
				</button>
			{/if}
		</div>
		<div class="grid grid-cols-6 gap-1 p-1.5">
			{#each TILE as t (t.id)}
				{@const selected = activeTemplate === t.id}
				<button
					type="button"
					class="group relative flex h-9 flex-col items-center justify-between rounded-sm border bg-black/70 p-0.5 transition-colors hover:border-white/50"
					style={`border-color:${selected ? '#ffffff' : '#262626'}`}
					aria-label={`template ${t.id}`}
					aria-pressed={selected}
					title={`Toggle TTS ${t.label} template overlay on active/inspected ship`}
					onclick={() => ontemplate?.(selected ? null : t.id)}
				>
					<img
						src={`/models/ruler-${t.id}.png`}
						alt={`template ${t.id}`}
						class="h-5 w-auto object-contain"
					/>
					<span class="font-mono text-[8.5px] font-bold text-primary/85">{t.label}</span>
				</button>
			{/each}
		</div>
	</div>

	<div class="rounded-sm border border-border-dark bg-terminal-panel">
		<div class="flex items-center justify-between border-b border-border-dark px-2 py-1">
			<span>range rulers</span>
			<button
				type="button"
				class="rounded-sm border px-1.5 py-0.5 font-mono text-[9px] transition-colors"
				style={`border-color:${showRangeOverlay ? '#ffffff' : '#333333'}; color:${showRangeOverlay ? '#ffffff' : '#aaaaaa'}`}
				aria-pressed={showRangeOverlay}
				onclick={() => onrange?.(!showRangeOverlay)}
			>
				{showRangeOverlay ? 'R1–R3 ON' : 'TOGGLE RULERS'}
			</button>
		</div>
		<div class="flex flex-col gap-1 p-1.5">
			<button
				type="button"
				class="flex flex-col gap-1 rounded-sm border border-border-dark/70 bg-black/50 p-1 hover:border-white/40"
				onclick={() => onrange?.(!showRangeOverlay)}
				title="Toggle Range 1–3 ruler overlay on active ship"
			>
				<img src="/models/ruler-range13.png" alt="range ruler R1-R3" class="h-3.5 w-full object-contain" />
				<img src="/models/ruler-range15.png" alt="range ruler R1-R5" class="h-3 w-full object-contain" />
			</button>
		</div>
	</div>

	<div class="rounded-sm border border-border-dark bg-terminal-panel">
		<div class="border-b border-border-dark px-2 py-1">3d dice & damage deck</div>
		<div class="flex items-center justify-between gap-2 p-2">
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="relative flex items-center gap-1 rounded-sm border border-border-dark bg-black/60 px-1.5 py-1 hover:border-rebel/70"
					aria-label="attack die"
					title="TTS 3D Red Attack Die (click to cycle face)"
					onclick={() => (atkFaceIdx = (atkFaceIdx + 1) % ATK_FACES.length)}
				>
					<img src="/models/die-3d-red.png" alt="3D attack die" class="h-7 w-7 object-contain" />
					<img
						src={`/models/die-face-${ATK_FACES[atkFaceIdx]}.png`}
						alt="attack die face"
						class="h-5 w-4 object-contain"
					/>
				</button>
				<button
					type="button"
					class="relative flex items-center gap-1 rounded-sm border border-border-dark bg-black/60 px-1.5 py-1 hover:border-emerald-500/70"
					aria-label="defence die"
					title="TTS 3D Green Defence Die (click to cycle face)"
					onclick={() => (defFaceIdx = (defFaceIdx + 1) % DEF_FACES.length)}
				>
					<img src="/models/die-3d-green.png" alt="3D defence die" class="h-7 w-7 object-contain" />
					<img
						src={`/models/die-face-${DEF_FACES[defFaceIdx]}.png`}
						alt="defence die face"
						class="h-5 w-4 object-contain"
					/>
				</button>
			</div>

			<div class="flex items-center gap-1.5" title="TTS X-Wing 2.5 Damage Deck">
				<img
					src="/models/damage-verse.png"
					alt="TTS damage deck"
					class="h-8 w-6 rounded-[2px] border border-white/25 object-cover shadow-sm"
				/>
				<img
					src="/models/icon-crit.png"
					alt="Critical hit token"
					class="h-5 w-5 object-contain"
				/>
			</div>
		</div>
	</div>
</section>
