/**
 * backend/src/analytics/deprivation.js
 *
 * Multidimensional deprivation index over social infrastructure, computed with
 * the counting method of Alkire and Foster - the same construction the global MPI
 * uses. Donor institutions and statistical offices recognise it on sight, which is
 * the point: the method is not novel, only its application to facilities is.
 *
 * Construction, in order:
 *   1. Each facility is scored on d binary dimensions against declared cutoffs.
 *   2. c_i is the share of dimensions on which facility i is deprived.
 *   3. A facility counts as multidimensionally deprived when c_i >= k.
 *   4. H is the share of deprived facilities, A the mean c_i among them,
 *      and M0 = H · A.
 *
 * Three properties this file is built around.
 *
 * Dimensions are declared per facility type and indices are never pooled across
 * types. A health post has no design capacity and no usable construction year; a
 * kindergarten has no sports hall. Forcing one dimension list on all three would
 * mean either dropping real signal or inventing absent fields.
 *
 * Missing is not zero. A facility with any indeterminate dimension is left out of
 * the index and reported separately as not assessable. Twenty-seven kindergarten
 * records carry an empty value in every condition field; counting those as fully
 * equipped or fully deprived would both be inventions.
 *
 * Where a dimension is uncertain rather than missing, the index is published as an
 * interval, not a point. This affects building age: 27.1 % of schools have no
 * capital repair year recorded, and nothing in the data says whether that means no
 * repair or an unrecorded one. Both bounds are computed and both are returned. The
 * interval is not noise to be smoothed away, it is the measured cost of one absent
 * field in the registry.
 *
 * GET /api/analytics/deprivation
 *   ?objectType=school|kindergarten|health_post   default school
 *   ?regionCode=1703
 *   ?k=3                                          integer cutoff, overrides kShare
 *   ?buildingAgeCutoff=30                         years, overrides the default
 */

import fs from 'fs';
import Object_ from '../object/model.js';
import District from '../district/model.js';
import { resolveRead } from '../utils/dataDir.js';
// Измерения, пороги и счёт вынесены в deprivation-core.js: там нет ни базы, ни
// моделей, и verify-deprivation.js берёт их оттуда, не подтягивая mongoose.
import {
    DIM,
    DIMENSION_SETS,
    DEFAULT_BUILDING_AGE_CUTOFF,
    DEFAULT_K_SHARE,
    vectorOf,
    emptyBucket,
    indexAt,
    round4
} from './deprivation-core.js';

// ── Справочник районов ────────────────────────────────────────────────────────
//
// 198 наблюдённых районов с кодами СОАТО. Нужен слою карты ровно для одного:
// назвать районы, которых на карте нет вовсе. Район без границы в базе не
// рисуется ни в одном из трёх состояний - на его месте дыра, и молча оставлять
// её нельзя. Читается один раз за жизнь процесса, файл приезжает внутри образа.
let crosswalkCache = null;
const loadCrosswalk = () => {
    if (crosswalkCache) return crosswalkCache;
    try {
        crosswalkCache = JSON.parse(fs.readFileSync(resolveRead('district-crosswalk.json'), 'utf-8'));
    } catch (err) {
        console.warn(`⚠️  district-crosswalk.json не прочитан (${err.message}) - пропуски границ не будут названы`);
        crosswalkCache = [];
    }
    return crosswalkCache;
};

const crosswalkName = (entry) =>
    entry?.nameCyrillic?.[0] || entry?.nameLatin?.[0] || entry?.districtCode || '-';

// ── Assumptions, all overridable per request and all reported in the response ──

// Years since construction or last capital repair beyond which a building counts
// as deprived on the condition dimension. PROVISIONAL. The published ШНК cycle for
// public buildings has to be read from the current edition before this number is
// used in anything that leaves the project. It sits here, not inside the scoring
// code, so replacing it is one line and a recompute.

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * Parses and validates the query, then computes the index. Returns
 * { error } for a bad request, otherwise { districts, national, meta }.
 * Shared by the JSON handler and the GeoJSON choropleth so the two can never
 * disagree about a number.
 */
