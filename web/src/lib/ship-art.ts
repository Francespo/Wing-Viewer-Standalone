/**
 * ship-art.ts — sagome top-down delle navi per il board.
 *
 * Solo rendering: niente regole di gioco, niente dati di bilanciamento.
 * Il board (web/src/lib/components/Board.svelte) disegna basi/poligoni in
 * coordinate mm con heading; questo modulo fornisce solo i `path` SVG.
 *
 * Convenzione coordinate (viewBox 0..100, centrato 50,50, nose = +Y up):
 *   - Il viewBox è `0 0 100 100`, centro (50,50).
 *   - Il muso punta verso il basso del viewBox? No: punta in alto, cioè
 *     verso y≈4 (prua) e la coda verso y≈94 (vedi engine +Y up in
 *     `web/src/lib/board.ts`: heading 0 = +Y, in SVG la prua è a y decrescente).
 *     In pratica: prua in alto (y piccola), coda in basso (y grande).
 *   - Ogni `path` resta dentro ~2..98 per lasciare spazio a stroke.
 *   - Ogni path è un singolo `d` (possibilmente più sotto-path `M...Z`
 *     per ali/cabine distaccate, es. i TIE) e sta sotto ~500 caratteri.
 *
 * Integrazione ipotetica nel board (NON fatta qui):
 *   translate(x y) rotate(heading) scale(baseWidth/100 * scale)
 *   con `<path d={shape.path} />` — `scale` ingrandisce gli scafi maggiori
 *   (Small=1, Medium≈1.2, Large≈1.35). Board.svelte NON è stato toccato.
 *
 * API:
 *   - `shipShape(name: string): ShipShape | null` — cerca per nome scafo
 *     stampato (es. "T-65 X-wing", "TIE/ln Fighter", "BTL-A4 Y-wing").
 *     Match case-insensitive, con alias per le forme brevi ("Firespray",
 *     "ARC-170", "YT-1300", "Lambda", "LAAT"...). Sconosciuto -> null
 *     (il board ricade nel rombo attuale).
 *   - `SHIP_SHAPES` — tabella `key -> ShipShape` per enumerare/debug.
 *   - `SHIP_ART_VIEWBOX` — "0 0 100 100".
 */

export interface ShipShape {
	/** Slug canonico dello scafo, es. "t-65-xwing". */
	key: string;
	/** `d` SVG in viewBox 0..100, centrato 50,50, muso in alto (y≈4). */
	path: string;
	/** Moltiplicatore di scala suggerito (Small=1, Medium≈1.2, Large≈1.35). */
	scale: number;
}

export const SHIP_ART_VIEWBOX = '0 0 100 100' as const;

// ---------------------------------------------------------------------------
// Path — viewBox 0..100, centro 50,50, muso in alto. Niente curve eccetto
// dove il cerchio/l'ellisse è essenziale (ali TIE/fo, dischi Falcon).
// ---------------------------------------------------------------------------

const P_XWING_T65 =
	'M50 4 L54 22 L57 30 L78 18 L73 30 L88 34 L59 46 L59 56 L80 66 L73 76 L57 66 L56 80 L54 94 L46 94 L44 80 L43 66 L27 76 L20 66 L41 56 L41 46 L12 34 L27 30 L22 18 L43 30 L46 22 Z';
const P_XWING_T70 =
	'M50 4 L55 20 L57 28 L77 16 L72 29 L89 33 L59 44 L59 54 L81 63 L74 74 L58 64 L57 78 L55 94 L45 94 L43 78 L42 64 L26 74 L19 63 L41 54 L41 44 L11 33 L28 29 L23 16 L43 28 L45 20 Z';
const P_TIE_LN =
	'M42 30 L58 30 L60 46 L58 60 L42 60 L40 46 Z M12 22 L34 28 L34 62 L12 68 L16 45 Z M88 22 L66 28 L66 62 L88 68 L84 45 Z';
