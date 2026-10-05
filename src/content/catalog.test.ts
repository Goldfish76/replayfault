import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { getText, lessonContent } from './catalog'

describe('teaching content contract', () => {
  for (const lesson of Object.values(lessonContent)) {
    it(`${lesson.id} provides three ordered bilingual hints and source-backed boundaries`, () => {
      expect(lesson.hints).toHaveLength(3)
      expect(lesson.sources.length).toBeGreaterThanOrEqual(2)
      expect(lesson.assumptions.length).toBeGreaterThanOrEqual(2)
      expect(lesson.limits.length).toBeGreaterThanOrEqual(2)
      expect(lesson.sources.every((source) => new URL(source.url).protocol === 'https:')).toBe(true)

      const prose = [
        lesson.title,
        lesson.summary,
        lesson.goal,
        ...lesson.hints.flatMap(({ title, body }) => [title, body]),
        lesson.debrief.headline,
        lesson.debrief.body,
        ...lesson.debrief.steps,
        ...lesson.pitfalls.flatMap(({ title, wrongFix, why, betterFix }) => [
          title,
          wrongFix,
          why,
          betterFix,
        ]),
        ...lesson.assumptions,
        ...lesson.limits,
        ...lesson.sources.map(({ label }) => label),
        lesson.reproduction.description,
        lesson.reproduction.run,
        lesson.reproduction.readme,
      ]
      for (const entry of prose) {
        expect(getText(entry, 'en').trim().length).toBeGreaterThan(0)
        expect(getText(entry, 'zh').trim().length).toBeGreaterThan(0)
      }
    })

    it(`${lesson.id} downloadable reproduction actually runs in Node and passes its bug/fix assertions`, () => {
      const result = spawnSync(process.execPath, ['--input-type=module'], {
        input: lesson.reproduction.source,
        encoding: 'utf8',
        timeout: 10_000,
      })
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('PASS:')
      expect(result.stdout).toContain('通过：')
    })
  }
})
