/**
 * Rendering-only summary of a pasted XWS squad, matching the 4GG import
 * preview ("First · Galactic Republic · 5 ships · 50/50").
 *
 * This module never decides whether a squad is legal: the server answers that
 * when `new game` is pressed. It only describes JSON the browser already has.
 */

export type XwsPreview = {
	name: string;
	faction: string;
	ships: number;
	points: number | null;
	obstacles: number;
};

export type XwsParse =
	| { ok: true; squad: XwsPreview }
	| { ok: false; reason: string };

const FACTIONS: Record<string, string> = {
	rebelalliance: 'Rebel Alliance',
	rebel: 'Rebel Alliance',
	empire: 'Galactic Empire',
	galacticempire: 'Galactic Empire',
	scumandvillainy: 'Scum and Villainy',
	scum: 'Scum and Villainy',
	resistance: 'Resistance',
	firstorder: 'First Order',
	separatistalliance: 'Separatist Alliance',
	separatists: 'Separatist Alliance',
	galacticrepublic: 'Galactic Republic',
	republic: 'Galactic Republic'
};

function factionName(value: unknown): string {
	if (typeof value !== 'string' || !value.trim()) return 'Unknown faction';
	const key = value.toLowerCase().replace(/[^a-z]/g, '');
	return FACTIONS[key] ?? value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Describe a pasted XWS string, or say why it cannot be described yet. */
export function parseXwsPreview(text: string): XwsParse {
	if (!text.trim()) return { ok: false, reason: 'empty' };
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, reason: 'not valid JSON' };
	}
	if (!isRecord(data)) return { ok: false, reason: 'not an XWS object' };
	if (!Array.isArray(data.pilots)) return { ok: false, reason: 'missing pilots array' };

	const pilots = data.pilots;
	const name = typeof data.name === 'string' && data.name.trim() ? data.name : 'Unnamed squad';
	const declaredPoints = typeof data.points === 'number' && Number.isFinite(data.points) ? data.points : null;
	const sum = pilots.reduce((total, pilot) => {
		return isRecord(pilot) && typeof pilot.points === 'number' && Number.isFinite(pilot.points)
			? total + pilot.points
			: total;
	}, 0);
	const points = declaredPoints ?? (sum > 0 ? sum : null);
	const obstacles = Array.isArray(data.obstacles) ? data.obstacles.length : 0;

	return {
		ok: true,
		squad: { name, faction: factionName(data.faction), ships: pilots.length, points, obstacles }
	};
}

/** One-line preview, e.g. "First · Galactic Republic · 5 ships · 50/50". */
export function formatXwsPreview(squad: XwsPreview): string {
	const points = squad.points === null ? '' : ` · ${squad.points}/50`;
	return `${squad.name} · ${squad.faction} · ${squad.ships} ships${points}`;
}

/** Compact count used in the squad library rows, e.g. "5 ships · 50 pts". */
export function formatSquadCount(squad: XwsPreview): string {
	return `${squad.ships} ships · ${squad.points === null ? '?' : squad.points} pts`;
}

export type ImportStatus = { ready: boolean; message: string };

/**
 * Explain the import prerequisites instead of failing silently on a partial
 * paste. An empty box means "use the predefined squad" for that side.
 */
export function describeImportStatus(text1: string, text2: string): ImportStatus {
	const a = parseXwsPreview(text1);
	const b = parseXwsPreview(text2);
	if (!a.ok && !b.ok) {
		if (text1.trim() || text2.trim()) {
			const reasons = [!a.ok && text1.trim() ? `squad 1 ${a.reason}` : '', !b.ok && text2.trim() ? `squad 2 ${b.reason}` : ''].filter(Boolean);
			return { ready: false, message: `status: XWS not ready — ${reasons.join('; ')}` };
		}
		return { ready: true, message: 'status: predefined squads — paste both exports to play with YASB lists' };
	}
	if (!a.ok || !b.ok) {
		const bad = a.ok ? b : a;
		const side = a.ok ? 2 : 1;
		return {
			ready: false,
			message: `status: squad ${side} not ready (${bad.ok ? '' : bad.reason}) — the other side will use its predefined squad`
		};
	}
	return { ready: true, message: 'status: XWS squads ready — pressing new game will play with them' };
}
