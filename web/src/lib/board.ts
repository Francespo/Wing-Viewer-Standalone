/**
 * Board geometry.
 *
 * Engine convention (see `crates/we-core/src/geometry.rs`): millimetres, origin
 * bottom-left, +Y up, heading in degrees clockwise from +Y. SVG is +Y down, so
 * every point goes through `toSvg`.
 */
import type { Board, MarkerFacing, ShipState } from './replay';

export interface Pt {
	x: number;
	y: number;
}

export function toSvg(board: Board, x: number, y: number): Pt {
	return { x, y: board.height - y };
}

export function headingRad(headingDeg: number): number {
	return (headingDeg * Math.PI) / 180;
}

/** Forward unit vector in engine coordinates. */
export function forward(headingDeg: number): Pt {
	const r = headingRad(headingDeg);
	return { x: Math.sin(r), y: Math.cos(r) };
}

/** Right-hand unit vector in engine coordinates. */
export function right(headingDeg: number): Pt {
	const r = headingRad(headingDeg);
	return { x: Math.cos(r), y: -Math.sin(r) };
}

/** Four corners of a ship base, in SVG coordinates. */
export function baseCorners(ship: ShipState, baseWidth: number, baseLength?: number): Pt[] {
	const hw = baseWidth / 2;
	const hl = (baseLength ?? baseWidth) / 2;
	const f = forward(ship.heading);
	const rt = right(ship.heading);
	const c = (sf: number, sr: number): Pt => ({
		x: ship.x + f.x * hl * sf + rt.x * hw * sr,
		y: ship.y + f.y * hl * sf + rt.y * hw * sr
	});
	const corners = [c(1, 1), c(1, -1), c(-1, -1), c(-1, 1)];
	return corners.map((p) => ({ x: p.x, y: p.y }));
}

export function polyPoints(points: Pt[], board: Board): string {
	return points.map((p) => {
		const s = toSvg(board, p.x, p.y);
		return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
	}).join(' ');
}

/** Wedge from the base centre, `half` degrees either side of the forward axis. */
export function arcWedgePath(
	ship: ShipState,
	board: Board,
	radiusMm: number,
	halfDeg: number,
	centreDeg = 0
): string {
	const mid = ship.heading + centreDeg;
	const a0 = mid - halfDeg;
	const a1 = mid + halfDeg;
	const steps = Math.max(6, Math.round(halfDeg / 3));
	const pts: Pt[] = [{ x: ship.x, y: ship.y }];
	for (let i = 0; i <= steps; i++) {
		const a = a0 + ((a1 - a0) * i) / steps;
		const r = headingRad(a);
		pts.push({ x: ship.x + Math.sin(r) * radiusMm, y: ship.y + Math.cos(r) * radiusMm });
	}
	return (
		pts
			.map((p, i) => {
				const s = toSvg(board, p.x, p.y);
				return `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
			})
			.join(' ') + ' Z'
	);
}

/** Short arrow from `a` to `b`, used to draw the manoeuvre just executed. */
export function arrow(a: Pt, b: Pt, board: Board): { path: string; head: string } {
	const A = toSvg(board, a.x, a.y);
	const B = toSvg(board, b.x, b.y);
	const dx = B.x - A.x;
	const dy = B.y - A.y;
	const len = Math.hypot(dx, dy) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const size = 7;
	const left = { x: B.x - ux * size - uy * size * 0.55, y: B.y - uy * size + ux * size * 0.55 };
	const rightP = { x: B.x - ux * size + uy * size * 0.55, y: B.y - uy * size - ux * size * 0.55 };
	return {
		path: `M${A.x.toFixed(1)} ${A.y.toFixed(1)} L${B.x.toFixed(1)} ${B.y.toFixed(1)}`,
		head: `M${B.x.toFixed(1)} ${B.y.toFixed(1)} L${left.x.toFixed(1)} ${left.y.toFixed(1)} L${rightP.x.toFixed(1)} ${rightP.y.toFixed(1)} Z`
	};
}

/** Player-marker colours, keyed by the engine's `marker_color`. Presentation
 *  only: which player is red and which is blue is data from the replay (XWA
 *  Scenarios p.5 "DETERMINE PLAYER ORDER"), never derived here. */
export const MARKER_COLOR: Record<string, string> = {
	red: '#f87171',
	blue: '#60a5fa'
};

export const FACTION_COLOR: Record<string, string> = {
	rebel: '#ff3333',
	empire: '#2979ff',
	scum: '#006400',
	resistance: '#ff8c00',
	firstorder: '#800020',
	republic: '#e6d690',
	separatist: '#607d8b',
	unknown: '#666666'
};

/** Engine coordinates for the corner a hyperspace marker's blank half faces
 *  (D-074). Presentation only: the engine sent the corner, the viewer draws a
 *  pointer toward it and never derives a placement box or range. */
export const MARKER_FACING_VECTOR: Record<MarkerFacing, Pt> = {
	'bottom-left': { x: -1, y: -1 },
	'bottom-right': { x: 1, y: -1 },
	'top-right': { x: 1, y: 1 },
	'top-left': { x: -1, y: 1 }
};