async function computeDeprivation(query) {
    const objectType = String(query.objectType || 'school');
    const dims = DIMENSION_SETS[objectType];
    if (!dims) {
        return { error: `objectType must be one of: ${Object.keys(DIMENSION_SETS).join(', ')}` };
    }

    const asOfYear = new Date().getFullYear();
    const buildingAgeCutoff = query.buildingAgeCutoff
        ? parseInt(query.buildingAgeCutoff, 10)
        : DEFAULT_BUILDING_AGE_CUTOFF;
    if (isNaN(buildingAgeCutoff) || buildingAgeCutoff < 1) {
        return { error: 'buildingAgeCutoff must be a positive integer' };
    }

    const kInt = query.k ? parseInt(query.k, 10) : null;
    if (query.k && (isNaN(kInt) || kInt < 1 || kInt > dims.length)) {
        return { error: `k must be between 1 and ${dims.length}` };
    }
    const kShare = kInt !== null ? kInt / dims.length : DEFAULT_K_SHARE;

    const cfg = { asOfYear, buildingAgeCutoff };

    const match = { objectType };
    if (query.regionCode) match.regionCode = parseInt(query.regionCode, 10);
    // Family kindergartens are service points inside a flat. They have no
    // design capacity, no wall material and no construction year, so they
    // cannot be scored on a building-condition index and are excluded.
    match.objectClass = 'building';

    const objects = await Object_.find(match)
        .select('districtCode regionCode tuman viloyat sourceApi details loadFactor qualityFlags')
        .lean();

    if (objects.length === 0) {
        return {
            districts: [],
            national: null,
            meta: { objectType, dimensions: dims, note: 'нет объектов этого типа' }
        };
    }

    // ── bucket by district ──
    const buckets = new Map();
    const missingByDim = Object.fromEntries(dims.map(d => [d, 0]));
    let noDistrict = 0;

    for (const o of objects) {
        const key = o.districtCode || null;
        if (!key) noDistrict++;

        const bk = key || '(без района)';
        if (!buckets.has(bk)) {
            buckets.set(bk, { ...emptyBucket(dims), districtCode: key, tuman: o.tuman, regionCode: o.regionCode, viloyat: o.viloyat });
        }
        const b = buckets.get(bk);

        const v = vectorOf(o, dims, cfg);
        if (!v.ok) {
            b.notAssessable++;
            missingByDim[v.missingDim]++;
            continue;
        }

        b.assessed++;
        b.rows.push({ deprived: v.deprived, uncertain: v.uncertain });

        for (const name of dims) {
            const r = v.per[name];
            if (r === true) { b.dimLower[name]++; b.dimUpper[name]++; }
            else if (r === undefined) { b.dimUpper[name]++; }
        }
    }

    // ── district-level index ──
    const districtCodes = [...buckets.values()].map(b => b.districtCode).filter(Boolean);
    // District rows carry the SOATO code in cadNum - the field was repurposed by
    // import-geodata-osm.js, apiId holds the OSM relation id.
    const districtDocs = await District.find({ cadNum: { $in: districtCodes } })
        .select('cadNum name regionCode areaKm2')
        .lean();
    const nameByCode = new Map(districtDocs.map(d => [d.cadNum, d.name]));

    const districts = [...buckets.values()].map(b => {
        const lower = indexAt(b.rows, dims.length, kShare, 'lower');
        const upper = indexAt(b.rows, dims.length, kShare, 'upper');
        const n = b.assessed;

        return {
            districtCode: b.districtCode,
            name: nameByCode.get(b.districtCode) || { uz: b.tuman || '', ru: '', en: '' },
            tuman: b.tuman,
            regionCode: b.regionCode,
            viloyat: b.viloyat,
            assessed: n,
            notAssessable: b.notAssessable,
            H: { lower: lower.H, upper: upper.H },
            A: { lower: lower.A, upper: upper.A },
            M0: { lower: lower.M0, upper: upper.M0 },
            deprivedCount: { lower: lower.deprivedCount, upper: upper.deprivedCount },
            // Uncensored headcount per dimension - the share of all assessed
            // facilities deprived on that dimension, whether or not they pass k.
            dimensions: Object.fromEntries(dims.map(d => [d, {
                label: DIM[d].label,
                lower: n ? round4(b.dimLower[d] / n) : null,
                upper: n ? round4(b.dimUpper[d] / n) : null
            }]))
        };
    }).sort((a, b) => (b.M0.lower ?? -1) - (a.M0.lower ?? -1));

    // ── national aggregate over the same rows ──
    const allRows = [...buckets.values()].flatMap(b => b.rows);
    const natLower = indexAt(allRows, dims.length, kShare, 'lower');
    const natUpper = indexAt(allRows, dims.length, kShare, 'upper');
    const assessedTotal = allRows.length;
    const notAssessableTotal = [...buckets.values()].reduce((s, b) => s + b.notAssessable, 0);

    const natDimLower = Object.fromEntries(dims.map(d => [d, 0]));
    const natDimUpper = Object.fromEntries(dims.map(d => [d, 0]));
    for (const b of buckets.values()) {
        for (const d of dims) {
            natDimLower[d] += b.dimLower[d];
            natDimUpper[d] += b.dimUpper[d];
        }
    }

    return {
        districts,
        national: {
            assessed: assessedTotal,
            notAssessable: notAssessableTotal,
            H: { lower: natLower.H, upper: natUpper.H },
            A: { lower: natLower.A, upper: natUpper.A },
            M0: { lower: natLower.M0, upper: natUpper.M0 },
            dimensions: Object.fromEntries(dims.map(d => [d, {
                label: DIM[d].label,
                lower: assessedTotal ? round4(natDimLower[d] / assessedTotal) : null,
                upper: assessedTotal ? round4(natDimUpper[d] / assessedTotal) : null
            }]))
        },
        meta: {
            objectType,
            asOf: new Date().toISOString().slice(0, 10),
            method: 'Alkire-Foster, counting method, equal weights',
            dimensions: dims.map(d => ({ key: d, label: DIM[d].label })),
            d: dims.length,
            // The comparison is on shares, so the effective integer cutoff is the
            // smallest count whose share reaches kShare.
            k: { share: round4(kShare), asCount: Math.ceil(kShare * dims.length - 1e-9) },
            assumptions: {
                buildingAgeCutoffYears: buildingAgeCutoff,
                buildingAgeCutoffStatus: 'провизорный, до сверки с действующей редакцией ШНК',
                familyKindergartensExcluded: true,
                intervalCause: 'год капитального ремонта не записан у части объектов'
            },
            denominators: {
                objectsInScope: objects.length,
                assessed: assessedTotal,
                notAssessable: notAssessableTotal,
                withoutDistrictCode: noDistrict,
                missingByDimension: missingByDim
            },
            caveat: 'Оценка по загруженной выборке, не по полному реестру. Экстраполяция на страну не производится.'
        }
    };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export const getDeprivation = async (req, res) => {
    try {
        const result = await computeDeprivation(req.query);
        if (result.error) return res.status(400).json({ success: false, error: result.error });

        res.json({
            success: true,
            data: { districts: result.districts, national: result.national },
            meta: result.meta
        });
    } catch (err) {
        console.error('getDeprivation error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute deprivation index' });
    }
};

