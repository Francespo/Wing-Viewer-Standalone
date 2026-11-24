import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import {
	LIVE_SCHEMA,
	QUESTION_KINDS,
	validateGameResponse,
	type GameHeader,
	type GameResponse,
	type Question,
	type QuestionKind,
} from '$lib/live';
import type { Frame, ReplayShip } from '$lib/replay';
import PromptPanel from './PromptPanel.svelte';

const ships: ReplayShip[] = [
	{
		id: 1,
		name: 'Gold Squadron Veteran',
		ship: 'BTL-A4 Y-wing',
		faction: 'rebel',
		base: 40,
		initiative: 2,
		hull: 6,
		shields: 2,
		agility: 1,
		arc: 'front',
	},
	{
		id: 2,
		name: 'Obsidian Squadron Pilot',
		ship: 'TIE/ln Fighter',
		faction: 'empire',
		base: 40,
		initiative: 2,
		hull: 3,
		shields: 0,
		agility: 3,
		arc: 'front',
	},
];

const header: GameHeader = {
	schema: LIVE_SCHEMA,
	engine: 'wing-engine test',
	seed: 7,
	human: 0,
	format: 'standard-50p',
	players: [
		{ name: 'Rebels', faction: 'rebel', points: 50 },
		{ name: 'Empire', faction: 'empire', points: 46 },
	],
	ships,
	board: { width: 914, height: 914, obstacles: [] },
};

function shipState(id: number) {
	return {
		id,
		x: id === 1 ? 360 : 540,
		y: 60,
		heading: 0,
		hull: ships[id - 1].hull,
		shields: ships[id - 1].shields,
		tokens: {},
		lock: null,
		alive: true,
		damage: 0,
	};
}

function frame(withEvent = false): Frame {
	return {
		n: 0,
		round: 1,
		phase: 'planning',
		active: null,
		ships: ships.map((ship) => shipState(ship.id)),
		events: withEvent ? [{ tone: 'system', text: 'Round 1 begins.' }] : [],
	};
}

function option(
	id: string,
	label: string,
	extra: Record<string, unknown> = {},
) {
	return { id, label, ...extra };
}

