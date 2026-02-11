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

export const generateMockData = async (count = 1000, includeComments = true) => {
    console.log(`🌱 Generating ${count} mock issues...`);

    // Step 1: Calculate how many users we need (1 user per 10 issues + 5 comments)
    const usersNeeded = Math.ceil(count / 10);
    console.log(`👥 Creating ${usersNeeded} mock users...`);

    // Step 2: Create mock users with hashed password
    const hashedPassword = await bcrypt.hash('MockUser123!', 10);
    const mockUsers = [];

    for (let i = 0; i < usersNeeded; i++) {
        const userName = MOCK_USER_NAMES[i % MOCK_USER_NAMES.length];
        const email = `mock.user${i + 1}@test.ymap.uz`;

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

    // Step 4: Generate issues with user assignment
    const issues = [];
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
        // Assign user: every 10 issues to same user
        const userIndex = Math.floor(i / 10);
        const user = insertedUsers[userIndex];

        const org = randomChoice(orgs);
        const subCategory = randomChoice(['Water', 'Electricity', 'General/Other']);
        const templates = PROBLEM_TEMPLATES[org.type][subCategory];
        const title = randomChoice(templates);

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
            createdAt: new Date(ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo))
        });
    }

    const insertedIssues = await Issue.insertMany(issues);
    console.log(`✅ Created ${insertedIssues.length} mock issues`);

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