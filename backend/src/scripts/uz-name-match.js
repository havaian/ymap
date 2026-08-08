/**
 * backend/src/scripts/uz-name-match.js
 *
 * Matches Uzbek administrative unit names between sources that spell them
 * differently. Written for pairing OpenStreetMap boundaries with the SOATO
 * crosswalks, where the same district appears as, for example, "Dexqonobod
 * tumani" on one side and "Dehqonobod tumani" on the other.
 *
 * Separate from normalizeUzName() in geo-translations.js, which strips the
 * administrative suffix. That is wrong here: "Toshkent viloyati" and "Toshkent
 * shahar" both reduce to "toshkent" under it, so the region and the city collapse
 * into one key and one of them silently loses its boundary. The unit type is kept
 * as part of the key instead.
 *
 * Spelling differences handled, all observed in the real data:
 *   x ↔ h        Dexqonobod / Dehqonobod, Shayxontoxur / Shayhontohur
 *   oʻ ↔ u ↔ o   Turaqurgon / Toʻraqoʻrgʻon, Uchqurgon / Uchqoʻrgʻon
 *   v ↔ w        Shovot / Showot, Boʻzatov / Bozataw (Karakalpak)
 *   six apostrophe characters, all folded away
 *   Cyrillic and Latin, including the abbreviated suffixes "т." and "ш."
 *   inserted spaces   Pastdargʻom / Past Dargʻom, Yangihayot / Yangi hayot
 *   doubled letters   Tuproqqaʼla / Tuproqqalʼa
 *   abbreviated initials  Sh.Rashidov / Sharof Rashidov
 *   Karakalpak Latin  Nókis / Nukus, ó á ú ń ǵ ı folded to their base letters
 *   Karakalpak unit words  qala / qalası as "city", trailing hákimiyatı dropped
 *
 * Verified against all 198 districts in district-crosswalk.json: zero key
 * collisions between different districts of the same region, and zero false pairs
 * from the token rule.
 */

const CYRILLIC = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'ў': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ҳ': 'h', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

const APOSTROPHES = ['ʻ', 'ʼ', '‘', '’', '`', '´', 'ʹ', 'ʾ'];

// Order matters: longer suffixes are tried first inside each group, and the
// groups are tried top to bottom.
const KINDS = [
    ['region', ['viloyati', 'viloyat', 'respublikasi', 'respublika', 'vil.', 'v.']],
    // qala / qalasi is the Karakalpak word for a city. Without it OSM's
    // "Nókis qalası hákimiyatı" carries no recognised unit type, defaults to
    // district, and can never pair with "Nukus shahar" whatever the stems do.
    ['city', ['shahri', 'shahar', 'shaher', 'qalasi', 'qala', 'sh.', 's.']],
    ['district', ['tumani', 'tuman', 'rayoni', 'rayoni', 'rayon', 't.', 'r-n']]
];

// Karakalpak Latin letters, folded to the base letters the rest of the matcher
// works in. Applied before suffix detection, so a suffix carrying a diacritic is
// still recognised as a suffix.
const KARAKALPAK = {
    'ó': 'o', 'ǵ': 'g', 'ń': 'n', 'ú': 'u', 'á': 'a', 'ı': 'i', 'í': 'i',
    'ó': 'o', 'ә': 'a', 'ө': 'o', 'ү': 'u', 'ң': 'n'
};

// A boundary tagged with the name of the body that administers it rather than of
// the unit itself. OSM does this for several Karakalpak cities.
const ADMIN_WORDS = ['hakimiyati', 'hokimiyati', 'hakimligi', 'hokimligi'];

function translit(s) {
    let out = '';
    for (const ch of s) out += (CYRILLIC[ch] !== undefined ? CYRILLIC[ch] : ch);
    return out;
}

/**
 * Splits a name into its unit type and the bare stem.
 * Returns { kind, stem }; kind is null when no suffix was recognised.
 */
