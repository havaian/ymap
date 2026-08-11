// backend/src/services/mailer.js
//
// Outgoing mail for account confirmation and password reset.
//
// Transport is plain SMTP through nodemailer rather than a provider SDK: every
// provider worth using (Resend, Brevo, SendGrid, Yandex 360, a ministry relay)
// speaks SMTP, so switching providers is an env change instead of a dependency
// change. Nothing here is provider specific.
//
// When SMTP is not configured the module does not throw and does not silently
// swallow the message either: it prints the confirmation link to the server log
// and reports `delivered: false` to the caller. That keeps local development and
// the first container run working before any mailbox exists, and it keeps the
// failure visible instead of leaving a user waiting for a letter that was never
// going anywhere.
//
// ПЕРЕДЕЛАНО.
//
// Письма были голым текстом в system-ui без единого признака отправителя. Теперь
// у них общая раскладка на таблицах в палитре проекта: прусский заголовок, бумага
// в поле письма, тот же знак, что в шапке сайта и в favicon. Таблицы, а не
// flexbox и не grid: Outlook рисует письма движком Word, и любая современная
// раскладка там разъезжается.
//
// Знак прикладывается вложением с идентификатором содержимого (cid), а не
// ссылкой на файл фронтенда. Ссылка требует, чтобы почтовый клиент сходил на
// сайт, а он по умолчанию внешние картинки не грузит; SVG в почте не показывает
// большинство клиентов вообще, поэтому знак растровый.
//
// Обращение обезличено: "Здравствуйте." без имени. Раньше подставлялось поле
// name, а при регистрации туда клалась левая часть адреса, и человек получал
// письмо с обращением "m.usman.work" - которое почтовый клиент к тому же
// подчёркивал ссылкой, приняв за домен.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Фирменный знак ───────────────────────────────────────────────────────────

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'brand', 'ymap-logo.png');
const LOGO_CID = 'ymap-brand-mark';
const hasLogo = fs.existsSync(LOGO_PATH);

if (!hasLogo) {
    console.warn(`⚠️  Знак для писем не найден: ${LOGO_PATH} - письма уйдут без него`);
}

const logoAttachment = () =>
    hasLogo ? [{ filename: 'ymap-logo.png', path: LOGO_PATH, cid: LOGO_CID }] : [];

// ── Палитра ──────────────────────────────────────────────────────────────────
// Те же значения, что в tailwind.config.ts. Токенов в почте нет, поэтому они
// продублированы здесь; при смене палитры править оба места.

const C = {
    prussian600: '#14415C',
    prussian700: '#0E3247',
    paper: '#F5F5F2',
    paperRaised: '#FFFFFF',
    ink: '#12181D',
    inkMuted: '#5A6570',
    inkFaint: '#8E979F',
    rule: '#DFE2DE'
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

let transport = null;
let transportChecked = false;

const isConfigured = () => Boolean(config.mail.host && config.mail.user);

const getTransport = () => {
    if (transport || !isConfigured()) return transport;
    transport = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        // Implicit TLS on 465, STARTTLS on 587. Deriving it from the port rather
        // than asking for a separate flag removes the most common misconfiguration.
        secure: config.mail.port === 465,
        auth: { user: config.mail.user, pass: config.mail.pass }
    });
    return transport;
};

/**
 * Verifies the SMTP connection once at startup. Failure is a warning, not a
 * crash: the rest of the API has nothing to do with mail and should stay up.
 */
export const checkMailer = async () => {
    if (transportChecked) return;
    transportChecked = true;
    if (!isConfigured()) {
        console.warn('⚠️  SMTP_HOST / SMTP_USER не заданы - письма подтверждения будут печататься в лог');
        return;
    }
    try {
        await getTransport().verify();
        console.log(`✅ SMTP готов: ${config.mail.host}:${config.mail.port}`);
    } catch (err) {
        console.warn(`⚠️  SMTP недоступен (${err.message}) - письма будут печататься в лог`);
    }
};

const escapeHtml = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));

/**
 * Общая раскладка письма. Одна на все письма проекта: шапка со знаком, поле с
 * текстом и кнопкой, подвал одной строкой.
 *
 * @param {{ heading: string, lead: string, actionLabel: string, actionUrl: string, notes: string[] }} p
 */
