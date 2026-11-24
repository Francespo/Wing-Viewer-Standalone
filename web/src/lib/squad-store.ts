/**
 * Browser-only persistence for the viewer's squad library.
 *
 * Storage is deliberately dumb: it keeps the raw XWS string and the rendering
 * metadata produced by `parseXwsPreview`. It never evaluates legality, range,
 * damage or any other game rule — the engine answers those when a game starts.
 *
 * Every read and write is defensive and SSR-safe: `window` may not exist
 * (prerender), localStorage may be disabled (private mode), and an old or
 * corrupted value must never break the page.
 */

import { parseXwsPreview, type XwsPreview } from './xws-preview';

export const SQUAD_STORE_KEYS = {
	squads: 'wing-engine.squads.v1',
	history: 'wing-engine.history.v1',
	settings: 'wing-engine.settings.v1',
	messages: 'wing-engine.messages.v1'
} as const;

export type SquadRecord = {
	id: string;
	name: string;
	raw: string;
	preview: XwsPreview;
	starred: boolean;
	createdAt: string;
};

export type HistoryEntry = {
	id: string;
	squadId: string;
	name: string;
	at: string;
};

export type SquadSettings = {
	lastSide: 1 | 2;
	autoFillPreset: boolean;
	// Other viewer panels keep their own preferences in this same v1 record;
	// normalizing must preserve them instead of dropping them on a write.
	[key: string]: unknown;
};

export const DEFAULT_SETTINGS: SquadSettings = { lastSide: 1, autoFillPreset: true };

const HISTORY_LIMIT = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function storage(): Storage | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage ?? null;
	} catch {
		return null;
	}
}

/** The single guarded read path used by every stored collection. */
function read<T>(key: string, fallback: T, normalize: (value: unknown) => T | null): T {
	const store = storage();
	if (!store) return fallback;
	try {
		const text = store.getItem(key);
		if (text === null) return fallback;
		return normalize(JSON.parse(text)) ?? fallback;
	} catch {
		return fallback;
	}
}

/** The single guarded write path used by every stored collection. */
function write(key: string, value: unknown): void {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(key, JSON.stringify(value));
	} catch {
		// Quota or disabled storage: the viewer still works, just not durably.
	}
}

