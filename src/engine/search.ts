import { Scheduler } from './scheduler'
import { t, type Check, type Frame, type Run, type Text, type Tone } from './types'

interface Input {
  at: number
  query: string
  filter?: string
  network: number
  transform?: number
  fails?: boolean
}
const cases: Record<string, Input[]> = {
  'out-of-order': [
    { at: 0, query: 'apple', network: 760 },
    { at: 100, query: 'banana', network: 120 },
  ],
  'debounce-pause': [
    { at: 0, query: 'apple', network: 800 },
    { at: 400, query: 'banana', network: 100 },
  ],
  'post-processing': [
    { at: 0, query: 'apple', network: 20, transform: 650 },
    { at: 120, query: 'banana', network: 100 },
  ],
  'stale-error': [
    { at: 0, query: 'apple', network: 750, fails: true },
    { at: 100, query: 'banana', network: 120 },
  ],
  'stale-cleanup': [
    { at: 0, query: 'apple', network: 180, fails: true },
    { at: 100, query: 'banana', network: 600 },
  ],
  'clear-input': [
    { at: 0, query: 'apple', network: 600 },
    { at: 250, query: '', network: 0 },
  ],
  'latest-failure': [
    { at: 0, query: 'apple', network: 700 },
    { at: 100, query: 'banana', network: 120, fails: true },
  ],
  'same-query-filter': [
    { at: 0, query: 'apple', filter: 'fruit', network: 700 },
    { at: 100, query: 'apple', filter: 'computers', network: 100 },
  ],
}
type Phase = 'network' | 'body' | 'transform' | 'complete' | 'failed' | 'cancelled' | 'ignored'
interface Request {
  id: string
  generation: number
  input: Input
  phase: Phase
  aborted: boolean
}
const phaseLabel: Record<Phase, Text> = {
  network: t('In flight', '传输中'),
  body: t('Reading body', '读取响应体'),
  transform: t('Transforming', '独立转换中'),
  complete: t('Rendered', '已更新页面'),
  failed: t('Failed', '已失败'),
  cancelled: t('Cancelled', '已取消'),
  ignored: t('Ignored', '已忽略'),
}

