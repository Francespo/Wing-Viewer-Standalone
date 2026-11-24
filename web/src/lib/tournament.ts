import { ApiError, GAME_STATUSES, type GameResult, type GameStatus } from './live';

/** Persisted Swiss events use the same 16-hex capability shape as squads. */
export const TOURNAMENT_SCHEMA = 'wing-engine/tournament@1';
export const TOURNAMENT_ID_LEN = 16;
export const MAX_TOURNAMENT_ROUNDS = 32;

export type MatchResult = 'a' | 'b' | 'draw' | 'bye';

export interface TournamentPlayer {
	name: string;
	squad_id?: string | null;
}

export interface TournamentPairing {
	table: number;
	a: number;
	b: number | null;
	result: MatchResult | null;
}

export interface TournamentRound {
	number: number;
	pairings: TournamentPairing[];
}

export interface TournamentEvent {
	schema: string;
	id: string;
	name: string;
	format: string;
	players: TournamentPlayer[];
	rounds: TournamentRound[];
}

export interface StandingRow {
	rank: number;
	player: number;
	name: string;
	squad_id?: string | null;
	points: number;
	wins: number;
	draws: number;
	losses: number;
	byes: number;
	opponent_points: number;
}

export interface TournamentSnapshot {
	event: TournamentEvent;
	standings: StandingRow[];
}

export interface CreatedTournament extends TournamentSnapshot {
	id: string;
	capability: string;
}

/** Organizer-only view of one pairing's linked live session. `game` is the
 *  private session id, never present in the public event snapshot. */
export interface PairingGameResponse extends TournamentSnapshot {
	game: string;
	status: GameStatus;
	result: GameResult | null;
}

const ID = /^[0-9a-f]{16}$/;
const GAME_ID = /^g[0-9a-f]{16}$/;
const RESULTS = new Set<MatchResult>(['a', 'b', 'draw', 'bye']);
const GAME_STATUS = new Set<GameStatus>(GAME_STATUSES);

export function isTournamentId(value: unknown): value is string {
	return typeof value === 'string' && ID.test(value);
}

export function isPairingGameId(value: unknown): value is string {
	return typeof value === 'string' && GAME_ID.test(value);
}

function fail(path: string, message: string): never {
	throw new Error(`invalid tournament response: ${path}: ${message}`);
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
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		fail(path, 'expected a non-negative integer');
	}
	return value;
}

function resultValue(value: unknown, path: string): MatchResult | null {
	if (value === null) return null;
	if (typeof value !== 'string' || !RESULTS.has(value as MatchResult)) {
		fail(path, 'expected a, b, draw, bye or null');
	}
	return value as MatchResult;
}

function gameStatus(value: unknown, path: string): GameStatus {
	if (typeof value !== 'string' || !GAME_STATUS.has(value as GameStatus)) {
		fail(path, `expected one of ${GAME_STATUSES.join(', ')}`);
	}
	return value as GameStatus;
}

function validateGameResult(value: unknown, path: string): GameResult {
	const row = object(value, path);
	const winner = row.winner;
	if (
		winner !== null &&
		(typeof winner !== 'number' || !Number.isInteger(winner) || winner < 0)
	) {
		fail(`${path}.winner`, 'expected a non-negative integer or null');
	}
	const points = array(row.points, `${path}.points`);
	if (points.length !== 2) fail(`${path}.points`, 'expected exactly two points');
	for (const [index, point] of points.entries()) {
		if (typeof point !== 'number' || !Number.isInteger(point)) {
			fail(`${path}.points[${index}]`, 'expected an integer');
		}
	}
	if (typeof row.over !== 'boolean') fail(`${path}.over`, 'expected a boolean');
	return {
		winner: winner as number | null,
		points: [points[0] as number, points[1] as number],
		round: integer(row.round, `${path}.round`),
		state_hash: string(row.state_hash, `${path}.state_hash`),
		over: row.over
	};
}

