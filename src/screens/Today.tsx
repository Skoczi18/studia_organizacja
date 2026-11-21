import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { CalEvent, Task } from '../types'
import { TopBar } from '../components/ui'
import { EventRow } from '../components/EventRow'
import { EventSheet } from '../components/EventSheet'
import { TaskList, TaskSheet, newTask } from '../components/Tasks'
import { ICheck, IX } from '../components/Icons'
import { countdown, fmtDate, fmtGrade, fmtTime, nowLocal, relDay, shortDate, todayKey, typeLabel } from '../utils'
import { ectsSum, weightedAverage } from '../stats'
import { go } from '../router'

export function Today() {
  const st = useStore()
  const { events, activeSemester, semesterSubjects, settings, tasks, subjectOf, colorOf, save } = st
  const [open, setOpen] = useState<CalEvent | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const now = nowLocal()

  const sem = useMemo(() => events.filter(e => !activeSemester || e.semesterId === activeSemester.id || !e.semesterId)
    .sort((a, b) => a.start.localeCompare(b.start)), [events, activeSemester])
  const classes = sem.filter(e => !e.cancelled)
  const current = classes.find(e => e.start <= now && e.end > now)
  const next = classes.find(e => e.start > now)
  const hero = current ?? next

  // najbliższy dzień z zajęciami (zjazd) — dziś, jeśli dziś coś jeszcze jest
  const upcomingDays = [...new Set(classes.filter(e => e.end > now).map(e => e.start.slice(0, 10)))].slice(0, 2)
  const nextExam = sem.find(e => e.kind === 'exam' && e.start > now && e.examStatus !== 'passed')
  const toMark = sem.filter(e => e.kind === 'class' && !e.cancelled && e.end < now && !e.attendance &&
    e.start.slice(0, 10) >= new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10)).slice(-6).reverse()
  const openTasks = tasks.filter(t => !t.done).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999')).slice(0, 6)
  const avg = weightedAverage(semesterSubjects)
  const p = settings.profile
  const heroSubj = hero && subjectOf(hero)

  return (
    <>
      <TopBar title="Dziś" sub={<>{fmtDate(todayKey(), { weekday: true })}{p?.field ? ` · ${p.field}` : ''}{activeSemester ? ` · ${activeSemester.name}` : ''}</>} />

      {(!settings.icalUrl || !activeSemester) && (
        <div className="card glass tap" onClick={() => go('settings')} style={{ marginBottom: 14 }}>
          <b>Zacznij od ustawień</b>
          <p className="muted small" style={{ marginTop: 4 }}>Dodaj rok i semestr oraz wklej link do planu iCal z USOS — zajęcia i przedmioty pojawią się same.</p>
        </div>
      )}

      {hero && (
        <div className="hero glass tap" onClick={() => setOpen(hero)} style={{ borderLeft: `5px solid ${colorOf(hero)}` }}>
          <div className="k">{current ? 'Trwa teraz' : `Następne · ${relDay(hero.start)} · ${countdown(hero.start)}`}</div>
          <div className="big">{heroSubj?.name ?? hero.title}</div>
          <div className="muted">{hero.kind === 'exam' ? 'Egzamin' : typeLabel(hero.type)} · {fmtTime(hero.start)}–{fmtTime(hero.end)}{hero.room ? ` · sala ${hero.room}` : ''}</div>
          {heroSubj?.components?.[hero.type]?.teacher && <div className="muted small" style={{ marginTop: 2 }}>{heroSubj.components[hero.type].teacher}</div>}
          {hero.note && <div className="small pre" style={{ marginTop: 8 }}>✎ {hero.note}</div>}
        </div>
      )}

      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat glass"><div className="v">{ectsSum(semesterSubjects) || '—'}</div><div className="l">ECTS w semestrze</div></div>
        <div className="stat glass"><div className="v">{fmtGrade(avg)}</div><div className="l">Średnia</div></div>
        <div className="stat glass tap" onClick={() => go('session')}><div className="v">{nextExam ? countdown(nextExam.start).replace('za ', '') : '—'}</div><div className="l">do egzaminu</div></div>
      </div>

      {upcomingDays.map(d => (
        <div key={d}>
          <div className={'day-h' + (d === todayKey() ? ' today' : '')}>{relDay(d)}{d !== todayKey() ? '' : ` · ${fmtDate(d)}`}</div>
          <div className="stack">
            {classes.filter(e => e.start.slice(0, 10) === d).map(e => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} />)}
          </div>
        </div>
      ))}

      {toMark.length > 0 && (
        <>
          <div className="section-h"><h2>Uzupełnij obecność</h2></div>
          <div className="list glass">
            {toMark.map(e => {
              const s = subjectOf(e)
              return (
                <div key={e.id} className="item">
                  <span className="dot" style={{ background: colorOf(e) }} />
                  <div className="grow" onClick={() => setOpen(e)}>
                    <div className="ellipsis">{s?.shortName || s?.name || e.title}</div>
                    <div className="small muted">{typeLabel(e.type)} · {relDay(e.start)} {fmtTime(e.start)}</div>
                  </div>
                  <button className="icon-btn" style={{ color: 'var(--green)' }} onClick={() => save('events', { id: e.id, attendance: 'present' })} aria-label="Byłem"><ICheck /></button>
                  <button className="icon-btn" style={{ color: 'var(--red)' }} onClick={() => save('events', { id: e.id, attendance: 'absent' })} aria-label="Nie byłem"><IX /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="section-h"><h2>Do zrobienia</h2><button className="a" onClick={() => setTask(newTask())}>Dodaj</button></div>
      <TaskList tasks={openTasks} onOpen={setTask} />

      {nextExam && (
        <>
          <div className="section-h"><h2>Najbliższy egzamin</h2><button className="a" onClick={() => go('session')}>Sesja</button></div>
          <EventRow e={nextExam} onClick={() => setOpen(nextExam)} showDate={shortDate(nextExam.start)} />
        </>
      )}

      <EventSheet event={open} onClose={() => setOpen(null)} />
      <TaskSheet task={task} onClose={() => setTask(null)} />
    </>
  )
}
