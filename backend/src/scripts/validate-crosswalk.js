/**
 * backend/src/scripts/validate-crosswalk.js
 *
 * Checks district-crosswalk.json against the structure of the SOATO code itself,
 * and moves names that contradict it out of the matching lists.
 *
 * The check. A seven-digit SOATO district code carries the unit type in its fifth
 * digit: 2 for a tuman, 4 for a city of regional subordination. Verified across
 * all 198 entries of the current crosswalk - 172 carry 2, 26 carry 4, and the
 * split agrees with the names in every case but one. So the code is an
 * independent witness to what each entry is, and a name whose own suffix says
 * something else is wrong about one of the two.
 *
 * Why it matters. The crosswalk's name lists are what OSM boundaries are matched
 * against. A stray name inside an entry does not sit there harmlessly: it is a
 * second way for a boundary to claim that code, and the boundary it lets in
 * belongs to a different place. The one real case is 1714401 - Namangan city -
 * carrying "Давлатобод т." among its names, because the source registry files
 * some Davlatobod records under the city's code. Left alone, an OSM relation for
 * Davlatobod district could take Namangan city's code, and then every facility in
 * Namangan city would bind to Davlatobod's polygon.
 *
 * What --fix does. Nothing is deleted. A contradicting name is moved to
 * `nameConflicts`, which no matcher reads, so the observation survives in the file
 * while ceasing to be a matching key. The mismatch is a real property of the
 * source data and deleting it would erase a data-quality finding.
 *
 * Usage:
 *   node backend/src/scripts/validate-crosswalk.js
 *   node backend/src/scripts/validate-crosswalk.js --fix
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { splitKind } from './uz-name-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'district-crosswalk.json');

// Fifth digit of the seven-digit district code.
const UNIT_BY_DIGIT = { '2': 'district', '4': 'city' };

const unitOf = (code) => UNIT_BY_DIGIT[String(code)[4]] ?? null;

const UNIT_LABEL = { district: 'район', city: 'город' };

function main() {
    const fix = process.argv.slice(2).includes('--fix');

    if (!fs.existsSync(FILE)) {
        console.error(`❌ ${FILE} не найден`);
        process.exit(1);
    }

    const entries = JSON.parse(fs.readFileSync(FILE, 'utf-8'));

    console.log('═══════════════════════════════════════');
    console.log('  Проверка кроссволка по коду СОАТО');
    console.log('═══════════════════════════════════════');
    console.log(`  записей: ${entries.length}`);

    const byDigit = {};
    let badCodes = 0;
    const conflicts = [];

    for (const e of entries) {
        const code = String(e.districtCode ?? '');
        if (!/^\d{7}$/.test(code)) {
            badCodes++;
            console.warn(`  ⚠️  код не семизначный: ${code}`);
            continue;
        }
        byDigit[code[4]] = (byDigit[code[4]] || 0) + 1;

        const expected = unitOf(code);
        if (!expected) {
            console.warn(`  ⚠️  ${code}: пятая цифра ${code[4]} не 2 и не 4, тип единицы неизвестен`);
            continue;
        }

        for (const field of ['nameLatin', 'nameCyrillic']) {
            for (const name of e[field] || []) {
                const kind = splitKind(name).kind;
                // A name with no recognised suffix says nothing about the unit
                // type and is left alone: silence is not a contradiction.
                if (kind && kind !== expected) {
                    conflicts.push({ entry: e, field, name, kind, expected, code });
                }
            }
        }
    }

    console.log(`  по пятой цифре: ${JSON.stringify(byDigit)}`);
    if (badCodes) console.log(`  кодов неверной длины: ${badCodes}`);

    if (conflicts.length === 0) {
        console.log('\n✅ Имён, противоречащих коду, нет.');
        return;
    }

    console.log(`\n  ❌ имён, чей тип единицы противоречит коду: ${conflicts.length}`);
    for (const c of conflicts) {
        const own = (c.entry.nameLatin || [])[0] || (c.entry.nameCyrillic || [])[0] || '';
        console.log(`     ${c.code}  запись «${own}» (${UNIT_LABEL[c.expected]} по коду)`);
        console.log(`       лишнее имя: «${c.name}» - это ${UNIT_LABEL[c.kind]}`);
        console.log(`       источники записи: ${(c.entry.sources || []).join(', ') || '-'}`);
    }

    if (!fix) {
        console.log('\n  Ничего не изменено. Перенести в nameConflicts: --fix');
        console.log('  После правки перезапустите import-geodata-osm.js и import-objects.js.');
        process.exit(1);
    }

    for (const c of conflicts) {
        c.entry[c.field] = (c.entry[c.field] || []).filter(n => n !== c.name);
        if (!c.entry.nameConflicts) c.entry.nameConflicts = [];
        c.entry.nameConflicts.push({
            name: c.name,
            field: c.field,
            kindOfName: c.kind,
            kindByCode: c.expected,
            note: 'Имя противоречит типу единицы по коду СОАТО. Оставлено как наблюдение, из сопоставления исключено.'
        });
    }

    fs.writeFileSync(FILE, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
    console.log(`\n  ✅ перенесено в nameConflicts: ${conflicts.length}. Файл переписан: ${FILE}`);
    console.log('  Дальше: import-geodata-osm.js --dry-run, затем import-objects.js');
}

main();
