/**
 * backend/src/scripts/probe-missing-boundaries.js
 *
 * Asks OpenStreetMap what it actually holds for the crosswalk entries that found
 * no boundary, instead of guessing why they failed.
 *
 * The nine that are missing split into two different problems, and the fix is
 * different for each, so the first job is telling them apart:
 *
 *   - Seven are cities: Jizzax, Shahrisabz, Termiz, Bekobod, Yangiyoʻl, Urganch,
 *     Xiva. OSM does return some Uzbek cities at admin_level=6 - Yangiyer,
 *     Xonobod and Gʻozgʻon all came back in the last run - so the level is not
 *     uniformly wrong. The likely story is that these seven sit at a different
 *     admin_level, which is a mapping inconsistency upstream and not something
 *     the matcher can repair.
 *   - Two are districts: Xatirchi and Nurobod. Neither appeared in the response
 *     at all, under any name.
 *
 * This script searches admin_level 4 through 9 by name, reports what it finds
 * with its level and its tags, and says for each entry which of the two cases it
 * is. Nothing is written and nothing is imported: the output is what decides
 * whether the query in fetch-osm-boundaries.js should be widened, whether a name
 * variant belongs in the crosswalk, or whether the boundary simply is not mapped.
 *
 * Name search is deliberately loose here - a substring on the folded stem, across
 * every name tag. This is a diagnostic, so a false positive costs a line of
 * output while a false negative costs the answer.
 *
 * Usage:
 *   node backend/src/scripts/probe-missing-boundaries.js
 *   node backend/src/scripts/probe-missing-boundaries.js --codes=1710405,1712251
 *   node backend/src/scripts/probe-missing-boundaries.js --max-level=10
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { splitKind, fold, compareNames } from './uz-name-match.js';

// The levels fetch-osm-boundaries.js already asks for. Without this the probe
// cannot tell "the unit is at a level we do not query" from "the unit is at a
// level we do query and the matcher still missed it" - and it reported the first
// when the truth was the second for all five it found.
const FETCHED_LEVELS = new Set(['3', '4', '6']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.osm.jp/api/interpreter'
];

const TIMEOUT_S = 300;
const MAX_RETRIES = 3;
const RETRY_BACKOFF = 15000;

const UNIT_LABEL = { district: 'район', city: 'город', region: 'область' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Every administrative relation in the country between two levels, with tags but
 * without geometry. `out tags` is what makes this cheap: the answer is a few
 * hundred names, not forty megabytes of rings, because nothing here is imported.
 */
function query(minLevel, maxLevel) {
    const levels = [];
    for (let l = minLevel; l <= maxLevel; l++) levels.push(String(l));
    return `[out:json][timeout:${TIMEOUT_S}];
area["ISO3166-1"="UZ"][admin_level=2]->.uz;
relation(area.uz)["boundary"="administrative"]["admin_level"~"^(${levels.join('|')})$"];
out tags;`;
}

async function runQuery(q) {
    let lastErr = null;
    for (const endpoint of ENDPOINTS) {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                console.log(`  → ${endpoint} (попытка ${attempt}/${MAX_RETRIES})`);
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded',
                        'user-agent': 'YMap-boundaries/1.0 (infrastructure analytics, Uzbekistan)'
                    },
                    body: 'data=' + encodeURIComponent(q)
                });
                const text = await res.text();
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
                const payload = JSON.parse(text);
                if (!Array.isArray(payload.elements)) throw new Error('в ответе нет elements');
                return payload;
            } catch (err) {
                lastErr = err;
                console.warn(`    ${err.message}`);
                if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF * attempt);
            }
        }
    }
    throw lastErr || new Error('все зеркала недоступны');
}

const NAME_KEYS = ['name', 'name:uz', 'name:oz', 'name:uz-Cyrl', 'name:uz-Latn',
    'name:ru', 'name:en', 'name:kaa', 'official_name', 'alt_name', 'int_name'];

function namesOf(tags) {
    const out = [];
    for (const k of NAME_KEYS) {
        const v = tags?.[k];
        if (typeof v === 'string' && v.trim()) out.push(v.trim());
    }
    return out;
}

