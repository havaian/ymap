/**
 * One ramp, one place.
 *
 * The deprivation page, the wear page, the capacity page and the map layer each
 * carried their own copy of a green-to-red ladder. They had drifted: the same
 * district could come out one colour in a table and another on the map, which is
 * the kind of inconsistency that makes a reader distrust everything else on the
 * screen.
 *
 * The steps match the `scale` tokens in tailwind.config.ts. Colours are muted on
 * purpose - a saturated red on a school district asserts more than the sample can
 * support.
 */

export const SCALE_COLORS = {
  ok: '#2F6F4E',
  fair: '#5C7F3A',
  mild: '#A67C00',
  poor: '#B5622A',
  bad: '#A63A2E',
  severe: '#6E2620',
  // Объекты есть, но их меньше порога публикации: доля по такой выборке не
  // считается.
  none: '#B9BFB8',
  // Объектов этого типа в районе не загружено ни одного. Другое утверждение,
  // чем предыдущее: там речь о пороге, здесь о покрытии загрузки, и одним
  // серым их путать нельзя.
  absent: '#767C7A',
} as const

export type ScaleStep = keyof typeof SCALE_COLORS

export const useScale = () => {
  /**
   * Deficiency on 0..1, where higher is worse. Used for M0, for shares past a
   * normative cycle, and for any other "how much of this is deprived" figure.
   * Null is not zero: a district held out for too few objects is grey, not green.
   */
  const deficiency = (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v)) return SCALE_COLORS.none
    if (v >= 0.5) return SCALE_COLORS.severe
    if (v >= 0.35) return SCALE_COLORS.bad
    if (v >= 0.25) return SCALE_COLORS.poor
    if (v >= 0.15) return SCALE_COLORS.mild
    if (v >= 0.05) return SCALE_COLORS.fair
    return SCALE_COLORS.ok
  }

  /** Completeness on 0..1, where higher is better. The same ladder, reversed. */
  const completeness = (v: number | null | undefined): string => {
    if (v === null || v === undefined || Number.isNaN(v)) return SCALE_COLORS.none
    return deficiency(1 - v)
  }

  /** A 0..100 score where higher is better, for the legacy composite metric. */
  const score = (v: number | null | undefined): string =>
    v === null || v === undefined ? SCALE_COLORS.none : completeness(v / 100)

  /** Legend swatches, worst last, for a bar under a choropleth. */
  const legend: string[] = [
    SCALE_COLORS.ok,
    SCALE_COLORS.fair,
    SCALE_COLORS.mild,
    SCALE_COLORS.poor,
    SCALE_COLORS.bad,
    SCALE_COLORS.severe,
  ]

  return { deficiency, completeness, score, legend, SCALE_COLORS }
}
