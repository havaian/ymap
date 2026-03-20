// backend/src/services/seeder.js
// Generates mock citizen issue reports and program task verifications for demo / testing.

import Issue from '../issue/model.js';
import Comment from '../comment/model.js';
import Object_ from '../object/model.js';
import User from '../user/model.js';
import Task from '../task/model.js';
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

const OBJECT_TYPE_CATEGORY = {
    school: 'Schools & Kindergartens',
    kindergarten: 'Schools & Kindergartens',
    health_post: 'Hospitals & Clinics'
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

// ── Verification templates ────────────────────────────────────────────────────

const VERIFICATION_COMMENTS = {
    done: [
        'Проверил лично — всё сделано',
        'Работы завершены, результат хороший',
        'Задача выполнена в полном объёме',
        'Всё починено, жильцы довольны',
        'Ремонт завершён, качество нормальное',
        'Наблюдал выполнение работ — всё в порядке',
        'Подтверждаю выполнение',
    ],
    problem: [
        'Сделано некачественно, нужна доработка',
        'Работы не завершены, проблема осталась',
        'Видно, что ремонт формальный',
        'Ситуация не изменилась',
        'Выполнено, но уже снова сломалось',
        'Не соответствует заявленному объёму работ',
        'Требуется повторная проверка',
    ],
};

// Probability of "done" verdict per task status
const VERIF_STATUS_CHANCE = {
    Completed: 0.85,
    'Pending Verification': 0.55,
    'In Progress': 0.35,
    Planned: 0.25,
    Failed: 0.15,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

// ── generateMockData ──────────────────────────────────────────────────────────

export const generateMockData = async (count = 1000, includeComments = true) => {
    console.log(`🌱 Generating ${count} mock issues...`);

    // Auto-clear leftover seeded data
    const existingIds = await Issue.find({ isSeeded: true }).distinct('_id');
    if (existingIds.length > 0) {
        console.log(`🧹 Clearing ${existingIds.length} leftover seeded issues...`);
        const seededUserIds = await User.find({ isSeeded: true, email: /^mock\./ }).distinct('_id');
        await Promise.all([
            Comment.deleteMany({ userId: { $in: seededUserIds } }),
            Issue.deleteMany({ isSeeded: true }),
            User.deleteMany({ isSeeded: true, email: /^mock\./ }),
        ]);
    }

    // Step 1: Create mock users — rounds=4 for speed (seed data only)
    const usersNeeded = Math.ceil(count / 10);
    const hashedPassword = await bcrypt.hash('MockUser123!', 4);
    const runId = Date.now();

    const mockUsers = Array.from({ length: usersNeeded }, (_, i) => ({
        name: MOCK_USER_NAMES[i % MOCK_USER_NAMES.length],
        email: `mock.${runId}.${i + 1}@test.ymap.uz`,
        password: hashedPassword,
        role: 'CITIZEN',
        isSeeded: true
    }));

    const insertedUsers = await User.insertMany(mockUsers);
    console.log(`✅ Created ${insertedUsers.length} mock users`);

    // Step 2: Random sample of objects across all regions via $sample
    const objects = await Object_.aggregate([{ $sample: { size: 500 } }]);

    if (objects.length === 0) {
        throw new Error('No objects found. Please sync objects first via POST /api/admin/sync-objects.');
    }

    // Step 3: Generate issues — count standalone during generation, not after
    const issues = [];
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
    let standaloneCount = 0;

    for (let i = 0; i < count; i++) {
        const user = insertedUsers[Math.floor(i / 10)];
        const createdAt = new Date(ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo));

        const severityRand = Math.random();
        const severity = severityRand > 0.9 ? 'Critical' : severityRand > 0.7 ? 'High' : severityRand > 0.4 ? 'Medium' : 'Low';

        const statusRand = Math.random();
        const status = statusRand > 0.9 ? 'Resolved' : statusRand > 0.7 ? 'In Progress' : 'Open';

        if (Math.random() < 0.3) {
            // ── Standalone issue ──────────────────────────────────────────────
            standaloneCount++;
            const category = randomChoice(STANDALONE_CATEGORIES);
            const title = randomChoice(STANDALONE_TEMPLATES[category]);
            const lat = randomFloat(TASHKENT_BOUNDS.latMin, TASHKENT_BOUNDS.latMax);
            const lng = randomFloat(TASHKENT_BOUNDS.lngMin, TASHKENT_BOUNDS.lngMax);

            issues.push({
                lat, lng,
                location: { type: 'Point', coordinates: [lng, lat] },
                title,
                description: `Обращение от жителя. ${title}. Просьба обратить внимание.`,
                category,
                subCategory: 'General/Other',
                severity, status,
                votes: randomBetween(1, 300),
                userId: user._id,
                aiSummary: `Автоматически определено: ${severity} приоритет.`,
                isSeeded: true,
                createdAt
            });
        } else {
            // ── Object-bound issue ────────────────────────────────────────────
            const obj = randomChoice(objects);
            const objType = obj.objectType;
            const templates = PROBLEM_TEMPLATES[objType] || PROBLEM_TEMPLATES.school;
            const subCategory = randomChoice(['Water', 'Electricity', 'General/Other']);
            const title = randomChoice(templates[subCategory] || templates['General/Other']);
            const category = OBJECT_TYPE_CATEGORY[objType] || 'Schools & Kindergartens';
            const latOffset = (Math.random() - 0.5) * 0.002;
            const lngOffset = (Math.random() - 0.5) * 0.002;

            issues.push({
                lat: obj.lat + latOffset,
                lng: obj.lng + lngOffset,
                location: { type: 'Point', coordinates: [obj.lng + lngOffset, obj.lat + latOffset] },
                title,
                description: `Обращение по объекту ${obj.name}. ${title}. Требуется решение.`,
                category, subCategory, severity, status,
                votes: randomBetween(1, 500),
                userId: user._id,
                objectId: obj._id.toString(),
                objectName: obj.name,
                aiSummary: `Автоматически определено: ${severity} приоритет.`,
                isSeeded: true,
                createdAt
            });
        }
    }

    const insertedIssues = await Issue.insertMany(issues);
    const boundCount = issues.length - standaloneCount;
    console.log(`✅ Created ${insertedIssues.length} mock issues (${boundCount} object-bound, ${standaloneCount} standalone)`);

    // Step 4: Generate comments — batched to avoid large in-memory arrays
    let commentsGenerated = 0;
    if (includeComments) {
        const COMMENT_BATCH = 500;
        let batch = [];

        for (let u = 0; u < insertedUsers.length; u++) {
            for (let j = 0; j < 5; j++) {
                batch.push({
                    issueId: randomChoice(insertedIssues)._id,
                    userId: insertedUsers[u]._id,
                    author: insertedUsers[u].name,
                    text: randomChoice(COMMENT_TEMPLATES),
                    createdAt: new Date(now - randomBetween(0, 30 * 24 * 60 * 60 * 1000))
                });
                commentsGenerated++;
                if (batch.length >= COMMENT_BATCH) {
                    await Comment.insertMany(batch);
                    batch = [];
                }
            }
        }
        if (batch.length > 0) await Comment.insertMany(batch);
    }

    console.log(`✅ Generated ${count} mock issues with ${commentsGenerated} comments`);

    return {
        generated: count,
        standalone: standaloneCount,
        bound: boundCount,
        comments: commentsGenerated,
        users: usersNeeded,
        objects: objects.length
    };
};

// ── clearSeededData ───────────────────────────────────────────────────────────

export const clearSeededData = async () => {
    // Use seeded user IDs to delete comments — avoids loading all issue IDs into memory
    const seededUserIds = await User.find({ isSeeded: true }).distinct('_id');

    const [commentsResult, issuesResult, usersResult] = await Promise.all([
        Comment.deleteMany({ userId: { $in: seededUserIds } }),
        Issue.deleteMany({ isSeeded: true }),
        User.deleteMany({ isSeeded: true })
    ]);

    console.log(`🗑️ Cleared ${issuesResult.deletedCount} seeded issues, ${commentsResult.deletedCount} comments, ${usersResult.deletedCount} users`);

    return {
        issues: issuesResult.deletedCount,
        comments: commentsResult.deletedCount,
        users: usersResult.deletedCount
    };
};

// ── generateProgramVerifications ──────────────────────────────────────────────
// Adds mock citizen verifications to existing program tasks.

export const generateProgramVerifications = async (maxPerTask = 6) => {
    console.log('🌱 Generating mock program task verifications...');

    const tasks = await Task.find({ programId: { $exists: true, $ne: null } }).lean();
    if (!tasks.length) {
        console.log('⚠️  No program tasks found. Create program tasks first.');
        return { tasks: 0, verifications: 0, users: 0 };
    }
    console.log(`📋 Found ${tasks.length} program tasks`);

    // rounds=4 — seed data only, speed matters
    const hashedPassword = await bcrypt.hash('MockUser123!', 4);
    const POOL_SIZE = 40;
    const runId = Date.now();

    const mockUsers = Array.from({ length: POOL_SIZE }, (_, i) => ({
        name: MOCK_USER_NAMES[i % MOCK_USER_NAMES.length],
        email: `verif.${runId}.${i + 1}@test.ymap.uz`,
        password: hashedPassword,
        role: 'CITIZEN',
        isSeeded: true,
    }));

    const insertedUsers = await User.insertMany(mockUsers);
    console.log(`✅ Created ${insertedUsers.length} verifier users`);

    let totalVerifications = 0;

    for (const task of tasks) {
        // Skip tasks that already have verifications
        if (task.verifications?.length > 0) continue;

        const count = randomBetween(1, maxPerTask);
        const doneChance = VERIF_STATUS_CHANCE[task.status] ?? 0.5;

        // Shuffle pool and take first N — guaranteed unique, no retry loop
        const shuffled = [...insertedUsers]
            .sort(() => Math.random() - 0.5)
            .slice(0, count);

        const verifs = shuffled.map(user => {
            const status = Math.random() < doneChance ? 'done' : 'problem';
            const addComment = Math.random() < 0.65;
            return {
                userId: user._id,
                status,
                comment: addComment ? randomChoice(VERIFICATION_COMMENTS[status]) : undefined,
                createdAt: new Date(Date.now() - randomBetween(0, 45 * 24 * 60 * 60 * 1000)),
            };
        });

        if (verifs.length > 0) {
            await Task.findByIdAndUpdate(task._id, {
                $push: { verifications: { $each: verifs } },
            });
            totalVerifications += verifs.length;
        }
    }

    console.log(`✅ Added ${totalVerifications} verifications across ${tasks.length} tasks`);
    return { tasks: tasks.length, verifications: totalVerifications, users: insertedUsers.length };
};

// ── clearProgramVerifications ─────────────────────────────────────────────────

export const clearProgramVerifications = async () => {
    // Use distinct to avoid loading full user documents into memory
    const verifIds = await User.find({ isSeeded: true, email: /^verif\./ }).distinct('_id');

    let modifiedTasks = 0;
    if (verifIds.length > 0) {
        const result = await Task.updateMany(
            { 'verifications.userId': { $in: verifIds } },
            { $pull: { verifications: { userId: { $in: verifIds } } } }
        );
        modifiedTasks = result.modifiedCount;
        await User.deleteMany({ _id: { $in: verifIds } });
    }

    console.log(`🗑️  Cleared verifications from ${modifiedTasks} tasks, removed ${verifIds.length} verif users`);
    return { modifiedTasks, removedUsers: verifIds.length };
};