export function validatePairingGameResponse(value: unknown): PairingGameResponse {
	const row = object(value, 'pairing game');
	const snapshot = validateTournamentSnapshot(row);
	const game = string(row.game, 'pairing game.game');
	if (!isPairingGameId(game)) {
		fail('pairing game.game', 'expected g followed by 16 lowercase hex characters');
	}
	const raw = row.result;
	if (raw === undefined) fail('pairing game.result', 'expected a result or null');
	const result = raw === null ? null : validateGameResult(raw, 'pairing game.result');
	return {
		...snapshot,
		game,
		status: gameStatus(row.status, 'pairing game.status'),
		result
	};
}

function validatePlayer(value: unknown, path: string): TournamentPlayer {
	const row = object(value, path);
	const name = string(row.name, `${path}.name`);
	if (name.trim().length === 0) fail(`${path}.name`, 'must not be empty');
	const raw = row.squad_id;
	if (raw !== undefined && raw !== null && !isTournamentId(raw)) {
		fail(`${path}.squad_id`, 'expected 16 lowercase hex characters or null');
	}
	return {
		name,
		...(raw === undefined || raw === null ? {} : { squad_id: raw })
	};
}

function validatePairing(value: unknown, path: string): TournamentPairing {
	const row = object(value, path);
	const table = integer(row.table, `${path}.table`);
	const a = integer(row.a, `${path}.a`);
	const b = row.b === null ? null : integer(row.b, `${path}.b`);
	if (b === a) fail(`${path}.b`, 'a player cannot be paired with themselves');
	const result = resultValue(row.result, `${path}.result`);
	if (b === null && result !== 'bye') fail(`${path}.result`, 'a bye must carry the bye result');
	if (b !== null && result === 'bye') fail(`${path}.result`, 'a two-player pairing cannot be a bye');
	return { table, a, b, result };
}

function validateRound(value: unknown, path: string): TournamentRound {
	const row = object(value, path);
	const number = integer(row.number, `${path}.number`);
	if (number < 1) fail(`${path}.number`, 'must be at least 1');
	const pairings = array(row.pairings, `${path}.pairings`).map((pairing, index) =>
		validatePairing(pairing, `${path}.pairings[${index}]`)
	);
	return { number, pairings };
}

function validateEvent(value: unknown, path: string): TournamentEvent {
	const row = object(value, path);
	if (row.schema !== TOURNAMENT_SCHEMA) {
		fail(`${path}.schema`, `expected ${TOURNAMENT_SCHEMA}`);
	}
	if (!isTournamentId(row.id)) fail(`${path}.id`, 'expected 16 lowercase hex characters');
	const name = string(row.name, `${path}.name`);
	const format = string(row.format, `${path}.format`);
	const players = array(row.players, `${path}.players`).map((player, index) =>
		validatePlayer(player, `${path}.players[${index}]`)
	);
	const rounds = array(row.rounds, `${path}.rounds`).map((round, index) =>
		validateRound(round, `${path}.rounds[${index}]`)
	);
	return { schema: TOURNAMENT_SCHEMA, id: row.id, name, format, players, rounds };
}

function validateStanding(value: unknown, path: string): StandingRow {
	const row = object(value, path);
	const name = string(row.name, `${path}.name`);
	const raw = row.squad_id;
	if (raw !== undefined && raw !== null && !isTournamentId(raw)) {
		fail(`${path}.squad_id`, 'expected 16 lowercase hex characters or null');
	}
	return {
		rank: integer(row.rank, `${path}.rank`),
		player: integer(row.player, `${path}.player`),
		name,
		...(raw === undefined || raw === null ? {} : { squad_id: raw }),
		points: integer(row.points, `${path}.points`),
		wins: integer(row.wins, `${path}.wins`),
		draws: integer(row.draws, `${path}.draws`),
		losses: integer(row.losses, `${path}.losses`),
		byes: integer(row.byes, `${path}.byes`),
		opponent_points: integer(row.opponent_points, `${path}.opponent_points`)
	};
}

