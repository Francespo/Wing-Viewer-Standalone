import { readFileSync, statSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REPLAY_FIXTURE, REPLAY_FIXTURES } from './fixtures';
import {
	TOKEN_ABBR,
	TOKEN_COLOR,
	TOKEN_KINDS,
	TOKEN_LABEL,
	TOKEN_ORDER,
	loadReplay,
	rosterCards,
	validateReplay,
	type Replay
} from './replay';

const REPLAY_DIR = new URL('../../static/replays/', import.meta.url);

function readReplay(name: string): unknown {
	return JSON.parse(readFileSync(new URL(name, REPLAY_DIR), 'utf8'));
}

function tokenKeys(replay: Replay): Set<string> {
	const keys = new Set<string>();
	for (const frame of replay.frames) {
		for (const ship of frame.ships) {
			for (const kind of Object.keys(ship.tokens)) keys.add(kind);
		}
		for (const event of frame.events) {
			for (const kind of Object.keys(event.tokens ?? {})) keys.add(kind);
		}
	}
	return keys;
}

const seed7 = validateReplay(readReplay('engine-seed7.json'));
const demo = validateReplay(readReplay('demo.json'));
const aces = validateReplay(readReplay('aces-high.json'));
const epicXwa = validateReplay(readReplay('epic-xwa.json'));
const epicHouse = validateReplay(readReplay('epic-house.json'));

describe('engine-seed7.json, a real engine replay', () => {
	it('carries the contract, four ships and every frame', () => {
		expect(seed7.schema).toBe('wing-engine/replay@1');
		expect(seed7.meta.seed).toBe(7);
		expect(seed7.meta.engine).toContain('wing-engine');
		expect(seed7.ships).toHaveLength(4);
		expect(seed7.frames).toHaveLength(204);
		expect(seed7.frames.map((f) => f.n)).toEqual(
			Array.from({ length: 204 }, (_, i) => i)
		);
		expect(seed7.meta.result).toEqual({ winner: 0, points: [50, 4] });
		expect(seed7.ships.every((ship) => ship.owner === undefined)).toBe(true);
		expect(
			seed7.meta.players.every((player) => player.seat === undefined && player.color === undefined)
		).toBe(true);
		expect(seed7.frames.every((frame) => frame.scores === undefined)).toBe(true);
	});

	it('snapshots every ship on every frame and only known token keys', () => {
		for (const frame of seed7.frames) {
			expect(frame.ships).toHaveLength(seed7.ships.length);
			expect(new Set(frame.ships.map((s) => s.id)).size).toBe(seed7.ships.length);
		}
		const kinds = tokenKeys(seed7);
		expect(kinds.size).toBeGreaterThan(0);
		for (const kind of kinds) expect(TOKEN_KINDS).toContain(kind);
		expect(kinds).toEqual(new Set(['evade', 'focus', 'ion', 'lock', 'strain', 'stress']));
	});

	it('is the committed size the README quotes', () => {
		// 204 frames x 4 full snapshots. If this drifts, the README numbers and
		// the "at 2v2 that is ~200 KB" trade-off are stale too.
		expect(statSync(new URL('engine-seed7.json', REPLAY_DIR)).size).toBe(335_103);
	});
});

describe('demo.json, the hand-made fixture', () => {
	it('is valid with its own frame count', () => {
		expect(demo.schema).toBe('wing-engine/replay@1');
		expect(demo.meta.seed).toBe(42);
		expect(demo.ships).toHaveLength(4);
		expect(demo.frames).toHaveLength(27);
		for (const kind of tokenKeys(demo)) expect(TOKEN_KINDS).toContain(kind);
	});
});

