// backend/src/services/seeder.js
// Generates mock citizen issue reports for demo / testing.
// Uses the unified Object model (school, kindergarten, health_post).

import Issue from '../issue/model.js';
import Comment from '../comment/model.js';
import Object_ from '../object/model.js';
import User from '../user/model.js';
import bcrypt from 'bcryptjs';

// ── Issue templates per object type / sub-category ────────────────────────────

const PROBLEM_TEMPLATES = {
    school: {
        Water: [
            'Не работает водопровод в туалете',
            'Протечка воды в коридоре',
            'Слабый напор воды',
            'Проблемы с горячей водой'
        ],
        Electricity: [
            'Отключили свет в классе',
            'Не работает освещение в спортзале',
            'Проблемы с розетками в кабинете',
            'Перегорели лампы в коридоре'
        ],
        'General/Other': [
            'Требуется ремонт крыши',
            'Сломаны окна в классе',
            'Проблемы с отоплением зимой',
            'Нужен ремонт напольного покрытия',
            'Сломаны парты в кабинете'
        ]
    },
    kindergarten: {
        Water: [
            'Нет воды в умывальной комнате',
            'Протечка трубы в игровой',
            'Низкий напор воды',
            'Нет горячей воды'
        ],
        Electricity: [
            'Отключили свет в группе',
            'Неисправны светильники',
            'Проблемы с электропроводкой',
            'Нет освещения на площадке'
        ],
        'General/Other': [
            'Сломано игровое оборудование',
            'Требуется ремонт кровли',
            'Проблемы с вентиляцией',
            'Нужна замена окон',
            'Требуется дезинфекция помещений'
        ]
    },
    health_post: {
        Water: [
            'Нет воды в процедурной',
            'Протечка в санузле',
            'Низкое давление воды',
            'Проблемы с канализацией'
        ],
        Electricity: [
            'Отключение электричества в кабинете',
            'Неисправность освещения',
            'Проблемы с электропитанием аппаратуры',
            'Перебои со светом в коридоре'
        ],
        'General/Other': [
            'Требуется ремонт помещения',
            'Проблемы с вентиляцией',
            'Нужна замена окон',
            'Требуется покраска стен',
            'Сломаны двери в кабинете'
        ]
    }
};

// ── Standalone (not object-bound) issue templates ─────────────────────────────

const STANDALONE_TEMPLATES = {
    Roads: [
        'Яма на дороге угрожает безопасности',
        'Разбитый асфальт на перекрёстке',
        'Отсутствует разметка на дороге',
        'Сломан светофор',
        'Повреждённый тротуар',
        'Нет пешеходного перехода',
        'Затопление дороги после дождя',
        'Упавшее дерево перекрыло проезд'
    ],
    'Water & Sewage': [
        'Прорыв водопровода на улице',
        'Вода течёт из-под земли',
        'Неприятный запах из канализационного люка',
        'Открытый канализационный люк',
        'Затопление подвала из-за прорыва',
        'Отключили воду без предупреждения'
    ],
    Electricity: [
        'Оборванный провод на земле',
        'Не горят фонари на улице',
        'Искрит электрощит во дворе',
        'Отключили электричество в квартале',
        'Провода свисают над тротуаром'
    ],
    'Waste Management': [
        'Стихийная свалка мусора во дворе',
        'Переполненные мусорные контейнеры',
        'Мусор не убирают уже несколько дней',
        'Сжигают мусор рядом с жилыми домами',
        'Нелегальный сброс строительного мусора',
        'Нет мусорных контейнеров в районе'
    ]
};

// Approximate bounding box for Tashkent city
const TASHKENT_BOUNDS = { latMin: 41.20, latMax: 41.38, lngMin: 69.13, lngMax: 69.38 };

const STANDALONE_CATEGORIES = Object.keys(STANDALONE_TEMPLATES);

// Maps objectType → IssueCategory value for object-bound issues
const OBJECT_TYPE_CATEGORY = {
    school:       'Schools & Kindergartens',
    kindergarten: 'Schools & Kindergartens',
    health_post:  'Hospitals & Clinics'
};

const COMMENT_TEMPLATES = [
    'Когда планируется ремонт?',
    'Проблема существует уже давно',
    'Ситуация критическая, нужно срочно решить',
    'Спасибо за внимание к проблеме',
    'Поддерживаю, у нас тоже самое',
    'Надеюсь скоро починят',
    'Проблема актуальна уже несколько недель'
];