function main2(entries, elements, maxLevel) {
    console.log(`\nВ ответе отношений: ${elements.length}`);
    const byLevel = {};
    for (const el of elements) byLevel[el.tags?.admin_level ?? '?'] = (byLevel[el.tags?.admin_level ?? '?'] || 0) + 1;
    console.log(`  по admin_level: ${JSON.stringify(byLevel)}`);

    let outsideLevel = 0;
    let matcherIssue = 0;
    let nameVariant = 0;
    let absent = 0;

    for (const e of entries) {
        const own = [...(e.nameLatin || []), ...(e.nameCyrillic || [])];
        const label = own[0] || e.districtCode;
        const kind = splitKind(label).kind;
        const stem = fold(splitKind(label).stem);

        console.log(`\n── ${e.districtCode}  ${own.join(' | ')}  (${UNIT_LABEL[kind] || 'тип не определён'})`);

        // Strict: the same test the importer uses, so a hit here means the
        // importer would have taken it.
        const strict = [];
        // Loose: stem appears anywhere in any name tag, whatever the unit word.
        const loose = [];

        for (const el of elements) {
            const names = namesOf(el.tags);
            if (names.length === 0) continue;
            if (names.some(n => own.some(o => compareNames(n, o)))) {
                strict.push(el);
                continue;
            }
            if (stem.length >= 4 && names.some(n => fold(splitKind(n).stem).includes(stem))) {
                loose.push(el);
            }
        }

        if (strict.length) {
            const levels = [...new Set(strict.map(el => String(el.tags.admin_level)))];
            const outsideQuery = levels.every(l => !FETCHED_LEVELS.has(l));
            console.log('   СОПОСТАВИЛОСЬ БЫ:');
            for (const el of strict.slice(0, 5)) {
                console.log(`     level=${el.tags.admin_level}  relation/${el.id}  ${namesOf(el.tags).slice(0, 3).join(' | ')}`);
            }
            if (outsideQuery) {
                outsideLevel++;
                console.log(`     → уровень ${levels.join(', ')} не запрашивается в fetch-osm-boundaries.js.`);
                console.log('       Чинится флагом --extra-district-levels=' + levels.join(','));
            } else {
                // The important case, and the one the first version of this probe
                // got wrong. The boundary is in the file the importer already
                // reads, so nothing about the query needs changing: something in
                // the matching is losing it. Usually a wrong name:ru on the
                // relation, which lets a different crosswalk entry claim it.
                matcherIssue++;
                console.log(`     → уровень ${levels.join(', ')} УЖЕ запрашивается, граница есть в файле.`);
                console.log('       Значит теряется при сопоставлении. Проверьте теги имён:');
                for (const el of strict.slice(0, 2)) {
                    const ru = el.tags['name:ru'];
                    const nm = el.tags.name;
                    if (ru && nm && !compareNames(nm, ru)) {
                        console.log(`       relation/${el.id}: name="${nm}" и name:ru="${ru}" - разные единицы.`);
                    }
                }
            }
        } else if (loose.length) {
            // A stem hit whose unit type differs is not the same place: Termiz
            // shahar and Termiz tumani are a city and the district around it.
            // Reporting that as "found under another name" sent the reader off to
            // add a name variant that would have attached the wrong polygon.
            const sameKind = loose.filter(el =>
                namesOf(el.tags).some(n => splitKind(n).kind === kind));
            console.log('   ПОХОЖЕЕ ПО ОСНОВЕ:');
            for (const el of loose.slice(0, 5)) {
                const elKind = splitKind(namesOf(el.tags)[0] || '').kind;
                const flag = elKind === kind ? '' : `  ← это ${UNIT_LABEL[elKind] || 'другой тип'}, не ${UNIT_LABEL[kind]}`;
                console.log(`     level=${el.tags.admin_level}  relation/${el.id}  ${namesOf(el.tags).slice(0, 3).join(' | ')}${flag}`);
            }
            if (sameKind.length) {
                nameVariant++;
                console.log('     → тот же тип единицы под другим именем.');
                console.log('       Решение: добавить вариант имени в district-crosswalk.json.');
            } else {
                absent++;
                console.log('     → все найденные - единицы ДРУГОГО типа, то есть другие места.');
                console.log(`       Самой единицы «${label}» в OSM нет. Кодом не чинится.`);
            }
        } else {
            absent++;
            console.log('   НЕ НАЙДЕНО ни на одном уровне до ' + maxLevel + '.');
            console.log('     → границы в OSM нет. Кодом это не чинится.');
        }
    }

    console.log('\n═══ Итог ═══');
    console.log(`  на незапрашиваемом уровне, чинится --extra-district-levels: ${outsideLevel}`);
    console.log(`  граница есть в файле, теряется при сопоставлении: ${matcherIssue}`);
    console.log(`  тот же тип под другим именем, чинится вариантом в кроссволке: ${nameVariant}`);
    console.log(`  единицы в OSM нет: ${absent}`);
}

async function main() {
    const args = process.argv.slice(2);
    const codesArg = args.find(a => a.startsWith('--codes='))?.split('=')[1];
    const maxLevel = Number(args.find(a => a.startsWith('--max-level='))?.split('=')[1]) || 9;

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее.');
        process.exit(1);
    }

    const cwPath = path.join(DATA_DIR, 'district-crosswalk.json');
    if (!fs.existsSync(cwPath)) {
        console.error(`❌ district-crosswalk.json не найден в ${DATA_DIR}`);
        process.exit(1);
    }
    const crosswalk = JSON.parse(fs.readFileSync(cwPath, 'utf-8'));

    // Default set: the nine that found no boundary in the last import run. Passing
    // --codes= replaces it, so this stays useful after the list changes.
    const DEFAULT_CODES = [
        '1708401', '1710405', '1712251', '1718235',
        '1722401', '1727413', '1727424', '1733401', '1733406'
    ];
    const codes = codesArg ? codesArg.split(',').map(s => s.trim()) : DEFAULT_CODES;
    const entries = crosswalk.filter(e => codes.includes(String(e.districtCode)));

    console.log('═══════════════════════════════════════');
    console.log('  Поиск отсутствующих границ в OSM');
    console.log('═══════════════════════════════════════');
    console.log(`  проверяется записей: ${entries.length} из ${codes.length} запрошенных`);
    console.log(`  уровни: 4-${maxLevel}, только теги, без геометрии`);

    const payload = await runQuery(query(4, maxLevel));
    const relations = payload.elements.filter(el => el.type === 'relation' && el.tags);
    main2(entries, relations, maxLevel);
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});
