/**
 * UZ → EN / RU translation map for Uzbekistan regions and districts.
 * 
 * Keys are normalized UZ names (lowercase, suffix stripped).
 * Used by import-geodata.js to populate multilingual names from the
 * crop.agro.uz API which only returns UZ names.
 * 
 * To add/fix a translation, just add an entry to the appropriate map.
 * The import script falls back to UZ name if no translation is found.
 */

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const SUFFIXES = /\s*(viloyati|tumani|shahri|shaxri|shahar|respublikasi|sh\.|sh|t\.)\s*$/i;

// All apostrophe-like unicode chars → standard ASCII apostrophe
const APOSTROPHE_VARIANTS = /[\u02BB\u02BC\u2018\u2019\u201B\u0060\u00B4\u2032]/g;

// Common Cyrillic lookalike → Latin replacements
const CYRILLIC_LATIN = [
    [/\u0430/g, 'a'],  // а → a
    [/\u0435/g, 'e'],  // е → e
    [/\u043E/g, 'o'],  // о → o
    [/\u0440/g, 'r'],  // р → r (looks like Latin p/r)
    [/\u0441/g, 's'],  // с → s
    [/\u0443/g, 'u'],  // у → u
    [/\u0445/g, 'x'],  // х → x
    [/\u0410/g, 'a'],  // А → a
    [/\u0415/g, 'e'],  // Е → e
    [/\u041E/g, 'o'],  // О → o
    [/\u0421/g, 's'],  // С → s
    [/\u0425/g, 'x'],  // Х → x
];

/**
 * Normalize UZ name for map lookup:
 * - replace unicode apostrophe variants with ASCII '
 * - replace Cyrillic lookalikes with Latin equivalents
 * - lowercase
 * - strip administrative suffixes (viloyati, tumani, shahri, etc.)
 */
export function normalizeUzName(nameuz) {
    if (!nameuz) return '';
    let n = nameuz;
    // Normalize apostrophes
    n = n.replace(APOSTROPHE_VARIANTS, "'");
    // Normalize Cyrillic lookalikes
    for (const [from, to] of CYRILLIC_LATIN) {
        n = n.replace(from, to);
    }
    return n.toLowerCase().replace(SUFFIXES, '').trim();
}

/**
 * Basic UZ → Latin transliteration for names not in the map.
 * Converts common Uzbek-specific characters to English-friendly equivalents.
 */
