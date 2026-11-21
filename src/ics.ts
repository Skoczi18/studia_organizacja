import type { CalEvent } from './types'
import { subjectKey } from './utils'

export interface ParsedEvent {
  uid: string
  summary: string
  start: string
  end: string
  description: string
  location: string
}

function unescape(v: string) {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\')
}

function icsDate(v: string): string {
  // 20261121T080000 lub 20261121T080000Z lub 20261121
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/)
  if (!m) return v
  const [, y, mo, d, hh = '00', mi = '00', , z] = m
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi))
    const p = (n: number) => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`
  }
  return `${y}-${mo}-${d}T${hh}:${mi}`
}

export function parseIcs(text: string): ParsedEvent[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n')
  const out: ParsedEvent[] = []
  let cur: Partial<ParsedEvent> | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {}
    else if (line === 'END:VEVENT') {
      if (cur?.uid && cur.start) out.push({ summary: '', end: cur.start, description: '', location: '', ...cur } as ParsedEvent)
      cur = null
    } else if (cur) {
      const idx = line.indexOf(':')
      if (idx < 0) continue
      const name = line.slice(0, idx).split(';')[0].toUpperCase()
      const value = line.slice(idx + 1)
      if (name === 'UID') cur.uid = value
      else if (name === 'SUMMARY') cur.summary = unescape(value)
      else if (name === 'DTSTART') cur.start = icsDate(value)
      else if (name === 'DTEND') cur.end = icsDate(value)
      else if (name === 'DESCRIPTION') cur.description = unescape(value)
      else if (name === 'LOCATION') cur.location = unescape(value)
    }
  }
  return out
}

/** Zamienia zdarzenie z USOS na pola CalEvent (tylko pola pochodzące z USOS). */
export function mapUsosEvent(p: ParsedEvent) {
  let type = 'INNE'
  let name = p.summary.trim()
  let kind: CalEvent['kind'] = 'class'
  const exam = name.match(/^(.*?)\s*-\s*(Egzamin.*)$/i)
  const typed = name.match(/^([A-ZĆŁŚŻŹ]{1,6})\s*-\s*(.+)$/)
  if (exam) {
    kind = 'exam'
    type = 'EGZ'
    name = exam[1]
  } else if (typed) {
    type = typed[1].toUpperCase()
    name = typed[2]
  }
  const desc = p.description || ''
  const room = desc.match(/Sala:\s*([^\n]+)/i)?.[1]?.trim()
  const descLines = desc.split('\n').map(s => s.trim()).filter(Boolean)
  const building = descLines.find(l => !/^Sala:/i.test(l) && !/^https?:/i.test(l))
  const url = descLines.find(l => /^https?:/i.test(l))
  const id = p.uid.replace(/@.*$/, '').replace(/[^\w-]/g, '_')
  return {
    id,
    data: {
      source: 'usos' as const,
      kind,
      type,
      title: name,
      subjectKey: subjectKey(name),
      start: p.start,
      end: p.end,
      room: room ?? '',
      building: building ?? '',
      address: p.location ?? '',
      url: url ?? '',
      cancelled: false
    },
    subjectName: name
  }
}

export async function fetchIcs(url: string): Promise<ParsedEvent[]> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`USOS odpowiedział ${res.status}`)
  const text = await res.text()
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('To nie wygląda na plik iCal')
  return parseIcs(text)
}

/** Grupa zajęciowa z linku USOSweb (…pokazZajecia&gr_nr=1&zaj_cyk_id=24890). */
export function groupFromUrl(url?: string): { unit: string; group: string } | null {
  if (!url) return null
  const unit = url.match(/zaj_cyk_id=(\d+)/)?.[1]
  const group = url.match(/gr_nr=(\d+)/)?.[1]
  return unit && group ? { unit, group } : null
}

export interface GroupDate { start: string; end: string; room: string; building: string }

/** Wszystkie terminy grupy (także minione) z publicznego API USOS. */
export async function fetchGroupDates(icalUrl: string, unit: string, group: string): Promise<GroupDate[]> {
  const base = new URL(icalUrl).origin
  const url = `${base}/services/tt/classgroup_dates2?unit_id=${unit}&group_number=${group}&fields=start_time|end_time|room_number|building_name`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`USOS (grupa ${unit}/${group}): ${res.status}`)
  const rows: any[] = await res.json()
  const t = (s: string) => s.slice(0, 16).replace(' ', 'T')
  return rows.map(r => ({ start: t(r.start_time), end: t(r.end_time), room: r.room_number ?? '', building: r.building_name?.pl ?? '' }))
}
