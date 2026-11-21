import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { Profile, Semester, Year } from '../types'
import { Field, Seg, Sheet, TopBar, toast } from '../components/ui'
import { uid } from '../utils'

export function Settings() {
  const st = useStore()
  const { settings, saveSettings, years, semesters, user, logout, sync, syncing, activeSemester, save, remove, subjects, events } = st
  const [url, setUrl] = useState(settings.icalUrl ?? '')
  const [profile, setProfile] = useState<Profile>(settings.profile ?? {})
  const [year, setYear] = useState<Year | null>(null)
  const [sem, setSem] = useState<Semester | null>(null)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setUrl(settings.icalUrl ?? '') }, [settings.icalUrl])
  useEffect(() => { setProfile(settings.profile ?? {}) }, [settings.profile])

  const doSync = async () => {
    try {
      if (url !== settings.icalUrl) await saveSettings({ icalUrl: url.trim() })
      const r = await sync()
      toast(`OK · ${r.added} nowych, ${r.updated} zaktualizowanych, ${r.subjects} nowych przedmiotów`)
    } catch (e: any) { toast(e.message) }
  }

  const onFile = async (f?: File) => {
    if (!f) return
    setImporting(true)
    try { toast(await st.importData(JSON.parse(await f.text()))) }
    catch (e: any) { toast('Błąd importu: ' + e.message) }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(st.exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `studia-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const sortedYears = [...years].sort((a, b) => a.order - b.order)

  return (
    <>
      <TopBar title="Ustawienia" />

      <div className="caption">Plan z USOS (iCal)</div>
      <div className="card glass stack">
        <input className="input" value={url} placeholder="https://usosapps.put.poznan.pl/services/tt/upcoming_ical?…" onChange={e => setUrl(e.target.value)} />
        <button className="btn block" disabled={syncing || !url} onClick={doSync}>{syncing ? 'Synchronizuję…' : 'Synchronizuj teraz'}</button>
        <p className="small muted">
          USOS → Mój USOSweb → Plan zajęć → „Eksportuj do iCalendar”. Link zapisuje się tylko w Twojej bazie. Zajęcia trafiają do aktywnego semestru{activeSemester ? ` (${activeSemester.name})` : ''}; aplikacja synchronizuje się sama co kilka godzin.
          {settings.lastSync ? ` Ostatnio: ${new Date(settings.lastSync).toLocaleString('pl-PL')}.` : ''}
        </p>
      </div>

      <div className="caption">Lata i semestry</div>
      <div className="list glass">
        {sortedYears.map(y => (
          <div key={y.id}>
            <button className="item" onClick={() => setYear(y)}><b className="grow">{y.name}</b><span className="chev">›</span></button>
            {semesters.filter(s => s.yearId === y.id).sort((a, b) => a.number - b.number).map(s => (
              <div key={s.id} className="item" style={{ paddingLeft: 30 }}>
                <button className={'check' + (activeSemester?.id === s.id ? ' on' : '')} onClick={() => saveSettings({ activeSemesterId: s.id })} aria-label="Aktywny">
                  {activeSemester?.id === s.id && <span style={{ fontSize: 13 }}>✓</span>}
                </button>
                <div className="grow" onClick={() => setSem(s)} style={{ cursor: 'pointer' }}>
                  {s.name}<div className="small muted">{subjects.filter(x => x.semesterId === s.id).length} przedmiotów{s.kind ? ` · ${s.kind}` : ''}</div>
                </div>
                <span className="chev" onClick={() => setSem(s)}>›</span>
              </div>
            ))}
            <button className="item" style={{ paddingLeft: 30, color: 'var(--accent)' }}
              onClick={() => setSem({ id: uid(), yearId: y.id, name: `Semestr ${semesters.length + 1}`, number: semesters.length + 1 })}>+ Dodaj semestr</button>
          </div>
        ))}
        <button className="item" style={{ color: 'var(--accent)', fontWeight: 600 }}
          onClick={() => setYear({ id: uid(), name: `Rok ${years.length + 1}`, order: years.length + 1 })}>+ Dodaj rok</button>
      </div>
      <p className="small muted" style={{ margin: '6px 16px 0' }}>Zaznacz kółkiem aktywny semestr — to jego przedmioty widzisz w aplikacji.</p>

      <div className="caption">Profil</div>
      <div className="card glass stack">
        <Field label="Kierunek"><input className="input" value={profile.field ?? ''} onChange={e => setProfile({ ...profile, field: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="Uczelnia"><input className="input" value={profile.university ?? ''} onChange={e => setProfile({ ...profile, university: e.target.value })} /></Field>
          <Field label="Tryb"><input className="input" value={profile.mode ?? ''} onChange={e => setProfile({ ...profile, mode: e.target.value })} /></Field>
        </div>
        <button className="btn gray block" onClick={async () => { await saveSettings({ profile }); toast('Zapisano profil') }}>Zapisz profil</button>
      </div>

      <div className="caption">Wygląd</div>
      <div className="card glass">
        <Seg value={settings.theme ?? 'auto'} options={[['auto', 'Automatyczny'], ['light', 'Jasny'], ['dark', 'Ciemny']]} onChange={v => saveSettings({ theme: v })} />
      </div>

      <div className="caption">Dane</div>
      <div className="list glass">
        <button className="item" onClick={exportJson}><span className="grow">Eksportuj kopię (JSON)</span><span className="chev">›</span></button>
        <button className="item" onClick={() => fileRef.current?.click()} disabled={importing}><span className="grow">{importing ? 'Importuję…' : 'Importuj z pliku JSON'}</span><span className="chev">›</span></button>
        <div className="item"><span className="grow muted small">{subjects.length} przedmiotów · {events.length} wydarzeń · {st.tasks.length} zadań</span></div>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => onFile(e.target.files?.[0])} />

      <div className="caption">Konto</div>
      <div className="list glass">
        <div className="item">
          {user?.photoURL && <img src={user.photoURL} alt="" width={36} height={36} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />}
          <div className="grow">{user?.displayName}<div className="small muted">{user?.email}</div></div>
        </div>
        <button className="item" style={{ color: 'var(--red)' }} onClick={logout}>Wyloguj</button>
      </div>
      <p className="small muted" style={{ textAlign: 'center', margin: '24px 0' }}>Studia · planer · v1.0</p>

      <Sheet open={!!year} onClose={() => setYear(null)} title="Rok studiów" onDone={async () => { await save('years', year!); setYear(null) }}>
        {year && <div className="stack" style={{ gap: 14 }}>
          <Field label="Nazwa"><input className="input" value={year.name} placeholder="Rok 4 · 2026/27" onChange={e => setYear({ ...year, name: e.target.value })} /></Field>
          <Field label="Kolejność"><input className="input" inputMode="numeric" value={year.order} onChange={e => setYear({ ...year, order: parseInt(e.target.value) || 0 })} /></Field>
          {years.some(y => y.id === year.id) && <button className="btn danger block" onClick={async () => {
            if (semesters.some(s => s.yearId === year.id)) return toast('Najpierw usuń semestry tego roku')
            await remove('years', year.id); setYear(null)
          }}>Usuń rok</button>}
        </div>}
      </Sheet>

      <Sheet open={!!sem} onClose={() => setSem(null)} title="Semestr" onDone={async () => {
        await save('semesters', sem!)
        if (!settings.activeSemesterId) await saveSettings({ activeSemesterId: sem!.id })
        setSem(null)
      }}>
        {sem && <div className="stack" style={{ gap: 14 }}>
          <div className="form-grid">
            <Field label="Nazwa"><input className="input" value={sem.name} onChange={e => setSem({ ...sem, name: e.target.value })} /></Field>
            <Field label="Numer"><input className="input" inputMode="numeric" value={sem.number} onChange={e => setSem({ ...sem, number: parseInt(e.target.value) || 0 })} /></Field>
          </div>
          <Field label="Rodzaj"><Seg value={sem.kind ?? 'zimowy'} options={[['zimowy', 'Zimowy'], ['letni', 'Letni']]} onChange={v => setSem({ ...sem, kind: v })} /></Field>
          <div className="form-grid">
            <Field label="Początek"><input className="input" type="date" value={sem.startDate ?? ''} onChange={e => setSem({ ...sem, startDate: e.target.value })} /></Field>
            <Field label="Koniec"><input className="input" type="date" value={sem.endDate ?? ''} onChange={e => setSem({ ...sem, endDate: e.target.value })} /></Field>
          </div>
          {semesters.some(s => s.id === sem.id) && <button className="btn danger block" onClick={async () => {
            if (subjects.some(s => s.semesterId === sem.id)) return toast('Ten semestr ma przedmioty — usuń je najpierw')
            await remove('semesters', sem.id); setSem(null)
          }}>Usuń semestr</button>}
        </div>}
      </Sheet>
    </>
  )
}
