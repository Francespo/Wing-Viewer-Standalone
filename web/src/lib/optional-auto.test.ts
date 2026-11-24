import { describe, expect, it } from 'vitest';
import type { OptionView, Question, QuestionKind } from './live';
import { autoSkipOptionalId } from './optional-auto';
import { optionalChoices } from './optional-fast';

const options: OptionView[] = [
	{ id: 'engine:use-1', label: 'Use it' },
	{ id: 'engine:decline-9', label: 'No', decline: true }
];

function question(kind: QuestionKind = 'optional', opts: OptionView[] = options): Question {
	return {
		id: 7,
		player: 0,
		ship: 2,
		kind,
		prompt: 'engine-produced prompt',
		options: opts,
		frame: { n: 0, round: 1, phase: 'activation', active: null, ships: [], events: [] }
	} as unknown as Question;
}

describe('skip all optional preference (viewer only)', () => {
	it('posts only the engine decline id when the preference is on', () => {
		const q = question();
		expect(autoSkipOptionalId(q, true)).toBe(optionalChoices(q.options).skip);
		expect(autoSkipOptionalId(q, true)).toBe('engine:decline-9');
	});

	it('does nothing when the preference is off', () => {
		expect(autoSkipOptionalId(question(), false)).toBeNull();
	});

	it('ignores non-optional questions', () => {
		expect(autoSkipOptionalId(question('action'), true)).toBeNull();
	});

	it('never invents a decline when the engine offers none', () => {
		const forced = question('optional', [{ id: 'engine:use-1', label: 'Use it' }]);
		expect(autoSkipOptionalId(forced, true)).toBeNull();
	});

	it('handles a missing question', () => {
		expect(autoSkipOptionalId(null, true)).toBeNull();
	});
});
