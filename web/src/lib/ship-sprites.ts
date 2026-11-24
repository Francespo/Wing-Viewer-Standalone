/**
 * True-scale TTS ship sprites.
 *
 * Each sprite is a top-down render of the TTS X-Wing Unified model with
 * Dim.lua fixed scale (0.629 / 0.03637 = 17.295 mm per OBJ unit), rendered
 * at 16 px/mm inside a fixed millimetre window (`win_mm`). The viewer draws
 * the image at win_mm svg units, so the ship appears at its real footprint
 * in millimetres next to its base (criteria T3/T4).
 */
import MANIFEST from './true-manifest.json';
import FAKE3D from './fake3d-sprites.json';

const MANIFEST_TYPED = MANIFEST as unknown as Record<string, { win_mm: number; fp_mm: [number, number] }>;
/** Real scanned 3D ship models (TTS + Fly Casual), rendered top-down with
 *  alpha at true millimetre scale. Preferred over the older flat renders. */
const FAKE3D_TYPED = FAKE3D as unknown as Record<
	string,
	{ dir: string; top: string; win_mm: number; fp_mm: [number, number] }
>;

/** TTS xws id per silhouette key (ship-art.ts). */
export const KEY2XWS: Record<string, string> = {
	't-65-xwing': 't65xwing',
	't-70-xwing': 't70xwing',
	'btl-a4-ywing': 'btla4ywing',
	'b-wing': 'asf01bwing',
	'delta-7': 'delta7aethersprite',
	'delta-7b': 'delta7aethersprite',
	'eta-2': 'eta2actis',
	'z95': 'clonez95headhunter',
	'rz-1-awing': 'rz1awing',
	'rz-2-awing': 'rz2awing',
	'tie-fo': 'tiefofighter',
	'tie-sf': 'tiesffighter',
	'tie-ln': 'tielnfighter',
	'tie-ba': 'tiebainterceptor',
	'tie-vn': 'tievnsilencer',
	'tie-x1': 'tieadvancedx1',
	'tie-v1': 'tieadvancedv1',
	'tie-adv': 'tieadvancedx1',
	'tie-in': 'tieininterceptor',
	'tie-sk': 'tieskstriker',
	'tie-bomber': 'tiesabomber',
	'vulture': 'vultureclassdroidfighter',
	'hyena': 'hyenaclassdroidbomber',
	'arc-170': 'arc170starfighter',
	'firespray': 'firesprayclasspatrolcraft',
	'fang': 'fangfighter',
	'hwk-290': 'hwk290lightfreighter',
	'vcx-100': 'vcx100lightfreighter',
	'yt-1300': 'modifiedyt1300lightfreighter',
	'yt-2400': 'yt2400lightfreighter',
	'belbullab': 'belbulab22starfighter',
	'nantex': 'nantexclassstarfighter',
	'rogue': 'rogueclassstarfighter',
	'g-1a': 'g1astarfighter',
	'jumpmaster-5000': 'jumpmaster5000',
	'lambda-shuttle': 'lambdaclasst4ashuttle',
	'upsilon-shuttle': 'upsilonclasscommandshuttle',
	'laat': 'laatigunship',
	'starviper': 'starviperclassattackplatform',
	'kimogila': 'm12lkimogilafighter',
	'auzituck': 'auzituckgunship',
	'k-wing': 'btls8kwing',
	'ks': 'tieskstriker'
};

