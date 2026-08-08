// app/composables/useGamification.ts
// Ported verbatim from ProfileView.tsx / LeaderboardView.tsx. Single source for levels
// and badges so profile and leaderboard stay consistent. Every criterion is computed
// from the real /users/me/activity payload - no fabricated values.
//
// Level colours moved off the stock slate/blue/violet/amber/emerald ladder onto the
// project tokens. The two top levels sit on the semantic ramp rather than on the
// accent: they mark a quantity of contributed work, which is what the ramp is for.
import type { ProfileActivity } from '~/types'

export interface Level {
  min: number
  label: string
  color: string
  bg: string
  icon: string
}

export const LEVELS: Level[] = [
  { min: 0, label: 'Новичок', color: 'text-ink-muted dark:text-ink-faint', bg: 'bg-paper-sunk dark:bg-night-sunk', icon: '🌱' },
  { min: 10, label: 'Активист', color: 'text-prussian-600 dark:text-prussian-200', bg: 'bg-prussian-50 dark:bg-prussian-900/40', icon: '⚡' },
  { min: 30, label: 'Герой района', color: 'text-prussian-700 dark:text-prussian-100', bg: 'bg-prussian-100 dark:bg-prussian-800/60', icon: '🏅' },
  { min: 75, label: 'Страж города', color: 'text-scale-mild', bg: 'bg-scale-mild/10', icon: '🛡️' },
  { min: 150, label: 'Народный инспектор', color: 'text-scale-ok', bg: 'bg-scale-ok/10', icon: '🏆' },
]

export interface BadgeContext {
  activity: ProfileActivity
  points: number
}

export interface Badge {
  id: string
  label: string
  check: (ctx: BadgeContext) => boolean
}

// Badge set + order follow the mockup (Страница_5). Criteria stay grounded in the real
// /users/me/activity payload. "Лидер района" and "Эксперт" have no data source yet
// (district-rank / expert threshold undefined) - kept locked, matching the mockup where
// both render locked. Their unlock rule is an open question.
export const BADGES: Badge[] = [
  { id: 'first_issue', label: 'Первое обращение', check: (c) => c.activity.issues.total >= 1 },
  { id: 'first_verif', label: 'Первая проверка', check: (c) => c.activity.verifications.done + c.activity.verifications.problem >= 1 },
  { id: 'five_issues', label: '5 обращений', check: (c) => c.activity.issues.total >= 5 },
  { id: 'first_resolve', label: 'Проблема решена', check: (c) => c.activity.issues.resolved >= 1 },
  { id: 'ten_verifs', label: '10 проверок', check: (c) => c.activity.verifications.done + c.activity.verifications.problem >= 10 },
  { id: 'activist', label: 'Активист', check: (c) => c.points >= 10 },
  { id: 'district_leader', label: 'Лидер района', check: () => false },
  { id: 'expert', label: 'Эксперт', check: () => false },
]

export const useGamification = () => {
  const getLevel = (points: number): Level =>
    [...LEVELS].reverse().find((l) => points >= l.min) ?? LEVELS[0]!

  const getNextLevel = (points: number): Level | null =>
    LEVELS.find((l) => points < l.min) ?? null

  const getLevelIcon = (points: number): string => getLevel(points).icon

  const getProgress = (points: number): number => {
    const next = getNextLevel(points)
    if (!next) return 100
    const cur = getLevel(points)
    return Math.round(((points - cur.min) / (next.min - cur.min)) * 100)
  }

  return { LEVELS, BADGES, getLevel, getNextLevel, getLevelIcon, getProgress }
}