const P_TIE_FO =
	'M42 30 L58 30 L59 60 L42 60 Z M20 28 A22 19 0 1 0 20 66 A22 19 0 1 0 20 28 Z M80 28 A22 19 0 1 0 80 66 A22 19 0 1 0 80 28 Z';
const P_TIE_SF =
	'M42 30 L58 30 L59 60 L42 60 Z M20 30 A22 17 0 1 0 20 64 A22 17 0 1 0 20 30 Z M80 30 A22 17 0 1 0 80 64 A22 17 0 1 0 80 30 Z M45 60 L55 60 L55 82 L45 82 Z';
const P_TIE_BA =
	'M44 36 L56 36 L57 56 L44 56 Z M46 30 L6 22 L12 45 L6 68 L46 60 Z M54 30 L94 22 L88 45 L94 68 L54 60 Z';
const P_TIE_IN =
	'M44 34 L56 34 L57 58 L44 58 Z M45 28 L10 34 L16 48 L10 62 L45 62 Z M55 28 L90 34 L84 48 L90 62 L55 62 Z';
const P_TIE_VN = 'M50 2 L56 18 L54 40 L62 78 L56 94 L50 90 L44 94 L38 78 L46 40 L44 18 Z';
const P_TIE_SK =
	'M50 6 L55 20 L88 50 L80 58 L56 34 L54 66 L50 84 L46 84 L46 66 L44 34 L20 58 L12 50 L45 20 Z';
const P_TIE_X1 =
	'M43 30 L57 30 L58 58 L43 58 Z M40 28 L10 20 L16 43 L10 66 L40 60 Z M60 28 L90 20 L84 43 L90 66 L60 60 Z';
const P_TIE_V1 =
	'M42 32 L58 32 L59 58 L42 58 Z M38 26 L8 36 L16 48 L8 60 L38 62 Z M62 26 L92 36 L84 48 L92 60 L62 62 Z';
const P_TIE_BOMBER =
	'M42 30 L58 30 L59 60 L42 60 Z M20 30 A14 20 0 1 0 20 70 A14 20 0 1 0 20 30 Z M80 30 A14 20 0 1 0 80 70 A14 20 0 1 0 80 30 Z M44 60 L56 60 L56 84 L44 84 Z';
const P_YWING =
	'M50 6 L58 20 L55 30 L64 44 L67 82 L60 88 L53 84 L50 62 L47 84 L40 88 L33 82 L36 44 L45 30 L42 20 Z';
const P_BWING =
	'M50 4 L54 20 L86 38 L86 46 L54 56 L54 94 L46 94 L46 56 L14 46 L14 38 L46 20 Z';
const P_AWING_RZ1 =
	'M50 4 L56 24 L72 78 L60 84 L52 60 L50 78 L48 60 L40 84 L28 78 L44 24 Z';
const P_AWING_RZ2 =
	'M50 4 L57 22 L78 74 L64 82 L54 58 L50 80 L46 58 L36 82 L22 74 L43 22 Z';
const P_FANG =
	'M50 6 L54 20 L78 36 L84 58 L66 52 L58 36 L57 74 L50 92 L43 74 L42 36 L34 52 L16 58 L22 36 L46 20 Z';
const P_Z95 =
	'M50 6 L53 14 L52 34 L88 38 L88 46 L52 48 L52 70 L56 90 L44 90 L48 70 L48 48 L12 46 L12 38 L48 34 L47 14 Z';
const P_FIRESPRAY =
	'M50 4 L58 16 L62 36 L60 62 L64 84 L54 92 L46 92 L36 84 L40 62 L38 36 L42 16 Z';
const P_ARC170 =
	'M50 6 L55 18 L58 30 L84 26 L88 34 L62 42 L62 58 L84 62 L86 70 L60 70 L58 86 L42 86 L40 70 L14 70 L16 62 L38 58 L38 42 L12 34 L16 26 L42 30 L45 18 Z';
