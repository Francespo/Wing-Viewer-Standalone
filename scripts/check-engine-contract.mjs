// Verifies the viewer is pinned to the exact engine whose schemas/routes it
// calls. The replay fixtures are the executable contract: if the engine that
// produced them changes, the hash changes and this fails. No network, no Rust.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lock = JSON.parse(readFileSync(new URL('../engine.lock.json', import.meta.url), 'utf8'));
const web = new URL('../web/src/lib/', import.meta.url);
const live = readFileSync(new URL('live.ts', web), 'utf8');
const replay = readFileSync(new URL('replay.ts', web), 'utf8');

let failures = 0;
function check(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failures++; }
}

// Schemas in the TS client must match the pinned engine schemas.
for (const schema of [lock.schemas.live, lock.schemas.replay]) {
  check(live.includes(schema) || replay.includes(schema), `schema ${schema} not found in viewer client`);
}

// Every fixture must be byte-identical to the hash the pinned engine produced.
for (const [name, expected] of Object.entries(lock.replay_fixtures)) {
  const buf = readFileSync(new URL(`../web/static/replays/${name}`, import.meta.url));
  const got = createHash('sha256').update(buf).digest('hex');
  check(got === expected, `${name}: ${got} != ${expected}`);
}

// Fail loudly if the question-kind union drifted from the documented 21.
const kinds = (live.match(/^export const QUESTION_KINDS = \[([\s\S]*?)\] as const/m) || [])[1] || '';
const count = (kinds.match(/'/g) || []).length / 2;
check(count === 21, `QUESTION_KINDS has ${count} entries, expected 21 (pinned engine contract)`);

if (failures) { console.error(`engine contract: ${failures} failure(s)`); process.exit(1); }
console.log(`engine contract OK: ${lock.engine.commit.slice(0, 8)}, ${Object.keys(lock.replay_fixtures).length} fixtures, ${count} question kinds`);
