import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	ApiError,
	DEFAULT_FORMAT,
	DEFAULT_SEED,
	LIVE_SCHEMA,
	LIST_FORMAT,
	LIST_SCHEMA,
	PLAY_FORMATS,
	QUESTION_KINDS,
	SAVED_SQUADS_KEY,
	SAVED_SQUADS_SCHEMA,
	SAVED_SQUAD_LIMIT,
	addCustomPilot,
	addCustomShip,
	answerQuestion,
	changeCustomPilot,
	createGame,
	customLineupRequest,
	customLineupSelections,
	customLineupTotals,
	customPilotById,
	customPilotFormatReason,
	customPilotLimitReason,
	customPilotShipLabel,
	customSlotPlan,
	decisionOwner,
	defaultCustomLineup,
	defaultCustomLineupFor,
	defaultLoadoutSelections,
	defaultMultiSelections,
	defaultPilotSelections,
	deleteGame,
	deletePublishedSquad,
	deleteSavedSquad,
	encodeListShare,
	exportListDocument,
	filterCustomPilots,
	fitCustomLineup,
	formatById,
	getGame,
	getFormats,
	getLoadoutCatalog,
	getSquads,
	hotseatSummary,
	importList,
	importListDocument,
	importSharedSquad,
	isSquadShareId,
	listGameRequest,
	loadSavedSquads,
	loadoutTotals,
	pilotSlots,
	pilotsForFormat,
	previewCustomShips,
	publishSquad,
	presetSides,
	previewMultiShips,
	previewShips,
	remapSelectionsForPilot,
	removeCustomShip,
	replayUrl,
	saveSquad,
	sharedListText,
	sharedSquadId,
	shareListUrl,
	squadShareUrl,
	standardFormatFromCatalog,
	validateFormatsResponse,
	selectedLoadout,
	serializeListDocument,
	setCustomSlot,
	selectedMultiSelections,
	selectedPilots,
	validateGameResponse,
	validateListDocument,
	validateLoadoutCatalog,
	validateSquadsResponse,
	viewingSeatFor,
	type CardPreset,
	type CustomLineup,
	type CustomShipState,
	type GameHeader,
	type GameResponse,
	type ListDocument,
	type LoadoutCatalog,
	type SquadStorage
} from './live';
import type { ReplayShip } from './replay';

const fetchMock = vi.fn();

function response(body: unknown, status = 200, statusText = 'OK') {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		text: async () => (body === undefined ? '' : JSON.stringify(body))
	} as unknown as Response;
}

function ship(id: number, faction: ReplayShip['faction'], name: string): ReplayShip {
	return {
		id,
		name,
		ship: faction === 'rebel' ? 'BTL-A4 Y-wing' : 'TIE/ln Fighter',
		faction,
		base: 40,
		initiative: 2,
		hull: faction === 'rebel' ? 6 : 3,
		shields: faction === 'rebel' ? 2 : 0,
		agility: faction === 'rebel' ? 1 : 3,
		arc: 'front'
	};
}

const ships = [
	ship(1, 'rebel', 'Gray Squadron Bomber'),
	ship(2, 'rebel', 'Gold Squadron Veteran'),
	ship(3, 'empire', 'Obsidian Squadron Pilot'),
	ship(4, 'empire', 'Black Squadron Ace')
];

const frame = {
	n: 3,
	round: 1,
	phase: 'planning',
	active: null,
	ships: ships.map((s) => ({
		id: s.id,
		x: 360,
		y: 60,
		heading: 0,
		hull: s.hull,
		shields: s.shields,
		tokens: {},
		lock: null,
		alive: true,
		damage: 0
	})),
	events: [{ tone: 'system', text: 'Round 1 begins.' }]
};

const questionFrame = { ...frame, n: 0, events: [] };

const header = {
	schema: LIVE_SCHEMA,
	engine: 'wing-engine 0.1.0',
	seed: 7,
	human: 0,
	format: 'standard-50p',
	players: [
		{ name: 'Rebels', faction: 'rebel', points: 16 },
		{ name: 'Empire', faction: 'empire', points: 11 }
	],
	ships,
	board: { width: 914, height: 914, obstacles: [{ x: 300, y: 300, radius: 20, kind: 'asteroid' }] }
};

function sample(): GameResponse {
	return {
		id: 'g0000000000000001',
		status: 'asking',
		header,
		frames: [frame],
		question: {
			id: 1,
			player: 0,
			ship: 1,
			kind: 'dial',
			prompt: 'YW-1 (Gray Squadron Bomber) must set a dial.',
			options: [
				{ id: 'dial:0', label: '2 straight (white)', group: 'Speed 2' },
				{ id: 'dial:1', label: '2 bank left (white)', group: 'Speed 2' }
			],
			frame: questionFrame
		} as unknown as GameResponse['question'],
		result: null
	} as unknown as GameResponse;
}

function presetResponse() {
	const card = (xws: string, name: string, slot: string) => ({ xws, name, slot });
	const make = (id: string, label: string, cards: [string, string, string][]) => ({
		id,
		label,
		description: `${label} preset, not a tournament-legal list.`,
		ships: [
			{
				player: 0,
				pilot: 'Gray Squadron Bomber',
				ship: 'BTL-A4 Y-wing',
				cards: [{ xws: cards[0][0], name: cards[0][1], slot: cards[0][2] }]
			},
			{
				player: 1,
				pilot: 'Obsidian Squadron Pilot',
				ship: 'TIE/ln Fighter',
				cards: [{ xws: cards[1][0], name: cards[1][1], slot: cards[1][2] }]
			}
		]
	});
	const r4 = card('r4astromech', 'R4 Astromech', 'Astromech');
	const r2 = card('r2astromech', 'R2 Astromech', 'Astromech');
	const predator = card('predator', 'Predator', 'Talent');
	return {
		presets: [
			make('card-demo', 'Card Demo', [
				['r4astromech', 'R4 Astromech', 'Astromech'],
				['juke', 'Juke', 'Talent']
			]),
			make('card-demo-focus', 'Card Demo: Focus & Evade', [
				['r5astromech', 'R5 Astromech', 'Astromech'],
				['marksmanship', 'Marksmanship', 'Talent']
			]),
			{
				id: 'card-demo-custom',
				label: 'Card Demo: Custom Loadout',
				description: 'Compiled cards in every printed slot, not a listbuilder.',
				ships: [
					{
						player: 0,
						pilot: 'Gray Squadron Bomber',
						ship: 'BTL-A4 Y-wing',
						cards: [r4]
					},
					{
						player: 0,
						pilot: 'Gold Squadron Veteran',
						ship: 'BTL-A4 Y-wing',
						cards: [predator, r2]
					},
					{
						player: 1,
						pilot: 'Obsidian Squadron Pilot',
						ship: 'TIE/ln Fighter',
						cards: [card('electronicbaffle', 'Electronic Baffle', 'Modification')]
					},
					{
						player: 1,
						pilot: 'Black Squadron Ace',
						ship: 'TIE/ln Fighter',
						cards: [
							card('juke', 'Juke', 'Talent'),
							card('stealthdevice', 'Stealth Device', 'Modification')
						]
					}
				]
			}
		]
	};
}

