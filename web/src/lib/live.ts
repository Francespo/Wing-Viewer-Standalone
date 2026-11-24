/**
 * Live game client for `wing-engine/live@1`.
 *
 * The contract mirrors `crates/we-view/src/live.rs`. A question contains only
 * engine-produced option ids; the browser posts one back and never computes
 * legality, range, arcs, damage or scoring. Board geometry is presentation.
 */
import type {
	Board,
	DieFace,
	Frame,
	FrameEvent,
	ReplayFormat,
	ReplayPlayer,
	ReplayShip
} from './replay';
import { FEATURE_KINDS } from './replay';

export const LIVE_SCHEMA = 'wing-engine/live@1';

/** The seed-7 Standard game stays the default identity of `/play`. */
export const DEFAULT_SEED = 7;
export const DEFAULT_FORMAT: ReplayFormat = 'standard-50p';

/** The formats the setup page offers. These ids are posted verbatim; the
 *  server constructs Epic through `Format::new_game` + `we_data::epic_squads`,
 *  never a Standard or card-demo fallback. */
export const PLAY_FORMATS: readonly { id: ReplayFormat; label: string }[] = [
	{ id: 'standard-50p', label: 'Standard 50P' },
	{ id: 'aces-high', label: 'Aces High' },
	{ id: 'epic-xwa', label: 'Epic XWA (100P)' },
	{ id: 'epic-house', label: 'Epic House (100P)' }
];

