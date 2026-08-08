/**
 * backend/src/object/profile.js
 *
 * GET /api/objects/:id/profile
 *
 * Everything the observatory can say about one facility, in one response.
 *
 * The point of the card is that a facility is the level at which a claim can be
 * checked. A district figure is an aggregate nobody can walk up to; a school with
 * a name, a SOATO code and a construction year is something a person standing in
 * front of it can confirm or dispute. So the card is built to be argued with:
 *
 *   - Every dimension of the deprivation index is shown separately, with the raw
 *     registry value that produced it next to the verdict. The composite is never
 *     shown without the decomposition - the same rule the district pages follow.
 *   - Assumptions that are provisional say so. The building-age cutoff is not a
 *     measured constant, it is a placeholder until the ШНК cycle is read, and the
 *     response carries it as a parameter rather than baking it into a verdict.
 *   - A field the registry does not fill is reported as absent, never as zero.
 *     `indeterminate` and `deprived` are different answers and are kept apart all
 *     the way to the interface.
 *   - The history comes from the archive, and every entry carries the window it
 *     happened inside rather than a point in time, because that is what a pair of
 *     snapshots can actually establish.
 *
 * The dimension definitions are imported from analytics/deprivation.js rather
 * than restated here. A second copy would drift, and then one facility would read
 * as deprived on the card and not deprived in the district index built from the
 * same test.
 */

import mongoose from 'mongoose';
import Object_ from './model.js';
import District from '../district/model.js';
import { RegistryChange, Snapshot } from '../snapshot/model.js';
import {
    DIM,
    DIMENSION_SETS,
    DEFAULT_BUILDING_AGE_CUTOFF,
    DEFAULT_K_SHARE,
    vectorOf
} from '../analytics/deprivation.js';
import { FIELD_OF, effectiveAge, loadClass, materialRisk } from '../analytics/scales.js';

const MAX_HISTORY = 200;

// Human labels for the quality flags written at import time. A flag on the card
// is the honest version of a missing number: it says which check the record
// failed, so a reader knows why a figure is absent instead of assuming a bug.
const FLAG_LABEL = {
    code_length: 'Код района неверной длины',
    code_missing: 'Код района отсутствует',
    code_unknown: 'Код района не найден в справочнике СОАТО',
    district_name_mismatch: 'Название района не совпадает с кодом',
    parent_code_mismatch: 'Код региона не совпадает с первыми цифрами кода района',
    capacity_zero: 'Проектная мощность равна нулю',
    enrolment_zero: 'Контингент равен нулю',
    repair_before_build: 'Год ремонта раньше года постройки',
    load_implausible: 'Загруженность вне правдоподобного диапазона'
};

const COORD_SOURCE_LABEL = {
    egov_inn: 'реестр data.egov.uz, соединение по ИНН',
    osm: 'OpenStreetMap',
    field_verified: 'полевая проверка',
    manual: 'внесено вручную',
    district_centroid: 'центроид района',
    none: 'координата неизвестна'
};

const TYPE_LABEL = {
    school: 'Школа',
    kindergarten: 'Детский сад',
    health_post: 'ФАП или СВП'
};

/**
 * The raw registry value behind a dimension, so the verdict can be checked
 * against the field it was derived from rather than taken on trust. FIELD_OF
 * maps a concept to the column on `details`; dimensions assembled from more than
 * one column are spelled out below, and anything with no single backing value
 * returns null so the card shows the verdict with no source line.
 */
function rawFor(obj, dimName) {
    // Dimension names and scale concepts coincide for the single-column ones, so
    // the lookup is direct. Kept as an explicit check rather than passing dimName
    // straight through: a future dimension without a column would otherwise read
    // an undefined field and print an empty value as if it were data.
    if (Object.prototype.hasOwnProperty.call(FIELD_OF, dimName)) {
        const field = FIELD_OF[dimName];
        return obj.details?.[field] ?? null;
    }
    if (dimName === 'capacity') {
        const c = obj.details?.sigimi ?? null;
        const e = obj.details?.umumiyUquvchi ?? null;
        if (c === null && e === null) return null;
        return `${e ?? '-'} из ${c ?? '-'}`;
    }
    if (dimName === 'building') {
        return obj.details?.qurilishYili ?? obj.details?.kapitalTamir ?? null;
    }
    if (dimName === 'repairStatus') {
        return obj.details?.repairStatus ?? obj.details?.kapitalTamir ?? null;
    }
    return null;
}