describe('the token table cannot drift again', () => {
	it('orders, labels and colours every token kind exactly once', () => {
		expect([...TOKEN_ORDER].sort()).toEqual([...TOKEN_KINDS].sort());
		expect(new Set(TOKEN_ORDER).size).toBe(TOKEN_ORDER.length);
		for (const kind of TOKEN_KINDS) {
			expect(TOKEN_LABEL[kind]).toBeTruthy();
			expect(TOKEN_COLOR[kind]).toMatch(/^#[0-9a-f]{6}$/i);
			// The board badge is a 6 mm circle: one character, not a word.
			expect(TOKEN_ABBR[kind].length).toBe(1);
		}
	});

	it('renders the tokens the Rust writer emits beyond the old set', () => {
		// `crates/we-view/src/replay.rs` writes these three keys in ship
		// snapshots. Before the table carried them the board dropped them
		// silently, which is exactly the failure validation now catches.
		expect(TOKEN_ORDER).toEqual(
			expect.arrayContaining(['disarm', 'reinforce-fore', 'reinforce-aft'])
		);
		const replay = structuredClone(demo);
		replay.frames[0].ships[0].tokens['disarm'] = 1;
		replay.frames[0].ships[0].tokens['reinforce-fore'] = 1;
		replay.frames[0].ships[0].tokens['deplete'] = 1;
		replay.frames[1].ships[1].tokens['reinforce-aft'] = 1;
		const checked = validateReplay(replay);
		expect(checked.frames[0].ships[0].tokens).toMatchObject({
			disarm: 1,
			'reinforce-fore': 1,
			deplete: 1
		});
		expect(checked.frames[1].ships[1].tokens['reinforce-aft']).toBe(1);
	});
});

describe('validateReplay rejects a broken contract', () => {
	function broken(mutate: (replay: Replay) => void): Replay {
		const replay = structuredClone(seed7);
		mutate(replay);
		return replay;
	}

	it('rejects an unknown schema', () => {
		const replay = broken((r) => {
			(r as unknown as { schema: string }).schema = 'wing-engine/replay@0';
		});
		expect(() => validateReplay(replay)).toThrow(/unsupported replay schema/);
	});

	it('rejects a replay with no frames array', () => {
		const replay = broken((r) => {
			delete (r as unknown as { frames?: unknown }).frames;
		});
		expect(() => validateReplay(replay)).toThrow(/invalid replay: frames/);
	});

	it('rejects a frame that lost a ship snapshot', () => {
		const replay = broken((r) => r.frames[10].ships.pop());
		expect(() => validateReplay(replay)).toThrow(/one snapshot per ship \(4\), got 3/);
	});

	it('rejects an id that names no ship', () => {
		const replay = broken((r) => {
			r.frames[3].active = 99;
		});
		expect(() => validateReplay(replay)).toThrow(/ship id 99 is not in ships\[\]/);
	});

	it('rejects a token key the viewer does not know', () => {
		const replay = broken((r) => {
			(r.frames[0].ships[0].tokens as Record<string, number>)['ion-cannon'] = 1;
		});
		expect(() => validateReplay(replay)).toThrow(/unknown token kind/);
	});

	it('rejects duplicate ship ids', () => {
		const replay = broken((r) => {
			r.ships[1].id = r.ships[0].id;
		});
		expect(() => validateReplay(replay)).toThrow(/duplicate ship id 1/);
	});

	it('rejects a negative token count in a snapshot', () => {
		const replay = broken((r) => {
			r.frames[0].ships[0].tokens.focus = -1;
		});
		expect(() => validateReplay(replay)).toThrow(/cannot be negative/);
	});

	it('accepts a scenario board with a satellite feature', () => {
		const replay = broken((r) => {
			r.meta.scenario = 'chance-engagement';
			r.board.features = [{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite' }];
		});
		expect(validateReplay(replay).board.features?.[0].kind).toBe('satellite');
	});

	it('accepts an Assault board with five satellite features', () => {
		const replay = broken((r) => {
			r.meta.scenario = 'assault-at-the-satellite-array';
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite' },
				{ id: 1, x: 370, y: 130, radius: 20, kind: 'satellite' },
				{ id: 2, x: 120, y: 500, radius: 20, kind: 'satellite' },
				{ id: 3, x: 700, y: 500, radius: 20, kind: 'satellite' },
				{ id: 4, x: 610, y: 160, radius: 20, kind: 'satellite' }
			];
		});
		expect(validateReplay(replay).board.features?.length).toBe(5);
	});

	it('accepts a Salvage board with supply caches and a towing ship', () => {
		const replay = broken((r) => {
			r.meta.scenario = 'salvage-mission';
			r.meta.players[0].marker_color = 'red';
			r.meta.players[1].marker_color = 'blue';
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'supply cache' },
				{ id: 1, x: 370, y: 130, radius: 20, kind: 'supply cache' }
			];
			r.frames[0].features = [r.board.features[0]];
			r.frames[0].ships[0].towing = 1;
			r.frames[0].ships[0].towing_color = 'red';
		});
		const validated = validateReplay(replay);
		expect(validated.board.features?.[0].kind).toBe('supply cache');
		expect(validated.frames[0].features).toHaveLength(1);
		expect(validated.frames[0].ships[0].towing).toBe(1);
		expect(validated.frames[0].ships[0].towing_color).toBe('red');
	});

	/** The towing colour is engine data and only exists with a carried cache, so
	 *  a colour on its own is a writer bug the viewer refuses. */
	it('rejects a towing colour without a carried cache', () => {
		const replay = broken((r) => {
			r.frames[0].ships[0].towing_color = 'red';
		});
		expect(() => validateReplay(replay)).toThrow(/a towing colour needs a carried cache/);
	});

	it('accepts an Ancient Knowledge board with charged data caches and a condition', () => {
		const replay = broken((r) => {
			r.meta.scenario = 'ancient-knowledge';
			r.meta.players[0].marker_color = 'red';
			r.meta.players[1].marker_color = 'blue';
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'data cache', charge: 'active' },
				{ id: 1, x: 120, y: 500, radius: 20, kind: 'data cache', charge: 'inactive' },
				{ id: 2, x: 370, y: 130, radius: 20, kind: 'data cache', charge: 'active' }
			];
			r.frames[0].features = r.board.features;
			r.frames[0].ships[0].ancient_knowledge = true;
		});
		const validated = validateReplay(replay);
		expect(validated.board.features?.[0].charge).toBe('active');
		expect(validated.frames[0].features?.[1].charge).toBe('inactive');
		expect(validated.frames[0].ships[0].ancient_knowledge).toBe(true);
		expect(validated.frames[0].ships[1].ancient_knowledge).toBeUndefined();
	});

	it('accepts an Aces High board with four hyperspace markers', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 150, y: 150, radius: 20, kind: 'hyperspace marker', marker_size: '3x3', facing: 'bottom-left' },
				{ id: 1, x: 764, y: 764, radius: 20, kind: 'hyperspace marker', marker_size: '3x3', facing: 'top-right' },
				{ id: 2, x: 864, y: 50, radius: 20, kind: 'hyperspace marker', marker_size: '1x1', facing: 'bottom-right' },
				{ id: 3, x: 50, y: 864, radius: 20, kind: 'hyperspace marker', marker_size: '1x1', facing: 'top-left' }
			];
		});
		const validated = validateReplay(replay);
		expect(validated.board.features).toHaveLength(4);
		expect(validated.board.features?.[0].marker_size).toBe('3x3');
		expect(validated.board.features?.[3].facing).toBe('top-left');
	});

	it('rejects a hyperspace marker without its size and facing', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 150, y: 150, radius: 20, kind: 'hyperspace marker' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/needs its size and facing/);
	});

	it('rejects a marker size on a feature that is not a hyperspace marker', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite', marker_size: '3x3', facing: 'bottom-left' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/only a hyperspace marker carries a size/);
	});

	it('rejects an unknown charge side', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'data cache', charge: 'spent' as 'active' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/unknown value "spent"/);
	});

	it('rejects a charge on a feature that is not a data cache', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite', charge: 'active' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/only a data cache carries a charge token/);
	});

	it('rejects a data cache without its charge side', () => {
		const replay = broken((r) => {
			r.board.features = [{ id: 0, x: 457, y: 457, radius: 20, kind: 'data cache' }];
		});
		expect(() => validateReplay(replay)).toThrow(/a data cache needs its charge side/);
	});

	it('rejects a non-boolean Ancient Knowledge condition', () => {
		const replay = broken((r) => {
			r.frames[0].ships[0].ancient_knowledge = 1 as unknown as boolean;
		});
		expect(() => validateReplay(replay)).toThrow(/ancient_knowledge: expected a boolean/);
	});

	it('rejects an unknown feature kind', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'supply-cache' as 'satellite' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/unknown value "supply-cache"/);
	});

	it('accepts a Scramble board and frame with red and blue player markers', () => {
		const replay = broken((r) => {
			r.meta.scenario = 'scramble-the-transmissions';
			r.meta.players[0].marker_color = 'red';
			r.meta.players[1].marker_color = 'blue';
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite' },
				{ id: 1, x: 120, y: 500, radius: 20, kind: 'satellite', marker: 0, marker_color: 'red' },
				{ id: 2, x: 370, y: 130, radius: 20, kind: 'satellite', marker: 1, marker_color: 'blue' }
			];
			r.frames[0].features = r.board.features;
		});
		const validated = validateReplay(replay);
		expect(validated.meta.players[0].marker_color).toBe('red');
		expect(validated.frames[0].features?.[1].marker).toBe(0);
		expect(validated.frames[0].features?.[1].marker_color).toBe('red');
		expect(validated.frames[0].features?.[2].marker_color).toBe('blue');
	});

	/** The colour is data from the engine, so the viewer refuses a value it does
	 *  not know instead of painting satellite 0 grey. */
	it('rejects an unknown marker colour', () => {
		const replay = broken((r) => {
			r.board.features = [
				{
					id: 0,
					x: 457,
					y: 457,
					radius: 20,
					kind: 'satellite',
					marker: 0,
					marker_color: 'green' as 'red'
				}
			];
		});
		expect(() => validateReplay(replay)).toThrow(/unknown value "green"/);
	});

	it('rejects a marker colour without a marker', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite', marker_color: 'red' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/a marker colour needs a marker/);
	});

	it('rejects a marker that names a third player', () => {
		const replay = broken((r) => {
			r.board.features = [
				{ id: 0, x: 457, y: 457, radius: 20, kind: 'satellite', marker: 2, marker_color: 'red' }
			];
		});
		expect(() => validateReplay(replay)).toThrow(/expected player 0 or 1/);
	});
});

