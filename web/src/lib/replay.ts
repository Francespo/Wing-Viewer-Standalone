/**
 * Replay format `wing-engine/replay@1`.
 *
 * This is the contract between the Rust engine and any viewer. It is deliberately
 * *dumb*: every frame carries a full snapshot of the board, so the viewer never
 * has to apply rules to reconstruct a position. At 2v2 that costs a few hundred
 * kilobytes for a whole game, which is the correct trade for a debug tool.
 *
 * The writer lives in this repository, in `crates/we-view/src/replay.rs`; it
 * serialises `we_core::Event` into `Frame`s. `static/replays/engine-seed7.json`
 * is its output for seed 7 and is the replay the viewer opens by default.
 * `scripts/gen_demo_replay.py` produces the smaller hand-made fixture.
 *
 * Every closed set below is declared once as a runtime array; the type is
 * derived from it. That is deliberate: a type-only union can drift from the
 * data the Rust writer emits (`disarm`, `reinforce-fore`, `reinforce-aft` did),
 * and nothing fails until a token quietly stops rendering. `validateReplay`
 * checks the same arrays.
 */

/** The format ids the Rust writer can project today (D-077). A replay is one
 *  game, so the id is a closed set: `standard-50p` is the two-player game,
 *  `aces-high` is the loaded Aces High format and `epic-xwa`/`epic-house` are
 *  the huge-ship formats. A new format adds its id here with the Rust
 *  constructor, never by a viewer rule. */
export const REPLAY_FORMATS = ['standard-50p', 'aces-high', 'epic-xwa', 'epic-house'] as const;
export type ReplayFormat = (typeof REPLAY_FORMATS)[number];

export const FACTIONS = [
	'rebel',
	'empire',
	'scum',
	'resistance',
	'firstorder',
	'republic',
	'separatist',
	'unknown'
] as const;
export type Faction = (typeof FACTIONS)[number];

export const TOKEN_KINDS = [
	'focus',
	'evade',
	'lock',
	'calculate',
	'reinforce',
	'reinforce-fore',
	'reinforce-aft',
	'jam',
	'tractor',
	'deplete',
	'ion',
	'disarm',
	'strain',
	'stress',
	'cloak'
] as const;
export type TokenKind = (typeof TOKEN_KINDS)[number];

export const DIE_FACES = ['hit', 'crit', 'focus', 'evade', 'blank'] as const;
export type DieFace = (typeof DIE_FACES)[number];

export const TONES = [
	'system',
	'move',
	'action',
	'attack',
	'damage',
	'token',
	'score',
	'ability',
	'destroy'
] as const;
export type Tone = (typeof TONES)[number];

export const ARC_KINDS = ['front', 'front_rear', 'turret', 'bullseye', 'none'] as const;
export type ArcKind = (typeof ARC_KINDS)[number];

export const OBSTACLE_KINDS = [
	'asteroid',
	'debris',
	'gas',
	'other',
	'blaze',
	'loose-cargo',
	'spare-parts'
] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

export interface ReplayShip {
	id: number;
	/** The player that owns this ship: a zero-based index into `meta.players`
	 *  and `frame.scores`. Present only for a free-for-all format such as Aces
	 *  High (D-078); absent for Standard and every scenario. */
	owner?: number;
	/** Pilot name shown on the board, e.g. "Academy Pilot". */
	name: string;
	/** Chassis, e.g. "TIE/ln Fighter". */
	ship: string;
	faction: Faction;
	/** Base side in millimetres: 40 small, 60 medium, 80 large. */
	base: number;
	/** Optional length for rectangular huge ship bases (160 mm). */
	base_length?: number;
	initiative: number;
	hull: number;
	shields: number;
	agility: number;
	/** A huge ship's printed energy capacity and recurring energy/shield
	 *  symbols, copied by the engine from its committed huge-chassis table.
	 *  Absent for every other ship. */
	energy_capacity?: number;
	energy_recurring?: number;
	shield_recurring?: number;
	arc: ArcKind;
	/** Equipped upgrades/pilot cards. Absent on the default no-card game. */
	cards?: ReplayCard[];
	/** The printed manoeuvre dial as engine-rendered strings (e.g.
	 *  "2 straight (white)", "stationary"). Present only for XWS ships with
	 *  equipped cards; absent on no-card games so their bytes stay unchanged.
	 *  Every string is engine data — the viewer derives no rule or label. */
	maneuvers?: string[];
}