/**
 * GET /api/analytics/deprivation/choropleth
 *
 * The same index as GeoJSON, joined to district geometry on the SOATO code. Kept
 * apart from /analytics/choropleth on purpose: that endpoint publishes a 0-100
 * score where higher is better, and M0 runs the other way and carries an interval.
 * Folding one into the other would misread the colour scale.
 *
 *   ?objectType=school|kindergarten|health_post
 *   ?regionCode=1703
 *   ?bound=lower|upper        which end of the interval colours the map
 *   ?minAssessed=3            districts below this are returned greyed, not scored
 *
 * ПЕРЕДЕЛАНО. Слой строился из районов, по которым нашлись объекты этого типа:
 * выборка -> список кодов -> District.find по этим кодам. Район, в котором ни
 * одного объекта данного типа не загружено, в выдачу не попадал вообще, и на
 * карте на его месте была дыра. Читатель видел не «данных нет», а отсутствие
 * района как такового.
 *
 * Теперь слой строится от коллекции границ, а оценка присоединяется к ней. В
 * выдаче все районы с геометрией, и у каждого стоит status:
 *
 *   scored           - объектов хватило, value = M0 на выбранной границе
 *   below_threshold  - объекты есть, но меньше minAssessed, value = null
 *   no_objects       - объектов этого типа в районе нет вовсе, value = null
 *
 * Два последних состояния разные по смыслу: первое говорит о пороге публикации,
 * второе о покрытии загрузки. Одним серым цветом их путать нельзя.
 */
