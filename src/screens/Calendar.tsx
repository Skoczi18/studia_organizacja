import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import type { CalEvent } from '../types'
import { Field, Seg, Sheet, TopBar, toast } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { EventSheet, newManualEvent } from '../components/EventSheet'
import { IBack, IPlus, IRight, ISync } from '../components/Icons'
import { MONTHS_NOM, WEEKDAYS_SHORT, dayKey, fmtDate, hexA, nowLocal, parseLocal, relDay, todayKey, typeLabel } from '../utils'

type Mode = 'day' | 'month' | 'list'
const TYPE_SHORT: Record<string, string> = { W: 'W', LAB: 'L', CW: 'Ć', 'Ć': 'Ć', PROJ: 'P', P: 'P', SEM: 'S', S: 'S', EGZ: 'EGZ' }
const addDays = (k: string, n: number) => { const d = parseLocal(k); d.setDate(d.getDate() + n); return dayKey(d) }
const minutes = (s: string) => parseInt(s.slice(11, 13)) * 60 + parseInt(s.slice(14, 16))

function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const dy = e.changedTouches[0].clientY - start.current.y
      start.current = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)()
    }
  }
}

export function Calendar() {
  const { events, sync, syncing, settings } = useStore()
  const [mode, setModeState] = useState<Mode>(() => {
    try { return (localStorage.getItem('calMode') as Mode) || 'day' } catch { return 'day' }
  })
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem('calMode', m) } catch { /* brak dostępu */ } }
  const [sel, setSel] = useState(todayKey())
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [open, setOpen] = useState<CalEvent | null>(null)
  const [adding, setAdding] = useState<CalEvent | null>(null)
  const [showPast, setShowPast] = useState(false)

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of [...events].sort((a, b) => a.start.localeCompare(b.start))) {
      const k = e.start.slice(0, 10)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return m
  }, [events])

  const doSync = async () => {
    try { const r = await sync(); toast(`Plan zaktualizowany · ${r.added} nowych`) } catch (e: any) { toast(e.message) }
  }
  const today = todayKey()
  const pickDay = (k: string) => { setSel(k); const d = parseLocal(k); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }
  const goToday = () => pickDay(today)

  return (
    <>
      <TopBar title="Kalendarz"
        right={<>
          {settings.icalUrl && <button className="icon-btn" onClick={doSync} aria-label="Synchronizuj">{syncing ? <span className="spin" style={{ width: 18, height: 18 }} /> : <ISync />}</button>}
          <button className="icon-btn" onClick={() => setAdding(newManualEvent({ kind: 'class', date: mode === 'list' ? today : sel }))} aria-label="Dodaj"><IPlus /></button>
        </>} />

      <div style={{ marginBottom: 12 }}>
        <Seg value={mode} options={[['day', 'Dzień'], ['month', 'Miesiąc'], ['list', 'Lista']]} onChange={setMode} />
      </div>

      {mode === 'day' && <DayView sel={sel} setSel={pickDay} byDay={byDay} onOpen={setOpen} goToday={goToday} />}
      {mode === 'month' && <MonthView cursor={cursor} setCursor={setCursor} sel={sel} setSel={setSel} byDay={byDay} onOpen={setOpen}
        onDayOpen={k => { pickDay(k); setMode('day') }} goToday={goToday} />}
      {mode === 'list' && (
        <>
          <button className="text-btn" style={{ fontSize: 15, marginBottom: 4 }} onClick={() => setShowPast(!showPast)}>{showPast ? 'Ukryj minione' : 'Pokaż minione'}</button>
          {[...byDay.keys()].filter(k => showPast || k >= today).map(k => (
            <div key={k}>
              <div className={'day-h' + (k === today ? ' today' : '')}>{relDay(k)}{relDay(k).includes(' ') ? '' : ` · ${fmtDate(k)}`}</div>
              <div className="stack">{byDay.get(k)!.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} />)}</div>
            </div>
          ))}
          {byDay.size === 0 && <div className="empty">Brak zajęć. Zsynchronizuj plan z USOS w Ustawieniach.</div>}
        </>
      )}

      <EventSheet event={open} onClose={() => setOpen(null)} />
      <AddEventSheet event={adding} onClose={() => setAdding(null)} />
    </>
  )
}