/** A public card identity: the XWS key, printed name and, when the engine has
 *  it, the printed card text. The viewer never derives abilities from it; the
 *  engine owns every rule and every word of text. */
export interface ReplayCard {
	xws: string;
	name: string;
	/** Printed card text projected from the engine's generated side table.
	 *  Absent when the card prints no text; never a viewer-side fallback. */
	text?: string;
}

/** One row in the Roster's equipped-card list. Pure data so the rendering
 *  contract is testable without a DOM. */
export interface RosterCard {
	xws: string;
	label: string;
	title: string;
	/** The same engine text as `ReplayCard.text`, when present. */
	text?: string;
}

/** The cards shown on a roster ship, in engine order. */
export function rosterCards(ship: ReplayShip): RosterCard[] {
	return (ship.cards ?? []).map((card) => ({
		xws: card.xws,
		label: card.name,
		title: `${card.name} (${card.xws})`,
		...(card.text === undefined ? {} : { text: card.text })
	}));
}

export interface ShipState {
	id: number;
	x: number;
	y: number;
	/** Degrees clockwise from north (engine `Heading` in tenths / 10). */
	heading: number;
	hull: number;
	shields: number;
	/** Current active energy on a huge ship, supplied by the engine. Absent on
	 *  every other ship. The viewer never derives a spend or recovery. */
	energy?: number;
	tokens: Partial<Record<TokenKind, number>>;
	/** Ship id this ship has locked, if any. */
	lock: number | null;
	alive: boolean;
	/** Face-down damage cards in hand. */
	damage: number;
	/** Face-up (critical) damage cards. */
	crits?: number;
	/** The dial a card let the acting player look at, as the engine's maneuver
	 *  text. Present only while the dial is still secret to the table and only
	 *  for the seat addressed by `dial_revealed_to`; a projected response for
	 *  any other seat omits both fields. */
	dial_revealed?: string;
	/** Zero-based player index allowed to see `dial_revealed`. Omitted when no
	 *  private reveal is present. */
	dial_revealed_to?: number;
	/** Supply cache on this ship's card, as a feature id (XWA Scenarios p.4
	 *  "SCENARIO ACTION: [TOW]"). Present only while the ship is towing. */
	towing?: number;
	/** The owner's player-marker colour for the towing marker, as engine data. */
	towing_color?: MarkerColor;
	/** The Ancient Knowledge condition (XWA Scenarios p.7 "ANCIENT KNOWLEDGE
	 *  CONDITION"). Present only while the ship has it; one per ship. */
	ancient_knowledge?: boolean;
	/** Aces High bounty tokens on this ship's card (XWA Aces High p.1 L53).
	 *  Public information, omitted at zero (D-077). */
	bounty_tokens?: number;
}

export interface MoveArc {
	ship: number;
	from: { x: number; y: number; heading: number };
	to: { x: number; y: number; heading: number };
	partial: boolean;
}

export interface FrameEvent {
	tone: Tone;
	/** Already human-readable; produced by the engine's log formatter. For a
	 *  private reveal projected to the wrong seat this is the public sentence. */
	text: string;
	/** Zero-based player index allowed to see the full private `text`. */
	private_to?: number;
	/** The public replacement sentence carried by the full replay. */
	redacted_text?: string;
	/** Highlight these ships while the frame is selected. */
	ships?: number[];
	dice?: { attack?: DieFace[]; defence?: DieFace[] };
	/** Token badges shown inline, e.g. { focus: 1 } or { focus: -1 }. */
	tokens?: Partial<Record<TokenKind, number>>;
}

export interface Frame {
	n: number;
	round: number;
	phase: string;
	/** Ship whose activation/engagement is being resolved, if any. */
	active: number | null;
	ships: ShipState[];
	/** Feature markers in this frame, when a player marker is in play. The board
	 *  keeps the geometry; ownership lives here because it changes. */
	features?: ScenarioFeature[];
	events: FrameEvent[];
	moves?: MoveArc[];
	/** In-arc attackers/defenders to tint while the frame is selected. */
	highlight?: { attackers?: number[]; defenders?: number[] };
	/** Aces High bounty-token totals in player order (D-077). Omitted for
	 *  Standard and every scenario, so their frames stay byte-identical. */
	scores?: number[];
}

