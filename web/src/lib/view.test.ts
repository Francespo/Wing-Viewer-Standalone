import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REPLAY_FIXTURE, REPLAY_FIXTURES } from './fixtures';
import { FACTION_COLOR, MARKER_FACING_VECTOR } from './board';
import { validateReplay, type Frame, type ReplayPlayer } from './replay';
import {
	bountyLabel,
	dialRevealedLabel,
	formatLabel,
	hugeTrackers,
	hyperspaceLabel,
	playerColor,
	scoreboardRows,
	seatLabel,
	shipColor,
	shipPlayer,
	winnerName
} from './view';

const REPLAY_DIR = new URL('../../static/replays/', import.meta.url);

function readReplay(name: string) {
	return validateReplay(JSON.parse(readFileSync(new URL(name, REPLAY_DIR), 'utf8')));
}

const aces = readReplay('aces-high.json');
const standard = readReplay('engine-seed7.json');
const epic = readReplay('epic-xwa.json');

describe('the Epic presentation data', () => {
	it('labels every format id the setup page offers', () => {
		expect(formatLabel('standard-50p')).toBe('Standard 50P');
		expect(formatLabel('aces-high')).toBe('Aces High');
		expect(formatLabel('epic-xwa')).toBe('Epic XWA');
		expect(formatLabel('epic-house')).toBe('Epic House');
		expect(formatLabel('future-format')).toBe('future-format');
	});

	it('exposes the huge base, current shields and live energy trackers', () => {
		const rows = hugeTrackers(epic.ships, epic.frames[0]);
		expect(rows.map((row) => row.baseLength)).toEqual([160, 160]);
		expect(rows.map((row) => row.shields)).toEqual([7, 8]);
		expect(rows.map((row) => row.energy)).toEqual([7, 6]);
		expect(rows.map((row) => row.energyCapacity)).toEqual([7, 6]);
		expect(rows.map((row) => row.energyRecurring)).toEqual([2, 2]);
		expect(rows.map((row) => row.shieldRecurring)).toEqual([2, 2]);

		// A replay written before the live tracker still shows the base and
		// shields without inventing an energy value.
		const oldShips = epic.ships.map((ship) => ({ ...ship, energy_capacity: undefined }));
		const oldFrame = {
			...epic.frames[0],
			ships: epic.frames[0].ships.map((state) => ({ ...state, energy: undefined }))
		};
		expect(hugeTrackers(oldShips, oldFrame).every((row) => row.energy === null)).toBe(
			true
		);
	});
});