/* ---------- Miesiąc: etykiety ze skrótami przedmiotów ---------- */
function MonthView({ cursor, setCursor, sel, setSel, byDay, onOpen, onDayOpen, goToday }: {
  cursor: Date; setCursor: (d: Date) => void; sel: string; setSel: (k: string) => void
  byDay: Map<string, CalEvent[]>; onOpen: (e: CalEvent) => void; onDayOpen: (k: string) => void; goToday: () => void
}) {
  const { colorOf, subjectOf } = useStore()
  const today = todayKey()
  const cells = useMemo(() => {
    const offset = (cursor.getDay() + 6) % 7
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - offset)
    const weeks = Math.ceil((offset + new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [cursor])
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const swipe = useSwipe(() => shift(1), () => shift(-1))
  const MAX = 4

  return (
    <>
      <div className="month-head">
        <h2>{MONTHS_NOM[cursor.getMonth()]} <span className="muted" style={{ fontWeight: 500 }}>{cursor.getFullYear()}</span></h2>
        <button className="text-btn" style={{ fontSize: 15 }} onClick={goToday}>Dziś</button>
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Poprzedni miesiąc"><IBack /></button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Następny miesiąc"><IRight /></button>
      </div>
      <div className="mgrid glass" {...swipe}>
        {WEEKDAYS_SHORT.map(w => <div key={w} className="wd">{w}</div>)}
        {cells.map(d => {
          const k = dayKey(d)
          const evs = byDay.get(k) ?? []
          // łączymy bloki tego samego przedmiotu i typu następujące po sobie (np. 2×90 min)
          const groups: { e: CalEvent; n: number }[] = []
          for (const e of evs) {
            const last = groups[groups.length - 1]
            if (last && last.e.subjectKey === e.subjectKey && last.e.type === e.type && last.e.kind === e.kind && !!last.e.cancelled === !!e.cancelled) last.n++
            else groups.push({ e, n: 1 })
          }
          return (
            <div key={k} className={'mcell' + (d.getMonth() !== cursor.getMonth() ? ' out' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '') + (d.getDay() % 6 === 0 ? ' wknd' : '')}
              onClick={() => (k === sel && evs.length ? onDayOpen(k) : setSel(k))}>
              <span className="n">{d.getDate()}</span>
              {groups.slice(0, groups.length > MAX ? MAX - 1 : MAX).map(({ e, n }) => {
                const s = subjectOf(e)
                const c = colorOf(e)
                const label = s?.shortName || s?.name || e.title
                return (
                  <button key={e.id} className={'pill' + (e.cancelled ? ' cancelled' : '') + (e.kind === 'exam' ? ' exam' : '')}
                    style={{ background: hexA(c, 0.26), color: c, borderColor: hexA(c, 0.5) }}
                    onClick={ev => { ev.stopPropagation(); onOpen(e) }}>
                    {e.kind === 'exam' ? '★ ' : TYPE_SHORT[e.type] ? <b>{TYPE_SHORT[e.type]} </b> : ''}{label}{n > 1 ? <b> ×{n}</b> : ''}
                  </button>
                )
              })}
              {groups.length > MAX && <span className="more">+{groups.length - MAX + 1}</span>}
            </div>
          )
        })}
      </div>
      <p className="small muted" style={{ margin: '8px 6px 0' }}>Stuknij etykietę, żeby otworzyć zajęcia. Stuknij zaznaczony dzień, żeby zobaczyć go na osi godzin.</p>
      <SelectedDayList sel={sel} byDay={byDay} onOpen={onOpen} />
    </>
  )
}

function SelectedDayList({ sel, byDay, onOpen }: { sel: string; byDay: Map<string, CalEvent[]>; onOpen: (e: CalEvent) => void }) {
  const evs = byDay.get(sel) ?? []
  return (
    <>
      <div className={'day-h' + (sel === todayKey() ? ' today' : '')}>{relDay(sel)}{relDay(sel).includes(' ') ? '' : ` · ${fmtDate(sel)}`}</div>
      <div className="stack">
        {evs.length ? evs.map(e => <EventRow key={e.id} e={e} onClick={() => onOpen(e)} />) : <div className="empty glass card">Wolne 🎉</div>}
      </div>
    </>
  )
}

/* ---------- Dzień: pasek tygodnia + oś godzin (2 dni obok siebie) ---------- */
function DayView({ sel, setSel, byDay, onOpen, goToday }: {
  sel: string; setSel: (k: string) => void; byDay: Map<string, CalEvent[]>; onOpen: (e: CalEvent) => void; goToday: () => void
}) {
  const { colorOf, subjectOf } = useStore()
  const today = todayKey()
  const [wide, setWide] = useState(() => window.innerWidth >= 640)
  useEffect(() => { const on = () => setWide(window.innerWidth >= 640); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on) }, [])
  const ndays = wide ? 3 : 2
  const days = Array.from({ length: ndays }, (_, i) => addDays(sel, i))
  const selDate = parseLocal(sel)
  const monday = addDays(sel, -((selDate.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const swipeGrid = useSwipe(() => setSel(addDays(sel, 1)), () => setSel(addDays(sel, -1)))
  const swipeWeek = useSwipe(() => setSel(addDays(sel, 7)), () => setSel(addDays(sel, -7)))
  const [now, setNow] = useState(nowLocal())
  useEffect(() => { const t = setInterval(() => setNow(nowLocal()), 60000); return () => clearInterval(t) }, [])

  const shown = days.flatMap(k => byDay.get(k) ?? [])
  const startH = Math.min(8, ...shown.map(e => Math.floor(minutes(e.start) / 60)))
  const endH = Math.max(18, ...shown.map(e => Math.ceil(minutes(e.end) / 60)))
  const HOUR = 64
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i)

  // rozkład nachodzących na siebie zajęć na kolumny
  const layout = (evs: CalEvent[]) => {
    const sorted = [...evs].sort((a, b) => a.start.localeCompare(b.start))
    const lanes: string[] = []
    const res = new Map<string, { lane: number; lanes: number }>()
    let group: CalEvent[] = []
    let groupEnd = ''
    const flush = () => { const n = Math.max(1, ...group.map(g => res.get(g.id)!.lane + 1)); group.forEach(g => res.get(g.id)!.lanes = n); group = []; lanes.length = 0 }
    for (const e of sorted) {
      if (group.length && e.start >= groupEnd) flush()
      let lane = lanes.findIndex(end => end <= e.start)
      if (lane < 0) { lane = lanes.length; lanes.push(e.end) } else lanes[lane] = e.end
      res.set(e.id, { lane, lanes: 1 })
      group.push(e)
      groupEnd = groupEnd > e.end && group.length > 1 ? groupEnd : e.end
    }
    if (group.length) flush()
    return res
  }

  return (
    <>
      <div className="month-head">
        <h2>{MONTHS_NOM[selDate.getMonth()]} <span className="muted" style={{ fontWeight: 500 }}>{selDate.getFullYear()}</span></h2>
        <button className="text-btn" style={{ fontSize: 15 }} onClick={goToday}>Dziś</button>
        <button className="icon-btn" onClick={() => setSel(addDays(sel, -ndays))} aria-label="Wcześniej"><IBack /></button>
        <button className="icon-btn" onClick={() => setSel(addDays(sel, ndays))} aria-label="Później"><IRight /></button>
      </div>
      <div className="week glass" {...swipeWeek}>
        {week.map(k => {
          const d = parseLocal(k)
          const evs = byDay.get(k) ?? []
          return (
            <button key={k} className={'wday' + (days.includes(k) ? ' in' : '') + (k === sel ? ' sel' : '') + (k === today ? ' today' : '')} onClick={() => setSel(k)}>
              <span className="l">{WEEKDAYS_SHORT[(d.getDay() + 6) % 7]}</span>
              <span className="n">{d.getDate()}</span>
              <span className="dots">{[...new Set(evs.filter(e => !e.cancelled).map(colorOf))].slice(0, 3).map(c => <i key={c} style={{ background: c }} />)}</span>
            </button>
          )
        })}
      </div>

      <div className="tgrid glass" {...swipeGrid}>
        <div className="thead" style={{ gridTemplateColumns: `44px repeat(${ndays}, 1fr)` }}>
          <span />
          {days.map(k => <div key={k} className={'th' + (k === today ? ' today' : '')}>{fmtDayLabel(k)}</div>)}
        </div>
        <div className="tbody" style={{ gridTemplateColumns: `44px repeat(${ndays}, 1fr)`, height: (endH - startH) * HOUR + 16 }}>
          <div className="hours">
            {hours.map(h => <span key={h} style={{ top: (h - startH) * HOUR }}>{String(h).padStart(2, '0')}:00</span>)}
          </div>
          {days.map(k => {
            const evs = byDay.get(k) ?? []
            const lay = layout(evs)
            const nowTop = k === now.slice(0, 10) ? (minutes(now) - startH * 60) / 60 * HOUR : null
            return (
              <div key={k} className="tcol">
                {hours.map(h => <i key={h} className="hl" style={{ top: (h - startH) * HOUR }} />)}
                {evs.map(e => {
                  const s = subjectOf(e)
                  const c = colorOf(e)
                  const top = (minutes(e.start) - startH * 60) / 60 * HOUR
                  const h = Math.max(26, (minutes(e.end) - minutes(e.start)) / 60 * HOUR - 3)
                  const { lane, lanes } = lay.get(e.id)!
                  const past = e.end < now
                  return (
                    <button key={e.id} className={'tev' + (e.cancelled ? ' cancelled' : '') + (past ? ' past' : '')}
                      style={{ top, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`, background: hexA(c, 0.24), borderLeftColor: c }}
                      onClick={() => onOpen(e)}>
                      <span className="tt" style={{ color: c }}>{e.kind === 'exam' ? `Egzamin${e.attempt ? ' · ' + e.attempt : ''}` : typeLabel(e.type)}</span>
                      <span className="tn">{s?.shortName && h < 70 ? s.shortName : (s?.name || e.title)}</span>
                      {h >= 70 && <span className="tm">{e.start.slice(11, 16)}–{e.end.slice(11, 16)}{e.room ? ` · ${e.room}` : ''}</span>}
                      {h >= 100 && s?.components?.[e.type]?.teacher && <span className="tm">{s.components[e.type].teacher}</span>}
                      {(e.attendance || e.note) && <span className="tbadges">{e.attendance === 'present' ? '✓' : e.attendance === 'absent' ? '✕' : ''}{e.note ? ' ✎' : ''}</span>}
                    </button>
                  )
                })}
                {nowTop != null && nowTop >= 0 && nowTop <= (endH - startH) * HOUR && <div className="now" style={{ top: nowTop }} />}
              </div>
            )
          })}
        </div>
      </div>
      {!shown.length && <p className="small muted" style={{ textAlign: 'center', marginTop: 10 }}>Brak zajęć w tych dniach — przesuń palcem w bok albo wybierz dzień w pasku.</p>}
    </>
  )
}

function fmtDayLabel(k: string) {
  const d = parseLocal(k)
  const wd = ['nd.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'][d.getDay()]
  const m = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'][d.getMonth()]
  return `${wd} ${d.getDate()} ${m}`
}

export function AddEventSheet({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  const { save, semesterSubjects, activeSemester } = useStore()
  const [e, setE] = useState<CalEvent | null>(event)
  useEffect(() => setE(event), [event])
  if (!e) return null
  const set = (p: Partial<CalEvent>) => setE({ ...e, ...p })
  const add = async () => {
    const s = semesterSubjects.find(x => x.key === e.subjectKey)
    if (!s && !e.title.trim()) return toast('Wybierz przedmiot albo wpisz tytuł')
    if (e.end < e.start) return toast('Koniec jest przed początkiem')
    await save('events', { ...e, semesterId: activeSemester?.id, title: e.title || s?.name || '' })
    toast('Dodano'); onClose()
  }
  return (
    <Sheet open={!!event} onClose={onClose} title={e.kind === 'exam' ? 'Nowy egzamin' : 'Nowe wydarzenie'} onDone={add} doneLabel="Dodaj">
      <div className="stack" style={{ gap: 14 }}>
        <Seg value={e.kind} options={[['class', 'Zajęcia / inne'], ['exam', 'Egzamin']]} onChange={k => set({ kind: k, type: k === 'exam' ? 'EGZ' : 'INNE', examStatus: k === 'exam' ? 'todo' : undefined })} />
        <Field label="Przedmiot">
          <select className="input" value={e.subjectKey} onChange={x => set({ subjectKey: x.target.value })}>
            <option value="">— bez przedmiotu —</option>
            {semesterSubjects.map(s => <option key={s.id} value={s.key}>{s.name}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Tytuł (opcjonalnie)" full><input className="input" value={e.title} placeholder="np. Konsultacje, kolokwium" onChange={x => set({ title: x.target.value })} /></Field>
          {e.kind === 'class' && (
            <Field label="Typ" full>
              <select className="input" value={e.type} onChange={x => set({ type: x.target.value })}>
                {['W', 'LAB', 'CW', 'PROJ', 'SEM', 'INNE'].map(t => <option key={t} value={t}>{typeLabel(t)}</option>)}
              </select>
            </Field>
          )}
          <Field label="Początek"><input className="input" type="datetime-local" value={e.start} onChange={x => set({ start: x.target.value, end: x.target.value > e.end ? x.target.value : e.end })} /></Field>
          <Field label="Koniec"><input className="input" type="datetime-local" value={e.end} onChange={x => set({ end: x.target.value })} /></Field>
          <Field label="Sala"><input className="input" value={e.room ?? ''} onChange={x => set({ room: x.target.value })} /></Field>
          <Field label={e.kind === 'exam' ? 'Forma' : 'Budynek'}>
            {e.kind === 'exam'
              ? <input className="input" value={e.examForm ?? ''} placeholder="test, ustny…" onChange={x => set({ examForm: x.target.value })} />
              : <input className="input" value={e.building ?? ''} onChange={x => set({ building: x.target.value })} />}
          </Field>
        </div>
        <Field label="Notatka"><textarea className="input" value={e.note ?? ''} onChange={x => set({ note: x.target.value })} /></Field>
        <p className="small muted">Wydarzenia dodane ręcznie nie są nadpisywane przez synchronizację z USOS.</p>
      </div>
    </Sheet>
  )
}