export interface Obstacle {
	x: number;
	y: number;
	radius: number;
	kind: ObstacleKind;
	/** Exact engine silhouette, centimillimetres relative to (x, y). */
	outline?: [number, number][];
}

/** The scenario features the engine writes today. `satellite` is used by Chance
 *  Engagement (one), Assault at the Satellite Array (five) and Scramble the
 *  Transmissions (three); `supply cache` is Salvage Mission's five; `data
 *  cache` is Ancient Knowledge's three; `hyperspace marker` is Aces High's
 *  four. New kinds are added here with the Rust enum, never by a viewer rule. */
export const FEATURE_KINDS = ['satellite', 'supply cache', 'data cache', 'hyperspace marker'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

/** The printed size class of a hyperspace marker (XWA Aces High p.1
 *  "Place Obstacles": "range 3x3" / "range 1x1"). The engine writes the class;
 *  the viewer prints it and never derives a placement box. */
export const MARKER_SIZES = ['3x3', '1x1'] as const;
export type MarkerSize = (typeof MARKER_SIZES)[number];

/** The corner a hyperspace marker occupies, and the direction its blank half
 *  faces (ACES-HIGH-SPEC §S3.3, D-074). Data from the engine. */
export const MARKER_FACINGS = ['bottom-left', 'bottom-right', 'top-right', 'top-left'] as const;
export type MarkerFacing = (typeof MARKER_FACINGS)[number];

/** The side of a data cache's charge token (XWA Scenarios p.7 "DATA CACHE").
 *  The engine writes the side; the viewer draws it, and never spends or
 *  recovers one. */
export const CHARGE_STATES = ['active', 'inactive'] as const;
export type ChargeState = (typeof CHARGE_STATES)[number];

/** The colour of a printed player marker. The scenario fixes it at setup: the
 *  first player is red and the second is blue (XWA Scenarios p.5 "DETERMINE
 *  PLAYER ORDER"). The engine writes the colour; the viewer never derives it. */
export const MARKER_COLORS = ['red', 'blue'] as const;
export type MarkerColor = (typeof MARKER_COLORS)[number];

/** A scenario feature marker. The board draws a ring, not an obstacle circle;
 *  nothing here expresses a rule. `marker`/`marker_color` are present only when
 *  a player marker is on the feature (Scramble the Transmissions); `charge` is
 *  present only for a data cache (Ancient Knowledge); `marker_size`/`facing` are
 *  present only for an Aces High hyperspace marker (D-074). */
export interface ScenarioFeature {
	id: number;
	x: number;
	y: number;
	radius: number;
	kind: FeatureKind;
	/** The player whose marker is on the feature: 0 or 1. */
	marker?: number;
	marker_color?: MarkerColor;
	/** The side of a data cache's charge token. */
	charge?: ChargeState;
	/** A hyperspace marker's printed size class: "3x3" or "1x1". */
	marker_size?: MarkerSize;
	/** The corner the marker occupies and its blank side faces. */
	facing?: MarkerFacing;
}

export interface Board {
	/** Play area in millimetres. 914 ≈ 3 ft. */
	width: number;
	height: number;
	obstacles: Obstacle[];
	/** Absent or empty for the standard no-objective game. */
	features?: ScenarioFeature[];
}

export interface ReplayPlayer {
	name: string;
	faction: Faction;
	points: number;
	/** The printed 1-based seat (`P1`..`P8`) for a free-for-all format. The
	 *  writer only emits it for Aces High (D-078); `owner` on a ship is the
	 *  zero-based index into this array, while `seat` is the human label. */
	seat?: number;
	/** The seat colour as `#rrggbb`, chosen by the writer from a stable palette.
	 *  Presentation data, never derived from `faction` by the viewer. */
	color?: string;
	/** This player's marker colour, when the scenario carries the red/blue mapping. */
	marker_color?: MarkerColor;
}

export interface ReplayResult {
	winner: number | null;
	/** One mission-point total per player (two for Standard). */
	points: number[];
	/** Aces High's bounty-token totals, one per player. Absent for Standard. */
	bounty?: number[];
}

export interface ReplayMeta {
	engine: string;
	format: ReplayFormat;
	seed: number;
	date: string;
	scenario?: string;
	players: ReplayPlayer[];
	/** Aces High writes `bounty` alongside the (all-zero) mission points; the
	 *  field is absent for Standard and every scenario (D-077). */
	result?: ReplayResult;
}

export interface Replay {
	schema: 'wing-engine/replay@1';
	meta: ReplayMeta;
	board: Board;
	ships: ReplayShip[];
	frames: Frame[];
}

/** The one schema this viewer understands. */
export const REPLAY_SCHEMA = 'wing-engine/replay@1';

function fail(path: string, message: string): never {
	throw new Error(`invalid replay: ${path}: ${message}`);
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		fail(path, 'expected an object');
	}
	return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) fail(path, 'expected an array');
	return value;
}