export const QUESTION_KINDS = [
	'dial',
	'action',
	'damage-card',
	'lock-target',
	'barrel-roll',
	'attack',
	'attack-dice',
	'defence-dice',
	'optional',
	'choose-ship',
	'token',
	'setup-pose',
	'ship-pose',
	'free-ship-pose',
	'batch-ship-pose',
	'obstacle-setup',
	'effect-choice',
	'reinforce',
	'reload',
	'jam-effect',
	'choice'
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const GAME_STATUSES = ['asking', 'running', 'done', 'error'] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export type DiceView = NonNullable<FrameEvent['dice']>;

export interface OptionView {
	/** Opaque engine id. Post this back verbatim. */
	id: string;
	/** Engine-phrased label, e.g. "2 bank left (white)". */
	label: string;
	/** Optional grouping, e.g. "Speed 2" or a weapon name. */
	group?: string;
	/** 1-based ship id from `frame.ships`, when the option names a ship. */
	ship?: number;
	/** Engine action key, for icon/colour choices only. */
	action?: string;
	/** Special weapon name. Absent for a primary attack. */
	weapon?: string;
	decline?: boolean;
	/** Only for setup/deployment poses: a legal placement projected by the engine. */
	pose?: { x: number; y: number; heading: number; heading_tenths?: number };
	/** D-174: a printed action the engine refused (e.g. Lock with no target in range). */
	disabled?: boolean;
	/** Why the option is disabled, in engine-produced prose. */
	disabled_reason?: string;
	/** False for a printed branch the engine proved cannot resolve. */
	available?: boolean;
}

/** One ship's engine-produced candidate list in a batch confirmation. */
export interface PlacementView {
	/** 1-based ship id. */
	ship: number;
	candidates: { x: number; y: number; heading: number; heading_tenths?: number }[];
	default: { x: number; y: number; heading: number; heading_tenths?: number };
}

export interface Question {
	id: number;
	player: number;
	/** 1-based ship id. */
	ship: number;
	target?: number;
	kind: QuestionKind;
	prompt: string;
	options: OptionView[];
	/** Public snapshot; `events` is empty because a prompt is not an event. */
	frame: Frame;
	dice?: DiceView;
	/** Batch deployment questions only: one entry per ship, in reply order. */
	placements?: PlacementView[];
	/** Dial questions only: counts (never dial values), engine-produced. */
	dials_set?: number;
	dials_total?: number;
}

export interface GameHeader {
	schema: string;
	engine: string;
	seed: number;
	human: number;
	format: string;
	scenario?: string;
	/** Named preset squads, e.g. `card-demo` or `card-demo-focus`. Absent on
	 *  the default game. */
	squad?: string;
	/** True when both owners answer on this browser. Absent on human-vs-bot. */
	hotseat?: boolean;
	players: ReplayPlayer[];
	ships: ReplayShip[];
	board: Board;
}

export interface GameResult {
	winner: number | null;
	points: [number, number];
	round: number;
	/** Hex, because a 64-bit hash does not fit a JavaScript number. */
	state_hash: string;
	over: boolean;
}

export interface GameResponse {
	id: string;
	status: GameStatus;
	header: GameHeader;
	frames: Frame[];
	question: Question | null;
	result: GameResult | null;
	error?: string | null;
}

/** Public card identity from `GET /api/squads`. The engine owns every rule; the
 *  setup preview only renders this metadata. */
export interface PresetCard {
	xws: string;
	name: string;
	slot: string;
}

export interface PresetShip {
	/** Zero-based player side. */
	player: number;
	/** Optional catalog ship index, present on preview rows. */
	index?: number;
	/** Optional faction label, present when the preview has a catalog row. */
	faction?: string;
	pilot: string;
	ship: string;
	cards: PresetCard[];
}

/** One compiled card the server offers in a demo slot. */
export interface LoadoutOption extends PresetCard {
	/** Stable request id. Post it back verbatim. */
	id: string;
	points: number;
	factions: string[];
	unique: boolean;
	limited: number;
	/** Additional slot kinds this card consumes without adding a slot. */
	also_occupies: string[];
	/** Slot kinds this card removes from the pilot's bar. */
	unequips: string[];
	/** Slot kinds this card adds to the pilot's bar. */
	confers_addons: string[];
}

/** The fixed remainder card's public listbuilding identity. */
export interface LoadoutCard extends PresetCard {
	points: number;
	factions: string[];
	unique: boolean;
	limited: number;
}

/** One committed pilot row the server can price on a fixed demo chassis. */
export interface PilotOption {
	/** Stable request id: the exact listbuilding pilot XWS. */
	id: string;
	name: string;
	initiative: number;
	/** Pilot points. These are the 50P squad points; upgrades are loadout. */
	points: number;
	loadout: number;
	limited: number;
	unique: boolean;
	/** Exact faction id, e.g. rebelalliance. */
	faction: string;
	/** This pilot's own bar, in printed order; conditional slots are latent. */
	slots: LoadoutSlot[];
}

/** One upgrade slot on a fixed demo ship; conditional slots are latent. */
export interface LoadoutSlot {
	index: number;
	/** Stable selection key, unique even when a kind repeats (`device#2`). */
	key: string;
	/** Display name, e.g. Astromech. */
	slot: string;
	/** Canonical listbuilding kind, e.g. astromech. */
	kind: string;
	fixed: boolean;
	fixed_card: LoadoutCard | null;
	/** The default option for this slot, when one is selected by default. */
	default_option: string | null;
	options: LoadoutOption[];
	/** True for a slot that only a selected card's confers_addons can open. */
	conditional: boolean;
}

/** One curated committed pilot the dynamic listbuilder can put on a side.
 *  `PilotOption` already carries the pilot's own bar; the extra fields keep the
 *  real chassis identity and stats so joining a ship never borrows another
 *  chassis' numbers. */
export interface CustomPilot extends PilotOption {
	/** Chassis display name, e.g. T-65 X-wing. */
	ship: string;
	/** Committed chassis xws, e.g. t65xwing. */
	chassis: string;
	/** Display faction label. */
	faction_label: string;
	attack: number;
	agility: number;
	hull: number;
	shields: number;
	/** Small, Medium, Large or Huge. */
	base: string;
	/** True for committed Epic-only content (including every Huge base). */
	epic_only: boolean;
	force_capacity: number;
}

/** One fixed demo ship with its full printed bar and legacy one-slot view. */
export interface LoadoutShip {
	/** Zero-based position in the request array. */
	index: number;
	player: number;
	/** Default pilot name; `pilots` lists every selectable row. */
	pilot: string;
	ship: string;
	/** Committed chassis xws, e.g. tieddefender. */
	chassis: string;
	faction: string;
	/** Default pilot's squad points. */
	points: number;
	/** Default pilot's loadout value. */
	loadout: number;
	limited: number;
	unique: boolean;
	/** Pilot id selected when the request omits `pilots`. */
	default_pilot: string;
	pilots: PilotOption[];
	/** Legacy default slot display name. */
	slot: string;
	default_slot: number;
	default_option: string;
	fixed_cards: LoadoutCard[];
	fixed_points: number;
	slots: LoadoutSlot[];
	/** Compatibility projection: the legacy default slot's options. */
	options: LoadoutOption[];
}

export interface LoadoutViolation {
	code: string;
	message: string;
	rule: string;
}

export interface LoadoutSide {
	player: number;
	faction: string;
	ship_count: number;
	/** Pilot points only: the real 50P squad total. */
	points: number;
	point_cap: number;
	over_cap: boolean;
	legal_50: boolean;
	violations: LoadoutViolation[];
}

export interface LoadoutDataGaps {
	compiled_without_listbuilding: number;
	excluded_slot_rewriting: number;
	/** Rewriting rows that cannot be offered at all; each has an exact reason. */
	uncatalogued_slot_rewriting?: number;
	slot_rewriting_gaps?: Array<{ xws: string; name: string; reason: string }>;
	note: string;
}

/** One committed pilot row the browser cannot expose, with its exact reason. */
export interface PilotPoolOmission {
	id: string;
	name: string;
	ship: string;
	chassis: string;
	faction: string;
	reason: string;
}

/** Committed/curated/pool counts and every omitted row's reason. */
export interface PilotPoolReport {
	committed_rows: number;
	curated_rows: number;
	pool_rows: number;
	pool_chassis: number;
	omitted_rows: number;
	omissions: PilotPoolOmission[];
	note: string;
}

export interface LoadoutCatalog {
	squad: string;
	ships: LoadoutShip[];
	/** Curated committed 50P rows for the dynamic listbuilder. */
	pilot_pool: CustomPilot[];
	/** The server's own committed/curated/pool counts and omission reasons. */
	pilot_pool_report: PilotPoolReport;
	min_ships: number;
	max_ships: number;
	/** The committed Standard points floor from `[listbuilding]`. */
	points_min: number;
	total_points: number;
	point_cap: number;
	legal_50: boolean;
	legality_note: string;
	sides: LoadoutSide[];
	data_gaps: LoadoutDataGaps;
}

/** One `[[listbuilding.special_caps]]` row, e.g. Aces High's per-pilot cap. */
export interface FormatSpecialCap {
	kind: string;
	value: number;
	applies_to: string;
}

/** `[listbuilding]` from the committed format document. The builder validates
 *  against these fields; none of these numbers is written in TypeScript. */
export interface FormatListbuilding {
	points_min: number;
	points_max: number;
	ships_min: number;
	ships_max: number;
	faction: string;
	loadout: string;
	restricted_list: boolean;
	deficit: boolean;
	huge_ships_allowed: boolean;
	huge_ships_min: number;
	max_huge_ships: number;
	max_points_on_huge: number;
	command_slot_allowed: boolean;
	special_caps: FormatSpecialCap[];
}

/** The engine-relevant view of one committed format. */
export interface FormatSpecView {
	id: string;
	name: string;
	max_squad_points: number;
	min_ships: number;
	max_ships: number;
	rounds: number;
	play_area_mm: number;
	min_players: number;
	max_players: number;
	teams: string;
	huge_ships_allowed: boolean;
	command_slot_allowed: boolean;
	respawn: boolean;
	scenario_pool: string;
	victory_threshold: number;
}

/** One row of `GET /api/formats`: committed data plus two server capability
 *  facts. `custom_lineup_playable` is false when Start cannot use a custom
 *  lineup even though the list can be validated and published. */
export interface FormatInfo {
	spec: FormatSpecView;
	listbuilding: FormatListbuilding;
	provenance: string;
	official: boolean;
	version: string;
	effective: string;
	custom_lineup_playable: boolean;
	custom_lineup_note: string | null;
}

export interface FormatsResponse {
	formats: FormatInfo[];
}

export interface CardPreset {
	id: string;
	label: string;
	description: string;
	ships: PresetShip[];
}

export interface SquadsResponse {
	presets: CardPreset[];
}

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

function fail(path: string, message: string): never {
	throw new Error(`invalid game response: ${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		fail(path, 'expected an object');
	}
	return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) fail(path, 'expected an array');
	return value;
}

function string(value: unknown, path: string): string {
	if (typeof value !== 'string') fail(path, 'expected a string');
	return value;
}

function integer(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		fail(path, 'expected an integer');
	}
	return value;
}

function boolean(value: unknown, path: string): boolean {
	if (typeof value !== 'boolean') fail(path, 'expected a boolean');
	return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
	const text = string(value, path);
	if (!(allowed as readonly string[]).includes(text)) {
		fail(path, `unknown value ${JSON.stringify(text)}`);
	}
	return text as T;
}

function validateFrame(value: unknown, path: string, requireEvents: boolean): void {
	const frame = object(value, path);
	integer(frame.n, `${path}.n`);
	integer(frame.round, `${path}.round`);
	string(frame.phase, `${path}.phase`);
	if (frame.active !== null) integer(frame.active, `${path}.active`);
	for (const [i, raw] of array(frame.ships, `${path}.ships`).entries()) {
		const ship = object(raw, `${path}.ships[${i}]`);
		integer(ship.id, `${path}.ships[${i}].id`);
		for (const key of ['x', 'y', 'heading', 'hull', 'shields']) {
			if (typeof ship[key] !== 'number') fail(`${path}.ships[${i}].${key}`, 'expected a number');
		}
		if (ship.energy !== undefined && typeof ship.energy !== 'number') {
			fail(`${path}.ships[${i}].energy`, 'expected a number');
		}
		boolean(ship.alive, `${path}.ships[${i}].alive`);
		object(ship.tokens, `${path}.ships[${i}].tokens`);
	}
	const events = array(frame.events, `${path}.events`);
	if (requireEvents && events.length === 0) fail(`${path}.events`, 'expected at least one event');
	for (const [i, raw] of events.entries()) {
		const event = object(raw, `${path}.events[${i}]`);
		string(event.tone, `${path}.events[${i}].tone`);
		string(event.text, `${path}.events[${i}].text`);
	}
}

function validatePose(value: unknown, path: string): void {
	const pose = object(value, path);
	for (const key of ['x', 'y', 'heading'] as const) {
		integer(pose[key], `${path}.${key}`);
	}
	if (pose.heading_tenths !== undefined) integer(pose.heading_tenths, `${path}.heading_tenths`);
}

function validateOption(value: unknown, path: string): OptionView {
	const option = object(value, path);
	const id = string(option.id, `${path}.id`);
	if (id.length === 0) fail(`${path}.id`, 'option id cannot be empty');
	string(option.label, `${path}.label`);
	if (option.group !== undefined) string(option.group, `${path}.group`);
	if (option.ship !== undefined) integer(option.ship, `${path}.ship`);
	if (option.action !== undefined) string(option.action, `${path}.action`);
	if (option.weapon !== undefined) string(option.weapon, `${path}.weapon`);
	if (option.decline !== undefined) boolean(option.decline, `${path}.decline`);
	if (option.pose !== undefined) validatePose(option.pose, `${path}.pose`);
	if (option.disabled !== undefined) boolean(option.disabled, `${path}.disabled`);
	if (option.disabled_reason !== undefined) string(option.disabled_reason, `${path}.disabled_reason`);
	if (option.available !== undefined) boolean(option.available, `${path}.available`);
	return option as unknown as OptionView;
}

function validateQuestion(value: unknown, path: string): Question {
	const question = object(value, path);
	integer(question.id, `${path}.id`);
	integer(question.player, `${path}.player`);
	integer(question.ship, `${path}.ship`);
	if (question.target !== undefined) integer(question.target, `${path}.target`);
	oneOf(question.kind, QUESTION_KINDS, `${path}.kind`);
	string(question.prompt, `${path}.prompt`);
	const options = array(question.options, `${path}.options`);
	if (options.length === 0) fail(`${path}.options`, 'a question needs at least one option');
	const ids = new Set<string>();
	for (const [i, option] of options.entries()) {
		const view = validateOption(option, `${path}.options[${i}]`);
		if (ids.has(view.id)) fail(`${path}.options[${i}].id`, `duplicate option id ${view.id}`);
		ids.add(view.id);
	}
	if (question.placements !== undefined) {
		for (const [i, raw] of array(question.placements, `${path}.placements`).entries()) {
			const placement = object(raw, `${path}.placements[${i}]`);
			integer(placement.ship, `${path}.placements[${i}].ship`);
			for (const [j, pose] of array(placement.candidates, `${path}.placements[${i}].candidates`).entries()) {
				validatePose(pose, `${path}.placements[${i}].candidates[${j}]`);
			}
			validatePose(placement.default, `${path}.placements[${i}].default`);
		}
	}
	validateFrame(question.frame, `${path}.frame`, false);
	if (question.dice !== undefined) {
		const dice = object(question.dice, `${path}.dice`);
		for (const side of ['attack', 'defence'] as const) {
			if (dice[side] === undefined) continue;
			for (const [i, face] of array(dice[side], `${path}.dice.${side}`).entries()) {
				oneOf<DieFace>(face, ['hit', 'crit', 'focus', 'evade', 'blank'], `${path}.dice.${side}[${i}]`);
			}
		}
	}
	return question as unknown as Question;
}

/**
 * Validate the live contract before it reaches a component. Extra fields are
 * allowed so the Rust projection can grow; a missing id or a kind this client
 * does not render is an error, not a silent no-op.
 */
export function validateGameResponse(data: unknown): GameResponse {
	const response = object(data, 'response');
	const id = string(response.id, 'response.id');
	if (id.length === 0) fail('response.id', 'cannot be empty');
	const status = oneOf(response.status, GAME_STATUSES, 'response.status');
	const header = object(response.header, 'response.header');
	if (header.schema !== LIVE_SCHEMA) {
		fail('response.header.schema', `expected ${LIVE_SCHEMA}, got ${JSON.stringify(header.schema)}`);
	}
	string(header.engine, 'response.header.engine');
	integer(header.seed, 'response.header.seed');
	integer(header.human, 'response.header.human');
	string(header.format, 'response.header.format');
	if (header.scenario !== undefined) string(header.scenario, 'response.header.scenario');
	if (header.squad !== undefined) string(header.squad, 'response.header.squad');
	if (header.hotseat !== undefined) boolean(header.hotseat, 'response.header.hotseat');
	const players = array(header.players, 'response.header.players');
	if (players.length !== 2) fail('response.header.players', 'expected two players');
	for (const [i, raw] of players.entries()) {
		const player = object(raw, `response.header.players[${i}]`);
		string(player.name, `response.header.players[${i}].name`);
		string(player.faction, `response.header.players[${i}].faction`);
		integer(player.points, `response.header.players[${i}].points`);
	}
	const ships = array(header.ships, 'response.header.ships');
	if (ships.length === 0) fail('response.header.ships', 'expected at least one ship');
	const shipIds = new Set<number>();
	for (const [i, raw] of ships.entries()) {
		const ship = object(raw, `response.header.ships[${i}]`);
		const shipId = integer(ship.id, `response.header.ships[${i}].id`);
		shipIds.add(shipId);
		string(ship.name, `response.header.ships[${i}].name`);
		string(ship.ship, `response.header.ships[${i}].ship`);
		string(ship.faction, `response.header.ships[${i}].faction`);
		for (const key of ['base', 'initiative', 'hull', 'shields', 'agility']) {
			if (typeof ship[key] !== 'number') fail(`response.header.ships[${i}].${key}`, 'expected a number');
		}
		if (ship.base_length !== undefined && typeof ship.base_length !== 'number') {
			fail(`response.header.ships[${i}].base_length`, 'expected a number');
		}
		for (const key of ['energy_capacity', 'energy_recurring', 'shield_recurring'] as const) {
			if (ship[key] !== undefined && typeof ship[key] !== 'number') {
				fail(`response.header.ships[${i}].${key}`, 'expected a number');
			}
		}
		string(ship.arc, `response.header.ships[${i}].arc`);
		if (ship.cards !== undefined) {
			for (const [j, raw] of array(ship.cards, `response.header.ships[${i}].cards`).entries()) {
				const card = object(raw, `response.header.ships[${i}].cards[${j}]`);
				if (string(card.xws, `response.header.ships[${i}].cards[${j}].xws`).length === 0) {
					fail(`response.header.ships[${i}].cards[${j}].xws`, 'cannot be empty');
				}
				string(card.name, `response.header.ships[${i}].cards[${j}].name`);
			}
		}
	}
	const board = object(header.board, 'response.header.board');
	for (const key of ['width', 'height'] as const) {
		if (typeof board[key] !== 'number' || board[key] <= 0) {
			fail(`response.header.board.${key}`, 'expected a positive number');
		}
	}
	for (const [i, raw] of array(board.obstacles, 'response.header.board.obstacles').entries()) {
		const obstacle = object(raw, `response.header.board.obstacles[${i}]`);
		for (const key of ['x', 'y', 'radius']) {
			if (typeof obstacle[key] !== 'number') {
				fail(`response.header.board.obstacles[${i}].${key}`, 'expected a number');
			}
		}
		string(obstacle.kind, `response.header.board.obstacles[${i}].kind`);
	}
	if (board.features !== undefined) {
		for (const [i, raw] of array(board.features, 'response.header.board.features').entries()) {
			const feature = object(raw, `response.header.board.features[${i}]`);
			integer(feature.id, `response.header.board.features[${i}].id`);
			for (const key of ['x', 'y', 'radius']) {
				if (typeof feature[key] !== 'number') {
					fail(`response.header.board.features[${i}].${key}`, 'expected a number');
				}
			}
			const kind = string(feature.kind, `response.header.board.features[${i}].kind`);
			if (!(FEATURE_KINDS as readonly string[]).includes(kind)) {
				fail(`response.header.board.features[${i}].kind`, `unknown feature kind ${kind}`);
			}
		}
	}

	for (const [i, raw] of array(response.frames, 'response.frames').entries()) {
		validateFrame(raw, `response.frames[${i}]`, true);
	}

	const question = response.question === null ? null : validateQuestion(response.question, 'response.question');
	let result: GameResult | null = null;
	if (response.result !== null) {
		const raw = object(response.result, 'response.result');
		const winner = raw.winner;
		if (winner !== null) integer(winner, 'response.result.winner');
		const points = array(raw.points, 'response.result.points');
		if (points.length !== 2) fail('response.result.points', 'expected two scores');
		for (const [i, point] of points.entries()) integer(point, `response.result.points[${i}]`);
		integer(raw.round, 'response.result.round');
		string(raw.state_hash, 'response.result.state_hash');
		boolean(raw.over, 'response.result.over');
		result = raw as unknown as GameResult;
	}
	if (response.error !== undefined && response.error !== null) string(response.error, 'response.error');
	if (status === 'asking' && question === null) fail('response.question', 'an asking game needs a question');
	if (status === 'done' && result === null) fail('response.result', 'a done game needs a result');

	// The question frame must describe the same ships as the header. This is a
	// projection check, not a rules check.
	for (const [i, raw] of (question?.frame.ships ?? []).entries()) {
		const ship = object(raw, `response.question.frame.ships[${i}]`);
		if (!shipIds.has(integer(ship.id, `response.question.frame.ships[${i}].id`))) {
			fail(`response.question.frame.ships[${i}].id`, 'ship is not in header.ships');
		}
	}

	return response as unknown as GameResponse;
}

function validatePresetCard(value: unknown, path: string): void {
	const card = object(value, path);
	for (const key of ['xws', 'name', 'slot'] as const) {
		if (string(card[key], `${path}.${key}`).length === 0) {
			fail(`${path}.${key}`, 'cannot be empty');
		}
	}
}

/** Validate the setup-preview metadata before the play page offers it. */
export function validateSquadsResponse(data: unknown): SquadsResponse {
	const response = object(data, 'squads');
	const presets = array(response.presets, 'squads.presets');
	if (presets.length === 0) fail('squads.presets', 'expected at least one preset');
	const ids = new Set<string>();
	for (const [i, raw] of presets.entries()) {
		const path = `squads.presets[${i}]`;
		const preset = object(raw, path);
		const id = string(preset.id, `${path}.id`);
		if (id.length === 0) fail(`${path}.id`, 'cannot be empty');
		if (ids.has(id)) fail(`${path}.id`, `duplicate preset id ${id}`);
		ids.add(id);
		if (string(preset.label, `${path}.label`).length === 0) {
			fail(`${path}.label`, 'cannot be empty');
		}
		if (string(preset.description, `${path}.description`).length === 0) {
			fail(`${path}.description`, 'cannot be empty');
		}
		const ships = array(preset.ships, `${path}.ships`);
		if (ships.length === 0) fail(`${path}.ships`, 'expected at least one ship');
		for (const [j, rawShip] of ships.entries()) {
			const shipPath = `${path}.ships[${j}]`;
			const ship = object(rawShip, shipPath);
			const player = integer(ship.player, `${shipPath}.player`);
			if (player < 0) fail(`${shipPath}.player`, 'cannot be negative');
			if (string(ship.pilot, `${shipPath}.pilot`).length === 0) {
				fail(`${shipPath}.pilot`, 'cannot be empty');
			}
			if (string(ship.ship, `${shipPath}.ship`).length === 0) {
				fail(`${shipPath}.ship`, 'cannot be empty');
			}
			const cards = array(ship.cards, `${shipPath}.cards`);
			for (const [k, rawCard] of cards.entries()) {
				validatePresetCard(rawCard, `${shipPath}.cards[${k}]`);
			}
		}
	}
	return response as unknown as SquadsResponse;
}

/** Validate a slot bar without assuming it is the ship's default bar. A
 *  pilot may print an empty bar; its options still have to be internally
 *  consistent with the committed catalog shape. */
function validateSlotList(raw: unknown, path: string): LoadoutSlot[] {
	const slots = array(raw, path);
	const keys = new Set<string>();
	for (const [index, rawSlot] of slots.entries()) {
		const slotPath = `${path}[${index}]`;
		const slot = object(rawSlot, slotPath);
		if (integer(slot.index, `${slotPath}.index`) !== index) {
			fail(`${slotPath}.index`, 'must equal the slot array position');
		}
		const slotName = string(slot.slot, `${slotPath}.slot`);
		const kind = string(slot.kind, `${slotPath}.kind`);
		const key = string(slot.key, `${slotPath}.key`);
		if (slotName.length === 0) fail(`${slotPath}.slot`, 'cannot be empty');
		if (kind.length === 0) fail(`${slotPath}.kind`, 'cannot be empty');
		if (key.length === 0) fail(`${slotPath}.key`, 'cannot be empty');
		if (keys.has(key)) fail(`${slotPath}.key`, `duplicate slot key ${key}`);
		keys.add(key);
		const isFixed = boolean(slot.fixed, `${slotPath}.fixed`);
		const conditional =
			slot.conditional === undefined ? false : boolean(slot.conditional, `${slotPath}.conditional`);
		slot.conditional = conditional;
		const fixedCard = slot.fixed_card;
		if (isFixed) {
			if (fixedCard === null || fixedCard === undefined) {
				fail(`${slotPath}.fixed_card`, 'a fixed slot needs its fixed card');
			}
			validateLoadoutCard(fixedCard, `${slotPath}.fixed_card`);
		} else if (fixedCard !== null && fixedCard !== undefined) {
			fail(`${slotPath}.fixed_card`, 'only a fixed slot may carry a fixed card');
		}
		const slotDefault = slot.default_option;
		let defaultId: string | null = null;
		if (slotDefault !== null && slotDefault !== undefined) {
			defaultId = string(slotDefault, `${slotPath}.default_option`);
			if (defaultId.length === 0) fail(`${slotPath}.default_option`, 'cannot be empty');
		}
		const options = array(slot.options, `${slotPath}.options`);
		const normalizedOptions: LoadoutOption[] = [];
		const ids = new Set<string>();
		for (const [optionIndex, rawOption] of options.entries()) {
			const optionPath = `${slotPath}.options[${optionIndex}]`;
			const option = validateLoadoutOption(rawOption, optionPath);
			normalizedOptions.push(option);
			if (string(option.slot, `${optionPath}.slot`) !== slotName) {
				fail(`${optionPath}.slot`, `expected slot ${slotName}`);
			}
			if (option.id !== `${kind}:${option.xws}`) {
				fail(`${optionPath}.id`, `expected ${kind}:${option.xws}`);
			}
			if (ids.has(option.id)) fail(`${optionPath}.id`, `duplicate option id ${option.id}`);
			ids.add(option.id);
		}
		slot.options = normalizedOptions;
		if (isFixed && options.length > 0) {
			fail(`${slotPath}.options`, 'a fixed slot cannot have selectable options');
		}
		if (defaultId !== null && !ids.has(defaultId)) {
			fail(`${slotPath}.default_option`, `unknown option id ${defaultId}`);
		}
	}
	return slots as unknown as LoadoutSlot[];
}

function validatePilotOption(data: unknown, path: string): PilotOption {
	const pilot = object(data, path);
	const id = string(pilot.id, `${path}.id`);
	if (id.length === 0) fail(`${path}.id`, 'cannot be empty');
	if (string(pilot.name, `${path}.name`).length === 0) fail(`${path}.name`, 'cannot be empty');
	if (string(pilot.faction, `${path}.faction`).length === 0) {
		fail(`${path}.faction`, 'cannot be empty');
	}
	if (integer(pilot.initiative, `${path}.initiative`) < 0) {
		fail(`${path}.initiative`, 'cannot be negative');
	}
	if (integer(pilot.points, `${path}.points`) < 0) fail(`${path}.points`, 'cannot be negative');
	if (integer(pilot.loadout, `${path}.loadout`) < 0) fail(`${path}.loadout`, 'cannot be negative');
	const limited = integer(pilot.limited, `${path}.limited`);
	if (limited < 0) fail(`${path}.limited`, 'cannot be negative');
	if (boolean(pilot.unique, `${path}.unique`) !== (limited === 1)) {
		fail(`${path}.unique`, 'must match limited === 1');
	}
	validateSlotList(pilot.slots, `${path}.slots`);
	return pilot as unknown as PilotOption;
}

function validateCustomPilot(data: unknown, path: string): CustomPilot {
	const pilot = validatePilotOption(data, path);
	const raw = pilot as unknown as Record<string, unknown>;
	for (const key of ['ship', 'chassis', 'faction_label', 'base'] as const) {
		if (string(raw[key], `${path}.${key}`).length === 0) {
			fail(`${path}.${key}`, 'cannot be empty');
		}
	}
	boolean(raw.epic_only, `${path}.epic_only`);
	for (const key of ['attack', 'agility', 'hull', 'shields', 'force_capacity'] as const) {
		if (integer(raw[key], `${path}.${key}`) < 0) {
			fail(`${path}.${key}`, 'cannot be negative');
		}
	}
	return pilot as CustomPilot;
}

/** Validate `GET /api/loadout-catalog`. The browser does not choose slots or
 *  legality: every option here is already the server's compiled projection. */
export function validateLoadoutCatalog(data: unknown): LoadoutCatalog {
	const response = object(data, 'loadout-catalog');
	const squad = string(response.squad, 'loadout-catalog.squad');
	if (squad.length === 0) fail('loadout-catalog.squad', 'cannot be empty');
	const ships = array(response.ships, 'loadout-catalog.ships');
	if (ships.length === 0) fail('loadout-catalog.ships', 'expected at least one ship');
	const indexes = new Set<number>();
	for (const [i, raw] of ships.entries()) {
		const path = `loadout-catalog.ships[${i}]`;
		const ship = object(raw, path);
		const index = integer(ship.index, `${path}.index`);
		if (index < 0) fail(`${path}.index`, 'cannot be negative');
		if (indexes.has(index)) fail(`${path}.index`, `duplicate ship index ${index}`);
		indexes.add(index);
		const player = integer(ship.player, `${path}.player`);
		if (player < 0) fail(`${path}.player`, 'cannot be negative');
		for (const key of ['pilot', 'ship', 'chassis', 'slot', 'faction', 'default_pilot'] as const) {
			if (string(ship[key], `${path}.${key}`).length === 0) {
				fail(`${path}.${key}`, 'cannot be empty');
			}
		}
		if (integer(ship.points, `${path}.points`) < 0) fail(`${path}.points`, 'cannot be negative');
		if (integer(ship.loadout, `${path}.loadout`) < 0) fail(`${path}.loadout`, 'cannot be negative');
		const shipLimited = integer(ship.limited, `${path}.limited`);
		if (shipLimited < 0) fail(`${path}.limited`, 'cannot be negative');
		if (boolean(ship.unique, `${path}.unique`) !== (shipLimited === 1)) {
			fail(`${path}.unique`, 'must match limited === 1');
		}
		const pilots = array(ship.pilots, `${path}.pilots`);
		if (pilots.length === 0) fail(`${path}.pilots`, 'expected at least one pilot');
		const pilotIds = new Set<string>();
		let defaultPilot: PilotOption | null = null;
		for (const [j, rawPilot] of pilots.entries()) {
			const pilotPath = `${path}.pilots[${j}]`;
			const pilot = validatePilotOption(rawPilot, pilotPath);
			if (pilotIds.has(pilot.id)) fail(`${pilotPath}.id`, `duplicate pilot id ${pilot.id}`);
			pilotIds.add(pilot.id);
			if (pilot.id === ship.default_pilot) defaultPilot = pilot;
		}
		if (defaultPilot === null) {
			fail(`${path}.default_pilot`, 'must name one of the pilot options');
		}
		if (
			defaultPilot.points !== integer(ship.points, `${path}.points`) ||
			defaultPilot.loadout !== integer(ship.loadout, `${path}.loadout`) ||
			defaultPilot.limited !== shipLimited
		) {
			fail(`${path}.default_pilot`, 'must match the ship point/loadout/limited fields');
		}
		const defaultSlot = integer(ship.default_slot, `${path}.default_slot`);
		const defaultOption = string(ship.default_option, `${path}.default_option`);
		if (defaultOption.length === 0) fail(`${path}.default_option`, 'cannot be empty');
		const fixed = array(ship.fixed_cards, `${path}.fixed_cards`);
		let fixedPoints = 0;
		for (const [j, rawCard] of fixed.entries()) {
			const card = validateLoadoutCard(rawCard, `${path}.fixed_cards[${j}]`);
			fixedPoints += card.points;
		}
		if (integer(ship.fixed_points, `${path}.fixed_points`) !== fixedPoints) {
			fail(`${path}.fixed_points`, 'must sum fixed_cards points');
		}

		const slots = array(ship.slots, `${path}.slots`);
		if (slots.length === 0) fail(`${path}.slots`, 'expected at least one slot');
		if (defaultSlot < 0 || defaultSlot >= slots.length) {
			fail(`${path}.default_slot`, 'must index slots');
		}
		const slotKeys = new Set<string>();
		for (const [j, rawSlot] of slots.entries()) {
			const slotPath = `${path}.slots[${j}]`;
			const slot = object(rawSlot, slotPath);
			if (integer(slot.index, `${slotPath}.index`) !== j) {
				fail(`${slotPath}.index`, 'must equal the slot array position');
			}
			const slotName = string(slot.slot, `${slotPath}.slot`);
			const kind = string(slot.kind, `${slotPath}.kind`);
			const key = string(slot.key, `${slotPath}.key`);
			if (slotName.length === 0) fail(`${slotPath}.slot`, 'cannot be empty');
			if (kind.length === 0) fail(`${slotPath}.kind`, 'cannot be empty');
			if (key.length === 0) fail(`${slotPath}.key`, 'cannot be empty');
			if (slotKeys.has(key)) fail(`${slotPath}.key`, `duplicate slot key ${key}`);
			slotKeys.add(key);
			const isFixed = boolean(slot.fixed, `${slotPath}.fixed`);
			const conditional =
				slot.conditional === undefined ? false : boolean(slot.conditional, `${slotPath}.conditional`);
			slot.conditional = conditional;
			const fixedCard = slot.fixed_card;
			if (isFixed) {
				if (fixedCard === null || fixedCard === undefined) {
					fail(`${slotPath}.fixed_card`, 'a fixed slot needs its fixed card');
				}
				validateLoadoutCard(fixedCard, `${slotPath}.fixed_card`);
			} else if (fixedCard !== null && fixedCard !== undefined) {
				fail(`${slotPath}.fixed_card`, 'only a fixed slot may carry a fixed card');
			}
			const slotDefault = slot.default_option;
			let defaultId: string | null = null;
			if (slotDefault !== null && slotDefault !== undefined) {
				defaultId = string(slotDefault, `${slotPath}.default_option`);
				if (defaultId.length === 0) fail(`${slotPath}.default_option`, 'cannot be empty');
			}
			const options = array(slot.options, `${slotPath}.options`);
			const normalizedOptions: LoadoutOption[] = [];
			const ids = new Set<string>();
			for (const [k, rawOption] of options.entries()) {
				const option = validateLoadoutOption(rawOption, `${slotPath}.options[${k}]`);
				normalizedOptions.push(option);
				if (string(option.slot, `${slotPath}.options[${k}].slot`) !== slotName) {
					fail(`${slotPath}.options[${k}].slot`, `expected slot ${slotName}`);
				}
				if (option.id !== `${kind}:${option.xws}`) {
					fail(`${slotPath}.options[${k}].id`, `expected ${kind}:${option.xws}`);
				}
				if (ids.has(option.id)) {
					fail(`${slotPath}.options[${k}].id`, `duplicate option id ${option.id}`);
				}
				ids.add(option.id);
			}
			slot.options = normalizedOptions;
			if (isFixed && options.length > 0) {
				fail(`${slotPath}.options`, 'a fixed slot cannot have selectable options');
			}
			if (defaultId !== null && !ids.has(defaultId)) {
				fail(`${slotPath}.default_option`, `unknown option id ${defaultId}`);
			}
			if (j === defaultSlot) {
				if (isFixed) fail(`${slotPath}.fixed`, 'the legacy default slot cannot be fixed');
				if (defaultId !== defaultOption) {
					fail(`${slotPath}.default_option`, 'must equal the ship default_option');
				}
			}
		}

		const defaultKinds = defaultPilot.slots.map((slot) => `${slot.kind}:${slot.key}`);
		const shipKinds = slots.map((rawSlot, index) =>
			`${string(object(rawSlot, `${path}.slots[${index}]`).kind, `${path}.slots[${index}].kind`)}:${string(object(rawSlot, `${path}.slots[${index}]`).key, `${path}.slots[${index}].key`)}`
		);
		if (
			defaultKinds.length !== shipKinds.length ||
			defaultKinds.some((kind, index) => kind !== shipKinds[index])
		) {
			fail(`${path}.pilots.default.slots`, 'the default pilot bar must equal the ship slots');
		}

		const legacy = array(ship.options, `${path}.options`);
		if (legacy.length === 0) fail(`${path}.options`, 'expected at least one option');
		const legacyIds = new Set<string>();
		for (const [j, rawOption] of legacy.entries()) {
			const option = validateLoadoutOption(rawOption, `${path}.options[${j}]`);
			if (string(option.slot, `${path}.options[${j}].slot`) !== string(ship.slot, `${path}.slot`)) {
				fail(`${path}.options[${j}].slot`, `expected the legacy slot ${ship.slot}`);
			}
			if (legacyIds.has(option.id)) {
				fail(`${path}.options[${j}].id`, `duplicate option id ${option.id}`);
			}
			legacyIds.add(option.id);
		}
		if (!legacyIds.has(defaultOption)) {
			fail(`${path}.default_option`, `unknown legacy option id ${defaultOption}`);
		}
		const legacySlot = object(slots[defaultSlot], `${path}.slots[${defaultSlot}]`);
		const legacySlotOptions = array(legacySlot.options, `${path}.slots[${defaultSlot}].options`);
		const legacyIdsFromSlot = new Set(
			legacySlotOptions.map((rawOption, j) =>
				string(object(rawOption, `${path}.slots[${defaultSlot}].options[${j}]`).id, `${path}.slots[${defaultSlot}].options[${j}].id`)
			)
		);
		for (const id of legacyIds) {
			if (!legacyIdsFromSlot.has(id)) {
				fail(`${path}.options`, `legacy option ${id} is not in the default slot`);
			}
		}
	}

	const pointCap = integer(response.point_cap, 'loadout-catalog.point_cap');
	if (pointCap <= 0) fail('loadout-catalog.point_cap', 'must be positive');
	const totalPoints = integer(response.total_points, 'loadout-catalog.total_points');
	if (totalPoints < 0) fail('loadout-catalog.total_points', 'cannot be negative');
	const catalogLegal = boolean(response.legal_50, 'loadout-catalog.legal_50');
	if (string(response.legality_note, 'loadout-catalog.legality_note').length === 0) {
		fail('loadout-catalog.legality_note', 'cannot be empty');
	}
	const sides = array(response.sides, 'loadout-catalog.sides');
	if (sides.length === 0) fail('loadout-catalog.sides', 'expected at least one side');
	const sidePlayers = new Set<number>();
	let sideTotal = 0;
	let allSidesLegal = true;
	for (const [i, rawSide] of sides.entries()) {
		const path = `loadout-catalog.sides[${i}]`;
		const side = object(rawSide, path);
		const player = integer(side.player, `${path}.player`);
		if (player < 0) fail(`${path}.player`, 'cannot be negative');
		if (sidePlayers.has(player)) fail(`${path}.player`, `duplicate side ${player}`);
		sidePlayers.add(player);
		if (string(side.faction, `${path}.faction`).length === 0) {
			fail(`${path}.faction`, 'cannot be empty');
		}
		if (integer(side.ship_count, `${path}.ship_count`) <= 0) {
			fail(`${path}.ship_count`, 'must be positive');
		}
		const points = integer(side.points, `${path}.points`);
		if (points < 0) fail(`${path}.points`, 'cannot be negative');
		sideTotal += points;
		if (integer(side.point_cap, `${path}.point_cap`) !== pointCap) {
			fail(`${path}.point_cap`, 'must equal catalog point_cap');
		}
		if (boolean(side.over_cap, `${path}.over_cap`) !== (points > pointCap)) {
			fail(`${path}.over_cap`, 'must match points > point_cap');
		}
		const legal = boolean(side.legal_50, `${path}.legal_50`);
		const violations = array(side.violations, `${path}.violations`);
		for (const [j, rawViolation] of violations.entries()) {
			const violation = object(rawViolation, `${path}.violations[${j}]`);
			string(violation.code, `${path}.violations[${j}].code`);
			string(violation.message, `${path}.violations[${j}].message`);
			string(violation.rule, `${path}.violations[${j}].rule`);
		}
		if (legal !== (violations.length === 0)) {
			fail(`${path}.legal_50`, 'must be true only when violations is empty');
		}
		allSidesLegal &&= legal;
	}
	if (catalogLegal !== allSidesLegal) {
		fail('loadout-catalog.legal_50', 'must equal every side legal_50');
	}
	if (sideTotal !== totalPoints) {
		fail('loadout-catalog.total_points', `expected the sum of sides (${sideTotal})`);
	}
	const gaps = object(response.data_gaps, 'loadout-catalog.data_gaps');
	for (const key of ['compiled_without_listbuilding', 'excluded_slot_rewriting'] as const) {
		if (integer(gaps[key], `loadout-catalog.data_gaps.${key}`) < 0) {
			fail(`loadout-catalog.data_gaps.${key}`, 'cannot be negative');
		}
	}
	if (string(gaps.note, 'loadout-catalog.data_gaps.note').length === 0) {
		fail('loadout-catalog.data_gaps.note', 'cannot be empty');
	}

	const minShips = integer(response.min_ships, 'loadout-catalog.min_ships');
	const maxShips = integer(response.max_ships, 'loadout-catalog.max_ships');
	if (minShips < 1) fail('loadout-catalog.min_ships', 'must be positive');
	if (maxShips < minShips) fail('loadout-catalog.max_ships', 'must be >= min_ships');
	const pointsMin = integer(response.points_min, 'loadout-catalog.points_min');
	if (pointsMin < 0) fail('loadout-catalog.points_min', 'cannot be negative');
	if (pointsMin > pointCap) fail('loadout-catalog.points_min', 'must be <= point_cap');
	const pool = array(response.pilot_pool, 'loadout-catalog.pilot_pool');
	if (pool.length === 0) fail('loadout-catalog.pilot_pool', 'expected at least one pilot');
	const poolIds = new Set<string>();
	for (const [i, raw] of pool.entries()) {
		const path = `loadout-catalog.pilot_pool[${i}]`;
		const pilot = validateCustomPilot(raw, path);
		if (poolIds.has(pilot.id)) fail(`${path}.id`, `duplicate pilot id ${pilot.id}`);
		poolIds.add(pilot.id);
	}
	const report = object(response.pilot_pool_report, 'loadout-catalog.pilot_pool_report');
	const committed = integer(report.committed_rows, 'loadout-catalog.pilot_pool_report.committed_rows');
	const curated = integer(report.curated_rows, 'loadout-catalog.pilot_pool_report.curated_rows');
	const pooled = integer(report.pool_rows, 'loadout-catalog.pilot_pool_report.pool_rows');
	const chassisCount = integer(report.pool_chassis, 'loadout-catalog.pilot_pool_report.pool_chassis');
	const omitted = integer(report.omitted_rows, 'loadout-catalog.pilot_pool_report.omitted_rows');
	for (const [key, value] of [
		['committed_rows', committed],
		['curated_rows', curated],
		['pool_rows', pooled],
		['pool_chassis', chassisCount],
		['omitted_rows', omitted]
	] as const) {
		if (value < 0) fail(`loadout-catalog.pilot_pool_report.${key}`, 'cannot be negative');
	}
	if (pooled !== pool.length) {
		fail('loadout-catalog.pilot_pool_report.pool_rows', 'must equal the pilot_pool length');
	}
	if (curated > pooled) {
		fail('loadout-catalog.pilot_pool_report.curated_rows', 'cannot exceed pool_rows');
	}
	if (pooled + omitted !== committed) {
		fail(
			'loadout-catalog.pilot_pool_report',
			'pool_rows + omitted_rows must equal committed_rows'
		);
	}
	if (chassisCount === 0) fail('loadout-catalog.pilot_pool_report.pool_chassis', 'cannot be zero');
	if (string(report.note, 'loadout-catalog.pilot_pool_report.note').length === 0) {
		fail('loadout-catalog.pilot_pool_report.note', 'cannot be empty');
	}
	const omissions = array(report.omissions, 'loadout-catalog.pilot_pool_report.omissions');
	if (omissions.length !== omitted) {
		fail('loadout-catalog.pilot_pool_report.omissions', 'must have one row per omitted row');
	}
	const omissionIds = new Set<string>();
	for (const [i, raw] of omissions.entries()) {
		const path = `loadout-catalog.pilot_pool_report.omissions[${i}]`;
		const row = object(raw, path);
		for (const key of ['id', 'name', 'ship', 'chassis', 'faction', 'reason'] as const) {
			if (string(row[key], `${path}.${key}`).length === 0) {
				fail(`${path}.${key}`, 'cannot be empty');
			}
		}
		const id = string(row.id, `${path}.id`);
		if (omissionIds.has(id)) fail(`${path}.id`, `duplicate omitted pilot id ${id}`);
		if (poolIds.has(id)) fail(`${path}.id`, `${id} cannot be both exposed and omitted`);
		omissionIds.add(id);
	}
	return response as unknown as LoadoutCatalog;
}

function validateSpecialCap(data: unknown, path: string): FormatSpecialCap {
	const cap = object(data, path);
	return {
		kind: string(cap.kind, `${path}.kind`),
		value: integer(cap.value, `${path}.value`),
		applies_to: string(cap.applies_to, `${path}.applies_to`)
	};
}

/** Validate `GET /api/formats`. Every number here comes from a committed TOML
 *  document on the server; the builder never substitutes its own defaults. */
export function validateFormatsResponse(data: unknown): FormatsResponse {
	const response = object(data, 'formats-response');
	const rows = array(response.formats, 'formats');
	if (rows.length === 0) fail('formats', 'expected at least one committed format');
	const formats: FormatInfo[] = [];
	const ids = new Set<string>();
	for (const [i, raw] of rows.entries()) {
		const path = `formats[${i}]`;
		const row = object(raw, path);
		const spec = object(row.spec, `${path}.spec`);
		const lb = object(row.listbuilding, `${path}.listbuilding`);
		const id = string(spec.id, `${path}.spec.id`);
		if (id.length === 0) fail(`${path}.spec.id`, 'cannot be empty');
		if (ids.has(id)) fail(`${path}.spec.id`, `duplicate format id ${id}`);
		ids.add(id);
		const minShips = integer(lb.ships_min, `${path}.listbuilding.ships_min`);
		const maxShips = integer(lb.ships_max, `${path}.listbuilding.ships_max`);
		if (minShips < 1) fail(`${path}.listbuilding.ships_min`, 'must be positive');
		if (maxShips < minShips) {
			fail(`${path}.listbuilding.ships_max`, 'must be >= ships_min');
		}
		if (integer(spec.min_ships, `${path}.spec.min_ships`) !== minShips) {
			fail(`${path}.spec.min_ships`, 'must equal listbuilding.ships_min');
		}
		if (integer(spec.max_ships, `${path}.spec.max_ships`) !== maxShips) {
			fail(`${path}.spec.max_ships`, 'must equal listbuilding.ships_max');
		}
		const pointsMin = integer(lb.points_min, `${path}.listbuilding.points_min`);
		const pointsMax = integer(lb.points_max, `${path}.listbuilding.points_max`);
		if (pointsMin < 0) fail(`${path}.listbuilding.points_min`, 'cannot be negative');
		if (pointsMax <= 0) fail(`${path}.listbuilding.points_max`, 'must be positive');
		if (pointsMin > pointsMax) {
			fail(`${path}.listbuilding.points_min`, 'must be <= points_max');
		}
		if (integer(spec.max_squad_points, `${path}.spec.max_squad_points`) !== pointsMax) {
			fail(`${path}.spec.max_squad_points`, 'must equal listbuilding.points_max');
		}
		const specialCaps = array(lb.special_caps, `${path}.listbuilding.special_caps`).map(
			(cap, index) => validateSpecialCap(cap, `${path}.listbuilding.special_caps[${index}]`)
		);
		const hugeAllowed = boolean(lb.huge_ships_allowed, `${path}.listbuilding.huge_ships_allowed`);
		if (boolean(spec.huge_ships_allowed, `${path}.spec.huge_ships_allowed`) !== hugeAllowed) {
			fail(`${path}.spec.huge_ships_allowed`, 'must equal listbuilding.huge_ships_allowed');
		}
		const commandAllowed = boolean(
			lb.command_slot_allowed,
			`${path}.listbuilding.command_slot_allowed`
		);
		if (
			boolean(spec.command_slot_allowed, `${path}.spec.command_slot_allowed`) !== commandAllowed
		) {
			fail(
				`${path}.spec.command_slot_allowed`,
				'must equal listbuilding.command_slot_allowed'
			);
		}
		const note = row.custom_lineup_note;
		if (note !== undefined && note !== null && typeof note !== 'string') {
			fail(`${path}.custom_lineup_note`, 'must be a string or null');
		}
		formats.push({
			spec: {
				id,
				name: string(spec.name, `${path}.spec.name`),
				max_squad_points: pointsMax,
				min_ships: minShips,
				max_ships: maxShips,
				rounds: integer(spec.rounds, `${path}.spec.rounds`),
				play_area_mm: integer(spec.play_area_mm, `${path}.spec.play_area_mm`),
				min_players: integer(spec.min_players, `${path}.spec.min_players`),
				max_players: integer(spec.max_players, `${path}.spec.max_players`),
				teams: string(spec.teams, `${path}.spec.teams`),
				huge_ships_allowed: hugeAllowed,
				command_slot_allowed: commandAllowed,
				respawn: boolean(spec.respawn, `${path}.spec.respawn`),
				scenario_pool: string(spec.scenario_pool, `${path}.spec.scenario_pool`),
				victory_threshold: integer(spec.victory_threshold, `${path}.spec.victory_threshold`)
			},
			listbuilding: {
				points_min: pointsMin,
				points_max: pointsMax,
				ships_min: minShips,
				ships_max: maxShips,
				faction: string(lb.faction, `${path}.listbuilding.faction`),
				loadout: string(lb.loadout, `${path}.listbuilding.loadout`),
				restricted_list: boolean(lb.restricted_list, `${path}.listbuilding.restricted_list`),
				deficit: boolean(lb.deficit, `${path}.listbuilding.deficit`),
				huge_ships_allowed: hugeAllowed,
				huge_ships_min: integer(lb.huge_ships_min, `${path}.listbuilding.huge_ships_min`),
				max_huge_ships: integer(lb.max_huge_ships, `${path}.listbuilding.max_huge_ships`),
				max_points_on_huge: integer(
					lb.max_points_on_huge,
					`${path}.listbuilding.max_points_on_huge`
				),
				command_slot_allowed: commandAllowed,
				special_caps: specialCaps
			},
			provenance: string(row.provenance, `${path}.provenance`),
			official: boolean(row.official, `${path}.official`),
			version: string(row.version, `${path}.version`),
			effective: string(row.effective, `${path}.effective`),
			custom_lineup_playable: boolean(
				row.custom_lineup_playable,
				`${path}.custom_lineup_playable`
			),
			custom_lineup_note: (note as string | null | undefined) ?? null
		});
	}
	return { formats };
}

/** Fetch the committed format metadata the builder validates against. */
export async function getFormats(): Promise<FormatInfo[]> {
	return validateFormatsResponse(await request('/api/formats')).formats;
}

/** The committed format with this id, or null when the server did not send it. */
export function formatById(
	formats: readonly FormatInfo[],
	id: string
): FormatInfo | null {
	return formats.find((format) => format.spec.id === id) ?? null;
}

/** A Standard fallback for callers that have only the catalogue (the catalogue
 *  endpoint is Standard-only). The setup page always passes the committed rows
 *  from `/api/formats`; this keeps older call sites and tests working. */
export function standardFormatFromCatalog(catalog: LoadoutCatalog): FormatInfo {
	return {
		spec: {
			id: LIST_FORMAT,
			name: '50P Standard',
			max_squad_points: catalog.point_cap,
			min_ships: catalog.min_ships,
			max_ships: catalog.max_ships,
			rounds: 0,
			play_area_mm: 0,
			min_players: 2,
			max_players: 2,
			teams: 'none',
			huge_ships_allowed: false,
			command_slot_allowed: false,
			respawn: false,
			scenario_pool: 'xwa-five',
			victory_threshold: 0
		},
		listbuilding: {
			points_min: catalog.points_min,
			points_max: catalog.point_cap,
			ships_min: catalog.min_ships,
			ships_max: catalog.max_ships,
			faction: 'single',
			loadout: 'per_ship',
			restricted_list: true,
			deficit: true,
			huge_ships_allowed: false,
			huge_ships_min: 0,
			max_huge_ships: 0,
			max_points_on_huge: 0,
			command_slot_allowed: false,
			special_caps: []
		},
		provenance: 'xwa',
		official: true,
		version: '',
		effective: '',
		custom_lineup_playable: true,
		custom_lineup_note: null
	};
}

function validateLoadoutCard(data: unknown, path: string): LoadoutCard {
	const card = object(data, path);
	validatePresetCard(card, path);
	if (integer(card.points, `${path}.points`) < 0) fail(`${path}.points`, 'cannot be negative');
	const factions = array(card.factions, `${path}.factions`);
	if (factions.length === 0) fail(`${path}.factions`, 'expected at least one faction label');
	for (const [i, faction] of factions.entries()) {
		if (string(faction, `${path}.factions[${i}]`).length === 0) {
			fail(`${path}.factions[${i}]`, 'cannot be empty');
		}
	}
	const limited = integer(card.limited, `${path}.limited`);
	if (limited < 0) fail(`${path}.limited`, 'cannot be negative');
	if (boolean(card.unique, `${path}.unique`) !== (limited === 1)) {
		fail(`${path}.unique`, 'must match limited === 1');
	}
	return card as unknown as LoadoutCard;
}

function effectList(value: unknown, path: string): string[] {
	if (value === undefined) return [];
	return array(value, path).map((entry, index) => string(entry, `${path}[${index}]`));
}

function validateLoadoutOption(data: unknown, path: string): LoadoutOption {
	const option = object(data, path);
	validateLoadoutCard(option, path);
	if (string(option.id, `${path}.id`).length === 0) fail(`${path}.id`, 'cannot be empty');
	return {
		...option,
		also_occupies: effectList(option.also_occupies, `${path}.also_occupies`),
		unequips: effectList(option.unequips, `${path}.unequips`),
		confers_addons: effectList(option.confers_addons, `${path}.confers_addons`)
	} as unknown as LoadoutOption;
}

/** Fetch the public preset metadata for the setup surface. */
export async function getSquads(): Promise<CardPreset[]> {
	return validateSquadsResponse(await request('/api/squads')).presets;
}

/** Fetch the compiled per-ship options for the arbitrary demo. */
export async function getLoadoutCatalog(): Promise<LoadoutCatalog> {
	return validateLoadoutCatalog(await request('/api/loadout-catalog'));
}

export interface PresetSide {
	player: number;
	ships: PresetShip[];
}

/** Group a preset's ships into stable player-side blocks for the preview. */
export function presetSides(preset: Pick<CardPreset, 'ships'>): PresetSide[] {
	const byPlayer = new Map<number, PresetShip[]>();
	for (const ship of preset.ships) {
		const list = byPlayer.get(ship.player) ?? [];
		list.push(ship);
		byPlayer.set(ship.player, list);
	}
	return [...byPlayer.entries()]
		.sort(([a], [b]) => a - b)
		.map(([player, ships]) => ({ player, ships }));
}

/** Default arbitrary-demo selections: the server's default option per ship. */
export function defaultLoadoutSelections(catalog: LoadoutCatalog): Record<number, string> {
	const selected: Record<number, string> = {};
	for (const ship of catalog.ships) selected[ship.index] = ship.default_option;
	return selected;
}

/** The request array, one catalog id per ship. In vs-bot the non-human side is
 *  pinned to its defaults; hotseat may expose both sides. */
export function selectedLoadout(
	catalog: LoadoutCatalog,
	selections: Record<number, string> = {},
	hotseat = false
): string[] {
	return catalog.ships.map((ship) => {
		if (!hotseat && ship.player !== 0) return ship.default_option;
		return selections[ship.index] ?? ship.default_option;
	});
}

/** Pilot UI state: ship index -> exact committed pilot row id. */
export type PilotSelections = Record<number, string>;

/** Default pilot ids: the server's six-ship legal 50P default. */
export function defaultPilotSelections(catalog: LoadoutCatalog): PilotSelections {
	const selected: PilotSelections = {};
	for (const ship of catalog.ships) selected[ship.index] = ship.default_pilot;
	return selected;
}

/** The selected pilot row for a ship, falling back to the catalog default. */
export function pilotFor(
	catalog: LoadoutCatalog,
	ship: LoadoutShip,
	selections: PilotSelections = {}
): PilotOption {
	return (
		ship.pilots.find((pilot) => pilot.id === selections[ship.index]) ??
		ship.pilots.find((pilot) => pilot.id === ship.default_pilot) ??
		ship.pilots[0]
	);
}

/** The active pilot's own bar. `ship.slots` remains the default pilot's
 *  compatibility projection; it is never used for a changed pilot. */
export function pilotSlots(ship: LoadoutShip, pilot: PilotOption): LoadoutSlot[] {
	return pilot.slots;
}

/** Move a slot row from one pilot's bar to another by printed slot kind.
 *  Same-kind selections that are legal on the new pilot are carried over;
 *  incompatible selections are dropped, not silently re-pointed at a
 *  different slot. New kinds take their own default. */
export function remapSelectionsForPilot(
	row: Record<string, string | null>,
	fromPilot: PilotOption,
	toPilot: PilotOption
): Record<string, string | null> {
	const next: Record<string, string | null> = {};
	const used = new Set<string>();
	for (const slot of toPilot.slots) {
		const old = fromPilot.slots.find(
			(candidate) => candidate.kind === slot.kind && !used.has(candidate.key)
		);
		if (!old) {
			next[slot.key] = slot.default_option;
			continue;
		}
		used.add(old.key);
		if (!Object.prototype.hasOwnProperty.call(row, old.key)) {
			next[slot.key] = slot.default_option;
			continue;
		}
		const id = row[old.key];
		next[slot.key] =
			id !== null && slot.options.some((option) => option.id === id) ? id : null;
	}
	return next;
}

/** The positional pilots request. In vs-bot the non-human side is pinned to
 *  its defaults; hotseat may expose both sides. */
export function selectedPilots(
	catalog: LoadoutCatalog,
	selections: PilotSelections = {},
	hotseat = false
): (string | null)[] {
	return catalog.ships.map((ship) => {
		if (!hotseat && ship.player !== 0) return ship.default_pilot;
		return selections[ship.index] ?? ship.default_pilot;
	});
}

/** New multi-slot UI state: ship index -> slot key -> option id or null. */
export type SlotSelections = Record<number, Record<string, string | null>>;

export interface LoadoutShipTotal {
	index: number;
	player: number;
	pilot: PilotOption;
	/** Pilot points: the 50P squad contribution. */
	base: number;
	fixed: number;
	selected: number;
	/** Fixed + selected upgrade costs, checked against `loadout`. */
	loadout_spent: number;
	loadout: number;
	total: number;
}

export interface LoadoutSideTotal {
	player: number;
	faction: string;
	ship_count: number;
	points: number;
	point_cap: number;
	over_cap: boolean;
	legal_50: boolean;
	/** Human-readable reasons from the same shape/loadout checks. */
	reasons: string[];
}

export interface LoadoutTotals {
	ships: Record<number, LoadoutShipTotal>;
	sides: LoadoutSideTotal[];
	total: number;
	legal_50: boolean;
}

/** Defaults for the multi-slot panel: only the legacy slot starts filled. */
export function defaultMultiSelections(catalog: LoadoutCatalog): SlotSelections {
	const selected: SlotSelections = {};
	const pilots = defaultPilotSelections(catalog);
	for (const ship of catalog.ships) {
		const row: Record<string, string | null> = {};
		for (const slot of pilotSlots(ship, pilotFor(catalog, ship, pilots))) {
			row[slot.key] = slot.default_option;
		}
		selected[ship.index] = row;
	}
	return selected;
}

/** The positional selections request. In vs-bot the non-human side is pinned
 *  to its defaults; hotseat may expose both sides. A present null is an empty
 *  slot, not a reason to fall back to the default. */
export function selectedMultiSelections(
	catalog: LoadoutCatalog,
	selections: SlotSelections = {},
	hotseat = false,
	pilots: PilotSelections = {}
): (string | null)[][] {
	return catalog.ships.map((ship) => {
		const picked = selections[ship.index];
		return pilotSlots(ship, pilotFor(catalog, ship, pilots)).map((slot) => {
			if (!hotseat && ship.player !== 0) return slot.default_option;
			if (picked && Object.prototype.hasOwnProperty.call(picked, slot.key)) {
				return picked[slot.key] ?? null;
			}
			return slot.default_option;
		});
	});
}

/** Per-ship and per-side points from the catalog's committed values. Squad
 *  points are pilot points; upgrade costs spend the separate loadout budget. */
export function loadoutTotals(
	catalog: LoadoutCatalog,
	selections: SlotSelections = {},
	hotseat = false,
	pilots: PilotSelections = {},
	format?: FormatInfo
): LoadoutTotals {
	const active = format ?? standardFormatFromCatalog(catalog);
	const lb = active.listbuilding;
	const rows = selectedMultiSelections(catalog, selections, hotseat, pilots);
	const ships: Record<number, LoadoutShipTotal> = {};
	const sidePoints = new Map<number, number>();
	const shipCounts = new Map<number, number>();
	const sideFactions = new Map<number, Set<string>>();
	const sideReasons = new Map<number, string[]>();
	for (const ship of catalog.ships) {
		const pilot = pilotFor(catalog, ship, pilots);
		const slots = pilotSlots(ship, pilot);
		let selected = 0;
		for (const [slotIndex, id] of rows[ship.index].entries()) {
			if (id === null) continue;
			const option = slots[slotIndex]?.options.find((candidate) => candidate.id === id);
			if (option) selected += option.points;
		}
		const total = pilot.points;
		ships[ship.index] = {
			index: ship.index,
			player: ship.player,
			pilot,
			base: pilot.points,
			fixed: ship.fixed_points,
			selected,
			loadout_spent: ship.fixed_points + selected,
			loadout: pilot.loadout,
			total
		};
		sidePoints.set(ship.player, (sidePoints.get(ship.player) ?? 0) + total);
		shipCounts.set(ship.player, (shipCounts.get(ship.player) ?? 0) + 1);
		const factions = sideFactions.get(ship.player) ?? new Set<string>();
		factions.add(ship.faction);
		sideFactions.set(ship.player, factions);
		const reasons = sideReasons.get(ship.player) ?? [];
		if (ship.fixed_points + selected > pilot.loadout) {
			reasons.push(
				`${pilot.name}: ${ship.fixed_points + selected} loadout spent, ${pilot.loadout} available`
			);
		}
		sideReasons.set(ship.player, reasons);
	}
	const sides = catalog.sides.map((side) => {
		const points = sidePoints.get(side.player) ?? 0;
		const shipCount = shipCounts.get(side.player) ?? 0;
		const factions = sideFactions.get(side.player) ?? new Set<string>();
		const reasons = [...(sideReasons.get(side.player) ?? [])];
		if (shipCount < lb.ships_min || shipCount > lb.ships_max) {
			reasons.unshift(`${shipCount} ships (legal ${lb.ships_min}-${lb.ships_max})`);
		}
		if (points < lb.points_min || points > lb.points_max) {
			reasons.unshift(
				`card total ${points} points (legal ${lb.points_min}-${lb.points_max})`
			);
		}
		if (lb.faction === 'single' && factions.size > 1) {
			reasons.unshift(`mixed factions: ${[...factions].join(', ')}`);
		}
		return {
			player: side.player,
			faction: factions.size > 1 ? 'Mixed' : (factions.values().next().value ?? side.faction),
			ship_count: shipCount,
			points,
			point_cap: lb.points_max,
			over_cap: points > lb.points_max,
			legal_50: reasons.length === 0,
			reasons
		};
	});
	const total = sides.reduce((sum, side) => sum + side.points, 0);
	return {
		ships,
		sides,
		total,
		legal_50: sides.every((side) => side.legal_50)
	};
}

/** The preset's ships with every selected slot and the fixed remainder. */
/** One ship in the dynamic custom lineup UI. `pilot` is a curated pool id;
 *  `slots` is keyed by the selected pilot's own slot keys. */
export interface CustomShipState {
	pilot: string;
	slots: Record<string, string | null>;
}

/** Side-major dynamic lineup: [player 0 ships, player 1 ships]. */
export type CustomLineup = [CustomShipState[], CustomShipState[]];

export function customPilotById(catalog: LoadoutCatalog, id: string): CustomPilot | null {
	return catalog.pilot_pool.find((pilot) => pilot.id === id) ?? null;
}

/** Why a pilot is illegal in a format because it is Epic-only/huge, or null
 *  when the format permits it. The pool itself is format-agnostic; this is the
 *  browser's display gate, while the committed validator remains authoritative. */
export function customPilotFormatReason(
	pilot: Pick<CustomPilot, 'name' | 'ship' | 'base' | 'epic_only'>,
	format: FormatInfo
): string | null {
	if (!pilot.epic_only || format.listbuilding.huge_ships_allowed) return null;
	return `${pilot.name} (${pilot.ship}, ${pilot.base} base) is Epic content; ${format.spec.name} does not allow huge or Epic-only ships`;
}

/** The ship-card caption used by the browser and the selected-ship row. */
export function customPilotShipLabel(pilot: Pick<CustomPilot, 'ship' | 'base'>): string {
	return pilot.base === 'Huge' ? `${pilot.ship} · Huge base` : pilot.ship;
}

/** Filter the pool for the selected format before the generic text filters run. */
export function pilotsForFormat(
	pilots: readonly CustomPilot[],
	format?: FormatInfo | null
): CustomPilot[] {
	if (!format) return [...pilots];
	return pilots.filter((pilot) => customPilotFormatReason(pilot, format) === null);
}

/** Setup-UI filters for the pilot browser. An empty string or null means "any";
 *  initiative and points bounds are inclusive. */
export interface PilotFilter {
	name?: string;
	/** The selected format: Epic-only rows are excluded when it does not
	 *  allow huge/Epic content. */
	format?: FormatInfo;
	/** Exact faction id, e.g. rebelalliance. */
	faction?: string;
	/** Exact committed chassis xws, e.g. t65xwing. */
	chassis?: string;
	minInitiative?: number | null;
	maxInitiative?: number | null;
	minPoints?: number | null;
	maxPoints?: number | null;
}

export const EMPTY_PILOT_FILTER: PilotFilter = {
	name: '',
	faction: '',
	chassis: '',
	minInitiative: null,
	maxInitiative: null,
	minPoints: null,
	maxPoints: null
};

function within(value: number, min?: number | null, max?: number | null): boolean {
	if (min !== null && min !== undefined && value < min) return false;
	if (max !== null && max !== undefined && value > max) return false;
	return true;
}

/** Deterministic pilot search used by the setup browser. Filtering never
 *  mutates the catalog or the lineup; results are sorted by name then id so a
 *  filter change cannot reorder equal rows differently across renders. */
export function filterCustomPilots(
	pilots: readonly CustomPilot[],
	filter: PilotFilter = EMPTY_PILOT_FILTER
): CustomPilot[] {
	const name = (filter.name ?? '').trim().toLowerCase();
	const faction = filter.faction ?? '';
	const chassis = filter.chassis ?? '';
	return pilots
		.filter(
			(pilot) =>
				(name === '' || pilot.name.toLowerCase().includes(name)) &&
				(faction === '' || pilot.faction === faction) &&
				(chassis === '' || pilot.chassis === chassis) &&
				(filter.format === undefined || customPilotFormatReason(pilot, filter.format) === null) &&
				within(pilot.initiative, filter.minInitiative, filter.maxInitiative) &&
				within(pilot.points, filter.minPoints, filter.maxPoints)
		)
		.sort(
			(a, b) =>
				a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id.localeCompare(b.id)
		);
}

/** Why a limited pilot cannot join this side again, or null when it can. */
export function customPilotLimitReason(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	player: number,
	pilot: CustomPilot
): string | null {
	if (pilot.limited <= 0) return null;
	let count = 0;
	for (const ship of lineup[player]) {
		const selected = customPilotById(catalog, ship.pilot);
		if (selected?.name === pilot.name) count += 1;
	}
	if (count >= pilot.limited) {
		return `limited pilot ${pilot.name} already selected ${count} time${count === 1 ? '' : 's'}; limit is ${pilot.limited}`;
	}
	return null;
}

/** Pilots offered for a side. An established side keeps its faction; a new
 *  side starts with the catalog's two default factions. */
export function customPilotChoices(
	catalog: LoadoutCatalog,
	player: number,
	lineup: CustomLineup,
	format?: FormatInfo | null
): CustomPilot[] {
	const first = lineup[player][0];
	const faction = first ? customPilotById(catalog, first.pilot)?.faction : undefined;
	return catalog.pilot_pool.filter(
		(pilot) =>
			(!faction || pilot.faction === faction) &&
			(!format || customPilotFormatReason(pilot, format) === null)
	);
}

function customShipState(pilot: CustomPilot): CustomShipState {
	const slots: Record<string, string | null> = {};
	for (const slot of pilot.slots) slots[slot.key] = slot.default_option;
	return { pilot: pilot.id, slots };
}

/** The existing six-ship default, as a dynamic lineup. */
export function defaultCustomLineup(catalog: LoadoutCatalog): CustomLineup {
	const sides: CustomLineup = [[], []];
	for (const ship of catalog.ships) {
		const pilot = customPilotById(catalog, ship.default_pilot);
		const slots: Record<string, string | null> = {};
		for (const slot of ship.slots) slots[slot.key] = slot.default_option;
		sides[ship.player]?.push({ pilot: pilot?.id ?? ship.default_pilot, slots });
	}
	return sides;
}

/** The default sides for a committed format: the catalogue default lineup,
 *  sliced or grown to the format's own ship bounds. Standard and Epic start
 *  3 vs 3; Aces High starts 1 vs 1. */
export function defaultCustomLineupFor(
	catalog: LoadoutCatalog,
	format: FormatInfo
): CustomLineup {
	const lb = format.listbuilding;
	const base = defaultCustomLineup(catalog);
	const target = Math.min(Math.max(lb.ships_min, 1), lb.ships_max);
	const lineup: CustomLineup = [base[0].slice(0, target), base[1].slice(0, target)];
	return fitCustomLineup(catalog, lineup, format);
}

/** Resize both sides into the format's ship bounds without touching a legal
 *  side: extra ships are removed from the end, missing ones are appended with
 *  the cheapest still-available pilot. */
export function fitCustomLineup(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	format: FormatInfo
): CustomLineup {
	const lb = format.listbuilding;
	let next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	for (const player of [0, 1]) {
		while (next[player].length > lb.ships_max) next[player].pop();
		while (next[player].length < lb.ships_min) {
			const grown = addCustomShip(catalog, next, player, lb.ships_max);
			if (grown === next) break;
			next = grown;
		}
	}
	return next;
}

/** Append one ship to a side with the cheapest still-available pilot of that
 *  side's faction. Existing ships and their selections are not touched. */
export function addCustomShip(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	player: number,
	maxShips = catalog.max_ships
): CustomLineup {
	if (lineup[player].length >= maxShips) return lineup;
	const used = new Set(lineup.flat().map((ship) => ship.pilot));
	const choices = customPilotChoices(catalog, player, lineup);
	const candidate =
		choices
			.filter((pilot) => pilot.limited === 0 || !used.has(pilot.id))
			.sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))[0] ?? choices[0];
	if (!candidate) return lineup;
	const next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	next[player].push(customShipState(candidate));
	return next;
}

/** Append one explicitly chosen browser pilot to a side. The existing ships
 *  and selections stay untouched; the side faction, 8-ship cap and limited
 *  copies remain server-validated. */
export function addCustomPilot(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	player: number,
	pilotId: string,
	maxShips = catalog.max_ships
): CustomLineup {
	if (lineup[player].length >= maxShips) return lineup;
	const pilot = customPilotById(catalog, pilotId);
	if (!pilot) return lineup;
	const first = lineup[player][0];
	const faction = first ? customPilotById(catalog, first.pilot)?.faction : undefined;
	if (faction && faction !== pilot.faction) return lineup;
	const next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	next[player].push(customShipState(pilot));
	return next;
}

/** Remove one ship, refusing to drop below the format's 3-ship minimum. */
export function removeCustomShip(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	player: number,
	index: number,
	minShips = catalog.min_ships
): CustomLineup {
	if (lineup[player].length <= minShips) return lineup;
	if (index < 0 || index >= lineup[player].length) return lineup;
	const next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	next[player].splice(index, 1);
	return next;
}

/** Switch a ship's pilot, carrying over same-kind selections that remain
 *  legal. A slot the new pilot does not print is dropped, never re-pointed. */
export function changeCustomPilot(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	player: number,
	index: number,
	pilotId: string
): CustomLineup {
	const current = lineup[player][index];
	const nextPilot = customPilotById(catalog, pilotId);
	if (!current || !nextPilot) return lineup;
	const currentPilot = customPilotById(catalog, current.pilot);
	const slots = currentPilot
		? remapSelectionsForPilot(current.slots, currentPilot, nextPilot)
		: customShipState(nextPilot).slots;
	const next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	next[player][index] = { pilot: nextPilot.id, slots };
	return next;
}

/** Empty one slot or set it to an option id. */
export function setCustomSlot(
	lineup: CustomLineup,
	player: number,
	index: number,
	key: string,
	value: string | null
): CustomLineup {
	const current = lineup[player][index];
	if (!current) return lineup;
	const next: CustomLineup = [[...lineup[0]], [...lineup[1]]];
	next[player][index] = { ...current, slots: { ...current.slots, [key]: value } };
	return next;
}

/** The exact `POST /api/games` payload fields for a dynamic lineup. */
export function customLineupRequest(
	catalog: LoadoutCatalog,
	lineup: CustomLineup
): {
	side_sizes: number[];
	pilots: (string | null)[];
	selections: (string | null)[][];
} {
	return {
		side_sizes: [lineup[0].length, lineup[1].length],
		pilots: [...lineup[0], ...lineup[1]].map((ship) => ship.pilot || null),
		selections: customLineupSelections(catalog, lineup)
	};
}

/** The exact request rows in the selected pilot's slot order. This is the
 *  form `createGame` sends; it must be built with the catalog in hand. */
export function customLineupSelections(
	catalog: LoadoutCatalog,
	lineup: CustomLineup
): (string | null)[][] {
	return [...lineup[0], ...lineup[1]].map((ship) => {
		const pilot = customPilotById(catalog, ship.pilot);
		if (!pilot) return [];
		return pilot.slots.map((slot) =>
			Object.prototype.hasOwnProperty.call(ship.slots, slot.key)
				? (ship.slots[slot.key] ?? null)
				: slot.default_option
		);
	});
}

/** Stable list interchange version. The document carries the same positional
 *  `side_sizes`/`pilots`/`selections` rows the create-game API accepts, plus
 *  informational totals that the server recomputes and never trusts. */
export const LIST_SCHEMA = 'wing-engine/list@1';
export const LIST_FORMAT = 'standard-50p';

/** Informational only: the create API remains authoritative for points and
 *  factions. Importing a document with edited totals still validates the rows. */
export interface ListTotals {
	points: [number, number];
	factions: [string, string];
}

/** One exported two-sided Standard 50P list. */
export interface ListDocument {
	schema: typeof LIST_SCHEMA;
	/** Committed format id the list was built for (for example
	 *  `standard-50p` or `aces-high`). Old documents without the field are
	 *  Standard. */
	format: string;
	/** Catalog squad that owns the rows, e.g. `card-demo-custom`. */
	squad: string;
	/** Ships on player 1 and player 2, in that order. */
	side_sizes: [number, number];
	/** Side-major pilot ids. Never null: a dynamic list needs an explicit row. */
	pilots: string[];
	/** Side-major rows in each selected pilot's own printed bar order. */
	selections: (string | null)[][];
	totals: ListTotals;
}

/** The exact fields `POST /api/games` receives for a list document. */
export interface ListGameRequest {
	format: string;
	squad: string;
	side_sizes: [number, number];
	pilots: string[];
	selections: (string | null)[][];
}

export interface ImportedList {
	document: ListDocument;
	lineup: CustomLineup;
}

function listFail(message: string): never {
	throw new Error(`invalid list: ${message}`);
}

function listObject(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		listFail(`${path} must be a JSON object`);
	}
	return value as Record<string, unknown>;
}

function listArray(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) listFail(`${path} must be an array`);
	return value;
}

function listString(value: unknown, path: string): string {
	if (typeof value !== 'string') listFail(`${path} must be a string`);
	return value;
}

function listInteger(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isInteger(value)) {
		listFail(`${path} must be an integer`);
	}
	return value;
}

function parseListText(text: string): unknown {
	const trimmed = text.replace(/^\uFEFF/, '').trim();
	if (trimmed.length === 0) listFail('the JSON document is empty');
	try {
		return JSON.parse(trimmed);
	} catch (error) {
		listFail(`malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
}

function listTotals(value: unknown, path: string): ListTotals {
	const totals = listObject(value, path);
	const points = listArray(totals.points, `${path}.points`);
	if (points.length !== 2) listFail(`${path}.points must have two entries, one per side`);
	const factions = listArray(totals.factions, `${path}.factions`);
	if (factions.length !== 2) listFail(`${path}.factions must have two entries, one per side`);
	return {
		points: [listInteger(points[0], `${path}.points[0]`), listInteger(points[1], `${path}.points[1]`)],
		factions: [
			listString(factions[0], `${path}.factions[0]`),
			listString(factions[1], `${path}.factions[1]`)
		]
	};
}

/** Validate a decoded list document against the live catalog and convert every
 *  row back to the catalog's slot keys. This never clamps or drops a row: an
 *  unknown pilot, a wrong row length, a duplicate limited pilot or an illegal
 *  loadout rejects the whole document with the row id in the message. */
export function validateListDocument(
	catalog: LoadoutCatalog,
	value: unknown,
	formats?: readonly FormatInfo[]
): ListDocument {
	const raw = listObject(value, 'list');
	const schema = listString(raw.schema, 'schema');
	if (schema !== LIST_SCHEMA) {
		listFail(`unsupported schema ${JSON.stringify(schema)}; expected ${LIST_SCHEMA}`);
	}
	// A document written before format-aware saves has no `format`; it was
	// Standard by definition.
	const formatId = raw.format === undefined ? LIST_FORMAT : listString(raw.format, 'format');
	const active =
		formats !== undefined
			? formatById(formats, formatId)
			: formatId === LIST_FORMAT
				? standardFormatFromCatalog(catalog)
				: null;
	if (!active) {
		listFail(
			`unsupported format ${JSON.stringify(formatId)}; the server sent ${formats?.map((row) => row.spec.id).join(', ') ?? LIST_FORMAT}`
		);
	}
	const lb = active.listbuilding;
	const squad = listString(raw.squad, 'squad');
	if (squad !== catalog.squad) {
		listFail(
			`unsupported squad ${JSON.stringify(squad)}; expected ${JSON.stringify(catalog.squad)}`
		);
	}
	const sizes = listArray(raw.side_sizes, 'side_sizes');
	if (sizes.length !== 2) listFail('side_sizes must have exactly two entries, one per player');
	const sideSizes: [number, number] = [
		listInteger(sizes[0], 'side_sizes[0]'),
		listInteger(sizes[1], 'side_sizes[1]')
	];
	for (const [player, size] of sideSizes.entries()) {
		if (size < lb.ships_min || size > lb.ships_max) {
			listFail(
				`side_sizes[${player}] is ${size}; each side needs ${lb.ships_min}-${lb.ships_max} ships`
			);
		}
	}
	const expected = sideSizes[0] + sideSizes[1];
	const pilotsRaw = listArray(raw.pilots, 'pilots');
	if (pilotsRaw.length !== expected) {
		listFail(`pilots has ${pilotsRaw.length} entries but side_sizes asks for ${expected}`);
	}
	const selectionsRaw = listArray(raw.selections, 'selections');
	if (selectionsRaw.length !== expected) {
		listFail(`selections has ${selectionsRaw.length} rows but side_sizes asks for ${expected}`);
	}

	const pilots: string[] = [];
	const selections: (string | null)[][] = [];
	const sidePoints: [number, number] = [0, 0];
	const sideFactions: [string | null, string | null] = [null, null];
	const sideHugeCount: [number, number] = [0, 0];
	const sideHugePoints: [number, number] = [0, 0];
	const sideCommand: string[][] = [[], []];
	const limited = new Map<string, { count: number; limit: number }>();
	const limitedCards = new Map<string, { count: number; limit: number }>();
	let flat = 0;
	for (let player = 0; player < 2; player += 1) {
		for (let position = 0; position < sideSizes[player]; position += 1, flat += 1) {
			const pilotId = listString(pilotsRaw[flat], `pilots[${flat}]`);
			if (pilotId.length === 0) listFail(`pilots[${flat}] cannot be empty`);
			const pilot = customPilotById(catalog, pilotId);
			if (!pilot) {
				listFail(
					`pilots[${flat}] (player ${player + 1} ship ${position + 1}): unknown pilot id ${JSON.stringify(pilotId)}`
				);
			}
			if (lb.faction === 'single') {
				if (sideFactions[player] === null) {
					sideFactions[player] = pilot.faction_label;
				} else if (sideFactions[player] !== pilot.faction_label) {
					listFail(
						`pilots[${flat}] (${pilot.id}): ${pilot.faction_label} cannot join player ${player + 1}'s ${sideFactions[player]} side; all ships on a side must be one faction`
					);
				}
			}
			sidePoints[player] += pilot.points;
			if (pilot.base === 'Huge') {
				sideHugeCount[player] += 1;
				sideHugePoints[player] += pilot.points;
			}
			for (const cap of lb.special_caps) {
				if (
					cap.kind === 'pilot_points_max' &&
					cap.applies_to === 'each_ship' &&
					pilot.points > cap.value
				) {
					listFail(
						`pilots[${flat}] (${pilot.id}): ${pilot.name} is ${pilot.points} points; ${active.spec.name} caps each pilot at ${cap.value}`
					);
				}
			}
			pilots.push(pilot.id);
			if (pilot.limited > 0) {
				const key = `${player}:${pilot.name}`;
				const entry = limited.get(key) ?? { count: 0, limit: pilot.limited };
				entry.count += 1;
				entry.limit = Math.max(entry.limit, pilot.limited);
				limited.set(key, entry);
				if (entry.count > entry.limit) {
					listFail(
						`pilots[${flat}] (${pilot.id}): limited pilot ${pilot.name} selected ${entry.count} times on player ${player + 1}; limit is ${entry.limit}`
					);
				}
			}

			const row = listArray(selectionsRaw[flat], `selections[${flat}]`);
			if (row.length !== pilot.slots.length) {
				listFail(
					`selections[${flat}] (${pilot.id}) has ${row.length} slot entries; ${pilot.name} needs ${pilot.slots.length} in printed bar order`
				);
			}
			let loadoutSpent = 0;
			const picked: (string | null)[] = [];
			const onShip = new Set<string>();
			for (const [slotIndex, slot] of pilot.slots.entries()) {
				const id = row[slotIndex];
				if (id === null) {
					picked.push(null);
					const fixed = slot.fixed ? slot.fixed_card : null;
					if (fixed) {
						if (onShip.has(fixed.name)) {
							listFail(
								`selections[${flat}][${slotIndex}] (${pilot.id} ${slot.slot}): ${pilot.name} already has card ${fixed.name}; a ship cannot equip two copies`
							);
						}
						onShip.add(fixed.name);
						if (fixed.limited > 0) {
							const key = `${player}:${fixed.name}`;
							const entry = limitedCards.get(key) ?? {
								count: 0,
								limit: fixed.limited
							};
							entry.count += 1;
							entry.limit = Math.max(entry.limit, fixed.limited);
							limitedCards.set(key, entry);
							if (entry.count > entry.limit) {
								listFail(
									`selections[${flat}][${slotIndex}]: limited card ${fixed.name} selected ${entry.count} times on player ${player + 1}; limit is ${entry.limit}`
								);
							}
						}
					}
					continue;
				}
				if (typeof id !== 'string') {
					listFail(`selections[${flat}][${slotIndex}] must be an option id string or null`);
				}
				if (id.length === 0) {
					listFail(
						`selections[${flat}][${slotIndex}] cannot be empty; use null for an empty slot`
					);
				}
				const option = slot.options.find((candidate) => candidate.id === id);
				if (!option) {
					listFail(
						`selections[${flat}][${slotIndex}] (${pilot.id} ${slot.slot}): unknown option id ${JSON.stringify(id)}`
					);
				}
				if (onShip.has(option.name)) {
					listFail(
						`selections[${flat}][${slotIndex}] (${pilot.id} ${slot.slot}): ${pilot.name} already has card ${option.name}; a ship cannot equip two copies`
					);
				}
				onShip.add(option.name);
				if (option.limited > 0) {
					const key = `${player}:${option.name}`;
					const entry = limitedCards.get(key) ?? { count: 0, limit: option.limited };
					entry.count += 1;
					entry.limit = Math.max(entry.limit, option.limited);
					limitedCards.set(key, entry);
					if (entry.count > entry.limit) {
						listFail(
							`selections[${flat}][${slotIndex}]: limited card ${option.name} selected ${entry.count} times on player ${player + 1}; limit is ${entry.limit}`
						);
					}
				}
				if (option.slot.toLowerCase() === 'command') {
					sideCommand[player].push(option.name);
				}
				loadoutSpent += option.points;
				picked.push(id);
			}
			if (loadoutSpent > pilot.loadout) {
				listFail(
					`pilots[${flat}] (${pilot.id}): ${loadoutSpent} loadout spent, ${pilot.loadout} available on ${pilot.name}`
				);
			}
			selections.push(picked);
		}
	}

	for (let player = 0; player < 2; player += 1) {
		const points = sidePoints[player];
		if (points < lb.points_min || points > lb.points_max) {
			listFail(
				`player ${player + 1}: ${points} pilot points; ${active.spec.name} requires ${lb.points_min}-${lb.points_max}`
			);
		}
		if (sideHugeCount[player] > 0 && !lb.huge_ships_allowed) {
			listFail(
				`player ${player + 1}: ${sideHugeCount[player]} huge ship(s); ${active.spec.name} does not allow them`
			);
		}
		if (sideHugeCount[player] < lb.huge_ships_min) {
			listFail(
				`player ${player + 1}: ${sideHugeCount[player]} huge ship(s); ${active.spec.name} requires at least ${lb.huge_ships_min}`
			);
		}
		if (lb.max_huge_ships > 0 && sideHugeCount[player] > lb.max_huge_ships) {
			listFail(
				`player ${player + 1}: ${sideHugeCount[player]} huge ship(s); ${active.spec.name} allows at most ${lb.max_huge_ships}`
			);
		}
		if (lb.max_points_on_huge > 0 && sideHugePoints[player] > lb.max_points_on_huge) {
			listFail(
				`player ${player + 1}: ${sideHugePoints[player]} points on huge ships; ${active.spec.name} allows at most ${lb.max_points_on_huge}`
			);
		}
		if (sideCommand[player].length > 0 && !lb.command_slot_allowed) {
			listFail(
				`player ${player + 1}: Command upgrade(s) ${sideCommand[player].join(', ')}; ${active.spec.name} does not allow them`
			);
		}
	}

	if (raw.totals !== undefined) {
		// Shape-check the informational block, then ignore its values: the
		// catalog rows above are the only source of points and factions.
		listTotals(raw.totals, 'totals');
	}
	return {
		schema: LIST_SCHEMA,
		format: active.spec.id,
		squad,
		side_sizes: sideSizes,
		pilots,
		selections,
		totals: {
			points: [sidePoints[0], sidePoints[1]],
			factions: [
				sideFactions[0] ?? catalog.sides[0]?.faction ?? '',
				sideFactions[1] ?? catalog.sides[1]?.faction ?? ''
			]
		}
	};
}

/** Decode and validate a pasted or file-selected list JSON document. */
export function importListDocument(
	catalog: LoadoutCatalog,
	text: string,
	formats?: readonly FormatInfo[]
): ListDocument {
	return validateListDocument(catalog, parseListText(text), formats);
}

/** Build the exact `POST /api/games` fields for a validated list document. */
export function listGameRequest(document: ListDocument): ListGameRequest {
	return {
		format: document.format,
		squad: document.squad,
		side_sizes: [document.side_sizes[0], document.side_sizes[1]],
		pilots: [...document.pilots],
		selections: document.selections.map((row) => [...row])
	};
}

/** Export the current sides as a stable, versioned list document. Totals are
 *  informational; the server recomputes them from the committed catalog. The
 *  format id is the selected committed format, never an implied Standard. */
export function exportListDocument(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	format: FormatInfo | string = LIST_FORMAT
): ListDocument {
	const totals = customLineupTotals(
		catalog,
		lineup,
		typeof format === 'string' ? undefined : format
	);
	const request = customLineupRequest(catalog, lineup);
	return {
		schema: LIST_SCHEMA,
		format: typeof format === 'string' ? format : format.spec.id,
		squad: catalog.squad,
		side_sizes: [request.side_sizes[0], request.side_sizes[1]],
		pilots: request.pilots.map((pilot) => pilot ?? ''),
		selections: request.selections.map((row) => [...row]),
		totals: {
			points: [totals.sides[0].points, totals.sides[1].points],
			factions: [totals.sides[0].faction, totals.sides[1].faction]
		}
	};
}

/** Stable on-disk JSON: fixed key order, two-space indent and a final newline. */
export function serializeListDocument(document: ListDocument): string {
	const stable: ListDocument = {
		schema: LIST_SCHEMA,
		format: document.format,
		squad: document.squad,
		side_sizes: [document.side_sizes[0], document.side_sizes[1]],
		pilots: [...document.pilots],
		selections: document.selections.map((row) => [...row]),
		totals: {
			points: [document.totals.points[0], document.totals.points[1]],
			factions: [document.totals.factions[0], document.totals.factions[1]]
		}
	};
	return `${JSON.stringify(stable, null, 2)}\n`;
}

/** Compact JSON text for a list share URL. The list is already validated and
 *  carries only stable scalar/array fields; encoding it keeps the link free of
 *  server-side storage and works across devices. */
export function encodeListShare(document: ListDocument): string {
	const stable = JSON.parse(serializeListDocument(document)) as ListDocument;
	return encodeURIComponent(JSON.stringify(stable));
}

/** Build a same-origin share URL with the list in the fragment. The fragment
 *  never reaches the server; a recipient opens it and imports the list through
 *  the normal client validator. */
export function shareListUrl(document: ListDocument, base: string): string {
	const url = new URL(base);
	url.hash = '';
	return `${url.toString()}#list=${encodeListShare(document)}`;
}

/** Extract the raw list JSON from a `#list=` fragment, or null when absent.
 *  Malformed percent escapes are reported rather than silently ignored. */
export function sharedListText(hash: string): string | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!raw.startsWith('list=')) return null;
	try {
		return decodeURIComponent(raw.slice('list='.length));
	} catch {
		throw new Error('shared list link is malformed');
	}
}