const MOCK_USER_NAMES = [
    'Тимур Алимов', 'Нигора Саидова', 'Азиза Каримова', 'Бобур Рахимов',
    'Динара Юсупова', 'Фарход Ахмедов', 'Малика Холматова', 'Рустам Абдуллаев',
    'Шахзода Турсунова', 'Жасур Усманов', 'Гульнора Мирзаева', 'Санжар Раимов',
    'Дилдора Нурматова', 'Элёр Хакимов', 'Нодира Азимова', 'Акбар Саттаров',
    'Лайло Исмоилова', 'Отабек Махмудов', 'Севара Юлдашева', 'Улугбек Камолов',
    'Зилола Рахмонова', 'Мурод Ахмадов', 'Ширин Каримова', 'Давлат Назаров',
    'Озода Султанова', 'Бекзод Холматов', 'Нигина Абдуллаева', 'Жахонгир Эргашев',
    'Мохира Садыкова', 'Искандар Турдиев', 'Камола Усмонова', 'Равшан Шарипов',
    'Дилноза Рахимова', 'Шерзод Муродов', 'Феруза Алимова', 'Бахтиёр Содиков',
    'Дилбар Хашимова', 'Жамшид Давронов', 'Малохат Юнусова', 'Отабек Бобоев',
    'Нилуфар Мухаммадова', 'Зухриддин Раупов', 'Шахноза Аминова', 'Умид Носиров',
    'Гулчехра Ахмедова', 'Рустам Джураев', 'Дилафруз Каримова', 'Бахром Исмаилов',
    'Шахло Расулова', 'Достон Тошматов', 'Озода Махмудова', 'Алишер Нурматов',
    'Нилюфер Абдуллаева', 'Шухрат Камалов', 'Диёра Усманова', 'Фаррух Ахмадов',
    'Мадина Рахмонова', 'Санжарбек Холматов', 'Нозима Турсунова', 'Умидбек Саттаров',
    'Дилором Мирзаева', 'Жавлон Исмоилов', 'Сайёра Юлдашева', 'Акмал Раимов',
    'Шахноза Садыкова', 'Дониёр Муродов', 'Нигора Алимова', 'Бахтиёр Эргашев'
];

const randomChoice  = (arr)       => arr[Math.floor(Math.random() * arr.length)];
const randomBetween = (min, max)  => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat   = (min, max)  => Math.random() * (max - min) + min;

// ── generateMockData ──────────────────────────────────────────────────────────

