/**
 * backend/src/scripts/fetch-geoboundaries.js
 *
 * Second source for administrative boundaries, written to the same file names
 * import-geodata-osm.js already reads.
 *
 * Why a second source at all: Overpass is a live service that rate-limits, times
 * out and occasionally answers with HTML. When it does, fetch-osm-boundaries.js
 * writes nothing and the choropleth has no polygons. geoBoundaries publishes the
 * same country as static files on a CDN, so the fallback path has no moving parts.
 *
 * Trade-off, stated plainly. geoBoundaries UZB is built largely from OSM and is
 * cut at a release, so districts created after that release are missing or carry
 * their pre-split outline. OSM stays the primary source for that reason; this one
 * is for when OSM is unavailable, and for cross-checking coverage - a district
 * present in one source and absent in the other is worth looking at either way.
 *
 * Licence: geoBoundaries is CC-BY 4.0. Attribution required wherever the layer is
 * displayed. That is a different licence from the OSM path (ODbL, share-alike on
 * derived databases), so whichever file the import actually consumed has to be
 * recorded - see the `source` property written into every feature below.
 *
 * No dependencies: plain fetch, GeoJSON in and out.
 *
 * Usage:
 *   node backend/src/scripts/fetch-geoboundaries.js
 *   node backend/src/scripts/fetch-geoboundaries.js --level=2
 *   node backend/src/scripts/fetch-geoboundaries.js --simplified
 *
 * Options:
 *   --level=1|2     только регионы (1) или только районы (2)
 *   --simplified    брать облегчённый вариант вместо полного
 *   --overwrite     перезаписать файл, лежащий от другого источника
 *
 * Writes:
 *   data/osm-regions.geojson     ADM1
 *   data/osm-districts.geojson   ADM2
 *
 * Имена файлов совпадают с путём OSM намеренно: import-geodata-osm.js читает их
 * без изменений.
 *
 * Отсюда следует ловушка, и она закрыта явной проверкой. Запуск этого скрипта
 * поверх файлов от Overpass молча подменил бы слой, а вместе с ним лицензию:
 * ODbL с share-alike на производную базу сменился бы на CC-BY, и по диску это
 * было бы не видно. Поэтому перед записью читается источник уже лежащего файла,
 * и при несовпадении скрипт останавливается, пока не передан --overwrite.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const BASE = 'https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/UZB';

const LEVELS = {
    1: { adm: 'ADM1', file: 'osm-regions.geojson', label: 'регионы' },
    2: { adm: 'ADM2', file: 'osm-districts.geojson', label: 'районы' }
};

const MAX_RETRIES = 3;
const RETRY_BACKOFF = 5000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function download(url) {
    let lastErr = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`  → ${url} (попытка ${attempt}/${MAX_RETRIES})`);
            const res = await fetch(url, {
                headers: { 'user-agent': 'YMap-boundaries/1.0 (infrastructure analytics, Uzbekistan)' }
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
            const gj = JSON.parse(text);
            if (!Array.isArray(gj.features) || gj.features.length === 0) {
                throw new Error('в ответе нет features');
            }
            return gj;
        } catch (err) {
            lastErr = err;
            console.warn(`    ${err.message}`);
            // 4xx повторять бессмысленно, файла по этому пути просто нет.
            if (/HTTP 4\d\d/.test(err.message)) break;
            if (attempt < MAX_RETRIES) await sleep(RETRY_BACKOFF * attempt);
        }
    }
    throw lastErr || new Error('не скачалось');
}

/**
 * geoBoundaries names its fields shapeName / shapeISO. The matcher in
 * uz-name-match.js reads OSM-style keys, so the name is copied into `name` and the
 * origin is recorded, rather than the matcher being taught a second schema.
 */
function normalise(gj, adm) {
    const features = gj.features
        .filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
        .map((f, i) => {
            const p = f.properties || {};
            const name = p.shapeName || p.Name || p.name || '';
            return {
                type: 'Feature',
                id: p.shapeID || `gb/${adm}/${i}`,
                properties: {
                    ...p,
                    name,
                    'name:en': name,
                    id: p.shapeID || `gb/${adm}/${i}`,
                    // Пишется в каждый объект: по файлу должно быть видно, чья
                    // лицензия действует на слой, который в итоге загрузили.
                    source: 'geoBoundaries gbOpen, CC-BY 4.0'
                },
                geometry: f.geometry
            };
        });
    return { type: 'FeatureCollection', features };
}

