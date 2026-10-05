import { describe, expect, it } from 'vitest'
import { checkSuite, levels, simulate, type Run } from './index'

const last = (run: Run) => run.frames[run.frames.length - 1]
const metric = (run: Run, id: string) =>
  Number(last(run).metrics.find((item) => item.id === id)?.value)
const check = (run: Run, id: string) => run.checks.find((item) => item.id === id)!

describe('deterministic event contract', () => {
  for (const level of levels)
    for (const strategy of level.strategies)
      for (const scenario of level.scenarios) {
        it(`${level.id}/${scenario.id}/${strategy.id} has a stable, immutable replay`, () => {
          const run = simulate(level.id, scenario.id, strategy.id)
          const before = JSON.stringify(run)
          expect(simulate(level.id, scenario.id, strategy.id)).toEqual(run)
          expect(JSON.stringify(run)).toBe(before)
          expect(run.frames[0].id).toBe(0)
          expect(run.frames.length).toBeGreaterThan(3)
          expect(
            run.frames.every(
              (frame, i) => frame.id === i && (i === 0 || frame.time >= run.frames[i - 1].time),
            ),
          ).toBe(true)
          expect(run.passed).toBe(run.checks.every((item) => item.passed))
          expect(
            run.frames.every(
              (frame) => frame.event.label.en && frame.event.label.zh && frame.state,
            ),
          ).toBe(true)
          expect(() => JSON.parse(JSON.stringify(run))).not.toThrow()
        })
      }

  it('rejects unknown inputs instead of silently selecting a repair', () => {
    expect(() => simulate('search', 'missing', 'latest')).toThrow('Unknown scenario')
    expect(() => simulate('search', 'out-of-order', 'missing')).toThrow('Unknown strategy')
  })
})

describe('search response ownership', () => {
  it.each(['latest', 'latest-cancel'])('%s passes every declared fault schedule', (strategy) => {
    const suite = checkSuite('search', strategy)
    expect(suite.passed).toBe(true)
    expect(suite.passedCount).toBe(suite.total)
  })

  it('exposes an older response overwriting a newer answer', () => {
    const run = simulate('search', 'out-of-order', 'unguarded')
    expect(check(run, 'ownership').passed).toBe(false)
    expect(last(run).state?.query).toBe('banana')
    expect(last(run).state?.result).toMatchObject({ value: 'apple results' })
  })

  it('lets debounce pass rapid typing but falsifies it after a longer pause', () => {
    expect(simulate('search', 'out-of-order', 'debounce').passed).toBe(true)
    expect(simulate('search', 'debounce-pause', 'debounce').passed).toBe(false)
  })

  it('cancellation genuinely fixes network races without claiming to stop later independent work', () => {
    expect(simulate('search', 'out-of-order', 'cancel').passed).toBe(true)
    const late = simulate('search', 'post-processing', 'cancel')
    expect(late.passed).toBe(false)
    expect(
      late.frames.some((frame) => frame.event.label.en === 'Abort is too late for this work'),
    ).toBe(true)
    expect(last(late).state?.result).toMatchObject({ value: 'apple results' })
    expect(simulate('search', 'post-processing', 'latest-cancel').passed).toBe(true)
  })

  it('clearing input invalidates old callbacks even without a replacement request', () => {
    const bad = simulate('search', 'clear-input', 'unguarded')
    const good = simulate('search', 'clear-input', 'latest')
    expect(bad.passed).toBe(false)
    expect(good.passed).toBe(true)
    expect(last(good).state).toMatchObject({ query: '', result: null, error: null, loading: false })
  })

  it('a real current failure is visible and settles instead of disappearing', () => {
    const run = simulate('search', 'latest-failure', 'latest')
    expect(run.passed).toBe(true)
    expect(last(run).state?.error).toMatchObject({ generation: 2 })
    expect(last(run).state?.result).toBeNull()
    expect(last(run).state?.loading).toBe(false)
  })

  it('detects an incorrect loading transition even if the final screen recovers', () => {
    const bad = simulate('search', 'stale-cleanup', 'unguarded')
    expect(check(bad, 'outcome').passed).toBe(true)
    expect(check(bad, 'loading').passed).toBe(false)
    const earlyFailure = bad.frames.find(
      (frame) => frame.time === 180 && frame.state?.loading === false,
    )!
    expect(earlyFailure.state?.currentSettled).toBe(false)
    expect(simulate('search', 'stale-cleanup', 'latest').passed).toBe(true)
  })

  it('the same query with a new filter constitutes a distinct intent', () => {
    const run = simulate('search', 'same-query-filter', 'latest')
    expect(run.passed).toBe(true)
    expect(last(run).state?.result).toMatchObject({
      value: 'apple · computers results',
      generation: 2,
    })
  })
})

