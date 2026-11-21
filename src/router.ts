import { useEffect, useState } from 'react'

let navCount = 0
export function useRoute(): string[] {
  const get = () => (location.hash.replace(/^#\/?/, '') || 'today').split('/').filter(Boolean)
  const [r, setR] = useState(get)
  useEffect(() => {
    const on = () => { navCount++; setR(get()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
export const go = (path: string) => { location.hash = '/' + path }
export const back = (fallback: string) => { if (navCount > 0) history.back(); else go(fallback) }