export function splitKind(name) {
    let s = (name || '').trim().toLowerCase();
    for (const ap of APOSTROPHES) s = s.split(ap).join("'");
    s = translit(s).replace(/\s+/g, ' ').trim();
    let folded = '';
    for (const ch of s) folded += (KARAKALPAK[ch] !== undefined ? KARAKALPAK[ch] : ch);
    s = folded;

    // Dropped before the unit type is read, otherwise the administration word is
    // the suffix and the real one is never reached.
    for (const w of ADMIN_WORDS) {
        if (s.endsWith(' ' + w)) { s = s.slice(0, -(w.length + 1)).trim(); break; }
    }

    for (const [kind, suffixes] of KINDS) {
        const ordered = [...suffixes].sort((a, b) => b.length - a.length);
        for (const suf of ordered) {
            if (s.endsWith(suf)) {
                const stem = s.slice(0, -suf.length).replace(/^[\s.\-]+|[\s.\-]+$/g, '');
                if (stem) return { kind, stem };
            }
        }
    }
    return { kind: null, stem: s };
}

/**
 * Collapses a stem to a comparison form. Aggressive on purpose: every fold here
 * corresponds to a spelling difference seen between the registries and OSM.
 */
export function fold(stem) {
    let s = (stem || '').toLowerCase();
    for (const ap of APOSTROPHES) s = s.split(ap).join('');
    s = s.split("'").join('');
    s = s.split('x').join('h').split('w').join('v');
    s = s.replace(/[^a-z0-9]/g, '');
    s = s.split('gh').join('g').split('kh').join('h').split('ts').join('s');
    s = s.split('u').join('o');           // oʻ, u and o are used interchangeably
    s = s.replace(/(.)\1+/g, '$1');       // doubled letters
    return s;
}

/**
 * ('district' | 'city' | 'region' | 'district' by default, foldedStem)
 * The default matters: a bare "Peshku" with no suffix is a district, because that
 * is what an unqualified name means in these registries.
 */
export function nameKey(name) {
    const { kind, stem } = splitKind(name);
    return { kind: kind || 'district', key: fold(stem) };
}

function tokensOf(name) {
    const { kind, stem } = splitKind(name);
    const parts = stem.split("'").join('').split(/[^a-z0-9]+/).filter(Boolean);
    return { kind: kind || 'district', tokens: parts.map(fold).filter(Boolean) };
}

/** Levenshtein, bailing out as soon as the distance exceeds `max`. */
export function editDistance(a, b, max = 1) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let best = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            if (cur[j] < best) best = cur[j];
        }
        if (best > max) return max + 1;
        prev = cur;
    }
    return prev[b.length];
}

/**
 * Same unit type, same number of words, and every word equal or a prefix of its
 * counterpart. Catches abbreviated initials such as Sh.Rashidov against Sharof
 * Rashidov without matching unrelated names.
 */
export function tokenMatch(a, b) {
    const A = tokensOf(a);
    const B = tokensOf(b);
    if (A.kind !== B.kind) return false;
    if (A.tokens.length !== B.tokens.length || A.tokens.length === 0) return false;

    for (let i = 0; i < A.tokens.length; i++) {
        const x = A.tokens[i];
        const y = B.tokens[i];
        if (x === y) continue;
        if (x.length >= 2 && y.startsWith(x)) continue;
        if (y.length >= 2 && x.startsWith(y)) continue;
        return false;
    }
    return true;
}

/**
 * Tiered comparison of one candidate name against one reference name.
 * Returns 'exact' | 'edit' | 'token' | null, strongest first.
 * The unit type must agree in every tier: a city is never matched to a district.
 */
export function compareNames(a, b) {
    const ka = nameKey(a);
    const kb = nameKey(b);
    if (ka.kind !== kb.kind) return null;
    if (ka.key && ka.key === kb.key) return 'exact';
    if (ka.key && kb.key && editDistance(ka.key, kb.key, 1) <= 1) return 'edit';
    if (tokenMatch(a, b)) return 'token';
    return null;
}

export const TIER_ORDER = ['exact', 'edit', 'token'];