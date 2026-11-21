import { useState } from 'react'
import { useStore } from '../store'
import type { Subject } from '../types'
import { TopBar } from '../components/ui'
import { IPlus } from '../components/Icons'
import { SubjectEditSheet } from './SubjectDetail'
import { attendanceStats, ectsEarned, ectsSum, weightedAverage } from '../stats'
import { PALETTE, fmtGrade, nowLocal, relDay, fmtTime, typeLabel, uid } from '../utils'
import { go } from '../router'

export const initials = (s: Subject) =>
  (s.shortName || s.name).split(/\s+/).filter(w => w.length > 2 || /^[A-Z0-9]/.test(w)).slice(0, 3).map(w => w[0]).join('').toUpperCase() || s.name.slice(0, 2)

export function Subjects() {
  const { semesterSubjects, semesters, years, activeSemester, saveSettings, events, subjects } = useStore()
  const [edit, setEdit] = useState<Subject | null>(null)
  const now = nowLocal()
  const avg = weightedAverage(semesterSubjects)
  const allAvg = weightedAverage(subjects)
  const sortedSem = [...semesters].sort((a, b) => a.number - b.number)

  return (
    <>
      <TopBar title="Przedmioty" right={activeSemester && <button className="icon-btn" aria-label="Dodaj przedmiot"
        onClick={() => setEdit({ id: uid(), semesterId: activeSemester.id, key: '', name: '', color: PALETTE[semesterSubjects.length % PALETTE.length], ects: null, components: {} })}><IPlus /></button>} />

      {sortedSem.length > 0 && (
        <select className="input glass" style={{ marginBottom: 14, fontWeight: 600 }} value={activeSemester?.id}
          onChange={e => saveSettings({ activeSemesterId: e.target.value })}>
          {sortedSem.map(s => <option key={s.id} value={s.id}>{years.find(y => y.id === s.yearId)?.name ?? ''} · {s.name}</option>)}
        </select>
      )}

      <div className="stats">
        <div className="stat glass"><div className="v">{ectsSum(semesterSubjects) || '—'}</div><div className="l">ECTS ({ectsEarned(semesterSubjects)} zal.)</div></div>
        <div className="stat glass"><div className="v">{fmtGrade(avg)}</div><div className="l">Średnia semestru</div></div>
        <div className="stat glass"><div className="v">{fmtGrade(allAvg)}</div><div className="l">Średnia całość</div></div>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        {!activeSemester && <div className="empty card glass">Dodaj rok i semestr w Ustawieniach.</div>}
        {activeSemester && !semesterSubjects.length && <div className="empty card glass">Brak przedmiotów. Zsynchronizuj plan z USOS albo dodaj przedmiot przyciskiem +.</div>}
        {semesterSubjects.map(s => {
          const evs = events.filter(e => e.subjectKey === s.key && e.semesterId === s.semesterId && !e.cancelled).sort((a, b) => a.start.localeCompare(b.start))
          const next = evs.find(e => e.start > now)
          const att = attendanceStats(evs)
          return (
            <div key={s.id} className="card glass tap subject-card" onClick={() => go('subjects/' + s.id)}>
              <div className="sw" style={{ background: s.color }}>{initials(s)}</div>
              <div className="grow">
                <div style={{ fontWeight: 600, lineHeight: 1.25 }}>{s.name}</div>
                <div className="small muted" style={{ marginTop: 3 }}>
                  {next ? `${next.kind === 'exam' ? 'Egzamin' : typeLabel(next.type)} · ${relDay(next.start)} ${fmtTime(next.start)}` : 'Brak nadchodzących zajęć'}
                </div>
                <div className="chips" style={{ marginTop: 7 }}>
                  {s.ects != null && <span className="chip blue">{s.ects} ECTS</span>}
                  {s.grade != null && <span className="chip green">ocena {fmtGrade(s.grade)}</span>}
                  {s.status === 'passed' && s.grade == null && <span className="chip green">zaliczone</span>}
                  {(att.present + att.absent > 0) && <span className="chip">obecności {att.present}/{att.present + att.absent}</span>}
                  {att.absent > 0 && <span className="chip red">{att.absent} nb.</span>}
                </div>
              </div>
              <span className="muted" style={{ fontSize: 22 }}>›</span>
            </div>
          )
        })}
      </div>
      <SubjectEditSheet subject={edit} onClose={() => setEdit(null)} />
    </>
  )
}