function question(kind: QuestionKind): Question {
	const common = {
		id: 1,
		player: 0,
		ship: 1,
		kind,
		prompt: `${kind} prompt`,
		options: [] as { id: string; label: string }[],
		frame: frame(),
	};
	switch (kind) {
		case 'dial':
			return {
				...common,
				prompt: 'Gold Squadron Veteran must set a dial.',
				options: [option('dial:0', '2 straight (white)', { group: 'Speed 2' })],
			};
		case 'action':
			return {
				...common,
				prompt: 'Gold Squadron Veteran performs an action.',
				options: [
					option('action:0', 'Focus'),
					option('decline', 'Decline', { decline: true }),
				],
			};
		case 'damage-card':
			return {
				...common,
				prompt: 'Gold Squadron Veteran repairs a damage card.',
				options: [
					option('damage:0', 'Fuel Leak'),
					option('decline', 'Decline', { decline: true }),
				],
			};
		case 'lock-target':
			return {
				...common,
				prompt: 'Gold Squadron Veteran acquires a target lock.',
				options: [option('ship:0', 'Obsidian Squadron Pilot', { ship: 2 })],
			};
		case 'barrel-roll':
			return {
				...common,
				prompt: 'Gold Squadron Veteran barrel rolls.',
				options: [option('roll:0', 'bank left', { group: 'Left' })],
			};
		case 'attack':
			return {
				...common,
				prompt: 'Gold Squadron Veteran may attack.',
				options: [
					option('attack:0', 'Obsidian Squadron Pilot', { ship: 2 }),
					option('decline', 'Decline', { decline: true }),
				],
			};
		case 'attack-dice':
			return {
				...common,
				prompt: 'Gold Squadron Veteran attacks Obsidian Squadron Pilot.',
				options: [option('spend:f0l0e0', 'No tokens')],
				dice: { attack: ['focus', 'blank'] },
			};
		case 'defence-dice':
			return {
				...common,
				prompt:
					'Obsidian Squadron Pilot defends against Gold Squadron Veteran.',
				ship: 2,
				target: 1,
				options: [option('spend:f0l0e1', 'Spend 1 evade')],
				dice: { defence: ['blank', 'focus'] },
			};
		case 'optional':
			return {
				...common,
				prompt: 'Gold Squadron Veteran: resolve Patience?',
				options: [
					option('optional:0', 'Use Patience'),
					option('optional:no', 'No', { decline: true }),
				],
			};
		case 'choose-ship':
			return {
				...common,
				prompt: 'Gold Squadron Veteran: choose a friendly ship.',
				options: [
					option('ship:0', 'Obsidian Squadron Pilot', { ship: 2 }),
					option('decline', 'Decline', { decline: true }),
				],
			};
		case 'token':
			return {
				...common,
				prompt: 'Gold Squadron Veteran: choose one token.',
				options: [option('token:0', 'Focus token')],
			};
		case 'setup-pose':
		case 'ship-pose':
		case 'free-ship-pose':
			return {
				...common,
				prompt: 'Gold Squadron Veteran must place a ship.',
				options: [option('pose:0', 'Legal placement (360 mm, 60 mm)')],
			};
		case 'batch-ship-pose':
			return {
				...common,
				prompt: 'Confirm every ship’s deployment.',
				options: [option('batch:0', 'Confirm placements')],
				placements: [
					{
						ship: 1,
						candidates: [{ x: 360, y: 60, heading: 0 }],
						default: { x: 360, y: 60, heading: 0 },
					},
				],
			};
		case 'obstacle-setup':
			return {
				...common,
				prompt: 'Choose an obstacle or place one at random.',
				options: [option('obstacle:asteroid', 'Asteroid')],
			};
		case 'effect-choice':
			return {
				...common,
				prompt: 'Gold Squadron Veteran may resolve a printed effect.',
				options: [
					option('effect:0', 'Transfer 1 green token'),
					option('decline', 'Decline', { decline: true }),
				],
			};
		case 'reinforce':
			return {
				...common,
				prompt: 'Gold Squadron Veteran reinforces.',
				options: [option('reinforce:0', 'Fore'), option('reinforce:1', 'Aft')],
			};
		case 'reload':
			return {
				...common,
				prompt: 'Gold Squadron Veteran reloads.',
				options: [option('reload:0', 'proton torpedoes')],
			};
		case 'jam-effect':
			return {
				...common,
				prompt: 'Gold Squadron Veteran jams Obsidian Squadron Pilot.',
				target: 2,
				options: [option('jam:0', 'Remove focus token')],
			};
		case 'choice':
			return {
				...common,
				prompt: 'Gold Squadron Veteran: choose a boost template.',
				options: [option('choice:0', 'straight')],
			};
	}
}

function responseFor(kind: QuestionKind): GameResponse {
	return {
		id: 'g0000000000000001',
		status: 'asking',
		header,
		frames: [frame(true)],
		question: question(kind),
		result: null,
	} as GameResponse;
}

describe('PromptPanel', () => {
	it('validates and renders every question kind', () => {
		expect(QUESTION_KINDS).toHaveLength(21);
		for (const kind of QUESTION_KINDS) {
			const validated = validateGameResponse(responseFor(kind));
			const q = validated.question;
			expect(q, `${kind} question`).not.toBeNull();
			if (!q) continue;
			const first = q.options.find(
				(candidate) => !candidate.decline && candidate.available !== false,
			);
			expect(first, `${kind} has an answerable option`).toBeDefined();
			const { body } = render(PromptPanel, {
				props: { question: q, onselect: () => {} },
			});
			expect(body, kind).toContain('data-testid="prompt"');
			expect(body, kind).toContain(q.prompt);
			if (first) expect(body, kind).toContain(first.label);
			expect(body, kind).toContain('<button');
		}
	});
});
