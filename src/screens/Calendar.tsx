import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import type { CalEvent } from '../types'
import { Field, Seg, Sheet, TopBar, toast } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { EventSheet, newManualEvent } from '../components/EventSheet'
import { IBack, IPlus, IRight, ISync } from '../components/Icons'
import { MONTHS_NOM, WEEKDAYS_SHORT, dayKey, fmtDate, relDay, todayKey, typeLabel } from '../utils'

export function Calendar() {
  const { events, colorOf, sync, syncing, settings } = useStore()
  const [mode, setMode] = useState<'month' | 'list'>('month')
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState(todayKey())
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

  const cells = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    const weeks = Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [cursor])

  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))
  const doSync = async () => {
    try { const r = await sync(); toast(`Plan zaktualizowany · ${r.added} nowych`) } catch (e: any) { toast(e.message) }
  }
  const today = todayKey()
  const listDays = [...byDay.keys()].filter(k => showPast || k >= today)
  const selEvents = byDay.get(sel) ?? []

  return (
    <>
      <TopBar title="Kalendarz"
        right={<>
          {settings.icalUrl && <button className="icon-btn" onClick={doSync} aria-label="Synchronizuj">{syncing ? <span className="spin" style={{ width: 18, height: 18 }} /> : <ISync />}</button>}
          <button className="icon-btn" onClick={() => setAdding(newManualEvent({ kind: 'class', date: mode === 'month' ? sel : today }))} aria-label="Dodaj"><IPlus /></button>
        </>} />

      <div style={{ marginBottom: 14 }}>
        <Seg value={mode} options={[['month', 'Miesiąc'], ['list', 'Lista']]} onChange={setMode} />
      </div>

      {mode === 'month' ? (
        <>
          <div className="card glass" style={{ padding: 12 }}>
            <div className="month-head">
              <h2>{MONTHS_NOM[cursor.getMonth()]} <span className="muted" style={{ fontWeight: 500 }}>{cursor.getFullYear()}</span></h2>
              <button className="text-btn" style={{ fontSize: 15 }} onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSel(today) }}>Dziś</button>
              <button className="icon-btn" onClick={() => shift(-1)} aria-label="Poprzedni"><IBack /></button>
              <button className="icon-btn" onClick={() => shift(1)} aria-label="Następny"><IRight /></button>
            </div>
            <div className="grid7">
              {WEEKDAYS_SHORT.map(w => <div key={w} className="wd">{w}</div>)}
              {cells.map(d => {
                const k = dayKey(d)
                const evs = byDay.get(k) ?? []
                const colors = [...new Set(evs.filter(e => !e.cancelled).map(colorOf))].slice(0, 4)
                return (
                  <button key={k} className={'day' + (d.getMonth() !== cursor.getMonth() ? ' out' : '') + (k === today ? ' today' : '') + (k === sel ? ' sel' : '')}
                    onClick={() => setSel(k)}>
                    <span className="n">{d.getDate()}</span>
                    <span className="dots">{colors.map(c => <i key={c} style={{ background: c }} />)}{evs.some(e => e.kind === 'exam') && <i style={{ background: 'var(--label)' }} />}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className={'day-h' + (sel === today ? ' today' : '')}>{relDay(sel)}{sel === today || relDay(sel).includes(' ') ? '' : ` · ${fmtDate(sel)}`}</div>
          <div className="stack">
            {selEvents.length ? selEvents.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} />)
              : <div className="empty glass card">Wolne 🎉</div>}
          </div>
        </>
      ) : (
        <>
          <button className="text-btn" style={{ fontSize: 15, marginBottom: 4 }} onClick={() => setShowPast(!showPast)}>{showPast ? 'Ukryj minione' : 'Pokaż minione'}</button>
          {listDays.length === 0 && <div className="empty">Brak zajęć. Zsynchronizuj plan z USOS w Ustawieniach.</div>}
          {listDays.map(k => (
            <div key={k}>
              <div className={'day-h' + (k === today ? ' today' : '')}>{relDay(k)}{relDay(k).includes(' ') ? '' : ` · ${fmtDate(k)}`}</div>
              <div className="stack">{byDay.get(k)!.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} />)}</div>
            </div>
          ))}
        </>
      )}

      <EventSheet event={open} onClose={() => setOpen(null)} />
      <AddEventSheet event={adding} onClose={() => setAdding(null)} />
    </>
  )
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
