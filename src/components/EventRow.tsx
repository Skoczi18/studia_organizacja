import type { CalEvent } from '../types'
import { useStore } from '../store'
import { fmtTime, hexA, nowLocal, typeLabel } from '../utils'
import { ICheck, IX } from './Icons'

export function EventRow({ e, onClick, showSubjectName = true, showDate }: { e: CalEvent; onClick: () => void; showSubjectName?: boolean; showDate?: string }) {
  const { colorOf, subjectOf } = useStore()
  const color = colorOf(e)
  const s = subjectOf(e)
  const past = e.end < nowLocal()
  const required = e.required ?? (s?.components?.[e.type]?.attendance === 'required' ? true : null)
  return (
    <div className={'event glass' + (e.cancelled ? ' cancelled' : '') + (past && e.kind !== 'exam' ? ' past' : '')}
      style={{ background: `linear-gradient(${hexA(color, 0.10)}, ${hexA(color, 0.10)}), var(--glass)` }} onClick={onClick}>
      <div className="bar" style={{ background: color }} />
      <div className="time">
        {showDate && <span style={{ color: 'var(--label)', fontWeight: 600 }}>{showDate}</span>}
        {fmtTime(e.start)}<span>{fmtTime(e.end)}</span>
      </div>
      <div className="body">
        <div className="ttl">{showSubjectName ? (s?.shortName || s?.name || e.title) : typeLabel(e.type)}</div>
        <div className="meta">
          {showSubjectName && <span>{e.kind === 'exam' ? (e.attempt || 'Egzamin') : typeLabel(e.type)}</span>}
          {e.room && <span>Sala {e.room}</span>}
          {s?.components?.[e.type]?.teacher && <span>{s.components[e.type].teacher}</span>}
        </div>
        {(e.note || required || e.cancelled || e.attendance || e.examForm) && (
          <div className="chips" style={{ marginTop: 7 }}>
            {e.cancelled && <span className="chip red">Odwołane?</span>}
            {e.attendance === 'present' && <span className="chip green"><ICheck width={11} height={11} />Byłem</span>}
            {e.attendance === 'absent' && <span className="chip red"><IX width={11} height={11} />Nieobecny</span>}
            {required && !e.attendance && <span className="chip orange">Obowiązkowe</span>}
            {e.examForm && <span className="chip blue">{e.examForm}</span>}
            {e.note && <span className="chip ellipsis" style={{ maxWidth: '100%' }}>✎ {e.note.split('\n')[0]}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
