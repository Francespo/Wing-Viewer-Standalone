<!-- TTS Ship Inspector & Circular Align/Place Dial (m3tacron terminal styling).
     Shows the real TTS pilot card art (from JohnnyCheese/TTS_X-Wing2.0 / Goldenrod),
     hull/shield/force/token stacks with counts, and the circular TTS Align/Place Ship
     dial with 1° / 5° / 22.5° rotation buttons and template toggle. -->
<script lang="ts">
	import type { Frame, ReplayShip } from '$lib/replay';
	import { TOKEN_COLOR, TOKEN_ORDER } from '$lib/replay';
	import { FACTION_COLOR } from '$lib/board';
	import { resolveXws, shipSprite } from '$lib/ship-sprites';
	import CardModal from './CardModal.svelte';

	let {
		ships,
		frame,
		inspectedId = null,
		activeTemplate = null,
		showRangeOverlay = false,
		rotOffset = 0,
		onselectship,
		onrotate,
		onresetrot,
		ontemplate,
		onrange
	}: {
		ships: ReplayShip[];
		frame: Frame;
		inspectedId?: number | null;
		activeTemplate?: string | null;
		showRangeOverlay?: boolean;
		rotOffset?: number;
		onselectship?: (id: number) => void;
		onrotate?: (shipId: number, deltaDeg: number) => void;
		onresetrot?: (shipId: number) => void;
		ontemplate?: (id: string | null) => void;
		onrange?: (show: boolean) => void;
	} = $props();

	const focusId = $derived(inspectedId ?? frame.active ?? ships[0]?.id ?? null);
	const def = $derived(ships.find((s) => s.id === focusId) ?? ships[0] ?? null);
	const shipState = $derived(def ? frame.ships.find((s) => s.id === def.id) ?? null : null);

	/** Map pilot name + ship chassis to one of the 65 staged TTS pilot card PNGs. */
	const CARD_MAP: Record<string, string> = {
		'anakinskywalker|eta2actis': '/models/cards/anakinskywalker-eta2actis.png',
		'anakinskywalker|delta7aethersprite': '/models/cards/anakinskywalker.png',
		'anakinskywalker|btlbywing': '/models/cards/anakinskywalker-btlbywing.png',
		'obiwankenobi|eta2actis': '/models/cards/obiwankenobi-eta2actis.png',
		'obiwankenobi|delta7aethersprite': '/models/cards/obiwankenobi.png',
		'plokoon': '/models/cards/plokoon.png',
		'macewindu': '/models/cards/macewindu.png',
		'macewindudelta7baethersprite': '/models/cards/macewindu-delta7baethersprite.png',
		'ahsokatano': '/models/cards/ahsokatano.png',
		'killer': '/models/cards/killer.png',
		'aaylasecura': '/models/cards/aaylasecura.png',
		'shaakti': '/models/cards/shaakti.png',
		'yoda': '/models/cards/yoda.png',
		'wolffe': '/models/cards/wolffe.png',
		'jag': '/models/cards/jag.png',
		'sinker': '/models/cards/sinker.png',
		'oddball': '/models/cards/oddball-arc170starfighter.png',
		'104thbattalionpilot': '/models/cards/104thbattalionpilot.png',
		'squadsevenveteran': '/models/cards/squadsevenveteran.png',
		'contrail': '/models/cards/contrail.png',
		'klick': '/models/cards/klick.png',
		'stub': '/models/cards/stub.png',
		'knack': '/models/cards/knack.png',
		'hawk': '/models/cards/hawk.png',
		'warthog': '/models/cards/warthog.png',
		'hound': '/models/cards/hound.png',
		'boost': '/models/cards/boost.png',
		'slider': '/models/cards/slider.png',
		'axe': '/models/cards/axe.png',
		'swoop': '/models/cards/swoop.png',
		'tucker': '/models/cards/tucker.png',
		'lukeskywalker': '/models/cards/lukeskywalker.png',
		'wedgeantilles': '/models/cards/wedgeantilles.png',
		'redsquadronveteran': '/models/cards/redsquadronveteran.png',
		'bluesquadronescort': '/models/cards/bluesquadronescort.png',
		'goldsquadronveteran': '/models/cards/goldsquadronveteran.png',
		'graysquadronbomber': '/models/cards/graysquadronbomber.png',
		'hortonsalm': '/models/cards/hortonsalm.png',
		'dutchvander': '/models/cards/dutchvander.png',
		'norrawexley': '/models/cards/norrawexley-btla4ywing.png',
		'arvelcrynyd': '/models/cards/arvelcrynyd.png',
		'jakefarrell': '/models/cards/jakefarrell.png',
		'greensquadronpilot': '/models/cards/greensquadronpilot.png',
		'phoenixsquadronpilot': '/models/cards/phoenixsquadronpilot.png',
		'academypilot': '/models/cards/academypilot.png',
		'obsidiansquadronpilot': '/models/cards/obsidiansquadronpilot.png',
		'blacksquadronace': '/models/cards/blacksquadronace.png',
		'howlrunner': '/models/cards/howlrunner.png',
		'maulermithel': '/models/cards/maulermithel.png',
		'scourgeskutu': '/models/cards/scourgeskutu.png',
		'seynmarana': '/models/cards/seynmarana.png',
		'gideonhask': '/models/cards/gideonhask.png',
		'delmeeko': '/models/cards/delmeeko.png',
		'idenversio': '/models/cards/idenversio.png',
		'wampa': '/models/cards/wampa.png',
		'valenrudor': '/models/cards/valenrudor.png',
		'nightbeast': '/models/cards/nightbeast.png',
		'darthvader': '/models/cards/darthvader.png',
		'maarekstele': '/models/cards/maarekstele.png',
		'soontirfel': '/models/cards/soontirfel.png',
		'turrphennir': '/models/cards/turrphennir.png',
		'alphasquadronpilot': '/models/cards/alphasquadronpilot.png',
		'sabersquadronace': '/models/cards/sabersquadronace.png',
		'kyloren': '/models/cards/kyloren.png',
		'poedameron': '/models/cards/poedameron.png',
		'bobafett': '/models/cards/bobafett.png',
		'fennrau': '/models/cards/fennrau.png'
	};

	let showAnakinRef = $state(false);
	let showCardModal = $state(false);

	const cardUrl = $derived.by(() => {
		if (showAnakinRef) return '/models/cards/anakinskywalker-eta2actis.png';
		if (!def) return '/models/cards/anakinskywalker-eta2actis.png';
		const pSlug = def.name.toLowerCase().replace(/[^a-z0-9]/g, '');
		const xws = resolveXws(def.ship, def.ship) ?? '';
		if (CARD_MAP[`${pSlug}|${xws}`]) return CARD_MAP[`${pSlug}|${xws}`];
		if (CARD_MAP[pSlug]) return CARD_MAP[pSlug];
		for (const [k, v] of Object.entries(CARD_MAP)) {
			if (pSlug.startsWith(k.split('|')[0])) return v;
		}
		return '/models/cards/anakinskywalker-eta2actis.png';
	});

	const spriteInfo = $derived(def ? shipSprite(def.ship, def.name, def.ship) : null);
	const factionColor = $derived(def ? FACTION_COLOR[def.faction] : '#e6d690');
