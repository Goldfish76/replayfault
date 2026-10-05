import { describe, it, expect } from 'vitest'
import { makeShare, parseShare } from './session'

describe('versioned share links', () => {
  it('round trips a reproducible lab configuration', () => {
    const state = {
      level: 'search',
      scenario: 'late-response',
      strategy: 'generation',
      step: 4,
      lang: 'zh' as const,
    }
    expect(parseShare(makeShare(state))).toEqual(state)
  })
  it('rejects unsupported versions and oversized input', () => {
    expect(parseShare('#lab?v=2&level=search')).toBeNull()
    expect(parseShare('#lab?' + 'a'.repeat(3000))).toBeNull()
  })
  it('sanitizes invalid IDs and nonfinite frame indices', () => {
    expect(parseShare('#lab?v=1&level=%3Cscript%3E&step=Infinity')?.level).toBeUndefined()
    expect(parseShare('#lab?v=1&step=-10')?.step).toBe(0)
    expect(parseShare('#lab?v=1&step=Infinity')?.step).toBe(0)
  })
})