export function validateTournamentSnapshot(value: unknown): TournamentSnapshot {
	const row = object(value, 'tournament');
	return {
		event: validateEvent(row.event, 'tournament.event'),
		standings: array(row.standings, 'tournament.standings').map((standing, index) =>
			validateStanding(standing, `tournament.standings[${index}]`)
		)
	};
}

export function validateCreatedTournament(value: unknown): CreatedTournament {
	const row = object(value, 'tournament');
	if (!isTournamentId(row.id)) fail('tournament.id', 'expected 16 lowercase hex characters');
	if (!isTournamentId(row.capability)) {
		fail('tournament.capability', 'expected 16 lowercase hex characters');
	}
	const snapshot = validateTournamentSnapshot(row);
	if (row.id !== snapshot.event.id) fail('tournament.id', 'must match tournament.event.id');
	return {
		...snapshot,
		id: row.id,
		capability: row.capability
	};
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

function organizerHeaders(capability: string): Record<string, string> {
	if (!isTournamentId(capability)) {
		throw new Error(`invalid organizer capability ${JSON.stringify(capability)}`);
	}
	return {
		'Content-Type': 'application/json',
		'X-Tournament-Capability': capability
	};
}

export async function createTournament(
	name: string,
	format: string
): Promise<CreatedTournament> {
	const body = await request('/api/tournaments', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, format })
	});
	return validateCreatedTournament(body);
}

export async function getTournament(id: string): Promise<TournamentSnapshot> {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	return validateTournamentSnapshot(
		await request(`/api/tournaments/${encodeURIComponent(id)}`)
	);
}

export async function replaceTournamentPlayers(
	id: string,
	capability: string,
	players: TournamentPlayer[]
): Promise<TournamentSnapshot> {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	const body = await request(`/api/tournaments/${encodeURIComponent(id)}/players`, {
		method: 'PUT',
		headers: organizerHeaders(capability),
		body: JSON.stringify({ players })
	});
	return validateTournamentSnapshot(body);
}

export async function startTournamentRound(
	id: string,
	capability: string
): Promise<TournamentSnapshot> {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	const body = await request(`/api/tournaments/${encodeURIComponent(id)}/rounds`, {
		method: 'POST',
		headers: organizerHeaders(capability)
	});
	return validateTournamentSnapshot(body);
}

export async function reportTournamentResult(
	id: string,
	capability: string,
	round: number,
	pairing: number,
	result: 'a' | 'b' | 'draw'
): Promise<TournamentSnapshot> {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	const body = await request(
		`/api/tournaments/${encodeURIComponent(id)}/rounds/${round}/results`,
		{
			method: 'POST',
			headers: organizerHeaders(capability),
			body: JSON.stringify({ pairing, result })
		}
	);
	return validateTournamentSnapshot(body);
}

function pairingGamePath(id: string, round: number, pairing: number): string {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	if (!Number.isInteger(round) || round < 1) throw new Error(`invalid round ${round}`);
	if (!Number.isInteger(pairing) || pairing < 0) {
		throw new Error(`invalid pairing ${pairing}`);
	}
	return `/api/tournaments/${encodeURIComponent(id)}/rounds/${round}/pairings/${pairing}/game`;
}

/** Start a hotseat game from the explicit side of each player's saved list.
 *  The capability is required and never leaves this origin. */
export async function startPairingGame(
	id: string,
	capability: string,
	round: number,
	pairing: number,
	aSide: number,
	bSide: number,
	seed?: number
): Promise<PairingGameResponse> {
	if (aSide !== 0 && aSide !== 1) throw new Error(`invalid side A ${aSide}`);
	if (bSide !== 0 && bSide !== 1) throw new Error(`invalid side B ${bSide}`);
	if (seed !== undefined && (!Number.isInteger(seed) || seed < 0)) {
		throw new Error(`invalid seed ${seed}`);
	}
	const body = await request(pairingGamePath(id, round, pairing), {
		method: 'POST',
		headers: organizerHeaders(capability),
		body: JSON.stringify({
			a_side: aSide,
			b_side: bSide,
			...(seed === undefined ? {} : { seed })
		})
	});
	return validatePairingGameResponse(body);
}