function expectString(value: unknown, path: string): string {
	if (typeof value !== 'string') fail(path, 'expected a string');
	return value;
}

function expectNumber(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		fail(path, 'expected a finite number');
	}
	return value;
}

function expectInteger(value: unknown, path: string): number {
	const n = expectNumber(value, path);
	if (!Number.isInteger(n)) fail(path, `expected an integer, got ${n}`);
	return n;
}

function expectBoolean(value: unknown, path: string): boolean {
	if (typeof value !== 'boolean') fail(path, 'expected a boolean');
	return value;
}

/** Seat colours are CSS hex from the writer's palette, not a named closed set:
 *  a new palette entry is data and the viewer needs no table update. */
function expectHexColor(value: unknown, path: string): string {
	const text = expectString(value, path);
	if (!/^#[0-9a-f]{6}$/i.test(text)) {
		fail(path, `expected #rrggbb, got ${JSON.stringify(text)}`);
	}
	return text;
}

function expectOneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
	const text = expectString(value, path);
	if (!(allowed as readonly string[]).includes(text)) {
		fail(path, `unknown value ${JSON.stringify(text)} (expected one of ${allowed.join(', ')})`);
	}
	return text as T;
}

function expectShipId(value: unknown, ids: ReadonlySet<number>, path: string): number {
	const id = expectInteger(value, path);
	if (!ids.has(id)) fail(path, `ship id ${id} is not in ships[]`);
	return id;
}

function validateIdList(value: unknown, ids: ReadonlySet<number>, path: string): void {
	for (const [i, id] of expectArray(value, path).entries()) {
		expectShipId(id, ids, `${path}[${i}]`);
	}
}

/** A token map is `{ kind: count }`. Snapshots never carry negative counts;
 *  event badges do, because they are deltas (`focus: -1`). */
function validateTokenMap(value: unknown, path: string, allowNegative: boolean): void {
	const map = expectObject(value, path);
	for (const [kind, count] of Object.entries(map)) {
		if (!(TOKEN_KINDS as readonly string[]).includes(kind)) {
			fail(`${path}.${kind}`, `unknown token kind (the engine writes ${TOKEN_KINDS.join(', ')})`);
		}
		const n = expectInteger(count, `${path}.${kind}`);
		if (!allowNegative && n < 0) {
			fail(`${path}.${kind}`, `snapshot token count cannot be negative (${n})`);
		}
	}
}

/** A per-player count list (bounty totals, frame scoreboard): exactly one
 *  non-negative integer per player, never a fixed two-element pair. */
function validateCountList(value: unknown, players: number, path: string): void {
	const list = expectArray(value, path);
	if (list.length !== players) {
		fail(path, `expected one count per player (${players}), got ${list.length}`);
	}
	for (const [i, count] of list.entries()) {
		const n = expectInteger(count, `${path}[${i}]`);
		if (n < 0) fail(`${path}[${i}]`, `count cannot be negative (${n})`);
	}
}

function validatePose(value: unknown, path: string): void {
	const pose = expectObject(value, path);
	expectNumber(pose.x, `${path}.x`);
	expectNumber(pose.y, `${path}.y`);
	expectNumber(pose.heading, `${path}.heading`);
}