function makeId(): string {
	const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
	if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
	return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function previewFor(raw: string): XwsPreview {
	const parsed = parseXwsPreview(raw);
	if (parsed.ok) return parsed.squad;
	return { name: 'Unnamed squad', faction: 'Unknown faction', ships: 0, points: null, obstacles: 0 };
}

function normalizePreview(value: unknown, raw: string): XwsPreview {
	if (!isRecord(value)) return previewFor(raw);
	const base = previewFor(raw);
	return {
		name: typeof value.name === 'string' && value.name.trim() ? value.name : base.name,
		faction: typeof value.faction === 'string' && value.faction.trim() ? value.faction : base.faction,
		ships: typeof value.ships === 'number' && Number.isFinite(value.ships) ? value.ships : base.ships,
		points: typeof value.points === 'number' && Number.isFinite(value.points) ? value.points : base.points,
		obstacles:
			typeof value.obstacles === 'number' && Number.isFinite(value.obstacles)
				? value.obstacles
				: base.obstacles
	};
}

function normalizeSquad(value: unknown): SquadRecord | null {
	if (!isRecord(value)) return null;
	if (typeof value.id !== 'string' || !value.id) return null;
	if (typeof value.raw !== 'string') return null;
	const name =
		typeof value.name === 'string' && value.name.trim() ? value.name : previewFor(value.raw).name;
	return {
		id: value.id,
		name,
		raw: value.raw,
		preview: normalizePreview(value.preview, value.raw),
		starred: value.starred === true,
		createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date(0).toISOString()
	};
}

function normalizeSquads(value: unknown): SquadRecord[] | null {
	if (!Array.isArray(value)) return null;
	const seen = new Set<string>();
	const squads: SquadRecord[] = [];
	for (const item of value) {
		const squad = normalizeSquad(item);
		if (!squad || seen.has(squad.id)) continue;
		seen.add(squad.id);
		squads.push(squad);
	}
	return squads;
}

function normalizeHistory(value: unknown): HistoryEntry[] | null {
	if (!Array.isArray(value)) return null;
	const entries: HistoryEntry[] = [];
	for (const item of value) {
		if (!isRecord(item)) continue;
		if (typeof item.id !== 'string' || typeof item.squadId !== 'string') continue;
		entries.push({
			id: item.id,
			squadId: item.squadId,
			name: typeof item.name === 'string' ? item.name : 'Unnamed squad',
			at: typeof item.at === 'string' ? item.at : new Date(0).toISOString()
		});
	}
	return entries;
}

function normalizeSettings(value: unknown): SquadSettings | null {
	if (!isRecord(value)) return null;
	return {
		...value,
		lastSide: value.lastSide === 2 ? 2 : 1,
		autoFillPreset:
			typeof value.autoFillPreset === 'boolean'
				? value.autoFillPreset
				: DEFAULT_SETTINGS.autoFillPreset
	};
}

function normalizeMessages(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}

// Squads ----------------------------------------------------------------------

export function listSquads(): SquadRecord[] {
	return read(SQUAD_STORE_KEYS.squads, [], normalizeSquads);
}

export function getSquad(id: string): SquadRecord | null {
	return listSquads().find((squad) => squad.id === id) ?? null;
}

/** Store a raw XWS paste with its rendering preview. No legality is checked. */
export function saveSquad(raw: string, name?: string): SquadRecord {
	const preview = previewFor(raw);
	const squad: SquadRecord = {
		id: makeId(),
		name: name?.trim() || preview.name,
		raw,
		preview,
		starred: false,
		createdAt: new Date().toISOString()
	};
	write(SQUAD_STORE_KEYS.squads, [squad, ...listSquads()]);
	return squad;
}

export function deleteSquad(id: string): void {
	write(
		SQUAD_STORE_KEYS.squads,
		listSquads().filter((squad) => squad.id !== id)
	);
}

export function toggleStar(id: string): SquadRecord | null {
	const squads = listSquads();
	const index = squads.findIndex((squad) => squad.id === id);
	if (index < 0) return null;
	const updated: SquadRecord = { ...squads[index], starred: !squads[index].starred };
	const next = [...squads];
	next[index] = updated;
	write(SQUAD_STORE_KEYS.squads, next);
	return updated;
}

// History ---------------------------------------------------------------------

export function listHistory(): HistoryEntry[] {
	return read(SQUAD_STORE_KEYS.history, [], normalizeHistory);
}

export function addHistory(squad: SquadRecord): HistoryEntry[] {
	const entry: HistoryEntry = {
		id: makeId(),
		squadId: squad.id,
		name: squad.name,
		at: new Date().toISOString()
	};
	const next = [entry, ...listHistory()].slice(0, HISTORY_LIMIT);
	write(SQUAD_STORE_KEYS.history, next);
	return next;
}

export function clearHistory(): void {
	write(SQUAD_STORE_KEYS.history, []);
}

// Settings --------------------------------------------------------------------

export function getSettings(): SquadSettings {
	return read(SQUAD_STORE_KEYS.settings, DEFAULT_SETTINGS, normalizeSettings);
}

export function saveSettings(patch: Partial<SquadSettings>): SquadSettings {
	const next: SquadSettings = { ...getSettings(), ...patch };
	next.lastSide = next.lastSide === 2 ? 2 : 1;
	if (typeof next.autoFillPreset !== 'boolean') next.autoFillPreset = DEFAULT_SETTINGS.autoFillPreset;
	write(SQUAD_STORE_KEYS.settings, next);
	return next;
}

// Read messages ---------------------------------------------------------------

export function getReadMessages(): string[] {
	return read(SQUAD_STORE_KEYS.messages, [], normalizeMessages);
}

export function markMessagesRead(ids: string[]): string[] {
	const next = [...new Set([...getReadMessages(), ...ids.filter((id) => typeof id === 'string')])];
	write(SQUAD_STORE_KEYS.messages, next);
	return next;
}
