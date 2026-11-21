import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { CalEvent, Component, GradePart, Subject, Task } from '../types'
import { BackBtn, ColorPicker, Field, Seg, Sheet, TopBar, toast } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { EventSheet, newManualEvent } from '../components/EventSheet'
import { AddEventSheet } from './Calendar'
import { TaskList, TaskSheet, newTask } from '../components/Tasks'
import { IEdit, ILink } from '../components/Icons'
import { attendanceStats, partsGrade } from '../stats'
import { GRADES, countdown, fmtGrade, nowLocal, parseNum, relDay, shortDate, subjectKey, typeLabel } from '../utils'
import { back, go } from '../router'
import { initials } from './Subjects'

export function SubjectDetail({ id }: { id: string }) {
  const { subjects, events, tasks } = useStore()
  const s = subjects.find(x => x.id === id)
  const [edit, setEdit] = useState<Subject | null>(null)
  const [comp, setComp] = useState<string | null>(null)
  const [open, setOpen] = useState<CalEvent | null>(null)
  const [adding, setAdding] = useState<CalEvent | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [showAllPast, setShowAllPast] = useState(false)
  if (!s) return <><TopBar title="Przedmiot" large={false} left={<BackBtn onClick={() => go('subjects')} />} /><div className="empty">Nie znaleziono przedmiotu.</div></>

  const now = nowLocal()
  const evs = events.filter(e => e.subjectKey === s.key && (e.semesterId === s.semesterId || !e.semesterId)).sort((a, b) => a.start.localeCompare(b.start))
  const classes = evs.filter(e => e.kind === 'class')
  const exams = evs.filter(e => e.kind === 'exam')
  const upcoming = classes.filter(e => e.end > now)
  const past = classes.filter(e => e.end <= now)
  const next = upcoming.find(e => !e.cancelled)
  const last = [...past].reverse().find(e => !e.cancelled)
  const types = [...new Set([...classes.map(e => e.type), ...Object.keys(s.components ?? {})])]
  const subjTasks = tasks.filter(t => t.subjectId === s.id).sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const pg = partsGrade(s)

  return (
    <>
      <TopBar title={s.shortName || s.name} large={false}
        left={<BackBtn onClick={() => back('subjects')} />}
        right={<button className="icon-btn" onClick={() => setEdit(s)} aria-label="Edytuj"><IEdit /></button>} />

      <div className="row-flex" style={{ margin: '14px 0 16px', gap: 14 }}>
        <div className="subject-card"><div className="sw" style={{ background: s.color, width: 56, height: 56, borderRadius: 18, fontSize: 18 }}>{initials(s)}</div></div>
        <div className="grow">
          <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.01em' }}>{s.name}</h1>
          <div className="chips" style={{ marginTop: 8 }}>
            <span className="chip blue">{s.ects != null ? `${s.ects} ECTS` : 'ECTS: ?'}</span>
            {s.grade != null && <span className="chip green">Ocena {fmtGrade(s.grade)}</span>}
            {s.status === 'passed' && <span className="chip green">Zaliczone</span>}
            {s.status === 'failed' && <span className="chip red">Niezaliczone</span>}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="card glass tap" onClick={() => next && setOpen(next)}>
          <div className="small muted" style={{ fontWeight: 600 }}>NASTĘPNE</div>
          {next ? <><div style={{ fontWeight: 700, marginTop: 4 }}>{relDay(next.start)}</div>
            <div className="small muted">{typeLabel(next.type)} · {next.start.slice(11, 16)}{next.room ? ` · ${next.room}` : ''}</div>
            <div className="small" style={{ color: 'var(--accent)', marginTop: 2 }}>{countdown(next.start)}</div></>
            : <div className="muted" style={{ marginTop: 4 }}>—</div>}
        </div>
        <div className="card glass tap" onClick={() => last && setOpen(last)}>
          <div className="small muted" style={{ fontWeight: 600 }}>OSTATNIE</div>
          {last ? <><div style={{ fontWeight: 700, marginTop: 4 }}>{relDay(last.start)}</div>
            <div className="small muted">{typeLabel(last.type)} · {last.start.slice(11, 16)}</div>
            <div className="small" style={{ marginTop: 2, color: last.attendance === 'present' ? 'var(--green)' : last.attendance === 'absent' ? 'var(--red)' : 'var(--label-2)' }}>
              {last.attendance === 'present' ? 'Byłem' : last.attendance === 'absent' ? 'Nie byłem' : 'Obecność?'}</div></>
            : <div className="muted" style={{ marginTop: 4 }}>—</div>}
        </div>
      </div>

      <div className="section-h"><h2>Formy zajęć</h2></div>
      <div className="list glass">
        {types.length === 0 && <div className="item muted">Brak zajęć — dodaj je z kalendarza lub zsynchronizuj USOS.</div>}
        {types.map(t => {
          const c = s.components?.[t] ?? {}
          const st = attendanceStats(classes.filter(e => e.type === t))
          return (
            <button key={t} className="item" onClick={() => setComp(t)}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{typeLabel(t)}</div>
                <div className="small muted">{c.teacher || 'Prowadzący: dodaj'}{c.room ? ` · sala ${c.room}` : ''}</div>
                <div className="chips" style={{ marginTop: 6 }}>
                  {c.attendance === 'required' && <span className="chip orange">obecność obowiązkowa</span>}
                  {c.attendance === 'optional' && <span className="chip">nie sprawdza obecności</span>}
                  <span className="chip">{st.total} zajęć</span>
                  {st.present > 0 && <span className="chip green">{st.present} obecn.</span>}
                  {(st.absent > 0 || c.absenceLimit != null) && <span className={'chip ' + (c.absenceLimit != null && st.absent >= c.absenceLimit ? 'red' : '')}>nb. {st.absent}{c.absenceLimit != null ? `/${c.absenceLimit}` : ''}</span>}
                </div>
                {c.notes && <div className="small pre" style={{ marginTop: 6 }}>{c.notes}</div>}
              </div>
              <span className="chev">›</span>
            </button>
          )
        })}
      </div>

      {(s.rules || s.gradeParts?.length) ? (
        <>
          <div className="section-h"><h2>Zaliczenie</h2><button className="a" onClick={() => setEdit(s)}>Edytuj</button></div>
          <div className="card glass stack">
            {s.rules && <div className="pre">{s.rules}</div>}
            {!!s.gradeParts?.length && (
              <div className="stack" style={{ gap: 8 }}>
                {s.gradeParts.map((p, i) => (
                  <div key={i}>
                    <div className="row-flex small"><span className="grow">{p.name}</span><b>{p.weight}%</b><span className="muted" style={{ width: 34, textAlign: 'right' }}>{fmtGrade(p.grade)}</span></div>
                    <div className="progress" style={{ marginTop: 4 }}><i style={{ width: `${Math.min(100, p.weight)}%`, background: s.color }} /></div>
                  </div>
                ))}
                {pg != null && <div className="small">Wyliczona ocena z części: <b>{fmtGrade(pg)}</b></div>}
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className="section-h"><h2>Notatki</h2><button className="a" onClick={() => setEdit(s)}>Edytuj</button></div>
      <div className="card glass pre">{s.notes || <span className="muted">Brak notatek</span>}</div>

      {!!s.links?.length && (
        <>
          <div className="section-h"><h2>Linki</h2></div>
          <div className="list glass">
            {s.links.map((l, i) => (
              <a key={i} className="item" href={l.url.startsWith('http') ? l.url : 'https://' + l.url} target="_blank" rel="noreferrer">
                <ILink width={18} /><div className="grow ellipsis">{l.label || l.url}<div className="small muted ellipsis">{l.url}</div></div><span className="chev">›</span>
              </a>
            ))}
          </div>
        </>
      )}

      <div className="section-h"><h2>Zadania</h2><button className="a" onClick={() => setTask(newTask(s.id))}>Dodaj</button></div>
      <TaskList tasks={subjTasks} onOpen={setTask} showSubject={false} />

      <div className="section-h"><h2>Egzaminy</h2><button className="a" onClick={() => setAdding(newManualEvent({ kind: 'exam', subjectKey: s.key, semesterId: s.semesterId }))}>Dodaj</button></div>
      <div className="stack">
        {exams.length ? exams.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} showSubjectName={false} showDate={shortDate(e.start)} />)
          : <div className="list glass"><div className="item muted">Brak egzaminów</div></div>}
      </div>

      <div className="section-h"><h2>Nadchodzące zajęcia</h2><button className="a" onClick={() => setAdding(newManualEvent({ kind: 'class', subjectKey: s.key, semesterId: s.semesterId }))}>Dodaj</button></div>
      <div className="stack">
        {upcoming.length ? upcoming.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} showSubjectName={false} showDate={shortDate(e.start)} />)
          : <div className="list glass"><div className="item muted">Brak</div></div>}
      </div>

      {past.length > 0 && (
        <>
          <div className="section-h"><h2>Minione ({past.length})</h2>{past.length > 4 && <button className="a" onClick={() => setShowAllPast(!showAllPast)}>{showAllPast ? 'Mniej' : 'Wszystkie'}</button>}</div>
          <div className="stack">
            {(showAllPast ? [...past].reverse() : [...past].reverse().slice(0, 4)).map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} showSubjectName={false} showDate={shortDate(e.start)} />)}
          </div>
        </>
      )}

      <SubjectEditSheet subject={edit} onClose={() => setEdit(null)} />
      <ComponentSheet subject={s} type={comp} onClose={() => setComp(null)} />
      <EventSheet event={open} onClose={() => setOpen(null)} />
      <AddEventSheet event={adding} onClose={() => setAdding(null)} />
      <TaskSheet task={task} onClose={() => setTask(null)} />
    </>
  )
}

