// bot/bot.js
// Y.Map Telegram Bot — создание обращений через Grammy
// npm install grammy @google/genai axios dotenv

import 'dotenv/config';
import { Bot, session, InlineKeyboard, Keyboard } from 'grammy';
import axios from 'axios';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const API_BASE = process.env.YMAP_API_URL || 'https://map.ytech.space/api';

// ── Session ────────────────────────────────────────────────────────────────────

bot.use(session({
    initial: () => ({ step: 'idle', description: null, lat: null, lng: null, analysis: null }),
}));

// ── Auto-login into API ──────────────

let authToken = null;

async function ensureToken() {
    if (authToken) return authToken;
    const { data } = await axios.post(`${API_BASE}/auth/login`, {
        email: process.env.BOT_EMAIL,
        password: process.env.BOT_PASSWORD,
    });
    authToken = data.data.token;
    console.log(`🔑 Bot logged in as ${data.data.user.email} (${data.data.user.role})`);
    return authToken;
}

// ── Gemini — точно такой же промпт и схема как в geminiService.ts ──────────────

async function analyzeWithGemini(description, token) {
    const { data } = await axios.post(
        `${API_BASE}/ai/analyze`,
        { description, context: {} },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.data;
}

// ── API ────────────────────────────────────────────────────────────────────────

async function createIssue(session) {
    await ensureToken();

    const { data } = await axios.post(`${API_BASE}/issues`, {
        lat: session.lat,
        lng: session.lng,
        title: session.analysis.title,
        description: session.description,
        category: session.analysis.category,
        subCategory: session.analysis.subCategory,
        severity: session.analysis.severity,
        aiSummary: session.analysis.summary,
    }, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    return data.data;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const SEVERITY_EMOJI = { Low: '🟢', Medium: '🟡', High: '🟠', Critical: '🔴' };

function confirmText(s) {
    return (
        `*Проверьте обращение:*\n\n` +
        `📋 *Заголовок:* ${s.analysis.title}\n` +
        `🏷 *Категория:* ${s.analysis.category}\n` +
        `⚠️ *Серьёзность:* ${SEVERITY_EMOJI[s.analysis.severity] || ''} ${s.analysis.severity}\n` +
        `📍 *Координаты:* ${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}\n` +
        (s.analysis.summary ? `\n💡 *AI-анализ:* ${s.analysis.summary}` : '')
    );
}

// ── Commands ───────────────────────────────────────────────────────────────────

bot.command('start', (ctx) => {
    ctx.session.step = 'idle';
    ctx.reply(
        `👋 *Добро пожаловать в Y\\.Map Bot\\!*\n\n` +
        `Сообщайте о проблемах с инфраструктурой быстро и легко\\.\n\n` +
        `Используйте /report чтобы создать обращение\\.`,
        { parse_mode: 'MarkdownV2' }
    );
});

bot.command('report', (ctx) => {
    ctx.session = { step: 'waiting_desc', description: null, lat: null, lng: null, analysis: null };
    ctx.reply(
        `📝 *Опишите проблему*\n\nРасскажите подробно что произошло`,
        { parse_mode: 'MarkdownV2' }
    );
});

bot.command('cancel', (ctx) => {
    ctx.session.step = 'idle';
    ctx.reply('❌ Обращение отменено.');
});

// ── Message handler ────────────────────────────────────────────────────────────

bot.on('message', async (ctx) => {
    const s = ctx.session;

    // ── Шаг 0: обработка клавиатуры ─────────────────────────────────────────────
    if (ctx.message.text === '🔄 Новое обращение') {
        ctx.session = { step: 'waiting_desc', description: null, lat: null, lng: null, analysis: null };
        return ctx.reply(
            `📝 *Опишите проблему*\n\nРасскажите подробно что произошло — Gemini AI автоматически определит категорию и серьёзность\\.`,
            { parse_mode: 'MarkdownV2', reply_markup: { remove_keyboard: true } }
        );
    }

    // ── Шаг 1: получить описание ────────────────────────────────────────────────
    if (s.step === 'waiting_desc') {
        if (!ctx.message.text || ctx.message.text.startsWith('/')) return;
        if (ctx.message.text.length < 10) {
            return ctx.reply('⚠️ Опишите проблему подробнее (минимум 10 символов).');
        }

        s.description = ctx.message.text;
        s.step = 'waiting_location';

        const keyboard = new Keyboard()
            .requestLocation('📍 Отправить мою локацию')
            .text('🔄 Новое обращение')
            .resized()
            .oneTime();

        return ctx.reply(
            `📍 *Укажите местоположение*\n\nОтправьте геолокацию или введите координаты:\n\`41\\.299, 69\\.240\``,
            { parse_mode: 'MarkdownV2', reply_markup: keyboard }
        );
    }

    // ── Шаг 2: получить локацию ─────────────────────────────────────────────────
    if (s.step === 'waiting_location') {
        let lat = null, lng = null;

        if (ctx.message.location) {
            lat = ctx.message.location.latitude;
            lng = ctx.message.location.longitude;
        } else if (ctx.message.text) {
            const m = ctx.message.text.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
            if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
        }

        if (!lat || !lng) {
            return ctx.reply('⚠️ Не удалось определить координаты. Отправьте геолокацию или введите: `41.299, 69.240`');
        }

        s.lat = lat;
        s.lng = lng;
        s.step = 'confirming';

        const thinking = await ctx.reply('🤖 Анализируем обращение...');

        try {
            s.analysis = await analyzeWithGemini(s.description, authToken)
        } catch (e) {
            console.error('Gemini error full:', JSON.stringify(e?.message || e, null, 2));
            s.analysis = { title: s.description.slice(0, 80), category: 'Other', severity: 'Medium', summary: null };
        }

        await ctx.api.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => { });

        const kb = new InlineKeyboard()
            .text('✅ Отправить', 'confirm')
            .text('❌ Отменить', 'cancel');

        return ctx.reply(confirmText(s), {
            parse_mode: 'Markdown',
            reply_markup: kb,
        });
    }
});

// ── Callback queries ───────────────────────────────────────────────────────────

bot.callbackQuery('confirm', async (ctx) => {
    const s = ctx.session;
    if (s.step !== 'confirming') return ctx.answerCallbackQuery('Сессия устарела');

    await ctx.answerCallbackQuery('Отправляем...');
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });

    try {
        const issue = await createIssue(s);
        ctx.session = { step: 'idle', description: null, lat: null, lng: null, analysis: null };

        ctx.reply(
            `🎉 *Обращение создано!*\n\n` +
            `📋 ${issue.title || s.analysis.title}\n\n` +
            `🔗 [Открыть обращение на карте](https://map.ytech.space/map/issues/${issue.id})`,
            {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            }
        ).then(() => {
            ctx.reply('🙌 Спасибо за ваше активное участие в благоустройстве города!', { reply_markup: newReportKb });
        });
    } catch (e) {
        console.error('Create issue error:', e?.response?.data || e.message);
        const newReportKb = new InlineKeyboard().text('🔄 Отправить новое обращение', 'new_report');
        ctx.reply(
            `❌ Ошибка: ${e?.response?.data?.message || e.message}`,
            { reply_markup: { remove_keyboard: true } }
        ).then(() => {
            ctx.reply('Хотите попробовать снова?', { reply_markup: newReportKb });
        });
    }
});

bot.callbackQuery('cancel', async (ctx) => {
    ctx.session.step = 'idle';
    await ctx.answerCallbackQuery('Отменено');
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    ctx.reply('❌ Отменено. Используйте /report чтобы начать заново.');
});

bot.callbackQuery('new_report', async (ctx) => {
    ctx.session = { step: 'waiting_desc', description: null, lat: null, lng: null, analysis: null };
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    ctx.reply(
        `📝 *Опишите проблему*\n\nРасскажите подробно что произошло.`,
        { parse_mode: 'MarkdownV2' }
    );
});

// ── Start ──────────────────────────────────────────────────────────────────────

bot.start();
console.log('🤖 Y.Map Bot (Grammy) запущен...');