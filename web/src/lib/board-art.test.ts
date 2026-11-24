import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	OBSTACLE_FIT_MM,
	baseArtPath,
	obstacleDrawRect,
	shipBoardSprite,
	tokenIconPath
} from './board-art';
import type { Obstacle } from './replay';

const REPLAYS = new URL('../../static/replays/', import.meta.url);
const seed7 = JSON.parse(readFileSync(new URL('engine-seed7.json', REPLAYS), 'utf8'));

describe('shipBoardSprite resolves the real scanned ship', () => {
	it('prefers the fake3d TTS top render with its true mm render window', () => {
		const sprite = shipBoardSprite({ ship: 'T-65 X-Wing', name: 'Luke Skywalker' });
		expect(sprite).not.toBeNull();
		expect(sprite!.src).toMatch(/^\/models\/fake3d\/sprites\/[^/]+\/top_e000_y000\.png$/);
		// win_mm is the RENDER WINDOW carried by the manifest, never recomputed
		// from the base or fp_mm. t65xwing: fp 43.5 x 30.7 mm, window 50 mm.
		expect(sprite!.win_mm).toBe(50);
		expect(sprite!.fp_mm).toEqual([43.5, 30.7]);
	});

	it('returns null instead of fabricating a path for an unknown ship', () => {
		expect(shipBoardSprite({ ship: 'not-a-real-ship', name: 'Nobody' })).toBeNull();
		expect(shipBoardSprite({ ship: '', name: '' })).toBeNull();
	});
});

describe('baseArtPath maps to a real faction base PNG', () => {
	it('maps every engine faction to its extracted TTS slug', () => {
		const expected: Record<string, string> = {
			rebel: '/models/base-small-rebel.png',
			empire: '/models/base-small-empire.png',
			scum: '/models/base-small-scum.png',
			resistance: '/models/base-small-resistance.png',
			firstorder: '/models/base-small-first-order.png',
			republic: '/models/base-small-republic.png',
			separatist: '/models/base-small-separatists.png'
		};
		for (const [faction, path] of Object.entries(expected)) {
			expect(baseArtPath(40, faction)).toBe(path);
		}
	});

	it('uses the owner faction when present, as shipPlayer/shipColor do', () => {
		expect(baseArtPath(60, 'rebel', 'empire')).toBe('/models/base-medium-empire.png');
		expect(baseArtPath(80, 'empire', 'rebel')).toBe('/models/base-large-rebel.png');
	});

	it('never fabricates a base for an unknown faction or a huge base', () => {
		expect(baseArtPath(40, 'rebel', 'unknown')).toBe('/models/base-small-rebel.png');
		expect(baseArtPath(40, 'unknown')).toBeNull();
		expect(baseArtPath(40)).toBeNull();
		expect(baseArtPath(40, 'not-a-faction')).toBeNull();
		expect(baseArtPath(80, 'rebel', null, 160)).toBeNull(); // huge: no PNG
		expect(baseArtPath(0, 'rebel')).toBeNull();
		expect(baseArtPath(Number.NaN, 'rebel')).toBeNull();
	});
});

describe('tokenIconPath maps to a real token PNG', () => {
	it('resolves every engine token kind to its icon file', () => {
		expect(tokenIconPath('focus')).toBe('/models/icon-focus.png');
		expect(tokenIconPath('reinforce-aft')).toBe('/models/icon-reinforce-aft.png');
		expect(tokenIconPath('cloak')).toBe('/models/icon-cloak.png');
		expect(tokenIconPath('stress')).toBe('/models/icon-stress.png');
	});

	it('returns null for an unknown or missing token kind', () => {
		expect(tokenIconPath('not-a-token')).toBeNull();
		expect(tokenIconPath('')).toBeNull();
		expect(tokenIconPath(null)).toBeNull();
		expect(tokenIconPath(undefined)).toBeNull();
	});
});

describe('obstacleDrawRect derives the sprite size from the engine silhouette', () => {
	it('uses the outline bounding box in real mm, centred on the obstacle', () => {
		// Centimetres are centimillimetres in the replay contract; the outline
		// silhouette is normalised to OBSTACLE_FIT_MM = 40 mm.
		const o: Obstacle = {
			x: 100,
			y: 200,
			radius: 9,
			kind: 'asteroid',
			outline: [
				[-751, -832],
				[899, -832],
				[899, 813],
				[-751, 813]
			]
		};
		const sprite = { key: 'Core1', src: '/assets/obstacles/sprites/asteroid/Core1/top.png', bbox_mm: [38.3, 0.6, 47.4] };
		const rect = obstacleDrawRect(o, sprite);
		expect(rect).toEqual({ x: 100, y: 200, w: 16.5, h: 16.45 });
		// The old 2*radius square (18 x 18 mm) overshot this by ~9% on both axes.
		expect(2 * o.radius).toBeGreaterThan(rect!.w);
	});

	it('takes the size from a real replay obstacle, not from radius or bbox_mm', () => {
		const o = seed7.board.obstacles[0] as Obstacle;
		const rect = obstacleDrawRect(o, { key: 'whatever', src: 'x', bbox_mm: [1, 1, 1] })!;
		const xs = o.outline!.map((p) => p[0]);
		const ys = o.outline!.map((p) => p[1]);
		expect(rect.w).toBeCloseTo((Math.max(...xs) - Math.min(...xs)) / 100, 6);
		expect(rect.h).toBeCloseTo((Math.max(...ys) - Math.min(...ys)) / 100, 6);
		expect(rect.x).toBe(o.x);
		expect(rect.y).toBe(o.y);
		expect(OBSTACLE_FIT_MM).toBe(40);
	});

	it('returns null instead of inventing a rect when there is no clip polygon', () => {
		const base = { x: 0, y: 0, radius: 20, kind: 'asteroid' } as Obstacle;
		expect(obstacleDrawRect(base, null)).toBeNull();
		expect(obstacleDrawRect({ ...base, outline: [] }, {})).toBeNull();
		expect(
			obstacleDrawRect({ ...base, outline: [[0, 0], [1, 1]] }, {})
		).toBeNull(); // fewer than 3 points
		expect(
			obstacleDrawRect({ ...base, outline: [[0, 0], [0, 0], [0, 0]] }, {})
		).toBeNull(); // degenerate
	});
});