function validateMove(value: unknown, ids: ReadonlySet<number>, path: string): void {
	const move = expectObject(value, path);
	expectShipId(move.ship, ids, `${path}.ship`);
	validatePose(move.from, `${path}.from`);
	validatePose(move.to, `${path}.to`);
	expectBoolean(move.partial, `${path}.partial`);
}

function validateEvent(value: unknown, ids: ReadonlySet<number>, path: string): void {
	const event = expectObject(value, path);
	expectOneOf(event.tone, TONES, `${path}.tone`);
	expectString(event.text, `${path}.text`);
	if (event.ships !== undefined) validateIdList(event.ships, ids, `${path}.ships`);
	if (event.tokens !== undefined) validateTokenMap(event.tokens, `${path}.tokens`, true);
	if (event.dice !== undefined) {
		const dice = expectObject(event.dice, `${path}.dice`);
		for (const side of ['attack', 'defence'] as const) {
			if (dice[side] === undefined) continue;
			for (const [i, face] of expectArray(dice[side], `${path}.dice.${side}`).entries()) {
				expectOneOf(face, DIE_FACES, `${path}.dice.${side}[${i}]`);
			}
		}
	}
}

/** A feature marker list: geometry plus the optional player marker. A marker
 *  and its colour travel together, so a viewer never has to invent one. */
function validateFeatures(value: unknown, path: string): void {
	for (const [i, raw] of expectArray(value, path).entries()) {
		const featurePath = `${path}[${i}]`;
		const feature = expectObject(raw, featurePath);
		expectInteger(feature.id, `${featurePath}.id`);
		expectNumber(feature.x, `${featurePath}.x`);
		expectNumber(feature.y, `${featurePath}.y`);
		if (expectNumber(feature.radius, `${featurePath}.radius`) <= 0) {
			fail(`${featurePath}.radius`, 'must be positive');
		}
		expectOneOf(feature.kind, FEATURE_KINDS, `${featurePath}.kind`);
		if (feature.charge !== undefined) {
			expectOneOf(feature.charge, CHARGE_STATES, `${featurePath}.charge`);
			if (feature.kind !== 'data cache') {
				fail(`${featurePath}.charge`, 'only a data cache carries a charge token');
			}
		} else if (feature.kind === 'data cache') {
			fail(`${featurePath}.charge`, 'a data cache needs its charge side');
		}
		if (feature.marker !== undefined) {
			const marker = expectInteger(feature.marker, `${featurePath}.marker`);
			if (marker !== 0 && marker !== 1) {
				fail(`${featurePath}.marker`, 'expected player 0 or 1');
			}
			expectOneOf(feature.marker_color, MARKER_COLORS, `${featurePath}.marker_color`);
		} else if (feature.marker_color !== undefined) {
			fail(`${featurePath}.marker_color`, 'a marker colour needs a marker');
		}
		// A hyperspace marker's size and facing travel together: the engine
		// writes both or neither (XWA Aces High p.1 L9-11; D-074).
		if (feature.marker_size !== undefined || feature.facing !== undefined) {
			if (feature.kind !== 'hyperspace marker') {
				fail(`${featurePath}.marker_size`, 'only a hyperspace marker carries a size and facing');
			}
			expectOneOf(feature.marker_size, MARKER_SIZES, `${featurePath}.marker_size`);
			expectOneOf(feature.facing, MARKER_FACINGS, `${featurePath}.facing`);
		} else if (feature.kind === 'hyperspace marker') {
			fail(`${featurePath}.marker_size`, 'a hyperspace marker needs its size and facing');
		}
	}
}

