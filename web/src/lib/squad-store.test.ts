import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_SETTINGS,
	SQUAD_STORE_KEYS,
	addHistory,
	clearHistory,
	deleteSquad,
	getReadMessages,
	getSquad,
	getSettings,
	listHistory,
	listSquads,
	markMessagesRead,
	saveSquad,
	saveSettings,
	toggleStar
} from './squad-store';

/** Minimal in-memory localStorage; Vitest runs in node, with no DOM. */
class MemoryStorage implements Storage {
	private data = new Map<string, string>();
	get length() {
		return this.data.size;
	}
	clear() {
		this.data.clear();
	}
	getItem(key: string) {
		return this.data.has(key) ? (this.data.get(key) as string) : null;
	}
	key(index: number) {
		return [...this.data.keys()][index] ?? null;
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	setItem(key: string, value: string) {
		this.data.set(key, String(value));
	}
}

const FIRST_XWS = JSON.stringify({
	faction: 'galacticrepublic',
	name: 'First',
	pilots: [
		{ id: 'a', name: 'a', points: 10, ship: 'arc170starfighter' },
		{ id: 'a', name: 'a', points: 10, ship: 'arc170starfighter' },
		{ id: 'b', name: 'b', points: 7, ship: 'clonez95headhunter' },
		{ id: 'c', name: 'c', points: 10, ship: 'delta7aethersprite' },
		{ id: 'd', name: 'd', points: 13, ship: 'delta7baethersprite' }
	],
	points: 50
});

let store: MemoryStorage;

beforeEach(() => {
	store = new MemoryStorage();
	vi.stubGlobal('window', { localStorage: store });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('squad library persistence', () => {
	it('saves a squad, lists it, and reads it back by id', () => {
		expect(listSquads()).toEqual([]);
		const squad = saveSquad(FIRST_XWS);
		expect(squad.id).toBeTruthy();
		expect(squad.name).toBe('First');
		expect(squad.preview.ships).toBe(5);
		expect(squad.preview.points).toBe(50);
		expect(squad.starred).toBe(false);
		expect(new Date(squad.createdAt).toString()).not.toBe('Invalid Date');
		expect(listSquads()).toHaveLength(1);
		expect(getSquad(squad.id)).toEqual(squad);
		expect(store.getItem(SQUAD_STORE_KEYS.squads)).toContain(squad.id);
	});

	// Mutation-style: this round-trip would not compile before the store existed.
	it('round-trips a saved squad through a star toggle', () => {
		const squad = saveSquad(FIRST_XWS, 'Starred pick');
		expect(saveSquad(FIRST_XWS).id).not.toBe(squad.id);
		expect(getSquad(squad.id)?.starred).toBe(false);

		expect(toggleStar(squad.id)?.starred).toBe(true);
		const reloaded = getSquad(squad.id);
		expect(reloaded?.starred).toBe(true);
		expect(reloaded?.name).toBe('Starred pick');
		expect(reloaded?.raw).toBe(FIRST_XWS);
		expect(reloaded?.preview.ships).toBe(5);

		expect(toggleStar(squad.id)?.starred).toBe(false);
		expect(getSquad(squad.id)?.starred).toBe(false);
		expect(toggleStar('missing-id')).toBeNull();
	});

	it('deletes only the requested squad', () => {
		const a = saveSquad(FIRST_XWS, 'A');
		const b = saveSquad(FIRST_XWS, 'B');
		deleteSquad(a.id);
		expect(listSquads().map((squad) => squad.id)).toEqual([b.id]);
	});

	it('ignores corrupt stored JSON instead of throwing', () => {
		store.setItem(SQUAD_STORE_KEYS.squads, '{oops');
		store.setItem(SQUAD_STORE_KEYS.settings, 'null');
		store.setItem(SQUAD_STORE_KEYS.messages, '{"not":"an array"}');
		store.setItem(SQUAD_STORE_KEYS.history, '42');
		expect(listSquads()).toEqual([]);
		expect(getSettings()).toEqual(DEFAULT_SETTINGS);
		expect(getReadMessages()).toEqual([]);
		expect(listHistory()).toEqual([]);
	});

	it('is SSR-safe when window is absent', () => {
		vi.stubGlobal('window', undefined);
		expect(listSquads()).toEqual([]);
		expect(() => saveSquad(FIRST_XWS)).not.toThrow();
		expect(getSettings()).toEqual(DEFAULT_SETTINGS);
		expect(markMessagesRead(['m1'])).toEqual(['m1']);
	});
});

describe('squad load history', () => {
	it('records newest loads first and can be cleared', () => {
		const a = saveSquad(FIRST_XWS, 'A');
		const b = saveSquad(FIRST_XWS, 'B');
		expect(listHistory()).toEqual([]);
		addHistory(a);
		addHistory(b);
		const history = listHistory();
		expect(history).toHaveLength(2);
		expect(history[0].squadId).toBe(b.id);
		expect(history[1].squadId).toBe(a.id);
		clearHistory();
		expect(listHistory()).toEqual([]);
	});
});

describe('settings and read messages', () => {
	it('merges settings patches over defaults', () => {
		expect(getSettings()).toEqual({ lastSide: 1, autoFillPreset: true });
		expect(saveSettings({ lastSide: 2 })).toEqual({ lastSide: 2, autoFillPreset: true });
		expect(getSettings().lastSide).toBe(2);
		expect(saveSettings({ autoFillPreset: false })).toEqual({ lastSide: 2, autoFillPreset: false });
	});

	it('preserves preferences written by other viewer panels', () => {
		store.setItem(
			SQUAD_STORE_KEYS.settings,
			JSON.stringify({ skipAllOptional: true, lastSide: 2 })
		);
		expect(getSettings()).toMatchObject({ skipAllOptional: true, lastSide: 2 });
		expect(saveSettings({ autoFillPreset: false })).toMatchObject({ skipAllOptional: true });
	});

	it('normalizes hostile stored settings', () => {
		store.setItem(
			SQUAD_STORE_KEYS.settings,
			JSON.stringify({ lastSide: 9, autoFillPreset: 'yes' })
		);
		expect(getSettings()).toEqual(DEFAULT_SETTINGS);
	});

	it('marks messages read without duplicates', () => {
		expect(getReadMessages()).toEqual([]);
		expect(markMessagesRead(['m1', 'm2'])).toEqual(['m1', 'm2']);
		expect(markMessagesRead(['m2', 'm3'])).toEqual(['m1', 'm2', 'm3']);
		expect(getReadMessages()).toEqual(['m1', 'm2', 'm3']);
	});
});
