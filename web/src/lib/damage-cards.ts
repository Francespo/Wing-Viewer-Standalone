/** Real printed damage card thumbnails (cropped from the scanned damage deck
 * atlas in static/models/damage-deck.png). Presentation only: the card name
 * comes from the engine's transcript text, never guessed in TypeScript. */
export const DAMAGE_CARD_FILES: Record<string, string> = {
	'Panicked Pilot': 'panickedpilot',
	'Blinded Pilot': 'blindedpilot',
	'Wounded Pilot': 'woundedpilot',
	'Stunned Pilot': 'stunnedpilot',
	'Console Fire': 'consolefire',
	'Damaged Engine': 'damagedengine',
	'Weapons Failure': 'weaponsfailure',
	'Hull Breach': 'hullbreach',
	'Structural Damage': 'structuraldamage',
	'Damaged Sensor Array': 'damagedsensorarray',
	'Loose Stabilizer': 'loosestabilizer',
	'Disabled Power Regulator': 'disabledpowerregulator',
	'Fuel Leak': 'fuelleak',
	'Direct Hit': 'directhit'
};

export function damageCardSrc(name: string): string | null {
	const file = DAMAGE_CARD_FILES[name.trim()];
	return file ? `/models/damage/${file}.png` : null;
}