export function simulateSearch(scenarioId: string, strategyId: string): Run {
  const inputs = cases[scenarioId]
  if (!inputs) throw new Error(`Unknown search scenario: ${scenarioId}`)
  const clock = new Scheduler()
  const frames: Frame[] = []
  const requests: Request[] = []
  const guarded = strategyId === 'latest' || strategyId === 'latest-cancel'
  const cancellable = strategyId === 'cancel' || strategyId === 'latest-cancel'
  let generation = 0
  let active: Input = { at: 0, query: '', network: 0 }
  let loading = false
  let result: { generation: number; value: string } | null = null
  let error: { generation: number; value: string } | null = null
  let currentSettled = true
  let staleWrites = 0
  let loadingViolations = 0
  let ignored = 0
  let cancelled = 0
  const queryLabel = (input: Input) => input.query + (input.filter ? ` · ${input.filter}` : '')

  function emit(label: Text, detail: Text, tone: Tone = 'neutral') {
    frames.push({
      id: frames.length,
      time: clock.now,
      event: { label, detail, tone },
      actors: [
        {
          id: 'intent',
          label: t('Current intent', '当前意图'),
          value: t(queryLabel(active) || '(empty)', queryLabel(active) || '（空）'),
          detail: t(`Generation ${generation}`, `意图版本 ${generation}`),
          tone: 'info',
        },
        {
          id: 'screen',
          label: t('Visible result', '页面结果'),
          value: t(result?.value ?? '—', result?.value ?? '—'),
          detail: result
            ? t(`From generation ${result.generation}`, `来自版本 ${result.generation}`)
            : t('No result displayed', '尚无显示结果'),
          tone:
            result && result.generation !== generation ? 'danger' : result ? 'success' : 'neutral',
        },
        {
          id: 'status',
          label: t('UI status', '界面状态'),
          value: error
            ? t(error.value, error.value.replace('Search failed:', '搜索失败：'))
            : loading
              ? t('Loading', '加载中')
              : t('Idle', '空闲'),
          detail: error
            ? t(
                `Error belongs to generation ${error.generation}`,
                `错误来自版本 ${error.generation}`,
              )
            : t('Results, errors and loading share ownership', '结果、错误与加载状态都需要所有权'),
          tone: error ? 'danger' : loading ? 'warning' : 'neutral',
        },
      ],
      metrics: [
        { id: 'sent', label: t('Requests sent', '已发请求'), value: String(requests.length) },
        {
          id: 'stale-writes',
          label: t('Stale UI writes', '过期界面写入'),
          value: String(staleWrites),
        },
        { id: 'cancelled', label: t('Cancelled', '已取消'), value: String(cancelled) },
        { id: 'ignored', label: t('Ignored results', '已忽略结果'), value: String(ignored) },
      ],
      requests: requests.map((request) => ({
        id: request.id,
        label: t(
          `${request.id} · ${queryLabel(request.input)}`,
          `${request.id} · ${queryLabel(request.input)}`,
        ),
        status: phaseLabel[request.phase],
        detail: t(
          `Intent ${request.generation}${request.aborted ? ' · signal aborted' : ''}`,
          `意图 ${request.generation}${request.aborted ? ' · 已发出取消信号' : ''}`,
        ),
        tone:
          request.phase === 'failed'
            ? 'danger'
            : request.phase === 'complete'
              ? 'success'
              : request.phase === 'ignored' || request.phase === 'cancelled'
                ? 'neutral'
                : 'info',
      })),
      state: {
        generation,
        query: active.query,
        filter: active.filter ?? null,
        loading,
        result: result ? { ...result } : null,
        error: error ? { ...error } : null,
        currentSettled,
        staleWrites,
        loadingViolations,
      },
    })
  }

  function finish(request: Request, failed: boolean) {
    const current = request.generation === generation
    if (guarded && !current) {
      request.phase = 'ignored'
      ignored++
      emit(
        t('Stale callback ignored', '忽略过期回调'),
        t(
          `${request.id} has generation ${request.generation}; only ${generation} may write.`,
          `${request.id} 属于版本 ${request.generation}，只有版本 ${generation} 可以更新界面。`,
        ),
        'success',
      )
      return
    }
    if (!current) staleWrites++
    if (failed) {
      request.phase = 'failed'
      error = {
        generation: request.generation,
        value: `Search failed: ${queryLabel(request.input)}`,
      }
      result = null
    } else {
      request.phase = 'complete'
      result = { generation: request.generation, value: `${queryLabel(request.input)} results` }
      error = null
    }
    if (current) currentSettled = true
    // This is the simulated finally block. Guarding success alone is insufficient.
    loading = false
    if (!currentSettled) loadingViolations++
    emit(
      failed
        ? t('Failure reaches the screen', '错误更新页面')
        : t('Response writes to the screen', '响应更新页面'),
      t(
        `${request.id} ${current ? 'owns' : 'does not own'} the current intent.`,
        `${request.id}${current ? '拥有' : '不拥有'}当前意图的界面更新权。`,
      ),
      current ? (failed ? 'warning' : 'success') : 'danger',
    )
  }

  function send(input: Input, ownGeneration: number) {
    if (ownGeneration !== generation || !input.query) return
    const request: Request = {
      id: `R${requests.length + 1}`,
      generation: ownGeneration,
      input,
      phase: 'network',
      aborted: false,
    }
    requests.push(request)
    emit(
      t('Search sent', '搜索已发出'),
      t(
        `${request.id} asks for ${queryLabel(input)}.`,
        `${request.id} 请求 ${queryLabel(input)}。`,
      ),
      'info',
    )
    clock.after(input.network, () => {
      if (request.phase === 'cancelled') return
      if (input.fails) {
        finish(request, true)
        return
      }
      request.phase = 'body'
      emit(
        t('Response headers received', '收到响应头'),
        t(
          `${request.id}: fetch has resolved; reading the body is still cancellable.`,
          `${request.id}：fetch 已返回，响应体读取仍可取消。`,
        ),
        'info',
      )
      clock.after(20, () => {
        if (request.phase === 'cancelled') return
        request.phase = 'transform'
        emit(
          t('Body read; transform starts', '响应体读完，开始独立转换'),
          t(
            `${request.id} now runs an independent async transform that does not accept an AbortSignal.`,
            `${request.id} 开始不接收 AbortSignal 的独立异步转换。`,
          ),
          'info',
        )
        clock.after(input.transform ?? 0, () => finish(request, false))
      })
    })
  }

  emit(
    t('Ready to replay', '准备回放'),
    t(
      'The schedule is fixed. Step through it or replay with another repair.',
      '故障日程固定。可以单步检查，也可以更换策略重放。',
    ),
    'info',
  )
  inputs.forEach((input) =>
    clock.at(input.at, () => {
      generation++
      active = input
      result = null
      error = null
      loading = Boolean(input.query)
      currentSettled = !input.query
      emit(
        input.query ? t('User intent changed', '用户意图变化') : t('Search cleared', '清空搜索'),
        t(
          `New generation: ${generation}. Earlier callbacks no longer own this screen.`,
          `新版本：${generation}。先前回调不再拥有这个页面。`,
        ),
        'info',
      )
      if (cancellable) {
        for (const old of requests) {
          if (
            old.generation === generation ||
            old.aborted ||
            ['complete', 'failed', 'ignored', 'cancelled'].includes(old.phase)
          )
            continue
          old.aborted = true
          if (old.phase === 'network' || old.phase === 'body') {
            old.phase = 'cancelled'
            cancelled++
            // AbortError is handled as cancellation, not a user-facing failure.
            emit(
              t('Previous fetch cancelled', '已取消旧 fetch'),
              t(
                `${old.id} stops before independent transformation. Its AbortError is handled.`,
                `${old.id} 在独立转换前停止，AbortError 已作为取消处理。`,
              ),
              'success',
            )
          } else {
            emit(
              t('Abort is too late for this work', '这项工作已无法用 abort 取消'),
              t(
                `${old.id} already finished fetch and body reading. The independent transform continues.`,
                `${old.id} 的 fetch 与响应体读取已经完成，独立转换继续。`,
              ),
              'warning',
            )
          }
        }
      }
      if (input.query) {
        const mine = generation
        if (strategyId === 'debounce') {
          emit(
            t('Debounce timer started', '启动防抖计时'),
            t(
              'Only an unchanged intent will dispatch in 200 ms.',
              '只有意图在 200 毫秒后仍未变化，才会发出请求。',
            ),
            'neutral',
          )
          clock.after(200, () => send(input, mine))
        } else send(input, mine)
      }
    }),
  )
  clock.run()
  const finalInput = inputs[inputs.length - 1]
  const finalCorrect =
    finalInput.query === ''
      ? result === null && error === null
      : finalInput.fails
        ? error !== null &&
          (error as { generation: number }).generation === generation &&
          result === null
        : result !== null &&
          (result as { generation: number }).generation === generation &&
          error === null
  const checks: Check[] = [
    {
      id: 'ownership',
      label: t('No stale UI writes', '没有过期界面写入'),
      passed: staleWrites === 0,
      detail: t(
        `${staleWrites} obsolete callback(s) changed current results or errors.`,
        `${staleWrites} 个过期回调改变了当前结果或错误。`,
      ),
    },
    {
      id: 'loading',
      label: t('Loading belongs to current intent', '加载状态属于当前意图'),
      passed: loadingViolations === 0,
      detail: t(
        `${loadingViolations} old cleanup(s) ended loading while the current intent was unfinished.`,
        `${loadingViolations} 次旧清理在当前意图未完成时结束了加载。`,
      ),
    },
    {
      id: 'outcome',
      label: t('Latest outcome is visible', '显示最新意图的结果'),
      passed: finalCorrect,
      detail: t(
        'After all events, show the current result, current error, or the intentionally empty screen.',
        '所有事件结束后，应显示当前结果、当前错误或按意图保持空白。',
      ),
    },
    {
      id: 'completion',
      label: t('The UI eventually settles', '界面最终结束等待'),
      passed: currentSettled && !loading,
      detail: t(
        'Ignoring every result or leaving a permanent spinner does not pass.',
        '忽略所有结果或让加载一直持续，不能通过。',
      ),
    },
  ]
  const passed = checks.every((check) => check.passed)
  emit(
    passed ? t('Scenario passed', '场景通过') : t('Counterexample found', '发现反例'),
    passed
      ? t(
          'The observed state satisfies every check in this schedule.',
          '这次日程中的实际状态满足全部检查。',
        )
      : t(
          'Follow the red event back to the callback that still had write access.',
          '沿红色事件回看，是哪个回调仍然能够更新页面。',
        ),
    passed ? 'success' : 'danger',
  )
  return {
    levelId: 'search',
    scenarioId,
    strategyId,
    frames,
    checks,
    passed,
    summary: passed
      ? t(
          'This schedule is repaired. Run the full suite before drawing a broader conclusion.',
          '本次日程已修复；请运行完整场景集，再得出更广泛的结论。',
        )
      : t(
          'A stale callback or an incorrect final state remains. Inspect the timeline and try another repair.',
          '仍存在过期回调或错误的最终状态。检查时间线，再尝试其他修复。',
        ),
  }
}
