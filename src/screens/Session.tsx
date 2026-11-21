import { useState } from 'react'
import { useStore } from '../store'
import type { CalEvent } from '../types'
import { TopBar } from '../components/ui'
import { EventSheet, newManualEvent } from '../components/EventSheet'
import { AddEventSheet } from './Calendar'
import { IPlus } from '../components/Icons'
import { countdown, fmtDate, fmtGrade, fmtTime, hexA, nowLocal } from '../utils'

export function Session() {
  const { events, activeSemester, subjectOf, colorOf, semesterSubjects } = useStore()
  const [open, setOpen] = useState<CalEvent | null>(null)
  const [adding, setAdding] = useState<CalEvent | null>(null)
  const now = nowLocal()
  const exams = events.filter(e => e.kind === 'exam' && (!activeSemester || e.semesterId === activeSemester.id || !e.semesterId))
    .sort((a, b) => a.start.localeCompare(b.start))
  const upcoming = exams.filter(e => e.end >= now.slice(0, 10) + 'T00:00' && e.examStatus !== 'passed')
  const done = exams.filter(e => !upcoming.includes(e))
  const passedSubjects = new Set(exams.filter(e => e.examStatus === 'passed').map(e => e.subjectKey))
  const toPass = new Set(upcoming.filter(e => !passedSubjects.has(e.subjectKey)).map(e => e.subjectKey))
  const ectsAtStake = semesterSubjects.filter(s => toPass.has(s.key)).reduce((a, s) => a + (s.ects ?? 0), 0)

  const Card = ({ e }: { e: CalEvent }) => {
    const s = subjectOf(e)
    const c = colorOf(e)
    const retakeOfPassed = passedSubjects.has(e.subjectKey) && e.examStatus !== 'passed'
    return (
      <div className="card glass tap" onClick={() => setOpen(e)} style={{ opacity: retakeOfPassed ? .5 : 1, background: `linear-gradient(${hexA(c, .09)}, ${hexA(c, .09)}), var(--glass)` }}>
        <div className="row-flex" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <div className="row-flex" style={{ gap: 8 }}><span className="dot" style={{ background: c }} /><b style={{ lineHeight: 1.25 }}>{s?.name ?? e.title}</b></div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {fmtDate(e.start, { weekday: true })} · {fmtTime(e.start)}{e.room ? ` · sala ${e.room}` : ''}{e.building ? ` · ${e.building.split(' - ').pop()}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            {e.examStatus === 'passed' ? <span className="chip green">Zdany {e.examGrade ? fmtGrade(e.examGrade) : ''}</span>
              : e.examStatus === 'failed' ? <span className="chip red">Niezdany</span>
                : <span className="chip blue">{countdown(e.start)}</span>}
          </div>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          <span className="chip">{e.attempt || (e.source === 'usos' ? 'termin z USOS' : 'egzamin')}</span>
          {e.examForm && <span className="chip orange">{e.examForm}</span>}
          {e.required === false && <span className="chip">nie trzeba iść</span>}
          {s?.ects != null && <span className="chip">{s.ects} ECTS</span>}
        </div>
        {e.note && <div className="small pre" style={{ marginTop: 8 }}>{e.note}</div>}
      </div>
    )
  }

  return (
    <>
      <TopBar title="Sesja" sub={activeSemester?.name}
        right={<button className="icon-btn" onClick={() => setAdding(newManualEvent({ kind: 'exam', semesterId: activeSemester?.id }))} aria-label="Dodaj egzamin"><IPlus /></button>} />
      <div className="stats">
        <div className="stat glass"><div className="v">{toPass.size}</div><div className="l">do zdania</div></div>
        <div className="stat glass"><div className="v">{passedSubjects.size}</div><div className="l">zdane</div></div>
        <div className="stat glass"><div className="v">{ectsAtStake || '—'}</div><div className="l">ECTS w grze</div></div>
      </div>
      <div className="section-h"><h2>Nadchodzące</h2></div>
      <div className="stack">
        {upcoming.length ? upcoming.map(e => <Card key={e.id} e={e} />) : <div className="empty card glass">Brak egzaminów przed Tobą 🎉</div>}
      </div>
      {done.length > 0 && (
        <>
          <div className="section-h"><h2>Zakończone</h2></div>
          <div className="stack">{done.reverse().map(e => <Card key={e.id} e={e} />)}</div>
        </>
      )}
      <EventSheet event={open} onClose={() => setOpen(null)} />
      <AddEventSheet event={adding} onClose={() => setAdding(null)} />
    </>
  )
}
