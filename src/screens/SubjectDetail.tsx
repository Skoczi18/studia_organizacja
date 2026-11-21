import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { CalEvent, Component, GradePart, Link, Subject, Task } from '../types'
import { BackBtn, ColorPicker, Field, Seg, Sheet, TopBar, toast } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { EventSheet, newManualEvent } from '../components/EventSheet'
import { GradePartsEditor, LinksEditor } from '../components/Editors'
import { AddEventSheet } from './Calendar'
import { TaskList, TaskSheet, newTask } from '../components/Tasks'
import { IEdit, ILink, IUser, IPin } from '../components/Icons'
import { attendanceStats } from '../stats'
import { GRADES, countdown, fmtGrade, nowLocal, parseNum, relDay, shortDate, subjectKey, typeLabel } from '../utils'
import { back, go } from '../router'
import { initials } from './Subjects'

const GENERAL = '_general'
const TYPE_ORDER = ['W', 'LAB', 'CW', 'Ć', 'PROJ', 'P', 'SEM', 'S']
const tabLabel = (t: string) => t === GENERAL ? 'Ogólne' : t === 'LAB' ? 'Laby' : t === 'W' ? 'Wykład' : typeLabel(t)

function weighted(parts?: GradePart[]) {
  const ps = (parts ?? []).filter(p => p.grade != null && p.weight)
  if (!ps.length) return null
  const w = ps.reduce((a, p) => a + p.weight, 0)
  return ps.reduce((a, p) => a + (p.grade ?? 0) * p.weight, 0) / w
}

function RulesCard({ rules, parts, color, grade, onEdit, empty }: { rules?: string; parts?: GradePart[]; color: string; grade?: number | null; onEdit: () => void; empty: string }) {
  const pg = weighted(parts)
  return (
    <>
      <div className="section-h"><h2>Zaliczenie</h2><button className="a" onClick={onEdit}>Edytuj</button></div>
      <div className="card glass stack">
        {!rules && !parts?.length && grade == null && <span className="muted">{empty}</span>}
        {rules && <div className="pre">{rules}</div>}
        {!!parts?.length && (
          <div className="stack" style={{ gap: 8 }}>
            {parts.map((p, i) => (
              <div key={i}>
                <div className="row-flex small"><span className="grow">{p.name}</span><b>{p.weight}%</b><span className="muted" style={{ width: 34, textAlign: 'right' }}>{fmtGrade(p.grade)}</span></div>
                <div className="progress" style={{ marginTop: 4 }}><i style={{ width: `${Math.min(100, p.weight)}%`, background: color }} /></div>
              </div>
            ))}
            {pg != null && <div className="small">Wyliczona ocena z części: <b>{fmtGrade(pg)}</b></div>}
          </div>
        )}
        {grade != null && <div className="small">Ocena: <b>{fmtGrade(grade)}</b></div>}
      </div>
    </>
  )
}

function NotesCard({ title = 'Notatki', notes, links, onEdit }: { title?: string; notes?: string; links?: Link[]; onEdit: () => void }) {
  return (
    <>
      <div className="section-h"><h2>{title}</h2><button className="a" onClick={onEdit}>Edytuj</button></div>
      <div className="card glass pre">{notes || <span className="muted">Brak notatek — stuknij „Edytuj”.</span>}</div>
      {!!links?.length && (
        <div className="list glass" style={{ marginTop: 10 }}>
          {links.map((l, i) => (
            <a key={i} className="item" href={l.url.startsWith('http') ? l.url : 'https://' + l.url} target="_blank" rel="noreferrer">
              <ILink width={18} /><div className="grow ellipsis">{l.label || l.url}<div className="small muted ellipsis">{l.url}</div></div><span className="chev">›</span>
            </a>
          ))}
        </div>
      )}
    </>
  )
}