/** The server-stored counterpart of `#list=`: the fragment names an opaque
 *  squad id and the document itself stays on the server. */
export const SQUAD_SHARE_PARAM = 'squad';
/** A published squad id: 16 lowercase hex characters, the whole capability. */
export const SQUAD_ID_PATTERN = /^[0-9a-f]{16}$/;

export function isSquadShareId(id: string): boolean {
	return SQUAD_ID_PATTERN.test(id);
}

/** Build a same-origin `#squad=<id>` link. No document bytes travel in the
 *  URL, so the link is short and does not leak the list to link previews. */
export function squadShareUrl(id: string, base: string): string {
	if (!isSquadShareId(id)) throw new Error(`invalid squad id ${JSON.stringify(id)}`);
	const url = new URL(base);
	url.hash = '';
	return `${url.toString()}#${SQUAD_SHARE_PARAM}=${id}`;
}

/** Extract the id from a `#squad=` fragment, or null when absent. */
export function sharedSquadId(hash: string): string | null {
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	const prefix = `${SQUAD_SHARE_PARAM}=`;
	if (!raw.startsWith(prefix)) return null;
	let id: string;
	try {
		id = decodeURIComponent(raw.slice(prefix.length));
	} catch {
		throw new Error('shared squad link is malformed');
	}
	if (!isSquadShareId(id)) throw new Error('shared squad id is malformed');
	return id;
}