/** Direct printed ship name (lowercase) -> TTS xws id for all 85 ships. */
const PRINTED2XWS: Record<string, string> = {
	'a/sf-01 b-wing': 'asf01bwing',
	'aggressor assault fighter': 'aggressorassaultfighter',
	'alpha-class star wing': 'alphaclassstarwing',
	'arc-170 starfighter': 'arc170starfighter',
	'attack shuttle': 'attackshuttle',
	'auzituck gunship': 'auzituckgunship',
	'bta-nr2 y-wing': 'btanr2ywing',
	'btl-a4 y-wing': 'btla4ywing',
	'btl-b y-wing': 'btlbywing',
	'btl-s8 k-wing': 'btls8kwing',
	'belbullab-22 starfighter': 'belbulab22starfighter',
	'c-roc cruiser': 'croccruiser',
	'cr90 corellian corvette': 'cr90corelliancorvette',
	'clone z-95 headhunter': 'clonez95headhunter',
	'customized yt-1300 light freighter': 'customizedyt1300lightfreighter',
	'delta-7 aethersprite': 'delta7aethersprite',
	'delta-7b aethersprite': 'delta7aethersprite',
	'droid tri-fighter': 'droidtrifighter',
	'e-wing': 'ewing',
	'escape craft': 'escapecraft',
	'eta-2 actis': 'eta2actis',
	'fang fighter': 'fangfighter',
	'fireball': 'fireball',
	'firespray-class patrol craft': 'firesprayclasspatrolcraft',
	'g-1a starfighter': 'g1astarfighter',
	'gr-75 medium transport': 'gr75mediumtransport',
	'gauntlet fighter': 'gauntletfighter',
	'gozanti-class cruiser': 'gozanticlasscruiser',
	'hmp droid gunship': 'hmpdroidgunship',
	'hwk-290 light freighter': 'hwk290lightfreighter',
	'hyena-class droid bomber': 'hyenaclassdroidbomber',
	'jumpmaster 5000': 'jumpmaster5000',
	'kihraxz fighter': 'kihraxzfighter',
	'laat/i gunship': 'laatigunship',
	'lambda-class t-4a shuttle': 'lambdaclasst4ashuttle',
	'lancer-class pursuit craft': 'lancerclasspursuitcraft',
	'm12-l kimogila fighter': 'm12lkimogilafighter',
	'm3-a interceptor': 'm3ainterceptor',
	'mg-100 starfortress': 'mg100starfortress',
	'modified tie/ln fighter': 'modifiedtielnfighter',
	'modified yt-1300 light freighter': 'modifiedyt1300lightfreighter',
	'naboo royal n-1 starfighter': 'nabooroyaln1starfighter',
	'nantex-class starfighter': 'nantexclassstarfighter',
	'nimbus-class v-wing': 'nimbusclassvwing',
	'quadrijet transfer spacetug': 'quadrijettransferspacetug',
	'rz-1 a-wing': 'rz1awing',
	'rz-2 a-wing': 'rz2awing',
	'raider-class corvette': 'raiderclasscorvette',
	'resistance transport': 'resistancetransport',
	'resistance transport pod': 'resistancetransportpod',
	'rogue-class starfighter': 'rogueclassstarfighter',
	'st-70 assault ship': 'st70assaultship',
	'scavenged yt-1300': 'scavengedyt1300lightfreighter',
	'scurrg h-6 bomber': 'scurrgh6bomber',
	'sheathipede-class shuttle': 'sheathipedeclassshuttle',
	'sith infiltrator': 'sithinfiltrator',
	'starviper-class attack platform': 'starviperclassattackplatform',
	't-65 x-wing': 't65xwing',
	't-70 x-wing': 't70xwing',
	'tie advanced v1': 'tieadvancedv1',
	'tie advanced x1': 'tieadvancedx1',
	'tie reaper': 'tiereaper',
	'tie/d defender': 'tiededefender',
	'tie/ag aggressor': 'tieagaggressor',
	'tie/ba interceptor': 'tiebainterceptor',
	'tie/ca punisher': 'tiecapunisher',
	'tie/fo fighter': 'tiefofighter',
	'tie/in interceptor': 'tieininterceptor',
	'tie/ln fighter': 'tielnfighter',
	'tie/ph phantom': 'tiephphantom',
	'tie/rb heavy': 'tierbheavy',
	'tie/sa bomber': 'tiesabomber',
	'tie/se bomber': 'tiesebomber',
	'tie/sf fighter': 'tiesffighter',
	'tie/sk striker': 'tieskstriker',
	'tie/vn silencer': 'tievnsilencer',
	'tie/wi whisper modified interceptor': 'tiewiwhispermodifiedinterceptor',
	'trident-class assault ship': 'tridentclassassaultship',
	'ut-60d u-wing': 'ut60duwing',
	'upsilon-class command shuttle': 'upsilonclasscommandshuttle',
	'v-19 torrent starfighter': 'v19torrentstarfighter',
	'vcx-100 light freighter': 'vcx100lightfreighter',
	'vt-49 decimator': 'vt49decimator',
	'vulture-class droid fighter': 'vultureclassdroidfighter',
	'xi-class light shuttle': 'xiclasslightshuttle',
	'yt-2400 light freighter': 'yt2400lightfreighter',
	'yv-666 light freighter': 'yv666lightfreighter',
	'z-95-af4 headhunter': 'z95af4headhunter'
};