function validateFrameShip(value: unknown, ids: ReadonlySet<number>, path: string): void {
	const ship = expectObject(value, path);
	expectShipId(ship.id, ids, `${path}.id`);
	expectNumber(ship.x, `${path}.x`);
	expectNumber(ship.y, `${path}.y`);
	expectNumber(ship.heading, `${path}.heading`);
	expectNumber(ship.hull, `${path}.hull`);
	expectNumber(ship.shields, `${path}.shields`);
	if (ship.energy !== undefined && expectNumber(ship.energy, `${path}.energy`) < 0) {
		fail(`${path}.energy`, 'cannot be negative');
	}
	expectInteger(ship.damage, `${path}.damage`);
	if (ship.crits !== undefined) expectInteger(ship.crits, `${path}.crits`);
	if (ship.towing !== undefined) {
		expectInteger(ship.towing, `${path}.towing`);
		expectOneOf(ship.towing_color, MARKER_COLORS, `${path}.towing_color`);
	} else if (ship.towing_color !== undefined) {
		fail(`${path}.towing_color`, 'a towing colour needs a carried cache');
	}
	if (ship.ancient_knowledge !== undefined) {
		expectBoolean(ship.ancient_knowledge, `${path}.ancient_knowledge`);
	}
	expectBoolean(ship.alive, `${path}.alive`);
	if (ship.lock !== null) expectShipId(ship.lock, ids, `${path}.lock`);
	if (ship.bounty_tokens !== undefined) {
		const tokens = expectInteger(ship.bounty_tokens, `${path}.bounty_tokens`);
		if (tokens < 0) fail(`${path}.bounty_tokens`, `cannot be negative (${tokens})`);
	}
	validateTokenMap(ship.tokens, `${path}.tokens`, false);
}

/**
 * Check a parsed JSON value against `wing-engine/replay@1` and return it typed.
 *
 * This is a contract check, not a game-rules check: it catches the failures
 * that would otherwise be silent in a viewer — a wrong schema, a truncated
 * frame list, a frame missing a ship, an id that names nobody, a token key the
 * engine writes and this viewer does not know. Extra fields are allowed so the
 * writer can grow without breaking an old viewer.
 */
