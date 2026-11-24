import { describe, expect, it } from 'vitest';
import { QUESTION_KINDS, type GameResult, type Question, type QuestionKind } from './live';
import type { Frame } from './replay';
import { TOUR_STEPS, nextStep, previousStep, tourStepFor } from './tour';

function frame(phase: string): Frame {
	return { n: 0, round: 1, phase, active: null, ships: [], events: [] } as unknown as Frame;
}

function question(kind: QuestionKind): Question {
	return {
		id: 1,
		player: 0,
		ship: 1,
		kind,
		prompt: 'engine-produced prompt',
		options: [{ id: 'engine:0', label: 'engine-produced option' }],
		frame: frame('activation'),
		...(kind === 'dial' ? { dials_total: 4 } : {})
	} as unknown as Question;
}

const result = {
	winner: 0,
	points: [50, 0],
	round: 8,
	state_hash: 'deadbeef',
	over: true
} as GameResult;

// The five engine kinds added by the full merge have no guided-tour step yet
// (`tour.ts` is unchanged), so `tourStepFor` correctly returns no id for them.
const expected: Record<QuestionKind, string | undefined> = {
	dial: 'dials',
	action: 'decision',
	'damage-card': 'decision',
	'lock-target': 'targets',
	'barrel-roll': 'decision',
	attack: 'targets',
	'attack-dice': 'decision',
	'defence-dice': 'decision',
	optional: 'optional',
	'choose-ship': 'decision',
	token: 'decision',
	'setup-pose': 'deploy',
	'ship-pose': 'deploy',
	'free-ship-pose': 'deploy',
	'batch-ship-pose': 'batch',
	'obstacle-setup': 'obstacles',
	'effect-choice': undefined,
	'reinforce': undefined,
	'reload': undefined,
	'jam-effect': undefined,
	'choice': undefined
};

describe('guided tour (viewer only)', () => {
	it('has 11 steps, each with a distinct existing anchor', () => {
		expect(TOUR_STEPS).toHaveLength(11);
		expect(new Set(TOUR_STEPS.map((step) => step.anchor)).size).toBe(TOUR_STEPS.length);
	});

	it('maps every one of the 21 engine question kinds to the right step', () => {
		for (const kind of QUESTION_KINDS) {
			expect(tourStepFor(question(kind), frame('activation'), null)?.id, kind).toBe(expected[kind]);
		}
	});

	it('shows welcome at setup and gameover from a result', () => {
		expect(tourStepFor(null, frame('setup'), null)?.id).toBe('welcome');
		expect(tourStepFor(null, frame('engagement'), result)?.id).toBe('gameover');
	});

	it('shows no step when no question, result or matching phase exists', () => {
		expect(tourStepFor(null, frame('engagement'), null)).toBeNull();
	});

	it('walks the table without inventing a step', () => {
		expect(nextStep({ index: 0 }).index).toBe(1);
		expect(nextStep({ index: TOUR_STEPS.length - 1 }).index).toBe(TOUR_STEPS.length - 1);
		expect(previousStep({ index: 0 }).index).toBe(0);
	});
});
