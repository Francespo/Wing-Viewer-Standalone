import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './live';
import {
	MAX_TOURNAMENT_ROUNDS,
	TOURNAMENT_SCHEMA,
	canStartRound,
	createTournament,
	getPairingGame,
	getTournament,
	isPairingGameId,
	isTournamentId,
	nextRoundNumber,
	playerName,
	replaceTournamentPlayers,
	reportTournamentResult,
	resultLabel,
	roundComplete,
	roundRows,
	standingSummary,
	startPairingGame,
	startTournamentRound,
	tournamentCapabilityFromHash,
	tournamentIdFromSearch,
	tournamentOrganizerUrl,
	tournamentShareUrl,
	validateCreatedTournament,
	validatePairingGameResponse,
	validateTournamentSnapshot,
	type PairingGameResponse,
	type StandingRow,
	type TournamentEvent,
	type TournamentSnapshot
} from './tournament';

const fetchMock = vi.fn();

function response(body: unknown, status = 200, statusText = 'OK') {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		text: async () => (body === undefined ? '' : JSON.stringify(body))
	} as unknown as Response;
}

const event: TournamentEvent = {
	schema: TOURNAMENT_SCHEMA,
	id: '0123456789abcdef',
	name: 'Friday Swiss',
	format: 'standard-50p',
	players: [
		{ name: 'Alice' },
		{ name: 'Bob', squad_id: 'fedcba9876543210' },
		{ name: 'Carol' }
	],
	rounds: []
};

const standings: StandingRow[] = [
	{
		rank: 1,
		player: 0,
		name: 'Alice',
		points: 3,
		wins: 1,
		draws: 0,
		losses: 0,
		byes: 0,
		opponent_points: 0
	},
	{
		rank: 2,
		player: 1,
		name: 'Bob',
		points: 0,
		wins: 0,
		draws: 0,
		losses: 1,
		byes: 0,
		opponent_points: 3
	},
	{
		rank: 3,
		player: 2,
		name: 'Carol',
		points: 0,
		wins: 0,
		draws: 0,
		losses: 0,
		byes: 0,
		opponent_points: 0
	}
];

const snapshot: TournamentSnapshot = { event, standings };
const capability = '1111111111111111';
const created = { ...snapshot, id: event.id, capability };

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('tournament API client', () => {
	it('creates an event and validates the public/secret split', async () => {
		fetchMock.mockResolvedValueOnce(response(created, 201, 'Created'));
		const result = await createTournament('Friday Swiss', 'standard-50p');
		expect(result.id).toBe(event.id);
		expect(result.capability).toBe(capability);
		expect(result.event.name).toBe('Friday Swiss');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/tournaments');
		expect(init.method).toBe('POST');
		expect(JSON.parse(String(init.body))).toEqual({
			name: 'Friday Swiss',
			format: 'standard-50p'
		});
	});

	it('reads an event without any capability header', async () => {
		fetchMock.mockResolvedValueOnce(response(snapshot));
		const result = await getTournament(event.id);
		expect(result).toEqual(snapshot);
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/tournaments/${event.id}`);
		expect(fetchMock.mock.calls[0][1]).toBeUndefined();
	});

	it('sends the organizer capability on every mutation', async () => {
		fetchMock.mockResolvedValueOnce(response(snapshot));
		await replaceTournamentPlayers(event.id, capability, [{ name: 'Alice' }]);
		let [, init] = fetchMock.mock.calls[0];
		expect(init.method).toBe('PUT');
		expect(init.headers['X-Tournament-Capability']).toBe(capability);
		expect(JSON.parse(String(init.body))).toEqual({ players: [{ name: 'Alice' }] });

		fetchMock.mockResolvedValueOnce(response(snapshot));
		await startTournamentRound(event.id, capability);
		[, init] = fetchMock.mock.calls[1];
		expect(init.method).toBe('POST');
		expect(init.headers['X-Tournament-Capability']).toBe(capability);

		fetchMock.mockResolvedValueOnce(response(snapshot));
		await reportTournamentResult(event.id, capability, 1, 0, 'draw');
		[, init] = fetchMock.mock.calls[2];
		expect(init.method).toBe('POST');
		expect(init.headers['X-Tournament-Capability']).toBe(capability);
		expect(JSON.parse(String(init.body))).toEqual({ pairing: 0, result: 'draw' });
	});

	it('starts and refreshes a linked pair game with the organizer capability', async () => {
		const gameId = 'g0123456789abcdef';
		const linked: PairingGameResponse = {
			...snapshot,
			game: gameId,
			status: 'asking',
			result: null
		};
		fetchMock.mockResolvedValueOnce(response(linked));
		const started = await startPairingGame(event.id, capability, 1, 0, 0, 1, 7);
		expect(started.game).toBe(gameId);
		expect(started.status).toBe('asking');
		expect(started.result).toBeNull();
		let [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			`/api/tournaments/${event.id}/rounds/1/pairings/0/game`
		);
		expect(init.method).toBe('POST');
		expect(init.headers['X-Tournament-Capability']).toBe(capability);
		expect(JSON.parse(String(init.body))).toEqual({
			a_side: 0,
			b_side: 1,
			seed: 7
		});

		const finished = {
			...linked,
			status: 'done',
			result: {
				winner: 0,
				points: [100, 0],
				round: 6,
				state_hash: '0123456789abcdef',
				over: true
			}
		};
		fetchMock.mockResolvedValueOnce(response(finished));
		const refreshed = await getPairingGame(event.id, capability, 1, 0);
		expect(refreshed.status).toBe('done');
		expect(refreshed.result?.winner).toBe(0);
		[url, init] = fetchMock.mock.calls[1];
		expect(url).toBe(
			`/api/tournaments/${event.id}/rounds/1/pairings/0/game`
		);
		expect(init.body).toBeUndefined();
		expect(init.headers['X-Tournament-Capability']).toBe(capability);
	});

	it('requires explicit sides and rejects a malformed linked-game reply', async () => {
		expect(isPairingGameId('g0123456789abcdef')).toBe(true);
		expect(isPairingGameId('0123456789abcdef')).toBe(false);
		await expect(
			startPairingGame(event.id, capability, 1, 0, 2, 1)
		).rejects.toThrow(/invalid side A/);
		expect(fetchMock).not.toHaveBeenCalled();
		fetchMock.mockResolvedValueOnce(
			response({
				...snapshot,
				game: 'not-a-game',
				status: 'asking',
				result: null
			})
		);
		await expect(getPairingGame(event.id, capability, 1, 0)).rejects.toThrow(
			/invalid tournament response/
		);
		expect(() =>
			validatePairingGameResponse({ ...snapshot, game: 'short' })
		).toThrow(/invalid tournament response/);
	});

	it('surfaces the server validation error', async () => {
		fetchMock.mockResolvedValueOnce(
			response({ error: 'round 1 is not complete; report every result' }, 409, 'Conflict')
		);
		const error = await startTournamentRound(event.id, capability).catch((caught) => caught);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(409);
		expect((error as ApiError).message).toMatch(/round 1 is not complete/);
	});

	it('rejects a malformed response before it reaches the page', async () => {
		fetchMock.mockResolvedValueOnce(
			response({ event: { schema: TOURNAMENT_SCHEMA, id: 'short' }, standings: [] })
		);
		await expect(getTournament(event.id)).rejects.toThrow(/invalid tournament response/);
	});

	it('validates ids and capability URLs', () => {
		expect(isTournamentId(event.id)).toBe(true);
		expect(isTournamentId('0123456789ABCDEF')).toBe(false);
		const base = 'https://wing.example/tournament?old=1#cap=old';
		expect(tournamentShareUrl(event.id, base)).toBe(
			`https://wing.example/tournament?old=1&id=${event.id}`
		);
		expect(tournamentOrganizerUrl(event.id, capability, base)).toBe(
			`https://wing.example/tournament?old=1&id=${event.id}#cap=${capability}`
		);
		expect(tournamentIdFromSearch(`?id=${event.id}`)).toBe(event.id);
		expect(tournamentIdFromSearch('?id=short')).toBeNull();
		expect(tournamentCapabilityFromHash(`#cap=${capability}`)).toBe(capability);
		expect(tournamentCapabilityFromHash('#cap=short')).toBeNull();
		expect(() => tournamentShareUrl('short', base)).toThrow(/invalid tournament id/);
		expect(() => tournamentOrganizerUrl(event.id, 'short', base)).toThrow(
			/invalid organizer capability/
		);
	});
});