export const getDeprivationChoropleth = async (req, res) => {
    try {
        const result = await computeDeprivation(req.query);
        if (result.error) return res.status(400).json({ success: false, error: result.error });

        const bound = req.query.bound === 'upper' ? 'upper' : 'lower';
        const minAssessed = req.query.minAssessed ? parseInt(req.query.minAssessed, 10) : 3;

        const byCode = new Map(result.districts.filter(d => d.districtCode).map(d => [d.districtCode, d]));

        // Фильтр по региону, если он задан в запросе, применяется и к слою границ:
        // иначе запрос по одному региону вернул бы страну целиком.
        const geoFilter = {};
        if (req.query.regionCode) geoFilter.regionCode = parseInt(req.query.regionCode, 10);

        const districtDocs = await District.find(geoFilter)
            // geometrySimplified is the render copy from simplify-boundaries.js.
            // Full geometry stays selected as the fallback: a district imported
            // after the last simplification run has no copy yet, and drawing it
            // heavy beats leaving a hole in the layer.
            .select('cadNum name regionCode areaKm2 geometry geometrySimplified')
            .lean();

        const features = districtDocs
            .filter(doc => doc.geometry)
            .map(doc => {
                const d = byCode.get(doc.cadNum) || null;
                // A district with two loaded schools cannot carry a rate. It is
                // returned with a null value so the map can draw it as no-data
                // rather than as a low score.
                const enough = Boolean(d) && d.assessed >= minAssessed;
                const status = !d || (d.assessed === 0 && d.notAssessable === 0)
                    ? 'no_objects'
                    : enough ? 'scored' : 'below_threshold';
                return {
                    type: 'Feature',
                    properties: {
                        districtCode: doc.cadNum,
                        districtId: doc._id.toString(),
                        name: doc.name,
                        regionCode: doc.regionCode,
                        areaKm2: doc.areaKm2,
                        status,
                        value: enough ? d.M0[bound] : null,
                        M0: d ? d.M0 : null,
                        H: d ? d.H : null,
                        A: d ? d.A : null,
                        assessed: d ? d.assessed : 0,
                        notAssessable: d ? d.notAssessable : 0,
                        dimensions: d ? d.dimensions : null
                    },
                    geometry: doc.geometrySimplified?.coordinates ? doc.geometrySimplified : doc.geometry
                };
            });

        // Районы, по которым оценка есть, а границы в базе нет. Это дыра в слое
        // границ, и молчать о ней нельзя: на карте такой район не появится ни в
        // одном из трёх состояний.
        const drawnCodes = new Set(features.map(f => f.properties.districtCode));
        const withoutGeometry = [...byCode.keys()].filter(c => !drawnCodes.has(c));

        // Шире: весь справочник против того, что реально нарисовано. Предыдущая
        // проверка видит только районы, где нашлись объекты этого типа, а дыра на
        // карте не спрашивает, загружены ли в район школы. Семь городов областного
        // подчинения (Джизак, Шахрисабз, Термез, Бекабад, Янгиюль, Ургенч, Хива)
        // в OSM лежат не на том admin_level, который запрашивает
        // fetch-osm-boundaries.js, - это и есть чёрные пятна на слое.
        const expected = loadCrosswalk().filter(
            e => !geoFilter.regionCode || parseInt(e.regionCode, 10) === geoFilter.regionCode
        );
        const missingBoundaries = expected
            .filter(e => !drawnCodes.has(e.districtCode))
            .map(e => ({ districtCode: e.districtCode, name: crosswalkName(e) }));

        const counted = features.reduce((acc, f) => {
            acc[f.properties.status] = (acc[f.properties.status] || 0) + 1;
            return acc;
        }, { scored: 0, below_threshold: 0, no_objects: 0 });

        res.json({
            type: 'FeatureCollection',
            metric: 'deprivation',
            bound,
            features,
            meta: {
                ...result.meta,
                minAssessed,
                districtsTotal: features.length,
                districtsScored: counted.scored,
                districtsBelowThreshold: counted.below_threshold,
                districtsWithoutObjects: counted.no_objects,
                districtsWithoutGeometry: withoutGeometry.length,
                districtsExpected: expected.length,
                // Названия, а не только счёт: без них пропуск нечем закрывать.
                boundariesMissing: missingBoundaries,
                scale: 'выше = хуже; M0 в диапазоне 0..1'
            }
        });
    } catch (err) {
        console.error('getDeprivationChoropleth error:', err);
        res.status(500).json({ success: false, error: 'Failed to build deprivation choropleth' });
    }
};

export { DIMENSION_SETS, DIM, DEFAULT_BUILDING_AGE_CUTOFF, DEFAULT_K_SHARE, vectorOf, indexAt, computeDeprivation };