function catalogResponse() {
	const option = (
		kind: string,
		xws: string,
		name: string,
		slot: string,
		points: number,
		factions: string[] = ['All'],
		unique = false,
		limited = 0
	) => ({ id: `${kind}:${xws}`, xws, name, slot, points, factions, unique, limited });
	const pilot = (
		id: string,
		name: string,
		initiative: number,
		points: number,
		loadout: number,
		faction: string,
		limited = 0
	) => ({ id, name, initiative, points, loadout, limited, unique: limited === 1, faction });
	const openSlot = (
		index: number,
		key: string,
		slot: string,
		kind: string,
		options: ReturnType<typeof option>[],
		defaultOption: string | null = null
	) => ({
		index,
		key,
		slot,
		kind,
		fixed: false,
		fixed_card: null,
		default_option: defaultOption,
		options
	});
	const emptySlot = (index: number, key: string, slot: string, kind: string) => ({
		index,
		key,
		slot,
		kind,
		fixed: false,
		fixed_card: null,
		default_option: null,
		options: []
	});
	const predator = option('talent', 'predator', 'Predator', 'Talent', 3);
	const marksmanship = option('talent', 'marksmanship', 'Marksmanship', 'Talent', 2);
	const collision = option('sensor', 'collisiondetector', 'Collision Detector', 'Sensor', 7);
	const proton = option('torpedo', 'protontorpedoes', 'Proton Torpedoes', 'Torpedo', 14);
	const jamming = option('cannon', 'jammingbeam', 'Jamming Beam', 'Cannon', 1);
	const pattern = option('tech', 'patternanalyzer', 'Pattern Analyzer', 'Tech', 5);
	const afterburners = option(
		'modification',
		'afterburners',
		'Afterburners',
		'Modification',
		8,
		['All']
	);
	const hera = pilot(
		'herasyndulla-vcx100lightfreighter',
		'Hera Syndulla',
		5,
		17,
		19,
		'rebelalliance',
		1
	);
	const heraAlt = pilot(
		'herasyndulla-legendsandrelics',
		'Hera Syndulla',
		5,
		18,
		20,
		'rebelalliance',
		1
	);
	const kanan = pilot('kananjarrus', 'Kanan Jarrus', 3, 18, 20, 'rebelalliance', 1);
	const lothal = pilot('lothalrebel', 'Lothal Rebel', 2, 15, 9, 'rebelalliance');
	const dobbs = pilot('captaindobbs', 'Captain Dobbs', 3, 15, 7, 'galacticempire', 1);
	const ryad = pilot('countessryad', 'Countess Ryad', 4, 15, 7, 'galacticempire', 1);
	const onyx = pilot('onyxsquadronace', 'Onyx Squadron Ace', 4, 16, 10, 'galacticempire');
	const rexler = pilot('rexlerbrath', 'Rexler Brath', 5, 18, 13, 'galacticempire', 1);
	const wedge = pilot('wedgeantilles', 'Wedge Antilles', 6, 14, 13, 'rebelalliance', 1);
	const phoenix = pilot('phoenixsquadronpilot', 'Phoenix Squadron Pilot', 1, 7, 1, 'rebelalliance');
	const gray = pilot('graysquadronbomber', 'Gray Squadron Bomber', 2, 7, 4, 'rebelalliance');
	const zebShuttle = pilot(
		'zeborrelios-sheathipedeclassshuttle',
		'“Zeb” Orrelios',
		2,
		7,
		4,
		'rebelalliance',
		1
	);
	const bandit = pilot('banditsquadronpilot', 'Bandit Squadron Pilot', 1, 6, 5, 'rebelalliance');
	const green = pilot('greensquadronpilot', 'Green Squadron Pilot', 3, 8, 6, 'rebelalliance');
	const ap5 = pilot('ap5', 'AP-5', 1, 8, 6, 'rebelalliance', 1);
	const academy = pilot('academypilot', 'Academy Pilot', 1, 5, 0, 'galacticempire');
	const obsidian = pilot('obsidiansquadronpilot', 'Obsidian Squadron Pilot', 2, 5, 0, 'galacticempire');
	const black = pilot('blacksquadronace', 'Black Squadron Ace', 3, 6, 4, 'galacticempire');
	const wampa = pilot('wampa', '“Wampa”', 1, 6, 2, 'galacticempire', 1);
	const howlrunner = pilot('howlrunner', '“Howlrunner”', 5, 8, 6, 'galacticempire', 1);
	const mauler = pilot('maulermithel', '“Mauler” Mithel', 5, 8, 9, 'galacticempire', 1);
	const sienar = pilot('sienarspecialist', 'Sienar Specialist', 2, 7, 6, 'galacticempire');
	const yrica = pilot('yricaquell', 'Yrica Quell', 3, 7, 8, 'galacticempire', 1);
	const valen = pilot('valenrudor-swz105', 'Valen Rudor', 3, 7, 0, 'galacticempire', 1);
	const nightbeast = pilot('nightbeast-swz105', '“Night Beast”', 2, 7, 0, 'galacticempire', 1);
	const alderaan = pilot(
		'alderaanianguard',
		'Alderaanian Guard',
		2,
		36,
		40,
		'rebelalliance',
		1
	);

	const shipRow = (
		index: number,
		player: number,
		defaultPilot: ReturnType<typeof pilot>,
		ship: string,
		chassis: string,
		faction: string,
		pilots: ReturnType<typeof pilot>[],
		slots: ReturnType<typeof openSlot>[],
		defaultSlot: number,
		defaultOption: string
	) => ({
		index,
		player,
		pilot: defaultPilot.name,
		ship,
		chassis,
		faction,
		points: defaultPilot.points,
		loadout: defaultPilot.loadout,
		limited: defaultPilot.limited,
		unique: defaultPilot.unique,
		default_pilot: defaultPilot.id,
		pilots: pilots.map((pilot) => ({ ...pilot, slots })),
		slot: slots[defaultSlot].slot,
		default_slot: defaultSlot,
		default_option: defaultOption,
		fixed_cards: [],
		fixed_points: 0,
		slots,
		options: slots[defaultSlot].options
	});

	const shipRows = [
			shipRow(
				0,
				0,
				hera,
				'VCX-100 Light Freighter',
				'vcx100lightfreighter',
				'Rebel Alliance',
				[heraAlt, hera],
				[
					openSlot(0, 'talent', 'Talent', 'talent', [predator, marksmanship], 'talent:predator'),
					emptySlot(1, 'title', 'Title', 'title')
				],
				0,
				'talent:predator'
			),
			shipRow(
				1,
				0,
				kanan,
				'VCX-100 Light Freighter',
				'vcx100lightfreighter',
				'Rebel Alliance',
				[kanan],
				[openSlot(0, 'sensor', 'Sensor', 'sensor', [collision], 'sensor:collisiondetector')],
				0,
				'sensor:collisiondetector'
			),
			shipRow(
				2,
				0,
				lothal,
				'VCX-100 Light Freighter',
				'vcx100lightfreighter',
				'Rebel Alliance',
				[lothal],
				[
					openSlot(0, 'sensor', 'Sensor', 'sensor', [collision], 'sensor:collisiondetector'),
					openSlot(1, 'torpedo', 'Torpedo', 'torpedo', [proton])
				],
				0,
				'sensor:collisiondetector'
			),
			shipRow(
				3,
				1,
				dobbs,
				'TIE/D Defender',
				'tieddefender',
				'Galactic Empire',
				[dobbs, onyx, rexler],
				[
					openSlot(0, 'cannon', 'Cannon', 'cannon', [jamming], 'cannon:jammingbeam'),
					openSlot(1, 'tech', 'Tech', 'tech', [pattern])
				],
				0,
				'cannon:jammingbeam'
			),
			shipRow(
				4,
				1,
				ryad,
				'TIE/D Defender',
				'tieddefender',
				'Galactic Empire',
				[ryad],
				[
					openSlot(0, 'cannon', 'Cannon', 'cannon', [jamming], 'cannon:jammingbeam'),
					openSlot(1, 'modification', 'Modification', 'modification', [afterburners])
				],
				0,
				'cannon:jammingbeam'
			),
			shipRow(
				5,
				1,
				onyx,
				'TIE/D Defender',
				'tieddefender',
				'Galactic Empire',
				[dobbs, onyx, rexler],
				[
					openSlot(0, 'cannon', 'Cannon', 'cannon', [jamming], 'cannon:jammingbeam'),
					openSlot(1, 'tech', 'Tech', 'tech', [pattern])
				],
				0,
				'cannon:jammingbeam'
			)
	];

	const poolEntry = (
		base: ReturnType<typeof pilot>,
		ship: string,
		chassis: string,
		factionLabel: string,
		stats: { attack: number; agility: number; hull: number; shields: number },
		slots: ReturnType<typeof openSlot>[] = [],
		baseSize = 'Small',
		epicOnly = false
	) => ({
		...base,
		ship,
		chassis,
		faction_label: factionLabel,
		...stats,
		base: baseSize,
		epic_only: epicOnly,
		force_capacity: 0,
		slots
	});
	const vcxSlots = (shipRows[0] as { slots: ReturnType<typeof openSlot>[] }).slots;
	const kananSlots = (shipRows[1] as { slots: ReturnType<typeof openSlot>[] }).slots;
	const lothalSlots = (shipRows[2] as { slots: ReturnType<typeof openSlot>[] }).slots;
	const dobbsSlots = (shipRows[3] as { slots: ReturnType<typeof openSlot>[] }).slots;
	const ryadSlots = (shipRows[4] as { slots: ReturnType<typeof openSlot>[] }).slots;
	const onyxSlots = (shipRows[5] as { slots: ReturnType<typeof openSlot>[] }).slots;

	return {
		squad: 'card-demo-custom',
		ships: shipRows,
		pilot_pool: [
			poolEntry(hera, 'VCX-100 Light Freighter', 'vcx100lightfreighter', 'Rebel Alliance', { attack: 4, agility: 0, hull: 10, shields: 4 }, vcxSlots),
			poolEntry(heraAlt, 'VCX-100 Light Freighter', 'vcx100lightfreighter', 'Rebel Alliance', { attack: 4, agility: 0, hull: 10, shields: 4 }, vcxSlots),
			poolEntry(kanan, 'VCX-100 Light Freighter', 'vcx100lightfreighter', 'Rebel Alliance', { attack: 4, agility: 0, hull: 10, shields: 4 }, kananSlots),
			poolEntry(lothal, 'VCX-100 Light Freighter', 'vcx100lightfreighter', 'Rebel Alliance', { attack: 4, agility: 0, hull: 10, shields: 4 }, lothalSlots),
			poolEntry(wedge, 'T-65 X-wing', 't65xwing', 'Rebel Alliance', { attack: 3, agility: 2, hull: 4, shields: 2 }),
			poolEntry(phoenix, 'RZ-1 A-wing', 'rz1awing', 'Rebel Alliance', { attack: 2, agility: 3, hull: 2, shields: 2 }),
			poolEntry(gray, 'BTL-A4 Y-wing', 'btla4ywing', 'Rebel Alliance', { attack: 2, agility: 1, hull: 6, shields: 2 }),
			poolEntry(zebShuttle, 'Sheathipede-class Shuttle', 'sheathipedeclassshuttle', 'Rebel Alliance', { attack: 2, agility: 2, hull: 4, shields: 1 }),
			poolEntry(bandit, 'Z-95-AF4 Headhunter', 'z95af4headhunter', 'Rebel Alliance', { attack: 2, agility: 2, hull: 2, shields: 2 }),
			poolEntry(green, 'RZ-1 A-wing', 'rz1awing', 'Rebel Alliance', { attack: 2, agility: 3, hull: 2, shields: 2 }),
			poolEntry(ap5, 'Sheathipede-class Shuttle', 'sheathipedeclassshuttle', 'Rebel Alliance', { attack: 2, agility: 2, hull: 4, shields: 1 }),
			poolEntry(dobbs, 'TIE/D Defender', 'tieddefender', 'Galactic Empire', { attack: 3, agility: 3, hull: 3, shields: 4 }, dobbsSlots),
			poolEntry(ryad, 'TIE/D Defender', 'tieddefender', 'Galactic Empire', { attack: 3, agility: 3, hull: 3, shields: 4 }, ryadSlots),
			poolEntry(onyx, 'TIE/D Defender', 'tieddefender', 'Galactic Empire', { attack: 3, agility: 3, hull: 3, shields: 4 }, onyxSlots),
			poolEntry(rexler, 'TIE/D Defender', 'tieddefender', 'Galactic Empire', { attack: 3, agility: 3, hull: 3, shields: 4 }, onyxSlots),
			poolEntry(academy, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(obsidian, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(black, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(wampa, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(howlrunner, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(mauler, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(sienar, 'TIE/ag Aggressor', 'tieagaggressor', 'Galactic Empire', { attack: 2, agility: 2, hull: 4, shields: 1 }),
			poolEntry(yrica, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(valen, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(nightbeast, 'TIE/ln Fighter', 'tielnfighter', 'Galactic Empire', { attack: 2, agility: 3, hull: 3, shields: 0 }),
			poolEntry(
				alderaan,
				'CR90 Corellian Corvette',
				'cr90corelliancorvette',
				'Rebel Alliance',
				{ attack: 3, agility: 0, hull: 12, shields: 4 },
				[],
				'Huge',
				true
			)
		],
		min_ships: 3,
		max_ships: 8,
		points_min: 46,
		pilot_pool_report: {
			committed_rows: 26,
			curated_rows: 25,
			pool_rows: 26,
			pool_chassis: 9,
			omitted_rows: 0,
			omissions: [],
			note: 'Every fixture row has committed chassis data.'
		},
		total_points: 96,
		point_cap: 50,
		legal_50: true,
		legality_note:
			'Legality is the committed 50P 2.1.1 validator: 3-8 ships, 46-50 points, one faction, per-ship loadout and printed slot limits.',
		sides: [
			{
				player: 0,
				faction: 'Rebel Alliance',
				ship_count: 3,
				points: 50,
				point_cap: 50,
				over_cap: false,
				legal_50: true,
				violations: []
			},
			{
				player: 1,
				faction: 'Galactic Empire',
				ship_count: 3,
				points: 46,
				point_cap: 50,
				over_cap: false,
				legal_50: true,
				violations: []
			}
		],
		data_gaps: {
			compiled_without_listbuilding: 49,
			excluded_slot_rewriting: 0,
			uncatalogued_slot_rewriting: 0,
			slot_rewriting_gaps: [],
			note: 'Compiled cards without a listbuilding row are excluded; rewriting cards are catalogued.'
		}
	};
}

/** A minimal but complete `/api/formats` fixture with the committed numbers a
 *  browser would receive. */
function formatRow(overrides: {
	id: string;
	name: string;
	pointsMin: number;
	pointsMax: number;
	shipsMin: number;
	shipsMax: number;
	huge: boolean;
	command: boolean;
	hugeMin?: number;
	specialCaps?: { kind: string; value: number; applies_to: string }[];
	playable?: boolean;
	note?: string | null;
	provenance?: string;
	official?: boolean;
}) {
	return {
		spec: {
			id: overrides.id,
			name: overrides.name,
			max_squad_points: overrides.pointsMax,
			min_ships: overrides.shipsMin,
			max_ships: overrides.shipsMax,
			rounds: 12,
			play_area_mm: 914,
			min_players: 2,
			max_players: 2,
			teams: 'none',
			huge_ships_allowed: overrides.huge,
			command_slot_allowed: overrides.command,
			respawn: false,
			scenario_pool: 'xwa-five',
			victory_threshold: 50
		},
		listbuilding: {
			points_min: overrides.pointsMin,
			points_max: overrides.pointsMax,
			ships_min: overrides.shipsMin,
			ships_max: overrides.shipsMax,
			faction: 'single',
			loadout: 'per_ship',
			restricted_list: true,
			deficit: true,
			huge_ships_allowed: overrides.huge,
			huge_ships_min: overrides.hugeMin ?? 0,
			max_huge_ships: 0,
			max_points_on_huge: 0,
			command_slot_allowed: overrides.command,
			special_caps: overrides.specialCaps ?? []
		},
		provenance: overrides.provenance ?? 'xwa',
		official: overrides.official ?? true,
		version: 'fixture',
		effective: '2026-11-04',
		custom_lineup_playable:
			overrides.playable ??
			['standard-50p', 'epic-xwa', 'epic-house'].includes(overrides.id),
		custom_lineup_note:
			overrides.note === undefined
				? ['standard-50p', 'epic-xwa', 'epic-house'].includes(overrides.id)
					? null
					: `${overrides.id} lists can be validated and published, but custom game start is not implemented for this format`
				: overrides.note
	};
}

function formatResponse() {
	return {
		formats: [
			formatRow({
				id: 'standard-50p',
				name: '50P Standard',
				pointsMin: 46,
				pointsMax: 50,
				shipsMin: 3,
				shipsMax: 8,
				huge: false,
				command: false
			}),
			formatRow({
				id: 'aces-high',
				name: 'Aces High',
				pointsMin: 0,
				pointsMax: 16,
				shipsMin: 1,
				shipsMax: 1,
				huge: false,
				command: false,
				specialCaps: [{ kind: 'pilot_points_max', value: 16, applies_to: 'each_ship' }]
			}),
			formatRow({
				id: 'epic-xwa',
				name: 'Epic (XWA-managed, unofficial)',
				pointsMin: 0,
				pointsMax: 100,
				shipsMin: 3,
				shipsMax: 8,
				huge: true,
				command: true,
				provenance: 'xwa-unofficial',
				official: false
			}),
			formatRow({
				id: 'epic-house',
				name: 'Epic + house defaults',
				pointsMin: 0,
				pointsMax: 100,
				shipsMin: 3,
				shipsMax: 8,
				huge: true,
				command: true,
				hugeMin: 1,
				provenance: 'house',
				official: false
			})
		]
	};
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('validateGameResponse', () => {
	it('accepts the live contract with an empty prompt-frame event list', () => {
		const value = validateGameResponse(sample());
		expect(value.header.schema).toBe(LIVE_SCHEMA);
		expect(value.question?.options[0].id).toBe('dial:0');
		expect(value.question?.frame.events).toEqual([]);
	});

	it('accepts the hotseat flag and rejects a non-boolean one', () => {
		const value = structuredClone(sample()) as unknown as Record<string, unknown>;
		const header = value.header as Record<string, unknown>;
		header.hotseat = true;
		const validated = validateGameResponse(value);
		expect(validated.header.hotseat).toBe(true);

		header.hotseat = 'yes';
		expect(() => validateGameResponse(value)).toThrow(/hotseat/);
	});

	it('accepts the engine Force option in an attack-dice question', () => {
		const value = structuredClone(sample()) as unknown as Record<string, unknown>;
		const question = value.question as Record<string, unknown>;
		question.kind = 'attack-dice';
		question.dice = { attack: ['focus', 'blank'] };
		question.options = [
			{ id: 'spend:f0l0e0', label: 'No tokens' },
			{ id: 'spend:f0l0e0force', label: 'Spend 1 Force' }
		];
		const validated = validateGameResponse(value);
		expect(validated.question?.options.map((option) => option.id)).toContain(
			'spend:f0l0e0force'
		);
		// The client posts the id back verbatim; the engine owns the rule.
		expect(
			validated.question?.options.find((option) => option.label === 'Spend 1 Force')?.id
		).toBe('spend:f0l0e0force');
	});

	it('accepts an effect-choice prompt with a disabled printed branch', () => {
		const value = structuredClone(sample()) as unknown as Record<string, unknown>;
		const question = value.question as Record<string, unknown>;
		question.kind = 'effect-choice';
		question.prompt = 'YW-1 may resolve a printed effect. Choose one or decline.';
		question.options = [
			{
				id: 'effect:0',
				label: 'Transfer 1 green token from yourself to the chosen ship'
			},
			{
				id: 'effect:1',
				label: 'Transfer 1 orange token from the chosen ship to yourself',
				available: false
			},
			{ id: 'decline', label: 'Decline', decline: true }
		];
		const validated = validateGameResponse(value);
		expect(validated.question?.kind).toBe('effect-choice');
		expect(validated.question?.options[1].available).toBe(false);
		expect(validated.question?.options[2].decline).toBe(true);
	});

	it('rejects a non-boolean available flag on an option', () => {
		const bad = structuredClone(sample()) as unknown as Record<string, unknown>;
		const q = bad.question as Record<string, unknown>;
		q.options = [{ id: 'effect:0', label: 'one', available: 'no' }];
		expect(() => validateGameResponse(bad)).toThrow(/available/);
	});

	it('rejects a question kind this client cannot render', () => {
		const bad = structuredClone(sample()) as unknown as Record<string, unknown>;
		(bad.question as Record<string, unknown>).kind = 'cast-a-spell';
		expect(() => validateGameResponse(bad)).toThrow(/unknown value/);
	});

	it('rejects duplicate option ids and empty option lists', () => {
		const duplicate = structuredClone(sample()) as unknown as Record<string, unknown>;
		const q = duplicate.question as Record<string, unknown>;
		q.options = [
			{ id: 'dial:0', label: 'one' },
			{ id: 'dial:0', label: 'two' }
		];
		expect(() => validateGameResponse(duplicate)).toThrow(/duplicate option id/);

		const empty = structuredClone(sample()) as unknown as Record<string, unknown>;
		(empty.question as Record<string, unknown>).options = [];
		expect(() => validateGameResponse(empty)).toThrow(/at least one option/);
	});

	it('requires a result when the game is done and a question when it is asking', () => {
		const done = structuredClone(sample()) as unknown as Record<string, unknown>;
		done.status = 'done';
		expect(() => validateGameResponse(done)).toThrow(/needs a result/);

		const asking = structuredClone(sample()) as unknown as Record<string, unknown>;
		asking.question = null;
		expect(() => validateGameResponse(asking)).toThrow(/needs a question/);
	});

	it('covers every question kind exactly once', () => {
		expect([...QUESTION_KINDS].sort()).toEqual(
			[
				'action',
				'attack',
				'attack-dice',
				'barrel-roll',
				'dial',
				'defence-dice',
				'lock-target',
				'damage-card',
				'optional',
				'choose-ship',
				'token',
				'setup-pose',
				'ship-pose',
				'free-ship-pose',
				'batch-ship-pose',
				'obstacle-setup',
				'effect-choice',
				'reinforce',
				'reload',
				'jam-effect',
				'choice'
			].sort()
		);
	});

	it('pins the shared question-kind order', () => {
		expect(QUESTION_KINDS).toEqual([
			'dial',
			'action',
			'damage-card',
			'lock-target',
			'barrel-roll',
			'attack',
			'attack-dice',
			'defence-dice',
			'optional',
			'choose-ship',
			'token',
			'setup-pose',
			'ship-pose',
			'free-ship-pose',
			'batch-ship-pose',
			'obstacle-setup',
			'effect-choice',
			'reinforce',
			'reload',
			'jam-effect',
			'choice'
		]);
	});
});

describe('the API client', () => {
	it('creates a game with the requested seed and human side', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		const game = await createGame(7, 0);
		expect(game.id).toBe('g0000000000000001');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/games');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ seed: 7, human: 0 });
	});

	it('keeps seed 7 and Standard as the default identity', () => {
		expect(DEFAULT_SEED).toBe(7);
		expect(DEFAULT_FORMAT).toBe('standard-50p');
		expect(PLAY_FORMATS[0]).toEqual({ id: 'standard-50p', label: 'Standard 50P' });
		expect(PLAY_FORMATS.map((choice) => choice.id)).toEqual([
			'standard-50p',
			'aces-high',
			'epic-xwa',
			'epic-house'
		]);
	});

	it('sends the selected Epic format without a Standard or card-demo fallback', async () => {
		for (const format of ['epic-xwa', 'epic-house'] as const) {
			fetchMock.mockResolvedValueOnce(response(sample()));
			await createGame(42, 0, format);
			const [, init] = fetchMock.mock.calls.at(-1)!;
			const body = JSON.parse(init.body);
			expect(body).toEqual({ seed: 42, human: 0, format });
			expect(body.format).not.toBe('standard-50p');
			expect(body).not.toHaveProperty('squad');
			expect(body).not.toHaveProperty('players');
		}
	});

	it('rejects a prompt kind the client cannot render instead of defaulting it', () => {
		const value = structuredClone(sample()) as unknown as {
			question: { kind: string };
		};
		value.question.kind = 'wingmate-cancel';
		expect(() => validateGameResponse(value)).toThrow(/unknown value "wingmate-cancel"/);
	});

	it('sends the card-demo squad through createGame', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(11, 0, 'standard-50p', undefined, undefined, 'card-demo');
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			seed: 11,
			human: 0,
			format: 'standard-50p',
			squad: 'card-demo'
		});
	});

	it('sends the selected focus preset through createGame', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(11, 0, 'standard-50p', undefined, undefined, 'card-demo-focus');
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			seed: 11,
			human: 0,
			format: 'standard-50p',
			squad: 'card-demo-focus'
		});
	});

	it('sends the selected custom loadout array with the custom squad', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		const loadout = [
			'astromech:r5astromech',
			'talent:marksmanship',
			'modification:afterburners',
			'talent:juke'
		];
		await createGame(
			11,
			0,
			'standard-50p',
			undefined,
			undefined,
			'card-demo-custom',
			false,
			loadout
		);
		const [, init] = fetchMock.mock.calls[0];
		expect(JSON.parse(init.body)).toEqual({
			seed: 11,
			human: 0,
			format: 'standard-50p',
			squad: 'card-demo-custom',
			loadout
		});
	});

	it('fetches and validates the preset metadata for the setup preview', async () => {
		fetchMock.mockResolvedValueOnce(response(presetResponse()));
		const presets = await getSquads();
		expect(fetchMock.mock.calls[0][0]).toBe('/api/squads');
		expect(presets.map((preset) => preset.id)).toEqual([
			'card-demo',
			'card-demo-focus',
			'card-demo-custom'
		]);
		expect(presets[1].ships[0].cards[0]).toEqual({
			xws: 'r5astromech',
			name: 'R5 Astromech',
			slot: 'Astromech'
		});
		expect(presets[2].ships[0].cards[0].name).toBe('R4 Astromech');
	});

	it('fetches and validates the compiled six-ship loadout catalog', async () => {
		fetchMock.mockResolvedValueOnce(response(catalogResponse()));
		const catalog = await getLoadoutCatalog();
		expect(fetchMock.mock.calls[0][0]).toBe('/api/loadout-catalog');
		expect(catalog.ships.map((ship) => ship.slot)).toEqual([
			'Talent',
			'Sensor',
			'Sensor',
			'Cannon',
			'Cannon',
			'Cannon'
		]);
		expect(catalog.ships[0].pilots.map((pilot) => pilot.name)).toContain('Hera Syndulla');
		expect(catalog.ships[0].pilots[1]).toMatchObject({
			id: 'herasyndulla-vcx100lightfreighter',
			initiative: 5,
			points: 17,
			loadout: 19,
			unique: true,
			faction: 'rebelalliance'
		});
		expect(catalog.ships[2].fixed_cards).toEqual([]);
		expect(catalog.total_points).toBe(96);
		expect(catalog.legal_50).toBe(true);
	});

	it('sends dynamic side sizes, pilots and ordered selections', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const lineup = addCustomShip(catalog, defaultCustomLineup(catalog), 1);
		const request = customLineupRequest(catalog, lineup);
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(
			7,
			0,
			'standard-50p',
			undefined,
			undefined,
			'card-demo-custom',
			false,
			undefined,
			request.selections,
			request.pilots,
			request.side_sizes
		);
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.side_sizes).toEqual([3, 4]);
		expect(body.pilots).toHaveLength(7);
		expect(body.selections).toHaveLength(7);
		expect(body.selections[0]).toEqual(['talent:predator', null]);
		expect(body.selections[6]).toHaveLength(0);
	});

	it('starts an Epic custom lineup with the selected rows', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const lineup = defaultCustomLineup(catalog);
		const request = customLineupRequest(catalog, lineup);
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(
			42,
			0,
			'epic-house',
			undefined,
			undefined,
			'card-demo-custom',
			false,
			undefined,
			request.selections,
			request.pilots,
			request.side_sizes
		);
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body).toMatchObject({
			seed: 42,
			human: 0,
			format: 'epic-house',
			squad: 'card-demo-custom',
			side_sizes: request.side_sizes,
			pilots: request.pilots,
			selections: request.selections
		});
	});

	it('surfaces the Epic format validator error from the start request', async () => {
		fetchMock.mockResolvedValueOnce(
			response(
				{ error: 'player lineup is not a legal epic-house squad: player 2: 0 huge ship(s); Epic requires at least 1' },
				400,
				'Bad Request'
			)
		);
		await expect(
			createGame(42, 0, 'epic-house', undefined, undefined, 'card-demo-custom')
		).rejects.toMatchObject({
			status: 400,
			message: expect.stringContaining('player 2')
		});
	});

	it('builds default pilots and pins the bot side outside hotseat', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const pilots = defaultPilotSelections(catalog);
		expect(pilots).toEqual({
			0: 'herasyndulla-vcx100lightfreighter',
			1: 'kananjarrus',
			2: 'lothalrebel',
			3: 'captaindobbs',
			4: 'countessryad',
			5: 'onyxsquadronace'
		});
		expect(
			selectedPilots(
				catalog,
				{ 0: 'herasyndulla-legendsandrelics', 3: 'rexlerbrath' },
				false
			)
		).toEqual([
			'herasyndulla-legendsandrelics',
			'kananjarrus',
			'lothalrebel',
			'captaindobbs',
			'countessryad',
			'onyxsquadronace'
		]);
		expect(
			selectedPilots(
				catalog,
				{ 0: 'herasyndulla-legendsandrelics', 3: 'rexlerbrath' },
				true
			)
		).toEqual([
			'herasyndulla-legendsandrelics',
			'kananjarrus',
			'lothalrebel',
			'rexlerbrath',
			'countessryad',
			'onyxsquadronace'
		]);
	});

	it('maps every catalog slot with keys, points and pilot metadata', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		expect(catalog.ships.map((ship) => ship.slots.map((slot) => slot.kind))).toEqual([
			['talent', 'title'],
			['sensor'],
			['sensor', 'torpedo'],
			['cannon', 'tech'],
			['cannon', 'modification'],
			['cannon', 'tech']
		]);
		const hera = catalog.ships[0];
		expect(hera.slots[0].key).toBe('talent');
		expect(hera.slots[0].default_option).toBe('talent:predator');
		expect(hera.slots[1].key).toBe('title');
		expect(hera.slots[1].options).toEqual([]);
		expect(hera.default_pilot).toBe('herasyndulla-vcx100lightfreighter');
		const rexler = catalog.ships[3].pilots.find((pilot) => pilot.id === 'rexlerbrath');
		expect(rexler).toMatchObject({
			points: 18,
			loadout: 13,
			initiative: 5,
			unique: true,
			faction: 'galacticempire'
		});
		expect(catalog.total_points).toBe(96);
		expect(catalog.point_cap).toBe(50);
		expect(catalog.legal_50).toBe(true);
		expect(catalog.sides.map((side) => side.points)).toEqual([50, 46]);
		expect(catalog.sides.every((side) => side.violations.length === 0)).toBe(true);
	});

	it('switches to each pilot-owned bar and remaps selections by kind', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const ship = catalog.ships[3];
		const dobbs = ship.pilots.find((pilot) => pilot.id === ship.default_pilot)!;
		const rexler = ship.pilots.find((pilot) => pilot.id === 'rexlerbrath')!;
		expect(pilotSlots(ship, dobbs).map((slot) => slot.kind)).toEqual(['cannon', 'tech']);
		expect(pilotSlots(ship, rexler).map((slot) => slot.kind)).toEqual(['cannon', 'tech']);

		// Give Rexler a genuinely different one-slot bar. The client must
		// render that bar, not the default pilot's two-slot projection.
		const tech = structuredClone(ship.slots[1]);
		tech.index = 0;
		rexler.slots = [tech];
		expect(pilotSlots(ship, rexler).map((slot) => slot.kind)).toEqual(['tech']);

		const row = {
			cannon: 'cannon:jammingbeam',
			tech: 'tech:patternanalyzer'
		};
		const remapped = remapSelectionsForPilot(row, dobbs, rexler);
		expect(remapped).toEqual({ tech: 'tech:patternanalyzer' });
		expect(remapped).not.toHaveProperty('cannon');

		const dropped = remapSelectionsForPilot(
			{ cannon: 'cannon:jammingbeam', tech: 'tech:not-in-this-bar' },
			dobbs,
			rexler
		);
		expect(dropped).toEqual({ tech: null });

		const selected = selectedMultiSelections(
			catalog,
			{ 3: row },
			true,
			{ ...defaultPilotSelections(catalog), 3: 'rexlerbrath' }
		);
		expect(selected[3]).toEqual(['tech:patternanalyzer']);
	});

	it('builds multi-slot defaults and sends pilots plus positional selections', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const defaults = defaultMultiSelections(catalog);
		expect(defaults[0]).toEqual({
			talent: 'talent:predator',
			title: null
		});
		expect(defaults[2]).toEqual({
			sensor: 'sensor:collisiondetector',
			torpedo: null
		});
		const rows = selectedMultiSelections(catalog, defaults, false);
		expect(rows).toHaveLength(6);
		expect(rows[0]).toHaveLength(2);
		expect(rows[0][0]).toBe('talent:predator');
		expect(rows[0][1]).toBeNull();

		const changed = structuredClone(defaults);
		changed[0] = { talent: 'talent:marksmanship', title: null };
		changed[2].torpedo = 'torpedo:protontorpedoes';
		expect(selectedMultiSelections(catalog, changed, false)[0][0]).toBe('talent:marksmanship');
		expect(selectedMultiSelections(catalog, changed, false)[2][0]).toBe(
			'sensor:collisiondetector'
		);
		expect(selectedMultiSelections(catalog, changed, true)[2][1]).toBe(
			'torpedo:protontorpedoes'
		);

		const pilots = { ...defaultPilotSelections(catalog), 3: 'rexlerbrath' };
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(
			11,
			0,
			'standard-50p',
			undefined,
			undefined,
			'card-demo-custom',
			false,
			undefined,
			selectedMultiSelections(catalog, changed, false),
			selectedPilots(catalog, pilots, false)
		);
		const [, init] = fetchMock.mock.calls[0];
		const body = JSON.parse(init.body);
		expect(body.selections).toEqual(selectedMultiSelections(catalog, changed, false));
		expect(body.pilots).toEqual(selectedPilots(catalog, pilots, false));
		expect(body.pilots[3]).toBe('captaindobbs');
		expect(body.loadout).toBeUndefined();
	});

	it('totals pilot points and shows validator-backed legality reasons', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const defaults = defaultMultiSelections(catalog);
		const total = loadoutTotals(catalog, defaults, false);
		expect(total.ships[0]).toMatchObject({
			base: 17,
			fixed: 0,
			selected: 3,
			loadout_spent: 3,
			loadout: 19,
			total: 17
		});
		expect(total.sides.map((side) => side.points)).toEqual([50, 46]);
		expect(total.total).toBe(96);
		expect(total.sides.every((side) => !side.over_cap)).toBe(true);
		expect(total.legal_50).toBe(true);
		expect(total.sides[0].reasons).toEqual([]);

		const over = loadoutTotals(
			catalog,
			defaults,
			false,
			{ ...defaultPilotSelections(catalog), 0: 'herasyndulla-legendsandrelics' }
		);
		expect(over.sides[0].points).toBe(51);
		expect(over.sides[0].over_cap).toBe(true);
		expect(over.sides[0].legal_50).toBe(false);
		expect(over.sides[0].reasons).toContain('card total 51 points (legal 46-50)');

		const heavy = structuredClone(defaults);
		heavy[2].torpedo = 'torpedo:protontorpedoes';
		const overweight = loadoutTotals(catalog, heavy, false);
		expect(overweight.sides[0].legal_50).toBe(false);
		expect(overweight.sides[0].reasons.join(' ')).toContain('21 loadout spent, 9 available');
	});

	it('previews a selected pilot and every selected slot', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const preset: CardPreset = {
			id: 'card-demo-custom',
			label: 'Custom',
			description: 'Six ships.',
			ships: catalog.ships.map((ship) => ({
				player: ship.player,
				pilot: ship.pilot,
				ship: ship.ship,
				cards: []
			}))
		};
		const selections = defaultMultiSelections(catalog);
		selections[0] = { talent: 'talent:marksmanship', title: null };
		selections[2].torpedo = 'torpedo:protontorpedoes';
		const rows = previewMultiShips(
			preset,
			catalog,
			selections,
			false,
			{ ...defaultPilotSelections(catalog), 3: 'rexlerbrath' }
		);
		expect(rows[0].cards.map((card) => card.name)).toEqual(['Marksmanship']);
		expect(rows[2].cards.map((card) => card.name)).toEqual([
			'Collision Detector',
			'Proton Torpedoes'
		]);
		expect(rows[3].pilot).toBe('Rexler Brath');
		expect(rows[3].cards.map((card) => card.name)).toEqual(['Jamming Beam']);
	});

	it('rejects a catalog option with no points or faction metadata', () => {
		const noPoints = structuredClone(catalogResponse()) as {
			ships: { options: { points?: number }[] }[];
		};
		delete noPoints.ships[0].options[0].points;
		expect(() => validateLoadoutCatalog(noPoints)).toThrow(/points/);

		const noFactions = structuredClone(catalogResponse()) as {
			ships: { slots: { options: { factions?: string[] }[] }[] }[];
		};
		delete noFactions.ships[0].slots[0].options[0].factions;
		expect(() => validateLoadoutCatalog(noFactions)).toThrow(/factions/);

		const noPilot = structuredClone(catalogResponse()) as {
			ships: { pilots: { points?: number }[] }[];
		};
		delete noPilot.ships[0].pilots[0].points;
		expect(() => validateLoadoutCatalog(noPilot)).toThrow(/points/);
	});

	it('rejects an option whose slot name does not match its slot', () => {
		const value = structuredClone(catalogResponse()) as {
			ships: { slots: { options: { slot: string }[] }[] }[];
		};
		value.ships[0].slots[0].options[0].slot = 'Weapon';
		expect(() => validateLoadoutCatalog(value)).toThrow(/\.slot/);
	});

	it('sends hotseat: true only when hotseat is selected', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(7, 0, 'standard-50p', undefined, undefined, undefined, true);
		const [, hotseatInit] = fetchMock.mock.calls[0];
		expect(JSON.parse(hotseatInit.body)).toEqual({
			seed: 7,
			human: 0,
			format: 'standard-50p',
			hotseat: true
		});

		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(7, 0, 'standard-50p');
		const [, defaultInit] = fetchMock.mock.calls[1];
		expect(JSON.parse(defaultInit.body)).toEqual({
			seed: 7,
			human: 0,
			format: 'standard-50p'
		});
	});

	it('renders the hotseat badge and the current owner, not "you"', () => {
		const header: Pick<GameHeader, 'hotseat' | 'players'> = {
			hotseat: true,
			players: [
				{ name: 'Rebels', faction: 'rebel', points: 16 },
				{ name: 'Empire', faction: 'empire', points: 11 }
			]
		};
		expect(hotseatSummary(header)).toBe('Hotseat · 2 players · Rebels vs Empire');
		expect(hotseatSummary({ ...header, hotseat: false })).toBeNull();
		expect(decisionOwner({ player: 1 }, true, 'Empire')).toBe('player 2 · Empire');
		expect(decisionOwner({ player: 1 }, false, 'Empire')).toBe('your decision');
	});

	it('validates the preset label and equipped card identities', () => {
		const value = structuredClone(sample()) as unknown as Record<string, unknown>;
		const header = value.header as Record<string, unknown>;
		header.squad = 'card-demo';
		const ships = header.ships as Record<string, unknown>[];
		ships[0].cards = [
			{ xws: 'r4astromech', name: 'R4 Astromech' },
			{ xws: 'predator', name: 'Predator' }
		];
		const validated = validateGameResponse(value);
		expect(validated.header.squad).toBe('card-demo');
		expect(validated.header.ships[0].cards).toEqual([
			{ xws: 'r4astromech', name: 'R4 Astromech' },
			{ xws: 'predator', name: 'Predator' }
		]);

		ships[0].cards = [{ xws: '', name: 'Broken' }];
		expect(() => validateGameResponse(value)).toThrow(/xws/);
	});

	it('answers with the question id and an opaque engine option id', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		await answerQuestion('g1', 12, 'dial:3');
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/games/g1/answers');
		expect(init.method).toBe('POST');
		expect(JSON.parse(init.body)).toEqual({ question: 12, option: 'dial:3' });
	});

	it('reloads with GET, encodes the game id and sends the viewing seat', async () => {
		fetchMock.mockResolvedValueOnce(response(sample()));
		await getGame('g/1');
		expect(fetchMock.mock.calls[0][0]).toBe('/api/games/g%2F1');
		expect(fetchMock.mock.calls[0][1]).toBeUndefined();

		fetchMock.mockResolvedValueOnce(response(sample()));
		await getGame('g/1', 1);
		expect(fetchMock.mock.calls[1][0]).toBe('/api/games/g%2F1?seat=1');
	});

	it('derives the viewing seat for ordinary and hotseat games', () => {
		expect(viewingSeatFor(false, 1, 0, 1)).toBe(0);
		expect(viewingSeatFor(true, 1, 0, 0)).toBe(1);
		expect(viewingSeatFor(true, null, 0, 1)).toBe(1);
	});

	it('keeps a redacted reveal as its public sentence, with no dial marker', async () => {
		const value = structuredClone(sample());
		value.frames[0].events = [{ tone: 'system', text: "P1 looks at P2's dial." }];
		fetchMock.mockResolvedValueOnce(response(value));
		const loaded = await getGame('g1', 1);
		expect(loaded.frames[0].events[0].text).toBe("P1 looks at P2's dial.");
		expect(loaded.frames[0].events[0].text).not.toContain('2 straight');
		expect(loaded.frames[0].ships[0].dial_revealed).toBeUndefined();
		expect(loaded.frames[0].ships[0].dial_revealed_to).toBeUndefined();
	});

	it('treats a stale answer as an ApiError, not as a fallback', async () => {
		fetchMock.mockResolvedValue(response({ error: 'stale question' }, 409, 'Conflict'));
		await expect(answerQuestion('g1', 1, 'dial:0')).rejects.toMatchObject({
			name: 'ApiError',
			status: 409,
			message: 'stale question'
		});
		await expect(answerQuestion('g1', 1, 'dial:0')).rejects.toBeInstanceOf(ApiError);
	});

	it('deletes quietly when the game has already gone', async () => {
		fetchMock.mockResolvedValueOnce(response(undefined, 404, 'Not Found'));
		await expect(deleteGame('g1')).resolves.toBeUndefined();
		fetchMock.mockResolvedValueOnce(response(undefined, 204, 'No Content'));
		await expect(deleteGame('g1')).resolves.toBeUndefined();
	});

	it('builds the replay download url', () => {
		expect(replayUrl('g 1')).toBe('/api/games/g%201/replay');
	});
});