describe('retry, durability and progress', () => {
  it('durable atomic idempotency passes the full suite', () => {
    const suite = checkSuite('checkout', 'atomic')
    expect(suite.passed).toBe(true)
    expect(suite.passedCount).toBe(suite.total)
  })

  it('new attempt keys duplicate a committed order after a lost reply', () => {
    const run = simulate('checkout', 'lost-response', 'new-key')
    expect(metric(run, 'orders')).toBe(2)
    expect(check(run, 'at-most-once').passed).toBe(false)
    expect(
      run.frames.some(
        (frame) =>
          frame.event.label.en === 'Success reply lost' &&
          frame.state?.orders &&
          (frame.state.orders as unknown[]).length === 1,
      ),
    ).toBe(true)
  })

  it('returning only the second order still violates replay of the original committed result', () => {
    const run = simulate('checkout', 'lost-response', 'new-key')
    const state = last(run).state!
    expect(state.orders).toMatchObject([
      { id: 'O1', intent: 'purchase-1' },
      { id: 'O2', intent: 'purchase-1' },
    ])
    expect(state.intents).toMatchObject([{ receivedIds: ['O2'] }])
    expect(check(run, 'stable-result').passed).toBe(false)
    expect(check(simulate('checkout', 'lost-response', 'atomic'), 'stable-result').passed).toBe(
      true,
    )
  })

  it('never retrying fails progress when the first request never arrived', () => {
    const run = simulate('checkout', 'lost-request', 'no-retry')
    expect(metric(run, 'orders')).toBe(0)
    expect(check(run, 'at-most-once').passed).toBe(true)
    expect(check(run, 'recovery').passed).toBe(false)
    expect(simulate('checkout', 'lost-request', 'atomic').passed).toBe(true)
  })

  it('memory deduplication works until a process restart erases the keys', () => {
    expect(simulate('checkout', 'lost-response', 'memory').passed).toBe(true)
    const run = simulate('checkout', 'restart', 'memory')
    expect(metric(run, 'orders')).toBe(2)
    const crash = run.frames.find((frame) => frame.event.label.en === 'Service process crashes')!
    expect(crash.state?.memoryKeys).toEqual([])
    expect(crash.state?.orders).toHaveLength(1)
  })

  it('separate durable writes expose the order-without-key crash window', () => {
    const run = simulate('checkout', 'split-crash', 'split')
    const crash = run.frames.find((frame) => frame.event.label.en === 'Service process crashes')!
    expect(crash.state?.orders).toHaveLength(1)
    expect(crash.state?.durableKeys).toEqual([])
    expect(metric(run, 'orders')).toBe(2)
    expect(run.passed).toBe(false)
  })

  it('a committed atomic order and its replay result survive the same crash', () => {
    const run = simulate('checkout', 'split-crash', 'atomic')
    const crash = run.frames.find((frame) => frame.event.label.en === 'Service process crashes')!
    expect(crash.state?.orders).toHaveLength(1)
    expect(crash.state?.durableKeys).toHaveLength(1)
    expect(metric(run, 'orders')).toBe(1)
    expect(metric(run, 'replayed')).toBe(1)
    expect(run.passed).toBe(true)
  })

  it('pre-commit crashes leave neither an order nor a replay record', () => {
    const run = simulate('checkout', 'before-commit', 'atomic')
    const crash = run.frames.find((frame) => frame.event.label.en === 'Service process crashes')!
    expect(crash.state?.orders).toEqual([])
    expect(crash.state?.durableKeys).toEqual([])
    expect(crash.state?.claims).toEqual([])
    expect(metric(run, 'orders')).toBe(1)
    expect(run.passed).toBe(true)
  })

  it('check-then-write races while a unique in-flight claim prevents a second writer', () => {
    expect(metric(simulate('checkout', 'parallel', 'split'), 'orders')).toBe(2)
    const run = simulate('checkout', 'parallel', 'atomic')
    expect(metric(run, 'orders')).toBe(1)
    expect(
      run.frames.some((frame) => frame.event.label.en === 'Duplicate attempt is still in progress'),
    ).toBe(true)
    expect(run.passed).toBe(true)
  })

  it('identical cart contents in two legitimate intents produce two orders', () => {
    const run = simulate('checkout', 'new-purchase', 'atomic')
    expect(metric(run, 'orders')).toBe(2)
    expect(metric(run, 'intents')).toBe(2)
    expect(run.passed).toBe(true)
  })

  it('rejects a reused key with changed parameters instead of replaying the wrong purchase', () => {
    const run = simulate('checkout', 'changed-payload', 'atomic')
    expect(metric(run, 'orders')).toBe(1)
    expect(last(run).state?.mismatchesRejected).toBe(1)
    expect(last(run).state?.mismatchesAccepted).toBe(0)
    expect(run.passed).toBe(true)
  })

  it('every incomplete repair has a concrete failing counterexample', () => {
    for (const strategy of ['new-key', 'no-retry', 'memory', 'split']) {
      expect(checkSuite('checkout', strategy).passed).toBe(false)
    }
  })
})
