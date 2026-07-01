// server/api/search.get.ts
// Global search stub. Implemented in Этап 8. Returns 501 instead of mock results.
export default defineEventHandler(() => {
  throw createError({
    statusCode: 501,
    statusMessage: 'Search not implemented yet (Этап 8).',
  })
})
