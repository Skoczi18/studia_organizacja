import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { useRoute, go } from './router'
import { Today } from './screens/Today'
import { Calendar } from './screens/Calendar'
import { Subjects } from './screens/Subjects'
import { SubjectDetail } from './screens/SubjectDetail'
import { Session } from './screens/Session'
import { Settings } from './screens/Settings'
import { Toaster } from './components/ui'
import { IBook, ICal, IExam, IGear, IToday } from './components/Icons'

const TABS = [
  ['today', 'Dziś', IToday],
  ['calendar', 'Kalendarz', ICal],
  ['subjects', 'Przedmioty', IBook],
  ['session', 'Sesja', IExam],
  ['settings', 'Ustawienia', IGear]
] as const

const SYNC_EVERY = 3 * 3600 * 1000

export default function App() {
  const st = useStore()
  const route = useRoute()
  const synced = useRef(false)

  useEffect(() => {
    const t = st.settings.theme
    if (!t || t === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }, [st.settings.theme])

  useEffect(() => {
    if (!st.loaded || synced.current || !st.settings.icalUrl || !st.activeSemester) return
    if (Date.now() - (st.settings.lastSync ?? 0) < SYNC_EVERY) return
    synced.current = true
    st.sync().catch(e => console.warn('auto-sync', e))
  }, [st.loaded, st.settings.icalUrl, st.activeSemester?.id])

  if (!st.authReady) return <div className="login"><div className="spin" /></div>
  if (!st.user) return <Login />
  if (!st.loaded) return <div className="login"><div className="spin" /></div>

  const [tab, id] = route
  let screen
  if (tab === 'calendar') screen = <Calendar />
  else if (tab === 'subjects' && id) screen = <SubjectDetail id={id} />
  else if (tab === 'subjects') screen = <Subjects />
  else if (tab === 'session') screen = <Session />
  else if (tab === 'settings') screen = <Settings />
  else screen = <Today />

  return (
    <>
      <main className="app" key={route.join('/')}>{screen}</main>
      <nav className="tabbar glass">
        {TABS.map(([k, label, Icon]) => (
          <button key={k} className={tab === k || (k === 'today' && !TABS.some(t => t[0] === tab)) ? 'on' : ''} onClick={() => go(k)}>
            <Icon />{label}
          </button>
        ))}
      </nav>
      <Toaster />
    </>
  )
}

function Login() {
  const { login } = useStore()
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="login">
      <img src={import.meta.env.BASE_URL + 'icons/icon-192.png'} alt="" />
      <h1 className="large-title" style={{ marginTop: 10 }}>Studia</h1>
      <p className="muted" style={{ maxWidth: 300 }}>Plan zajęć z USOS, przedmioty, obecności, sesja, oceny i notatki — w jednym miejscu.</p>
      <button className="btn glass" style={{ background: 'var(--glass-strong)', color: 'var(--label)', marginTop: 16, padding: '14px 22px' }}
        disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await login() } catch (e: any) { setErr(e.message) } finally { setBusy(false) } }}>
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        {busy ? 'Logowanie…' : 'Zaloguj przez Google'}
      </button>
      {err && <p className="small" style={{ color: 'var(--red)', maxWidth: 320 }}>{err}</p>}
    </div>
  )
}