/** Publish one validated list and return the server's opaque id. The server
 *  revalidates with the same validator game creation uses; the client only
 *  moves the document. */
export async function publishSquad(document: ListDocument): Promise<string> {
	const body = await request('/api/squads', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(document)
	});
	const record = listObject(body, 'squad');
	const id = listString(record.id, 'squad.id');
	if (!isSquadShareId(id)) {
		throw new Error(`invalid squad id from the server: ${JSON.stringify(id)}`);
	}
	return id;
}

/** Delete one published squad by its capability. The server returns 204 on
 *  success and 404 for an unknown, wrong or expired id; the UI treats the 404
 *  as an expired link and clears the published state. */
export async function deletePublishedSquad(id: string): Promise<void> {
	if (!isSquadShareId(id)) throw new Error(`invalid squad id ${JSON.stringify(id)}`);
	await request(`/api/squads/${id}`, { method: 'DELETE' });
}

/** Fetch a published squad and run it through the same validator and mapper as
 *  the paste/file import path. A stored document gets no shortcut. */
export async function importSharedSquad(
	catalog: LoadoutCatalog,
	id: string,
	formats?: readonly FormatInfo[]
): Promise<ImportedList> {
	if (!isSquadShareId(id)) throw new Error(`invalid squad id ${JSON.stringify(id)}`);
	const body = await request(`/api/squads/${id}`);
	return importList(catalog, JSON.stringify(body), formats);
}