export function validateReplay(data: unknown): Replay {
	const replay = expectObject(data, 'replay');
	if (replay.schema !== REPLAY_SCHEMA) {
		throw new Error(`unsupported replay schema: ${String(replay.schema)}`);
	}

	const meta = expectObject(replay.meta, 'meta');
	expectString(meta.engine, 'meta.engine');
	expectOneOf(meta.format, REPLAY_FORMATS, 'meta.format');
	expectNumber(meta.seed, 'meta.seed');
	expectString(meta.date, 'meta.date');
	if (meta.scenario !== undefined) expectString(meta.scenario, 'meta.scenario');
	const players = expectArray(meta.players, 'meta.players');
	if (players.length === 0) fail('meta.players', 'expected at least one player');
	const seats = new Set<number>();
	for (const [i, raw] of players.entries()) {
		const player = expectObject(raw, `meta.players[${i}]`);
		expectString(player.name, `meta.players[${i}].name`);
		expectOneOf(player.faction, FACTIONS, `meta.players[${i}].faction`);
		expectNumber(player.points, `meta.players[${i}].points`);
		// Seat and colour are the Aces identity pair (D-078). Either both are
		// present or neither is, so a viewer never has to invent one.
		if (player.seat !== undefined || player.color !== undefined) {
			const seat = expectInteger(player.seat, `meta.players[${i}].seat`);
			if (seat < 1 || seat > players.length) {
				fail(`meta.players[${i}].seat`, `expected 1..${players.length}, got ${seat}`);
			}
			if (seats.has(seat)) {
				fail(`meta.players[${i}].seat`, `duplicate seat ${seat}`);
			}
			seats.add(seat);
			expectHexColor(player.color, `meta.players[${i}].color`);
		}
		if (player.marker_color !== undefined) {
			expectOneOf(player.marker_color, MARKER_COLORS, `meta.players[${i}].marker_color`);
		}
	}
	if (meta.result !== undefined) {
		const result = expectObject(meta.result, 'meta.result');
		if (result.winner !== null) expectNumber(result.winner, 'meta.result.winner');
		const points = expectArray(result.points, 'meta.result.points');
		if (points.length !== players.length) {
			fail(
				'meta.result.points',
				`expected one score per player (${players.length}), got ${points.length}`
			);
		}
		for (const [i, score] of points.entries()) {
			expectNumber(score, `meta.result.points[${i}]`);
		}
		if (result.bounty !== undefined) {
			validateCountList(result.bounty, players.length, 'meta.result.bounty');
		}
	}

	const board = expectObject(replay.board, 'board');
	if (expectNumber(board.width, 'board.width') <= 0) fail('board.width', 'must be positive');
	if (expectNumber(board.height, 'board.height') <= 0) fail('board.height', 'must be positive');
	for (const [i, raw] of expectArray(board.obstacles, 'board.obstacles').entries()) {
		const path = `board.obstacles[${i}]`;
		const obstacle = expectObject(raw, path);
		expectNumber(obstacle.x, `${path}.x`);
		expectNumber(obstacle.y, `${path}.y`);
		if (expectNumber(obstacle.radius, `${path}.radius`) <= 0) {
			fail(`${path}.radius`, 'must be positive');
		}
		expectOneOf(obstacle.kind, OBSTACLE_KINDS, `${path}.kind`);
	}
	if (board.features !== undefined) validateFeatures(board.features, 'board.features');

	const shipList = expectArray(replay.ships, 'ships');
	if (shipList.length === 0) fail('ships', 'expected at least one ship');
	const ids = new Set<number>();
	for (const [i, raw] of shipList.entries()) {
		const path = `ships[${i}]`;
		const ship = expectObject(raw, path);
		const id = expectInteger(ship.id, `${path}.id`);
		if (id <= 0) fail(`${path}.id`, 'ship ids are 1-based');
		if (ids.has(id)) fail(`${path}.id`, `duplicate ship id ${id}`);
		ids.add(id);
		expectString(ship.name, `${path}.name`);
		expectString(ship.ship, `${path}.ship`);
		expectOneOf(ship.faction, FACTIONS, `${path}.faction`);
		if (ship.owner !== undefined) {
			const owner = expectInteger(ship.owner, `${path}.owner`);
			if (owner < 0 || owner >= players.length) {
				fail(`${path}.owner`, `player index ${owner} is outside meta.players (${players.length})`);
			}
		}
		if (expectNumber(ship.base, `${path}.base`) <= 0) fail(`${path}.base`, 'must be positive');
		if (ship.base_length !== undefined) {
			if (expectNumber(ship.base_length, `${path}.base_length`) <= 0) {
				fail(`${path}.base_length`, 'must be positive');
			}
		}
		if (ship.energy_capacity !== undefined) {
			if (expectNumber(ship.energy_capacity, `${path}.energy_capacity`) < 0) {
				fail(`${path}.energy_capacity`, 'cannot be negative');
			}
		}
		for (const key of ['energy_recurring', 'shield_recurring'] as const) {
			if (ship[key] === undefined) continue;
			if (expectInteger(ship[key], `${path}.${key}`) < 0) {
				fail(`${path}.${key}`, 'cannot be negative');
			}
		}
		expectInteger(ship.initiative, `${path}.initiative`);
		expectNumber(ship.hull, `${path}.hull`);
		expectNumber(ship.shields, `${path}.shields`);
		expectNumber(ship.agility, `${path}.agility`);
		expectOneOf(ship.arc, ARC_KINDS, `${path}.arc`);
		if (ship.cards !== undefined) {
			for (const [j, raw] of expectArray(ship.cards, `${path}.cards`).entries()) {
				const card = expectObject(raw, `${path}.cards[${j}]`);
				const xws = expectString(card.xws, `${path}.cards[${j}].xws`);
				if (xws.length === 0) fail(`${path}.cards[${j}].xws`, 'cannot be empty');
				expectString(card.name, `${path}.cards[${j}].name`);
				// Printed text is engine data. It is optional, and when present
				// must be a string; the viewer never fabricates a replacement.
				if (card.text !== undefined) {
					expectString(card.text, `${path}.cards[${j}].text`);
				}
			}
		}
		if (ship.maneuvers !== undefined) {
			for (const [j, text] of expectArray(ship.maneuvers, `${path}.maneuvers`).entries()) {
				expectString(text, `${path}.maneuvers[${j}]`);
			}
		}
	}

	const frameList = expectArray(replay.frames, 'frames');
	if (frameList.length === 0) fail('frames', 'expected at least one frame');
	const frameNumbers = new Set<number>();
	for (const [i, raw] of frameList.entries()) {
		const path = `frames[${i}]`;
		const frame = expectObject(raw, path);
		const n = expectInteger(frame.n, `${path}.n`);
		if (frameNumbers.has(n)) fail(`${path}.n`, `duplicate frame number ${n}`);
		frameNumbers.add(n);
		expectInteger(frame.round, `${path}.round`);
		expectString(frame.phase, `${path}.phase`);
		if (frame.active !== null) expectShipId(frame.active, ids, `${path}.active`);

		const frameShips = expectArray(frame.ships, `${path}.ships`);
		if (frameShips.length !== shipList.length) {
			fail(
				`${path}.ships`,
				`expected one snapshot per ship (${shipList.length}), got ${frameShips.length}`
			);
		}
		const seen = new Set<number>();
		for (const [j, snapshot] of frameShips.entries()) {
			const shipPath = `${path}.ships[${j}]`;
			validateFrameShip(snapshot, ids, shipPath);
			const id = (snapshot as Record<string, unknown>).id as number;
			if (seen.has(id)) fail(`${shipPath}.id`, `duplicate snapshot for ship ${id}`);
			seen.add(id);
		}

		if (frame.features !== undefined) validateFeatures(frame.features, `${path}.features`);
		if (frame.scores !== undefined) {
			validateCountList(frame.scores, players.length, `${path}.scores`);
		}

		const events = expectArray(frame.events, `${path}.events`);
		if (events.length === 0) fail(`${path}.events`, 'expected at least one event');
		for (const [j, event] of events.entries()) {
			validateEvent(event, ids, `${path}.events[${j}]`);
		}

		if (frame.moves !== undefined) {
			for (const [j, move] of expectArray(frame.moves, `${path}.moves`).entries()) {
				validateMove(move, ids, `${path}.moves[${j}]`);
			}
		}
		if (frame.highlight !== undefined) {
			const highlight = expectObject(frame.highlight, `${path}.highlight`);
			for (const side of ['attackers', 'defenders'] as const) {
				if (highlight[side] !== undefined) {
					validateIdList(highlight[side], ids, `${path}.highlight.${side}`);
				}
			}
		}
	}

	return replay as unknown as Replay;
}

