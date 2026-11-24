/**
 * Board asset resolution — viewer-only, no rules.
 *
 * Every function here maps data the replay contract already carries (a ship,
 * obstacle or token record) to a REAL file shipped under `/models` or
 * `/assets/obstacles`, or returns `null` so the caller keeps its polygon /
 * colour fallback. Nothing is fabricated here: a missing or unknown asset is
 * always reported as `null`, never as a guessed path.
 *
 * Scale note (T1/T3/T4): `win_mm` on a ship sprite is a RENDER WINDOW
 * (`ceil(max(fp_mm) * 1.15)`, 32 mm floor), not the physical footprint. The
 * board draws the image at `win_mm` svg units 1:1 — it is never scaled to the
 * engine base. `fp_mm` is carried through for the inspector/footprint overlay
 * only. Obstacles are drawn from the engine silhouette's real-mm bounding box
 * (the silhouette is normalised to `fit_mm` = 40 mm by
 * `web/scripts/fake3d/build_obstacle_plan.py:79`), so the scan texture fills
 * its own clip polygon instead of a `2 * radius` square.
 */
import type { Obstacle, ReplayShip } from './replay';
import { baseSizeName, shipSprite } from './ship-sprites';

export interface BoardSprite {
	src: string;
	/** Render window in mm: draw the image at exactly this svg size, 1:1. */
	win_mm: number;
	/** Physical footprint in mm, for validation / overlay only. */
	fp_mm?: [number, number];
}

/** The real top-down TTS/Fly-Casual scan for this ship def, or null. */
export function shipBoardSprite(def: Pick<ReplayShip, 'ship' | 'name'>): BoardSprite | null {
	if (!def || typeof def.ship !== 'string' || def.ship.length === 0) return null;
	return shipSprite(def.ship, def.name, def.ship);
}

/** Replay faction -> the faction slug used by the real base PNGs. The engine
 *  spells `firstorder` / `separatist`; the extracted TTS files use
 *  `first-order` / `separatists`. */
const FACTION_BASE_SLUG: Record<string, string> = {
	rebel: 'rebel',
	empire: 'empire',
	scum: 'scum',
	resistance: 'resistance',
	firstorder: 'first-order',
	republic: 'republic',
	separatist: 'separatists'
};

/** Only the plain faction bases are used (84 extracted files cover the
 *  variants too); this is the exact set of files we may reference. */
const KNOWN_BASES = new Set<string>(
	(['small', 'medium', 'large'] as const).flatMap((size) =>
		Object.values(FACTION_BASE_SLUG).map((slug) => `${size}-${slug}`)
	)
);

/**
 * Real faction base PNG for a ship, or null.
 *
 * `baseMm` is the printed base side (40/60/80) and `lengthMm` the optional
 * rectangular length. A huge ship (length > 80 mm) has no extracted base PNG,
 * so it returns null and the caller's polygon stays authoritative.
 *
 * `ownerFaction` takes precedence over `faction`, mirroring `shipColor` /
 * `shipPlayer` in `view.ts`: an Aces ship keeps its seat identity while the
 * scanned base still uses the faction the writer sent for that player.
 */
export function baseArtPath(
	baseMm: number,
	faction?: string | null,
	ownerFaction?: string | null,
	lengthMm: number = baseMm
): string | null {
	if (!Number.isFinite(baseMm) || !Number.isFinite(lengthMm)) return null;
	if (baseMm <= 0 || lengthMm <= 0 || lengthMm > 80) return null;
	// An owner record with an unmapped faction falls back to the chassis
	// faction instead of inventing a path.
	const slug = FACTION_BASE_SLUG[ownerFaction ?? ''] ?? FACTION_BASE_SLUG[faction ?? ''];
	if (!slug) return null;
	const key = `${baseSizeName(baseMm)}-${slug}`;
	return KNOWN_BASES.has(key) ? `/models/base-${key}.png` : null;
}

/** Token kinds with a real `/models/icon-<kind>.png` (all 15 engine kinds). */
const KNOWN_TOKEN_ICONS = new Set<string>([
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
]);

/** Real token icon path, or null for an unknown kind / missing asset. */
export function tokenIconPath(kind: string | null | undefined): string | null {
	if (!kind || !KNOWN_TOKEN_ICONS.has(kind)) return null;
	return `/models/icon-${kind}.png`;
}

/** The engine silhouette is normalised to this diameter (40 mm = radius 20).
 *  See `web/scripts/fake3d/build_obstacle_plan.py:79`. It is the authority for
 *  obstacle scale; the raw sprite `bbox_mm` is NOT used as a draw size. */
export const OBSTACLE_FIT_MM = 40;

export interface ObstacleDrawRect {
	/** Obstacle centre in engine mm (the caller flips Y into SVG space). */
	x: number;
	y: number;
	/** True silhouette width / height in mm, from the outline bbox. */
	w: number;
	h: number;
}

/**
 * Sprite draw rect for an obstacle, derived from the engine outline.
 *
 * The outline points are centimillimetres relative to the obstacle centre, and
 * their largest extent is the silhouette's `fit_mm` (40 mm) normalisation.
 * Its bounding box in real mm is therefore the exact clip polygon extent: the
 * sprite drawn into this rect fills its own clip at 1:1 and the mesh content
 * coincides with the engine silhouette. The previous `2 * radius` square
 * overshot that box by 1-16% (e.g. a small asteroid: 18.0 mm square vs a
 * 16.50 x 16.45 mm silhouette).
 *
 * Returns null when there is no usable outline (pre-silhouette replays keep
 * the circular fallback) or no sprite, so nothing is ever fabricated.
 */
export function obstacleDrawRect(
	o: Pick<Obstacle, 'x' | 'y' | 'outline' | 'radius'>,
	sprite: unknown
): ObstacleDrawRect | null {
	if (!sprite || !o || !Array.isArray(o.outline) || o.outline.length < 3) return null;
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const point of o.outline) {
		if (!Array.isArray(point) || point.length < 2) return null;
		const [px, py] = point;
		if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
		if (px < minX) minX = px;
		if (px > maxX) maxX = px;
		if (py < minY) minY = py;
		if (py > maxY) maxY = py;
	}
	// centimillimetres -> millimetres.
	const w = (maxX - minX) / 100;
	const h = (maxY - minY) / 100;
	if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
	return { x: o.x, y: o.y, w, h };
}