/** Map a validated document back into the form's keyed lineup state. */
export function lineupFromListDocument(
	catalog: LoadoutCatalog,
	document: ListDocument,
	formats?: readonly FormatInfo[]
): CustomLineup {
	const valid = validateListDocument(catalog, document, formats);
	const sides: CustomLineup = [[], []];
	let flat = 0;
	for (let player = 0; player < 2; player += 1) {
		for (let position = 0; position < valid.side_sizes[player]; position += 1, flat += 1) {
			const pilot = customPilotById(catalog, valid.pilots[flat]);
			if (!pilot) listFail(`pilots[${flat}]: unknown pilot id ${JSON.stringify(valid.pilots[flat])}`);
			const slots: Record<string, string | null> = {};
			for (const [slotIndex, slot] of pilot.slots.entries()) {
				slots[slot.key] = valid.selections[flat][slotIndex] ?? null;
			}
			sides[player].push({ pilot: pilot.id, slots });
		}
	}
	return sides;
}

/** Parse, validate and map in one call for the import control. */
export function importList(
	catalog: LoadoutCatalog,
	text: string,
	formats?: readonly FormatInfo[]
): ImportedList {
	const document = importListDocument(catalog, text, formats);
	return {
		document,
		lineup: lineupFromListDocument(catalog, document, formats)
	};
}

