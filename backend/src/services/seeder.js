import Issue from '../issue/model.js';
import Comment from '../comment/model.js';
import Organization from '../organization/model.js';
import User from '../user/model.js';
import bcrypt from 'bcryptjs';

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

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
    'Шахноза Садыкова', 'Дониёр Муродов', 'Нигора Алимова', 'Бахтиёр Эргашев',
    'Зулфия Холматова', 'Рашид Абдуллаев', 'Латофат Каримова', 'Шахбоз Раупов',
    'Мухаббат Усмонова', 'Комил Шарипов', 'Дилноз Рахимова', 'Жасурбек Назаров',
    'Феруза Султанова', 'Ойбек Турдиев', 'Нозима Юнусова', 'Равшанбек Махмудов',
    'Дилдора Аминова', 'Шерзодбек Джураева', 'Гулнора Каримова', 'Достонбек Исмаилов',
    'Шахзод Расулов', 'Нилуфар Тошматова', 'Бахром Махмудов', 'Озодахон Нурматова',
    'Умидбек Абдуллаев', 'Дилафруз Камолова', 'Жавохир Усманов', 'Мадина Ахмадова',
    'Шухрат Рахмонов', 'Нозимахон Холматова', 'Фарход Турсунов', 'Диёрабону Саттарова',
    'Санжар Мирзаев', 'Сайёрахон Исмоилова', 'Акмалбек Юлдашев', 'Зулфияхон Раимова',
    'Рашидбек Садыков', 'Латофатхон Муродова', 'Шахбозбек Алимов', 'Мухаббатхон Эргашева',
    'Комилбек Холматов', 'Дилнозахон Абдуллаева', 'Жасур Каримов', 'Ойбекбек Раупов'
];

const PROBLEM_TEMPLATES = {
    'Schools & Kindergartens': {
        Water: [
            'Не работает водопровод в туалете',
            'Протечка воды в коридоре',
            'Слабый напор воды',
            'Проблемы с горячей водой'
        ],
        Electricity: [
            'Отключили свет в классе',
            'Не работает освещение',
            'Проблемы с розетками',
            'Перегорели лампы'
        ],
        'General/Other': [
            'Требуется ремонт крыши',
            'Сломаны окна',
            'Проблемы с отоплением',
            'Нужен ремонт пола'
        ]
    },
    'Hospitals & Clinics': {
        Water: [
            'Нет воды в процедурной',
            'Протечка в санузле',
            'Низкое давление воды',
            'Проблемы с канализацией'
        ],
        Electricity: [
            'Отключение электричества',
            'Неисправность освещения',
            'Проблемы с электропитанием аппаратуры',
            'Перебои со светом'
        ],
        'General/Other': [
            'Ремонт помещения',
            'Проблемы с вентиляцией',
            'Нужна замена окон',
            'Требуется покраска стен'
        ]
    }
};

// Standalone issue templates — no organization, reported by citizens on the street.
// Keys MUST match IssueCategory enum values in types.ts exactly.
const STANDALONE_TEMPLATES = {
    Roads: [
        'Яма на дороге угрожает безопасности',
        'Разбитый асфальт на перекрёстке',
        'Отсутствует разметка на дороге',
        'Сломан светофор',
        'Повреждённый тротуар',
        'Нет пешеходного перехода',
        'Затопление дороги после дождя',
        'Упавшее дерево перекрыло проезд',
        'Выбоины на дороге рядом с жилым домом',
        'Сломан дорожный знак'
    ],
    'Water & Sewage': [
        'Прорыв водопровода на улице',
        'Вода течёт из-под земли',
        'Неприятный запах из канализационного люка',
        'Открытый канализационный люк',
        'Затопление подвала из-за прорыва',
        'Лужа из грунтовых вод посреди двора',
        'Отключили воду без предупреждения',
        'Ржавая вода из крана'
    ],
    Electricity: [
        'Оборванный провод на земле',
        'Не горят фонари на улице',
        'Искрит электрощит во дворе',
        'Отключили электричество в квартале',
        'Сломан уличный фонарь',
        'Провода свисают над тротуаром'
    ],
    'Schools & Kindergartens': [
        'Опасный участок дороги к школе',
        'Нет пешеходного перехода у школы',
        'Стихийная свалка рядом со школой',
        'Отсутствует освещение у входа в школу'
    ],
    'Hospitals & Clinics': [
        'Несанкционированная свалка рядом с поликлиникой',
        'Нет пандуса у входа в медучреждение',
        'Опасный участок на пути к больнице',
        'Грязь и антисанитария у входа'
    ],
    'Waste Management': [
        'Стихийная свалка мусора во дворе',
        'Переполненные мусорные контейнеры',
        'Мусор не убирают уже несколько дней',
        'Сжигают мусор рядом с жилыми домами',
        'Нелегальный сброс строительного мусора',
        'Нет мусорных контейнеров в районе',
        'Разбросанный мусор после рынка',
        'Мусорный бак сломан и переполнен'
    ]
};

