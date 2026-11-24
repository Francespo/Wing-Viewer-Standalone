<script lang="ts">
	import { onMount } from 'svelte';
	import CardPresetPreview from '$lib/components/CardPresetPreview.svelte';
	import GameScreen from '$lib/components/GameScreen.svelte';
	import PilotBrowser from '$lib/components/PilotBrowser.svelte';
	import PromptPanel from '$lib/components/PromptPanel.svelte';
	import SquadsPanel from '$lib/components/SquadsPanel.svelte';
	import ImportLink from '$lib/components/ImportLink.svelte';
	import TourOverlay from '$lib/components/TourOverlay.svelte';
	import {
		ApiError,
		DEFAULT_FORMAT,
		DEFAULT_SEED,
		PLAY_FORMATS,
		addCustomPilot,
		addCustomShip,
		answerQuestion,
		browserSquadStorage,
		changeCustomPilot,
		createGame,
		customLineupRequest,
		customLineupTotals,
		customPilotById,
		customPilotChoices,
		customPilotFormatReason,
		customPilotLimitReason,
		customPilotShipLabel,
		customSlotPlan,
		defaultCustomLineup,
		defaultMultiSelections,
		defaultPilotSelections,
		deleteGame,
		deletePublishedSquad,
		deleteSavedSquad,
		exportListDocument,
		formatById,
		getFormats,
		getGame,
		getLoadoutCatalog,
		getSquads,
		hotseatSummary,
		importList,
		importSharedSquad,
		LIST_FORMAT,
		LIST_SCHEMA,
		loadSavedSquads,
		loadoutTotals,
		fitCustomLineup,
		pilotsForFormat,
		previewCustomShips,
		publishSquad,
		removeCustomShip,
		replayUrl,
		undoGame,
		saveSquad as saveListSquad,
		sharedListText,
		sharedSquadId,
		shareListUrl,
		squadShareUrl,
		SAVED_SQUAD_LIMIT,
		SAVED_SQUAD_NAME_LIMIT,
		serializeListDocument,
		setCustomSlot,
		viewingSeatFor,
		type CardPreset,
		type CustomLineup,
		type CustomPilot,
		type FormatInfo,
		type GameResponse,
		type ListDocument,
		type LoadoutCatalog,
		type PilotSelections,
		type SavedSquad,
		type SlotSelections
	} from '$lib/live';
	import { describeImportStatus, formatXwsPreview, parseXwsPreview } from '$lib/xws-preview';
	import { addHistory, saveSquad, SQUAD_STORE_KEYS, type SquadRecord } from '$lib/squad-store';
	import { optionalChoices } from '$lib/optional-fast';
	import { autoSkipOptionalId } from '$lib/optional-auto';
	import { tourStepFor } from '$lib/tour';
	import { scenarioDescription } from '$lib/scenario-info';

	let game = $state<GameResponse | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);
	let polling = false;
	let presets = $state<CardPreset[]>([]);
	let presetsError = $state<string | null>(null);
	let formats = $state<FormatInfo[]>([]);
	let formatsError = $state<string | null>(null);
	let loadoutCatalog = $state<LoadoutCatalog | null>(null);
	let catalogError = $state<string | null>(null);
	let setupOpen = $state(false);
	let multiSelections = $state<SlotSelections>({});
	let pilotSelections = $state<PilotSelections>({});
	let customLineup = $state<CustomLineup>([[], []]);
	let browseTargets = $state<[number | null, number | null]>([null, null]);
	let customInitialized = false;
	let squadName = $state('');
	let importText = $state('');
	let listError = $state<string | null>(null);
	let listNotice = $state<string | null>(null);
	let savedSquads = $state<SavedSquad[]>([]);
	let selectedSquad = $state('');
	let savedSquadsError = $state<string | null>(null);
	let pendingSharedList = $state<string | null>(null);
	let pendingPublishedSquad = $state<string | null>(null);
	let shareLink = $state('');
	let squadLink = $state('');
	let publishedSquadId = $state('');
	let deletingPublished = $state(false);
	let publishing = $state(false);
	/** Last hotseat seat that opened a prompt; used between questions. */
	let lastSeat = $state(0);

	const frames = $derived(game?.frames ?? []);
	const index = $derived(Math.max(0, frames.length - 1));
	const question = $derived(game?.question ?? null);
	const result = $derived(game?.result ?? null);
	const board = $derived(game?.header.board ?? null);
	const ships = $derived(game?.header.ships ?? []);
	const players = $derived(game?.header.players ?? []);
	const viewingSeat = $derived(
		viewingSeatFor(
			game?.header.hotseat ?? false,
			question?.player,
			game?.header.human ?? 0,
			lastSeat
		)
	);
	$effect(() => {
		if (game?.header.hotseat && question) lastSeat = question.player;
	});

	/** Board clicks answer the same engine option a button would. */
	const targetOptions = $derived(
		(question?.options ?? []).filter(
			(option) => option.ship !== undefined && option.decline !== true
		)
	);
	// Highlight every target, but only make a ship clickable when exactly one
	// engine option names it. With a special weapon the player must choose the
	// weapon in TargetPicker; a board click must not silently pick one.
	const targets = $derived([...new Set(targetOptions.map((option) => option.ship!))]);
	const selectable = $derived(
		targets.filter(
			(ship) => targetOptions.filter((option) => option.ship === ship).length === 1
		)
	);

	function message(err: unknown): string {
		if (err instanceof ApiError) return err.message;
		return err instanceof Error ? err.message : String(err);
	}

	async function loadPresets() {
		try {
			presets = await getSquads();
			presetsError = null;
		} catch (err) {
			presetsError = message(err);
		}
		try {
			loadoutCatalog = await getLoadoutCatalog();
			catalogError = null;
		} catch (err) {
			catalogError = message(err);
		}
		try {
			formats = await getFormats();
			formatsError = null;
		} catch (err) {
			formatsError = message(err);
		}
	}

	function setUrl(id: string) {
		if (typeof window === 'undefined') return;
		const url = new URL(window.location.href);
		url.searchParams.set('id', id);
		if (game?.header.hotseat) url.searchParams.set('mode', 'hotseat');
		else url.searchParams.delete('mode');
		window.history.replaceState(window.history.state, '', url);
	}

	function append(previous: GameResponse, next: GameResponse): GameResponse {
		// POST /answers returns only new frames; a reload or a retry can overlap.
		// Deduplicate by frame number so the timeline stays monotonic.
		const seen = new Set(previous.frames.map((frame) => frame.n));
		const fresh = next.frames.filter((frame) => !seen.has(frame.n));
		return { ...next, frames: [...previous.frames, ...fresh] };
	}

	async function reload(id: string) {
		try {
			// Before the first response we do not know the header's human seat.
			// Ask with the best local guess, then refetch once if the header or
			// hotseat question names a different active seat.
			const requestedSeat = viewingSeat;
			game = await getGame(id, requestedSeat);
			const activeSeat = game.header.hotseat
				? game.question?.player ?? lastSeat
				: game.header.human;
			if (activeSeat !== requestedSeat) {
				if (game.header.hotseat && game.question) lastSeat = game.question.player;
				game = await getGame(id, activeSeat);
			}
			setUrl(game.id);
			error = null;
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				// The worker was reaped or the server restarted. Start clean
				// rather than leaving a dead id in the URL.
				game = null;
				error = 'that game is no longer on the server; starting a new one';
				await start();
			} else {
				error = message(err);
			}
		}
	}

	let seedOverride = $state(DEFAULT_SEED);
	let formatChoice = $state<string>(DEFAULT_FORMAT);
	let scenarioChoice = $state('none');
	let playerCount = $state(4);
	let bothSides = $state(false);
	/** Last question whose hand-off curtain was acknowledged (presentation only). */
	let revealedQuestionId = $state<number | null>(null);
	let xwsText = $state('');
	let xws2Text = $state('');
	// Viewer-only squad library: link imports + saved squads (no rules in TS).
	let xwsUrl = $state('');
	let xws2Url = $state('');
	let squadsOpen = $state(false);

	// "Skip all optional" (D-174 #18): viewer preference stored beside the
	// squad settings. The engine still owns every option id and every rule.
	function readSkipAll(): boolean {
		if (typeof localStorage === 'undefined') return false;
		try {
			return JSON.parse(localStorage.getItem(SQUAD_STORE_KEYS.settings) ?? '{}').skipAllOptional === true;
		} catch {
			return false;
		}
	}
	function writeSkipAll(value: boolean) {
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = JSON.parse(localStorage.getItem(SQUAD_STORE_KEYS.settings) ?? '{}');
			localStorage.setItem(SQUAD_STORE_KEYS.settings, JSON.stringify({ ...raw, skipAllOptional: value }));
		} catch {
			// disabled or full storage: the viewer works, just not durably.
		}
	}
	let skipAllOptional = $state(readSkipAll());
	let tourOpen = $state(false);
	let postedFor = $state<number | null>(null);

	/** Hot-seat hand-off: gate the engine question until the receiving player reveals it.
	 *  No answer is posted, no choice is remembered, no timer or auto-advance. */
	const curtainActive = $derived(bothSides && question !== null && revealedQuestionId !== question.id);
	const curtainPlayerName = $derived(
		question ? (players[question.player]?.name ?? `Player ${question.player + 1}`) : ''
	);

	function reveal() {
		if (!question) return;
		revealedQuestionId = question.id;
	}

	// Rendering-only preview of the pasted XWS (4GG shows this before import).
	const xwsPreview = $derived(parseXwsPreview(xwsText));
	const xws2Preview = $derived(parseXwsPreview(xws2Text));
	const importStatus = $derived(describeImportStatus(xwsText, xws2Text));

	const PRESET_REPUBLIC_XWS = JSON.stringify({
		description: 'Republic 50P',
		faction: 'galacticrepublic',
		name: 'Republic',
		pilots: [
			{ id: '104thbattalionpilot', name: '104thbattalionpilot', points: 10, ship: 'arc170starfighter', upgrades: { astromech: ['r3astromech'] } },
			{ id: '104thbattalionpilot', name: '104thbattalionpilot', points: 10, ship: 'arc170starfighter', upgrades: { astromech: ['r3astromech'] } },
			{ id: 'killer', name: 'killer', points: 7, ship: 'clonez95headhunter', upgrades: { modification: ['synchronizedconsole'], missile: ['ionmissiles'] } },
			{ id: 'ahsokatano', name: 'ahsokatano', points: 10, ship: 'delta7aethersprite', upgrades: { 'force-power': ['battlemeditation'], astromech: ['r4p44'], configuration: ['calibratedlasertargeting'] } },
			{ id: 'macewindu-delta7baethersprite', name: 'macewindu-delta7baethersprite', points: 13, ship: 'delta7baethersprite', upgrades: { 'force-power': ['brilliantevasion'], astromech: ['r4p17'], modification: ['synchronizedconsole'] } }
		],
		points: 50
	});

	async function loadRepublicPreset() {
		xwsText = PRESET_REPUBLIC_XWS;
		xws2Text = PRESET_REPUBLIC_XWS;
		await newGame();
	}
	let squadChoice = $state('none');
	let modeChoice = $state<'bot' | 'hotseat'>('bot');
	const activeFormat = $derived(formatById(formats, formatChoice));
	/** The selector's labels and ids come from `/api/formats`; the static list
	 *  is only the fallback while the request is in flight. */
	const formatChoices = $derived(
		formats.length > 0
			? formats.map((format) => ({ id: format.spec.id, label: format.spec.name }))
			: PLAY_FORMATS.map((format) => ({ id: format.id, label: format.label }))
	);
	const epicFormat = $derived(
		formatChoice === 'epic-xwa' || formatChoice === 'epic-house'
	);

	const selectedPreset = $derived(
		squadChoice === 'card-demo-custom' || formatChoice === 'standard-50p'
			? (presets.find((preset) => preset.id === squadChoice) ?? null)
			: null
	);
	const activePreset = $derived(
		presets.find((preset) => preset.id === game?.header.squad) ?? null
	);
	const hotseat = $derived(
		(formatChoice === 'standard-50p' || epicFormat) && modeChoice === 'hotseat'
	);
	const isCustom = $derived(squadChoice === 'card-demo-custom');
	const totals = $derived(
		isCustom
			? loadoutCatalog
				? customLineupTotals(loadoutCatalog, customLineup, activeFormat ?? undefined)
				: null
			: loadoutCatalog
				? loadoutTotals(
						loadoutCatalog,
						multiSelections,
						hotseat,
						pilotSelections,
						activeFormat ?? undefined
					)
				: null
	);
	const customIllegal = $derived(
		isCustom && totals !== null && !totals.legal_50
	);
	const customFormatPlayable = $derived(
		!isCustom || activeFormat === null || activeFormat.custom_lineup_playable
	);
	const customFormatNote = $derived(
		isCustom && activeFormat && !activeFormat.custom_lineup_playable
			? activeFormat.custom_lineup_note
			: null
	);
	const activeFormatLabel = $derived(activeFormat?.spec.name ?? 'Standard 50P');
	const customPreview = $derived(
		isCustom && loadoutCatalog ? previewCustomShips(loadoutCatalog, customLineup) : null
	);
	const customSides = $derived([
		{
			player: 0,
			label: 'Player 1',
			faction: loadoutCatalog?.sides[0]?.faction ?? 'Rebel Alliance',
			ships: customLineup[0]
		},
		{
			player: 1,
			label: 'Player 2',
			faction: loadoutCatalog?.sides[1]?.faction ?? 'Galactic Empire',
			ships: customLineup[1]
		}
	]);
	const browserPilots = $derived(
		loadoutCatalog ? pilotsForFormat(loadoutCatalog.pilot_pool, activeFormat) : []
	);
	const browserChassis = $derived(new Set(browserPilots.map((pilot) => pilot.chassis)).size);
	const customShipCounts = $derived([customLineup[0].length, customLineup[1].length]);
	const shipPointMap = $derived(
		totals
			? Object.fromEntries(
					Object.values(totals.ships).map((total) => [total.index, total.total])
				)
			: {}
	);

	function pilotChoices(player: number) {
		if (!loadoutCatalog) return [];
		const choices = customPilotChoices(loadoutCatalog, player, customLineup);
		if (!activeFormat) return choices;
		const selected = new Set(customLineup[player].map((ship) => ship.pilot));
		return choices.filter(
			(pilot) => selected.has(pilot.id) || customPilotFormatReason(pilot, activeFormat) === null
		);
	}

	function lineupShip(player: number, index: number) {
		return customLineup[player][index] ?? null;
	}

	function lineupPilot(player: number, index: number) {
		const ship = lineupShip(player, index);
		if (!ship || !loadoutCatalog) return null;
		return (
			customPilotById(loadoutCatalog, ship.pilot) ??
			customPilotChoices(loadoutCatalog, player, customLineup)[0] ??
			null
		);
	}

	function slotPlanFor(player: number, index: number) {
		const pilot = lineupPilot(player, index);
		const ship = lineupShip(player, index);
		return pilot && ship
			? customSlotPlan(pilot, ship.slots)
			: { slots: [], selected: [], reasons: [] };
	}

	function lineupFlatIndex(player: number, index: number) {
		return player === 0 ? index : customLineup[0].length + index;
	}

	function slotValue(player: number, index: number, key: string, fallback: string | null): string {
		const ship = lineupShip(player, index);
		if (ship && Object.prototype.hasOwnProperty.call(ship.slots, key)) {
			return ship.slots[key] ?? '';
		}
		return fallback ?? '';
	}

	function addShip(player: number) {
		if (!loadoutCatalog || busy) return;
		customLineup = addCustomShip(
			loadoutCatalog,
			customLineup,
			player,
			activeFormat?.listbuilding.ships_max ?? loadoutCatalog.max_ships
		);
	}

	function removeShip(player: number, index: number) {
		if (!loadoutCatalog || busy) return;
		customLineup = removeCustomShip(
			loadoutCatalog,
			customLineup,
			player,
			index,
			activeFormat?.listbuilding.ships_min ?? loadoutCatalog.min_ships
		);
		if (browseTargets[player] !== null) browseTargets[player] = null;
	}

	function toggleBrowse(player: number, index: number) {
		browseTargets[player] = browseTargets[player] === index ? null : index;
	}

	function addBrowsed(player: number, pilot: CustomPilot) {
		if (!loadoutCatalog || busy) return;
		customLineup = addCustomPilot(
			loadoutCatalog,
			customLineup,
			player,
			pilot.id,
			activeFormat?.listbuilding.ships_max ?? loadoutCatalog.max_ships
		);
	}

	function assignBrowsed(player: number, pilot: CustomPilot) {
		if (!loadoutCatalog || busy) return;
		const index = browseTargets[player];
		if (index === null) return;
		customLineup = changeCustomPilot(loadoutCatalog, customLineup, player, index, pilot.id);
	}

	function pilotUnavailable(player: number, pilot: CustomPilot): string | null {
		if (!loadoutCatalog) return null;
		const formatReason = activeFormat ? customPilotFormatReason(pilot, activeFormat) : null;
		if (formatReason) return formatReason;
		const first = customLineup[player][0];
		const sidePilot = first ? customPilotById(loadoutCatalog, first.pilot) : null;
		if (sidePilot && sidePilot.faction !== pilot.faction) {
			return `${pilot.faction_label} pilot cannot join player ${player + 1}'s ${sidePilot.faction_label} side; all ships on a side must be one faction`;
		}
		return customPilotLimitReason(loadoutCatalog, customLineup, player, pilot);
	}

	function changePilot(player: number, index: number, pilotId: string) {
		if (!loadoutCatalog || busy) return;
		customLineup = changeCustomPilot(loadoutCatalog, customLineup, player, index, pilotId);
	}

	function changeSlot(player: number, index: number, key: string, value: string) {
		customLineup = setCustomSlot(customLineup, player, index, key, value === '' ? null : value);
	}

	/** Switching formats keeps the builder, resizing it to the new committed
	 *  ship bounds. Preset ids do not exist outside Standard, so fall back to
	 *  the no-preset option there. */
	function formatChanged() {
		if (
			formatChoice !== 'standard-50p' &&
			squadChoice !== 'none' &&
			squadChoice !== 'card-demo-custom'
		) {
			squadChoice = 'none';
		}
		if (!loadoutCatalog) return;
		const format = formatById(formats, formatChoice);
		if (format) customLineup = fitCustomLineup(loadoutCatalog, customLineup, format);
	}

	function refreshSavedSquads() {
		const loaded = loadSavedSquads(browserSquadStorage());
		savedSquads = loaded.squads;
		savedSquadsError = loaded.error;
		if (!savedSquads.some((squad) => squad.name === selectedSquad)) {
			selectedSquad = savedSquads[0]?.name ?? '';
		}
	}

	function applyList(document: ListDocument, lineup: CustomLineup, source: string) {
		formatChoice = formatById(formats, document.format) ? document.format : 'standard-50p';
		squadChoice = 'card-demo-custom';
		customLineup = lineup;
		browseTargets = [null, null];
		customInitialized = true;
		listError = null;
		listNotice = `${source}: ${document.format}, ${document.side_sizes[0]} vs ${document.side_sizes[1]} ships, ${document.totals.points[0]} / ${document.totals.points[1]} pilot points. Start still sends the normal create request.`;
	}

	function shareCurrentList() {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		if (customIllegal) {
			listError = 'fix the highlighted legality reasons before sharing; the link must import a legal list';
			return;
		}
		try {
			const document = exportListDocument(loadoutCatalog, customLineup, activeFormat ?? undefined);
			shareLink = shareListUrl(document, window.location.href);
			listError = null;
			listNotice =
				'share link ready: the list is in the link fragment, not on the server. Open it on another device to import the same lineup.';
		} catch (err) {
			listError = message(err);
		}
	}

	/** Publish the validated list to the server. The id is the capability: the
	 *  link carries `#squad=<id>` and the stored document stays on the server. */
	async function publishCurrentSquad() {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		if (customIllegal) {
			listError = 'fix the highlighted legality reasons before publishing; the server would reject this list';
			return;
		}
		if (publishing) return;
		publishing = true;
		try {
			const document = exportListDocument(loadoutCatalog, customLineup, activeFormat ?? undefined);
			const id = await publishSquad(document);
			publishedSquadId = id;
			squadLink = squadShareUrl(id, window.location.href);
			listError = null;
			listNotice = `published as ${id}: the server stored the validated list and the link is #squad=${id}.`;
		} catch (err) {
			listError = `could not publish the list: ${message(err)}`;
		} finally {
			publishing = false;
		}
	}

	/** Load a `#squad=` link: fetch the stored document, then validate and map
	 *  it through the same import path as a pasted list. */
	async function loadPublishedSquad(id: string) {
		if (!loadoutCatalog) return;
		try {
			const imported = await importSharedSquad(loadoutCatalog, id, formats);
			applyList(imported.document, imported.lineup, `published squad ${id}`);
			publishedSquadId = id;
			squadLink = squadShareUrl(id, window.location.href);
			const url = new URL(window.location.href);
			url.hash = '';
			window.history.replaceState(window.history.state, '', url);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				publishedSquadId = '';
				squadLink = '';
				listError = `saved squad ${id} is no longer available; it may have expired (30 days) or already been deleted.`;
			} else {
				listError = `could not load published squad ${id}: ${message(err)}`;
			}
		}
	}

	function exportList() {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		if (customIllegal) {
			listError = 'fix the highlighted legality reasons before exporting; the server would reject this list';
			return;
		}
		try {
			const document = exportListDocument(loadoutCatalog, customLineup, activeFormat ?? undefined);
			const text = serializeListDocument(document);
			const blob = new Blob([text], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = window.document.createElement('a');
			anchor.href = url;
			anchor.download = `${listFileStem()}.json`;
			anchor.style.display = 'none';
			window.document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
			listError = null;
			listNotice = `exported ${document.pilots.length} ships as ${anchor.download}. The file has ${activeFormatLabel} rows and informational totals only.`;
		} catch (err) {
			listError = message(err);
		}
	}

	function listFileStem(): string {
		const stem = (squadName.trim() || 'wing-engine-list')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');
		return stem || 'wing-engine-list';
	}

	function importPasted(text = importText) {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		try {
			const imported = importList(loadoutCatalog, text, formats);
			applyList(imported.document, imported.lineup, 'imported list');
		} catch (err) {
			listError = message(err);
		}
	}

	async function importFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const text = await file.text();
			importText = text;
			importPasted(text);
		} catch (err) {
			listError = `could not read ${file.name}: ${message(err)}`;
		} finally {
			input.value = '';
		}
	}

	function saveCurrentSquad() {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		if (customIllegal) {
			listError = 'fix the highlighted legality reasons before saving; an illegal squad could not be started';
			return;
		}
		try {
			const document = exportListDocument(loadoutCatalog, customLineup, activeFormat ?? undefined);
			const result = saveListSquad(browserSquadStorage(), squadName, document);
			if (result.saved) {
				savedSquads = result.squads;
				savedSquadsError = null;
				selectedSquad = result.saved.name;
				squadName = result.saved.name;
				listError = null;
				listNotice = `saved "${result.saved.name}" in this browser (${result.squads.length}/${SAVED_SQUAD_LIMIT}).`;
			} else {
				if (result.squads.length > 0) savedSquads = result.squads;
				savedSquadsError = result.error;
				listError = result.error ?? 'could not save the squad';
			}
		} catch (err) {
			listError = message(err);
		}
	}

	function loadSelectedSquad() {
		if (!loadoutCatalog) {
			listError = 'the loadout catalog is still loading';
			return;
		}
		const entry = savedSquads.find((squad) => squad.name === selectedSquad);
		if (!entry) {
			listError = 'choose a saved squad first';
			return;
		}
		try {
			const imported = importList(loadoutCatalog, JSON.stringify(entry.list), formats);
			applyList(imported.document, imported.lineup, `loaded "${entry.name}"`);
			squadName = entry.name;
		} catch (err) {
			listError = `could not load "${entry.name}": ${message(err)}`;
		}
	}

	function deleteSelectedSquad() {
		const entry = savedSquads.find((squad) => squad.name === selectedSquad);
		if (!entry) {
			listError = 'choose a saved squad first';
			return;
		}
		const result = deleteSavedSquad(browserSquadStorage(), entry.name);
		savedSquads = result.squads;
		savedSquadsError = result.error;
		selectedSquad = result.squads[0]?.name ?? '';
		if (result.error) {
			listError = result.error;
		} else {
			listError = null;
			listNotice = `deleted "${entry.name}" from this browser.`;
		}
	}

	/** Delete the server-stored squad named by the current capability link. A
	 *  404 includes expiry: clear the link and explain instead of retrying. */
	async function removePublishedSquad() {
		if (!publishedSquadId) {
			listError = 'publish or load a saved squad first';
			return;
		}
		if (deletingPublished) return;
		const id = publishedSquadId;
		deletingPublished = true;
		try {
			await deletePublishedSquad(id);
			publishedSquadId = '';
			squadLink = '';
			listError = null;
			listNotice = `deleted saved squad ${id} from the server.`;
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				publishedSquadId = '';
				squadLink = '';
				listError = `saved squad ${id} is no longer available; it may have expired (30 days) or already been deleted.`;
			} else {
				listError = `could not delete saved squad ${id}: ${message(err)}`;
			}
		} finally {
			deletingPublished = false;
		}
	}

	$effect(() => {
		if (loadoutCatalog && pendingPublishedSquad) {
			const id = pendingPublishedSquad;
			pendingPublishedSquad = null;
			void loadPublishedSquad(id);
		}
		if (loadoutCatalog && pendingSharedList && !customInitialized) {
			try {
				const imported = importList(loadoutCatalog, pendingSharedList, formats);
				applyList(imported.document, imported.lineup, 'shared list');
			} catch (err) {
				listError = `could not import the shared list: ${message(err)}`;
			}
			pendingSharedList = null;
			const url = new URL(window.location.href);
			url.hash = '';
			window.history.replaceState(window.history.state, '', url);
		}
		if (isCustom && loadoutCatalog && !customInitialized) {
			customLineup = defaultCustomLineup(loadoutCatalog);
			customInitialized = true;
		}
		if (isCustom && loadoutCatalog && Object.keys(multiSelections).length === 0) {
			multiSelections = defaultMultiSelections(loadoutCatalog);
		}
		if (isCustom && loadoutCatalog && Object.keys(pilotSelections).length === 0) {
			pilotSelections = defaultPilotSelections(loadoutCatalog);
		}
		if (isCustom && loadoutCatalog && activeFormat && customInitialized) {
			const lb = activeFormat.listbuilding;
			const outside = customLineup.some(
				(side) => side.length < lb.ships_min || side.length > lb.ships_max
			);
			if (outside) {
				customLineup = fitCustomLineup(loadoutCatalog, customLineup, activeFormat);
			}
		}
	});

	async function start() {
		busy = true;
		revealedQuestionId = null; // a new game starts with a fresh hand-off
		postedFor = null; // question ids restart at 1 in a new game
		error = null;
		lastSeat = 0;
		setupOpen = false;
		try {
			const sc = scenarioChoice === 'none' ? undefined : scenarioChoice;
			const pl = formatChoice === 'aces-high' ? playerCount : undefined;
			// XWS-paste path: a pasted squad is posted verbatim (position six of
			// createGame is then the boolean `both`). An empty box means
			// "predefined squad" for that side — never JSON.parse('') because
			// the other side happened to be pasted.
			let xws: unknown;
			let xws2: unknown;
			if (xwsText.trim() || xws2Text.trim()) {
				try {
					if (xwsText.trim()) xws = JSON.parse(xwsText);
					if (xws2Text.trim()) xws2 = JSON.parse(xws2Text);
				} catch {
					throw new Error('XWS paste is not valid JSON — export from YASB (Copy squad as XWS) and paste it into the relevant square.');
				}
			}
			const useXws = xws !== undefined || xws2 !== undefined;

			// Custom-lineup / preset path: validated catalog rows (position six
			// of createGame is then the squad id, so the list/tournament shape
			// still works). Only run this validation when XWS was not pasted.
			const sq = squadChoice !== 'none' ? squadChoice : undefined;
			let selections: (string | null)[][] | undefined;
			let pilots: (string | null)[] | undefined;
			let sideSizes: number[] | undefined;
			if (!useXws && sq === 'card-demo-custom' && loadoutCatalog) {
				if (activeFormat && !activeFormat.custom_lineup_playable) {
					error =
						activeFormat.custom_lineup_note ??
						`${activeFormat.spec.name} custom lineups cannot be started yet`;
					setupOpen = true;
					return;
				}
				const current = customLineupTotals(
					loadoutCatalog,
					customLineup,
					activeFormat ?? undefined
				);
				const illegal = current.sides.find((side) => !side.legal_50);
				if (illegal) {
					error = `player ${illegal.player + 1} is not a legal ${activeFormatLabel} squad: ${illegal.reasons.join('; ')}`;
					setupOpen = true;
					return;
				}
				const request = customLineupRequest(loadoutCatalog, customLineup);
				selections = request.selections;
				pilots = request.pilots;
				sideSizes = request.side_sizes;
			}

			if (useXws) {
				game = await createGame(seedOverride, 0, formatChoice, sc, pl, bothSides, xws, xws2);
			} else {
				game = await createGame(
					seedOverride,
					0,
					formatChoice,
					sc,
					pl,
					sq,
					hotseat,
					undefined,
					selections,
					pilots,
					sideSizes
				);
			}
			setUrl(game.id);
		} catch (err) {
			error =
				err instanceof ApiError
					? message(err)
					: `could not start a game: ${message(err)}. Is \`cargo run -p we-serve\` running?`;
			setupOpen = true;
		} finally {
			busy = false;
		}
	}

	async function answer(option: string) {
		if (!game?.question || busy) return;
		busy = true;
		error = null;
		try {
			const next = await answerQuestion(game.id, game.question.id, option);
			if (next.question) lastSeat = next.question.player;
			game = append(game, next);
			if (next.status === 'running') scheduleRefresh();
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				// Stale answer: the engine moved on. Show the current question
				// instead of inventing a default.
				error = 'that question was already resolved; reloading the current one';
				await reload(game.id);
			} else {
				error = message(err);
			}
		} finally {
			busy = false;
		}
	}

	async function scheduleRefresh() {
		if (polling || !game || game.result) return;
		polling = true;
		try {
			// The answer path waits for the next question, so this is only a
			// safety net for a worker that is still resolving bot decisions.
			while (game && !game.result && !game.question) {
				await new Promise((resolve) => setTimeout(resolve, 120));
				if (!game) break;
				game = await getGame(game.id, viewingSeat);
			}
		} catch (err) {
			error = message(err);
		} finally {
			polling = false;
		}
	}

	/** 4GG-style file import: read a .json/.xws export into one of the two squad boxes. */
	async function readXwsFile(event: Event, target: 1 | 2) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const text = await file.text();
		if (target === 1) xwsText = text;
		else xws2Text = text;
		error = null;
		input.value = '';
	}

	/** Link import lands in a paste box; the engine still decides legality. */
	function importFromUrl(raw: string, target: 1 | 2) {
		if (!parseXwsPreview(raw).ok) {
			error = 'link did not contain XWS JSON';
			return;
		}
		if (target === 1) xwsText = raw;
		else xws2Text = raw;
		error = null;
	}

	/** Persist the current "your squad" paste (or the preset) as a saved squad. */
	function saveCurrentXwsSquad(): SquadRecord {
		const raw = xwsText.trim() ? xwsText : PRESET_REPUBLIC_XWS;
		error = null;
		return saveSquad(raw);
	}

	/** Load a saved squad into one box; fill the other with the preset when empty
	 *  so we-serve never sees a one-sided XWS and returns 400. */
	function loadIntoSquad(squad: SquadRecord, target: 1 | 2) {
		if (target === 1) {
			xwsText = squad.raw;
			if (!xws2Text.trim()) xws2Text = PRESET_REPUBLIC_XWS;
		} else {
			xws2Text = squad.raw;
			if (!xwsText.trim()) xwsText = PRESET_REPUBLIC_XWS;
		}
		addHistory(squad);
		error = null;
	}

	async function newGame() {
		if (busy) return;
		busy = true;
		const old = game?.id;
		if (game) seedOverride = game.header.seed;
		game = null;
		error = null;
		try {
			if (old) await deleteGame(old);
			await start();
		} catch (err) {
			error = message(err);
			busy = false;
		}
	}

	let menuEl = $state<HTMLDetailsElement | null>(null);

	function onKey(e: KeyboardEvent) {
		if (e.repeat || busy || !game) return;
		const t = e.target as HTMLElement | null;
		if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
		const key = e.key.toLowerCase();
		if (curtainActive && key === 'enter') {
			e.preventDefault();
			reveal();
		} else if (key === 'z') {
			e.preventDefault();
			void undo();
		} else if (key === 'l' && menuEl) {
			e.preventDefault();
			menuEl.open = !menuEl.open;
		}
	}

	async function undo() {
		if (!game || busy) return;
		busy = true;
		error = null;
		try {
			game = await undoGame(game.id);
		} catch (err) {
			error = `undo failed: ${message(err)}`;
			await reload(game.id);
		} finally {
			busy = false;
		}
	}

	function onBoardSelect(ship: number) {
		const option = targetOptions.find((candidate) => candidate.ship === ship);
		if (option) answer(option.id);
	}

	// v1 optional fast path: the chip on the ship answers the same engine
	// question the prompt does. No preference is remembered or auto-applied.
	const optionalShip = $derived(question?.kind === 'optional' ? question.ship : null);
	const optionalIds = $derived(question?.kind === 'optional' ? optionalChoices(question.options) : null);

	function onOptionalChip(choice: 'use' | 'skip') {
		const id = choice === 'use' ? optionalIds?.use : optionalIds?.skip;
		if (id) answer(id);
	}

	// Opt-in skip-all: post only the engine's own decline id, once per question.
	// Never while busy or behind a covered hot-seat hand-off curtain.
	$effect(() => {
		const q = question;
		if (!q || !skipAllOptional || busy || curtainActive || postedFor === q.id) return;
		const id = autoSkipOptionalId(q, skipAllOptional);
		if (id === null) return;
		postedFor = q.id;
		void answer(id);
	});

	// Guided tour (viewer only): the current step comes from contract data.
	const tourFrame = $derived(question?.frame ?? frames[index] ?? null);
	const tourStep = $derived(tourStepFor(question, tourFrame, result));

	// Setup placement: the engine supplies legal poses; the board draws markers
	// and clicking one posts that engine option id (no legality computed in TS).
	const poseOptions = $derived(
		question?.kind === 'setup-pose' ||
			question?.kind === 'ship-pose' ||
			question?.kind === 'free-ship-pose'
			? question.options
			: []
	);
	function onPose(id: string) {
		answer(id);
	}

	// 4GG parity: the inspector's rotate buttons post an arbitrary heading for
	// the ship being deployed. The position comes from the engine's default
	// candidate and the heading from its exact tenths value; legality stays in
	// the engine. Outside a deployment question the buttons stay visual-only.
	function onRotatePose(id: number, deltaDeg: number): boolean {
		const q = question;
		if (!q || busy || q.kind !== 'free-ship-pose' || q.ship !== id) return false;
		const base = q.options.find((option) => option.id === 'pose:0')?.pose;
		if (!base) return false;
		const baseTenths = base.heading_tenths ?? base.heading * 10;
		const tenths = (((baseTenths + Math.round(deltaDeg * 10)) % 3600) + 3600) % 3600;
		answer(`pose-free:${base.x}:${base.y}:${tenths}`);
		return true;
	}

	onMount(() => {
		loadPresets();
		refreshSavedSquads();
		try {
			const shared = sharedListText(window.location.hash);
			if (shared) {
				pendingSharedList = shared;
			} else {
				const published = sharedSquadId(window.location.hash);
				if (published) pendingPublishedSquad = published;
			}
		} catch (err) {
			listError = message(err);
		}
		const params = new URLSearchParams(window.location.search);
		const id = params.get('id');
		const raw = Number(params.get('seed') ?? DEFAULT_SEED);
		if (Number.isInteger(raw) && raw >= 0) seedOverride = raw;
		const fmt = params.get('format');
		if (fmt) formatChoice = fmt;
		const sc = params.get('scenario');
		if (sc) scenarioChoice = sc;
		const sq = params.get('squad');
		if (sq) squadChoice = sq;
		if (params.get('mode') === 'hotseat') modeChoice = 'hotseat';
		const pl = Number(params.get('players'));
		if (Number.isInteger(pl) && pl >= 3 && pl <= 8) playerCount = pl;
		if (id) {
			setupOpen = false;
			reload(id);
		} else {
			setupOpen = true;
		}
	});