/** Browser-safe saved-squad storage contract; `window.localStorage` matches it. */
export interface SquadStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export const SAVED_SQUADS_SCHEMA = 'wing-engine/saved-squads@1';
export const SAVED_SQUADS_KEY = 'wing-engine.saved-squads@1';
export const SAVED_SQUAD_LIMIT = 10;
export const SAVED_SQUAD_NAME_LIMIT = 48;

/** One named list in browser storage. It contains no game id, frames or other
 *  transient session state, only the interchange document. */
export interface SavedSquad {
	schema: typeof SAVED_SQUADS_SCHEMA;
	name: string;
	saved_at: string;
	list: ListDocument;
}

export interface SavedSquadStore {
	schema: typeof SAVED_SQUADS_SCHEMA;
	squads: SavedSquad[];
}

export interface SavedSquadLoadResult {
	squads: SavedSquad[];
	error: string | null;
}

export interface SavedSquadSaveResult extends SavedSquadLoadResult {
	saved: SavedSquad | null;
}

const STORAGE_UNAVAILABLE =
	'browser storage is unavailable; saved squads cannot be read or written, but the manual builder still works';
const STORAGE_CORRUPT = 'saved squads in browser storage are corrupt; starting with none';

function storageReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Resolve localStorage without letting a privacy mode or blocked origin throw
 *  during module or component setup. */