const layout = ({ heading, lead, actionLabel, actionUrl, notes }) => {
    const safeUrl = escapeHtml(actionUrl);
    const mark = hasLogo
        ? `<img src="cid:${LOGO_CID}" width="36" height="36" alt="" style="display:block;border:0;border-radius:8px;" />`
        : '';

    const noteRows = notes
        .map(
            (n) =>
                `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:${C.inkMuted};">${n}</p>`
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:${C.paperRaised};border:1px solid ${C.rule};border-radius:12px;overflow:hidden;">

          <tr>
            <td style="background:${C.prussian600};padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right:12px;">${mark}</td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:${FONT};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#A9C6D9;">Обсерватория данных</div>
                    <div style="font-family:${FONT};font-size:18px;font-weight:700;color:${C.paper};line-height:1.2;">Y.Map</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;font-family:${FONT};">
              <p style="margin:0 0 4px;font-size:15px;color:${C.ink};">Здравствуйте.</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.25;font-weight:700;color:${C.ink};">${escapeHtml(heading)}</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${C.ink};">${lead}</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.prussian600};border-radius:8px;">
                    <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:${C.paper};text-decoration:none;">${escapeHtml(actionLabel)}</a>
                  </td>
                </tr>
              </table>

              <p style="margin:22px 0 8px;font-size:12px;line-height:1.5;color:${C.inkMuted};">Если кнопка не открывается, скопируйте ссылку:</p>
              <p style="margin:0 0 18px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${safeUrl}" style="color:${C.prussian700};">${safeUrl}</a></p>

              ${noteRows}
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid ${C.rule};padding:16px 28px;font-family:${FONT};font-size:11px;line-height:1.5;color:${C.inkFaint};">
              Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * The letter is deliberately short: one sentence of context, one link, one line
 * about expiry.
 */
const verificationTemplate = (link, hours) => {
    const text = [
        'Здравствуйте.',
        '',
        'Подтвердите адрес почты, чтобы завершить регистрацию в Y.Map:',
        link,
        '',
        `Ссылка действует ${hours} ч. Если регистрацию начинали не вы, письмо можно проигнорировать.`,
        '',
        'Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.'
    ].join('\n');

    const html = layout({
        heading: 'Подтверждение адреса почты',
        lead: 'Адрес указан при регистрации в Y.Map. Подтверждение завершает создание аккаунта.',
        actionLabel: 'Подтвердить почту',
        actionUrl: link,
        notes: [
            `Ссылка действует ${hours} ч.`,
            'Если регистрацию начинали не вы, письмо можно проигнорировать: без подтверждения аккаунт не работает.'
        ]
    });

    return { text, html };
};

/**
 * Reset letter. Deliberately not a copy of the confirmation one: it names the
 * action, and it says what to do if the request was not the reader's, because an
 * unexpected reset letter is the one signal a user gets that someone is trying
 * their address.
 */
const resetTemplate = (link, hours) => {
    const text = [
        'Здравствуйте.',
        '',
        'Для этого адреса запрошена смена пароля в Y.Map. Если запрос ваш:',
        link,
        '',
        `Ссылка действует ${hours} ч и сработает один раз.`,
        'Если запрос не ваш, ничего делать не нужно: пароль останется прежним.',
        '',
        'Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.'
    ].join('\n');

    const html = layout({
        heading: 'Смена пароля',
        lead: 'Для этого адреса запрошена смена пароля в Y.Map.',
        actionLabel: 'Задать новый пароль',
        actionUrl: link,
        notes: [
            `Ссылка действует ${hours} ч и сработает один раз.`,
            'Если запрос не ваш, ничего делать не нужно: пароль останется прежним.'
        ]
    });

    return { text, html };
};

/**
 * @returns {Promise<{ delivered: boolean, link: string }>}
 */
export const sendPasswordResetEmail = async ({ to, token }) => {
    const link = `${config.publicBaseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const hours = Math.round(config.mail.resetTtlMs / 3600000);
    const { text, html } = resetTemplate(link, hours);

    if (!isConfigured()) {
        console.log(`✉️  [SMTP не настроен] ссылка сброса пароля для ${to}: ${link}`);
        return { delivered: false, link };
    }

    try {
        await getTransport().sendMail({
            from: config.mail.from,
            to,
            subject: 'Y.Map: смена пароля',
            text,
            html,
            attachments: logoAttachment()
        });
        return { delivered: true, link };
    } catch (err) {
        console.error(`❌ Не удалось отправить письмо на ${to}: ${err.message}`);
        return { delivered: false, link };
    }
};

/**
 * @returns {Promise<{ delivered: boolean, link: string }>}
 */
export const sendVerificationEmail = async ({ to, token }) => {
    const link = `${config.publicBaseUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const hours = Math.round(config.mail.verifyTtlMs / 3600000);
    const { text, html } = verificationTemplate(link, hours);

    if (!isConfigured()) {
        console.log(`✉️  [SMTP не настроен] ссылка подтверждения для ${to}: ${link}`);
        return { delivered: false, link };
    }

    try {
        await getTransport().sendMail({
            from: config.mail.from,
            to,
            subject: 'Y.Map: подтверждение адреса почты',
            text,
            html,
            attachments: logoAttachment()
        });
        return { delivered: true, link };
    } catch (err) {
        // The account already exists at this point. Reporting the failure lets the
        // interface offer a resend instead of pretending the letter is on its way.
        console.error(`❌ Не удалось отправить письмо на ${to}: ${err.message}`);
        return { delivered: false, link };
    }
};