function ComponentSheet({ subject, type, onClose }: { subject: Subject; type: string | null; onClose: () => void }) {
  const { save } = useStore()
  const [c, setC] = useState<Component>({})
  useEffect(() => { if (type) setC(subject.components?.[type] ?? {}) }, [type, subject])
  if (!type) return null
  const set = (p: Partial<Component>) => setC({ ...c, ...p })
  return (
    <Sheet open={!!type} onClose={onClose} title={typeLabel(type)} onDone={async () => {
      await save<Subject>('subjects', { id: subject.id, components: { ...(subject.components ?? {}), [type]: c } }); onClose()
    }}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Prowadzący"><input className="input" value={c.teacher ?? ''} placeholder="dr inż. …" onChange={e => set({ teacher: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Kontakt / konsultacje"><input className="input" value={c.contact ?? ''} placeholder="mail, pokój" onChange={e => set({ contact: e.target.value })} /></Field>
          <Field label="Sala (domyślna)"><input className="input" value={c.room ?? ''} onChange={e => set({ room: e.target.value })} /></Field>
        </div>
        <Field label="Obecność">
          <Seg value={c.attendance ?? 'unknown'} options={[['required', 'Obowiązkowa'], ['optional', 'Nie sprawdza'], ['unknown', 'Nie wiem']]} onChange={v => set({ attendance: v })} />
        </Field>
        <Field label="Limit nieobecności (puste = brak)">
          <input className="input" inputMode="numeric" value={c.absenceLimit ?? ''} onChange={e => set({ absenceLimit: e.target.value === '' ? null : parseInt(e.target.value) || 0 })} />
        </Field>
        <Field label="Notatki do tej formy zajęć"><textarea className="input" value={c.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
      </div>
    </Sheet>
  )
}

export function SubjectEditSheet({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const { save, remove, subjects, events } = useStore()
  const [s, setS] = useState<Subject | null>(subject)
  useEffect(() => setS(subject), [subject])
  if (!s) return null
  const exists = subjects.some(x => x.id === s.id)
  const set = (p: Partial<Subject>) => setS({ ...s, ...p })
  const parts = s.gradeParts ?? []
  const links = s.links ?? []
  const setPart = (i: number, p: Partial<GradePart>) => set({ gradeParts: parts.map((x, j) => j === i ? { ...x, ...p } : x) })
  const setLink = (i: number, p: Partial<{ label: string; url: string }>) => set({ links: links.map((x, j) => j === i ? { ...x, ...p } : x) })

  const done = async () => {
    if (!s.name.trim()) return toast('Podaj nazwę')
    await save('subjects', { ...s, key: s.key || subjectKey(s.name), gradeParts: parts.filter(p => p.name), links: links.filter(l => l.url) })
    onClose()
  }
  return (
    <Sheet open={!!subject} onClose={onClose} title={exists ? 'Edytuj przedmiot' : 'Nowy przedmiot'} onDone={done} doneLabel={exists ? 'Gotowe' : 'Dodaj'}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Nazwa (taka jak w USOS, żeby połączyć zajęcia)"><input className="input" value={s.name} onChange={e => set({ name: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Skrót"><input className="input" value={s.shortName ?? ''} placeholder="np. BSI" onChange={e => set({ shortName: e.target.value })} /></Field>
          <Field label="Punkty ECTS"><input className="input" inputMode="decimal" value={s.ects ?? ''} onChange={e => set({ ects: parseNum(e.target.value) })} /></Field>
        </div>
        <Field label="Kolor"><ColorPicker value={s.color} onChange={c => set({ color: c ?? s.color })} /></Field>
        <Field label="Status">
          <Seg value={s.status ?? 'in_progress'} options={[['in_progress', 'W trakcie'], ['passed', 'Zaliczony'], ['failed', 'Niezaliczony']]} onChange={v => set({ status: v })} />
        </Field>
        <Field label="Ocena końcowa">
          <Seg value={s.grade == null ? '' : String(s.grade)} options={[['', '—'], ...GRADES.map(g => [String(g), String(g).replace('.', ',')] as [string, string])]} onChange={v => set({ grade: parseNum(v) })} />
        </Field>
        <Field label="Zasady zaliczenia"><textarea className="input" value={s.rules ?? ''} placeholder="np. lab 60% + egzamin 40%, test trzeba zaliczyć" onChange={e => set({ rules: e.target.value })} /></Field>
        <Field label="Składowe oceny (waga %, ocena)">
          <div className="stack" style={{ gap: 8 }}>
            {parts.map((p, i) => (
              <div key={i} className="link-row">
                <input className="input" value={p.name} placeholder="np. Projekt" onChange={e => setPart(i, { name: e.target.value })} />
                <input className="input" style={{ width: 70, flex: 'none' }} inputMode="decimal" value={p.weight || ''} placeholder="%" onChange={e => setPart(i, { weight: parseNum(e.target.value) ?? 0 })} />
                <input className="input" style={{ width: 64, flex: 'none' }} inputMode="decimal" value={p.grade ?? ''} placeholder="ocena" onChange={e => setPart(i, { grade: parseNum(e.target.value) })} />
                <button className="icon-btn" onClick={() => set({ gradeParts: parts.filter((_, j) => j !== i) })} aria-label="Usuń">✕</button>
              </div>
            ))}
            <button className="btn gray sm" onClick={() => set({ gradeParts: [...parts, { name: '', weight: 0 }] })}>+ Składowa</button>
          </div>
        </Field>
        <Field label="Notatki"><textarea className="input" style={{ minHeight: 140 }} value={s.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
        <Field label="Linki">
          <div className="stack" style={{ gap: 8 }}>
            {links.map((l, i) => (
              <div key={i} className="link-row">
                <input className="input" style={{ maxWidth: 120 }} value={l.label} placeholder="Nazwa" onChange={e => setLink(i, { label: e.target.value })} />
                <input className="input" value={l.url} placeholder="https://…" onChange={e => setLink(i, { url: e.target.value })} />
                <button className="icon-btn" onClick={() => set({ links: links.filter((_, j) => j !== i) })} aria-label="Usuń">✕</button>
              </div>
            ))}
            <button className="btn gray sm" onClick={() => set({ links: [...links, { label: '', url: '' }] })}>+ Link</button>
          </div>
        </Field>
        {exists && (
          <button className="btn danger block" onClick={async () => {
            const n = events.filter(e => e.subjectKey === s.key && e.semesterId === s.semesterId).length
            if (!confirm(`Usunąć przedmiot „${s.name}”? Zajęcia z USOS (${n}) zostaną, ale stracą przypisanie — przy kolejnej synchronizacji przedmiot utworzy się ponownie.`)) return
            await remove('subjects', s.id); onClose(); go('subjects')
          }}>Usuń przedmiot</button>
        )}
      </div>
    </Sheet>
  )
}
