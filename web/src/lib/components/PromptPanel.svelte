<script lang="ts">
	import { decisionOwner, type Question, type QuestionKind } from '$lib/live';
	import ActionPicker from './ActionPicker.svelte';
	import BatchShipPosePicker from './BatchShipPosePicker.svelte';
	import DamagePicker from './DamagePicker.svelte';
	import DialPicker from './DialPicker.svelte';
	import DiceSpend from './DiceSpend.svelte';
	import EffectPicker from './EffectPicker.svelte';
	import ObstacleSetupPicker from './ObstacleSetupPicker.svelte';
	import OptionalPicker from './OptionalPicker.svelte';
	import SetupPosePicker from './SetupPosePicker.svelte';
	import TargetPicker from './TargetPicker.svelte';
	import { optionalKeyChoice } from '$lib/optional-fast';

	let {
		question,
		hotseat = false,
		playerName,
		busy = false,
		onselect
	}: {
		question: Question;
		hotseat?: boolean;
		playerName?: string;
		busy?: boolean;
		onselect: (id: string) => void;
	} = $props();

	/** Static, opt-in reading aid: one label per question kind. No rule evaluation,
	 *  no auto-advance, no remembered choice, no timeout. */
	const HINTS: Record<QuestionKind, string> = {
		dial: 'Set your maneuver dials, then confirm · Imposta i diali e conferma',
		action: 'Choose an action · Scegli un’azione',
		'damage-card': 'Choose a damage card · Scegli una carta danno',
		'lock-target': 'Choose a lock target · Scegli un bersaglio per il lock',
		'barrel-roll': 'Choose a barrel-roll direction · Scegli la direzione del barrel roll',
		attack: 'Choose an attack target · Scegli il bersaglio dell’attacco',
		'attack-dice': 'Spend attack dice · Spendi i dadi d’attacco',
		'defence-dice': 'Spend defence dice · Spendi i dadi di difesa',
		optional: 'Use or skip the effect · Usa o salta l’effetto',
		'choose-ship': 'Choose a ship · Scegli una nave',
		token: 'Choose a token · Scegli un token',
		'setup-pose': 'Place your ship · Posiziona la nave',
		'ship-pose': 'Choose a ship position · Scegli la posizione della nave',
		'free-ship-pose':
			'Choose a position, or rotate the ship to any heading · Scegli una posizione o ruota la nave di qualsiasi angolo',
		'batch-ship-pose':
			'Confirm every ship’s deployment · Conferma il posizionamento di tutte le navi',
		'obstacle-setup': 'Choose an obstacle type or place at random · Scegli il tipo di ostacolo o posiziona a caso',
		'effect-choice': 'Choose a printed effect · Scegli un effetto stampato',
		'reinforce': 'Choose a reinforce facing · Scegli la direzione del reinforce',
		'reload': 'Choose an ordnance to reload · Scegli un’arma da ricaricare',
		'jam-effect': 'Choose what the jam removes · Scegli cosa rimuove il jam',
		'choice': 'Choose one of the engine’s options · Scegli un’opzione del motore'
	};
	const hint = $derived(HINTS[question.kind]);

	function onKey(event: KeyboardEvent) {
		if (question.kind !== 'optional' || busy || event.repeat) return;
		const target = event.target as HTMLElement | null;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
		const id = optionalKeyChoice(question.options, event.key);
		if (id) {
			event.preventDefault();
			onselect(id);
		}
	}

	const owner = $derived(decisionOwner(question, hotseat, playerName));
</script>

<svelte:window onkeydown={onKey} />

<div class="border-b border-border-dark bg-terminal-panel px-3 py-3" data-testid="prompt">
	<div class="flex items-baseline justify-between gap-2">
		<span class="text-[10px] uppercase tracking-widest text-secondary/50">{owner}</span>
		<span class="font-mono text-[10px] text-secondary/50">
			R{question.frame.round} · {question.frame.phase}
		</span>
	</div>
	<p class="mt-1 text-[13px] leading-snug text-primary/90">{question.prompt}</p>
	<p class="mt-0.5 text-[10px] italic text-secondary/60" aria-live="polite">{hint}</p>
	{#if question.kind === 'dial' && question.dials_total !== undefined}
		<p
			class="mt-0.5 font-mono text-[10px] text-secondary/70"
			data-testid="dial-counter"
			title={`${question.dials_set ?? 0} of ${question.dials_total} dials set`}
		>
			Confirm dials: {question.dials_set ?? 0} of {question.dials_total} set
		</p>
	{/if}
	{#if question.target !== undefined}
		<p class="mt-0.5 text-[10px] text-secondary/60">target #{question.target}</p>
	{/if}
	<div class="mt-2.5">
		{#if question.kind === 'dial'}
			<DialPicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'action'}
			<ActionPicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'damage-card'}
			<DamagePicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'attack-dice' || question.kind === 'defence-dice'}
			<DiceSpend {question} options={question.options} {busy} {onselect} />
		{:else if question.kind === 'setup-pose' || question.kind === 'ship-pose' || question.kind === 'free-ship-pose'}
			<SetupPosePicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'batch-ship-pose' && question.placements}
			<BatchShipPosePicker placements={question.placements} {busy} {onselect} />
		{:else if question.kind === 'obstacle-setup'}
			<ObstacleSetupPicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'optional'}
			<OptionalPicker options={question.options} {busy} {onselect} />
		{:else if question.kind === 'effect-choice'}
			<EffectPicker options={question.options} {busy} {onselect} />
		{:else}
			<TargetPicker options={question.options} {busy} {onselect} />
		{/if}
	</div>
	{#if busy}
		<p class="mt-2 text-[10px] text-secondary/50">waiting for the engine…</p>
	{/if}
</div>