/** Pilot/variant slugs rendered in ux-benchmarks/models/true/. */
const KNOWN_VARIANTS = [
	'lukeskywalker',
	'wedge',
	'red',
	'macewindu',
	'anakinskywalker',
	'plokoon',
	'obiwankenobi',
	'aaylasecura',
	'shaakti',
	'yoda',
	'greenq',
	'arvelcrynyd',
	'jakefarrell',
	'sabinewren',
	'blue',
	'black',
	'green',
	'orange',
	'grey'
];

function manifestFor(file: string): number | null {
	const e = MANIFEST_TYPED[file];
	return e ? e.win_mm : null;
}

/** Resolve TTS xws slug from either ship printed name or shipShape key. */
export function resolveXws(keyOrShip: string, printedShip?: string): string | null {
	if (printedShip) {
		const low = printedShip.trim().toLowerCase();
		if (PRINTED2XWS[low]) return PRINTED2XWS[low];
		const slug = low.replace(/[^a-z0-9]/g, '');
		if (MANIFEST_TYPED[`${slug}-top.png`]) return slug;
	}
	const lowKey = keyOrShip.trim().toLowerCase();
	if (PRINTED2XWS[lowKey]) return PRINTED2XWS[lowKey];
	if (KEY2XWS[lowKey]) return KEY2XWS[lowKey];
	const slug = lowKey.replace(/[^a-z0-9]/g, '');
	if (MANIFEST_TYPED[`${slug}-top.png`]) return slug;
	return null;
}

/** True-scale sprite for a ship def, or null (silhouette fallback). */
export function shipSprite(
	key: string,
	name: string | undefined,
	printedShip?: string
): { src: string; win_mm: number; fp_mm?: [number, number] } | null {
	const xws = resolveXws(key, printedShip);
	if (!xws) return null;
	// Prefer the real 3D scanned model (multi-angle render, alpha, true mm).
	const f3 = FAKE3D_TYPED[xws];
	if (f3) {
		return {
			src: `/models/fake3d/sprites/${f3.dir}/${f3.top}`,
			win_mm: f3.win_mm,
			fp_mm: f3.fp_mm
		};
	}
	if (name) {
		const pilotSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
		const hit = KNOWN_VARIANTS.find((p) => pilotSlug.includes(p) || p.startsWith(pilotSlug.slice(0, 5)));
		if (hit) {
			const fn = `${xws}-${hit}-top.png`;
			const entry = MANIFEST_TYPED[fn];
			if (entry) return { src: `/models/true/${fn}`, win_mm: entry.win_mm, fp_mm: entry.fp_mm };
		}
	}
	const fn = `${xws}-top.png`;
	const entry = MANIFEST_TYPED[fn];
	if (entry) return { src: `/models/true/${fn}`, win_mm: entry.win_mm, fp_mm: entry.fp_mm };
	return LEGACY_OK.includes(key) ? { src: `/models/${key}.png`, win_mm: LEGACY_WIN_MM } : null;
}

/** Legacy 512 sprites for the 10 ships whose orientation was verified. */
const LEGACY_OK = ['tie-fo', 'arc-170', 't-65-xwing', 'delta-7', 'tie-in', 'tie-x1', 'z95', 'btl-a4-ywing', 'rz-1-awing', 'rz-2-awing'];
const LEGACY_WIN_MM = 128;

/** TTS base size name from the base length in mm (Dim.lua: 40/60/80). */
export function baseSizeName(lengthMm: number): 'small' | 'medium' | 'large' {
	if (lengthMm >= 70) return 'large';
	if (lengthMm >= 50) return 'medium';
	return 'small';
}
