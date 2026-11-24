/**
 * Opt-in, viewer-only onboarding tour (D-174 #1).
 *
 * A step is anchored to an existing `data-testid` and matched ONLY against
 * fields the engine already publishes in the live contract: `question.kind`,
 * `frame.phase`, `question.dials_total` and `result !== null`. This module
 * evaluates no rule, fabricates no question and posts no answer. If the
 * current state does not satisfy a step's match, the overlay shows
 * "waiting/skip" instead of inventing a prompt or a phase.
 */
import type { GameResult, Question } from './live';
import type { Frame } from './replay';

export interface TourContext {
	question: Question | null;
	frame: Frame | null;
	result: GameResult | null;
}

export interface TourStep {
	id: string;
	title: string;
	body: string;
	/** `data-testid` of an existing element; highlight is scroll/focus only. */
	anchor: string;
	match: (ctx: TourContext) => boolean;
}

/** Match any one engine question kind. No other question field is inspected. */
function kind(...kinds: Question['kind'][]) {
	return ({ question }: TourContext): boolean =>
		question !== null && kinds.includes(question.kind);
}

/** A quiet, question-free moment in a given phase. */
function idlePhase(phase: string) {
	return ({ question, frame, result }: TourContext): boolean =>
		question === null && result === null && frame?.phase === phase;
}

export const TOUR_STEPS: TourStep[] = [
	{
		id: 'welcome',
		title: 'Welcome · Benvenuto',
		body: 'This is the live viewer. The menu holds undo, replay and game info · Questo è il visualizzatore dal vivo: il menu contiene annulla, replay e info partita.',
		anchor: 'menu',
		match: idlePhase('setup')
	},
	{
		id: 'dials',
		title: 'Set your dials · Imposta i diali',
		body: 'The counter shows how many dials are set; confirm when it is complete · Il contatore mostra quanti diali sono impostati; conferma quando sono completi.',
		anchor: 'dial-counter',
		match: ({ question }) =>
			question !== null && question.kind === 'dial' && question.dials_total !== undefined
	},
	{
		id: 'deploy',
		title: 'Deployment · Schieramento',
		body: 'Pick one of the engine-produced placement markers · Scegli uno dei marcatori di posizionamento prodotti dal motore.',
		anchor: 'setup-pose-picker',
		match: kind('setup-pose', 'ship-pose', 'free-ship-pose')
	},
	{
		id: 'obstacles',
		title: 'Obstacles · Ostacoli',
		body: 'Choose an obstacle option, or let the engine place them at random · Scegli un.opzione ostacolo, o lascia che il motore li piazzi a caso.',
		anchor: 'obstacle-setup-picker',
		match: kind('obstacle-setup')
	},
	{
		id: 'batch',
		title: 'Confirm deployment · Conferma lo schieramento',
		body: 'Confirm the placement the engine prepared for every ship · Conferma il posizionamento che il motore ha preparato per ogni nave.',
		anchor: 'batch-ship-pose-picker',
		match: kind('batch-ship-pose')
	},
	{
		id: 'optional',
		title: 'Optional abilities · Abilità opzionali',
		body: 'Use or skip: both buttons post the engine’s own option id · Usa o salta: entrambi i pulsanti inviano l’id dell’opzione del motore.',
		anchor: 'optional-fast',
		match: kind('optional')
	},
	{
		id: 'targets',
		title: 'Choose a target · Scegli un bersaglio',
		body: 'Board highlights mark engine-provided targets; click one to answer · Le evidenziazioni sulla plancia segnano i bersagli forniti dal motore; clicane uno per rispondere.',
		anchor: 'board-container',
		match: kind('attack', 'lock-target')
	},
	{
		id: 'decision',
		title: 'Make a decision · Prendi una decisione',
		body: 'Pick one of the engine’s options in the prompt panel · Scegli una delle opzioni del motore nel pannello decisioni.',
		anchor: 'prompt',
		match: kind(
			'action',
			'damage-card',
			'barrel-roll',
			'token',
			'choose-ship',
			'attack-dice',
			'defence-dice'
		)
	},
	{
		id: 'activation',
		title: 'Board controls · Controlli della plancia',
		body: 'Pan and zoom never change the game state · Spostare e ingrandire la vista non cambia lo stato del gioco.',
		anchor: 'board-controls',
		match: idlePhase('activation')
	},
	{
		id: 'initiative',
		title: 'Initiative order · Ordine di iniziativa',
		body: 'The rail lists ships in engine-declared initiative order · La barra elenca le navi nell’ordine di iniziativa dichiarato dal motore.',
		anchor: 'initiative-rail',
		match: idlePhase('planning')
	},
	{
		id: 'gameover',
		title: 'Game over · Fine partita',
		body: 'The result panel shows the final score; download the replay here · Il pannello risultato mostra il punteggio finale; da qui scarichi il replay.',
		anchor: 'result',
		match: ({ result }) => result !== null
	}
];

/** The step matching the current engine state, or null when nothing applies. */
export function tourStepFor(
	question: Question | null,
	frame: Frame | null,
	result: GameResult | null
): TourStep | null {
	const ctx: TourContext = { question, frame, result };
	return TOUR_STEPS.find((step) => step.match(ctx)) ?? null;
}

/** Position of the current step in the table (0 when no step matches). */
export function stepIndexFor(
	question: Question | null,
	frame: Frame | null,
	result: GameResult | null
): number {
	const step = tourStepFor(question, frame, result);
	return step ? TOUR_STEPS.findIndex((candidate) => candidate.id === step.id) : 0;
}

export interface TourState {
	index: number;
}

/** Pure navigation over the table; never answers a question or advances the game. */
export function nextStep(state: TourState): TourState {
	return { index: Math.min(state.index + 1, TOUR_STEPS.length - 1) };
}

export function previousStep(state: TourState): TourState {
	return { index: Math.max(state.index - 1, 0) };
}