const P_DELTA7 =
	'M50 2 L53 14 L52 34 L86 82 L74 88 L52 56 L50 88 L48 56 L26 88 L14 82 L48 34 L47 14 Z';
const P_DELTA7B =
	'M50 2 L54 14 L53 32 L88 80 L76 88 L53 54 L50 90 L47 54 L24 88 L12 80 L47 32 L46 14 Z';
const P_HWK290 =
	'M38 14 L62 14 L64 38 L70 84 L58 90 L42 90 L30 84 L36 38 Z M50 20 A8 8 0 1 0 50 36 A8 8 0 1 0 50 20 Z M50 58 A4 4 0 1 0 50 66 A4 4 0 1 0 50 58 Z';
const P_VCX100 =
	'M50 6 L56 24 L86 34 L82 44 L58 40 L58 72 L76 80 L70 90 L50 82 L30 90 L24 80 L42 72 L42 40 L18 44 L14 34 L44 24 Z';
const P_FALCON =
	'M50 30 A28 28 0 1 0 50 86 A28 28 0 1 0 50 30 Z M42 14 L46 32 L40 34 L36 18 Z M58 14 L54 32 L60 34 L64 18 Z';
const P_YT2400 =
	'M50 30 A26 26 0 1 0 50 82 A26 26 0 1 0 50 30 Z M40 14 L48 24 L44 32 L36 22 Z M42 78 L58 78 L56 90 L44 90 Z';
const P_HYENA =
	'M50 4 L56 20 L60 36 L86 30 L84 40 L60 44 L60 60 L78 78 L70 84 L54 70 L50 84 L46 70 L30 84 L22 78 L40 60 L40 44 L16 40 L14 30 L40 36 L44 20 Z';
const P_VULTURE =
	'M50 6 L54 22 L52 40 L78 36 L84 52 L58 50 L56 74 L50 88 L44 74 L42 50 L16 52 L22 36 L48 40 L46 22 Z';
const P_BELBULLAB =
	'M50 8 L57 26 L62 42 L88 42 L86 52 L60 52 L58 68 L80 82 L72 90 L52 74 L50 88 L48 74 L28 90 L20 82 L42 68 L40 52 L14 52 L12 42 L38 42 L43 26 Z';
const P_NANTEX =
	'M50 8 L57 30 L84 58 L76 64 L56 46 L54 80 L60 90 L40 90 L46 80 L44 46 L24 64 L16 58 L43 30 Z';
const P_ROGUE =
	'M50 4 L56 18 L86 30 L84 42 L58 44 L56 72 L64 86 L36 86 L44 72 L42 44 L16 42 L14 30 L44 18 Z';
const P_G1A = 'M42 10 L62 16 L66 34 L62 50 L72 84 L56 92 L44 84 L40 62 L36 44 L38 24 Z';
const P_JUMPMASTER = 'M36 20 L64 20 L78 38 L74 60 L62 78 L50 92 L38 78 L26 60 L22 38 Z';
const P_LAMBDA =
	'M50 6 L55 22 L56 40 L88 30 L90 40 L58 50 L56 68 L62 84 L52 88 L48 88 L38 84 L44 68 L42 50 L10 40 L12 30 L44 40 L45 22 Z';
const P_UPSILON =
	'M50 4 L58 30 L90 60 L82 70 L60 56 L56 80 L62 90 L38 90 L44 80 L40 56 L18 70 L10 60 L42 30 Z';
const P_ETA2 =
	'M50 2 L54 16 L52 36 L74 76 L64 84 L52 52 L50 88 L48 52 L36 84 L26 76 L48 36 L46 16 Z';
const P_LAAT = 'M40 10 L60 10 L64 26 L72 40 L68 64 L70 80 L56 90 L44 90 L30 80 L32 64 L28 40 L36 26 Z';
const P_GENERIC_SMALL =
	'M50 4 L55 22 L74 64 L62 72 L53 50 L52 88 L48 88 L47 50 L38 72 L26 64 L45 22 Z';