function transliterateUz(name) {
    if (!name) return '';
    // Strip suffix first
    let n = name.replace(SUFFIXES, '').trim();
    // Normalize apostrophes
    n = n.replace(APOSTROPHE_VARIANTS, "'");
    // Normalize Cyrillic lookalikes
    for (const [from, to] of CYRILLIC_LATIN) {
        n = n.replace(from, to);
    }
    // Lowercase everything first, then capitalize first letter of each space-separated word
    n = n.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
    // Common UZ → EN letter swaps (applied AFTER capitalization)
    const swaps = [
        [/o['ʻʼ]/gi, 'o'],
        [/g['ʻʼ]/gi, 'g'],
        [/sh/gi, 'sh'],
        [/ch/gi, 'ch'],
        [/['ʻʼ]/g, ''],
        [/x/gi, 'kh'],
        [/q/gi, 'k'],
    ];
    for (const [from, to] of swaps) {
        n = n.replace(from, to);
    }
    // Re-capitalize first letter (swaps may have lowered it)
    n = n.replace(/(^|\s)\S/g, c => c.toUpperCase());
    return n;
}

export function translateRegion(nameuz) {
    const key = normalizeUzName(nameuz);
    if (REGION_NAMES[key]) return REGION_NAMES[key];
    return { en: transliterateUz(nameuz) + ' region', ru: '' };
}

export function translateDistrict(nameuz) {
    const key = normalizeUzName(nameuz);
    if (DISTRICT_NAMES[key]) return DISTRICT_NAMES[key];
    // Detect city vs district from suffix
    const isCity = /\b(shahri|shaxri|shahar|sh\.)\b/i.test(nameuz);
    const enBase = transliterateUz(nameuz);
    return { en: isCity ? enBase + ' city' : enBase + ' district', ru: '' };
}

// ─────────────────────────────────────────────
// Region translations (14 regions)
// ─────────────────────────────────────────────

const REGION_NAMES = {
    'andijon': { en: 'Andijan region', ru: 'Андижанская область' },
    'buxoro': { en: 'Bukhara region', ru: 'Бухарская область' },
    "farg'ona": { en: 'Fergana region', ru: 'Ферганская область' },
    'jizzax': { en: 'Jizzakh region', ru: 'Джизакская область' },
    'xorazm': { en: 'Khorezm region', ru: 'Хорезмская область' },
    'namangan': { en: 'Namangan region', ru: 'Наманганская область' },
    'navoiy': { en: 'Navoi region', ru: 'Навоийская область' },
    'qashqadaryo': { en: 'Kashkadarya region', ru: 'Кашкадарьинская область' },
    'samarqand': { en: 'Samarkand region', ru: 'Самаркандская область' },
    'sirdaryo': { en: 'Syrdarya region', ru: 'Сырдарьинская область' },
    'surxondaryo': { en: 'Surkhandarya region', ru: 'Сурхандарьинская область' },
    'toshkent': { en: 'Tashkent region', ru: 'Ташкентская область' },
    "qoraqalpog'iston": { en: 'Republic of Karakalpakstan', ru: 'Республика Каракалпакстан' },
};

// Special case: "Toshkent shaxri" (city) vs "Toshkent viloyati" (region)
// Both normalize to "toshkent" — handle in the import script by checking suffix

export const TASHKENT_CITY = { en: 'Tashkent city', ru: 'город Ташкент' };
export const TASHKENT_REGION = { en: 'Tashkent region', ru: 'Ташкентская область' };

// ─────────────────────────────────────────────
// District translations (~200 districts)
// ─────────────────────────────────────────────

const DISTRICT_NAMES = {
    // ═══ Andijan region (17) ═══
    'paxtaobod': { en: 'Pakhtaabad', ru: 'Пахтаабад' },
    'marxamat': { en: 'Markhamat', ru: 'Мархамат' },
    'baliqchi': { en: 'Balikchi', ru: 'Балыкчи' },
    'izboskan': { en: 'Izboskan', ru: 'Избоскан' },
    'xonobod': { en: 'Khanabad', ru: 'Ханабад' },
    "ulug'nor": { en: 'Ulugnar', ru: 'Улугнор' },
    'buloqboshi': { en: 'Bulakbashi', ru: 'Булакбаши' },
    "bo'ston": { en: 'Buston', ru: 'Бустон' },
    "xo'jaobod": { en: 'Khujaabad', ru: 'Хужаабад' },
    'andijon': { en: 'Andijan', ru: 'Андижан' },
    'jalaquduq': { en: 'Jalakuduk', ru: 'Жалакудук' },
    "qo'rg'ontepa": { en: 'Kurgontepa', ru: 'Кургонтепа' },
    'asaka': { en: 'Asaka', ru: 'Асака' },
    "oltinko'l": { en: 'Altinkul', ru: 'Алтинкуль' },
    'shahrixon': { en: 'Shakhrikhan', ru: 'Шахрихан' },
    'shaхrixon': { en: 'Shakhrikhan', ru: 'Шахрихан' },  // Cyrillic х variant

    // ═══ Bukhara region (20) ═══
    'kogon': { en: 'Kagan', ru: 'Каган' },
    'buxoro': { en: 'Bukhara', ru: 'Бухара' },
    'romitan': { en: 'Romitan', ru: 'Ромитан' },
    'shofirkon': { en: 'Shafirkan', ru: 'Шафиркан' },
    'qorovulbozor': { en: 'Karaulbazar', ru: 'Караулбазар' },
    'olot': { en: 'Olot', ru: 'Олот' },
    "g'ijduvon": { en: 'Gijduvan', ru: 'Гиждуван' },
    'jondor': { en: 'Jondor', ru: 'Жондор' },
    'peshku': { en: 'Peshku', ru: 'Пешку' },
    'vobkent': { en: 'Vabkent', ru: 'Вабкент' },
    "qorako'l": { en: 'Karakul', ru: 'Каракуль' },
    'qorakol': { en: 'Karakul', ru: 'Каракуль' },

    // ═══ Fergana region (15) ═══
    "dang'ara": { en: 'Dangara', ru: 'Дангара' },
    'yozyovon': { en: 'Yazyavan', ru: 'Язъяван' },
    'yozovon': { en: 'Yazyavan', ru: 'Язъяван' },
    'quva': { en: 'Kuva', ru: 'Кува' },
    'toshloq': { en: 'Tashlak', ru: 'Ташлак' },
    "farg'ona": { en: 'Fergana', ru: 'Фергана' },
    'oltiariq': { en: 'Oltiarik', ru: 'Олтиарик' },
    'buvayda': { en: 'Buvayda', ru: 'Бувайда' },
    "bog'dod": { en: 'Bagdad', ru: 'Багдад' },
    'rishton': { en: 'Rishton', ru: 'Риштан' },
    'rishot': { en: 'Rishton', ru: 'Риштан' },
    'sux': { en: 'Sukh', ru: 'Сух' },
    'so\'x': { en: 'Sokh', ru: 'Сох' },
    "uchko'prik": { en: 'Uchkuprik', ru: 'Учкуприк' },
    "o'zbekiston": { en: 'Uzbekistan', ru: 'Узбекистан' },
    'beshariq': { en: 'Besharik', ru: 'Бешарик' },
    'furqat': { en: 'Furkat', ru: 'Фуркат' },
    "qo'shtepa": { en: 'Kushtepa', ru: 'Куштепа' },
    'quvasoy': { en: 'Kuvasay', ru: 'Кувасай' },
    "marg'ilon": { en: 'Margilan', ru: 'Маргилан' },
    'qo\'qon': { en: 'Kokand', ru: 'Коканд' },

    // ═══ Jizzakh region (13) ═══
    'arnasoy': { en: 'Arnasay', ru: 'Арнасай' },
    'baxmal': { en: 'Bakhmal', ru: 'Бахмал' },
    "do'stlik": { en: 'Dustlik', ru: 'Дустлик' },
    'forish': { en: 'Forish', ru: 'Фариш' },
    'gallaorol': { en: 'Gallaorol', ru: 'Галлаорол' },
    "g'allaorol": { en: 'Gallaorol', ru: 'Галлаорол' },  // API uses ʻ prefix
    "sharof rashidov": { en: 'Sharof Rashidov', ru: 'Шароф Рашидов' },
    "mirzacho'l": { en: 'Mirzachul', ru: 'Мирзачуль' },
    'paxtakor': { en: 'Pakhtakor', ru: 'Пахтакор' },
    'yangiobod': { en: 'Yangiabad', ru: 'Янгиабад' },
    'zomin': { en: 'Zomin', ru: 'Зомин' },
    'zafarobod': { en: 'Zafarabad', ru: 'Зафарабад' },
    'zarbdor': { en: 'Zarbdar', ru: 'Зарбдар' },
    'jizzax': { en: 'Jizzakh', ru: 'Джизак' },

    // ═══ Kashkadarya region (18) ═══
    'qarshi': { en: 'Karshi', ru: 'Карши' },
    "ko'kdala": { en: 'Kokdala', ru: 'Кокдала' },
    'koson': { en: 'Koson', ru: 'Касан' },
    'kasbi': { en: 'Kasbi', ru: 'Касби' },
    'mirishkor': { en: 'Mirishkor', ru: 'Миришкор' },
    'muborak': { en: 'Mubarek', ru: 'Мубарек' },
    'nishon': { en: 'Nishan', ru: 'Нишан' },
    "g'uzor": { en: 'Guzor', ru: 'Гузар' },
    'chiroqchi': { en: 'Chirakchi', ru: 'Чиракчи' },
    'kitob': { en: 'Kitab', ru: 'Китаб' },
    'shahrisabz': { en: 'Shahrisabz', ru: 'Шахрисабз' },
    'dehqonobod': { en: 'Dekhkanabad', ru: 'Дехканабад' },
    "yakkabog'": { en: 'Yakkabag', ru: 'Яккабаг' },
    'qamashi': { en: 'Kamashi', ru: 'Камаши' },
    'nuriston': { en: 'Nuristan', ru: 'Нуристан' },

    // ═══ Namangan region (16) ═══
    'chortoq': { en: 'Chartak', ru: 'Чартак' },
    "cho'st": { en: 'Chust', ru: 'Чуст' },
    'chust': { en: 'Chust', ru: 'Чуст' },
    'kosonsoy': { en: 'Kasansay', ru: 'Касансай' },
    "mingbuloq": { en: 'Mingbulak', ru: 'Мингбулак' },
    'namangan': { en: 'Namangan', ru: 'Наманган' },
    'norin': { en: 'Norin', ru: 'Норин' },
    'pop': { en: 'Pop', ru: 'Поп' },
    "to'raqo'rg'on": { en: 'Turakurgan', ru: 'Туракурган' },
    "uchqo'rg'on": { en: 'Uchkurgan', ru: 'Учкурган' },
    'uychi': { en: 'Uychi', ru: 'Уйчи' },
    "yanqiqo'rg'on": { en: 'Yangikurgan', ru: 'Янгикурган' },
    "yangiqo'rg'on": { en: 'Yangikurgan', ru: 'Янгикурган' },
    'davlatobod': { en: 'Davlatabad', ru: 'Давлатабад' },

    // ═══ Navoi region (21) ═══
    'qiziltepa': { en: 'Kyzyltepa', ru: 'Кызылтепа' },
    'navbahor': { en: 'Navbahor', ru: 'Навбахор' },
    'xatirchi': { en: 'Khatyrchi', ru: 'Хатырчи' },
    'navoiy': { en: 'Navoi', ru: 'Навои' },
    'konimex': { en: 'Kanimekh', ru: 'Конимех' },
    'nurota': { en: 'Nurata', ru: 'Нурата' },
    'tomdi': { en: 'Tamdy', ru: 'Тамды' },
    'uchquduq': { en: 'Uchkuduk', ru: 'Учкудук' },
    'zarafshon': { en: 'Zarafshan', ru: 'Зарафшан' },
    'karmana': { en: 'Karmana', ru: 'Кармана' },
    "g'ozg'on": { en: 'Gazgan', ru: 'Газган' },

    // ═══ Samarkand region (14) ═══
    "kattaqo'rg'on": { en: 'Kattakurgan', ru: 'Каттакурган' },
    'payariq': { en: 'Payarik', ru: 'Пайарик' },
    'jomboy': { en: 'Jambay', ru: 'Джамбай' },
    "bulung'ur": { en: 'Bulungur', ru: 'Булунгур' },
    'urgut': { en: 'Urgut', ru: 'Ургут' },
    "qo'shrabot": { en: 'Kushrabat', ru: 'Кушрабат' },
    'ishtixon': { en: 'Ishtikhan', ru: 'Иштихан' },
    'oqdaryo': { en: 'Akdarya', ru: 'Акдарья' },
    'samarqand': { en: 'Samarkand', ru: 'Самарканд' },
    'toyloq': { en: 'Tayloq', ru: 'Тайлок' },
    'tayloq': { en: 'Tayloq', ru: 'Тайлок' },  // API spelling variant
    "pastdarg'om": { en: 'Pastdargom', ru: 'Пастдаргом' },
    'narpay': { en: 'Narpay', ru: 'Нарпай' },
    'paxtachi': { en: 'Pakhtachi', ru: 'Пахтачи' },
    'nurobod': { en: 'Nurabod', ru: 'Нурабад' },
    'taylоq': { en: 'Tayloq', ru: 'Тайлок' },

    // ═══ Sirdarya region (12) ═══
    'boyovut': { en: 'Boyovut', ru: 'Баяут' },
    'guliston': { en: 'Guliston', ru: 'Гулистан' },
    'mirzaobod': { en: 'Mirzaabad', ru: 'Мирзаабад' },
    'oqoltin': { en: 'Akaltin', ru: 'Акалтын' },
    'oq oltin': { en: 'Akaltin', ru: 'Акалтын' },  // API sends with space
    'sardoba': { en: 'Sardoba', ru: 'Сардоба' },
    'sayxunobod': { en: 'Saykhunabad', ru: 'Сайхунабад' },
    'sirdaryo': { en: 'Sirdarya', ru: 'Сырдарья' },
    'xovos': { en: 'Khavas', ru: 'Хавас' },
    'yangiyer': { en: 'Yangiyer', ru: 'Янгиер' },
    'shirin': { en: 'Shirin', ru: 'Ширин' },

    // ═══ Surkhandarya region (19) ═══
    'angor': { en: 'Angor', ru: 'Ангор' },
    'bandixon': { en: 'Bandikhon', ru: 'Бандихон' },
    'boysun': { en: 'Boysun', ru: 'Байсун' },
    'denov': { en: 'Denov', ru: 'Денау' },
    "jarqo'rg'on": { en: 'Jarkurgan', ru: 'Джаркурган' },
    'muzrabod': { en: 'Muzrabod', ru: 'Музрабад' },
    'muzrabot': { en: 'Muzrabod', ru: 'Музрабад' },  // Cyrillic а in API name
    'oltinsoy': { en: 'Oltinsoy', ru: 'Алтынсай' },
    "qiziriq": { en: 'Kizirik', ru: 'Кизирик' },
    "kumqo'rg'on": { en: 'Kumkurgan', ru: 'Кумкурган' },
    "qumqo'rg'on": { en: 'Kumkurgan', ru: 'Кумкурган' },  // API spelling variant
    'sariosiyo': { en: 'Sariosiyo', ru: 'Сариасия' },
    'sherobod': { en: 'Sherobod', ru: 'Шерабад' },
    "sho'rchi": { en: 'Shurchi', ru: 'Шурчи' },
    'termiz': { en: 'Termez', ru: 'Термез' },
    'uzun': { en: 'Uzun', ru: 'Узун' },

    // ═══ Tashkent city (10) ═══
    'bektemir': { en: 'Bektemir', ru: 'Бектемир' },
    'chilonzor': { en: 'Chilonzor', ru: 'Чиланзар' },
    'mirobod': { en: 'Mirobod', ru: 'Мирабад' },
    'mirzo ulug\'bek': { en: 'Mirzo Ulugbek', ru: 'Мирзо Улугбек' },
    "mirzo ulug'bek": { en: 'Mirzo Ulugbek', ru: 'Мирзо Улугбек' },
    'olmazor': { en: 'Olmazor', ru: 'Алмазар' },
    'sergeli': { en: 'Sergeli', ru: 'Сергели' },
    'shayxontoxur': { en: 'Shaykhontohur', ru: 'Шайхантахур' },
    "uchtepa": { en: 'Uchtepa', ru: 'Учтепа' },
    'yakkasaroy': { en: 'Yakkasaroy', ru: 'Яккасарай' },
    'yangihayot': { en: 'Yangihayot', ru: 'Янгихаёт' },
    'yashnobod': { en: 'Yashnobod', ru: 'Яшнабад' },
    'yunusobod': { en: 'Yunusobod', ru: 'Юнусабад' },

    // ═══ Tashkent region (11) ═══
    'bekobod': { en: 'Bekabad', ru: 'Бекабад' },
    'bo\'stonliq': { en: 'Bostanlyk', ru: 'Бостанлык' },
    "bo'stonliq": { en: 'Bostanlyk', ru: 'Бостанлык' },
    "bo'ka": { en: 'Buka', ru: 'Бука' },
    'chinoz': { en: 'Chinaz', ru: 'Чиназ' },
    'qibray': { en: 'Kibray', ru: 'Кибрай' },
    'ohangaron': { en: 'Ohangaron', ru: 'Ахангаран' },
    "oqqo'rg'on": { en: 'Akkurgan', ru: 'Аккурган' },
    'parkent': { en: 'Parkent', ru: 'Паркент' },
    'piskent': { en: 'Piskent', ru: 'Пскент' },
    'quyi chirchiq': { en: 'Quyi Chirchiq', ru: 'Нижний Чирчик' },
    'quyichirchiq': { en: 'Quyi Chirchiq', ru: 'Нижний Чирчик' },  // API sends without space
    "o'rta chirchiq": { en: 'Orta Chirchiq', ru: 'Средний Чирчик' },
    "o'rtachirchiq": { en: 'Orta Chirchiq', ru: 'Средний Чирчик' },  // API sends without space
    "yangyo'ul": { en: 'Yangiyul', ru: 'Янгиюль' },
    'yangiyol': { en: 'Yangiyul', ru: 'Янгиюль' },
    "yangiyo'l": { en: 'Yangiyul', ru: 'Янгиюль' },  // API spelling
    "yuqori chirchiq": { en: 'Yuqori Chirchiq', ru: 'Верхний Чирчик' },
    'yuqorichirchiq': { en: 'Yuqori Chirchiq', ru: 'Верхний Чирчик' },  // API sends without space
    'zangiota': { en: 'Zangiota', ru: 'Зангиата' },
    'toshkent': { en: 'Tashkent', ru: 'Ташкент' },
    "olmaliq": { en: 'Olmaliq', ru: 'Алмалык' },
    'angren': { en: 'Angren', ru: 'Ангрен' },
    'nurafshon': { en: 'Nurafshon', ru: 'Нурафшон' },
    'chirchiq': { en: 'Chirchik', ru: 'Чирчик' },

    // ═══ Khorezm region (22) ═══
    'urganch': { en: 'Urgench', ru: 'Ургенч' },
    'yangiariq': { en: 'Yangiarik', ru: 'Янгиарик' },
    "bog'ot": { en: 'Bagat', ru: 'Багат' },
    'xonqa': { en: 'Khanka', ru: 'Ханка' },
    'xiva': { en: 'Khiva', ru: 'Хива' },
    "qo'shko'pir": { en: 'Koshkupir', ru: 'Кошкупыр' },
    'shovot': { en: 'Shavat', ru: 'Шават' },
    'yangibozor': { en: 'Yangibazar', ru: 'Янгибазар' },
    'gurlan': { en: 'Gurlen', ru: 'Гурлен' },
    "tuproqqal'a": { en: 'Tuprokkala', ru: 'Тупроккала' },
    'tuproqqala': { en: 'Tuprokkala', ru: 'Тупроккала' },
    'xazorasp': { en: 'Hazarasp', ru: 'Хазарасп' },
    'hazorasp': { en: 'Hazarasp', ru: 'Хазарасп' },

    // ═══ Karakalpakstan (23) ═══
    'nukus': { en: 'Nukus', ru: 'Нукус' },
    'amudaryo': { en: 'Amudarya', ru: 'Амударья' },
    'beruniy': { en: 'Beruni', ru: 'Беруни' },
    "to'rtko'l": { en: 'Turtkul', ru: 'Турткуль' },
    'turtkul': { en: 'Turtkul', ru: 'Турткуль' },
    'ellikqala': { en: 'Ellikkala', ru: 'Элликкала' },
    "taxiatosh": { en: 'Takhiatash', ru: 'Тахиаташ' },
    "taxtako'pir": { en: 'Takhtakupir', ru: 'Тахтакупыр' },
    "qorao'zak": { en: 'Karauzyak', ru: 'Караузяк' },
    'chimboy': { en: 'Chimbay', ru: 'Чимбай' },
    "sho'manay": { en: 'Shumanay', ru: 'Шуманай' },
    'shumanay': { en: 'Shumanay', ru: 'Шуманай' },  // API spelling variant
    "xo'jayli": { en: 'Khojayli', ru: 'Ходжейли' },
    "qonliko'l": { en: 'Kanlikul', ru: 'Канлыкуль' },
    "qanliko'l": { en: 'Kanlikul', ru: 'Канлыкуль' },  // API spelling variant
    'kegeyli': { en: 'Kegeyli', ru: 'Кегейли' },
    "bo'zatov": { en: 'Bozatau', ru: 'Бозатау' },
    "mo'ynoq": { en: 'Muynak', ru: 'Муйнак' },
    "qo'ng'irot": { en: 'Kungrad', ru: 'Кунград' },
    'ellikqala': { en: 'Ellikkala', ru: 'Элликкала' },
    "ellikqal'a": { en: 'Ellikkala', ru: 'Элликкала' },  // API spelling variant
};