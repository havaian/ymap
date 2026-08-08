/**
 * backend/src/analytics/capacity.js
 *
 * М1, first stage: the seat deficit that exists today.
 *
 * The forecast half of М1 needs district births and is not implemented here,
 * because there is no source for them yet. The endpoint says so rather than
 * substituting a growth assumption: a projection built on an invented rate would
 * be indistinguishable in shape from one built on registry data, and the whole
 * argument for the model rests on the opposite property. See `forecast` in the
 * response.
 *
 * What is computable today is the deficit, and it splits three ways. The split
 * matters more than the total, because each part is answered by a different
 * decision.
 *
 *   aboveOneShift    pupils beyond single-shift design capacity.
 *                    The figure implied by a policy of ending double shifts.
 *   aboveActualShifts pupils beyond the capacity of the shifts the school
 *                    actually runs. What the current timetable does not absorb.
 *   aboveTwoShifts   pupils beyond two shifts of design capacity. This part
 *                    cannot be answered by adding a shift at all, only by
 *                    building or by moving the catchment.
 *
 * On the sample. These are sums over loaded records, not over the register. The
 * school file holds 1411 of roughly 8000 rows and randomness of the slice is not
 * established, so no figure here is scaled to the country. Every response carries
 * its own denominator.
 *
 * On capacity itself. `sigimi` is design capacity for one shift. The cross
 * tabulation supports this reading: among double-shift schools 656 of 828 report
 * a load above 1.0, against 113 of 581 among single-shift ones. The second shift
 * appears where the first is full.
 *
 * GET /api/analytics/capacity
 *   ?objectType=school|kindergarten   default school
 *   ?regionCode=1703
 *   ?minAssessed=5                    districts below this are held out
 */

import Object_ from '../object/model.js';
import District from '../district/model.js';
import { loadClass } from './scales.js';

// Kindergartens have capacity and enrolment but no shift field, so their deficit
// is computed against one shift only and the shift-dependent parts are null.
const SHIFTED_TYPES = new Set(['school']);

// Flags that make a capacity reading unusable. A load above three is a data error
// rather than a crowded building, and summing it would move the national total by
// more than the real deficit.
const CAPACITY_VETO_FLAGS = new Set(['load_implausible', 'capacity_zero', 'enrolment_zero']);