describe('the N-player scoreboard selects engine values', () => {
	it('shows one row per Aces seat with the frame score, never a two-player pair', () => {
		const frame = aces.frames.find((f) => (f.scores ?? []).some((score) => score > 0));
		expect(frame).toBeDefined();
		const rows = scoreboardRows(aces.meta.players, frame!, aces.meta.result, false);
		expect(rows).toHaveLength(3);
		expect(rows.map((row) => row.label)).toEqual(['P1', 'P2', 'P3']);
		expect(rows.map((row) => row.score)).toEqual(frame!.scores);
		expect(rows.every((row) => row.unit === 'bounty')).toBe(true);
		// The two Empire seats stay distinguishable because the colour is data.
		expect(rows[1].faction).toBe('empire');
		expect(rows[2].faction).toBe('empire');
		expect(rows[1].color).not.toBe(rows[2].color);
	});

	it('uses the result bounty at Game Over, not a recomputation', () => {
		const final = aces.frames.at(-1)!;
		const rows = scoreboardRows(aces.meta.players, final, aces.meta.result, true);
		expect(rows.map((row) => row.score)).toEqual(aces.meta.result?.bounty);
		expect(rows.map((row) => row.score)).toEqual(final.scores);
		expect(winnerName(aces.meta.players, aces.meta.result)).toBe('P2 Empire 2');
	});

	it('handles six players without a fixed two-index assumption', () => {
		const players = Array.from({ length: 6 }, (_, index) => ({
			name: `Seat ${index + 1}`,
			faction: index % 2 === 0 ? 'rebel' : 'empire',
			points: 0,
			seat: index + 1,
			color: ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'][index]
		})) satisfies ReplayPlayer[];
		const frame = { scores: [0, 6, 2, 9, 1, 4] } as unknown as Frame;
		const rows = scoreboardRows(players, frame, { winner: 3, points: [0, 0, 0, 0, 0, 0], bounty: [1, 2, 3, 4, 5, 6] }, false);
		expect(rows.map((row) => row.label)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
		// Exactly the engine's numbers; the viewer adds no rules.
		expect(rows.map((row) => row.score)).toEqual([0, 6, 2, 9, 1, 4]);
	});

	it('keeps Standard on mission points, including the final result', () => {
		const frame = standard.frames[10];
		const during = scoreboardRows(standard.meta.players, frame, standard.meta.result, false);
		expect(during.map((row) => row.unit)).toEqual(['MP', 'MP']);
		expect(during.map((row) => row.score)).toEqual([16, 11]);
		expect(during.map((row) => row.color)).toEqual([
			FACTION_COLOR.rebel,
			FACTION_COLOR.empire
		]);
		const final = scoreboardRows(
			standard.meta.players,
			standard.frames.at(-1)!,
			standard.meta.result,
			true
		);
		expect(final.map((row) => row.score)).toEqual([50, 4]);
		expect(winnerName(standard.meta.players, standard.meta.result)).toBe('P1 Rebels');
	});
});

describe('seat colours and owner badges are data, with a faction fallback', () => {
	it('colours an owner ship by the player palette, not the faction', () => {
		const ship = aces.ships[1];
		expect(ship.owner).toBe(1);
		expect(shipColor(ship, aces.meta.players)).toBe('#60a5fa');
		expect(shipPlayer(ship, aces.meta.players)?.seat).toBe(2);
		expect(seatLabel(aces.meta.players[1], 1)).toBe('P2');
	});

	it('falls back to the old faction colour when owner is absent', () => {
		const ship = standard.ships[0];
		expect(ship.owner).toBeUndefined();
		expect(shipColor(ship, standard.meta.players)).toBe(FACTION_COLOR.rebel);
		expect(shipPlayer(ship, standard.meta.players)).toBeUndefined();
		expect(playerColor(undefined)).toBe(FACTION_COLOR.unknown);
	});

	it('shows a bounty badge only for a positive engine count', () => {
		expect(bountyLabel(undefined)).toBeNull();
		expect(bountyLabel(0)).toBeNull();
		expect(bountyLabel(1)).toBe('B1');
		expect(bountyLabel(8)).toBe('B8');
	});

	it('labels hyperspace markers from the size and facing the engine sent', () => {
		const marker = aces.board.features?.[0];
		expect(marker).toBeDefined();
		expect(hyperspaceLabel(marker!)).toBe('HYPERSPACE 3x3 · blank bottom-left');
		expect(new Set(Object.values(MARKER_FACING_VECTOR).map((p) => `${p.x},${p.y}`)).size).toBe(4);
	});
});

describe('the home viewer format switch', () => {
	it('offers Standard, Aces High and both Epic formats, with Standard as the default', () => {
		expect(REPLAY_FIXTURES.map((fixture) => fixture.format)).toEqual([
			'standard-50p',
			'aces-high',
			'epic-xwa',
			'epic-house'
		]);
		expect(DEFAULT_REPLAY_FIXTURE).toBe('/replays/engine-seed7.json');
		expect(REPLAY_FIXTURES[1].url).toBe('/replays/aces-high.json');
		expect(REPLAY_FIXTURES[2].url).toBe('/replays/epic-xwa.json');
		expect(REPLAY_FIXTURES[3].url).toBe('/replays/epic-house.json');
	});
});

describe('the revealed-dial marker', () => {
	it('shows the engine maneuver text and nothing when absent', () => {
		expect(dialRevealedLabel({ dial_revealed: '2 bank left (white)' })).toBe(
			'DIAL 2 bank left (white)'
		);
		expect(dialRevealedLabel({})).toBeNull();
		expect(dialRevealedLabel({ dial_revealed: '' })).toBeNull();
	});
});
