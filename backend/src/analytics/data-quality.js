/**
 * backend/src/analytics/data-quality.js
 *
 * Data quality report, computed from the objects collection itself. Nothing here
 * needs a new source: every figure comes from what the importer already wrote.
 *
 * The report is the first publishable artefact of the project and its tone is
 * fixed. It measures how far a registry field can carry a decision, and where it
 * cannot, it says which single field would close the gap. It does not characterise
 * any ministry's data as wrong. A missing capital repair year is a gap in a form,
 * not a claim about a building.
 *
 * Five sections:
 *   coverage      how much of each registry is loaded, and over which districts
 *   completeness  per field, the share of records carrying a usable value
 *   consistency   the quality flags raised at import, by source
 *   vocabulary    values outside the observed domain of each categorical field
 *   freshness     what sourceUpdatedAt can and cannot support per source
 *   geocoding     coordinate coverage by source and precision
 *
 * GET /api/analytics/data-quality
 *   ?regionCode=1703
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Object_ from '../object/model.js';
import { FIELD_OF, isUnknownToken } from './scales.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CROSSWALK_FILE = path.join(__dirname, '..', 'data', 'district-crosswalk.json');

// Which concepts each source actually carries. A field absent from a registry is
// not incomplete, it simply does not exist there, and mixing the two would make
// ssv look like it were missing a canteen field it never had.
const CONCEPTS_BY_SOURCE = {
    ssv: ['water', 'electricity', 'internet', 'indoorWater', 'repairStatus'],
    bogcha: ['water', 'electricity', 'internet', 'canteen', 'activityHall'],
    maktab44: ['water', 'electricity', 'internet', 'canteen', 'activityHall', 'sportHall']
};

// Numeric and free-text detail fields checked for completeness, per source.
const PLAIN_FIELDS_BY_SOURCE = {
    ssv: ['materialSten', 'qurilishYili'],
    bogcha: ['materialSten', 'qurilishYili', 'sigimi', 'umumiyUquvchi', 'lastCapitalRepairYear'],
    maktab44: ['materialSten', 'qurilishYili', 'sigimi', 'umumiyUquvchi', 'lastCapitalRepairYear', 'smena']
};

const FIELD_LABEL = {
    water: 'Источник питьевой воды',
    electricity: 'Электроснабжение',
    internet: 'Интернет',
    canteen: 'Столовая',
    activityHall: 'Актовый зал',
    sportHall: 'Спортзал',
    indoorWater: 'Вода в здании',
    repairStatus: 'Категория ремонта',
    materialSten: 'Материал стен',
    qurilishYili: 'Год постройки',
    sigimi: 'Проектная мощность',
    umumiyUquvchi: 'Контингент',
    lastCapitalRepairYear: 'Год капитального ремонта',
    smena: 'Сменность'
};

const SOURCE_LABEL = {
    ssv: 'ФАП/СВП (ssv)',
    bogcha: 'Детские сады (bogcha)',
    maktab44: 'Школы (maktab44)'
};

// Notes attached to a figure that would otherwise be read as meaning something it
// does not. Each one was established by inspecting the source file, and each one
// changes what a model is allowed to do with the field.
const FIELD_NOTES = {
    'ssv.qurilishYili':
        'Заполненность высокая, информативность низкая: 341 из 344 заполненных значений равны 2005. Поле не пригодно для расчёта возраста здания.',
    'bogcha.sigimi':
        'В части записей в поле мощности попал год (значения до 2023). Расчёт загруженности по таким записям помечается флагом load_implausible.',
    'ssv.repairStatus':
        'В ssv kapital_tamir хранит категорию (ha_kapital, ha_joriy, ha_rekon, yuq_remont), в двух других источниках - год. Поля разделены при импорте.'
};

const SOURCE_NOTES = {
    bogcha:
        'Поле updated одинаково у всех записей: это отметка массовой загрузки, а не дата обновления объекта. Модель актуальности к этому источнику неприменима.'
};

function loadCrosswalkSize() {
    try {
        if (!fs.existsSync(CROSSWALK_FILE)) return null;
        return JSON.parse(fs.readFileSync(CROSSWALK_FILE, 'utf-8')).length;
    } catch {
        return null;
    }
}

function pct(part, whole) {
    if (!whole) return null;
    return Number(((part / whole) * 100).toFixed(1));
}

export const getDataQuality = async (req, res) => {
    try {
        const match = {};
        if (req.query.regionCode) match.regionCode = parseInt(req.query.regionCode, 10);

        const objects = await Object_.find(match)
            .select('sourceApi objectType objectClass districtCode regionCode viloyat details qualityFlags coordSource coordPrecision coordShared sourceUpdatedAt')
            .lean();

        if (objects.length === 0) {
            return res.json({
                success: true,
                data: null,
                meta: { note: 'коллекция objects пуста для заданного фильтра' }
            });
        }

        const bySource = new Map();
        for (const o of objects) {
            if (!bySource.has(o.sourceApi)) bySource.set(o.sourceApi, []);
            bySource.get(o.sourceApi).push(o);
        }

        const crosswalkSize = loadCrosswalkSize();
        const districtsSeen = new Set(objects.map(o => o.districtCode).filter(Boolean));
        const regionsSeen = new Set(objects.map(o => o.regionCode).filter(Boolean));

        const sections = [];

        for (const [source, rows] of bySource) {
            const n = rows.length;

            // ── completeness ──
            const completeness = [];

            for (const concept of (CONCEPTS_BY_SOURCE[source] || [])) {
                const field = FIELD_OF[concept];
                let filled = 0;
                let unknown = 0;
                for (const o of rows) {
                    const v = o.details?.[field];
                    if (v === null || v === undefined || v === '') continue;
                    filled++;
                    if (isUnknownToken(concept, source, v)) unknown++;
                }
                completeness.push({
                    field: concept,
                    label: FIELD_LABEL[concept] || concept,
                    filled,
                    filledPct: pct(filled, n),
                    outsideVocabulary: unknown,
                    note: FIELD_NOTES[`${source}.${concept}`] || null
                });
            }

            for (const field of (PLAIN_FIELDS_BY_SOURCE[source] || [])) {
                let filled = 0;
                for (const o of rows) {
                    const v = o.details?.[field];
                    if (v === null || v === undefined || v === '') continue;
                    filled++;
                }
                completeness.push({
                    field,
                    label: FIELD_LABEL[field] || field,
                    filled,
                    filledPct: pct(filled, n),
                    outsideVocabulary: null,
                    note: FIELD_NOTES[`${source}.${field}`] || null
                });
            }

            // ── consistency flags ──
            const flagCounts = {};
            let flagged = 0;
            for (const o of rows) {
                const f = o.qualityFlags || [];
                if (f.length) flagged++;
                for (const name of f) flagCounts[name] = (flagCounts[name] || 0) + 1;
            }

            // ── freshness ──
            const dates = rows.map(o => o.sourceUpdatedAt).filter(Boolean).map(d => new Date(d));
            const distinctDays = new Set(dates.map(d => d.toISOString().slice(0, 10)));
            const usableForRecency = distinctDays.size > 1;

            // ── geocoding ──
            const coord = { exact: 0, approximate: 0, none: 0, shared: 0 };
            const coordBySource = {};
            for (const o of rows) {
                const p = o.coordPrecision || 'none';
                if (coord[p] !== undefined) coord[p]++;
                if (o.coordShared) coord.shared++;
                const s = o.coordSource || 'none';
                coordBySource[s] = (coordBySource[s] || 0) + 1;
            }

            sections.push({
                source,
                label: SOURCE_LABEL[source] || source,
                loaded: n,
                completeness: completeness.sort((a, b) => (a.filledPct ?? 0) - (b.filledPct ?? 0)),
                consistency: {
                    recordsWithAnyFlag: flagged,
                    recordsWithAnyFlagPct: pct(flagged, n),
                    byFlag: flagCounts
                },
                freshness: {
                    recordsWithDate: dates.length,
                    distinctDays: distinctDays.size,
                    earliest: dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : null,
                    latest: dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null,
                    usableForRecencyModel: usableForRecency,
                    note: SOURCE_NOTES[source] || null
                },
                geocoding: {
                    byPrecision: { exact: coord.exact, approximate: coord.approximate, none: coord.none },
                    exactPct: pct(coord.exact, n),
                    sharedCoordinate: coord.shared,
                    bySource: coordBySource
                }
            });
        }

        // ── cross-source coverage ──
        const byObjectClass = {};
        for (const o of objects) {
            const k = o.objectClass || 'building';
            byObjectClass[k] = (byObjectClass[k] || 0) + 1;
        }

        res.json({
            success: true,
            data: {
                coverage: {
                    objectsLoaded: objects.length,
                    bySource: Object.fromEntries([...bySource].map(([k, v]) => [k, v.length])),
                    byObjectClass,
                    districtsWithData: districtsSeen.size,
                    districtsInCrosswalk: crosswalkSize,
                    districtCoveragePct: crosswalkSize ? pct(districtsSeen.size, crosswalkSize) : null,
                    regionsWithData: regionsSeen.size
                },
                sources: sections
            },
            meta: {
                asOf: new Date().toISOString().slice(0, 10),
                framing: 'Отчёт измеряет, какие решения выдерживает поле реестра, и называет поле, которое закрывает разрыв. Оценок достоверности ведомственных данных отчёт не содержит.',
                caveat: 'Все доли считаются от загруженной выборки, а не от полного реестра. Знаменатель указан рядом с каждым числом.'
            }
        });
    } catch (err) {
        console.error('getDataQuality error:', err);
        res.status(500).json({ success: false, error: 'Failed to build data quality report' });
    }
};

export { CONCEPTS_BY_SOURCE, PLAIN_FIELDS_BY_SOURCE };
