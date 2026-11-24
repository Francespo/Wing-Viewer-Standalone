import { describe, expect, it } from 'vitest';
import type { OptionView } from './live';
import { optionalChoices, optionalKeyChoice } from './optional-fast';

const options: OptionView[] = [
	{ id: 'optional:0', label: 'Use Battle Meditation' },
	{ id: 'optional:no', label: 'No', decline: true }
];

describe('optional ability fast path (v1)', () => {
	it('maps the engine options to use/skip without inventing ids', () => {
		expect(optionalChoices(options)).toEqual({ use: 'optional:0', skip: 'optional:no' });
	});

	it('Enter uses, Escape skips, any other key does nothing', () => {
		expect(optionalKeyChoice(options, 'Enter')).toBe('optional:0');
		expect(optionalKeyChoice(options, 'Escape')).toBe('optional:no');
		expect(optionalKeyChoice(options, 'Space')).toBeNull();
	});

	it('never invents a skip when the engine offers no decline', () => {
		const forced: OptionView[] = [{ id: 'optional:0', label: 'Use it' }];
		expect(optionalChoices(forced)).toEqual({ use: 'optional:0', skip: null });
		expect(optionalKeyChoice(forced, 'Escape')).toBeNull();
	});

	it('never invents a use when the only option is decline', () => {
		const skipOnly: OptionView[] = [{ id: 'optional:no', label: 'No', decline: true }];
		expect(optionalChoices(skipOnly)).toEqual({ use: null, skip: 'optional:no' });
		expect(optionalKeyChoice(skipOnly, 'Enter')).toBeNull();
	});
});
