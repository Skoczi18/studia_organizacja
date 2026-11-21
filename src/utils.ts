export const PALETTE = [
  '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2',
  '#64d2ff', '#ffd60a', '#ff6b3d', '#5e5ce6', '#32ade6',
  '#ac8e68', '#8e8e93'
]

export const TYPE_LABELS: Record<string, string> = {
  W: 'Wykład',
  LAB: 'Laboratorium',
  CW: 'Ćwiczenia',
  'Ć': 'Ćwiczenia',
  PROJ: 'Projekt',
  P: 'Projekt',
  SEM: 'Seminarium',
  S: 'Seminarium',
  LEK: 'Lektorat',
  EGZ: 'Egzamin',
  INNE: 'Inne'
}
export const typeLabel = (t: string) => TYPE_LABELS[t] ?? t

export function subjectKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DDTHH:mm' -> Date (czas lokalny) */
export function parseLocal(s: string): Date {
  const [d, t = '00:00'] = s.split('T')
  const [y, m, dd] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  return new Date(y, m - 1, dd, hh || 0, mm || 0)
}

export function toLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const nowLocal = () => toLocalString(new Date())
export const todayKey = () => dayKey(new Date())

const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']
const DAYS_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So']
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia']
export const MONTHS_NOM = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']

export const fmtTime = (s: string) => s.slice(11, 16)
export function fmtDate(s: string, opts: { weekday?: boolean; year?: boolean } = {}) {
  const d = parseLocal(s)
  let out = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  if (opts.year) out += ` ${d.getFullYear()}`
  if (opts.weekday) out = `${DAYS[d.getDay()]}, ${out}`
  return out
}
export const fmtDayShort = (s: string) => DAYS_SHORT[parseLocal(s).getDay()]

export function relDay(s: string): string {
  const d = parseLocal(s.slice(0, 10))
  const t = parseLocal(todayKey())
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000)
  if (diff === 0) return 'Dziś'
  if (diff === 1) return 'Jutro'
  if (diff === -1) return 'Wczoraj'
  if (diff > 1 && diff < 7) return DAYS[d.getDay()][0].toUpperCase() + DAYS[d.getDay()].slice(1)
  return fmtDate(s, { weekday: true, year: d.getFullYear() !== new Date().getFullYear() })
}

export function countdown(s: string): string {
  const ms = parseLocal(s).getTime() - Date.now()
  if (ms < 0) return 'minęło'
  const days = Math.floor(ms / 86400000)
  if (days >= 1) return days === 1 ? 'za 1 dzień' : `za ${days} dni`
  const h = Math.floor(ms / 3600000)
  if (h >= 1) return `za ${h} h`
  return `za ${Math.max(1, Math.round(ms / 60000))} min`
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function hexA(hex: string, a: number) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

export function fmtGrade(g?: number | null) {
  if (g == null || isNaN(g)) return '—'
  return g.toFixed(1).replace('.', ',')
}

export function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) ? null : n
}

export const GRADES = [2, 3, 3.5, 4, 4.5, 5]

/** 'So 6.02' */
export function shortDate(s: string) {
  const d = parseLocal(s)
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}.${pad(d.getMonth() + 1)}`
}
