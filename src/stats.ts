import type { CalEvent, Subject } from './types'

/** Średnia ważona punktami ECTS (przedmioty bez ECTS liczone z wagą 1, jeśli żaden nie ma ECTS). */
export function weightedAverage(subjects: Subject[]) {
  const graded = subjects.filter(s => s.grade != null)
  if (!graded.length) return null
  const anyEcts = graded.some(s => s.ects)
  let sum = 0, w = 0
  for (const s of graded) {
    const weight = anyEcts ? (s.ects ?? 0) : 1
    sum += (s.grade ?? 0) * weight
    w += weight
  }
  return w ? sum / w : null
}

export const ectsSum = (subjects: Subject[]) => subjects.reduce((a, s) => a + (s.ects ?? 0), 0)
export const ectsEarned = (subjects: Subject[]) => subjects.reduce((a, s) => a + (s.status === 'passed' || (s.grade ?? 0) >= 3 ? s.ects ?? 0 : 0), 0)

export function partsGrade(s: Subject) {
  const parts = (s.gradeParts ?? []).filter(p => p.grade != null && p.weight)
  if (!parts.length) return null
  const w = parts.reduce((a, p) => a + p.weight, 0)
  return parts.reduce((a, p) => a + (p.grade ?? 0) * p.weight, 0) / w
}

export function attendanceStats(events: CalEvent[]) {
  const classes = events.filter(e => e.kind === 'class' && !e.cancelled)
  return {
    present: classes.filter(e => e.attendance === 'present').length,
    absent: classes.filter(e => e.attendance === 'absent').length,
    total: classes.length
  }
}