describe('tournament rendering helpers', () => {
	const three: TournamentEvent = {
		...event,
		rounds: [
			{
				number: 1,
				pairings: [
					{ table: 1, a: 0, b: 1, result: null },
					{ table: 2, a: 2, b: null, result: 'bye' }
				]
			}
		]
	};

	it('turns pairings into table rows, including the bye', () => {
		const rows = roundRows(three, three.rounds[0]);
		expect(rows).toEqual([
			{
				index: 0,
				table: 1,
				left: 'Alice',
				right: 'Bob',
				byline: false,
				result: 'not reported',
				reported: false
			},
			{
				index: 1,
				table: 2,
				left: 'Carol',
				right: 'bye',
				byline: true,
				result: 'bye (3 points)',
				reported: true
			}
		]);
	});

	it('renders reported results and round readiness', () => {
		const complete: TournamentEvent = {
			...three,
			rounds: [
				{
					number: 1,
					pairings: [
						{ table: 1, a: 0, b: 1, result: 'a' },
						{ table: 2, a: 2, b: null, result: 'bye' }
					]
				}
			]
		};
		expect(roundRows(complete, complete.rounds[0])[0].result).toBe('Alice wins');
		expect(resultLabel('draw')).toBe('draw');
		expect(roundComplete(three.rounds[0])).toBe(false);
		expect(roundComplete(complete.rounds[0])).toBe(true);
		expect(canStartRound(event)).toBe(true);
		expect(canStartRound(three)).toBe(false);
		expect(canStartRound(complete)).toBe(true);
		expect(nextRoundNumber(complete)).toBe(2);
		expect(nextRoundNumber(event)).toBe(1);
	});

	it('uses names and summarizes standings', () => {
		expect(playerName(event, 0)).toBe('Alice');
		expect(playerName(event, 99)).toBe('player 100');
		expect(standingSummary(standings[0])).toBe('3 pts · 1W 0D 0L');
		expect(MAX_TOURNAMENT_ROUNDS).toBe(32);
	});

	it('accepts a well-formed snapshot and rejects a malformed id', () => {
		expect(validateTournamentSnapshot(snapshot)).toEqual(snapshot);
		expect(validateCreatedTournament(created).capability).toBe(capability);
		expect(() =>
			validateCreatedTournament({ ...created, id: 'short' })
		).toThrow(/invalid tournament response/);
	});
});
