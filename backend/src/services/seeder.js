import Issue from '../issue/model.js';
import Comment from '../comment/model.js';
import Organization from '../organization/model.js';

const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

const MOCK_USERS = [
    'Тимур Алимов', 'Нигора Саидова', 'Азиза Каримова', 'Бобур Рахимов',
    'Динара Юсупова', 'Фарход Ахмедов', 'Малика Холматова', 'Рустам Абдуллаев'
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

    const orgs = await Organization.find().limit(500);

    if (orgs.length === 0) {
        throw new Error('No organizations found. Please import organizations first.');
    }

    const issues = [];
    const now = Date.now();
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
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
            organizationId: org._id.toString(),
            organizationName: org.name,
            aiSummary: `Автоматически определено: ${severity} приоритет. Категория: ${subCategory}.`,
            isSeeded: true,
            createdAt: new Date(ninetyDaysAgo + Math.random() * (now - ninetyDaysAgo))
        });
    }

    const insertedIssues = await Issue.insertMany(issues);

    // Generate comments separately
    let commentsGenerated = 0;
    if (includeComments) {
        const allComments = [];
        for (const issue of insertedIssues) {
            if (Math.random() > 0.3) {
                const commentCount = randomBetween(0, 3);
                for (let j = 0; j < commentCount; j++) {
                    allComments.push({
                        issueId: issue._id,
                        userId: null,
                        author: randomChoice(MOCK_USERS),
                        text: randomChoice(COMMENT_TEMPLATES),
                        createdAt: new Date(now - randomBetween(0, 30 * 24 * 60 * 60 * 1000))
                    });
                    commentsGenerated++;
                }
            }
        }
        if (allComments.length > 0) {
            await Comment.insertMany(allComments);
        }
    }

    console.log(`✅ Generated ${count} mock issues with ${commentsGenerated} comments`);

    return {
        generated: count,
        comments: commentsGenerated,
        organizations: orgs.length
    };
};

export const clearSeededData = async () => {
    const issuesResult = await Issue.deleteMany({ isSeeded: true });

    // Get all seeded issue IDs before deletion
    const seededIssueIds = await Issue.find({ isSeeded: true }).distinct('_id');
    const commentsResult = await Comment.deleteMany({ issueId: { $in: seededIssueIds } });

    console.log(`🗑️ Cleared ${issuesResult.deletedCount} seeded issues and ${commentsResult.deletedCount} comments`);

    return {
        issues: issuesResult.deletedCount,
        comments: commentsResult.deletedCount
    };
};