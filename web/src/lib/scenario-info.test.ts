import { describe, expect, it } from 'vitest';
import { SCENARIO_INFO, scenarioDescription } from './scenario-info';

const SCENARIOS = [
	'none',
	'chance-engagement',
	'assault-at-the-satellite-array',
	'scramble-the-transmissions',
	'salvage-mission',
	'ancient-knowledge'
];

describe('scenario picker descriptions (rendering only)', () => {
	it('has a non-empty description for every selectable scenario', () => {
		for (const id of SCENARIOS) {
			expect(scenarioDescription(id).length).toBeGreaterThan(20);
		}
		expect(Object.keys(SCENARIO_INFO).sort()).toEqual([...SCENARIOS].sort());
	});

	it('falls back instead of inventing rules for an unknown scenario', () => {
		expect(scenarioDescription('not-a-scenario')).toBe('No description available.');
	});
});
