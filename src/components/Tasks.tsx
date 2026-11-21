import { useEffect, useState } from 'react'
import type { Task } from '../types'
import { useStore } from '../store'
import { Field, Sheet, toast } from './ui'
import { ICheck } from './Icons'
import { relDay, todayKey, uid } from '../utils'

export function TaskList({ tasks, onOpen, showSubject = true }: { tasks: Task[]; onOpen: (t: Task) => void; showSubject?: boolean }) {
  const { save, subjects } = useStore()
  if (!tasks.length) return <div className="list glass"><div className="item muted">Brak zadań</div></div>
  return (
    <div className="list glass">
      {tasks.map(t => {
        const s = subjects.find(x => x.id === t.subjectId)
        const overdue = !t.done && t.due && t.due.slice(0, 10) < todayKey()
        return (
          <div key={t.id} className="item indent" onClick={() => onOpen(t)}>
            <button className={'check' + (t.done ? ' on' : '')} onClick={ev => { ev.stopPropagation(); save('tasks', { id: t.id, done: !t.done }) }} aria-label="Zrobione">
              {t.done && <ICheck />}
            </button>
            <div className="grow">
              <div style={{ textDecoration: t.done ? 'line-through' : undefined, opacity: t.done ? .5 : 1 }}>{t.title}{t.weight && <span className="muted"> · {t.weight}</span>}</div>
              <div className="small muted row-flex" style={{ gap: 6, marginTop: 2 }}>
                {showSubject && s && <><span className="dot" style={{ background: s.color, width: 7, height: 7 }} />{s.shortName || s.name}</>}
                {t.due && <span style={{ color: overdue ? 'var(--red)' : undefined }}>{showSubject && s ? '· ' : ''}{relDay(t.due)}{t.due.length > 10 ? ' ' + t.due.slice(11, 16) : ''}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { save, remove, semesterSubjects, tasks } = useStore()
  const [t, setT] = useState<Task | null>(task)
  useEffect(() => setT(task), [task])
  if (!t) return null
  const exists = tasks.some(x => x.id === t.id)
  const set = (p: Partial<Task>) => setT({ ...t, ...p })
  return (
    <Sheet open={!!task} onClose={onClose} title={exists ? 'Zadanie' : 'Nowe zadanie'} doneLabel={exists ? 'Gotowe' : 'Dodaj'}
      onDone={async () => { if (!t.title.trim()) return toast('Wpisz nazwę zadania'); await save('tasks', t); onClose() }}>
      <div className="stack" style={{ gap: 14 }}>
        <Field label="Co trzeba zrobić"><input className="input" autoFocus={!exists} value={t.title} placeholder="np. Sprawozdanie z lab 3" onChange={e => set({ title: e.target.value })} /></Field>
        <Field label="Przedmiot">
          <select className="input" value={t.subjectId ?? ''} onChange={e => set({ subjectId: e.target.value || null })}>
            <option value="">— bez przedmiotu —</option>
            {semesterSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Termin"><input className="input" type="date" value={t.due?.slice(0, 10) ?? ''} onChange={e => set({ due: e.target.value || null })} /></Field>
          <Field label="Waga / punkty"><input className="input" value={t.weight ?? ''} placeholder="np. 16%" onChange={e => set({ weight: e.target.value })} /></Field>
        </div>
        <Field label="Notatki"><textarea className="input" value={t.notes ?? ''} onChange={e => set({ notes: e.target.value })} /></Field>
        {exists && <button className="btn danger block" onClick={async () => { await remove('tasks', t.id); onClose() }}>Usuń zadanie</button>}
      </div>
    </Sheet>
  )
}

export const newTask = (subjectId?: string): Task => ({ id: uid(), title: '', done: false, subjectId: subjectId ?? null, due: null, createdAt: Date.now() })
