import type { GradePart, Link } from '../types'
import { parseNum } from '../utils'

export function GradePartsEditor({ parts, onChange }: { parts: GradePart[]; onChange: (p: GradePart[]) => void }) {
  const setPart = (i: number, p: Partial<GradePart>) => onChange(parts.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="stack" style={{ gap: 8 }}>
      {parts.map((p, i) => (
        <div key={i} className="link-row">
          <input className="input" value={p.name} placeholder="np. Projekt" onChange={e => setPart(i, { name: e.target.value })} />
          <input className="input" style={{ width: 64, flex: 'none' }} inputMode="decimal" value={p.weight || ''} placeholder="%" onChange={e => setPart(i, { weight: parseNum(e.target.value) ?? 0 })} />
          <input className="input" style={{ width: 64, flex: 'none' }} inputMode="decimal" value={p.grade ?? ''} placeholder="ocena" onChange={e => setPart(i, { grade: parseNum(e.target.value) })} />
          <button className="icon-btn" onClick={() => onChange(parts.filter((_, j) => j !== i))} aria-label="Usuń">✕</button>
        </div>
      ))}
      <button className="btn gray sm" onClick={() => onChange([...parts, { name: '', weight: 0 }])}>+ Składowa</button>
    </div>
  )
}

export function LinksEditor({ links, onChange }: { links: Link[]; onChange: (l: Link[]) => void }) {
  const setLink = (i: number, p: Partial<Link>) => onChange(links.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="stack" style={{ gap: 8 }}>
      {links.map((l, i) => (
        <div key={i} className="link-row">
          <input className="input" style={{ maxWidth: 120 }} value={l.label} placeholder="Nazwa" onChange={e => setLink(i, { label: e.target.value })} />
          <input className="input" value={l.url} placeholder="https://…" onChange={e => setLink(i, { url: e.target.value })} />
          <button className="icon-btn" onClick={() => onChange(links.filter((_, j) => j !== i))} aria-label="Usuń">✕</button>
        </div>
      ))}
      <button className="btn gray sm" onClick={() => onChange([...links, { label: '', url: '' }])}>+ Link</button>
    </div>
  )
}