export function SubjectDetail({ id }: { id: string }) {
  const { subjects, events, tasks } = useStore()
  const s = subjects.find(x => x.id === id)
  const [edit, setEdit] = useState<Subject | null>(null)
  const [comp, setComp] = useState<string | null>(null)
  const [open, setOpen] = useState<CalEvent | null>(null)
  const [adding, setAdding] = useState<CalEvent | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [showAllPast, setShowAllPast] = useState(false)
  const [tab, setTab] = useState<string | null>(null)
  if (!s) return <><TopBar title="Przedmiot" large={false} left={<BackBtn onClick={() => go('subjects')} />} /><div className="empty">Nie znaleziono przedmiotu.</div></>

  const now = nowLocal()
  const evs = events.filter(e => e.subjectKey === s.key && (e.semesterId === s.semesterId || !e.semesterId)).sort((a, b) => a.start.localeCompare(b.start))
  const classes = evs.filter(e => e.kind === 'class')
  const exams = evs.filter(e => e.kind === 'exam')
  const types = [...new Set([...classes.map(e => e.type), ...Object.keys(s.components ?? {})])]
    .sort((a, b) => (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99))
  const nextAny = classes.find(e => e.end > now && !e.cancelled)
  const active = tab ?? (types.length ? (nextAny && types.includes(nextAny.type) ? nextAny.type : types[0]) : GENERAL)
  const tabs = [...types, GENERAL]

  const scoped = active === GENERAL ? classes : classes.filter(e => e.type === active)
  const upcoming = scoped.filter(e => e.end > now)
  const past = scoped.filter(e => e.end <= now)
  const next = upcoming.find(e => !e.cancelled)
  const lastDone = [...past].reverse().find(e => !e.cancelled) // ostatnio odbyte
  const active_ = scoped.filter(e => !e.cancelled)
  const final = active_[active_.length - 1] // ostatnie zajęcia w semestrze
  const left = active_.filter(e => e.end > now).length
  const subjTasks = tasks.filter(t => t.subjectId === s.id && (active === GENERAL ? !t.componentType || !types.includes(t.componentType) : t.componentType === active))
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const c: Component = active === GENERAL ? {} : s.components?.[active] ?? {}
  const st = attendanceStats(scoped)

  return (
    <>
      <TopBar title={s.shortName || s.name} large={false}
        left={<BackBtn onClick={() => back('subjects')} />}
        right={<button className="icon-btn" onClick={() => setEdit(s)} aria-label="Edytuj przedmiot"><IEdit /></button>} />

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

      <div style={{ position: 'sticky', top: 'calc(env(safe-area-inset-top) + 62px)', zIndex: 15, marginBottom: 4 }}>
        <div className="glass" style={{ borderRadius: 14, padding: 2 }}>
          <Seg value={active} options={tabs.map(t => [t, tabLabel(t)] as [string, string])} onChange={v => { setTab(v); setShowAllPast(false) }} />
        </div>
      </div>

      <div className="card glass tap" style={{ marginTop: 12 }} onClick={() => next && setOpen(next)}>
        <div className="small muted" style={{ fontWeight: 600 }}>NASTĘPNE ZAJĘCIA</div>
        {next ? <div className="row-flex" style={{ marginTop: 4, alignItems: 'flex-end' }}>
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 18 }}>{relDay(next.start)}</div>
            <div className="small muted">{typeLabel(next.type)} · {next.start.slice(11, 16)}–{next.end.slice(11, 16)}{next.room ? ` · sala ${next.room}` : ''}</div>
          </div>
          <span className="chip blue">{countdown(next.start)}</span>
        </div> : <div className="muted" style={{ marginTop: 4 }}>Brak nadchodzących zajęć</div>}
      </div>
      <div className="form-grid" style={{ marginTop: 10 }}>
        <div className="card glass tap" onClick={() => lastDone && setOpen(lastDone)}>
          <div className="small muted" style={{ fontWeight: 600 }}>OSTATNIO ODBYTE</div>
          {lastDone ? <><div style={{ fontWeight: 700, marginTop: 4 }}>{relDay(lastDone.start)}</div>
            <div className="small muted">{typeLabel(lastDone.type)} · {lastDone.start.slice(11, 16)}</div>
            <div className="small" style={{ marginTop: 2, color: lastDone.attendance === 'present' ? 'var(--green)' : lastDone.attendance === 'absent' ? 'var(--red)' : 'var(--label-2)' }}>
              {lastDone.attendance === 'present' ? 'Byłem' : lastDone.attendance === 'absent' ? 'Nie byłem' : 'Obecność?'}</div></>
            : <div className="muted" style={{ marginTop: 4 }}>—</div>}
        </div>
        <div className="card glass tap" onClick={() => final && setOpen(final)}>
          <div className="small muted" style={{ fontWeight: 600 }}>OSTATNIE W SEMESTRZE</div>
          {final ? <><div style={{ fontWeight: 700, marginTop: 4 }}>{relDay(final.start)}</div>
            <div className="small muted">{typeLabel(final.type)} · {final.start.slice(11, 16)}{final.room ? ` · ${final.room}` : ''}</div>
            <div className="small" style={{ marginTop: 2, color: left ? 'var(--accent)' : 'var(--green)' }}>
              {left ? `zostało ${left} z ${active_.length}` : 'zajęcia zakończone'}</div></>
            : <div className="muted" style={{ marginTop: 4 }}>—</div>}
        </div>
      </div>

      {active !== GENERAL ? (
        <>
          <div className="section-h"><h2>Prowadzący i obecność</h2><button className="a" onClick={() => setComp(active)}>Edytuj</button></div>
          <div className="list glass">
            <button className="item" onClick={() => setComp(active)}><IUser width={18} /><div className="grow">{c.teacher || <span className="muted">Dodaj prowadzącego</span>}{c.contact && <div className="small muted">{c.contact}</div>}</div></button>
            {c.room && <div className="item"><IPin width={18} /><div className="grow">Sala {c.room}</div></div>}
            <div className="item" style={{ flexWrap: 'wrap' }}>
              <div className="chips">
                {c.attendance === 'required' && <span className="chip orange">obecność obowiązkowa</span>}
                {c.attendance === 'optional' && <span className="chip">nie sprawdza obecności</span>}
                {(!c.attendance || c.attendance === 'unknown') && <span className="chip">obecność: ?</span>}
                <span className="chip">{st.total} zajęć</span>
                {st.present > 0 && <span className="chip green">{st.present} obecn.</span>}
                {(st.absent > 0 || c.absenceLimit != null) && <span className={'chip ' + (c.absenceLimit != null && st.absent >= c.absenceLimit ? 'red' : '')}>nieobecności {st.absent}{c.absenceLimit != null ? `/${c.absenceLimit}` : ''}</span>}
              </div>
            </div>
          </div>
          <NotesCard title={`Notatki · ${tabLabel(active)}`} notes={c.notes} links={c.links} onEdit={() => setComp(active)} />
          <RulesCard rules={c.rules} parts={c.gradeParts} grade={c.grade} color={s.color} onEdit={() => setComp(active)} empty="Brak zasad zaliczenia dla tej formy zajęć" />
        </>
      ) : (
        <>
          <NotesCard title="Notatki ogólne" notes={s.notes} links={s.links} onEdit={() => setEdit(s)} />
          <RulesCard rules={s.rules} parts={s.gradeParts} color={s.color} grade={s.grade} onEdit={() => setEdit(s)} empty="Brak zasad dla całego przedmiotu" />
          <div className="section-h"><h2>Egzaminy</h2><button className="a" onClick={() => setAdding(newManualEvent({ kind: 'exam', subjectKey: s.key, semesterId: s.semesterId }))}>Dodaj</button></div>
          <div className="stack">
            {exams.length ? exams.map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} showSubjectName={false} showDate={shortDate(e.start)} />)
              : <div className="list glass"><div className="item muted">Brak egzaminów</div></div>}
          </div>
        </>
      )}

      <div className="section-h"><h2>Zadania</h2><button className="a" onClick={() => setTask({ ...newTask(s.id), componentType: active === GENERAL ? null : active })}>Dodaj</button></div>
      <TaskList tasks={subjTasks} onOpen={setTask} showSubject={false} />

      <div className="section-h"><h2>Nadchodzące{active !== GENERAL ? ` · ${tabLabel(active)}` : ''}</h2><button className="a" onClick={() => setAdding(newManualEvent({ kind: 'class', subjectKey: s.key, semesterId: s.semesterId, type: active === GENERAL ? undefined : active }))}>Dodaj</button></div>
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
    <Sheet open={!!type} onClose={onClose} title={tabLabel(type)} onDone={async () => {
      const clean = { ...c, gradeParts: (c.gradeParts ?? []).filter(p => p.name), links: (c.links ?? []).filter(l => l.url) }
      await save<Subject>('subjects', { id: subject.id, components: { ...(subject.components ?? {}), [type]: clean } }); onClose()
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
        <Field label={`Notatki · ${tabLabel(type)}`}><textarea className="input" style={{ minHeight: 140 }} value={c.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
        <Field label="Zasady zaliczenia"><textarea className="input" value={c.rules ?? ''} placeholder="np. test 70% + sprawozdania 30%" onChange={e => set({ rules: e.target.value })} /></Field>
        <Field label="Składowe oceny (waga %, ocena)"><GradePartsEditor parts={c.gradeParts ?? []} onChange={gradeParts => set({ gradeParts })} /></Field>
        <Field label="Ocena z tej formy zajęć">
          <Seg value={c.grade == null ? '' : String(c.grade)} options={[['', '—'], ...GRADES.map(g => [String(g), String(g).replace('.', ',')] as [string, string])]} onChange={v => set({ grade: parseNum(v) })} />
        </Field>
        <Field label="Linki"><LinksEditor links={c.links ?? []} onChange={links => set({ links })} /></Field>
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

  const done = async () => {
    if (!s.name.trim()) return toast('Podaj nazwę')
    await save('subjects', { ...s, key: s.key || subjectKey(s.name), gradeParts: (s.gradeParts ?? []).filter(p => p.name), links: (s.links ?? []).filter(l => l.url) })
    onClose()
  }
  return (
    <Sheet open={!!subject} onClose={onClose} title={exists ? 'Przedmiot · ogólne' : 'Nowy przedmiot'} onDone={done} doneLabel={exists ? 'Gotowe' : 'Dodaj'}>
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
        <Field label="Ocena końcowa (do średniej)">
          <Seg value={s.grade == null ? '' : String(s.grade)} options={[['', '—'], ...GRADES.map(g => [String(g), String(g).replace('.', ',')] as [string, string])]} onChange={v => set({ grade: parseNum(v) })} />
        </Field>
        <p className="small muted" style={{ margin: '-4px 4px 0' }}>Notatki i zasady dla wykładu i labów edytujesz w ich zakładkach. Tu wpisujesz to, co dotyczy całego przedmiotu.</p>
        <Field label="Zasady zaliczenia całego przedmiotu"><textarea className="input" value={s.rules ?? ''} placeholder="np. lab 60% + egzamin 40%" onChange={e => set({ rules: e.target.value })} /></Field>
        <Field label="Składowe oceny końcowej (waga %, ocena)"><GradePartsEditor parts={s.gradeParts ?? []} onChange={gradeParts => set({ gradeParts })} /></Field>
        <Field label="Notatki ogólne"><textarea className="input" style={{ minHeight: 120 }} value={s.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
        <Field label="Linki ogólne"><LinksEditor links={s.links ?? []} onChange={links => set({ links })} /></Field>
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
