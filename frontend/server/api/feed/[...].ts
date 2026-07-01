// server/api/feed/[...].ts
// BFF proxy stub for the Doppix Telegram-app report feed. Wired in Этап 9, once the
// contract and NUXT_DOPPIX_API_URL exist. Returns 501 instead of mock data.
export default defineEventHandler(() => {
  throw createError({
    statusCode: 501,
    statusMessage:
      'Feed API not configured (Этап 9). Set NUXT_DOPPIX_API_URL / NUXT_DOPPIX_API_KEY.',
  })
})
