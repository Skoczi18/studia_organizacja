import { useEffect, useState } from 'react'
import type { CalEvent } from '../types'
import { useStore } from '../store'
import { ColorPicker, Field, Seg, Sheet, toast } from './ui'
import { GRADES, fmtDate, fmtTime, parseNum, typeLabel, uid } from '../utils'
import { ICheck, IX, IPin, IUser, ILink } from './Icons'
import { go } from '../router'

export function EventSheet({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  const { save, remove, subjectOf } = useStore()
  const [e, setE] = useState<CalEvent | null>(event)
  useEffect(() => setE(event), [event])
  if (!e) return null
  const s = subjectOf(e)
  const comp = s?.components?.[e.type]
  const inherited = comp?.attendance === 'required' ? true : comp?.attendance === 'optional' ? false : null
  const set = (p: Partial<CalEvent>) => setE({ ...e, ...p })
  const manual = e.source === 'manual'

  const done = async () => {
    await save('events', e)
    toast('Zapisano')
    onClose()
  }

  return (
    <Sheet open={!!event} onClose={onClose} title={e.kind === 'exam' ? 'Egzamin' : typeLabel(e.type)} onDone={done}>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <div className="row-flex">
            <span className="dot" style={{ background: e.color || s?.color, width: 12, height: 12 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{s?.name || e.title}</h2>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {fmtDate(e.start, { weekday: true, year: true })} · {fmtTime(e.start)}–{fmtTime(e.end)}
          </div>
          {e.cancelled && <div className="chip red" style={{ marginTop: 8 }}>Zniknęło z planu USOS — możliwe, że odwołane</div>}
        </div>

        <div className="list glass">
          {(e.room || e.building) && <div className="item"><IPin width={18} /><div className="grow">{e.room ? `Sala ${e.room}` : ''}<div className="small muted">{e.building}</div></div></div>}
          {comp?.teacher && <div className="item"><IUser width={18} /><div className="grow">{comp.teacher}{comp.contact && <div className="small muted">{comp.contact}</div>}</div></div>}
          {e.url && <a className="item" href={e.url} target="_blank" rel="noreferrer"><ILink width={18} /><div className="grow">Zajęcia w USOSweb</div><span className="chev">›</span></a>}
          {s && <button className="item" onClick={() => { onClose(); go('subjects/' + s.id) }}><span className="dot" style={{ background: s.color }} /><div className="grow">Otwórz przedmiot</div><span className="chev">›</span></button>}
        </div>

        {comp?.notes && (
          <div className="card glass small pre" style={{ padding: 12 }}>
            <div className="muted" style={{ fontWeight: 600, marginBottom: 4 }}>NOTATKI · {e.type === 'LAB' ? 'LABY' : typeLabel(e.type).toUpperCase()}</div>
            {comp.notes}
          </div>
        )}

        {manual && (
          <div className="form-grid">
            <Field label="Tytuł" full><input className="input" value={e.title} onChange={x => set({ title: x.target.value })} /></Field>
            <Field label="Początek"><input className="input" type="datetime-local" value={e.start} onChange={x => set({ start: x.target.value })} /></Field>
            <Field label="Koniec"><input className="input" type="datetime-local" value={e.end} onChange={x => set({ end: x.target.value })} /></Field>
            <Field label="Sala"><input className="input" value={e.room ?? ''} onChange={x => set({ room: x.target.value })} /></Field>
            <Field label="Budynek"><input className="input" value={e.building ?? ''} onChange={x => set({ building: x.target.value })} /></Field>
          </div>
        )}

        {e.kind === 'class' ? (
          <>
            <Field label="Obecność">
              <div className="att">
                <button className={'present' + (e.attendance === 'present' ? ' on' : '')} onClick={() => set({ attendance: e.attendance === 'present' ? null : 'present' })}><ICheck width={18} />Byłem</button>
                <button className={'absent' + (e.attendance === 'absent' ? ' on' : '')} onClick={() => set({ attendance: e.attendance === 'absent' ? null : 'absent' })}><IX width={18} />Nie byłem</button>
                <button className={'none' + (!e.attendance ? ' on' : '')} onClick={() => set({ attendance: null })}>—<span style={{ fontWeight: 500 }}>Brak</span></button>
              </div>
            </Field>
            <Field label={`Czy trzeba być?${inherited !== null && e.required == null ? ' (z ustawień przedmiotu)' : ''}`}>
              <Seg value={String(e.required ?? inherited ?? 'null') as any}
                options={[['true', 'Obowiązkowe'], ['false', 'Nie trzeba'], ['null', 'Nie wiem']]}
                onChange={v => set({ required: v === 'null' ? null : v === 'true' })} />
            </Field>
          </>
        ) : (
          <>
            <div className="form-grid">
              <Field label="Termin"><input className="input" value={e.attempt ?? ''} placeholder="I termin / poprawka" onChange={x => set({ attempt: x.target.value })} /></Field>
              <Field label="Forma"><input className="input" value={e.examForm ?? ''} placeholder="test ABCD, pisemny, ustny…" onChange={x => set({ examForm: x.target.value })} /></Field>
            </div>
            <Field label="Status">
              <Seg value={e.examStatus ?? 'todo'} options={[['todo', 'Przede mną'], ['passed', 'Zdany'], ['failed', 'Niezdany']]} onChange={v => set({ examStatus: v })} />
            </Field>
            <Field label="Ocena">
              <Seg value={e.examGrade == null ? '' : String(e.examGrade)} options={[['', '—'], ...GRADES.map(g => [String(g), String(g).replace('.', ',')] as [string, string])]}
                onChange={v => set({ examGrade: parseNum(v) })} />
            </Field>
            <Field label="Czy trzeba iść?">
              <Seg value={String(e.required ?? 'null') as any} options={[['true', 'Tak'], ['false', 'Nie (zwolnienie)'], ['null', 'Nie wiem']]}
                onChange={v => set({ required: v === 'null' ? null : v === 'true' })} />
            </Field>
          </>
        )}

        <Field label="Notatka / komentarz">
          <textarea className="input" value={e.note ?? ''} placeholder="np. przynieść sprawozdanie, kolokwium, co było…" onChange={x => set({ note: x.target.value })} />
        </Field>

        <Field label="Kolor w kalendarzu (szary = kolor przedmiotu)">
          <ColorPicker value={e.color} allowNone onChange={c => set({ color: c })} />
        </Field>

        {manual ? (
          <button className="btn danger block" onClick={async () => { if (confirm('Usunąć to wydarzenie?')) { await remove('events', e.id); onClose() } }}>Usuń wydarzenie</button>
        ) : (
          <p className="small muted" style={{ textAlign: 'center' }}>Godziny i sala pochodzą z USOS i aktualizują się przy synchronizacji. Twoje notatki zostają.</p>
        )}
      </div>
    </Sheet>
  )
}

export function newManualEvent(opts: { kind: 'class' | 'exam'; date?: string; subjectKey?: string; semesterId?: string; title?: string; type?: string }): CalEvent {
  const d = opts.date ?? new Date().toISOString().slice(0, 10)
  return {
    id: uid(), source: 'manual', kind: opts.kind, type: opts.type ?? (opts.kind === 'exam' ? 'EGZ' : 'INNE'),
    subjectKey: opts.subjectKey ?? '', semesterId: opts.semesterId, title: opts.title ?? '',
    start: `${d}T09:00`, end: `${d}T10:30`, examStatus: opts.kind === 'exam' ? 'todo' : undefined
  }
}
