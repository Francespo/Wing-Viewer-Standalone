import { describe, expect, it } from 'vitest';
import {
	describeImportStatus,
	formatSquadCount,
	formatXwsPreview,
	parseXwsPreview
} from './xws-preview';

const FIRST_XWS = JSON.stringify({
	description: '',
	faction: 'galacticrepublic',
	name: 'First',
	pilots: [
		{ id: 'a', name: 'a', points: 10, ship: 'arc170starfighter' },
		{ id: 'a', name: 'a', points: 10, ship: 'arc170starfighter' },
		{ id: 'b', name: 'b', points: 7, ship: 'clonez95headhunter' },
		{ id: 'c', name: 'c', points: 10, ship: 'delta7aethersprite' },
		{ id: 'd', name: 'd', points: 13, ship: 'delta7baethersprite' }
	],
	points: 50,
	obstacles: ['coreasteroid0', 'yt2400debris0', 'gascloud2']
});

describe('XWS import preview (rendering only)', () => {
	it('summarises a pasted squad the way 4GG does before import', () => {
		const parsed = parseXwsPreview(FIRST_XWS);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(formatXwsPreview(parsed.squad)).toBe('First · Galactic Republic · 5 ships · 50/50');
		expect(parsed.squad.obstacles).toBe(3);
	});

	it('formats the compact ship/point count used by the squad library', () => {
		const parsed = parseXwsPreview(FIRST_XWS);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(formatSquadCount(parsed.squad)).toBe('5 ships · 50 pts');
		expect(formatSquadCount({ ...parsed.squad, points: null })).toBe('5 ships · ? pts');
	});

	it('falls back to summed pilot points when points is absent', () => {
		const parsed = parseXwsPreview(
			JSON.stringify({ faction: 'empire', pilots: [{ points: 10 }, { points: 8 }] })
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.squad.name).toBe('Unnamed squad');
		expect(parsed.squad.faction).toBe('Galactic Empire');
		expect(parsed.squad.points).toBe(18);
		expect(parsed.squad.obstacles).toBe(0);
		expect(formatXwsPreview(parsed.squad)).toBe('Unnamed squad · Galactic Empire · 2 ships · 18/50');
	});

	it('reports why an empty or malformed paste cannot be previewed', () => {
		expect(parseXwsPreview('   ')).toEqual({ ok: false, reason: 'empty' });
		expect(parseXwsPreview('{oops')).toEqual({ ok: false, reason: 'not valid JSON' });
		expect(parseXwsPreview('[]')).toEqual({ ok: false, reason: 'not an XWS object' });
		expect(parseXwsPreview('{"name":"x"}')).toEqual({ ok: false, reason: 'missing pilots array' });
	});

	it('does not claim legality: extra pilots are still just counted', () => {
		const parsed = parseXwsPreview(
			JSON.stringify({ faction: 'rebelalliance', pilots: new Array(9).fill({ points: 10 }), points: 90 })
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.squad.ships).toBe(9);
		expect(parsed.squad.points).toBe(90);
	});
});

describe('import prerequisites are explained, not silent', () => {
	it('accepts both empty boxes as predefined squads', () => {
		expect(describeImportStatus('', '   ')).toEqual({
			ready: true,
			message: 'status: predefined squads — paste both exports to play with YASB lists'
		});
	});

	it('explains a partial paste instead of trying to parse an empty string', () => {
		const status = describeImportStatus(FIRST_XWS, '');
		expect(status.ready).toBe(false);
		expect(status.message).toContain('squad 2 not ready');
		expect(status.message).toContain('predefined squad');
	});

	it('names the invalid side when both boxes are filled', () => {
		const status = describeImportStatus(FIRST_XWS, '{oops');
		expect(status.ready).toBe(false);
		expect(status.message).toContain('squad 2 not ready (not valid JSON)');
	});

	it('marks two valid pastes as ready', () => {
		expect(describeImportStatus(FIRST_XWS, FIRST_XWS).ready).toBe(true);
	});
});