describe('loadReplay validates before returning', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('accepts a valid file', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify(demo), { status: 200 }))
		);
		const loaded = await loadReplay('/replays/demo.json');
		expect(loaded.frames).toHaveLength(27);
	});

	it('rejects a file with a stale schema', async () => {
		const stale = structuredClone(seed7) as unknown as { schema: string };
		stale.schema = 'wing-engine/replay@1-old';
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify(stale), { status: 200 }))
		);
		await expect(loadReplay('/replays/stale.json')).rejects.toThrow(
			/unsupported replay schema/
		);
	});
});

describe('aces-high.json, a real Aces High replay', () => {
	it('carries the format, three players, markers and the bounty result', () => {
		expect(aces.schema).toBe('wing-engine/replay@1');
		expect(aces.meta.format).toBe('aces-high');
		expect(aces.meta.seed).toBe(15);
		expect(aces.meta.players).toHaveLength(3);
		expect(aces.meta.scenario).toBeUndefined();
		expect(aces.meta.result).toEqual({
			winner: 1,
			points: [0, 0, 0],
			bounty: [0, 10, 2]
		});
		expect(aces.meta.players.map((p) => p.seat)).toEqual([1, 2, 3]);
		expect(new Set(aces.meta.players.map((p) => p.color)).size).toBe(3);
		for (const player of aces.meta.players) {
			expect(player.color).toMatch(/^#[0-9a-f]{6}$/i);
		}
		// Two Empire seats: the colour must be the seat palette, not the faction.
		const empire = aces.meta.players.filter((p) => p.faction === 'empire');
		expect(empire).toHaveLength(2);
		expect(empire[0].color).not.toBe(empire[1].color);
		expect(aces.ships.map((s) => s.owner)).toEqual([0, 1, 2]);
		const markers = aces.board.features ?? [];
		expect(markers).toHaveLength(4);
		expect(markers.every((f) => f.kind === 'hyperspace marker')).toBe(true);
		expect(markers.map((f) => f.marker_size)).toEqual(['3x3', '3x3', '1x1', '1x1']);
		expect(markers.map((f) => f.facing)).toEqual([
			'bottom-left',
			'top-right',
			'bottom-right',
			'top-left'
		]);
	});

	it('snapshots three ships and a public scoreboard on every frame', () => {
		expect(aces.frames).toHaveLength(1042);
		let everScored = false;
		let everCarried = false;
		for (const frame of aces.frames) {
			expect(frame.ships).toHaveLength(3);
			expect(frame.scores).toHaveLength(3);
			for (const score of frame.scores ?? []) {
				expect(Number.isInteger(score)).toBe(true);
				expect(score).toBeGreaterThanOrEqual(0);
				if (score > 0) everScored = true;
			}
			for (const ship of frame.ships) {
				expect(ship.bounty_tokens ?? 0).toBeGreaterThanOrEqual(0);
				if ((ship.bounty_tokens ?? 0) > 0) everCarried = true;
			}
		}
		expect(everScored).toBe(true);
		expect(everCarried).toBe(true);
	});

	it('names every player in the Aces log and never assumes two scores', () => {
		const lines = aces.frames.flatMap((f) => f.events.map((e) => e.text));
		expect(lines.some((line) => line.includes('respawns for'))).toBe(true);
		expect(lines.some((line) => line.includes('bounty token'))).toBe(true);
		expect(lines.some((line) => line.includes('Aces High with'))).toBe(true);
		expect(lines.filter((line) => line.includes('Game over'))).toHaveLength(1);
		const final = lines.find((line) => line.includes('Game over')) ?? '';
		for (const player of aces.meta.players) expect(final).toContain(player.name);
		expect(final).not.toMatch(/mission points/);
	});

	it('is the committed size the README quotes', () => {
		expect(statSync(new URL('aces-high.json', REPLAY_DIR)).size).toBe(1_438_531);
	});

	it('does not expose hidden dials or damage-card identities', () => {
		const raw = readFileSync(new URL('aces-high.json', REPLAY_DIR), 'utf8');
		for (const forbidden of ['"dial"', 'DialSet', 'damage_card', 'DamageCard', '"deck"']) {
			expect(raw).not.toContain(forbidden);
		}
	});
});

describe('Aces fields are a closed contract', () => {
	function brokenAces(mutate: (replay: Replay) => void): Replay {
		const replay = structuredClone(aces);
		mutate(replay);
		return replay;
	}

	it('rejects a result scoreboard with the wrong player count', () => {
		const replay = brokenAces((r) => {
			if (r.meta.result) r.meta.result.points = [0, 0];
		});
		expect(() => validateReplay(replay)).toThrow(
			/expected one score per player \(3\), got 2/
		);
	});

	it('rejects a bounty list with the wrong player count', () => {
		const replay = brokenAces((r) => {
			if (r.meta.result) r.meta.result.bounty = [10, 1];
		});
		expect(() => validateReplay(replay)).toThrow(
			/expected one count per player \(3\), got 2/
		);
	});

	it('rejects a frame scoreboard with the wrong player count', () => {
		const replay = brokenAces((r) => {
			r.frames[0].scores = [0, 0];
		});
		expect(() => validateReplay(replay)).toThrow(
			/expected one count per player \(3\), got 2/
		);
	});

	it('rejects a negative bounty token count', () => {
		const replay = brokenAces((r) => {
			r.frames[0].ships[0].bounty_tokens = -1;
		});
		expect(() => validateReplay(replay)).toThrow(/bounty_tokens: cannot be negative/);
	});

	it('rejects an owner that names no player', () => {
		const replay = brokenAces((r) => {
			r.ships[0].owner = 3;
		});
		expect(() => validateReplay(replay)).toThrow(
			/player index 3 is outside meta.players \(3\)/
		);
	});

	it('rejects a negative owner', () => {
		const replay = brokenAces((r) => {
			r.ships[0].owner = -1;
		});
		expect(() => validateReplay(replay)).toThrow(/player index -1 is outside meta.players/);
	});

	it('rejects a non-integer owner', () => {
		const replay = brokenAces((r) => {
			r.ships[0].owner = 1.5;
		});
		expect(() => validateReplay(replay)).toThrow(/owner: expected an integer/);
	});

	it('rejects a seat outside the player count', () => {
		const replay = brokenAces((r) => {
			r.meta.players[0].seat = 4;
		});
		expect(() => validateReplay(replay)).toThrow(/seat: expected 1\.\.3, got 4/);
	});

	it('rejects a duplicate seat', () => {
		const replay = brokenAces((r) => {
			r.meta.players[1].seat = 1;
		});
		expect(() => validateReplay(replay)).toThrow(/duplicate seat 1/);
	});

	it('rejects a seat colour that is not a hex colour', () => {
		const replay = brokenAces((r) => {
			r.meta.players[0].color = 'rebel-red';
		});
		expect(() => validateReplay(replay)).toThrow(/expected #rrggbb/);
	});

	it('rejects a seat without its colour, and a colour without its seat', () => {
		const noColour = brokenAces((r) => {
			delete r.meta.players[0].color;
		});
		expect(() => validateReplay(noColour)).toThrow(/color: expected a string/);

		const noSeat = brokenAces((r) => {
			delete r.meta.players[0].seat;
		});
		expect(() => validateReplay(noSeat)).toThrow(/seat: expected a finite number/);
	});

	it('accepts the Epic formats and validates their huge-ship base length', () => {
		for (const format of ['epic-xwa', 'epic-house']) {
			const replay = brokenAces((r) => {
				(r.meta as unknown as { format: string }).format = format;
				(r.ships[0] as unknown as { base_length: number }).base_length = 160;
			});
			expect(() => validateReplay(replay)).not.toThrow();
		}
	});

	it('rejects an unknown format id', () => {
		const replay = brokenAces((r) => {
			(r.meta as unknown as { format: string }).format = 'not-a-format';
		});
		expect(() => validateReplay(replay)).toThrow(/unknown value "not-a-format"/);
	});
});

describe('printed card text is engine data', () => {
	const text = 'While you perform a primary attack, if the defender is in your [Bullseye Arc], you may reroll 1 attack die.';

	function shipWithCards(cards: Array<Record<string, string>>): Replay {
		const replay = structuredClone(seed7);
		(replay.ships[0] as unknown as { cards: Array<Record<string, string>> }).cards = cards;
		return replay;
	}

	it('copies text from ReplayCard into RosterCard and omits it when absent', () => {
		const ship = shipWithCards([
			{ xws: 'predator', name: 'Predator', text },
			{ xws: 'testupgrade', name: 'Test Upgrade' }
		]).ships[0];
		const validated = validateReplay(shipWithCards([
			{ xws: 'predator', name: 'Predator', text },
			{ xws: 'testupgrade', name: 'Test Upgrade' }
		]));
		expect(validated.ships[0].cards?.[0].text).toBe(text);
		const rows = rosterCards(ship);
		expect(rows[0].text).toBe(text);
		expect(rows[0].label).toBe('Predator');
		expect(rows[1].text).toBeUndefined();
		expect(rows[1]).not.toHaveProperty('text');
	});

	it('rejects non-string text and accepts no-card ships', () => {
		const bad = shipWithCards([{ xws: 'predator', name: 'Predator', text: 42 as unknown as string }]);
		expect(() => validateReplay(bad)).toThrow(/cards\[0\]\.text: expected a string/);
		expect(() => validateReplay(seed7)).not.toThrow();
	});
});

describe('printed maneuvers are engine data', () => {
	// Literal maneuver_text output from crates/we-view/src/text.rs.
	const maneuvers = ['2 straight (white)', 'stationary'];

	function shipWithManeuvers(list: unknown): Replay {
		const replay = structuredClone(seed7);
		(replay.ships[0] as unknown as { maneuvers: unknown }).maneuvers = list;
		return replay;
	}

	it('copies the printed dial through validation and omits it when absent', () => {
		const validated = validateReplay(shipWithManeuvers(maneuvers));
		expect(validated.ships[0].maneuvers).toEqual(maneuvers);
		// The committed seed-7 fixture is a no-card game with no dial key.
		expect(seed7.ships[0].maneuvers).toBeUndefined();
		expect(() => validateReplay(seed7)).not.toThrow();
	});

	it('rejects non-string maneuvers', () => {
		expect(() => validateReplay(shipWithManeuvers([42]))).toThrow(
			/maneuvers\[0\]: expected a string/
		);
	});
});