function int(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

function emptyBucket() {
    return {
        facilities: 0,
        capacity: 0,
        enrolment: 0,
        aboveOneShift: 0,
        aboveActualShifts: 0,
        aboveTwoShifts: 0,
        classes: {},
        excluded: 0
    };
}

function accumulate(bucket, o, shifted) {
    const cap = int(o.details?.sigimi);
    const enr = int(o.details?.umumiyUquvchi);
    const flags = o.qualityFlags || [];

    if (!cap || cap <= 0 || enr === null || enr <= 0 || flags.some(f => CAPACITY_VETO_FLAGS.has(f))) {
        bucket.excluded++;
        return;
    }

    bucket.facilities++;
    bucket.capacity += cap;
    bucket.enrolment += enr;
    bucket.aboveOneShift += Math.max(0, enr - cap);

    if (shifted) {
        const shifts = int(o.details?.smena);
        // A missing shift count falls back to one, which is the conservative
        // direction: it can only overstate what the timetable fails to absorb, and
        // the count of such records is reported so the effect is bounded.
        const s = shifts && shifts >= 1 ? shifts : 1;
        bucket.aboveActualShifts += Math.max(0, enr - cap * s);
        bucket.aboveTwoShifts += Math.max(0, enr - cap * 2);

        const cls = loadClass(o.loadFactor, o.details?.smena);
        const key = cls || 'undetermined';
        bucket.classes[key] = (bucket.classes[key] || 0) + 1;
    }
}

function finish(bucket, shifted) {
    const load = bucket.capacity > 0 ? Number((bucket.enrolment / bucket.capacity).toFixed(4)) : null;
    return {
        facilities: bucket.facilities,
        excluded: bucket.excluded,
        capacity: bucket.capacity,
        enrolment: bucket.enrolment,
        loadFactor: load,
        deficit: {
            aboveOneShift: bucket.aboveOneShift,
            aboveActualShifts: shifted ? bucket.aboveActualShifts : null,
            aboveTwoShifts: shifted ? bucket.aboveTwoShifts : null
        },
        classes: shifted ? bucket.classes : null
    };
}

export const getCapacity = async (req, res) => {
    try {
        const objectType = String(req.query.objectType || 'school');
        if (!['school', 'kindergarten'].includes(objectType)) {
            return res.status(400).json({
                success: false,
                error: 'objectType must be school or kindergarten; health posts carry no capacity field'
            });
        }
        const shifted = SHIFTED_TYPES.has(objectType);
        const minAssessed = req.query.minAssessed ? parseInt(req.query.minAssessed, 10) : 5;

        const match = { objectType, objectClass: 'building' };
        if (req.query.regionCode) match.regionCode = parseInt(req.query.regionCode, 10);

        const objects = await Object_.find(match)
            .select('districtCode regionCode tuman viloyat details loadFactor qualityFlags')
            .lean();

        if (objects.length === 0) {
            return res.json({
                success: true,
                data: { national: null, districts: [] },
                meta: { objectType, note: 'нет объектов этого типа' }
            });
        }

        const national = emptyBucket();
        const buckets = new Map();

        for (const o of objects) {
            accumulate(national, o, shifted);
            const key = o.districtCode || '(без района)';
            if (!buckets.has(key)) {
                buckets.set(key, { ...emptyBucket(), districtCode: o.districtCode || null, tuman: o.tuman, regionCode: o.regionCode, viloyat: o.viloyat });
            }
            accumulate(buckets.get(key), o, shifted);
        }

        const codes = [...buckets.values()].map(b => b.districtCode).filter(Boolean);
        const districtDocs = await District.find({ cadNum: { $in: codes } })
            .select('cadNum name')
            .lean();
        const nameByCode = new Map(districtDocs.map(d => [d.cadNum, d.name]));

        const districts = [...buckets.values()]
            .map(b => ({
                districtCode: b.districtCode,
                name: nameByCode.get(b.districtCode) || { uz: b.tuman || '', ru: '', en: '' },
                tuman: b.tuman,
                regionCode: b.regionCode,
                viloyat: b.viloyat,
                ...finish(b, shifted),
                // Held out rather than published low. A district with two loaded
                // schools has a deficit figure that says more about the sample than
                // about the district.
                belowThreshold: b.facilities < minAssessed
            }))
            .sort((a, b) => {
                const key = shifted ? 'aboveTwoShifts' : 'aboveOneShift';
                return (b.deficit[key] ?? 0) - (a.deficit[key] ?? 0);
            });

        res.json({
            success: true,
            data: {
                national: finish(national, shifted),
                districts
            },
            meta: {
                objectType,
                asOf: new Date().toISOString().slice(0, 10),
                minAssessed,
                deficitDefinitions: {
                    aboveOneShift: 'учеников сверх проектной мощности одной смены',
                    aboveActualShifts: 'учеников сверх мощности фактически работающих смен',
                    aboveTwoShifts: 'учеников сверх двух смен; второй сменой уже не решается'
                },
                capacityReading: 'sigimi - проектная мощность на одну смену. Подтверждается кросс-таблицей: среди двухсменных школ 656 из 828 имеют загруженность выше 1,0, среди односменных 113 из 581.',
                // The forecast half of М1 is declared missing rather than filled in.
                forecast: {
                    available: false,
                    requires: [
                        'рождаемость по районам, Агентство статистики',
                        'дожитие по возрастам',
                        'охват образованием по возрастам'
                    ],
                    property: 'При горизонте до 7 лет все влияющие когорты уже родились, поэтому такой прогноз определяется фактами, а не предположением о рождаемости. Это верно только при наличии районной рождаемости.',
                    reason: 'Источник районной рождаемости не подключён. Прогноз не публикуется вместо того, чтобы подставить темп роста.'
                },
                caveat: 'Суммы по загруженной выборке, а не по реестру. Экстраполяция на страну не производится: случайность среза не подтверждена.',
                denominators: {
                    objectsInScope: objects.length,
                    counted: national.facilities,
                    excludedForDataQuality: national.excluded
                }
            }
        });
    } catch (err) {
        console.error('getCapacity error:', err);
        res.status(500).json({ success: false, error: 'Failed to compute capacity deficit' });
    }
};

export { accumulate, finish, emptyBucket };
