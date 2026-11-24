import { describe, expect, it } from 'vitest';
import { rosterCards, type ReplayShip } from './replay';

const ship: ReplayShip = {
	id: 1,
	name: 'Gray Squadron Bomber',
	ship: 'BTL-A4 Y-wing',
	faction: 'rebel',
	base: 40,
	initiative: 2,
	hull: 6,
	shields: 2,
	agility: 1,
	arc: 'front'
};

describe('rosterCards', () => {
	it('labels each equipped card with its printed name and xws title', () => {
		expect(
			rosterCards({
				...ship,
				cards: [
					{ xws: 'r4astromech', name: 'R4 Astromech' },
					{ xws: 'predator', name: 'Predator' }
				]
			})
		).toEqual([
			{ xws: 'r4astromech', label: 'R4 Astromech', title: 'R4 Astromech (r4astromech)' },
			{ xws: 'predator', label: 'Predator', title: 'Predator (predator)' }
		]);
	});

	it('renders no card pills for the default no-card ship', () => {
		expect(rosterCards(ship)).toEqual([]);
	});
});
