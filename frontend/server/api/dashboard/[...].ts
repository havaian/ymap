// server/api/dashboard/[...].ts
// BFF proxy stub for the Agency Dashboard (Farhod Omanov). Wired in Этап 9, once the
// contract and NUXT_DASHBOARD_API_URL exist. Returns 501 instead of mock data.
export default defineEventHandler(() => {
  throw createError({
    statusCode: 501,
    statusMessage:
      'Dashboard API not configured (Этап 9). Set NUXT_DASHBOARD_API_URL / NUXT_DASHBOARD_API_KEY.',
  })
})
