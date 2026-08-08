// backend/src/services/mailer.js
//
// Outgoing mail for account confirmation.
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

import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

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
 * The letter is deliberately plain: one sentence of context, one link, one line
 * about expiry. A styled template would be one more thing to keep in sync with
 * the interface and buys nothing at this stage.
 */
const verificationTemplate = (name, link, hours) => {
    const safeName = escapeHtml(name || '');
    const safeLink = escapeHtml(link);
    const text = [
        `${name ? name + ', з' : 'З'}дравствуйте.`,
        '',
        'Подтвердите адрес почты, чтобы завершить регистрацию в Y.Map:',
        link,
        '',
        `Ссылка действует ${hours} ч. Если регистрацию начинали не вы, письмо можно проигнорировать.`,
        '',
        'Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.'
    ].join('\n');

    const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#12181D;">
  <p>${safeName ? safeName + ', здравствуйте.' : 'Здравствуйте.'}</p>
  <p>Подтвердите адрес почты, чтобы завершить регистрацию в Y.Map.</p>
  <p><a href="${safeLink}" style="display:inline-block;padding:10px 18px;background:#14415C;color:#F5F5F2;border-radius:8px;text-decoration:none;font-weight:600;">Подтвердить почту</a></p>
  <p style="font-size:12px;color:#5A6570;">Если кнопка не открывается, скопируйте ссылку:<br>${safeLink}</p>
  <p style="font-size:12px;color:#5A6570;">Ссылка действует ${hours} ч. Если регистрацию начинали не вы, письмо можно проигнорировать.</p>
</div>`;

    return { text, html };
};

/**
 * Reset letter. Deliberately not a copy of the confirmation one: it names the
 * action, and it says what to do if the request was not the reader's, because an
 * unexpected reset letter is the one signal a user gets that someone is trying
 * their address.
 */
const resetTemplate = (name, link, hours) => {
    const safeName = escapeHtml(name || '');
    const safeLink = escapeHtml(link);
    const text = [
        `${name ? name + ', з' : 'З'}дравствуйте.`,
        '',
        'Кто-то запросил смену пароля для этого адреса в Y.Map. Если это вы:',
        link,
        '',
        `Ссылка действует ${hours} ч и сработает один раз.`,
        'Если запрос не ваш, ничего делать не нужно: пароль останется прежним.',
        '',
        'Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.'
    ].join('\n');

    const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:14px;line-height:1.55;color:#12181D;">
  <p>${safeName ? safeName + ', здравствуйте.' : 'Здравствуйте.'}</p>
  <p>Кто-то запросил смену пароля для этого адреса в Y.Map.</p>
  <p><a href="${safeLink}" style="display:inline-block;padding:10px 18px;background:#14415C;color:#F5F5F2;border-radius:8px;text-decoration:none;font-weight:600;">Задать новый пароль</a></p>
  <p style="font-size:12px;color:#5A6570;">Если кнопка не открывается, скопируйте ссылку:<br>${safeLink}</p>
  <p style="font-size:12px;color:#5A6570;">Ссылка действует ${hours} ч и сработает один раз. Если запрос не ваш, ничего делать не нужно: пароль останется прежним.</p>
</div>`;

    return { text, html };
};

/**
 * @returns {Promise<{ delivered: boolean, link: string }>}
 */
export const sendPasswordResetEmail = async ({ to, name, token }) => {
    const link = `${config.publicBaseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const hours = Math.round(config.mail.resetTtlMs / 3600000);
    const { text, html } = resetTemplate(name, link, hours);

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
            html
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
export const sendVerificationEmail = async ({ to, name, token }) => {
    const link = `${config.publicBaseUrl.replace(/\/+$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const hours = Math.round(config.mail.verifyTtlMs / 3600000);
    const { text, html } = verificationTemplate(name, link, hours);

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
            html
        });
        return { delivered: true, link };
    } catch (err) {
        // The account already exists at this point. Reporting the failure lets the
        // interface offer a resend instead of pretending the letter is on its way.
        console.error(`❌ Не удалось отправить письмо на ${to}: ${err.message}`);
        return { delivered: false, link };
    }
};
