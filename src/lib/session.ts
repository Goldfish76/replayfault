export type Language = 'en' | 'zh'
export type LabState = {
  level: string
  scenario: string
  strategy: string
  step: number
  lang: Language
}
const KEY = 'replayfault:v1'

export function readPreferences(): { lang: Language; solved: string[] } {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '{}')
    return {
      lang: data.lang === 'zh' ? 'zh' : 'en',
      solved: Array.isArray(data.solved)
        ? data.solved.filter((x: unknown) => x === 'search' || x === 'checkout')
        : [],
    }
  } catch {
    return { lang: 'en', solved: [] }
  }
}

export function savePreferences(lang: Language, solved: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lang, solved }))
  } catch {
    /* Local persistence is optional. */
  }
}

export function parseShare(hash: string): Partial<LabState> | null {
  if (!hash.startsWith('#lab?') || hash.length > 2048) return null
  const p = new URLSearchParams(hash.slice(5))
  if (p.get('v') !== '1') return null
  const identifier = (key: string) =>
    /^[a-z0-9-]{1,64}$/.test(p.get(key) || '') ? p.get(key)! : undefined
  const rawStep = Number(p.get('step') || '0')
  return {
    level: identifier('level'),
    scenario: identifier('scenario'),
    strategy: identifier('strategy'),
    step: Number.isSafeInteger(rawStep) ? Math.max(0, Math.min(10000, rawStep)) : 0,
    lang: p.get('lang') === 'zh' ? 'zh' : 'en',
  }
}

export function makeShare(state: LabState): string {
  return (
    '#lab?' +
    new URLSearchParams({
      v: '1',
      level: state.level,
      scenario: state.scenario,
      strategy: state.strategy,
      step: String(state.step),
      lang: state.lang,
    }).toString()
  )
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