function customShipFrom(catalog: LoadoutCatalog, id: string): CustomShipState {
	const pilot = customPilotById(catalog, id);
	expect(pilot, id).not.toBeNull();
	const slots: Record<string, string | null> = {};
	for (const slot of pilot!.slots) slots[slot.key] = slot.default_option;
	return { pilot: id, slots };
}

describe('dynamic custom lineup', () => {
	it('publishes the pilot browser pool and keeps the default 3/3 sides legal', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		expect(catalog.min_ships).toBe(3);
		expect(catalog.max_ships).toBe(8);
		expect(catalog.pilot_pool.length).toBeGreaterThan(10);
		expect(new Set(catalog.pilot_pool.map((pilot) => pilot.chassis)).size).toBeGreaterThan(3);
		expect(catalog.pilot_pool_report.pool_rows).toBe(catalog.pilot_pool.length);

		const lineup = defaultCustomLineup(catalog);
		expect(lineup[0].map((ship) => ship.pilot)).toEqual([
			'herasyndulla-vcx100lightfreighter',
			'kananjarrus',
			'lothalrebel'
		]);
		expect(lineup[1].map((ship) => ship.pilot)).toEqual([
			'captaindobbs',
			'countessryad',
			'onyxsquadronace'
		]);
		const totals = customLineupTotals(catalog, lineup);
		expect(totals.sides.map((side) => [side.ship_count, side.points, side.legal_50])).toEqual([
			[3, 50, true],
			[3, 46, true]
		]);
		const request = customLineupRequest(catalog, lineup);
		expect(request.side_sizes).toEqual([3, 3]);
		expect(request.pilots).toHaveLength(6);
		expect(request.selections).toHaveLength(6);
		expect(request.selections[0][0]).toBe('talent:predator');
	});
	it('filters the browser deterministically by name, faction, chassis and ranges', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const rebels = filterCustomPilots(catalog.pilot_pool, {
			faction: 'rebelalliance',
			chassis: 'rz1awing'
		});
		expect(rebels.map((pilot) => pilot.id)).toEqual([
			'greensquadronpilot',
			'phoenixsquadronpilot'
		]);
		expect(filterCustomPilots(catalog.pilot_pool, { name: 'KANAN' }).map((pilot) => pilot.id)).toEqual([
			'kananjarrus'
		]);
		const initiative = filterCustomPilots(catalog.pilot_pool, {
			faction: 'galacticempire',
			minInitiative: 3,
			maxInitiative: 3
		});
		expect(initiative.map((pilot) => pilot.id)).toEqual([
			'blacksquadronace',
			'captaindobbs',
			'valenrudor-swz105',
			'yricaquell'
		]);
		const points = filterCustomPilots(catalog.pilot_pool, {
			faction: 'galacticempire',
			minPoints: 6,
			maxPoints: 7
		});
		const reversed = filterCustomPilots([...catalog.pilot_pool].reverse(), {
			faction: 'galacticempire',
			minPoints: 6,
			maxPoints: 7
		});
		expect(reversed.map((pilot) => pilot.id)).toEqual(points.map((pilot) => pilot.id));
		expect(points.map((pilot) => pilot.id).sort()).toEqual(
			['blacksquadronace', 'nightbeast-swz105', 'sienarspecialist', 'valenrudor-swz105', 'wampa', 'yricaquell'].sort()
		);
		expect(filterCustomPilots(catalog.pilot_pool, { name: 'no-such-pilot' })).toEqual([]);
		expect(
			filterCustomPilots(catalog.pilot_pool, { minPoints: 10, maxPoints: 3 })
		).toEqual([]);
	});

	it('filters Epic-only rows by the selected format and labels a huge base', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const rows = validateFormatsResponse(formatResponse()).formats;
		const standard = formatById(rows, 'standard-50p');
		const epic = formatById(rows, 'epic-xwa');
		const house = formatById(rows, 'epic-house');
		expect(standard).not.toBeNull();
		expect(epic).not.toBeNull();
		expect(house).not.toBeNull();
		const huge = customPilotById(catalog, 'alderaanianguard');
		expect(huge?.base).toBe('Huge');
		expect(customPilotFormatReason(huge!, standard!)).toContain('does not allow');
		expect(customPilotFormatReason(huge!, epic!)).toBeNull();
		expect(pilotsForFormat(catalog.pilot_pool, standard)).not.toContain(huge);
		expect(pilotsForFormat(catalog.pilot_pool, epic)).toContain(huge);
		expect(
			filterCustomPilots(catalog.pilot_pool, { name: 'ALDERAAN', format: standard! })
		).toEqual([]);
		expect(
			filterCustomPilots(catalog.pilot_pool, { name: 'ALDERAAN', format: epic! }).map(
				(pilot) => pilot.id
			)
		).toEqual(['alderaanianguard']);
		expect(customPilotShipLabel(huge!)).toContain('Huge base');

		const lineup = defaultCustomLineup(catalog);
		lineup[0] = [
			{ pilot: 'alderaanianguard', slots: {} },
			{ pilot: 'banditsquadronpilot', slots: {} },
			{ pilot: 'phoenixsquadronpilot', slots: {} }
		];
		const standardTotals = customLineupTotals(catalog, lineup, standard!);
		expect(standardTotals.sides[0].reasons.join(' ')).toContain('does not allow');
		const epicTotals = customLineupTotals(catalog, lineup, epic!);
		expect(epicTotals.sides[0].reasons.join(' ')).not.toContain('does not allow');
		const houseTotals = customLineupTotals(catalog, lineup, house!);
		expect(houseTotals.sides[1].reasons.join(' ')).toContain('requires at least 1');
	});

	it('applies a conferred slot and hides a removed slot', () => {
		const option = (
			id: string,
			slot: string,
			extra: Partial<{
				also_occupies: string[];
				unequips: string[];
				confers_addons: string[];
			}> = {}
		) => ({
			id,
			xws: id.split(':')[1],
			name: id.split(':')[1],
			slot,
			points: 0,
			factions: ['Rebel Alliance'],
			unique: false,
			limited: 0,
			also_occupies: [],
			unequips: [],
			confers_addons: [],
			...extra
		});
		const slot = (
			index: number,
			key: string,
			name: string,
			kind: string,
			conditional: boolean,
			options: ReturnType<typeof option>[]
		) => ({
			index,
			key,
			slot: name,
			kind,
			fixed: false,
			fixed_card: null,
			default_option: null,
			options,
			conditional
		});
		const title = option('title:rewrite', 'Title', {
			unequips: ['crew'],
			confers_addons: ['astromech']
		});
		const crew = option('crew:crew', 'Crew');
		const astromech = option('astromech:r2', 'Astromech');
		const pilot = {
			name: 'Rewriter',
			slots: [
				slot(0, 'title', 'Title', 'title', false, [title]),
				slot(1, 'crew', 'Crew', 'crew', false, [crew]),
				slot(2, 'astromech', 'Astromech', 'astromech', true, [astromech])
			]
		};
		const before = customSlotPlan(pilot, {});
		expect(before.slots.find((view) => view.slot.kind === 'astromech')?.visible).toBe(false);
		const after = customSlotPlan(pilot, { title: title.id });
		const crewView = after.slots.find((view) => view.slot.kind === 'crew');
		expect(crewView?.visible).toBe(false);
		expect(crewView?.reason).toContain('removed by rewrite');
		const astromechView = after.slots.find((view) => view.slot.kind === 'astromech');
		expect(astromechView?.visible).toBe(true);
		expect(astromechView?.enabled).toBe(true);
		const filled = customSlotPlan(pilot, { title: title.id, astromech: astromech.id });
		expect(filled.reasons).toEqual([]);
	});

	it('marks an also-occupied slot and reports the overfilled slot', () => {
		const option = (id: string, slot: string, extra: string[] = []) => ({
			id,
			xws: id.split(':')[1],
			name: id.split(':')[1],
			slot,
			points: 0,
			factions: ['Rebel Alliance'],
			unique: false,
			limited: 0,
			also_occupies: extra,
			unequips: [],
			confers_addons: []
		});
		const slot = (
			index: number,
			key: string,
			name: string,
			kind: string,
			options: ReturnType<typeof option>[]
		) => ({
			index,
			key,
			slot: name,
			kind,
			fixed: false,
			fixed_card: null,
			default_option: null,
			options,
			conditional: false
		});
		const command = option('command:ozzel', 'Command', ['crew']);
		const crew = option('crew:crew', 'Crew');
		const pilot = {
			name: 'Rewriter',
			slots: [
				slot(0, 'command', 'Command', 'command', [command]),
				slot(1, 'crew', 'Crew', 'crew', [crew])
			]
		};
		const plan = customSlotPlan(pilot, { command: command.id, crew: crew.id });
		const crewView = plan.slots.find((view) => view.slot.kind === 'crew');
		expect(crewView?.reason).toContain('occupied by ozzel');
		expect(crewView?.enabled).toBe(false);
		expect(plan.reasons.join(' ')).toContain('crew upgrades');

		const catalog = validateLoadoutCatalog(catalogResponse());
		const base = customPilotById(catalog, 'banditsquadronpilot');
		expect(base).not.toBeNull();
		const rewritePilot = {
			...base!,
			id: 'rewriter',
			name: 'Rewriter',
			points: 10,
			loadout: 10,
			slots: pilot.slots
		};
		const testCatalog: LoadoutCatalog = {
			...catalog,
			pilot_pool: [...catalog.pilot_pool, rewritePilot]
		};
		const formats = validateFormatsResponse(formatResponse()).formats;
		const epic = formatById(formats, 'epic-xwa');
		expect(epic).not.toBeNull();
		const lineup = defaultCustomLineup(catalog);
		lineup[0] = [
			{ pilot: 'rewriter', slots: { command: command.id, crew: crew.id } },
			{ pilot: 'banditsquadronpilot', slots: {} },
			{ pilot: 'phoenixsquadronpilot', slots: {} }
		];
		const totals = customLineupTotals(testCatalog, lineup, epic!);
		expect(totals.sides[0].reasons.join(' ')).toContain('crew upgrades');
	});

	it('adds an explicitly browsed pilot without mutating existing ships', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const lineup = defaultCustomLineup(catalog);
		const next = addCustomPilot(catalog, lineup, 1, 'howlrunner');
		expect(next[1]).toHaveLength(4);
		expect(next[1].slice(0, 3)).toEqual(lineup[1]);
		expect(next[1][3].pilot).toBe('howlrunner');
		expect(lineup[1]).toHaveLength(3);
		expect(addCustomPilot(catalog, lineup, 1, 'wedgeantilles')).toBe(lineup);

		const rexler = customPilotById(catalog, 'rexlerbrath');
		expect(rexler).not.toBeNull();
		expect(customPilotLimitReason(catalog, lineup, 1, rexler!)).toBeNull();
		const withRexler = addCustomPilot(catalog, lineup, 1, 'rexlerbrath');
		expect(customPilotLimitReason(catalog, withRexler, 1, rexler!)).toContain('limit is 1');
	});

	it('validates the server pilot-pool report', () => {
		const bad = structuredClone(catalogResponse()) as unknown as Record<string, unknown>;
		const report = bad.pilot_pool_report as Record<string, unknown>;
		report.pool_rows = 3;
		expect(() => validateLoadoutCatalog(bad)).toThrow(/pool_rows/);
		const missing = structuredClone(catalogResponse()) as unknown as Record<string, unknown>;
		delete missing.pilot_pool_report;
		expect(() => validateLoadoutCatalog(missing)).toThrow(/pilot_pool_report/);
	});

	it('adds a fourth ship, keeps existing selections and reaches a legal side', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		let lineup = defaultCustomLineup(catalog);
		lineup = addCustomShip(catalog, lineup, 1);
		expect(lineup[1]).toHaveLength(4);
		expect(lineup[0]).toHaveLength(3);
		// The cheapest available Imperial is the Academy Pilot; the default
		// side is now 51, which is exactly the reason Start must be disabled.
		expect(lineup[1][3].pilot).toBe('academypilot');
		expect(customLineupTotals(catalog, lineup).sides[1].legal_50).toBe(false);
		expect(customLineupTotals(catalog, lineup).sides[1].reasons.join(' ')).toContain(
			'51 points'
		);

		// Keep Dobbs/Ryad, turn Onyx into Howlrunner and the new ship into
		// Mauler: 15+15+8+8 = 46. No older selection is lost.
		lineup = changeCustomPilot(catalog, lineup, 1, 2, 'howlrunner');
		lineup = changeCustomPilot(catalog, lineup, 1, 3, 'maulermithel');
		const totals = customLineupTotals(catalog, lineup);
		expect(totals.sides[1].ship_count).toBe(4);
		expect(totals.sides[1].points).toBe(46);
		expect(totals.sides[1].legal_50).toBe(true);
		expect(lineup[1][0].slots.cannon).toBe('cannon:jammingbeam');
	});

	it('reaches a legal eight-ship Imperial side and keeps both sides legal in the request', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const lineup: CustomLineup = [defaultCustomLineup(catalog)[0], []];
		for (const id of [
			'academypilot',
			'obsidiansquadronpilot',
			'blacksquadronace',
			'wampa',
			'nightbeast-swz105',
			'sienarspecialist',
			'yricaquell',
			'valenrudor-swz105'
		]) {
			lineup[1].push(customShipFrom(catalog, id));
		}
		const totals = customLineupTotals(catalog, lineup);
		expect(totals.sides[1].ship_count).toBe(8);
		expect(totals.sides[1].points).toBe(50);
		expect(totals.sides[1].legal_50).toBe(true);
		expect(totals.sides[0].legal_50).toBe(true);
		expect(customLineupRequest(catalog, lineup).side_sizes).toEqual([3, 8]);
	});

	it('shows precise reasons for 2/9 ships, mixed factions and duplicate unique pilots', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const defaults = defaultCustomLineup(catalog);

		const two: CustomLineup = [[...defaults[0]], defaults[1].slice(0, 2)];
		expect(customLineupTotals(catalog, two).sides[1].reasons.join(' ')).toContain(
			'2 ships (legal 3-8)'
		);

		const nine: CustomLineup = [defaults[0], []];
		for (const id of [
			'captaindobbs',
			'countessryad',
			'onyxsquadronace',
			'rexlerbrath',
			'academypilot',
			'obsidiansquadronpilot',
			'blacksquadronace',
			'wampa',
			'sienarspecialist'
		]) {
			nine[1].push(customShipFrom(catalog, id));
		}
		expect(customLineupTotals(catalog, nine).sides[1].reasons.join(' ')).toContain(
			'9 ships (legal 3-8)'
		);

		const mixed: CustomLineup = [
			[...defaults[0], customShipFrom(catalog, 'captaindobbs')],
			defaults[1]
		];
		expect(customLineupTotals(catalog, mixed).sides[0].reasons.join(' ')).toContain(
			'mixed factions'
		);

		const duplicate: CustomLineup = [defaults[0], []];
		for (const id of ['rexlerbrath', 'rexlerbrath', 'onyxsquadronace']) {
			duplicate[1].push(customShipFrom(catalog, id));
		}
		expect(customLineupTotals(catalog, duplicate).sides[1].reasons.join(' ')).toContain(
			'limited pilot Rexler Brath selected 2 times; limit is 1'
		);

		const under: CustomLineup = [
			[defaults[0][0], customShipFrom(catalog, 'banditsquadronpilot'), customShipFrom(catalog, 'graysquadronbomber')],
			defaults[1]
		];
		expect(customLineupTotals(catalog, under).sides[0].reasons.join(' ')).toContain(
			'card total'
		);
	});

	it('does not remove below three ships and remaps compatible pilot slots', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		let lineup = defaultCustomLineup(catalog);
		lineup = removeCustomShip(catalog, lineup, 0, 0);
		expect(lineup[0]).toHaveLength(3);
		lineup = removeCustomShip(catalog, lineup, 0, 2);
		expect(lineup[0]).toHaveLength(3);
		const twoShips: CustomLineup = [lineup[0].slice(0, 2), lineup[1]];
		expect(customLineupTotals(catalog, twoShips).sides[0].reasons.join(' ')).toContain(
			'2 ships (legal 3-8)'
		);

		lineup = defaultCustomLineup(catalog);
		lineup = changeCustomPilot(
			catalog,
			lineup,
			0,
			0,
			'herasyndulla-legendsandrelics'
		);
		expect(lineup[0][0].pilot).toBe('herasyndulla-legendsandrelics');
		expect(lineup[0][0].slots.talent).toBe('talent:predator');

		lineup = setCustomSlot(lineup, 0, 0, 'talent', 'talent:marksmanship');
		expect(lineup[0][0].slots.talent).toBe('talent:marksmanship');
		expect(previewCustomShips(catalog, lineup)[0].cards.map((card) => card.xws)).toContain(
			'marksmanship'
		);
	});

	it('rejects a catalog without the curated pool', () => {
		const catalog = catalogResponse() as unknown as Record<string, unknown>;
		delete catalog.pilot_pool;
		expect(() => validateLoadoutCatalog(catalog)).toThrow(/pilot_pool/);
	});
});

