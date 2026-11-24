import type { ReplayFormat } from './replay';

/**
 * The replay fixtures the home viewer offers. The first entry is the default,
 * so `/` keeps opening the Standard seed-7 game; Aces High and the two Epic
 * formats are one click away. Adding a fixture here is a data change, not a
 * game rule (D-078).
 */
export interface ReplayFixture {
	/** `meta.format` the fixture carries. */
	format: ReplayFormat;
	/** Short switch label. */
	short: string;
	label: string;
	url: string;
}

export const REPLAY_FIXTURES: readonly ReplayFixture[] = [
	{
		format: 'standard-50p',
		short: 'Standard',
		label: 'Standard 2v2 · seed 7',
		url: '/replays/engine-seed7.json'
	},
	{
		format: 'aces-high',
		short: 'Aces High',
		label: 'Aces High 3p · seed 15',
		url: '/replays/aces-high.json'
	},
	{
		format: 'epic-xwa',
		short: 'Epic',
		label: 'Epic XWA 2v2 · seed 42',
		url: '/replays/epic-xwa.json'
	},
	{
		format: 'epic-house',
		short: 'Epic House',
		label: 'Epic + house defaults 2v2 · seed 42',
		url: '/replays/epic-house.json'
	}
];

export const DEFAULT_REPLAY_FIXTURE = REPLAY_FIXTURES[0].url;