</script>

<svelte:window onkeydown={onKey} />

{#snippet setupControls()}
	<div class="flex flex-wrap items-center gap-1.5">
		<select
			bind:value={formatChoice}
			disabled={busy}
			onchange={formatChanged}
			class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
			data-testid="format-choice"
		>
			{#each formatChoices as choice (choice.id)}
				<option value={choice.id}>{choice.label}</option>
			{/each}
		</select>
		{#if epicFormat}
			<span
				data-testid="epic-players"
				title="Epic XWA and Epic House are two-player formats; the players control is fixed"
				class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-secondary/60"
			>
				2 Players
			</span>
		{/if}
		{#if formatChoice === 'aces-high'}
			<select
				bind:value={playerCount}
				disabled={busy}
				class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
			>
				<option value={3}>3 Players</option>
				<option value={4}>4 Players</option>
				<option value={5}>5 Players</option>
				<option value={6}>6 Players</option>
				<option value={7}>7 Players</option>
				<option value={8}>8 Players</option>
			</select>
		{:else}
			<select
				bind:value={modeChoice}
				disabled={busy}
				class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
				title="hotseat: both owners answer on this browser; it is not pass-screen hidden information"
			>
				<option value="bot">Vs Bot</option>
				<option value="hotseat">Hotseat (2 players)</option>
			</select>
			{#if formatChoice === 'standard-50p'}
				<select
					bind:value={squadChoice}
					disabled={busy}
					class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
					title="fixed presets and a multi-slot demo with listbuilding points and factions; not a tournament-legal list claim"
				>
					<option value="none">No Cards</option>
					{#each presets as preset (preset.id)}
						<option value={preset.id}>{preset.label}</option>
					{/each}
				</select>
			{:else}
				<select
					bind:value={squadChoice}
					disabled={busy}
					class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
					title="this format plays the committed preset squads; a custom lineup can be validated and published from the builder"
				>
					<option value="none">Preset squads</option>
					<option value="card-demo-custom">Custom lineup</option>
				</select>
			{/if}
			<select
				bind:value={scenarioChoice}
				disabled={busy}
				class="rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
			>
				<option value="none">No Scenario</option>
				<option value="chance-engagement">Chance Engagement</option>
				<option value="assault-at-the-satellite-array">Assault at Satellite Array</option>
				<option value="scramble-the-transmissions">Scramble Transmissions</option>
				<option value="salvage-mission">Salvage Mission</option>
				<option value="ancient-knowledge">Ancient Knowledge</option>
			</select>
		{/if}
	</div>
{/snippet}

{#if game && board}
	<GameScreen
		{board}
		{ships}
		{players}
		{frames}
		{index}
		format={game.header.format}
		seed={game.header.seed}
		kind="live"
		{error}
		selectable={curtainActive ? [] : selectable}
		targets={curtainActive ? [] : targets}
		onselect={curtainActive ? () => {} : onBoardSelect}
		optionalShip={curtainActive ? null : optionalShip}
		onoptional={curtainActive ? () => {} : onOptionalChip}
		setupOptions={curtainActive ? [] : poseOptions}
		onselectpose={curtainActive ? () => {} : onPose}
		onrotatepose={curtainActive ? undefined : onRotatePose}
	>
		{#snippet headerExtra()}
			<details class="relative text-[11px] text-secondary" data-testid="menu" bind:this={menuEl}>
				<summary class="cursor-pointer rounded-sm border border-border-dark px-2 py-1 hover:border-white/40 hover:text-white" aria-label="Menu (L)">☰</summary>
				<div class="absolute right-0 z-20 mt-1 w-52 rounded-sm border border-border-dark bg-terminal-panel p-2 text-left leading-relaxed">
					<div class="mb-1 text-[10px] uppercase tracking-widest text-secondary/50">Game</div>
					<button class="block w-full rounded-sm px-2 py-1 text-left hover:bg-white/5" onclick={() => void undo()} disabled={busy}>↶ undo (Z)</button>
					<button class="block w-full rounded-sm px-2 py-1 text-left hover:bg-white/5" onclick={newGame} disabled={busy}>new game</button>
					<a class="block rounded-sm px-2 py-1 hover:bg-white/5" href={replayUrl(game!.id)} download>download replay</a>
					<div class="mt-1 border-t border-border-dark pt-1 text-[10px] text-secondary/60">
						{game!.header.format} · seed {game!.header.seed} · {game!.header.scenario ?? 'no scenario'}
					</div>
				</div>
			</details>
			<div class="flex flex-wrap items-center gap-1.5">
				{#if game!.header.hotseat}
					<span
						class="rounded-sm border border-resistance/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-resistance"
						title="both players answer on this browser; hidden dials are not shown, but there is no pass-screen privacy"
						data-testid="hotseat"
					>
						{hotseatSummary(game!.header)}
					</span>
				{/if}
				<span
					class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-secondary"
					title="look-at-dial reveals are shown only for this seat"
					data-testid="viewing-seat"
				>
					viewing as P{viewingSeat + 1}
				</span>
				{#if game!.header.squad}
					<span
						class="rounded-sm border border-resistance/40 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-resistance"
						title="demo cards, not a tournament-legal list"
					>
						{activePreset?.label ?? game!.header.squad}
					</span>
				{/if}
				{@render setupControls()}
				<label class="flex cursor-pointer items-center gap-1 text-[11px]">
					<input type="checkbox" bind:checked={bothSides} disabled={busy} />
					<span title="Hot-seat on one device: this browser answers the prompts for both players in turn. Each new prompt starts covered — pass the device and click Reveal before reading it.">hot-seat · both players, one device</span>
				</label>
			</div>
			<a
				class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
				href="/tournament"
			>
				tournament
			</a>
			<a
				class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
				href={replayUrl(game!.id)}
				download
			>
				download replay
			</a>
			<button
				type="button"
				disabled={busy || !game}
				title="Undo the last decision (engine rebuilds from its action log)"
				class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
				onclick={undo}
			>
				↶ undo
			</button>
			<button
				type="button"
				disabled={busy}
				class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
				onclick={newGame}
			>
				new game
			</button>
			<button
				type="button"
				disabled={busy}
				data-testid="tour-button"
				title="Open the 11-step guided tour (viewer only)"
				class="rounded-sm border border-republic/50 bg-republic/10 px-2 py-1 text-[11px] text-republic hover:border-republic disabled:opacity-50"
				onclick={() => (tourOpen = true)}
			>
				guided tour
			</button>
			<!-- YASB XWS import (rendering only): paste two exports, JSON syntax checked here, legality answered by the server. -->
			<details class="relative text-[11px] text-secondary" data-tour="import">
				<summary
					class="cursor-pointer rounded-sm border border-border-dark px-2 py-1 hover:border-white/40 hover:text-white"
				>
					YASB XWS
				</summary>
				<div
					class="absolute right-0 z-20 mt-1 w-96 rounded-sm border border-border-dark bg-terminal-panel p-3 text-left leading-relaxed"
				>
					<p class="text-primary/90">
						Build squads in <strong>YASB</strong> (Copy squad as XWS) and paste both exports here, then <em>new game</em>. Upgrades validate but are not attached yet; unknown ships/pilots are rejected by name.
					</p>
					<div class="mt-1 flex items-center justify-between gap-2">
						<p class="font-mono text-[10px] text-secondary/70" data-xws-status>{importStatus.message}</p>
						<button
							type="button"
							class="shrink-0 rounded-sm border border-republic/50 bg-republic/10 px-2 py-0.5 font-mono text-[10px] text-republic hover:border-republic"
							onclick={loadRepublicPreset}
						>
							load Republic preset
						</button>
						<button
							type="button"
							class="shrink-0 rounded-sm border border-border-dark px-2 py-0.5 font-mono text-[10px] text-secondary hover:border-white/40 hover:text-white"
							aria-expanded={squadsOpen}
							data-testid="squads-toggle"
							onclick={() => (squadsOpen = !squadsOpen)}
						>
							Squads
						</button>
					</div>
					{#if squadsOpen}
						<div class="mt-2 border-t border-border-dark pt-2">
							<SquadsPanel
								currentRaw={xwsText}
								onSaveCurrent={saveCurrentXwsSquad}
								onLoadYour={(squad) => loadIntoSquad(squad, 1)}
								onLoadBot={(squad) => loadIntoSquad(squad, 2)}
							/>
						</div>
					{/if}
					<label class="mt-2 block">
						YOUR SQUAD <span class="text-secondary/50">(YASB XWS JSON)</span>
						<textarea bind:value={xwsText} class="mt-1 h-24 w-full rounded-sm border border-border-dark bg-black/40 p-2 font-mono text-[10px]" spellcheck="false"></textarea>
					</label>
					<p class="mt-1 font-mono text-[10px] text-republic" data-xws-preview="1">
						{xwsPreview.ok ? formatXwsPreview(xwsPreview.squad) : xwsText.trim() ? `your squad: ${xwsPreview.reason}` : ''}
					</p>
					<label class="mt-1 inline-flex cursor-pointer items-center gap-1 text-[10px] text-secondary hover:text-white">
						<input type="file" accept=".json,.xws,application/json" class="hidden" data-xws-file="1" onchange={(event) => readXwsFile(event, 1)} />
						choose a file for your squad
					</label>
					<ImportLink bind:value={xwsUrl} onImport={(raw) => importFromUrl(raw, 1)} label="Import link → your squad" />
					<label class="mt-2 block">
						BOT'S SQUAD <span class="text-secondary/50">{xws2Text.trim() ? '(YASB XWS JSON)' : '· let the bot choose'}</span>
						<textarea bind:value={xws2Text} class="mt-1 h-24 w-full rounded-sm border border-border-dark bg-black/40 p-2 font-mono text-[10px]" spellcheck="false"></textarea>
					</label>
					<p class="mt-1 font-mono text-[10px] text-republic" data-xws-preview="2">
						{xws2Preview.ok ? formatXwsPreview(xws2Preview.squad) : xws2Text.trim() ? `bot's squad: ${xws2Preview.reason}` : ''}
					</p>
					<label class="mt-1 inline-flex cursor-pointer items-center gap-1 text-[10px] text-secondary hover:text-white">
						<input type="file" accept=".json,.xws,application/json" class="hidden" data-xws-file="2" onchange={(event) => readXwsFile(event, 2)} />
						choose a file for the bot's squad
					</label>
					<ImportLink bind:value={xws2Url} onImport={(raw) => importFromUrl(raw, 2)} label="Import link → bot's squad" />
				</div>
			</details>
			<!-- Explicit setup help (rendering only): squad is predefined, setup/obstacles are engine+bot. No builder/hotseat in M1. -->
			<details class="relative text-[11px] text-secondary">
				<summary
					class="cursor-pointer rounded-sm border border-border-dark px-2 py-1 hover:border-white/40 hover:text-white"
				>
					how to play
				</summary>
				<div
					class="absolute right-0 z-20 mt-1 w-80 rounded-sm border border-border-dark bg-terminal-panel p-3 text-left leading-relaxed"
				>
					<p class="text-primary/90">
						You are <strong>player 1 vs the bot</strong> (seed {game!.header.seed}, {game!.header.format}). Squads are predefined, obstacle and ship setup are engine + bot. You answer engine prompts only. Tick <em>both sides</em> to answer for every player (self-play test mode).
					</p>
					<p class="mt-2">
						Reading the log: <em>dial</em> = manoeuvre choice, <em>reveal</em> = dial turned faceup,
						<em>bullseye</em> = narrow centre arc, <em>strain/stress</em> = tokens, <em>lock</em> = target lock.
					</p>
					<p class="mt-2">
						<em>Arc</em> = the printed firing direction (front, side, turret, bullseye). <em>Range</em> bands
						decide attacks and objectives. <em>Ion</em> forces a blue speed-1 manoeuvre; <em>tractor</em>
						drags a ship and removes a defence die; <em>cloak</em> hides a ship until it decloaks.
						<em>Reinforce</em> adds defence dice in a direction; <em>charge</em> is a printed ammo counter;
						<em>limited/restricted</em> cap how many copies of a card a squad may take. Points come from
						destruction, objectives, and the opponent's deficit.
					</p>
					<p class="mt-2">
						Keyboard: <kbd>Enter</kbd> uses an optional ability, <kbd>Esc</kbd> skips it, <kbd>Z</kbd> · undo, <kbd>L</kbd> · menu. Drag empty board to pan, wheel to zoom, <em>center</em> recentres on the active ship.
					</p>
					<label class="mt-2 flex cursor-pointer items-center gap-1 text-[11px] text-secondary hover:text-white">
						<input
							type="checkbox"
							data-testid="skip-all-optional"
							checked={skipAllOptional}
							onchange={(event) => {
								skipAllOptional = (event.currentTarget as HTMLInputElement).checked;
								writeSkipAll(skipAllOptional);
							}}
						/>
						<span>skip all optional abilities (posts the engine’s own decline option)</span>
					</label>
					<p class="mt-2">download replay opens this game in the replay viewer.</p>
				</div>
			</details>
		{/snippet}

		{#snippet prompt()}
			{#if curtainActive}
				<div
					class="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 border-b border-border-dark bg-terminal-panel px-4 py-8 text-center"
					data-testid="handoff-curtain"
				>
					<div class="text-[10px] uppercase tracking-widest text-secondary/50">hot-seat · pass the device</div>
					<p class="max-w-sm text-sm leading-snug text-primary">
						Passa il dispositivo a <span class="font-semibold text-republic">{curtainPlayerName}</span> · clicca per rivelare
					</p>
					<p class="max-w-sm text-[11px] leading-snug text-secondary/70">
						Hand the device to <span class="font-semibold text-republic">{curtainPlayerName}</span> — click to reveal
					</p>
					<button
						type="button"
						class="rounded-sm border border-republic/60 bg-republic/10 px-4 py-1.5 text-[12px] text-republic hover:border-republic hover:bg-republic/20"
						data-testid="reveal-button"
						onclick={reveal}
					>
						Reveal
					</button>
					<p class="text-[10px] text-secondary/50">or press <kbd>Enter</kbd></p>
				</div>
			{:else if question}
				<PromptPanel
					{question}
					{busy}
					onselect={answer}
					hotseat={game!.header.hotseat ?? false}
					playerName={players[question.player]?.name}
				/>
			{:else if result}
				<div class="border-b border-border-dark bg-terminal-panel px-3 py-4" data-testid="result">
					<div class="text-[10px] uppercase tracking-widest text-secondary/50">result</div>
					<p class="mt-1 text-lg text-primary">
						{result.winner === null
							? 'No winner'
							: `${players[result.winner]?.name ?? `Player ${result.winner + 1}`} wins`}
					</p>
					<p class="mt-1 font-mono text-[11px] text-secondary">
						{result.points[0]} to {result.points[1]} · round {result.round}
					</p>
					<div class="mt-3 flex gap-2">
						<a
							class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
							href={replayUrl(game!.id)}
							download
						>
							download replay
						</a>
						<button
							type="button"
							class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
							onclick={newGame}
						>
							play again
						</button>
					</div>
				</div>
			{:else}
				<div class="border-b border-border-dark px-3 py-4 text-[11px] text-secondary/60">
					the engine is resolving decisions…
				</div>
			{/if}
		{/snippet}
	</GameScreen>
	{#if tourOpen}
		<TourOverlay
			{question}
			frame={tourFrame}
			{result}
			initialStep={tourStep}
			onclose={() => (tourOpen = false)}
		/>
	{/if}
{:else if setupOpen}
	<div class="flex min-h-screen items-start justify-center bg-terminal-bg px-4 py-10 text-primary">
		<div class="w-full max-w-3xl space-y-4">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<div class="text-sm font-semibold tracking-wide">WING-ENGINE</div>
					<div class="text-[11px] text-secondary/60">
						setup preview · selectable real pilots and a validator-backed 50-point demo
					</div>
				</div>
				<div class="flex items-center gap-2">
					<a
						class="rounded-sm border border-border-dark px-2 py-1 text-[11px] text-secondary hover:border-white/40 hover:text-white"
						href="/tournament"
					>
						tournament
					</a>
					<button
						type="button"
						disabled={busy || customIllegal || !customFormatPlayable || (isCustom && !loadoutCatalog)}
						title={isCustom && !loadoutCatalog
							? 'loading the curated pilot pool'
							: customFormatNote
								? customFormatNote
								: customIllegal
									? totals?.sides
											.filter((side) => !side.legal_50)
											.map((side) => `player ${side.player + 1}: ${side.reasons.join('; ')}`)
											.join(' | ')
									: undefined}
						data-testid="start-game"
						class="rounded-sm border border-border-dark px-3 py-1.5 text-[11px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
						onclick={start}
					>
						start game
					</button>
				</div>
			</div>
			{@render setupControls()}
			{#if presetsError}
				<div class="rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-[11px] text-rebel">
					could not load card presets: {presetsError}
				</div>
			{/if}
			{#if catalogError}
				<div class="rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-[11px] text-rebel">
					could not load the arbitrary loadout catalog: {catalogError}
				</div>
			{/if}
			{#if formatsError}
				<div class="rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-[11px] text-rebel">
					could not load the committed format metadata: {formatsError}
				</div>
			{/if}
			{#if selectedPreset}
				{#if isCustom && loadoutCatalog}
					<div
						class="rounded-sm border border-border-dark bg-terminal-panel/40 p-3"
						data-testid="custom-loadout"
					>
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<div class="text-[10px] uppercase tracking-widest text-secondary/50">
								pilot browser · {browserPilots.length} pilots /
								{browserChassis} chassis · curated
								{loadoutCatalog.pilot_pool_report.curated_rows} · {customShipCounts[0]} vs {customShipCounts[1]}
								ships · add or remove between
								{activeFormat?.listbuilding.ships_min ?? loadoutCatalog.min_ships} and
								{activeFormat?.listbuilding.ships_max ?? loadoutCatalog.max_ships}
							</div>
							<div class="font-mono text-[10px] text-secondary/70">
								{totals?.total ?? 0} squad points ·
								{activeFormat?.listbuilding.ships_min ?? loadoutCatalog.min_ships}-{activeFormat
									?.listbuilding.ships_max ?? loadoutCatalog.max_ships} ships,
								{activeFormat?.listbuilding.points_min ?? loadoutCatalog.points_min}-{activeFormat
									?.listbuilding.points_max ?? loadoutCatalog.point_cap} per side
							</div>
						</div>
						{#if activeFormat}
							<p class="mt-1 text-[10px] text-secondary/70" data-testid="format-bounds">
								{activeFormat.spec.name} · {activeFormat.listbuilding.ships_min}-{activeFormat
									.listbuilding.ships_max} ships · {activeFormat.listbuilding.points_min}-{activeFormat
									.listbuilding.points_max} points{activeFormat.listbuilding.huge_ships_allowed
									? ' · huge ships allowed'
									: ' · no huge ships'}{activeFormat.listbuilding.command_slot_allowed
									? ' · Command allowed'
									: ''}
							</p>
						{/if}
						{#if customFormatNote}
							<p class="mt-1 text-[10px] text-resistance/80" data-testid="format-playable-note">
								{customFormatNote}
							</p>
						{/if}
						<p class="mt-1 text-[10px] text-resistance/80">
							Squad points are pilot points. Upgrades spend each pilot's separate loadout
							value and each ship uses its own printed bar; the committed 50P validator checks
							both sides before the worker starts.
						</p>
						<div class="mt-3 rounded-sm border border-border-dark/70 p-2" data-testid="list-io">
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<div class="text-[10px] uppercase tracking-widest text-secondary/50">
									list interchange
								</div>
								<div class="font-mono text-[10px] text-secondary/60">
									{LIST_SCHEMA} · {LIST_FORMAT}
								</div>
							</div>
							<p class="mt-1 text-[10px] text-secondary/60">
								Export writes the positional side_sizes, pilots and selections rows the create
								API already accepts. Points and factions are informational; the server
								recomputes and validates both sides. Saved squads stay in this browser;
								publish stores one on this server and shares it as a <code>#squad=</code> id.
							</p>
							<div class="mt-2 flex flex-wrap items-end gap-2">
								<label class="text-[10px] text-secondary/70">
									<span>Squad name</span>
									<input
										bind:value={squadName}
										maxlength={SAVED_SQUAD_NAME_LIMIT}
										placeholder="my 3 vs 3"
										autocomplete="off"
										data-testid="squad-name"
										class="mt-0.5 w-40 rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
									/>
								</label>
								<button
									type="button"
									disabled={busy || customIllegal}
									title={customIllegal ? 'fix the highlighted legality reasons first' : undefined}
									data-testid="save-squad"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
									onclick={saveCurrentSquad}
								>
									save squad
								</button>
								<button
									type="button"
									disabled={busy || customIllegal}
									title={customIllegal ? 'fix the highlighted legality reasons first' : undefined}
									data-testid="export-list"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
									onclick={exportList}
								>
									export list
								</button>
								<button
									type="button"
									disabled={busy || customIllegal}
									title={customIllegal ? 'fix the highlighted legality reasons first' : undefined}
									data-testid="share-list"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
									onclick={shareCurrentList}
								>
									share link
								</button>
								<button
									type="button"
									disabled={busy || publishing || customIllegal}
									title={customIllegal
										? 'fix the highlighted legality reasons first'
										: 'validate on the server, store the list and return a short #squad= link'}
									data-testid="publish-squad"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
									onclick={publishCurrentSquad}
								>
									{publishing ? 'publishing…' : 'publish squad'}
								</button>
							</div>
							{#if shareLink}
								<label class="mt-2 block text-[10px] text-secondary/70">
									<span>Share link</span>
									<input
										readonly
										value={shareLink}
										data-testid="share-link"
										autocomplete="off"
										class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 font-mono text-[9px] text-secondary"
									/>
								</label>
							{/if}
							{#if squadLink}
								<div class="mt-2">
									<label class="block text-[10px] text-secondary/70">
										<span>Published link (stored on the server, expires after 30 days)</span>
										<input
											readonly
											value={squadLink}
											data-testid="squad-link"
											autocomplete="off"
											class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 font-mono text-[9px] text-secondary"
										/>
									</label>
									<button
										type="button"
										disabled={deletingPublished}
										data-testid="delete-published-squad"
										class="mt-1 rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary/70 hover:border-rebel/60 hover:text-rebel disabled:opacity-50"
										onclick={removePublishedSquad}
									>
										{deletingPublished ? 'deleting…' : 'delete saved squad'}
									</button>
								</div>
							{/if}
							<div class="mt-2 flex flex-wrap items-end gap-2">
								<label class="text-[10px] text-secondary/70">
									<span>Saved squads ({savedSquads.length}/{SAVED_SQUAD_LIMIT})</span>
									<select
										bind:value={selectedSquad}
										data-testid="saved-squads"
										class="mt-0.5 w-52 rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
									>
										<option value="">select a saved squad</option>
										{#each savedSquads as squad (squad.name)}
											<option value={squad.name}>{squad.name}</option>
										{/each}
									</select>
								</label>
								<button
									type="button"
									disabled={!selectedSquad}
									data-testid="load-squad"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
									onclick={loadSelectedSquad}
								>
									load
								</button>
								<button
									type="button"
									disabled={!selectedSquad}
									data-testid="delete-squad"
									class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary/70 hover:border-rebel/60 hover:text-rebel disabled:opacity-50"
									onclick={deleteSelectedSquad}
								>
									delete
								</button>
							</div>
							<div class="mt-2">
								<label class="block text-[10px] text-secondary/70">
									<span>Paste a list JSON</span>
									<textarea
										bind:value={importText}
										rows="4"
										spellcheck="false"
										placeholder={'{\n  "schema": "wing-engine/list@1", ...\n}'}
										data-testid="import-json"
										class="mt-0.5 w-full resize-y rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-1 font-mono text-[10px] text-secondary hover:border-white/40 focus:text-white"
									></textarea>
								</label>
								<div class="mt-1 flex flex-wrap items-center gap-2">
									<button
										type="button"
										disabled={busy || importText.trim().length === 0}
										data-testid="import-list"
										class="rounded-sm border border-border-dark px-2 py-1 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
										onclick={() => importPasted()}
									>
										import list
									</button>
									<label class="text-[10px] text-secondary/70">
										<span>or choose a .json file</span>
										<input
											type="file"
											accept="application/json,.json"
											data-testid="import-file"
											class="mt-0.5 block text-[10px] text-secondary file:mr-2 file:rounded-sm file:border file:border-border-dark file:bg-terminal-panel file:px-1.5 file:py-0.5 file:text-[10px] file:text-secondary"
											onchange={importFile}
										/>
									</label>
								</div>
							</div>
							{#if listError}
								<div
									role="alert"
									data-testid="list-error"
									class="mt-2 rounded-sm border border-rebel/50 bg-rebel/10 px-1.5 py-1 text-[10px] text-rebel"
								>
									{listError}
								</div>
							{/if}
							{#if listNotice}
								<div
									role="status"
									data-testid="list-notice"
									class="mt-2 rounded-sm border border-border-dark px-1.5 py-1 text-[10px] text-secondary/70"
								>
									{listNotice}
								</div>
							{/if}
							{#if savedSquadsError}
								<div
									role="status"
									data-testid="saved-squads-error"
									class="mt-2 rounded-sm border border-border-dark px-1.5 py-1 text-[10px] text-secondary/70"
								>
									{savedSquadsError}
								</div>
							{/if}
						</div>
						<div class="mt-3 grid gap-3 sm:grid-cols-2">
							{#each customSides as side (side.player)}
								{@const sideTotal = totals?.sides[side.player]}
								<div
									class="rounded-sm border border-border-dark/70 p-2"
									data-testid={`custom-side-${side.player}`}
								>
									<div class="flex flex-wrap items-baseline justify-between gap-1">
										<span class="text-[11px] text-primary">
											{side.label} · {sideTotal?.faction ?? side.faction}
										</span>
										<span
											class="font-mono text-[10px] text-secondary/70"
											data-testid={`side-ship-count-${side.player}`}
										>
											{side.ships.length} ships
										</span>
									</div>
									<div class="mt-1 flex flex-wrap gap-1">
										<button
											type="button"
											disabled={busy || side.ships.length >= loadoutCatalog.max_ships}
											aria-label={`Add a ship to player ${side.player + 1}`}
											data-testid={`add-ship-${side.player}`}
											class="rounded-sm border border-border-dark px-1.5 py-0.5 text-[10px] text-secondary hover:border-white/40 hover:text-white disabled:opacity-50"
											onclick={() => addShip(side.player)}
										>
											+ add ship
										</button>
									</div>
									<PilotBrowser
										pilots={browserPilots}
										onadd={(pilot) => addBrowsed(side.player, pilot)}
										onassign={browseTargets[side.player] === null
											? null
											: (pilot) => assignBrowsed(side.player, pilot)}
										assignIndex={browseTargets[side.player]}
										atMax={side.ships.length >= loadoutCatalog.max_ships}
										unavailable={(pilot) => pilotUnavailable(side.player, pilot)}
									/>
									<div class="mt-2 space-y-2">
										{#each side.ships as _, index (index)}
											{@const pilot = lineupPilot(side.player, index)}
											{@const slotPlan = slotPlanFor(side.player, index)}
											{@const slots = slotPlan.slots}
											{@const flat = lineupFlatIndex(side.player, index)}
											{@const shipTotal = totals?.ships[flat]}
											{#if pilot}
												<div
													class="rounded-sm border border-border-dark/60 p-1.5"
													data-testid={`custom-ship-${flat}`}
												>
													<div class="flex flex-wrap items-baseline justify-between gap-1">
														<span class="text-[11px] text-primary">{pilot.name}</span>
														<span class="flex flex-wrap gap-1">
															<button
																type="button"
																disabled={busy}
																aria-pressed={browseTargets[side.player] === index}
																aria-label={`Browse pilots for ship ${index + 1} on player ${side.player + 1}`}
																data-testid={`browse-ship-${side.player}-${index}`}
																class="rounded-sm border border-border-dark px-1 py-0.5 text-[10px] text-secondary/70 hover:border-white/40 hover:text-white disabled:opacity-40"
																onclick={() => toggleBrowse(side.player, index)}
															>
																{browseTargets[side.player] === index ? 'browsing' : 'browse'}
															</button>
															<button
																type="button"
																disabled={busy || side.ships.length <= loadoutCatalog.min_ships}
																aria-label={`Remove ${pilot.name} from player ${side.player + 1}`}
																data-testid={`remove-ship-${side.player}-${index}`}
																class="rounded-sm border border-border-dark px-1 py-0.5 text-[10px] text-secondary/70 hover:border-rebel/60 hover:text-rebel disabled:opacity-40"
																onclick={() => removeShip(side.player, index)}
															>
																remove
															</button>
														</span>
													</div>
													<div class="text-[10px] text-secondary/60">
														{customPilotShipLabel(pilot)} · I{pilot.initiative} · {pilot.points} squad pts ·
														{shipTotal?.loadout_spent ?? 0}/{pilot.loadout} loadout · A{pilot.attack}/
														Ag{pilot.agility}/H{pilot.hull}/S{pilot.shields}
													</div>
													<label class="mt-1 block text-[10px] text-secondary/70">
														<span>Pilot</span>
														<select
															value={pilot.id}
															disabled={busy}
															data-testid={`pilot-ship-${flat}`}
															class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
															onchange={(e) => {
																changePilot(
																	side.player,
																	index,
																	(e.currentTarget as HTMLSelectElement).value
																);
															}}
														>
															{#each pilotChoices(side.player) as option (option.id)}
																<option value={option.id}>
																	{option.name} · I{option.initiative} · {option.points} pts · loadout
																	{option.loadout}{option.unique
																		? ' · unique'
																		: option.limited > 0
																			? ` · limited ${option.limited}`
																			: ''}
																</option>
															{/each}
														</select>
													</label>
													<div
														class="mt-1 text-[10px] text-secondary/50"
														data-testid={`pilot-bar-${flat}`}
													>
														bar · {slots.filter((view) => view.visible).map((view) => view.slot.slot).join(' · ') || 'empty'}
													</div>
													<div class="mt-1 space-y-1.5">
														{#each slots.filter((view) => view.visible) as view (view.slot.index)}
													{@const slot = view.slot}
															<label class="block text-[10px] text-secondary/70">
																<span class="flex items-baseline justify-between gap-1">
																	<span>{slot.slot}{slot.fixed ? ' · fixed' : ''}{slot.conditional ? ' · conferred' : ''}</span>
																	{#if slot.fixed && slot.fixed_card}
																		<span>{slot.fixed_card.points} pts</span>
																	{/if}
																</span>
																{#if slot.fixed}
																	<div class="mt-0.5 rounded-sm border border-border-dark px-1.5 py-0.5 text-secondary/60">
																		{slot.fixed_card?.name ?? 'fixed card'}
																	</div>
																{:else}
																	<select
																		value={slotValue(side.player, index, slot.key, slot.default_option)}
																		disabled={busy || !view.enabled}
																		data-testid={`loadout-ship-${flat}-${slot.key}`}
																		class="mt-0.5 w-full rounded-sm border border-border-dark bg-terminal-panel px-1.5 py-0.5 text-[11px] text-secondary hover:border-white/40 focus:text-white"
																		onchange={(e) => {
																			changeSlot(
																				side.player,
																				index,
																				slot.key,
																				(e.currentTarget as HTMLSelectElement).value
																			);
																		}}
																	>
																		<option value="">Empty</option>
																		{#each slot.options as option (option.id)}
																			<option value={option.id}>
																				{option.name} · {option.points} pts · {option.factions.join(
																					' / '
																				)}{option.unique
																					? ' · unique'
																					: option.limited > 0
																						? ` · limited ${option.limited}`
																						: ''}{option.id === slot.default_option ? ' · default' : ''}
																			</option>
																		{/each}
																	</select>
																{#if view.reason}
																	<div class="mt-0.5 text-[9px] text-rebel/80" data-testid={`slot-reason-${flat}-${slot.key}`}>
																		{view.reason}
																	</div>
																{/if}
																{#if !view.enabled && view.option}
																	<button
																		type="button"
																		disabled={busy}
																		class="mt-0.5 rounded-sm border border-border-dark px-1 py-0.5 text-[9px] text-secondary/70 hover:border-rebel/60 hover:text-rebel disabled:opacity-40"
																		onclick={() => changeSlot(side.player, index, slot.key, '')}
																	>
																		clear
																	</button>
																{/if}
																{/if}
															</label>
														{/each}
													</div>
												</div>
											{/if}
										{/each}
									</div>
									<div class="mt-2 flex flex-wrap gap-1 text-[10px]">
										<span
											data-testid={`side-legality-${side.player}`}
											title={sideTotal?.reasons.join('; ') ?? ''}
											class={!sideTotal?.legal_50
												? 'rounded-sm border border-rebel/50 bg-rebel/10 px-1.5 py-0.5 text-rebel'
												: 'rounded-sm border border-border-dark px-1.5 py-0.5 text-secondary/70'}
										>
											{sideTotal?.ship_count ?? side.ships.length} ships · {sideTotal?.points ?? 0} /
											{sideTotal?.point_cap ?? activeFormat?.listbuilding.points_max ?? 0} pts · legal
											{sideTotal?.legal_50 ? 'yes' : 'no'}{sideTotal?.reasons.length
												? ` · ${sideTotal.reasons.join('; ')}`
												: ''}
										</span>
									</div>
								</div>
							{/each}
						</div>
						<div class="mt-2 flex flex-wrap gap-2 text-[10px]">
							<span class="rounded-sm border border-border-dark px-1.5 py-0.5 text-secondary/70">
								total {totals?.total ?? 0} squad pts · legal {totals?.legal_50 ? 'yes' : 'no'}
							</span>
						</div>
						<p class="mt-2 text-[10px] text-secondary/50">
							{loadoutCatalog.legality_note}
							Pilot pool: {loadoutCatalog.pilot_pool_report.pool_rows} of
							{loadoutCatalog.pilot_pool_report.committed_rows} committed rows, of which
							{loadoutCatalog.pilot_pool_report.curated_rows} are the original curated subset;
							{loadoutCatalog.pilot_pool_report.omitted_rows} rows are omitted server-side with a
							reason. Data gaps: {loadoutCatalog.data_gaps.compiled_without_listbuilding} compiled
							cards without a listbuilding row; {loadoutCatalog.data_gaps.excluded_slot_rewriting}
							slot-rewriting cards excluded; {loadoutCatalog.data_gaps.uncatalogued_slot_rewriting ?? 0}
							rewriting rows reported with an exact reason. The server re-runs the validator on the selected pilots
							and cards.
						</p>
					</div>
				{:else if isCustom}
					<div class="rounded-sm border border-border-dark p-3 text-[11px] text-secondary/60">
						loading compiled loadout catalog…
					</div>
				{/if}
				<CardPresetPreview
					preset={selectedPreset}
					catalog={isCustom ? loadoutCatalog : null}
					multiSelections={isCustom ? null : multiSelections}
					pilotSelections={isCustom ? {} : pilotSelections}
					customShips={isCustom ? customPreview : null}
					shipPoints={isCustom ? shipPointMap : {}}
					{hotseat}
				/>
			{:else if formatChoice === 'standard-50p' && squadChoice !== 'none'}
				<div class="rounded-sm border border-border-dark p-3 text-[11px] text-secondary/60">
					loading preset {squadChoice}…
				</div>
			{:else if epicFormat}
				<div
					class="rounded-sm border border-border-dark p-3 text-[11px] text-secondary/60"
					data-testid="epic-preview"
				>
					Epic XWA and Epic House are two-player, 100-point formats. The server builds both
					sides from its committed huge-ship squads (CR90 vs Raider, two escorts each); the
					create request carries the selected format and no Standard or card-demo squad.
				</div>
			{:else}
				<div class="rounded-sm border border-border-dark p-3 text-[11px] text-secondary/60">
					No card preset selected. The Standard default remains the no-card game.
				</div>
			{/if}
			{#if error}
				<div class="rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-[11px] text-rebel">
					{error}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex h-screen flex-col items-center justify-center gap-3 bg-terminal-bg text-primary">
		<div class="text-sm font-semibold tracking-wide">WING-ENGINE</div>
		{#if error}
			<div class="max-w-md rounded-sm border border-rebel/50 bg-rebel/10 p-3 text-center text-sm text-rebel">
				{error}
			</div>
			<button
				type="button"
				class="rounded-sm border border-border-dark px-3 py-1.5 text-[11px] text-secondary hover:border-white/40 hover:text-white"
				onclick={start}
			>
				try again
			</button>
		{:else}
			<div class="text-sm text-secondary">starting {formatChoice} game…</div>
		{/if}
	</div>
{/if}