</script>

{#if def && shipState}
	<section
		aria-label="TTS ship inspector, pilot card and align/place dial"
		class="border-b border-border-dark bg-terminal-panel px-3 py-2.5"
		data-testid="ship-inspector"
	>
		<!-- Ship selector tabs + Anakin Eta-2 reference card toggle -->
		<div class="mb-2 flex flex-wrap items-center justify-between gap-1">
			<div class="flex flex-wrap items-center gap-1">
				{#each ships as s (s.id)}
					{@const selected = s.id === def.id && !showAnakinRef}
					<button
						type="button"
						class="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] transition-colors"
						style={`border-color:${selected ? FACTION_COLOR[s.faction] : '#262626'}; background:${selected ? 'rgba(255,255,255,0.08)' : 'transparent'}; color:${selected ? '#ffffff' : '#aaaaaa'}`}
						onclick={() => {
							showAnakinRef = false;
							onselectship?.(s.id);
						}}
					>
						I{s.initiative} · {s.name.split(' ')[0]}
					</button>
				{/each}
			</div>
			<button
				type="button"
				class="rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors"
				style={`border-color:${showAnakinRef ? '#e6d690' : '#262626'}; color:${showAnakinRef ? '#e6d690' : '#888888'}`}
				title="Inspect Anakin Skywalker (Eta-2 Actis) TTS reference card"
				onclick={() => (showAnakinRef = !showAnakinRef)}
			>
				Eta-2 Card
			</button>
		</div>

		<div class="grid grid-cols-[126px_1fr] gap-3">
			<!-- Left column: Real TTS Pilot Card (63.5 × 88 mm ratio) -->
			<div class="relative flex flex-col items-center">
				<button
					type="button"
					class="relative block overflow-hidden rounded-[5px] border bg-black shadow-md transition-opacity hover:opacity-90"
					style={`border-color:${showAnakinRef ? '#e6d690' : factionColor}88`}
					title="Open card details"
					aria-label={`Open card details for ${showAnakinRef ? 'Anakin Skywalker (Eta-2 Actis)' : def.name}`}
					onclick={() => (showCardModal = true)}
				>
					<img
						src={cardUrl}
						alt={showAnakinRef ? 'Anakin Skywalker (Eta-2 Actis) Pilot Card' : `${def.name} Pilot Card`}
						class="h-[174px] w-[125px] object-cover"
					/>
					<!-- TTS Points / Status badge at top of card (matches PilotCard.lua) -->
					<div
						class="absolute right-1 top-1 rounded-[2px] border border-black/60 bg-white/95 px-1 py-0.2 font-mono text-[9px] font-extrabold text-black shadow"
					>
						I{showAnakinRef ? 6 : def.initiative}
					</div>
				</button>
			</div>

			<!-- Right column: Ship stats, token stacks, and Circular TTS Align/Place Ship Dial -->
			<div class="flex min-w-0 flex-col justify-between">
				<div>
					<div class="flex items-center justify-between gap-1">
						<span class="truncate text-xs font-semibold text-primary">
							{showAnakinRef ? 'Anakin Skywalker' : def.name}
						</span>
						<span class="shrink-0 font-mono text-[10px] text-secondary/70">
							{Math.round((shipState.heading + rotOffset + 360) % 360)}°
						</span>
					</div>
					<div class="truncate text-[10px] uppercase tracking-wider text-secondary/60">
						{showAnakinRef ? 'Eta-2 Actis · Republic' : `${def.ship} · ${def.faction}`}
					</div>

					<!-- TTS Token & Resource Counters (Shield / Hull / Force / Active Tokens) -->
					<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
						<span
							class="inline-flex items-center gap-1 rounded-sm border border-border-dark bg-black/60 px-1.5 py-0.5 font-mono text-[10px]"
							title="Hull remaining"
						>
							<span class="h-2 w-2 rounded-[1px]" style={`background:${factionColor}`}></span>
							<span class="text-primary">{shipState.hull}/{def.hull}</span>
						</span>
						<span
							class="inline-flex items-center gap-1 rounded-sm border border-border-dark bg-black/60 px-1.5 py-0.5 font-mono text-[10px]"
							title="Shields remaining"
						>
							<img src="/models/icon-shield.png" alt="shield" class="h-3.5 w-3.5 object-contain" />
							<span class="text-sky-300">{shipState.shields}/{def.shields}</span>
						</span>
						<span
							class="inline-flex items-center gap-1 rounded-sm border border-border-dark bg-black/60 px-1.5 py-0.5 font-mono text-[10px]"
							title="Force charges"
						>
							<img src="/models/icon-force.png" alt="force" class="h-3.5 w-3.5 object-contain" />
							<span class="text-purple-300">{showAnakinRef ? 3 : (def.faction === 'republic' ? 3 : 1)}</span>
						</span>
						{#each TOKEN_ORDER.filter((t) => (shipState.tokens[t] ?? 0) > 0) as t (t)}
							<span
								class="inline-flex items-center gap-1 rounded-sm border px-1 py-0.5 font-mono text-[10px]"
								style={`border-color:${TOKEN_COLOR[t]}66; color:${TOKEN_COLOR[t]}`}
							>
								<img src={`/models/icon-${t}.png`} alt={t} class="h-3.5 w-3.5 object-contain" />
								{shipState.tokens[t]}
							</span>
						{/each}
					</div>
				</div>

				<!-- Circular TTS Align / Place Ship Dial (1° / 5° / 22.5° rotations + template/range) -->
				<div class="mt-2 rounded-sm border border-border-dark bg-black/70 p-2">
					<div class="mb-1.5 flex items-center justify-between">
						<span class="text-[9px] uppercase tracking-widest text-secondary/70">
							align / place ship dial
						</span>
						{#if rotOffset !== 0}
							<button
								type="button"
								class="font-mono text-[9px] text-amber-300 hover:underline"
								onclick={() => onresetrot?.(def.id)}
							>
								reset ({rotOffset > 0 ? `+${rotOffset}` : rotOffset}°)
							</button>
						{/if}
					</div>

					<div class="flex items-center gap-2.5">
						<!-- Circular TTS Align/Place Ship dial preview with compass ticks + top-down ship sprite -->
						<div
							class="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border-dark bg-[#07090d] shadow-inner"
						>
							<svg viewBox="0 0 56 56" class="pointer-events-none absolute inset-0 h-full w-full">
								<circle cx="28" cy="28" r="25" fill="none" stroke="#333333" stroke-width="1" stroke-dasharray="2 3" />
								<line x1="28" y1="2" x2="28" y2="7" stroke={factionColor} stroke-width="1.5" />
								<line x1="54" y1="28" x2="49" y2="28" stroke="#444444" stroke-width="1" />
								<line x1="28" y1="54" x2="28" y2="49" stroke="#444444" stroke-width="1" />
								<line x1="2" y1="28" x2="7" y2="28" stroke="#444444" stroke-width="1" />
							</svg>
							{#if spriteInfo}
								<img
									src={spriteInfo.src}
									alt={def.ship}
									class="relative z-10 h-10 w-10 object-contain drop-shadow-[0_0_2px_rgba(255,255,255,0.35)] transition-transform"
									style={`transform: rotate(${(shipState.heading + rotOffset) % 360}deg)`}
								/>
							{/if}
						</div>

						<!-- 1° / 5° / 22.5° rotation controls (left & right) -->
						<div class="grid flex-1 grid-cols-3 gap-1 font-mono text-[9.5px]">
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate -1°"
								onclick={() => onrotate?.(def.id, -1)}
							>
								↶ 1°
							</button>
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate -5°"
								onclick={() => onrotate?.(def.id, -5)}
							>
								↶ 5°
							</button>
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate -22.5°"
								onclick={() => onrotate?.(def.id, -22.5)}
							>
								↶ 22.5°
							</button>
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate +1°"
								onclick={() => onrotate?.(def.id, 1)}
							>
								1° ↷
							</button>
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate +5°"
								onclick={() => onrotate?.(def.id, 5)}
							>
								5° ↷
							</button>
							<button
								type="button"
								class="flex items-center justify-center gap-0.5 rounded-sm border border-border-dark bg-terminal-panel px-1 py-1 text-primary/90 hover:border-white/50"
								title="Rotate +22.5°"
								onclick={() => onrotate?.(def.id, 22.5)}
							>
								22.5° ↷
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

{#if def && showCardModal}
	<CardModal
		ship={def}
		imageUrl={cardUrl}
		imageAlt={showAnakinRef ? 'Anakin Skywalker (Eta-2 Actis) Pilot Card' : `${def.name} Pilot Card`}
		onclose={() => (showCardModal = false)}
	/>
{/if}