const P_GENERIC_MEDIUM = 'M40 10 L60 10 L64 30 L76 52 L70 84 L56 92 L44 92 L30 84 L24 52 L36 30 Z';
const P_GENERIC_LARGE = 'M42 8 L58 8 L64 28 L82 52 L74 84 L58 92 L42 92 L26 84 L18 52 L36 28 Z';
const P_STARVIPER =
	'M50 8 L56 26 L54 42 L82 40 L86 56 L58 54 L56 74 L50 90 L44 74 L42 54 L14 56 L18 40 L46 42 L44 26 Z';
const P_KIMOGILA = 'M44 8 L58 16 L70 40 L64 72 L54 90 L46 90 L36 72 L30 40 L42 16 Z';
const P_AUZITUCK = 'M44 14 L56 14 L60 34 L66 62 L62 84 L38 84 L34 62 L40 34 Z';
const P_KWING =
	'M50 6 L56 20 L58 34 L84 30 L88 38 L60 46 L58 70 L66 84 L34 84 L42 70 L40 46 L12 38 L16 30 L42 34 L44 20 Z';

// Tabella canonica: key slug -> ShipShape.
const SHAPES: Record<string, ShipShape> = {
	't-65-xwing': { key: 't-65-xwing', path: P_XWING_T65, scale: 1 },
	't-70-xwing': { key: 't-70-xwing', path: P_XWING_T70, scale: 1 },
	'tie-ln': { key: 'tie-ln', path: P_TIE_LN, scale: 1 },
	'tie-fo': { key: 'tie-fo', path: P_TIE_FO, scale: 1 },
	'tie-sf': { key: 'tie-sf', path: P_TIE_SF, scale: 1 },
	'tie-ba': { key: 'tie-ba', path: P_TIE_BA, scale: 1 },
	'tie-in': { key: 'tie-in', path: P_TIE_IN, scale: 1 },
	'tie-vn': { key: 'tie-vn', path: P_TIE_VN, scale: 1 },
	'tie-sk': { key: 'tie-sk', path: P_TIE_SK, scale: 1 },
	'tie-x1': { key: 'tie-x1', path: P_TIE_X1, scale: 1 },
	'tie-v1': { key: 'tie-v1', path: P_TIE_V1, scale: 1 },
	'tie-bomber': { key: 'tie-bomber', path: P_TIE_BOMBER, scale: 1 },
	'btl-a4-ywing': { key: 'btl-a4-ywing', path: P_YWING, scale: 1 },
	'b-wing': { key: 'b-wing', path: P_BWING, scale: 1 },
	'rz-1-awing': { key: 'rz-1-awing', path: P_AWING_RZ1, scale: 1 },
	'rz-2-awing': { key: 'rz-2-awing', path: P_AWING_RZ2, scale: 1 },
	'fang': { key: 'fang', path: P_FANG, scale: 1 },
	'z95': { key: 'z95', path: P_Z95, scale: 1 },
	'firespray': { key: 'firespray', path: P_FIRESPRAY, scale: 1.1 },
	'arc-170': { key: 'arc-170', path: P_ARC170, scale: 1.2 },
	'delta-7': { key: 'delta-7', path: P_DELTA7, scale: 1 },
	'delta-7b': { key: 'delta-7b', path: P_DELTA7B, scale: 1 },
	'hwk-290': { key: 'hwk-290', path: P_HWK290, scale: 1.05 },
	'vcx-100': { key: 'vcx-100', path: P_VCX100, scale: 1.35 },
	'yt-1300': { key: 'yt-1300', path: P_FALCON, scale: 1.35 },
	'yt-2400': { key: 'yt-2400', path: P_YT2400, scale: 1.25 },
	'hyena': { key: 'hyena', path: P_HYENA, scale: 1 },
	'vulture': { key: 'vulture', path: P_VULTURE, scale: 1 },
	'belbullab': { key: 'belbullab', path: P_BELBULLAB, scale: 1 },
	'nantex': { key: 'nantex', path: P_NANTEX, scale: 1 },
	'rogue': { key: 'rogue', path: P_ROGUE, scale: 1 },
	'g-1a': { key: 'g-1a', path: P_G1A, scale: 1.15 },
	'jumpmaster-5000': { key: 'jumpmaster-5000', path: P_JUMPMASTER, scale: 1.15 },
	'lambda-shuttle': { key: 'lambda-shuttle', path: P_LAMBDA, scale: 1.35 },
	'upsilon-shuttle': { key: 'upsilon-shuttle', path: P_UPSILON, scale: 1.35 },
	'eta-2': { key: 'eta-2', path: P_ETA2, scale: 1 },
	'laat': { key: 'laat', path: P_LAAT, scale: 1.2 },
	'generic-small': { key: 'generic-small', path: P_GENERIC_SMALL, scale: 1 },
	'generic-medium': { key: 'generic-medium', path: P_GENERIC_MEDIUM, scale: 1.2 },
	'generic-large': { key: 'generic-large', path: P_GENERIC_LARGE, scale: 1.5 },
	'starviper': { key: 'starviper', path: P_STARVIPER, scale: 1 },
	'kimogila': { key: 'kimogila', path: P_KIMOGILA, scale: 1.1 },
	'auzituck': { key: 'auzituck', path: P_AUZITUCK, scale: 1.05 },
	'k-wing': { key: 'k-wing', path: P_KWING, scale: 1.3 }
};

