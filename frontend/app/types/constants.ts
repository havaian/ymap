// app/types/constants.ts
// Ported from frontend/src/constants.ts. Reused as the starting design tokens for
// map/issue category colours (ТЗ 6.6).
import { IssueCategory } from './index'

export const TASHKENT_CENTER: [number, number] = [41.2995, 69.2401]

// Issue categories are a nominal set, not an ordered one: waste is not worse than
// roads, it is a different thing. So they get distinct steps of the accent plus a
// neutral, and they deliberately do NOT touch the scale ramp - that ladder means
// deficiency and spending it on category labels would make a red category read as
// a severe one.
//
// Was the stock Tailwind set (#ef4444 / #3b82f6 / #eab308 / #10b981 / #ec4899 /
// #8b5cf6 / #64748b), the last of the old palette left in the codebase. Nothing
// consumes this map yet - the civic circuit holds no data - but it is what the
// feed and the issue layer will read when it does.
export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  [IssueCategory.ROADS]: '#0E3247',       // prussian-700
  [IssueCategory.WATER]: '#2A6082',       // prussian-500
  [IssueCategory.ELECTRICITY]: '#4A7F9F', // prussian-400
  [IssueCategory.EDUCATION]: '#14415C',   // prussian-600
  [IssueCategory.HEALTH]: '#7BA6C1',      // prussian-300
  [IssueCategory.WASTE]: '#5A6570',       // ink-muted
  [IssueCategory.OTHER]: '#8E979F',       // ink-faint
}