/** Fetch a replay and validate it before the board ever sees it. */
export async function loadReplay(url: string): Promise<Replay> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return validateReplay(await res.json());
}

export function shipById(replay: Replay, id: number | null): ReplayShip | undefined {
	if (id === null) return undefined;
	return replay.ships.find((s) => s.id === id);
}

/** Tokens in a stable display order, so the badges do not jump between frames.
 *  The order is the canonical `TOKEN_KINDS` list: one place to add a token. */
export const TOKEN_ORDER: readonly TokenKind[] = TOKEN_KINDS;

export const TOKEN_LABEL: Record<TokenKind, string> = {
	focus: 'Focus',
	evade: 'Evade',
	stress: 'Stress',
	strain: 'Strain',
	ion: 'Ion',
	lock: 'Lock',
	tractor: 'Tractor',
	deplete: 'Deplete',
	jam: 'Jam',
	reinforce: 'Reinforce',
	'reinforce-fore': 'Reinforce (fore)',
	'reinforce-aft': 'Reinforce (aft)',
	calculate: 'Calculate',
	disarm: 'Disarm',
	cloak: 'Cloak'
};

/** Short badge label. Letters, not symbols: glyph coverage across the fonts in
 *  play is unreliable and a tofu box in a debug tool is worse than a letter.
 *  Case is meaningful (`F` focus vs `f` reinforce-fore), and the badge circle
 *  only has room for one character. */
export const TOKEN_ABBR: Record<TokenKind, string> = {
	focus: 'F',
	evade: 'E',
	stress: 'S',
	strain: 's',
	ion: 'I',
	lock: 'L',
	tractor: 'T',
	deplete: 'd',
	jam: 'J',
	reinforce: 'R',
	'reinforce-fore': 'f',
	'reinforce-aft': 'a',
	calculate: 'C',
	disarm: 'D',
	cloak: 'K'
};

export const TOKEN_COLOR: Record<TokenKind, string> = {
	focus: '#ffb347',
	evade: '#3ad1ff',
	stress: '#ff5555',
	strain: '#ff8c66',
	ion: '#a78bfa',
	lock: '#ffd166',
	tractor: '#9ae6b4',
	deplete: '#dc2626',
	jam: '#e879f9',
	reinforce: '#60a5fa',
	'reinforce-fore': '#60a5fa',
	'reinforce-aft': '#818cf8',
	calculate: '#e5e7eb',
	disarm: '#fb7185',
	cloak: '#9ca3af'
};