/** Tabella pubblica (per debug/enumerazione). */
export const SHIP_SHAPES: Readonly<Record<string, ShipShape>> = Object.freeze({ ...SHAPES });

// Alias normalizzati (lowercase) -> key canonica.
// Copre: nomi stampati esatti (da listbuilding-cards / xws-ships),
// forme brevi richieste dal task ("Firespray", "ARC-170", "Lambda", "LAAT"...)
// e varianti con/senza trattino costantemente.
const ALIASES: Record<string, string> = {
	// --- nomi stampati esatti (liste XWS, 89 nomi) ---
	'a/sf-01 b-wing': 'b-wing',
	'arc-170 starfighter': 'arc-170',
	'aggressor assault fighter': 'g-1a',
	'alpha-class star wing': 'k-wing',
	'attack shuttle': 'hwk-290',
	'auzituck gunship': 'auzituck',
	'bta-nr2 y-wing': 'btl-a4-ywing',
	'btl-a4 y-wing': 'btl-a4-ywing',
	'btl-b y-wing': 'btl-a4-ywing',
	'btl-s8 k-wing': 'k-wing',
	'belbullab-22 starfighter': 'belbullab',
	'c-roc cruiser': 'generic-medium',
	'cr90 corellian corvette': 'generic-large',
	'clone z-95 headhunter': 'z95',
	'customized yt-1300 light freighter': 'yt-1300',
	'delta-7 aethersprite': 'delta-7',
	'delta-7b aethersprite': 'delta-7b',
	'droid tri-fighter': 'hyena',
	'e-wing': 'generic-small',
	'escape craft': 'generic-small',
	'eta-2 actis': 'eta-2',
	'fang fighter': 'fang',
	'fireball': 'generic-small',
	'firespray-class patrol craft': 'firespray',
	'g-1a starfighter': 'g-1a',
	'gr-75 medium transport': 'generic-large',
	'gauntlet fighter': 'arc-170',
	'gozanti-class cruiser': 'generic-large',
	'hmp droid gunship': 'generic-medium',
	'hwk-290 light freighter': 'hwk-290',
	'hyena-class droid bomber': 'hyena',
	'jumpmaster 5000': 'jumpmaster-5000',
	'kihraxz fighter': 'generic-small',
	'laat/i gunship': 'laat',
	'lambda-class t-4a shuttle': 'lambda-shuttle',
	'lancer-class pursuit craft': 'generic-medium',
	'm12-l kimogila fighter': 'kimogila',
	'm3-a interceptor': 'tie-in',
	'mg-100 starfortress': 'generic-medium',
	'modified tie/ln fighter': 'tie-ln',
	'modified yt-1300 light freighter': 'yt-1300',
	'naboo royal n-1 starfighter': 'delta-7',
	'nantex-class starfighter': 'nantex',
	'nimbus-class v-wing': 'generic-small',
	'quadrijet transfer spacetug': 'generic-medium',
	'rz-1 a-wing': 'rz-1-awing',
	'rz-2 a-wing': 'rz-2-awing',
	'raider-class corvette': 'generic-large',
	'resistance transport': 'lambda-shuttle',
	'resistance transport pod': 'generic-small',
	'rogue-class starfighter': 'rogue',
	'st-70 assault ship': 'generic-small',
	'scavenged yt-1300': 'yt-1300',
	'scurrg h-6 bomber': 'generic-medium',
	'sheathipede-class shuttle': 'generic-small',
	'sith infiltrator': 'delta-7',
	'starviper-class attack platform': 'starviper',
	'syliure-class hyperspace ring': 'generic-small',
	't-65 x-wing': 't-65-xwing',
	't-70 x-wing': 't-70-xwing',
	'tie advanced v1': 'tie-v1',
	'tie advanced x1': 'tie-x1',
	'tie reaper': 'lambda-shuttle',
	'tie/d defender': 'tie-ln',
	'tie/ag aggressor': 'tie-v1',
	'tie/ba interceptor': 'tie-ba',
	'tie/ca punisher': 'tie-bomber',
	'tie/fo fighter': 'tie-fo',
	'tie/in interceptor': 'tie-in',
	'tie/ln fighter': 'tie-ln',
	'tie/ph phantom': 'tie-v1',
	'tie/rb heavy': 'tie-sf',
	'tie/sa bomber': 'tie-bomber',
	'tie/se bomber': 'tie-bomber',
	'tie/sf fighter': 'tie-sf',
	'tie/sk striker': 'tie-sk',
	'tie/vn silencer': 'tie-vn',
	'tie/wi whisper modified interceptor': 'tie-in',
	'trident-class assault ship': 'hyena',
	'ut-60d u-wing': 'generic-medium',
	'upsilon-class command shuttle': 'upsilon-shuttle',
	'v-19 torrent starfighter': 'generic-small',
	'vcx-100 light freighter': 'vcx-100',
	'vt-49 decimator': 'generic-medium',
	'vulture-class droid fighter': 'vulture',
	'xi-class light shuttle': 'generic-small',
	'yt-2400 light freighter': 'yt-2400',
	'yv-666 light freighter': 'generic-medium',
	'z-95-af4 headhunter': 'z95',
	// --- forme brevi / shorthand (task + uso comune) ---
	'x-wing': 't-65-xwing',
	'xwing': 't-65-xwing',
	't65 x-wing': 't-65-xwing',
	't65': 't-65-xwing',
	't-65': 't-65-xwing',
	't70 x-wing': 't-70-xwing',
	't70': 't-70-xwing',
	't-70': 't-70-xwing',
	'y-wing': 'btl-a4-ywing',
	'ywing': 'btl-a4-ywing',
	'btl-a4 ywing': 'btl-a4-ywing',
	'btl-a4': 'btl-a4-ywing',
	'b-wing': 'b-wing',
	'bwing': 'b-wing',
	'a/sf-01': 'b-wing',
	'a-wing': 'rz-1-awing',
	'awing': 'rz-1-awing',
	'rz-1': 'rz-1-awing',
	'rz1': 'rz-1-awing',
	'rz-2': 'rz-2-awing',
	'rz2': 'rz-2-awing',
	'fang': 'fang',
	'z-95 headhunter': 'z95',
	'z-95': 'z95',
	'z95 headhunter': 'z95',
	'z95': 'z95',
	'firespray': 'firespray',
	'firespray-class': 'firespray',
	'slave i': 'firespray',
	'arc-170': 'arc-170',
	'arc170': 'arc-170',
	'delta-7': 'delta-7',
	'delta7': 'delta-7',
	'delta7 aethersprite': 'delta-7',
	'delta-7b': 'delta-7b',
	'delta7b': 'delta-7b',
	'hwk-290': 'hwk-290',
	'hwk290': 'hwk-290',
	'vcx-100': 'vcx-100',
	'vcx100': 'vcx-100',
	'yt-1300': 'yt-1300',
	'yt1300': 'yt-1300',
	'falcon': 'yt-1300',
	'millennium falcon': 'yt-1300',
	'yt-2400': 'yt-2400',
	'yt2400': 'yt-2400',
	'hyena': 'hyena',
	'hyena-class': 'hyena',
	'vulture': 'vulture',
	'vulture-class': 'vulture',
	'belbullab': 'belbullab',
	'belbullab-22': 'belbullab',
	'belbullab22': 'belbullab',
	'nantex': 'nantex',
	'nantex-class': 'nantex',
	'rogue': 'rogue',
	'rogue-class': 'rogue',
	'g1-a': 'g-1a',
	'g-1a': 'g-1a',
	'g1a': 'g-1a',
	'jumpmaster': 'jumpmaster-5000',
	'punishing one': 'jumpmaster-5000',
	'interceptor': 'tie-in',
	'tie interceptor': 'tie-in',
	'tie/in': 'tie-in',
	'tie/ba': 'tie-ba',
	'tie/ln': 'tie-ln',
	'tie/fo': 'tie-fo',
	'tie/sf': 'tie-sf',
	'tie/vn': 'tie-vn',
	'tie/sk': 'tie-sk',
	'advanced x1': 'tie-x1',
	'tie/x1': 'tie-x1',
	'advanced v1': 'tie-v1',
	'shuttle lambda': 'lambda-shuttle',
	'lambda': 'lambda-shuttle',
	'lambda-class': 'lambda-shuttle',
	'lambda-class t-4a': 'lambda-shuttle',
	'upsilon': 'upsilon-shuttle',
	'upsilon-class': 'upsilon-shuttle',
	'eta-2': 'eta-2',
	'eta2': 'eta-2',
	'laat': 'laat',
	'laat/i': 'laat',
	'k-wing': 'k-wing',
	'kwing': 'k-wing',
	'starviper': 'starviper',
	'kimogila': 'kimogila'
};