/**
 * Чей файл уже лежит на диске. Читается первый килобайт, а не весь документ:
 * набор районов в полном разрешении - это десятки мегабайт, и разбирать их
 * целиком ради одного поля незачем.
 *
 * `source` пишется этим скриптом в каждый объект. У файлов от Overpass его нет,
 * зато есть `osmId`, поэтому источник определяется однозначно в обе стороны.
 */
function existingSource(file) {
    if (!fs.existsSync(file)) return null;
    let head = '';
    const fd = fs.openSync(file, 'r');
    try {
        const buf = Buffer.alloc(4096);
        const read = fs.readSync(fd, buf, 0, buf.length, 0);
        head = buf.slice(0, read).toString('utf8');
    } finally {
        fs.closeSync(fd);
    }
    const tagged = head.match(/"source"\s*:\s*"([^"]+)"/);
    if (tagged) return tagged[1];
    if (/"osmId"\s*:/.test(head) || /"relation\//.test(head)) return 'OpenStreetMap, ODbL';
    return 'неизвестен';
}

const GB_SOURCE = 'geoBoundaries gbOpen, CC-BY 4.0';

function describe(gj, label) {
    const feats = gj.features;
    const byType = {};
    let vertices = 0;
    for (const f of feats) {
        byType[f.geometry.type] = (byType[f.geometry.type] || 0) + 1;
        const rings = f.geometry.type === 'Polygon'
            ? f.geometry.coordinates
            : f.geometry.coordinates.flat();
        vertices += rings.reduce((s, r) => s + r.length, 0);
    }
    console.log(`  ${label}: ${feats.length} объектов`);
    console.log(`    по геометрии: ${JSON.stringify(byType)}`);
    console.log(`    вершин всего: ${vertices.toLocaleString('ru-RU')}, в среднем ${Math.round(vertices / feats.length)}`);
    const sample = feats.slice(0, 8).map(f => f.properties.name).filter(Boolean);
    if (sample.length) console.log(`    примеры имён: ${sample.join(', ')}`);
    return vertices;
}

async function main() {
    const args = process.argv.slice(2);
    const onlyLevel = args.find(a => a.startsWith('--level='))?.split('=')[1];
    const simplified = args.includes('--simplified');
    const overwrite = args.includes('--overwrite');

    if (typeof fetch !== 'function') {
        console.error('Нужен Node 18 или новее.');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════');
    console.log('  Границы из geoBoundaries (CC-BY 4.0)');
    console.log('═══════════════════════════════════════');

    fs.mkdirSync(DATA_DIR, { recursive: true });

    const levels = onlyLevel ? [Number(onlyLevel)] : Object.keys(LEVELS).map(Number);

    for (const level of levels) {
        const cfg = LEVELS[level];
        if (!cfg) { console.warn(`  уровень ${level} не поддерживается`); continue; }

        const suffix = simplified ? '_simplified' : '';
        const url = `${BASE}/${cfg.adm}/geoBoundaries-UZB-${cfg.adm}${suffix}.geojson`;

        console.log(`\n${cfg.adm} (${cfg.label})`);
        const raw = await download(url);
        const gj = normalise(raw, cfg.adm);
        const vertices = describe(gj, cfg.label);

        if (gj.features.length === 0) {
            console.error('  ❌ ни одного полигона. Файл не записан.');
            continue;
        }
        if (vertices / gj.features.length < 20) {
            console.warn('  ⚠️  в среднем меньше 20 вершин на объект. Это похоже на bbox, а не на границы.');
        }

        const out = path.join(DATA_DIR, cfg.file);

        const prior = existingSource(out);
        if (prior && prior !== GB_SOURCE && !overwrite) {
            console.error(`  ❌ ${cfg.file} уже лежит и получен из другого источника: ${prior}`);
            console.error('     Запись отменена. Этот слой пришёл бы под другой лицензией,');
            console.error('     и по файлу это было бы не видно.');
            console.error(`     Сохранить прежний:  cp ${out} ${out}.bak`);
            console.error('     Перезаписать:       добавьте --overwrite');
            continue;
        }
        if (prior && prior !== GB_SOURCE) {
            console.warn(`  ⚠️  перезаписываю файл от источника: ${prior}`);
        }

        fs.writeFileSync(out, JSON.stringify(gj), 'utf8');
        const mb = (fs.statSync(out).size / 1024 / 1024).toFixed(1);
        console.log(`  ✅ записано: ${out} (${mb} МБ)`);
    }

    console.log('\nДальше: node src/scripts/import-geodata-osm.js --dry-run');
    console.log('Затем:  node src/scripts/simplify-boundaries.js');
    console.log('Атрибуция geoBoundaries CC-BY 4.0 обязательна там, где слой показан.');
}

main().catch(err => {
    console.error('\n❌ Ошибка:', err.message);
    process.exit(1);
});
