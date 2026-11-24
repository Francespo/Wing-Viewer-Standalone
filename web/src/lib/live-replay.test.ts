import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateReplay } from './replay';

/**
 * Cross-language contract check for a replay downloaded from `we-serve`.
 *
 * `cargo test -p we-serve --test live` writes the actual `/replay` response
 * when `M1_REPLAY_OUT` is set. Run:
 *
 *   M1_REPLAY_OUT=/tmp/opencode/m1-live.json cargo test -p we-serve --test live
 *   M1_REPLAY=/tmp/opencode/m1-live.json npm run test
 *
 * Without the environment variable the test is skipped; the ordinary suite
 * still validates the committed seed-7 fixture.
 */
const liveReplayPath = process.env.M1_REPLAY;

describe.skipIf(!liveReplayPath)('a replay downloaded from the live server', () => {
	it('passes the existing viewer validator', () => {
		const replay = validateReplay(JSON.parse(readFileSync(liveReplayPath!, 'utf8')));
		expect(replay.meta.seed).toBe(7);
		expect(replay.frames.length).toBeGreaterThan(0);
		expect(replay.meta.result?.winner === null || typeof replay.meta.result?.winner === 'number').toBe(
			true
		);
	});
});