function normalizeName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function compactName(s: string): string {
	return s.replace(/[^a-z0-9]/g, '');
}

function shapeByKey(key: string): ShipShape | null {
	const shape = SHAPES[key] as ShipShape | undefined;
	return shape ?? null;
}

/**
 * Restituisce la sagoma per il nome scafo stampato (es. "T-65 X-wing").
 * Sconosciuto -> null (il board ricade nel rombo attuale).
 */
export function shipShape(name: string): ShipShape | null {
	const normalized = normalizeName(name);
	if (normalized.length === 0) return null;

	const direct = ALIASES[normalized] as string | undefined;
	if (direct) return shapeByKey(direct);

	// Fallback fuzzy (solo per varianti non in tabella):
	// confronta senza punteggiatura/spazi e richiede input significativo.
	const compactInput = compactName(normalized);
	if (compactInput.length < 5) return null;

	let bestKey: string | null = null;
	let bestAlias = '';
	for (const alias of Object.keys(ALIASES)) {
		const compactAlias = compactName(alias);
		if (compactAlias.includes(compactInput) || compactInput.includes(compactAlias)) {
			if (alias.length > bestAlias.length) {
				bestAlias = alias;
				bestKey = ALIASES[alias] ?? null;
			}
		}
	}
	return bestKey ? shapeByKey(bestKey) : null;
}

/** Elenco delle sagome canoniche (utile per test/debug). */
export function listShipShapes(): ShipShape[] {
	return Object.values(SHAPES);
}