function cloneList(document: ListDocument): ListDocument {
	return JSON.parse(JSON.stringify(document)) as ListDocument;
}

function listJson(document: ListDocument): string {
	return JSON.stringify(document);
}

function memoryStorage(): SquadStorage {
	const values = new Map<string, string>();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => {
			values.set(key, value);
		},
		removeItem: (key) => {
			values.delete(key);
		}
	};
}

describe('list import/export', () => {
	it('round-trips a list through a share URL fragment', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		const url = shareListUrl(document, 'https://wing.example/play?format=standard-50p#old');
		expect(url).toContain('https://wing.example/play?format=standard-50p#list=');
		const text = sharedListText(new URL(url).hash);
		expect(text).not.toBeNull();
		expect(JSON.parse(text!)).toMatchObject({
			schema: LIST_SCHEMA,
			format: LIST_FORMAT,
			side_sizes: document.side_sizes,
			pilots: document.pilots
		});
		expect(encodeListShare(document)).toBe(new URL(url).hash.slice('#list='.length));
		expect(sharedListText('#other=1')).toBeNull();
		expect(() => sharedListText('#list=%E0%A4%A')).toThrow(/malformed/);
	});

	it('round-trips an unmodified export through import and the create request', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const before = defaultCustomLineup(catalog);
		const document = exportListDocument(catalog, before);
		expect(document.schema).toBe(LIST_SCHEMA);
		expect(document.format).toBe(LIST_FORMAT);
		expect(document.side_sizes).toEqual([3, 3]);
		expect(document.pilots).toHaveLength(6);
		expect(document.selections).toEqual(customLineupSelections(catalog, before));
		expect(document.totals).toEqual({
			points: [50, 46],
			factions: ['Rebel Alliance', 'Galactic Empire']
		});
		expect(Object.keys(document).sort()).toEqual([
			'format',
			'pilots',
			'schema',
			'selections',
			'side_sizes',
			'squad',
			'totals'
		]);
		expect(serializeListDocument(document)).not.toMatch(/frames|state_hash|question|replay/i);

		const text = serializeListDocument(document);
		const imported = importList(catalog, text);
		expect(imported.document).toEqual(document);
		expect(imported.lineup).toEqual(before);
		expect(imported.document.selections).toEqual(customLineupSelections(catalog, before));

		const form = customLineupRequest(catalog, before);
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(
			7,
			0,
			LIST_FORMAT,
			undefined,
			undefined,
			'card-demo-custom',
			false,
			undefined,
			form.selections,
			form.pilots,
			form.side_sizes
		);
		const formBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));

		const request = listGameRequest(importListDocument(catalog, text));
		fetchMock.mockResolvedValueOnce(response(sample()));
		await createGame(
			7,
			0,
			request.format,
			undefined,
			undefined,
			request.squad,
			false,
			undefined,
			request.selections,
			request.pilots,
			request.side_sizes
		);
		const importBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(importBody).toEqual(formBody);
		expect(importBody).toMatchObject({
			seed: 7,
			human: 0,
			format: 'standard-50p',
			squad: 'card-demo-custom',
			side_sizes: [3, 3]
		});
	});

	it('rejects malformed JSON, unknown schema/format and wrong array lengths', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		expect(() => importList(catalog, '{not json')).toThrow(/malformed JSON/);
		expect(() => importList(catalog, '   ')).toThrow(/empty/);

		const schema = cloneList(document);
		schema.schema = 'wing-engine/list@2' as typeof LIST_SCHEMA;
		expect(() => importList(catalog, listJson(schema))).toThrow(/unsupported schema/);

		const format = cloneList(document);
		format.format = 'epic-xwa' as typeof LIST_FORMAT;
		expect(() => importList(catalog, listJson(format))).toThrow(/unsupported format/);

		const squad = cloneList(document);
		squad.squad = 'card-demo';
		expect(() => importList(catalog, listJson(squad))).toThrow(/unsupported squad/);

		const sizes = cloneList(document);
		sizes.side_sizes = [3] as unknown as [number, number];
		expect(() => importList(catalog, listJson(sizes))).toThrow(/side_sizes/);

		const pilots = cloneList(document);
		pilots.pilots.pop();
		expect(() => importList(catalog, listJson(pilots))).toThrow(
			/pilots has 5 entries but side_sizes asks for 6/
		);

		const rows = cloneList(document);
		rows.selections.pop();
		expect(() => importList(catalog, listJson(rows))).toThrow(
			/selections has 5 rows but side_sizes asks for 6/
		);

		const rowLength = cloneList(document);
		rowLength.selections[2] = [...rowLength.selections[2], null];
		expect(() => importList(catalog, listJson(rowLength))).toThrow(
			/selections\[2\].*Lothal Rebel needs 2 in printed bar order/
		);
	});

	it('rejects a limited upgrade selected twice on one side', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		for (const ship of catalog.ships) {
			for (const slot of ship.slots) {
				for (const option of slot.options) {
					if (option.xws === 'jammingbeam') {
						option.limited = 1;
						option.unique = true;
					}
				}
			}
		}
		const lineup = defaultCustomLineup(catalog);
		expect(
			customLineupTotals(catalog, lineup).sides[1].reasons.join(' ')
		).toContain('limited card Jamming Beam selected 3 times; limit is 1');

		const document = exportListDocument(catalog, lineup);
		expect(() => importList(catalog, listJson(document))).toThrow(
			/limited card Jamming Beam selected 2 times on player 2; limit is 1/
		);
	});

	it('rejects two copies of one upgrade on a ship', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const ryad = catalog.pilot_pool.find((pilot) => pilot.id === 'countessryad');
		if (!ryad) throw new Error('fixture is missing Countess Ryad');
		ryad.slots.push({
			...ryad.slots[0],
			index: ryad.slots.length,
			key: 'cannon_extra'
		});
		const lineup = defaultCustomLineup(catalog);
		lineup[1][1].slots.cannon_extra = 'cannon:jammingbeam';
		expect(
			customLineupTotals(catalog, lineup).sides[1].reasons.join(' ')
		).toContain(
			'Countess Ryad already has card Jamming Beam; a ship cannot equip two copies'
		);

		const document = exportListDocument(catalog, lineup);
		expect(() => importList(catalog, listJson(document))).toThrow(
			/already has card Jamming Beam; a ship cannot equip two copies/
		);
	});

	it('rejects unknown rows, unknown options, duplicate limited and mixed factions', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));

		const unknownPilot = cloneList(document);
		unknownPilot.pilots[0] = 'not-a-pilot';
		expect(() => importList(catalog, listJson(unknownPilot))).toThrow(
			/pilots\[0\].*unknown pilot id "not-a-pilot"/
		);

		const unknownOption = cloneList(document);
		unknownOption.selections[0][0] = 'talent:not-real';
		expect(() => importList(catalog, listJson(unknownOption))).toThrow(
			/selections\[0\]\[0\].*unknown option id "talent:not-real"/
		);

		const duplicate = cloneList(document);
		duplicate.pilots[1] = 'herasyndulla-legendsandrelics';
		expect(() => importList(catalog, listJson(duplicate))).toThrow(
			/limited pilot Hera Syndulla selected 2 times on player 1; limit is 1/
		);

		const mixed = cloneList(document);
		mixed.pilots[1] = 'captaindobbs';
		expect(() => importList(catalog, listJson(mixed))).toThrow(
			/Galactic Empire cannot join player 1's Rebel Alliance side/
		);
	});

	it('rejects out-of-range counts, point totals and per-ship loadout', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));

		const tooFew = cloneList(document);
		tooFew.side_sizes = [2, 3];
		expect(() => importList(catalog, listJson(tooFew))).toThrow(
			/side_sizes\[0\] is 2; each side needs 3-8 ships/
		);

		const tooMany = cloneList(document);
		tooMany.side_sizes = [9, 3];
		expect(() => importList(catalog, listJson(tooMany))).toThrow(
			/side_sizes\[0\] is 9; each side needs 3-8 ships/
		);

		const overPoints = cloneList(document);
		overPoints.side_sizes = [4, 3];
		overPoints.pilots.splice(3, 0, 'greensquadronpilot');
		overPoints.selections.splice(3, 0, []);
		expect(() => importList(catalog, listJson(overPoints))).toThrow(
			/player 1: 58 pilot points; 50P Standard requires 46-50/
		);

		const overLoadout = cloneList(document);
		overLoadout.selections[2][1] = 'torpedo:protontorpedoes';
		expect(() => importList(catalog, listJson(overLoadout))).toThrow(
			/pilots\[2\].*21 loadout spent, 9 available on Lothal Rebel/
		);
	});

	it('keeps the default 3/3 50/46 sides and does not mutate them on export/import', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const before = defaultCustomLineup(catalog);
		const snapshot = JSON.stringify(before);
		const totals = customLineupTotals(catalog, before);
		expect(totals.sides.map((side) => side.points)).toEqual([50, 46]);
		expect(totals.sides.map((side) => side.ship_count)).toEqual([3, 3]);
		expect(totals.legal_50).toBe(true);

		const document = exportListDocument(catalog, before);
		expect(JSON.stringify(before)).toBe(snapshot);
		const text = serializeListDocument(document);
		const imported = importList(catalog, text);
		expect(imported.lineup).toEqual(before);
		expect(JSON.stringify(before)).toBe(snapshot);
		expect(() => importList(catalog, '{bad import')).toThrow(/malformed JSON/);
		expect(JSON.stringify(before)).toBe(snapshot);
		expect(customLineupTotals(catalog, before).sides.map((side) => side.points)).toEqual([
			50, 46
		]);
		expect(validateListDocument(catalog, document).side_sizes).toEqual([3, 3]);
	});
});

