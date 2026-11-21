import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, type DocumentData } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import type { CalEvent, Semester, Settings, Subject, Task, Year } from './types'
import { fetchIcs, mapUsosEvent } from './ics'
import { PALETTE, nowLocal, subjectKey, uid } from './utils'

type Coll = 'years' | 'semesters' | 'subjects' | 'events' | 'tasks'

interface Data {
  years: Year[]
  semesters: Semester[]
  subjects: Subject[]
  events: CalEvent[]
  tasks: Task[]
  settings: Settings
  loaded: boolean
}

interface Store extends Data {
  user: User | null
  authReady: boolean
  login: () => Promise<void>
  logout: () => Promise<void>
  save: <T extends { id: string }>(c: Coll, item: Partial<T> & { id: string }) => Promise<void>
  remove: (c: Coll, id: string) => Promise<void>
  saveSettings: (s: Partial<Settings>) => Promise<void>
  sync: (opts?: { silent?: boolean }) => Promise<{ added: number; updated: number; subjects: number }>
  importData: (json: any) => Promise<string>
  exportData: () => object
  activeSemester?: Semester
  semesterSubjects: Subject[]
  subjectOf: (e: CalEvent) => Subject | undefined
  colorOf: (e: CalEvent) => string
  syncing: boolean
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

const empty: Data = { years: [], semesters: [], subjects: [], events: [], tasks: [], settings: {}, loaded: false }

function clean<T extends object>(o: T): DocumentData {
  // Firestore nie przyjmuje undefined
  return JSON.parse(JSON.stringify(o))
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [data, setData] = useState<Data>(empty)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true) }), [])

  useEffect(() => {
    if (!user) { setData(empty); return }
    const base = `users/${user.uid}`
    const pending = new Set<string>(['years', 'semesters', 'subjects', 'events', 'tasks', 'settings'])
    const done = (k: string) => { pending.delete(k); if (!pending.size) setData(d => ({ ...d, loaded: true })) }
    const unsubs = (['years', 'semesters', 'subjects', 'events', 'tasks'] as Coll[]).map(c =>
      onSnapshot(collection(db, base, c), snap => {
        const items = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        setData(d => ({ ...d, [c]: items }))
        done(c)
      }, err => { console.error(c, err); done(c) })
    )
    unsubs.push(onSnapshot(doc(db, base), snap => {
      setData(d => ({ ...d, settings: (snap.data()?.settings as Settings) ?? {} }))
      done('settings')
    }, err => { console.error('settings', err); done('settings') }))
    return () => unsubs.forEach(u => u())
  }, [user])

  const store = useMemo<Store>(() => {
    const base = () => `users/${auth.currentUser!.uid}`
    const activeSemester = data.semesters.find(s => s.id === data.settings.activeSemesterId) ?? data.semesters[0]
    const semesterSubjects = data.subjects
      .filter(s => s.semesterId === activeSemester?.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    const subjectOf = (e: CalEvent) =>
      data.subjects.find(s => s.key === e.subjectKey && s.semesterId === e.semesterId) ??
      data.subjects.find(s => s.key === e.subjectKey)
    const colorOf = (e: CalEvent) => e.color || subjectOf(e)?.color || '#8e8e93'

    const save: Store['save'] = async (c, item) => {
      const { id, ...rest } = item as any
      await setDoc(doc(db, base(), c, id), clean(rest), { merge: true })
    }
    const remove: Store['remove'] = async (c, id) => { await deleteDoc(doc(db, base(), c, id)) }
    const saveSettings: Store['saveSettings'] = async s => {
      await setDoc(doc(db, base()), { settings: clean(s) }, { merge: true })
    }

    const sync: Store['sync'] = async () => {
      const url = data.settings.icalUrl
      if (!url) throw new Error('Najpierw wklej link do planu iCal w Ustawieniach.')
      const semId = activeSemester?.id
      if (!semId) throw new Error('Najpierw dodaj rok i semestr w Ustawieniach.')
      setSyncing(true)
      try {
        const parsed = (await fetchIcs(url)).map(mapUsosEvent)
        const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = []
        const known = new Map(data.subjects.filter(s => s.semesterId === semId).map(s => [s.key, s]))
        let colorIdx = data.subjects.filter(s => s.semesterId === semId).length
        let newSubjects = 0, added = 0, updated = 0
        for (const p of parsed) {
          if (!known.has(p.data.subjectKey)) {
            const s: Subject = {
              id: uid(), semesterId: semId, key: p.data.subjectKey, name: p.subjectName,
              color: PALETTE[colorIdx++ % PALETTE.length], ects: null, components: {}, createdAt: Date.now()
            }
            known.set(s.key, s)
            newSubjects++
            ops.push(b => b.set(doc(db, base(), 'subjects', s.id), clean(s)))
          }
          const existing = data.events.find(e => e.id === p.id)
          if (existing) updated++; else added++
          const payload = existing ? p.data : { ...p.data, semesterId: semId }
          ops.push(b => b.set(doc(db, base(), 'events', p.id), clean(payload), { merge: true }))
        }
        // przyszłe zajęcia z USOS, których nie ma już w feedzie → odwołane
        const ids = new Set(parsed.map(p => p.id))
        const now = nowLocal()
        for (const e of data.events) {
          if (e.source === 'usos' && e.start > now && !ids.has(e.id) && !e.cancelled)
            ops.push(b => b.set(doc(db, base(), 'events', e.id), { cancelled: true }, { merge: true }))
        }
        for (let i = 0; i < ops.length; i += 400) {
          const b = writeBatch(db)
          ops.slice(i, i + 400).forEach(op => op(b))
          await b.commit()
        }
        await saveSettings({ lastSync: Date.now() })
        return { added, updated, subjects: newSubjects }
      } finally {
        setSyncing(false)
      }
    }

    const importData: Store['importData'] = async json => {
      // Inteligentny import: dopasowuje semestry (po numerze) i przedmioty (po nazwie) do już istniejących
      // i uzupełnia tylko puste pola — niczego, co już wpisałeś, nie nadpisuje.
      const isEmpty = (v: any) => v == null || v === '' || (Array.isArray(v) && !v.length) ||
        (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
      const fill = (target: any, src: any) => {
        const out: any = {}
        for (const [k, v] of Object.entries(src)) {
          if (k === 'id') continue
          const cur = target?.[k]
          if (k === 'components' && v && typeof v === 'object') {
            const comps: any = { ...(cur ?? {}) }
            for (const [t, c] of Object.entries(v as any)) {
              const merged: any = { ...(comps[t] ?? {}) }
              for (const [ck, cv] of Object.entries(c as any)) if (isEmpty(merged[ck])) merged[ck] = cv
              comps[t] = merged
            }
            out.components = comps
          } else if (isEmpty(cur)) out[k] = v
        }
        return out
      }
      const b = writeBatch(db)
      let created = 0, merged = 0
      const semMap = new Map<string, string>()
      const yearMap = new Map<string, string>()
      for (const s of json.semesters ?? []) {
        const ex = data.semesters.find(x => x.id === s.id || x.number === s.number)
        if (ex) {
          semMap.set(s.id, ex.id); yearMap.set(s.yearId, ex.yearId)
          const f = fill(ex, s); delete f.yearId
          if (Object.keys(f).length) { b.set(doc(db, base(), 'semesters', ex.id), clean(f), { merge: true }); merged++ }
        } else semMap.set(s.id, s.id)
      }
      for (const y of json.years ?? []) {
        const exId = yearMap.get(y.id) ?? data.years.find(x => x.id === y.id || x.order === y.order)?.id
        if (exId) {
          yearMap.set(y.id, exId)
          const ex = data.years.find(x => x.id === exId)
          const f = fill(ex, y)
          if (Object.keys(f).length) { b.set(doc(db, base(), 'years', exId), clean(f), { merge: true }); merged++ }
        } else {
          yearMap.set(y.id, y.id)
          const { id, ...rest } = y
          b.set(doc(db, base(), 'years', id), clean(rest)); created++
        }
      }
      for (const s of json.semesters ?? []) {
        if (data.semesters.some(x => x.id === semMap.get(s.id))) continue
        const { id, ...rest } = s
        b.set(doc(db, base(), 'semesters', id), clean({ ...rest, yearId: yearMap.get(s.yearId) ?? s.yearId })); created++
      }
      const subjMap = new Map<string, string>()
      for (const s0 of json.subjects ?? []) {
        const s = { key: subjectKey(s0.name), ...s0, semesterId: semMap.get(s0.semesterId) ?? s0.semesterId }
        const ex = data.subjects.find(x => x.id === s.id) ??
          data.subjects.find(x => x.semesterId === s.semesterId && x.key === s.key)
        if (ex) {
          subjMap.set(s0.id, ex.id)
          const f = fill(ex, s)
          if (Object.keys(f).length) { b.set(doc(db, base(), 'subjects', ex.id), clean(f), { merge: true }); merged++ }
        } else {
          subjMap.set(s0.id, s0.id)
          const { id, ...rest } = s
          b.set(doc(db, base(), 'subjects', id), clean({ createdAt: Date.now(), ...rest })); created++
        }
      }
      for (const e of json.events ?? []) {
        const { id, ...rest } = e
        b.set(doc(db, base(), 'events', id ?? uid()), clean({ ...rest, semesterId: semMap.get(rest.semesterId) ?? rest.semesterId }), { merge: true }); created++
      }
      for (const t of json.tasks ?? []) {
        if (data.tasks.some(x => x.id === t.id)) continue
        const { id, ...rest } = t
        b.set(doc(db, base(), 'tasks', id ?? uid()), clean({ done: false, createdAt: Date.now(), ...rest, subjectId: subjMap.get(rest.subjectId) ?? rest.subjectId ?? null })); created++
      }
      const st = data.settings
      const settings: Partial<Settings> = {}
      const js = json.settings ?? {}
      if (js.icalUrl && !st.icalUrl) settings.icalUrl = js.icalUrl
      if (js.profile) settings.profile = { ...js.profile, ...Object.fromEntries(Object.entries(st.profile ?? {}).filter(([, v]) => !isEmpty(v))) }
      if (json.activeSemesterId && !st.activeSemesterId) settings.activeSemesterId = semMap.get(json.activeSemesterId) ?? json.activeSemesterId
      if (Object.keys(settings).length) b.set(doc(db, base()), { settings: clean(settings) }, { merge: true })
      await b.commit()

      let examMsg = ''
      if (json.examNotes?.length) {
        let parsed: ReturnType<typeof mapUsosEvent>[] = []
        const url = st.icalUrl ?? js.icalUrl
        if (url) {
          try { parsed = (await fetchIcs(url)).map(mapUsosEvent) } catch (e) { console.warn(e) }
        }
        const semId = semMap.get(json.activeSemesterId) ?? activeSemester?.id
        const b2 = writeBatch(db)
        let matched = 0
        for (const x of json.examNotes) {
          const sameExam = (start: string, key: string) => key === x.subjectKey && start.startsWith(x.date) && (!x.time || start.slice(11, 16) === x.time)
          const hit = parsed.find(p => p.data.kind === 'exam' && sameExam(p.data.start, p.data.subjectKey))
          const existing = data.events.find(e => e.kind === 'exam' && sameExam(e.start, e.subjectKey))
          const userFields = fill(existing ?? {}, { note: x.note, examForm: x.examForm, attempt: x.attempt ?? 'I termin', examStatus: x.examStatus ?? 'todo' })
          if (hit) {
            b2.set(doc(db, base(), 'events', hit.id), clean({ ...hit.data, semesterId: existing?.semesterId ?? semId, ...userFields }), { merge: true })
            matched++
          } else if (existing) {
            b2.set(doc(db, base(), 'events', existing.id), clean(userFields), { merge: true }); matched++
          } else {
            const start = `${x.date}T${x.time ?? '09:00'}`
            b2.set(doc(db, base(), 'events', uid()), clean({
              source: 'manual', kind: 'exam', type: 'EGZ', semesterId: semId, subjectKey: x.subjectKey,
              title: x.title ?? x.subjectKey, start, end: start, ...userFields
            }))
          }
        }
        await b2.commit()
        examMsg = `, egzaminy: ${matched}/${json.examNotes.length} dopasowane`
      }
      return `Import: ${merged} uzupełnionych, ${created} nowych${examMsg}.`
    }

    const exportData = () => {
      const { loaded, ...rest } = data
      return { exportedAt: new Date().toISOString(), ...rest }
    }

    return {
      ...data, user, authReady, syncing, activeSemester, semesterSubjects, subjectOf, colorOf,
      save, remove, saveSettings, sync, importData, exportData,
      login: async () => {
        try { await signInWithPopup(auth, googleProvider) }
        catch (e: any) {
          if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment')
            await signInWithRedirect(auth, googleProvider)
          else throw e
        }
      },
      logout: () => signOut(auth)
    }
  }, [data, user, authReady, syncing])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}