export const generateMockData = async (count = 1000, includeComments = true) => {
    console.log(`🌱 Generating ${count} mock issues...`);

    // Auto-clear any leftover seeded data
    const existingIds = await Issue.find({ isSeeded: true }).distinct('_id');
    if (existingIds.length > 0) {
        console.log(`🧹 Clearing ${existingIds.length} leftover seeded issues...`);
        await Comment.deleteMany({ issueId: { $in: existingIds } });
        await Issue.deleteMany({ isSeeded: true });
        await User.deleteMany({ isSeeded: true });
    }

    // Step 1: Create mock users (1 per 10 issues)
    const usersNeeded     = Math.ceil(count / 10);
    const hashedPassword  = await bcrypt.hash('MockUser123!', 10);
    const runId           = Date.now();

    const mockUsers = Array.from({ length: usersNeeded }, (_, i) => ({
        name:      MOCK_USER_NAMES[i % MOCK_USER_NAMES.length],
        email:     `mock.${runId}.${i + 1}@test.ymap.uz`,
        password:  hashedPassword,
        role:      'CITIZEN',
        isSeeded:  true
    }));

    const insertedUsers = await User.insertMany(mockUsers);
    console.log(`✅ Created ${insertedUsers.length} mock users`);

    // Step 2: Load objects from the unified Object collection (sample up to 500)
    const objects = await Object_.find().limit(500).lean();

    if (objects.length === 0) {
        throw new Error('No objects found. Please sync objects first via POST /api/admin/sync-objects.');
    }

    // Step 3: Generate issues
    const issues       = [];
    const now          = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
        const user      = insertedUsers[Math.floor(i / 10)];
        const createdAt = new Date(ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo));

        const severityRand = Math.random();
        const severity = severityRand > 0.9 ? 'Critical' : severityRand > 0.7 ? 'High' : severityRand > 0.4 ? 'Medium' : 'Low';

        const statusRand = Math.random();
        const status = statusRand > 0.9 ? 'Resolved' : statusRand > 0.7 ? 'In Progress' : 'Open';

        if (Math.random() < 0.3) {
            // ── Standalone issue ──────────────────────────────────────────────
            const category = randomChoice(STANDALONE_CATEGORIES);
            const title    = randomChoice(STANDALONE_TEMPLATES[category]);
            const lat      = randomFloat(TASHKENT_BOUNDS.latMin, TASHKENT_BOUNDS.latMax);
            const lng      = randomFloat(TASHKENT_BOUNDS.lngMin, TASHKENT_BOUNDS.lngMax);

            issues.push({
                lat,
                lng,
                location:    { type: 'Point', coordinates: [lng, lat] },
                title,
                description: `Обращение от жителя. ${title}. Просьба обратить внимание.`,
                category,
                subCategory: 'General/Other',
                severity,
                status,
                votes:       randomBetween(1, 300),
                userId:      user._id,
                aiSummary:   `Автоматически определено: ${severity} приоритет.`,
                isSeeded:    true,
                createdAt
            });

        } else {
            // ── Object-bound issue ────────────────────────────────────────────
            const obj        = randomChoice(objects);
            const objType    = obj.objectType;
            const templates  = PROBLEM_TEMPLATES[objType] || PROBLEM_TEMPLATES.school;
            const subCategory = randomChoice(['Water', 'Electricity', 'General/Other']);
            const title      = randomChoice(templates[subCategory] || templates['General/Other']);
            const category   = OBJECT_TYPE_CATEGORY[objType] || 'Schools & Kindergartens';

            const latOffset  = (Math.random() - 0.5) * 0.002;
            const lngOffset  = (Math.random() - 0.5) * 0.002;

            issues.push({
                lat:         obj.lat + latOffset,
                lng:         obj.lng + lngOffset,
                location:    { type: 'Point', coordinates: [obj.lng + lngOffset, obj.lat + latOffset] },
                title,
                description: `Обращение по объекту ${obj.name}. ${title}. Требуется решение.`,
                category,
                subCategory,
                severity,
                status,
                votes:       randomBetween(1, 500),
                userId:      user._id,
                objectId:    obj._id.toString(),
                objectName:  obj.name,
                aiSummary:   `Автоматически определено: ${severity} приоритет.`,
                isSeeded:    true,
                createdAt
            });
        }
    }

    const insertedIssues = await Issue.insertMany(issues);
    const standaloneCount = issues.filter(i => !i.objectId).length;
    const boundCount      = issues.length - standaloneCount;
    console.log(`✅ Created ${insertedIssues.length} mock issues (${boundCount} object-bound, ${standaloneCount} standalone)`);

    // Step 4: Generate comments
    let commentsGenerated = 0;
    if (includeComments) {
        const allComments = [];
        for (let u = 0; u < insertedUsers.length; u++) {
            for (let j = 0; j < 5; j++) {
                allComments.push({
                    issueId:   randomChoice(insertedIssues)._id,
                    userId:    insertedUsers[u]._id,
                    author:    insertedUsers[u].name,
                    text:      randomChoice(COMMENT_TEMPLATES),
                    createdAt: new Date(now - randomBetween(0, 30 * 24 * 60 * 60 * 1000))
                });
                commentsGenerated++;
            }
        }
        if (allComments.length > 0) await Comment.insertMany(allComments);
    }

    console.log(`✅ Generated ${count} mock issues with ${commentsGenerated} comments`);

    return {
        generated:  count,
        standalone: standaloneCount,
        bound:      boundCount,
        comments:   commentsGenerated,
        users:      usersNeeded,
        objects:    objects.length
    };
};

// ── clearSeededData ───────────────────────────────────────────────────────────

export const clearSeededData = async () => {
    const seededIds = await Issue.find({ isSeeded: true }).distinct('_id');
    const [commentsResult, issuesResult, usersResult] = await Promise.all([
        Comment.deleteMany({ issueId: { $in: seededIds } }),
        Issue.deleteMany({ isSeeded: true }),
        User.deleteMany({ isSeeded: true })
    ]);

    console.log(`🗑️ Cleared ${issuesResult.deletedCount} seeded issues, ${commentsResult.deletedCount} comments, ${usersResult.deletedCount} users`);

    return {
        issues:   issuesResult.deletedCount,
        comments: commentsResult.deletedCount,
        users:    usersResult.deletedCount
    };
};