describe('saved squads', () => {
	it('saves, lists, replaces and loads a named squad from browser storage', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const storage = memoryStorage();
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		const saved = saveSquad(storage, '  My 3v3  ', document, '2026-11-02T00:00:00Z');
		expect(saved.saved?.name).toBe('My 3v3');
		expect(saved.error).toBeNull();
		expect(saved.squads).toHaveLength(1);
		expect(saved.saved?.schema).toBe(SAVED_SQUADS_SCHEMA);
		expect(saved.saved?.list).toEqual(document);

		const loaded = loadSavedSquads(storage);
		expect(loaded.error).toBeNull();
		expect(loaded.squads).toHaveLength(1);
		const imported = importList(catalog, JSON.stringify(loaded.squads[0].list));
		expect(imported.lineup).toEqual(defaultCustomLineup(catalog));

		const replaced = saveSquad(storage, 'my 3v3', document, '2026-11-02T01:00:00Z');
		expect(replaced.squads).toHaveLength(1);
		expect(replaced.saved?.name).toBe('my 3v3');
		expect(replaced.saved?.saved_at).toBe('2026-11-02T01:00:00Z');
	});

	it('bounds the saved list and reports a full store without dropping entries', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const storage = memoryStorage();
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		for (let index = 0; index < SAVED_SQUAD_LIMIT; index += 1) {
			const result = saveSquad(storage, `squad ${index}`, document);
			expect(result.error).toBeNull();
		}
		const full = saveSquad(storage, 'one too many', document);
		expect(full.saved).toBeNull();
		expect(full.error).toMatch(/full \(10\)/);
		expect(full.squads).toHaveLength(SAVED_SQUAD_LIMIT);
		const loaded = loadSavedSquads(storage);
		expect(loaded.squads).toHaveLength(SAVED_SQUAD_LIMIT);
		expect(loaded.error).toBeNull();

		const deleted = deleteSavedSquad(storage, 'squad 4');
		expect(deleted.error).toBeNull();
		expect(deleted.squads).toHaveLength(SAVED_SQUAD_LIMIT - 1);
		expect(deleted.squads.some((squad) => squad.name === 'squad 4')).toBe(false);
		const refilled = saveSquad(storage, 'replacement', document);
		expect(refilled.saved).not.toBeNull();
		expect(refilled.squads).toHaveLength(SAVED_SQUAD_LIMIT);
	});

	it('degrades on unavailable or corrupt storage and recovers after a bad import', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		expect(loadSavedSquads(null).error).toMatch(/storage is unavailable/);

		const storage = memoryStorage();
		storage.setItem(SAVED_SQUADS_KEY, '{not json');
		const corrupt = loadSavedSquads(storage);
		expect(corrupt.squads).toEqual([]);
		expect(corrupt.error).toMatch(/corrupt/);

		storage.setItem(
			SAVED_SQUADS_KEY,
			JSON.stringify({ schema: 'wing-engine/saved-squads@0', squads: [] })
		);
		expect(loadSavedSquads(storage).error).toMatch(/corrupt/);

		const recovered = saveSquad(storage, 'recovered', document);
		expect(recovered.error).toBeNull();
		expect(recovered.saved?.name).toBe('recovered');
		expect(loadSavedSquads(storage).squads).toHaveLength(1);

		expect(() => importList(catalog, '{bad import')).toThrow(/malformed JSON/);
		const intact = loadSavedSquads(storage).squads[0];
		expect(intact.name).toBe('recovered');
		expect(importList(catalog, JSON.stringify(intact.list)).lineup).toEqual(
			defaultCustomLineup(catalog)
		);

		const blocked = {
			getItem: () => null,
			setItem: () => {
				throw new Error('quota exceeded');
			},
			removeItem: () => undefined
		};
		expect(saveSquad(blocked, 'blocked', document).error).toMatch(/could not save/);
	});
});