export function browserSquadStorage(): SquadStorage | null {
	try {
		if (typeof window === 'undefined') return null;
		return window.localStorage;
	} catch {
		return null;
	}
}

function basicListDocument(value: unknown): value is ListDocument {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const raw = value as Record<string, unknown>;
	if (raw.schema !== LIST_SCHEMA || raw.format !== LIST_FORMAT) return false;
	if (typeof raw.squad !== 'string' || raw.squad.length === 0) return false;
	if (
		!Array.isArray(raw.side_sizes) ||
		raw.side_sizes.length !== 2 ||
		!raw.side_sizes.every((size) => typeof size === 'number' && Number.isInteger(size))
	) {
		return false;
	}
	if (!Array.isArray(raw.pilots) || !raw.pilots.every((id) => typeof id === 'string')) {
		return false;
	}
	if (
		!Array.isArray(raw.selections) ||
		!raw.selections.every(
			(row) => Array.isArray(row) && row.every((id) => id === null || typeof id === 'string')
		)
	) {
		return false;
	}
	const totals = raw.totals;
	if (typeof totals !== 'object' || totals === null || Array.isArray(totals)) return false;
	const info = totals as Record<string, unknown>;
	return (
		Array.isArray(info.points) &&
		info.points.length === 2 &&
		info.points.every((point) => typeof point === 'number' && Number.isInteger(point)) &&
		Array.isArray(info.factions) &&
		info.factions.length === 2 &&
		info.factions.every((faction) => typeof faction === 'string')
	);
}

function savedSquad(value: unknown): SavedSquad | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const raw = value as Record<string, unknown>;
	if (raw.schema !== SAVED_SQUADS_SCHEMA) return null;
	if (typeof raw.name !== 'string') return null;
	const name = raw.name.trim();
	if (name.length === 0 || name.length > SAVED_SQUAD_NAME_LIMIT) return null;
	if (typeof raw.saved_at !== 'string' || raw.saved_at.length === 0) return null;
	if (!basicListDocument(raw.list)) return null;
	return {
		schema: SAVED_SQUADS_SCHEMA,
		name,
		saved_at: raw.saved_at,
		list: raw.list
	};
}

function copyListDocument(document: ListDocument): ListDocument {
	return {
		schema: LIST_SCHEMA,
		format: LIST_FORMAT,
		squad: document.squad,
		side_sizes: [document.side_sizes[0], document.side_sizes[1]],
		pilots: [...document.pilots],
		selections: document.selections.map((row) => [...row]),
		totals: {
			points: [document.totals.points[0], document.totals.points[1]],
			factions: [document.totals.factions[0], document.totals.factions[1]]
		}
	};
}

function readSavedSquadStore(storage: SquadStorage | null): SavedSquadLoadResult {
	if (!storage) return { squads: [], error: STORAGE_UNAVAILABLE };
	let raw: string | null;
	try {
		raw = storage.getItem(SAVED_SQUADS_KEY);
	} catch (error) {
		return { squads: [], error: `could not read saved squads: ${storageReason(error)}` };
	}
	if (raw === null || raw.trim() === '') return { squads: [], error: null };
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return { squads: [], error: STORAGE_CORRUPT };
	}
	if (
		typeof value !== 'object' ||
		value === null ||
		Array.isArray(value) ||
		(value as Record<string, unknown>).schema !== SAVED_SQUADS_SCHEMA
	) {
		return { squads: [], error: STORAGE_CORRUPT };
	}
	const rows = (value as Record<string, unknown>).squads;
	if (!Array.isArray(rows)) return { squads: [], error: STORAGE_CORRUPT };
	const squads: SavedSquad[] = [];
	let dropped = 0;
	for (const row of rows) {
		const entry = savedSquad(row);
		if (entry) squads.push(entry);
		else dropped += 1;
	}
	const overflow = Math.max(0, squads.length - SAVED_SQUAD_LIMIT);
	const bounded = squads.slice(0, SAVED_SQUAD_LIMIT);
	const ignored = dropped + overflow;
	return {
		squads: bounded,
		error:
			ignored > 0
				? `ignored ${ignored} corrupt or over-limit saved squad${ignored === 1 ? '' : 's'}; the manual builder still works`
				: null
	};
}

/** Read named squads. Missing, blocked or corrupt storage returns an empty
 *  list plus an inline message instead of throwing. */
export function loadSavedSquads(storage: SquadStorage | null): SavedSquadLoadResult {
	return readSavedSquadStore(storage);
}

/** Save or replace a named squad, bounded to SAVED_SQUAD_LIMIT entries. */
export function saveSquad(
	storage: SquadStorage | null,
	name: string,
	list: ListDocument,
	savedAt = new Date().toISOString()
): SavedSquadSaveResult {
	if (!storage) return { squads: [], saved: null, error: STORAGE_UNAVAILABLE };
	const trimmed = name.trim();
	if (trimmed.length === 0) {
		return { squads: [], saved: null, error: 'squad name is required' };
	}
	if (trimmed.length > SAVED_SQUAD_NAME_LIMIT) {
		return {
			squads: [],
			saved: null,
			error: `squad name must be 1-${SAVED_SQUAD_NAME_LIMIT} characters`
		};
	}
	if (!basicListDocument(list)) {
		return { squads: [], saved: null, error: 'cannot save a malformed list document' };
	}
	const loaded = readSavedSquadStore(storage);
	const squads = loaded.squads.map((entry) => ({ ...entry, list: copyListDocument(entry.list) }));
	const entry: SavedSquad = {
		schema: SAVED_SQUADS_SCHEMA,
		name: trimmed,
		saved_at: savedAt,
		list: copyListDocument(list)
	};
	const index = squads.findIndex(
		(candidate) => candidate.name.toLowerCase() === trimmed.toLowerCase()
	);
	if (index >= 0) {
		squads[index] = entry;
	} else {
		if (squads.length >= SAVED_SQUAD_LIMIT) {
			return {
				squads,
				saved: null,
				error: `saved squads are full (${SAVED_SQUAD_LIMIT}); delete one before saving`
			};
		}
		squads.push(entry);
	}
	const store: SavedSquadStore = { schema: SAVED_SQUADS_SCHEMA, squads };
	try {
		storage.setItem(SAVED_SQUADS_KEY, `${JSON.stringify(store, null, 2)}\n`);
	} catch (error) {
		return {
			squads: loaded.squads,
			saved: null,
			error: `could not save squads: ${storageReason(error)}`
		};
	}
	return { squads, saved: entry, error: null };
}

/** Delete one named squad and return the remaining bounded list. */
export function deleteSavedSquad(
	storage: SquadStorage | null,
	name: string
): SavedSquadLoadResult {
	if (!storage) return { squads: [], error: STORAGE_UNAVAILABLE };
	const loaded = readSavedSquadStore(storage);
	const squads = loaded.squads.filter((entry) => entry.name !== name);
	if (squads.length === loaded.squads.length) return loaded;
	const store: SavedSquadStore = { schema: SAVED_SQUADS_SCHEMA, squads };
	try {
		storage.setItem(SAVED_SQUADS_KEY, `${JSON.stringify(store, null, 2)}\n`);
	} catch (error) {
		return {
			squads: loaded.squads,
			error: `could not save squads: ${storageReason(error)}`
		};
	}
	return { squads, error: null };
}

/** One slot after applying the selected cards' slot-rewriting effects. */
export interface CustomSlotView {
	slot: LoadoutSlot;
	option: LoadoutOption | null;
	visible: boolean;
	enabled: boolean;
	reason: string | null;
}

/** The display/validation plan for one ship's selected card set. */
export interface CustomSlotPlan {
	slots: CustomSlotView[];
	selected: LoadoutOption[];
	reasons: string[];
}

function canonicalSlotKind(value: string): string {
	const normalized = value
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
	if (normalized === 'payload') return 'device';
	if (normalized === 'forcepower') return 'force';
	return normalized;
}

/** Apply `also_occupies`, `unequips` and `confers_addons` to one pilot's bar.
 *  Latent slots stay hidden until a selected card confers them; a removed or
 *  occupied slot stays visible only when it already holds a selected card, so
 *  the player has a control to clear it. */
export function customSlotPlan(
	pilot: Pick<PilotOption, 'name' | 'slots'>,
	state: Record<string, string | null>
): CustomSlotPlan {
	const selected: Array<{ slot: LoadoutSlot; option: LoadoutOption }> = [];
	const reasons: string[] = [];
	for (const slot of pilot.slots) {
		if (slot.fixed) continue;
		const id = Object.prototype.hasOwnProperty.call(state, slot.key)
			? state[slot.key]
			: slot.default_option;
		if (id === null || id === undefined) continue;
		const option = slot.options.find((candidate) => candidate.id === id);
		if (option) selected.push({ slot, option });
		else reasons.push(`${slot.slot}: option ${id} is not legal for ${pilot.name}`);
	}
	type Effect = {
		removed: number;
		occupied: number;
		added: number;
		removers: string[];
		occupiers: string[];
		conferrers: string[];
	};
	const effects = new Map<string, Effect>();
	const effect = (kind: string): Effect => {
		let current = effects.get(kind);
		if (!current) {
			current = {
				removed: 0,
				occupied: 0,
				added: 0,
				removers: [],
				occupiers: [],
				conferrers: []
			};
			effects.set(kind, current);
		}
		return current;
	};
	for (const { option } of selected) {
		for (const kind of option.unequips) {
			const row = effect(canonicalSlotKind(kind));
			row.removed += 1;
			row.removers.push(option.name);
		}
		for (const kind of option.also_occupies) {
			const row = effect(canonicalSlotKind(kind));
			row.occupied += 1;
			row.occupiers.push(option.name);
		}
		for (const kind of option.confers_addons) {
			const row = effect(canonicalSlotKind(kind));
			row.added += 1;
			row.conferrers.push(option.name);
		}
	}
	const base = new Map<string, LoadoutSlot[]>();
	const latent = new Map<string, LoadoutSlot[]>();
	for (const slot of pilot.slots) {
		const kind = canonicalSlotKind(slot.kind);
		const rows = slot.conditional ? latent : base;
		const list = rows.get(kind) ?? [];
		list.push(slot);
		rows.set(kind, list);
	}
	const kinds = new Set([...base.keys(), ...latent.keys(), ...effects.keys()]);
	const views: CustomSlotView[] = [];
	for (const kind of [...kinds].sort()) {
		const baseSlots = base.get(kind) ?? [];
		const latentSlots = latent.get(kind) ?? [];
		const row = effects.get(kind);
		const removed = row?.removed ?? 0;
		const occupied = row?.occupied ?? 0;
		const added = row?.added ?? 0;
		const available = baseSlots.length - removed + added;
		const used =
			selected.filter((entry) => canonicalSlotKind(entry.slot.kind) === kind).length +
			occupied -
			removed;
		if (used > available) {
			reasons.push(`${pilot.name}: ${used} ${kind} upgrades, ${available} slots`);
		}
		const removedIndexes = new Set(
			baseSlots.slice(Math.max(0, baseSlots.length - removed)).map((slot) => slot.index)
		);
		const activeLatent = new Set(latentSlots.slice(0, Math.max(0, added)).map((slot) => slot.index));
		const sourceIndexes = new Set(
			selected
				.filter((entry) =>
					entry.option.also_occupies.some((value) => canonicalSlotKind(value) === kind)
				)
				.map((entry) => entry.slot.index)
		);
		const candidates = [
			...baseSlots.filter((slot) => !removedIndexes.has(slot.index)),
			...latentSlots.filter((slot) => activeLatent.has(slot.index))
		].filter((slot) => !sourceIndexes.has(slot.index));
		const occupiedIndexes = new Set(
			candidates.slice(0, Math.max(0, occupied)).map((slot) => slot.index)
		);
		for (const slot of [...baseSlots, ...latentSlots]) {
			const option = selected.find((entry) => entry.slot.index === slot.index)?.option ?? null;
			const isRemoved = removedIndexes.has(slot.index);
			const isInactiveLatent = slot.conditional && !activeLatent.has(slot.index);
			const isOccupied = occupiedIndexes.has(slot.index);
			const reason = isRemoved
				? `removed by ${(row?.removers ?? []).join(', ')}`
				: isInactiveLatent
					? 'not conferred by a selected card'
					: isOccupied
						? `occupied by ${(row?.occupiers ?? []).join(', ')}`
						: null;
			const visible =
				slot.fixed || option !== null || (!isRemoved && !isInactiveLatent);
			views.push({
				slot,
				option,
				visible,
				enabled: !slot.fixed && !isRemoved && !isInactiveLatent && !isOccupied,
				reason
			});
		}
	}
	views.sort((a, b) => a.slot.index - b.slot.index);
	return { slots: views, selected: selected.map((entry) => entry.option), reasons };
}

