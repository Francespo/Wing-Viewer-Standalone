/**
 * Pure view models for the replay UI.
 *
 * Everything here is presentation: it selects a value the Rust writer already
 * sent (a frame's `scores`, the result's `bounty`/`points`, a player's seat or
 * colour) and formats it. No function computes scoring, respawn, range, arcs or
 * any other game rule; the TypeScript contract is data-only (D-078).
 */
import type { Frame, ReplayPlayer, ReplayResult, ReplayShip, ScenarioFeature } from './replay';
import { FACTION_COLOR } from './board';

/** The player-facing name for a format id. The engine owns the id; this only
 *  selects a label, never a rule or a format branch. */
export function formatLabel(format: string): string {
	switch (format) {
		case 'standard-50p':
			return 'Standard 50P';
		case 'aces-high':
			return 'Aces High';
		case 'epic-xwa':
			return 'Epic XWA';
		case 'epic-house':
			return 'Epic House';
		default:
			return format;
	}
}

/** The huge-ship trackers the engine sent. Only ships the writer marked with a
 *  huge base length (or printed energy) appear; every value is copied from the
 *  header/frame, never recomputed here. */
export interface HugeTracker {
	id: number;
	name: string;
	/** 160 mm printed huge base length. */
	baseLength: number;
	shields: number;
	hull: number;
	energy: number | null;
	energyCapacity: number | null;
	energyRecurring: number | null;
	shieldRecurring: number | null;
}

export function hugeTrackers(ships: ReplayShip[], frame: Frame | null): HugeTracker[] {
	const states = new Map((frame?.ships ?? []).map((state) => [state.id, state]));
	return ships
		.filter((ship) => ship.base_length !== undefined || ship.energy_capacity !== undefined)
		.map((ship) => {
			const state = states.get(ship.id);
			return {
				id: ship.id,
				name: ship.name,
				baseLength: ship.base_length ?? ship.base,
				shields: state?.shields ?? ship.shields,
				hull: state?.hull ?? ship.hull,
				energy: state?.energy ?? null,
				energyCapacity: ship.energy_capacity ?? null,
				energyRecurring: ship.energy_recurring ?? null,
				shieldRecurring: ship.shield_recurring ?? null
			};
		});
}

export interface ScoreRow {
	/** Zero-based position in `meta.players`; also the `frame.scores` index. */
	index: number;
	/** Printed 1-based seat (`P1`..`P8`). */
	seat: number;
	/** `P1`, `P2`, … */
	label: string;
	name: string;
	faction: ReplayPlayer['faction'];
	/** Seat colour, or the faction colour when the writer sent no palette. */
	color: string;
	/** The value to show: bounty tokens for Aces, mission points for Standard. */
	score: number;
	/** What `score` counts, for the UI label and tooltip. */
	unit: 'bounty' | 'MP';
}

/** The writer's player record for a ship, when it sent `owner` (D-078).
 *  Standard and every scenario have no owner. */
export function shipPlayer(
	ship: ReplayShip,
	players: ReplayPlayer[]
): ReplayPlayer | undefined {
	return ship.owner === undefined ? undefined : players[ship.owner];
}

/** A ship base colour: the owner's seat colour when `owner` is present, else
 *  the old faction colour. Standard therefore renders exactly as before. */
export function shipColor(ship: ReplayShip, players: ReplayPlayer[]): string {
	const player = shipPlayer(ship, players);
	return player ? playerColor(player) : FACTION_COLOR[ship.faction];
}

/** A public bounty badge (`B3`) for a ship card, or null at zero. The count is
 *  the engine's `bounty_tokens`; nothing is summed or recomputed here. */
export function bountyLabel(tokens: number | undefined): string | null {
	const count = tokens ?? 0;
	return count > 0 ? `B${count}` : null;
}

/** The writer's seat colour when present; the faction colour is the old
 *  Standard fallback, never a way to invent an Aces seat colour. */
export function playerColor(player: ReplayPlayer | undefined): string {
	if (!player) return FACTION_COLOR.unknown;
	return player.color ?? FACTION_COLOR[player.faction];
}

/** `P1`..`P8` from the writer's seat, falling back to the array position for a
 *  replay written before seats existed. */
export function seatLabel(player: ReplayPlayer, index: number): string {
	return `P${player.seat ?? index + 1}`;
}

/** A frame with `scores` is an Aces scoreboard; Standard and every scenario
 *  carry mission points instead. This is a data check, not a format branch. */
export function hasBountyScores(frame: Frame | null | undefined): boolean {
	return frame?.scores !== undefined;
}

/** One row per player. At the final frame the result is authoritative so the
 *  Game Over line shows the engine's final totals; during the game the frame's
 *  public scoreboard is. Aces reads `bounty`, Standard reads `points`. */
export function scoreboardRows(
	players: ReplayPlayer[],
	frame: Frame | null,
	result: ReplayResult | null | undefined,
	atEnd: boolean
): ScoreRow[] {
	const aces = hasBountyScores(frame);
	return players.map((player, index) => {
		const seat = player.seat ?? index + 1;
		const finalAces = atEnd ? result?.bounty?.[index] : undefined;
		const finalStandard = atEnd ? result?.points?.[index] : undefined;
		const score = aces
			? (finalAces ?? frame?.scores?.[index] ?? 0)
			: (finalStandard ?? player.points);
		return {
			index,
			seat,
			label: `P${seat}`,
			name: player.name,
			faction: player.faction,
			color: playerColor(player),
			score,
			unit: aces ? 'bounty' : 'MP'
		};
	});
}

/**
 * The badge for a dial a card revealed. The writer sends the engine's own
 * maneuver text (`2 bank left (white)`); this only prefixes it, never derives a
 * dial. Returns null when the frame has no reveal marker.
 */
export function dialRevealedLabel(state: { dial_revealed?: string }): string | null {
	return state.dial_revealed ? `DIAL ${state.dial_revealed}` : null;
}

export function winnerName(
	players: ReplayPlayer[],
	result: ReplayResult | null | undefined
): string {
	if (!result || result.winner === null) return 'No winner';
	const winner = players[result.winner];
	return winner ? `${seatLabel(winner, result.winner)} ${winner.name}` : `Player ${result.winner + 1}`;
}

/** The data the board prints next to a hyperspace marker. The size and facing
 *  are written by the engine (D-074); the viewer never derives a box. */
export function hyperspaceLabel(feature: ScenarioFeature): string {
	const size = feature.marker_size ?? '?';
	const facing = feature.facing ?? '?';
	return `HYPERSPACE ${size} · blank ${facing}`;
}
