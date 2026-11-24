/** Rendering-only descriptions shown in the scenario picker, mirroring 4GG's
 * "A single contested objective at the centre…" copy. The engine owns rules;
 * these strings only describe what the selected scenario does. */

export const SCENARIO_INFO: Record<string, string> = {
	'none': 'No scenario: a plain 50-point game. Score mission points by damaging enemy ships.',
	'chance-engagement':
		'A single contested objective at the centre. One satellite sits at the centre of the board. Contest it while a ship of yours is within range 2; from round 2 you score at the start of the End Phase.',
	'assault-at-the-satellite-array':
		'Assault at the Satellite Array. Five satellites, placed before the obstacles. From round 2, score by controlling satellites; medium and large ships count as two.',
	'scramble-the-transmissions':
		'Scramble the Transmissions. Three satellites. From round 2, a ship may spend its Perform Action step to place a red or blue marker at range 0-1; markers alone decide the score.',
	'salvage-mission':
		'Salvage Mission. Five supply caches. Tow a cache on a ship card and jettison it under the opponent’s placement, on a critical damage, destruction or flee; score from caches on your cards from round 2.',
	'ancient-knowledge':
		'Ancient Knowledge. Three charge-bearing data caches. Transmit from an active cache at range 0-1 to gain the one-per-ship condition; score from condition-bearing ships from round 2.'
};

export function scenarioDescription(value: string): string {
	return SCENARIO_INFO[value] ?? 'No description available.';
}
