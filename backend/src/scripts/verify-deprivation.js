/**
 * backend/src/scripts/verify-deprivation.js
 *
 * Runs the deprivation dimensions and the ordinal scales straight over the three
 * source JSON files, with no database. It exists so the methodology can be checked
 * and reproduced by anyone with the repository, and so a change to scales.js shows
 * its effect on the published figures before it reaches an endpoint.
 *
 * The numbers it prints are the same ones /api/analytics/deprivation returns for
 * the loaded sample, apart from the handful of records the importer rejects.
 *
 * Usage:
 *   node backend/src/scripts/verify-deprivation.js
 *   node backend/src/scripts/verify-deprivation.js --type=kindergarten
 *   node backend/src/scripts/verify-deprivation.js --cutoff=25 --k=3
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { scoreObject, isUnknownToken, FIELD_OF, effectiveAge, loadClass } from '../analytics/scales.js';
import { DIMENSION_SETS, DIM, DEFAULT_BUILDING_AGE_CUTOFF, DEFAULT_K_SHARE, vectorOf, indexAt } from '../analytics/deprivation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const SOURCE_OF_TYPE = { school: 'maktab44', kindergarten: 'bogcha', health_post: 'ssv' };

function num(v) { const n = parseInt(v, 10); return isNaN(n) ? null : n; }
function str(v) { return (v != null && v !== '') ? String(v) : null; }

const MIN_YEAR = 1850;
const MAX_YEAR = new Date().getFullYear();
function repairYear(v) {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < MIN_YEAR || n > MAX_YEAR) return null;
    return n;
}

const REPAIR_STATUSES = ['ha_kapital', 'ha_joriy', 'ha_rekon', 'yuq_remont'];

/**
 * Same shape the importer writes, built from a raw source row. Kept deliberately
 * close to transformSSV / transformBogcha / transformMaktab in import-objects.js;
 * if those change, this has to change with them.
 */
function toObject(row, sourceApi) {
    const cap = num(row.sigimi);
    const enr = num(row.umumiy_uquvchi);
    const build = num(row.qurilish_yili);
    const rep = repairYear(row.kapital_tamir);

    const flags = [];
    if (cap !== null && cap <= 0) flags.push('capacity_zero');
    if (enr !== null && enr <= 0) flags.push('enrolment_zero');
    if (build && rep && rep < build) flags.push('repair_before_build');
    if (cap && enr && cap > 0 && enr / cap > 3) flags.push('load_implausible');

    return {
        sourceApi,
        districtCode: row.code != null ? String(row.code) : null,
        tuman: row.tuman,
        viloyat: row.viloyat,
        loadFactor: (cap && cap > 0 && enr !== null) ? Number((enr / cap).toFixed(4)) : null,
        qualityFlags: flags,
        details: {
            materialSten: str(row.material_sten),
            elektrKunDavomida: str(row.elektr_kun_davomida),
            ichimlikSuviManbaa: str(row.ichimlik_suvi_manbaa),
            internet: str(sourceApi === 'ssv' ? row.internet : row.internetga_ulanish_turi),
            binoIchidaSuv: str(row.bino_ichida_suv),
            sportZalHolati: str(row.sport_zal_holati),
            aktivZalHolati: str(row.aktiv_zal_holati),
            oshhonaHolati: str(row.oshhona_holati),
            qurilishYili: str(row.qurilish_yili),
            lastCapitalRepairYear: sourceApi === 'ssv' ? null : rep,
            repairStatus: sourceApi === 'ssv'
                ? (REPAIR_STATUSES.includes(str(row.kapital_tamir)) ? str(row.kapital_tamir) : null)
                : null,
            sigimi: cap,
            umumiyUquvchi: enr,
            smena: num(row.smena)
        }
    };
}

function bar(share, width = 28) {
    if (share === null) return '';
    const filled = Math.round(share * width);
    return '█'.repeat(filled) + '·'.repeat(width - filled);
}