// Approximate bounding box for Tashkent city
const TASHKENT_BOUNDS = {
    latMin: 41.20,
    latMax: 41.38,
    lngMin: 69.13,
    lngMax: 69.38
};

const STANDALONE_CATEGORIES = Object.keys(STANDALONE_TEMPLATES);

const COMMENT_TEMPLATES = [
    'Когда планируется ремонт?',
    'Ситуация критическая, нужно срочно решить',
    'Спасибо за внимание к проблеме',
    'Поддерживаю, у нас тоже самое',
    'Надеюсь скоро починят',
    'Проблема актуальна уже несколько недель'
];

const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => Math.random() * (max - min) + min;

export const generateMockData = async (count = 1000, includeComments = true) => {
    console.log(`🌱 Generating ${count} mock issues...`);

    // Auto-clear any leftover seeded data from previous runs to avoid duplicate key errors
    const existingSeededIssueIds = await Issue.find({ isSeeded: true }).distinct('_id');
    if (existingSeededIssueIds.length > 0) {
        console.log(`🧹 Clearing ${existingSeededIssueIds.length} leftover seeded issues from previous run...`);
        await Comment.deleteMany({ issueId: { $in: existingSeededIssueIds } });
        await Issue.deleteMany({ isSeeded: true });
        await User.deleteMany({ isSeeded: true });
        console.log(`✅ Cleared previous seeded data`);
    }

    // Step 1: Calculate how many users we need (1 user per 10 issues + 5 comments)
    const usersNeeded = Math.ceil(count / 10);
    console.log(`👥 Creating ${usersNeeded} mock users...`);

    // Step 2: Create mock users with hashed password
    const hashedPassword = await bcrypt.hash('MockUser123!', 10);
    // Timestamp prefix ensures emails are unique across runs (secondary safety net)
    const runId = Date.now();
    const mockUsers = [];

    for (let i = 0; i < usersNeeded; i++) {
        const userName = MOCK_USER_NAMES[i % MOCK_USER_NAMES.length];
        const email = `mock.${runId}.${i + 1}@test.ymap.uz`;

        mockUsers.push({
            name: userName,
            email,
            password: hashedPassword,
            role: 'CITIZEN',
            district: 'Tashkent',
            isSeeded: true
        });
    }

    const insertedUsers = await User.insertMany(mockUsers);
    console.log(`✅ Created ${insertedUsers.length} mock users`);

    // Step 3: Get organizations
    const orgs = await Organization.find().limit(500);

    if (orgs.length === 0) {
        throw new Error('No organizations found. Please import organizations first.');
    }

    // Step 4: Generate issues with user assignment.
    // ~30% of issues are standalone (no organization), ~70% are org-bound.
    const issues = [];
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
        // Assign user: every 10 issues to same user
        const userIndex = Math.floor(i / 10);
        const user = insertedUsers[userIndex];

        // Weight severities: 70% Medium/Low, 30% High/Critical
        const severityRand = Math.random();
        let severity;
        if (severityRand > 0.9) severity = 'Critical';
        else if (severityRand > 0.7) severity = 'High';
        else if (severityRand > 0.4) severity = 'Medium';
        else severity = 'Low';

        // Weight statuses: 70% Open, 20% In Progress, 10% Resolved
        const statusRand = Math.random();
        let status;
        if (statusRand > 0.9) status = 'Resolved';
        else if (statusRand > 0.7) status = 'In Progress';
        else status = 'Open';

        const createdAt = new Date(ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo));

        if (Math.random() < 0.3) {
            // --- Standalone issue (no organization) ---
            const category = randomChoice(STANDALONE_CATEGORIES);
            const title = randomChoice(STANDALONE_TEMPLATES[category]);
            const lat = randomFloat(TASHKENT_BOUNDS.latMin, TASHKENT_BOUNDS.latMax);
            const lng = randomFloat(TASHKENT_BOUNDS.lngMin, TASHKENT_BOUNDS.lngMax);

            issues.push({
                lat,
                lng,
                location: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                title,
                description: `Обращение от жителя. ${title}. Просьба обратить внимание и решить проблему.`,
                category,
                subCategory: 'General/Other',
                severity,
                status,
                votes: randomBetween(1, 300),
                userId: user._id,
                // organizationId and organizationName intentionally omitted
                aiSummary: `Автоматически определено: ${severity} приоритет. Самостоятельное обращение без привязки к учреждению.`,
                isSeeded: true,
                createdAt
            });
        } else {
            // --- Org-bound issue ---
            const org = randomChoice(orgs);
            const subCategory = randomChoice(['Water', 'Electricity', 'General/Other']);
            const templates = PROBLEM_TEMPLATES[org.type][subCategory];
            const title = randomChoice(templates);

            const latOffset = (Math.random() - 0.5) * 0.002;
            const lngOffset = (Math.random() - 0.5) * 0.002;

            issues.push({
                lat: org.lat + latOffset,
                lng: org.lng + lngOffset,
                location: {
                    type: 'Point',
                    coordinates: [org.lng + lngOffset, org.lat + latOffset]
                },
                title,
                description: `Обращение по объекту ${org.name}. ${title}. Требуется решение проблемы.`,
                category: org.type,
                subCategory,
                severity,
                status,
                votes: randomBetween(1, 500),
                userId: user._id,
                organizationId: org._id.toString(),
                organizationName: org.name,
                aiSummary: `Автоматически определено: ${severity} приоритет. Категория: ${subCategory}.`,
                isSeeded: true,
                createdAt
            });
        }
    }

    const insertedIssues = await Issue.insertMany(issues);
    const standaloneCount = issues.filter(i => !i.organizationId).length;
    const orgBoundCount = issues.length - standaloneCount;
    console.log(`✅ Created ${insertedIssues.length} mock issues (${orgBoundCount} org-bound, ${standaloneCount} standalone)`);

    // Step 5: Generate comments with user assignment
    let commentsGenerated = 0;
    if (includeComments) {
        const allComments = [];

        for (let userIndex = 0; userIndex < insertedUsers.length; userIndex++) {
            const user = insertedUsers[userIndex];

            // Each user creates 5 comments on random issues
            for (let j = 0; j < 5; j++) {
                const randomIssue = randomChoice(insertedIssues);

                allComments.push({
                    issueId: randomIssue._id,
                    userId: user._id,
                    author: user.name,
                    text: randomChoice(COMMENT_TEMPLATES),
                    createdAt: new Date(now - randomBetween(0, 30 * 24 * 60 * 60 * 1000))
                });
                commentsGenerated++;
            }
        }

        if (allComments.length > 0) {
            await Comment.insertMany(allComments);
        }
    }

    console.log(`✅ Generated ${count} mock issues with ${commentsGenerated} comments from ${usersNeeded} users`);

    return {
        generated: count,
        standalone: standaloneCount,
        orgBound: orgBoundCount,
        comments: commentsGenerated,
        users: usersNeeded,
        organizations: orgs.length
    };
};

export const clearSeededData = async () => {
    // Get all seeded issue IDs before deletion
    const seededIssueIds = await Issue.find({ isSeeded: true }).distinct('_id');

    // Delete in order: Comments -> Issues -> Users
    const commentsResult = await Comment.deleteMany({ issueId: { $in: seededIssueIds } });
    const issuesResult = await Issue.deleteMany({ isSeeded: true });
    const usersResult = await User.deleteMany({ isSeeded: true });

    console.log(`🗑️ Cleared ${issuesResult.deletedCount} seeded issues, ${commentsResult.deletedCount} comments, and ${usersResult.deletedCount} users`);

    return {
        issues: issuesResult.deletedCount,
        comments: commentsResult.deletedCount,
        users: usersResult.deletedCount
    };
};