/**
 * Turns the boolean vector into rows the interface can render without knowing
 * anything about the counting method.
 *
 * `true` deprived, `false` not deprived, `undefined` uncertain. The three are
 * kept distinct: an uncertain dimension is what puts the facility's own c_i into
 * an interval, and collapsing it either way would hide the one thing the card is
 * meant to expose.
 */
function decompose(obj, dims, cfg, vec) {
    return dims.map(name => {
        const verdict = vec.ok ? vec.per[name] : DIM[name].test(obj, cfg);
        return {
            key: name,
            label: DIM[name].label,
            // 'deprived' | 'ok' | 'uncertain' | 'missing'
            status: verdict === null ? 'missing'
                : verdict === undefined ? 'uncertain'
                    : verdict ? 'deprived' : 'ok',
            sourceValue: rawFor(obj, name)
        };
    });
}

export const getObjectProfile = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    const obj = await Object_.findById(id).lean();
    if (!obj) {
        return res.status(404).json({ success: false, message: 'Object not found' });
    }

    const buildingAgeCutoff = Number(req.query.buildingAgeCutoff) > 0
        ? Number(req.query.buildingAgeCutoff)
        : DEFAULT_BUILDING_AGE_CUTOFF;
    const cfg = { buildingAgeCutoff };

    // ── Deprivation, decomposed ───────────────────────────────────────────────
    //
    // A home-based facility is scored on nothing. A family kindergarten operates
    // inside a flat: it has no construction year, no wall material and no design
    // capacity in the sense these dimensions assume, so running the tests on it
    // would produce a verdict about a building that does not exist.
    const dims = DIMENSION_SETS[obj.objectType] ?? [];
    const scorable = obj.objectClass !== 'home_based' && dims.length > 0;

    let deprivation = null;
    if (scorable) {
        const vec = vectorOf(obj, dims, cfg);
        const d = dims.length;
        const rows = decompose(obj, dims, cfg, vec);

        // c_i is an interval whenever a dimension is uncertain. Both ends are
        // published; the midpoint is not, because an averaged interval stops
        // being an interval.
        const cLower = vec.ok ? vec.deprived / d : null;
        const cUpper = vec.ok ? (vec.deprived + vec.uncertain) / d : null;

        deprivation = {
            assessable: vec.ok,
            missingDimension: vec.ok ? null : vec.missingDim,
            dimensionCount: d,
            kShare: Number(DEFAULT_K_SHARE.toFixed(4)),
            // Whether this facility counts as multidimensionally deprived is itself
            // an interval when c_i straddles the cutoff, and the card says so
            // rather than picking a side.
            cLower: cLower === null ? null : Number(cLower.toFixed(4)),
            cUpper: cUpper === null ? null : Number(cUpper.toFixed(4)),
            deprivedLower: cLower === null ? null : cLower >= DEFAULT_K_SHARE - 1e-9,
            deprivedUpper: cUpper === null ? null : cUpper >= DEFAULT_K_SHARE - 1e-9,
            dimensions: rows
        };
    }

    // ── Capacity and age readings ─────────────────────────────────────────────
    const capacity = obj.details?.sigimi ?? null;
    const enrolment = obj.details?.umumiyUquvchi ?? null;
    const shifts = obj.details?.smena ? Number(obj.details.smena) || null : null;

    const age = effectiveAge(obj);
    const risk = materialRisk(obj.details?.materialSten);

    const readings = {
        capacity,
        enrolment,
        loadFactor: obj.loadFactor ?? null,
        loadClass: obj.loadFactor != null ? loadClass(obj.loadFactor, obj.details?.smena) : null,
        shifts,
        // Seats needed beyond what the declared number of shifts can absorb. Null
        // rather than zero when either input is missing: an unknown capacity does
        // not mean a facility is within it.
        seatsOverDeclaredShifts: capacity != null && enrolment != null && shifts
            ? Math.max(0, enrolment - capacity * shifts)
            : null,
        seatsOverSingleShift: capacity != null && enrolment != null
            ? Math.max(0, enrolment - capacity)
            : null,
        buildingAge: age,
        buildingAgeCutoff,
        wallMaterial: obj.details?.materialSten ?? null,
        wallMaterialRisk: risk
    };

    // ── District context ──────────────────────────────────────────────────────
    let district = null;
    if (obj.districtId) {
        const d = await District.findById(obj.districtId).select('name regionCode cadNum areaKm2').lean();
        if (d) {
            district = {
                id: d._id.toString(),
                name: d.name,
                regionCode: d.regionCode,
                soato: d.cadNum ?? obj.districtCode ?? null,
                areaKm2: d.areaKm2 ?? null
            };
        }
    }
    if (!district) {
        // The SOATO code lives on the object itself and does not depend on the
        // District collection being populated, so the card still places the
        // facility when geometry has not been loaded.
        district = {
            id: null,
            name: { ru: obj.tuman ?? null, uz: obj.tuman ?? null, en: null },
            regionCode: obj.regionCode ?? null,
            soato: obj.districtCode ?? null,
            areaKm2: null
        };
    }

    // ── History from the archive ──────────────────────────────────────────────
    //
    // Empty until take-snapshot.js has run at least twice: one snapshot sets t0
    // and establishes no transitions at all. The response says which of the two
    // it is, so an empty list does not read as "nothing ever changed".
    const [changes, snapshotCount] = await Promise.all([
        RegistryChange.find({ sourceApi: obj.sourceApi, sourceId: obj.sourceId })
            .sort({ observedTo: -1 })
            .limit(MAX_HISTORY)
            .lean(),
        Snapshot.countDocuments({ sourceApi: obj.sourceApi })
    ]);

    const history = changes.map(c => ({
        kind: c.kind,
        field: c.field,
        from: c.from,
        to: c.to,
        // Two dates, not one. The change happened somewhere inside this window and
        // the archive cannot narrow it further; printing a single timestamp would
        // claim a precision two snapshots do not have.
        observedFrom: c.observedFrom,
        observedTo: c.observedTo
    }));

    res.json({
        success: true,
        data: {
            object: {
                id: obj._id.toString(),
                name: obj.name,
                nameRu: obj.nameRu ?? null,
                objectType: obj.objectType,
                objectTypeLabel: TYPE_LABEL[obj.objectType] ?? obj.objectType,
                objectClass: obj.objectClass,
                sourceApi: obj.sourceApi,
                sourceId: obj.sourceId,
                inn: obj.inn ?? null,
                viloyat: obj.viloyat ?? null,
                tuman: obj.tuman ?? null,
                lat: obj.lat,
                lng: obj.lng,
                coordSource: obj.coordSource ?? 'none',
                coordSourceLabel: COORD_SOURCE_LABEL[obj.coordSource ?? 'none'],
                coordPrecision: obj.coordPrecision ?? 'none',
                coordShared: !!obj.coordShared,
                details: obj.details ?? {},
                sourceUpdatedAt: obj.sourceUpdatedAt ?? null,
                lastSyncedAt: obj.lastSyncedAt ?? null
            },
            district,
            readings,
            deprivation,
            // Stated rather than assumed. A reader who disagrees with the cutoff can
            // pass another one and watch the verdict move, which is the difference
            // between a published assumption and a hidden one.
            assumptions: {
                buildingAgeCutoff,
                buildingAgeCutoffProvisional: true,
                buildingAgeCutoffNote:
                    'Порог возраста провизорный: цикл капитального ремонта по ШНК не сверен с действующей редакцией.',
                kShare: Number(DEFAULT_K_SHARE.toFixed(4)),
                homeBasedExcluded: obj.objectClass === 'home_based'
            },
            quality: {
                flags: (obj.qualityFlags ?? []).map(f => ({ key: f, label: FLAG_LABEL[f] ?? f }))
            },
            archive: {
                snapshotCount,
                // One snapshot is a starting point, not a history. Saying which case
                // an empty list is keeps it from reading as a stable record.
                state: snapshotCount === 0 ? 'no_snapshots'
                    : snapshotCount === 1 ? 'baseline_only'
                        : 'has_transitions',
                changeCount: history.length,
                truncated: changes.length === MAX_HISTORY,
                history
            }
        }
    });
};