/** Organizer-only refresh. The server records a finished game into the linked
 *  pairing and returns the updated snapshot; it never reconciles on the public
 *  event GET. */
export async function getPairingGame(
	id: string,
	capability: string,
	round: number,
	pairing: number
): Promise<PairingGameResponse> {
	const body = await request(pairingGamePath(id, round, pairing), {
		headers: organizerHeaders(capability)
	});
	return validatePairingGameResponse(body);
}

/** A public event link. The organizer capability never travels in the query. */
export function tournamentShareUrl(id: string, base: string): string {
	if (!isTournamentId(id)) throw new Error(`invalid tournament id ${JSON.stringify(id)}`);
	const url = new URL(base);
	url.searchParams.set('id', id);
	url.hash = '';
	return url.toString();
}

/** The organizer link keeps the capability in the fragment, so it is never
 *  sent to the server in a navigation request and never appears in logs. */
export function tournamentOrganizerUrl(id: string, capability: string, base: string): string {
	if (!isTournamentId(capability)) {
		throw new Error(`invalid organizer capability ${JSON.stringify(capability)}`);
	}
	const url = new URL(tournamentShareUrl(id, base));
	url.hash = `cap=${capability}`;
	return url.toString();
}

export function tournamentIdFromSearch(search: string): string | null {
	const id = new URLSearchParams(search).get('id');
	return isTournamentId(id) ? id : null;
}

export function tournamentCapabilityFromHash(hash: string): string | null {
	const params = new URLSearchParams(hash.replace(/^#/, ''));
	const capability = params.get('cap');
	return isTournamentId(capability) ? capability : null;
}

export function playerName(event: TournamentEvent, index: number): string {
	return event.players[index]?.name ?? `player ${index + 1}`;
}

export function resultLabel(result: MatchResult | null): string {
	switch (result) {
		case 'a':
		case 'b':
			return 'win';
		case 'draw':
			return 'draw';
		case 'bye':
			return 'bye (3 points)';
		default:
			return 'not reported';
	}
}

export interface PairingRow {
	index: number;
	table: number;
	left: string;
	right: string;
	byline: boolean;
	result: string;
	reported: boolean;
}

/** The row shape the tournament page renders for one round. */
export function roundRows(event: TournamentEvent, round: TournamentRound): PairingRow[] {
	return round.pairings.map((pairing, index) => {
		const left = playerName(event, pairing.a);
		const right = pairing.b === null ? 'bye' : playerName(event, pairing.b);
		const result =
			pairing.result === 'a'
				? `${left} wins`
				: pairing.result === 'b'
					? `${right} wins`
					: resultLabel(pairing.result);
		return {
			index,
			table: pairing.table,
			left,
			right,
			byline: pairing.b === null,
			result,
			reported: pairing.result !== null
		};
	});
}

export function roundComplete(round: TournamentRound): boolean {
	return round.pairings.length > 0 && round.pairings.every((pairing) => pairing.result !== null);
}

export function canStartRound(event: TournamentEvent): boolean {
	if (event.players.length < 2 || event.rounds.length >= MAX_TOURNAMENT_ROUNDS) return false;
	return event.rounds.length === 0 || roundComplete(event.rounds[event.rounds.length - 1]);
}

export function nextRoundNumber(event: TournamentEvent): number {
	return event.rounds.length + 1;
}

export function standingSummary(row: StandingRow): string {
	return `${row.points} pts · ${row.wins}W ${row.draws}D ${row.losses}L`;
}