describe('published squads', () => {
	const id = '0123456789abcdef';
	const base = 'https://wing.example/play?format=standard-50p';

	it('round-trips a squad id through the share URL fragment', () => {
		expect(isSquadShareId(id)).toBe(true);
		expect(isSquadShareId('0123456789ABCDEF')).toBe(false);
		expect(squadShareUrl(id, `${base}#old`)).toBe(`${base}#squad=${id}`);
		expect(sharedSquadId(`#squad=${id}`)).toBe(id);
		expect(sharedSquadId('squad=0123456789abcdef')).toBe(id);
		expect(sharedSquadId('#list=abc')).toBeNull();
		expect(sharedSquadId('#other=1')).toBeNull();
		expect(() => squadShareUrl('nope', base)).toThrow(/invalid squad id/);
		expect(() => sharedSquadId('#squad=0123456789ABCDEF')).toThrow(/malformed/);
		expect(() => sharedSquadId('#squad=%E0%A4%A')).toThrow(/malformed/);
	});

	it('publishes the exact list document and returns the server id', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		fetchMock.mockResolvedValueOnce(response({ id, schema: LIST_SCHEMA }, 201, 'Created'));

		await expect(publishSquad(document)).resolves.toBe(id);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/squads');
		expect(init.method).toBe('POST');
		expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(JSON.parse(String(init.body))).toEqual(document);

		fetchMock.mockResolvedValueOnce(response({ id: 'not-an-id' }, 201, 'Created'));
		await expect(publishSquad(document)).rejects.toThrow(/invalid squad id from the server/);
	});

	it('deletes a published squad and reports an expired or unknown capability', async () => {
		fetchMock.mockResolvedValueOnce(response(undefined, 204, 'No Content'));
		await expect(deletePublishedSquad(id)).resolves.toBeUndefined();
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/squads/${id}`);
		expect(fetchMock.mock.calls[0][1]).toEqual({ method: 'DELETE' });

		fetchMock.mockResolvedValueOnce(
			response({ error: 'no squad stored under "fedcba9876543210"' }, 404, 'Not Found')
		);
		const error = await deletePublishedSquad('fedcba9876543210').catch((caught) => caught);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(404);
		expect((error as ApiError).message).toMatch(/no squad stored/);

		fetchMock.mockClear();
		await expect(deletePublishedSquad('not-an-id')).rejects.toThrow(/invalid squad id/);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('fetches a published squad through the same import validator', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		fetchMock.mockResolvedValueOnce(response(document));

		const imported = await importSharedSquad(catalog, id);
		expect(imported.document).toEqual(document);
		expect(imported.lineup).toEqual(defaultCustomLineup(catalog));
		expect(fetchMock.mock.calls[0][0]).toBe(`/api/squads/${id}`);
		expect(fetchMock.mock.calls[0][1]).toBeUndefined();
	});

	it('rejects a stored document the import path would reject', async () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const document = exportListDocument(catalog, defaultCustomLineup(catalog));
		const tampered = structuredClone(document) as ListDocument;
		tampered.pilots[0] = 'not-a-pilot';
		fetchMock.mockResolvedValueOnce(response(tampered));

		await expect(importSharedSquad(catalog, id)).rejects.toThrow(/unknown pilot id/);

		fetchMock.mockResolvedValueOnce(response({ error: 'no squad stored' }, 404, 'Not Found'));
		await expect(importSharedSquad(catalog, 'fedcba9876543210')).rejects.toThrow(
			/no squad stored/
		);

		fetchMock.mockClear();
		await expect(importSharedSquad(catalog, 'not-an-id')).rejects.toThrow(/invalid squad id/);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('format-aware builder', () => {
	const formats = () => validateFormatsResponse(formatResponse()).formats;

	it('fetches the committed format metadata and its capability flags', async () => {
		fetchMock.mockResolvedValueOnce(response(formatResponse()));
		const rows = await getFormats();
		expect(fetchMock.mock.calls[0][0]).toBe('/api/formats');
		expect(rows.map((row) => row.spec.id)).toEqual([
			'standard-50p',
			'aces-high',
			'epic-xwa',
			'epic-house'
		]);

		const aces = formatById(rows, 'aces-high');
		expect(aces?.listbuilding.ships_min).toBe(1);
		expect(aces?.listbuilding.ships_max).toBe(1);
		expect(aces?.listbuilding.points_max).toBe(16);
		expect(aces?.listbuilding.special_caps).toEqual([
			{ kind: 'pilot_points_max', value: 16, applies_to: 'each_ship' }
		]);
		expect(aces?.custom_lineup_playable).toBe(false);
		expect(formatById(rows, 'standard-50p')?.custom_lineup_playable).toBe(true);
		expect(formatById(rows, 'epic-xwa')?.custom_lineup_playable).toBe(true);
		expect(formatById(rows, 'epic-house')?.custom_lineup_playable).toBe(true);
		expect(formatById(rows, 'epic-xwa')?.custom_lineup_note).toBeNull();
		expect(formatById(rows, 'epic-house')?.custom_lineup_note).toBeNull();
		expect(formatById(rows, 'epic-xwa')?.listbuilding.huge_ships_allowed).toBe(true);
		expect(formatById(rows, 'epic-house')?.listbuilding.huge_ships_min).toBe(1);
		expect(formatById(rows, 'missing')).toBeNull();
	});

	it('rejects malformed format metadata instead of trusting it', () => {
		const broken = formatResponse();
		broken.formats[1].spec.min_ships = 3;
		expect(() => validateFormatsResponse(broken)).toThrow(
			/formats\[1\]\.spec\.min_ships.*ships_min/
		);
		const brokenCap = formatResponse();
		brokenCap.formats[0].spec.max_squad_points = 60;
		expect(() => validateFormatsResponse(brokenCap)).toThrow(
			/formats\[0\]\.spec\.max_squad_points.*points_max/
		);
	});

	it('fits a lineup to the selected format ship bounds', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const aces = formatById(formats(), 'aces-high')!;
		const fitted = defaultCustomLineupFor(catalog, aces);
		expect(fitted[0]).toHaveLength(1);
		expect(fitted[1]).toHaveLength(1);

		const standard = defaultCustomLineup(catalog);
		const squeezed = fitCustomLineup(
			catalog,
			standard,
			formatById(formats(), 'standard-50p')!
		);
		expect(squeezed).toEqual(standard);
	});

	it('validates the same lineup against each format and names the violation', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const standard = formatById(formats(), 'standard-50p')!;
		const aces = formatById(formats(), 'aces-high')!;
		const epic = formatById(formats(), 'epic-xwa')!;
		const defaultLineup = defaultCustomLineup(catalog);

		expect(customLineupTotals(catalog, defaultLineup, standard).legal_50).toBe(true);
		expect(customLineupTotals(catalog, defaultLineup, epic).legal_50).toBe(true);

		const acesLineup: CustomLineup = [defaultLineup[0].slice(0, 1), defaultLineup[1].slice(0, 1)];
		const acesTotals = customLineupTotals(catalog, acesLineup, aces);
		expect(acesTotals.sides[0].point_cap).toBe(16);
		expect(acesTotals.sides[0].reasons.join(' ')).toMatch(/caps each pilot at 16/);

		const twoShips: CustomLineup = [
			[...acesLineup[0], defaultLineup[0][1]],
			acesLineup[1]
		];
		expect(
			customLineupTotals(catalog, twoShips, aces).sides[0].reasons.join(' ')
		).toContain('2 ships (legal 1-1)');

		// A low-point side is illegal Standard but legal Epic: the floor and
		// cap come from the selected format, not a shared constant.
		const cheap: CustomLineup = [
			[
				customShipFrom(catalog, 'banditsquadronpilot'),
				customShipFrom(catalog, 'graysquadronbomber'),
				customShipFrom(catalog, 'greensquadronpilot')
			],
			defaultLineup[1]
		];
		expect(customLineupTotals(catalog, cheap, standard).sides[0].reasons.join(' ')).toContain(
			'card total'
		);
		expect(customLineupTotals(catalog, cheap, epic).sides[0].legal_50).toBe(true);

		// Without format metadata the catalogue's committed Standard bounds
		// are the fallback, not an invented constant.
		expect(customLineupTotals(catalog, cheap).sides[0].legal_50).toBe(false);
		expect(customLineupTotals(catalog, cheap).sides[0].point_cap).toBe(
			standardFormatFromCatalog(catalog).listbuilding.points_max
		);
	});

	it('round-trips the format through export, import and the game request', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const rows = formats();
		const aces = formatById(rows, 'aces-high')!;
		const lineup: CustomLineup = [
			[customShipFrom(catalog, 'banditsquadronpilot')],
			[customShipFrom(catalog, 'graysquadronbomber')]
		];
		const document = exportListDocument(catalog, lineup, aces);
		expect(document.format).toBe('aces-high');

		const text = serializeListDocument(document);
		const imported = importList(catalog, text, rows);
		expect(imported.document.format).toBe('aces-high');
		expect(imported.lineup).toEqual(lineup);
		expect(listGameRequest(imported.document).format).toBe('aces-high');

		// A document written before the format field existed is Standard.
		const standardDoc = exportListDocument(catalog, defaultCustomLineup(catalog));
		const raw = JSON.parse(serializeListDocument(standardDoc));
		delete raw.format;
		const old = importList(catalog, JSON.stringify(raw), rows);
		expect(old.document.format).toBe('standard-50p');
	});

	it('rejects a document whose ship count is not the selected format', () => {
		const catalog = validateLoadoutCatalog(catalogResponse());
		const rows = formats();
		const standard = exportListDocument(catalog, defaultCustomLineup(catalog));
		const asAces = { ...standard, format: 'aces-high' };
		expect(() => importList(catalog, JSON.stringify(asAces), rows)).toThrow(
			/side_sizes\[0\] is 3; each side needs 1-1 ships/
		);
		expect(() =>
			importList(catalog, JSON.stringify({ ...standard, format: 'not-a-format' }), rows)
		).toThrow(/unsupported format/);
	});
});