/** Per-ship and per-side legality for the dynamic lineup. The server still
 *  re-runs the committed validator; this is the same shape so Start can be
 *  disabled with a visible reason before a request is sent. */
export function customLineupTotals(
	catalog: LoadoutCatalog,
	lineup: CustomLineup,
	format?: FormatInfo
): LoadoutTotals {
	const active = format ?? standardFormatFromCatalog(catalog);
	const lb = active.listbuilding;
	const ships: Record<number, LoadoutShipTotal> = {};
	const sidePoints = new Map<number, number>();
	const sideCounts = new Map<number, number>();
	const sideFactions = new Map<number, Set<string>>();
	const sideFactionLabels = new Map<number, string>();
	const sideReasons = new Map<number, string[]>();
	const sideHugeCount = new Map<number, number>();
	const sideHugePoints = new Map<number, number>();
	const sideCommand = new Map<number, string[]>();
	let flat = 0;
	for (const [player, picked] of lineup.entries()) {
		const reasons: string[] = [];
		const limited = new Map<string, { count: number; limit: number }>();
		const limitedCards = new Map<string, { count: number; limit: number }>();
		for (const ship of picked) {
			const pilot = customPilotById(catalog, ship.pilot);
			if (!pilot) {
				reasons.push(`missing pilot id ${ship.pilot || '(empty)'}`);
				flat += 1;
				continue;
			}
			let selected = 0;
			const slotReasons: string[] = [];
			const onShip = new Set<string>();
			for (const slot of pilot.slots) {
				if (!slot.fixed) continue;
				const fixed = slot.fixed_card;
				if (!fixed) continue;
				if (onShip.has(fixed.name)) {
					slotReasons.push(
						`${pilot.name} already has card ${fixed.name}; a ship cannot equip two copies`
					);
				}
				onShip.add(fixed.name);
				if (fixed.limited > 0) {
					const entry = limitedCards.get(fixed.name) ?? {
						count: 0,
						limit: fixed.limited
					};
					entry.count += 1;
					entry.limit = Math.max(entry.limit, fixed.limited);
					limitedCards.set(fixed.name, entry);
				}
			}
			const plan = customSlotPlan(pilot, ship.slots);
			slotReasons.push(...plan.reasons);
			for (const option of plan.selected) {
				selected += option.points;
				if (option.slot.toLowerCase() === 'command') {
					const command = sideCommand.get(player) ?? [];
					command.push(option.name);
					sideCommand.set(player, command);
				}
				if (onShip.has(option.name)) {
					slotReasons.push(
						`${pilot.name} already has card ${option.name}; a ship cannot equip two copies`
					);
				}
				onShip.add(option.name);
				if (option.limited > 0) {
					const entry = limitedCards.get(option.name) ?? {
						count: 0,
						limit: option.limited
					};
					entry.count += 1;
					entry.limit = Math.max(entry.limit, option.limited);
					limitedCards.set(option.name, entry);
				}
			}
			const total = pilot.points;
			ships[flat] = {
				index: flat,
				player,
				pilot,
				base: pilot.points,
				fixed: 0,
				selected,
				loadout_spent: selected,
				loadout: pilot.loadout,
				total
			};
			sidePoints.set(player, (sidePoints.get(player) ?? 0) + total);
			sideCounts.set(player, (sideCounts.get(player) ?? 0) + 1);
			if (pilot.base === 'Huge') {
				sideHugeCount.set(player, (sideHugeCount.get(player) ?? 0) + 1);
				sideHugePoints.set(player, (sideHugePoints.get(player) ?? 0) + total);
			}
			for (const cap of lb.special_caps) {
				if (
					cap.kind === 'pilot_points_max' &&
					cap.applies_to === 'each_ship' &&
					pilot.points > cap.value
				) {
					slotReasons.push(
						`${pilot.name} is ${pilot.points} points; ${active.spec.name} caps each pilot at ${cap.value}`
					);
				}
			}
			const factions = sideFactions.get(player) ?? new Set<string>();
			factions.add(pilot.faction_label);
			sideFactions.set(player, factions);
			if (!sideFactionLabels.has(player)) sideFactionLabels.set(player, pilot.faction_label);
			if (selected > pilot.loadout) {
				slotReasons.push(
					`${pilot.name}: ${selected} loadout spent, ${pilot.loadout} available`
				);
			}
			if (pilot.limited > 0) {
				const entry = limited.get(pilot.name) ?? { count: 0, limit: pilot.limited };
				entry.count += 1;
				entry.limit = Math.max(entry.limit, pilot.limited);
				limited.set(pilot.name, entry);
			}
			reasons.push(...slotReasons);
			flat += 1;
		}
		for (const [name, { count, limit }] of limited) {
			if (count > limit) reasons.push(`limited pilot ${name} selected ${count} times; limit is ${limit}`);
		}
		for (const [name, { count, limit }] of limitedCards) {
			if (count > limit) reasons.push(`limited card ${name} selected ${count} times; limit is ${limit}`);
		}
		sideReasons.set(player, reasons);
	}
	const sides = [0, 1].map((player) => {
		const points = sidePoints.get(player) ?? 0;
		const shipCount = sideCounts.get(player) ?? 0;
		const factions = sideFactions.get(player) ?? new Set<string>();
		const reasons = [...(sideReasons.get(player) ?? [])];
		if (shipCount < lb.ships_min || shipCount > lb.ships_max) {
			reasons.unshift(`${shipCount} ships (legal ${lb.ships_min}-${lb.ships_max})`);
		}
		if (points < lb.points_min || points > lb.points_max) {
			reasons.unshift(
				`card total ${points} points (legal ${lb.points_min}-${lb.points_max})`
			);
		}
		if (lb.faction === 'single' && factions.size > 1) {
			reasons.unshift(`mixed factions: ${[...factions].join(', ')}`);
		}
		const hugeCount = sideHugeCount.get(player) ?? 0;
		if (hugeCount > 0 && !lb.huge_ships_allowed) {
			reasons.unshift(`${hugeCount} huge ship(s); ${active.spec.name} does not allow them`);
		}
		if (hugeCount < lb.huge_ships_min) {
			reasons.unshift(
				`${hugeCount} huge ship(s); ${active.spec.name} requires at least ${lb.huge_ships_min}`
			);
		}
		if (lb.max_huge_ships > 0 && hugeCount > lb.max_huge_ships) {
			reasons.unshift(
				`${hugeCount} huge ship(s); ${active.spec.name} allows at most ${lb.max_huge_ships}`
			);
		}
		const hugePoints = sideHugePoints.get(player) ?? 0;
		if (lb.max_points_on_huge > 0 && hugePoints > lb.max_points_on_huge) {
			reasons.unshift(
				`${hugePoints} points on huge ships; ${active.spec.name} allows at most ${lb.max_points_on_huge}`
			);
		}
		const command = sideCommand.get(player) ?? [];
		if (command.length > 0 && !lb.command_slot_allowed) {
			reasons.unshift(
				`Command upgrade(s) ${command.join(', ')}; ${active.spec.name} does not allow them`
			);
		}
		return {
			player,
			faction:
				factions.size === 1
					? (sideFactionLabels.get(player) ?? catalog.sides[player]?.faction ?? 'Mixed')
					: 'Mixed',
			ship_count: shipCount,
			points,
			point_cap: lb.points_max,
			over_cap: points > lb.points_max,
			legal_50: reasons.length === 0,
			reasons
		};
	});
	const total = sides.reduce((sum, side) => sum + side.points, 0);
	return {
		ships,
		sides,
		total,
		legal_50: sides.every((side) => side.legal_50)
	};
}

/** Presentation-only preview of the dynamic lineup: each selected pilot and
 *  the compiled cards currently picked in its own bar. */
export function previewCustomShips(
	catalog: LoadoutCatalog,
	lineup: CustomLineup
): PresetShip[] {
	const preview: PresetShip[] = [];
	let flat = 0;
	for (const [player, picked] of lineup.entries()) {
		for (const ship of picked) {
			const pilot = customPilotById(catalog, ship.pilot);
			if (!pilot) {
				preview.push({ player, index: flat, pilot: ship.pilot, ship: '', cards: [] });
				flat += 1;
				continue;
			}
			const cards: PresetCard[] = [];
			for (const slot of pilot.slots) {
				const id = ship.slots[slot.key] ?? slot.default_option;
				if (id === null || id === undefined) continue;
				const option = slot.options.find((candidate) => candidate.id === id);
				if (option) cards.push({ xws: option.xws, name: option.name, slot: option.slot });
			}
			preview.push({
				player,
				index: flat,
				pilot: pilot.name,
				ship: pilot.ship,
				faction: pilot.faction_label,
				cards
			});
			flat += 1;
		}
	}
	return preview;
}

export function previewMultiShips(
	preset: CardPreset,
	catalog: LoadoutCatalog,
	selections: SlotSelections = {},
	hotseat = false,
	pilots: PilotSelections = {}
): PresetShip[] {
	const rows = selectedMultiSelections(catalog, selections, hotseat, pilots);
	return preset.ships.map((ship, index) => {
		const info = catalog.ships.find((candidate) => candidate.index === index);
		if (!info) return ship;
		const pilot = pilotFor(catalog, info, pilots);
		const cards: PresetCard[] = [];
		for (const [slotIndex, slot] of pilotSlots(info, pilot).entries()) {
			if (slot.fixed) {
				if (slot.fixed_card) {
					cards.push({
						xws: slot.fixed_card.xws,
						name: slot.fixed_card.name,
						slot: slot.fixed_card.slot
					});
				}
				continue;
			}
			const id = rows[info.index][slotIndex];
			if (id === null) continue;
			const option = slot.options.find((candidate) => candidate.id === id);
			if (option) cards.push({ xws: option.xws, name: option.name, slot: option.slot });
		}
		for (const fixed of info.fixed_cards) {
			if (!cards.some((card) => card.xws === fixed.xws)) {
				cards.push({ xws: fixed.xws, name: fixed.name, slot: fixed.slot });
			}
		}
		return {
			...ship,
			index: info.index,
			faction: info.faction,
			pilot: pilot.name,
			cards
		};
	});
}

/** The preset's ships with the selected compiled card and fixed remainder.
 *  This is presentation only: the server has already chosen the legal options. */
export function previewShips(
	preset: CardPreset,
	catalog: LoadoutCatalog | null,
	selections: Record<number, string> = {},
	hotseat = false
): PresetShip[] {
	if (!catalog) return preset.ships;
	return preset.ships.map((ship, index) => {
		const info = catalog.ships.find((candidate) => candidate.index === index);
		if (!info) return ship;
		const selected = !hotseat && info.player !== 0
			? info.default_option
			: (selections[info.index] ?? info.default_option);
		const option = info.options.find((candidate) => candidate.id === selected) ?? info.options[0];
		if (!option) return ship;
		return {
			...ship,
			index: info.index,
			faction: info.faction,
			cards: [
				{ xws: option.xws, name: option.name, slot: option.slot },
				...info.fixed_cards
			]
		};
	});
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
	const response = await fetch(url, init);
	const text = await response.text();
	let body: unknown = null;
	if (text.length > 0) {
		try {
			body = JSON.parse(text);
		} catch {
			throw new ApiError(response.status, `${url}: response is not JSON`);
		}
	}
	if (!response.ok) {
		const message =
			typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).error === 'string'
				? String((body as Record<string, unknown>).error)
				: response.statusText || `HTTP ${response.status}`;
		throw new ApiError(response.status, message);
	}
	return body;
}

/** The visible hotseat badge text, or null for the ordinary bot game. */
export function hotseatSummary(
	header: Pick<GameHeader, 'hotseat' | 'players'>
): string | null {
	if (!header.hotseat) return null;
	const names = header.players.map((player) => player.name);
	const matchup = names.length === 2 ? ` · ${names[0]} vs ${names[1]}` : '';
	return `Hotseat · 2 players${matchup}`;
}

/**
 * The seat whose private view the browser should request. An ordinary game is
 * always the human seat from the header. Hotseat asks the current question's
 * player while a prompt is open and otherwise keeps the last known active seat.
 */
export function viewingSeatFor(
	hotseat: boolean,
	questionPlayer: number | null | undefined,
	human: number,
	lastSeat: number
): number {
	return hotseat ? questionPlayer ?? lastSeat : human;
}

/** Whose turn the prompt belongs to. A hotseat prompt never says "you". */
export function decisionOwner(
	question: Pick<Question, 'player'>,
	hotseat: boolean,
	playerName?: string
): string {
	if (!hotseat) return 'your decision';
	const seat = `player ${question.player + 1}`;
	return playerName ? `${seat} · ${playerName}` : seat;
}

/**
 * Start a game through `POST /api/games`. Two call shapes share this entry
 * point: the XWS-paste path passes a **boolean** `both` in the sixth position,
 * while the list/tournament path passes a **string** squad id there (or omits
 * it) followed by hotseat/loadout/selections/pilots/side_sizes. The sixth
 * argument discriminates them and each branch emits only its own fields.
 */
export async function createGame(
	seed = 7,
	human = 0,
	format?: string,
	scenario?: string,
	players?: number,
	bothOrSquad?: boolean | string,
	xwsOrHotseat?: unknown,
	xws2OrLoadout?: unknown,
	selections?: (string | null)[][],
	pilots?: (string | null)[],
	sideSizes?: number[]
): Promise<GameResponse> {
	const payload: Record<string, unknown> = { seed, human };
	if (format) payload.format = format;
	if (scenario) payload.scenario = scenario;
	if (players !== undefined) payload.players = players;
	if (typeof bothOrSquad === 'boolean') {
		// XWS paste path: only `both` can be a boolean in position six.
		if (bothOrSquad) payload.both = true;
		if (xwsOrHotseat !== undefined) payload.xws = xwsOrHotseat;
		if (xws2OrLoadout !== undefined) payload.xws2 = xws2OrLoadout;
	} else {
		// Custom-lineup / preset path, including the list and tournament callers.
		if (bothOrSquad) payload.squad = bothOrSquad;
		if (selections !== undefined) payload.selections = selections;
		else if (xws2OrLoadout !== undefined) payload.loadout = xws2OrLoadout;
		if (pilots !== undefined) payload.pilots = pilots;
		if (sideSizes !== undefined) payload.side_sizes = sideSizes;
		if (xwsOrHotseat) payload.hotseat = true;
	}
	const body = await request('/api/games', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return validateGameResponse(body);
}

export async function answerQuestion(
	game: string,
	question: number,
	option: string
): Promise<GameResponse> {
	const body = await request(`/api/games/${encodeURIComponent(game)}/answers`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ question, option })
	});
	return validateGameResponse(body);
}

export async function getGame(game: string, seat?: number): Promise<GameResponse> {
	const query = seat === undefined ? '' : `?seat=${seat}`;
	return validateGameResponse(await request(`/api/games/${encodeURIComponent(game)}${query}`));
}

/** Undo the last recorded decision: the engine rebuilds from the action prefix. */
export async function undoGame(game: string): Promise<GameResponse> {
	return validateGameResponse(
		await request(`/api/games/${encodeURIComponent(game)}/undo`, { method: 'POST' })
	);
}

export async function deleteGame(game: string): Promise<void> {
	const response = await fetch(`/api/games/${encodeURIComponent(game)}`, { method: 'DELETE' });
	if (!response.ok && response.status !== 404) {
		throw new ApiError(response.status, response.statusText || `HTTP ${response.status}`);
	}
}

export function replayUrl(game: string): string {
	return `/api/games/${encodeURIComponent(game)}/replay`;
}