function main() {
    const args = process.argv.slice(2);
    const type = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'school';
    const cutoff = Number(args.find(a => a.startsWith('--cutoff='))?.split('=')[1]) || DEFAULT_BUILDING_AGE_CUTOFF;
    const kArg = args.find(a => a.startsWith('--k='))?.split('=')[1];

    const dims = DIMENSION_SETS[type];
    if (!dims) {
        console.error(`--type должен быть одним из: ${Object.keys(DIMENSION_SETS).join(', ')}`);
        process.exit(1);
    }
    const kShare = kArg ? Number(kArg) / dims.length : DEFAULT_K_SHARE;

    const source = SOURCE_OF_TYPE[type];
    const file = path.join(DATA_DIR, `${source}.json`);
    if (!fs.existsSync(file)) {
        console.error(`${file} не найден`);
        process.exit(1);
    }

    const rows = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const objects = rows.map(r => toObject(r, source));
    const cfg = { asOfYear: new Date().getFullYear(), buildingAgeCutoff: cutoff };

    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Индекс депривации - ${type} (${source}.json)`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  записей в файле: ${rows.length}`);
    // The comparison in indexAt is on shares, so the effective integer cutoff is
    // the smallest count whose share reaches kShare.
    console.log(`  измерений d = ${dims.length}, порог k = ${Math.ceil(kShare * dims.length - 1e-9)}/${dims.length}`);
    console.log(`  порог возраста здания: ${cutoff} лет (провизорный)`);

    // ── vocabulary check: any value outside the declared ladders ──
    const outside = {};
    for (const o of objects) {
        for (const concept of Object.keys(FIELD_OF)) {
            const v = o.details?.[FIELD_OF[concept]];
            if (isUnknownToken(concept, source, v)) {
                const key = `${concept}=${v}`;
                outside[key] = (outside[key] || 0) + 1;
            }
        }
    }
    console.log(`\n  значений вне объявленных шкал: ${Object.keys(outside).length ? JSON.stringify(outside) : 'нет'}`);

    // ── per-facility vectors ──
    const rowsOk = [];
    const missingByDim = Object.fromEntries(dims.map(d => [d, 0]));
    const dimLower = Object.fromEntries(dims.map(d => [d, 0]));
    const dimUpper = Object.fromEntries(dims.map(d => [d, 0]));
    let notAssessable = 0;

    for (const o of objects) {
        const v = vectorOf(o, dims, cfg);
        if (!v.ok) { notAssessable++; missingByDim[v.missingDim]++; continue; }
        rowsOk.push({ deprived: v.deprived, uncertain: v.uncertain });
        for (const d of dims) {
            if (v.per[d] === true) { dimLower[d]++; dimUpper[d]++; }
            else if (v.per[d] === undefined) { dimUpper[d]++; }
        }
    }

    const n = rowsOk.length;
    console.log(`  оценено: ${n}, не поддаётся оценке: ${notAssessable}`);
    if (notAssessable) {
        const top = Object.entries(missingByDim).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
        console.log(`    первое отсутствующее измерение: ${top.map(([k, c]) => `${k} ${c}`).join(', ')}`);
    }

    // ── uncensored deprivation per dimension ──
    console.log('\n  Депривация по измерениям (доля от оценённых)');
    console.log('  ' + '─'.repeat(57));
    for (const d of dims) {
        const lo = n ? dimLower[d] / n : null;
        const hi = n ? dimUpper[d] / n : null;
        const same = lo === hi;
        const label = (DIM[d].label + ' '.repeat(18)).slice(0, 18);
        const val = same
            ? `${(lo * 100).toFixed(1)} %`
            : `${(lo * 100).toFixed(1)} – ${(hi * 100).toFixed(1)} %`;
        console.log(`  ${label} ${bar(lo)} ${val}`);
    }

    // ── index ──
    const lower = indexAt(rowsOk, dims.length, kShare, 'lower');
    const upper = indexAt(rowsOk, dims.length, kShare, 'upper');

    console.log('\n  Индекс');
    console.log('  ' + '─'.repeat(57));
    const line = (name, a, b) => {
        const same = a === b;
        console.log(`  ${(name + ' '.repeat(4)).slice(0, 4)}  ${same ? String(a) : `${a} – ${b}`}`);
    };
    line('H', lower.H, upper.H);
    line('A', lower.A, upper.A);
    line('M0', lower.M0, upper.M0);
    console.log(`  депривированных объектов: ${lower.deprivedCount}${lower.deprivedCount === upper.deprivedCount ? '' : ` – ${upper.deprivedCount}`} из ${n}`);

    // ── top districts ──
    const byDistrict = new Map();
    for (const o of objects) {
        const v = vectorOf(o, dims, cfg);
        const key = o.districtCode || '(без кода)';
        if (!byDistrict.has(key)) byDistrict.set(key, { tuman: o.tuman, viloyat: o.viloyat, rows: [], skipped: 0 });
        const b = byDistrict.get(key);
        if (!v.ok) { b.skipped++; continue; }
        b.rows.push({ deprived: v.deprived, uncertain: v.uncertain });
    }

    const ranked = [...byDistrict.entries()]
        .map(([code, b]) => ({ code, ...b, ...indexAt(b.rows, dims.length, kShare, 'lower'), n: b.rows.length }))
        .filter(d => d.n >= 5)
        .sort((a, b) => (b.M0 ?? -1) - (a.M0 ?? -1));

    console.log(`\n  Топ районов по M0 (нижняя граница, только районы с >= 5 оценёнными)`);
    console.log('  ' + '─'.repeat(57));
    for (const d of ranked.slice(0, 12)) {
        console.log(`  ${String(d.code).padEnd(9)} ${(d.tuman || '').padEnd(22).slice(0, 22)} M0 ${String(d.M0).padEnd(7)} n=${d.n}`);
    }
    console.log(`  всего районов с >= 5 оценёнными: ${ranked.length} из ${byDistrict.size}`);

    // ── load classes, schools only ──
    if (type === 'school') {
        const classes = {};
        for (const o of objects) {
            const c = loadClass(o.loadFactor, o.details.smena);
            classes[c ?? '(не определён)'] = (classes[c ?? '(не определён)'] || 0) + 1;
        }
        console.log('\n  Классы нагрузки');
        console.log('  ' + '─'.repeat(57));
        for (const [k, v] of Object.entries(classes).sort((a, b) => b[1] - a[1])) {
            console.log(`  ${k.padEnd(18)} ${String(v).padStart(5)}  ${(v / objects.length * 100).toFixed(1)} %`);
        }
    }

    // ── age interval ──
    const ages = { certain: [], uncertain: [] };
    for (const o of objects) {
        const { age, certain } = effectiveAge(o, cfg.asOfYear);
        if (age === null) continue;
        ages[certain ? 'certain' : 'uncertain'].push(age);
    }
    if (ages.certain.length || ages.uncertain.length) {
        const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
        console.log('\n  Эффективный возраст');
        console.log('  ' + '─'.repeat(57));
        console.log(`  ремонт записан:    n=${ages.certain.length}, медиана ${med(ages.certain)}`);
        console.log(`  ремонт не записан: n=${ages.uncertain.length}, медиана по году постройки ${med(ages.uncertain)}`);
        console.log('  Разрыв между границами закрывается одним полем в реестре.');
    }
}

// Guarded like the other scripts: importing this file to reuse toObject must not
// print a report as a side effect.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}

export { toObject };
