import { useEffect, useState, type ReactNode } from 'react'
import { PALETTE } from '../utils'
import { IBack } from './Icons'

export function TopBar({ title, left, right, large = true, sub }: { title: string; left?: ReactNode; right?: ReactNode; large?: boolean; sub?: ReactNode }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > (large ? 44 : 4))
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [large])
  return (
    <>
      <div className={'topbar' + (scrolled || !large ? ' scrolled' : '')}>
        <div className="side">{left}</div>
        <div className="t">{title}</div>
        <div className="side r">{right}</div>
      </div>
      {large && <h1 className="large-title">{title}</h1>}
      {large && sub && <div className="subtitle">{sub}</div>}
    </>
  )
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return <button className="icon-btn" onClick={onClick} aria-label="Wstecz"><IBack /></button>
}

export function Sheet({ open, onClose, title, onDone, doneLabel = 'Gotowe', children }: {
  open: boolean; onClose: () => void; title?: string; onDone?: () => void; doneLabel?: string; children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        <div className="sheet-head">
          <button className="text-btn" style={{ textAlign: 'left' }} onClick={onClose}>{onDone ? 'Anuluj' : 'Zamknij'}</button>
          <h3>{title}</h3>
          {onDone ? <button className="text-btn b" onClick={onDone}>{doneLabel}</button> : <span style={{ minWidth: 64 }} />}
        </div>
        {children}
      </div>
    </>
  )
}

export function ColorPicker({ value, onChange, allowNone }: { value?: string | null; onChange: (c: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="colors">
      {allowNone && (
        <button className={!value ? 'on' : ''} style={{ background: 'var(--fill-2)' }} onClick={() => onChange(null)} title="Kolor przedmiotu" />
      )}
      {PALETTE.map(c => (
        <button key={c} className={value === c ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
    </div>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <div className={'field' + (full ? ' full' : '')}><label>{label}</label>{children}</div>
}

let toastSetter: ((s: string | null) => void) | null = null
export function toast(msg: string) { toastSetter?.(msg) }
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { toastSetter = setMsg; return () => { toastSetter = null } }, [])
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 2800); return () => clearTimeout(t) } }, [msg])
  return msg ? <div className="toast glass">{msg}</div> : null
}
