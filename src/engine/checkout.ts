import { Scheduler } from './scheduler'
import { t, type Check, type Frame, type Run, type Text, type Tone } from './types'

interface Intent {
  id: string
  amount: number
  confirmed: boolean
  receivedIds: string[]
  attempts: number
}
interface Order {
  id: string
  intent: string
  key: string
  amount: number
}
interface RecordEntry {
  fingerprint: string
  orderId: string
}
interface Attempt {
  id: string
  intent: Intent
  amount: number
  key: string
  status: string
  probe: boolean
}
const scenarioIds = [
  'lost-response',
  'parallel',
  'restart',
  'split-crash',
  'lost-request',
  'new-purchase',
  'changed-payload',
  'before-commit',
]

export function simulateCheckout(scenarioId: string, strategyId: string): Run {
  if (!scenarioIds.includes(scenarioId)) throw new Error(`Unknown checkout scenario: ${scenarioId}`)
  const clock = new Scheduler()
  const frames: Frame[] = []
  const intents: Intent[] = [
    { id: 'purchase-1', amount: 29, confirmed: false, receivedIds: [], attempts: 0 },
  ]
  const orders: Order[] = []
  const attempts: Attempt[] = []
  const durableKeys = new Map<string, RecordEntry>()
  const memoryKeys = new Map<string, RecordEntry>()
  // Claims represent in-flight coordination. Atomic claims model a unique key
  // constraint inside the transaction; memory claims only coordinate one process.
  const claims = new Map<string, string>()
  const atomic = strategyId === 'atomic' || strategyId === 'new-key'
  const inMemory = strategyId === 'memory'
  const split = strategyId === 'split'
  const deduplicates = atomic || inMemory || split
  let online = true
  let incarnation = 1
  let replayed = 0
  let mismatchesRejected = 0
  let mismatchesAccepted = 0
  let uniqueViolationObserved = false
  let lastAction = t('Waiting for purchase', '等待购买')
  const keyScope = 'buyer-1:create-order:'
  const fingerprint = (amount: number) => `sku:headphones|quantity:1|amount:${amount}`
  const storedKeys = () => (inMemory ? memoryKeys : durableKeys)
  const pendingStatuses = ['in-flight', 'processing', 'order-saved']

  function emit(label: Text, detail: Text, tone: Tone = 'neutral') {
    const duplicateCount = intents.reduce(
      (total, intent) =>
        total + Math.max(0, orders.filter((order) => order.intent === intent.id).length - 1),
      0,
    )
    if (duplicateCount) uniqueViolationObserved = true
    frames.push({
      id: frames.length,
      time: clock.now,
      event: { label, detail, tone },
      actors: [
        {
          id: 'client',
          label: t('Buyer', '买家'),
          value: t(
            `${intents.filter((intent) => intent.confirmed).length}/${intents.length} confirmed`,
            `已确认 ${intents.filter((intent) => intent.confirmed).length}/${intents.length} 次购买`,
          ),
          detail: lastAction,
          tone: intents.every((intent) => intent.confirmed) ? 'success' : 'warning',
        },
        {
          id: 'service',
          label: t('Order service', '订单服务'),
          value: online
            ? t(`Online · process ${incarnation}`, `在线 · 进程 ${incarnation}`)
            : t('Restarting', '重启中'),
          detail: t(
            `${memoryKeys.size} memory keys · ${claims.size} in-flight claims`,
            `${memoryKeys.size} 个内存键 · ${claims.size} 个处理中的占位`,
          ),
          tone: online ? 'info' : 'danger',
        },
        {
          id: 'database',
          label: t('Durable database', '持久化数据库'),
          value: t(
            `${orders.length} order${orders.length === 1 ? '' : 's'}`,
            `${orders.length} 张订单`,
          ),
          detail: t(
            `${durableKeys.size} committed replay record(s) · ${orders.map((order) => order.id).join(', ') || 'empty'}`,
            `${durableKeys.size} 条已提交重放记录 · ${orders.map((order) => order.id).join('、') || '空'}`,
          ),
          tone: duplicateCount ? 'danger' : orders.length ? 'success' : 'neutral',
        },
      ],
      metrics: [
        { id: 'intents', label: t('Purchase intents', '购买意图'), value: String(intents.length) },
        { id: 'attempts', label: t('HTTP attempts', 'HTTP 尝试'), value: String(attempts.length) },
        { id: 'orders', label: t('Orders saved', '已保存订单'), value: String(orders.length) },
        { id: 'duplicates', label: t('Extra orders', '多余订单'), value: String(duplicateCount) },
        { id: 'replayed', label: t('Results replayed', '结果重放'), value: String(replayed) },
      ],
      requests: attempts.map((attempt) => ({
        id: attempt.id,
        label: t(`${attempt.id} · ${attempt.intent.id}`, `${attempt.id} · ${attempt.intent.id}`),
        status: statusLabel(attempt.status),
        detail: t(
          `key=${attempt.key} · $${attempt.amount}`,
          `key=${attempt.key} · $${attempt.amount}`,
        ),
        tone: ['lost-request', 'lost-reply', 'interrupted', 'rejected'].includes(attempt.status)
          ? 'warning'
          : ['confirmed', 'replayed'].includes(attempt.status)
            ? 'success'
            : 'info',
      })),
      state: {
        online,
        incarnation,
        orders: orders.map((order) => ({ ...order })),
        durableKeys: [...durableKeys].map(([key, entry]) => ({ key, ...entry })),
        memoryKeys: [...memoryKeys].map(([key, entry]) => ({ key, ...entry })),
        claims: [...claims.keys()],
        intents: intents.map((intent) => ({ ...intent, receivedIds: [...intent.receivedIds] })),
        replayed,
        mismatchesRejected,
        mismatchesAccepted,
      },
    })
  }

  function reply(attempt: Attempt, orderId: string, replay: boolean, owner: number) {
    clock.after(20, () => {
      if (!online || owner !== incarnation) return
      const loseReply =
        ['lost-response', 'restart', 'split-crash'].includes(scenarioId) && attempt.id === 'A1'
      if (loseReply) {
        attempt.status = 'lost-reply'
        lastAction = t('Still waiting: the server outcome is unknown', '仍在等待：服务端结果未知')
        emit(
          t('Success reply lost', '成功回复丢失'),
          t(
            `Order ${orderId} exists, but the buyer has not received its result.`,
            `订单 ${orderId} 已存在，但买家尚未收到结果。`,
          ),
          'warning',
        )
        return
      }
      attempt.status = replay ? 'replayed' : 'confirmed'
      if (attempt.probe) mismatchesAccepted++
      else {
        attempt.intent.confirmed = true
        attempt.intent.receivedIds.push(orderId)
      }
      lastAction = t(
        `Received ${orderId}${replay ? ' again' : ''}`,
        `收到订单 ${orderId}${replay ? ' 的重放结果' : ''}`,
      )
      emit(
        replay
          ? t('Original result replayed', '重放原始结果')
          : t('Buyer receives confirmation', '买家收到确认'),
        t(
          `${attempt.id} returns order ${orderId}. ${attempt.probe ? 'Changed payload was incorrectly accepted.' : 'The client now knows the outcome.'}`,
          `${attempt.id} 返回订单 ${orderId}。${attempt.probe ? '更改后的参数被错误接受。' : '客户端现在知道结果了。'}`,
        ),
        attempt.probe ? 'danger' : 'success',
      )
    })
  }

  function receive(attempt: Attempt) {
    if (!online) {
      attempt.status = 'interrupted'
      emit(
        t('Service unavailable', '服务暂不可用'),
        t(
          `${attempt.id} did not execute; retry can recover after restart.`,
          `${attempt.id} 没有执行，重启后重试可以恢复。`,
        ),
        'warning',
      )
      return
    }
    const owner = incarnation
    attempt.status = 'processing'
    emit(
      t('Request reaches service', '请求抵达服务'),
      t(
        `${attempt.id} presents ${attempt.key}. The server checks its own state.`,
        `${attempt.id} 携带 ${attempt.key}，服务器检查自己的状态。`,
      ),
      'info',
    )
    const previous = deduplicates ? storedKeys().get(attempt.key) : undefined
    if (previous) {
      if (previous.fingerprint !== fingerprint(attempt.amount)) {
        attempt.status = 'rejected'
        if (attempt.probe) mismatchesRejected++
        emit(
          t('Same key, different payload rejected', '拒绝同键不同参数'),
          t(
            'The stored cart fingerprint differs. No new order is written.',
            '已存购物车指纹不同；不写入新订单。',
          ),
          'success',
        )
        return
      }
      replayed++
      reply(attempt, previous.orderId, true, owner)
      return
    }
    if ((atomic || inMemory) && claims.has(attempt.key)) {
      attempt.status = 'in-progress'
      emit(
        t('Duplicate attempt is still in progress', '重复尝试仍在处理中'),
        t(
          'The unique claim prevents a second writer. The caller may retry later.',
          '已有占位阻止第二个写入者，调用方可以稍后重试。',
        ),
        'success',
      )
      return
    }
    if (atomic || inMemory) claims.set(attempt.key, attempt.id)
    emit(
      atomic
        ? t('Transaction stages the order and result', '事务暂存订单和结果')
        : t('Order write scheduled', '准备写入订单'),
      atomic
        ? t(
            'The unique key is claimed; neither order nor replay result is committed yet.',
            '唯一键已被占用，订单和重放结果都尚未提交。',
          )
        : t(
            'No durable effect until the upcoming order write.',
            '即将写入订单；当前尚无持久化效果。',
          ),
      'neutral',
    )
    clock.after(60, () => {
      if (!online || owner !== incarnation) return
      const order: Order = {
        id: `O${orders.length + 1}`,
        intent: attempt.intent.id,
        key: attempt.key,
        amount: attempt.amount,
      }
      const record: RecordEntry = { fingerprint: fingerprint(attempt.amount), orderId: order.id }
      orders.push(order)
      if (atomic) {
        durableKeys.set(attempt.key, record)
        claims.delete(attempt.key)
        emit(
          t('Atomic commit', '原子提交'),
          t(
            `${order.id} and its replay result become durable together.`,
            `${order.id} 与其重放结果一起持久化。`,
          ),
          'success',
        )
        reply(attempt, order.id, false, owner)
      } else if (inMemory) {
        memoryKeys.set(attempt.key, record)
        claims.delete(attempt.key)
        emit(
          t('Order saved; key only in memory', '订单已保存，键只在内存中'),
          t(
            `${order.id} survives restart. Its deduplication record does not.`,
            `${order.id} 可以在重启后保留，其去重记录却不能。`,
          ),
          'warning',
        )
        reply(attempt, order.id, false, owner)
      } else if (split) {
        attempt.status = 'order-saved'
        emit(
          t('Order committed without replay record', '订单已提交，但缺少重放记录'),
          t(
            `${order.id} is durable. Its key will be written in a separate commit 140 ms later.`,
            `${order.id} 已持久化，键将在 140 毫秒后独立提交。`,
          ),
          'warning',
        )
        clock.after(140, () => {
          if (!online || owner !== incarnation) return
          durableKeys.set(attempt.key, record)
          emit(
            t('Separate replay record committed', '独立提交重放记录'),
            t(
              `The crash window closes for ${order.id}, but concurrent writers may already have passed the earlier check.`,
              `${order.id} 的崩溃窗口关闭，但并发写入者可能早已通过之前的检查。`,
            ),
            'info',
          )
          reply(attempt, order.id, false, owner)
        })
      } else {
        emit(
          t('Order saved without deduplication', '未去重就保存订单'),
          t(
            `${order.id} exists. Another attempt can create another order.`,
            `${order.id} 已存在，另一次尝试可能创建新订单。`,
          ),
          'warning',
        )
        reply(attempt, order.id, false, owner)
      }
    })
  }

  function send(intent: Intent, probe = false, amount = intent.amount) {
    if (!probe) intent.attempts++
    const attempt: Attempt = {
      id: `A${attempts.length + 1}`,
      intent,
      amount,
      probe,
      status: 'in-flight',
      key: keyScope + (strategyId === 'new-key' ? `attempt-${attempts.length + 1}` : intent.id),
    }
    attempts.push(attempt)
    lastAction = probe
      ? t('Testing changed parameters with the same intent key', '用相同意图键测试更改后的参数')
      : t(`Sending ${attempt.id} for ${intent.id}`, `为 ${intent.id} 发送 ${attempt.id}`)
    emit(
      probe
        ? t('Changed cart submitted', '提交更改后的购物车')
        : t('Purchase attempt sent', '购买尝试已发出'),
      t(
        `${attempt.id}: one business intent is distinct from each HTTP attempt.`,
        `${attempt.id}：业务意图与每次 HTTP 尝试是不同概念。`,
      ),
      'info',
    )
    clock.after(20, () => {
      if (scenarioId === 'lost-request' && attempt.id === 'A1') {
        attempt.status = 'lost-request'
        emit(
          t('Request lost before arrival', '请求抵达前丢失'),
          t(
            'The server never saw this request. No order was created.',
            '服务器从未收到这个请求，没有创建订单。',
          ),
          'warning',
        )
      } else receive(attempt)
    })
    if (!probe)
      clock.after(350, () => {
        if (intent.confirmed) return
        lastAction = t('Timeout: outcome unknown', '超时：结果未知')
        emit(
          t('Client deadline expires', '客户端等待超时'),
          t(
            'Timeout does not reveal whether an order committed.',
            '超时无法说明订单是否已经提交。',
          ),
          'warning',
        )
        if (strategyId !== 'no-retry' && intent.attempts < 3) send(intent)
        else
          emit(
            t('No further attempt', '不再尝试'),
            t('The buyer still has no confirmed outcome.', '买家仍没有得到已确认的结果。'),
            'danger',
          )
      })
  }

  function crash(at: number, recover: number) {
    clock.at(at, () => {
      online = false
      incarnation++
      memoryKeys.clear()
      claims.clear()
      for (const attempt of attempts)
        if (pendingStatuses.includes(attempt.status)) attempt.status = 'interrupted'
      emit(
        t('Service process crashes', '服务进程崩溃'),
        t(
          `Volatile keys and staged work disappear. ${orders.length} committed order(s) remain.`,
          `易失的键和暂存工作消失，${orders.length} 张已提交订单保留。`,
        ),
        'danger',
      )
    })
    clock.at(recover, () => {
      online = true
      emit(
        t('Service restarts', '服务重新启动'),
        t(
          'Committed database state survives. Process memory starts empty.',
          '已提交数据库状态保留，进程内存从空开始。',
        ),
        'info',
      )
    })
  }

  emit(
    t('Ready to replay', '准备回放'),
    t(
      'No real purchase or payment occurs. Durable and volatile state are teaching-model partitions.',
      '不会发生真实购买或支付。持久与易失状态都是教学模型中的状态分区。',
    ),
    'info',
  )
  clock.at(0, () => send(intents[0]))
  if (scenarioId === 'parallel') clock.at(20, () => send(intents[0]))
  if (scenarioId === 'restart') crash(280, 320)
  if (scenarioId === 'split-crash') crash(120, 160)
  if (scenarioId === 'before-commit') crash(50, 160)
  if (scenarioId === 'new-purchase')
    clock.at(300, () => {
      const second: Intent = {
        id: 'purchase-2',
        amount: 29,
        confirmed: false,
        receivedIds: [],
        attempts: 0,
      }
      intents.push(second)
      send(second)
    })
  if (scenarioId === 'changed-payload') clock.at(300, () => send(intents[0], true, 58))
  clock.run()

  const onePerIntent =
    !uniqueViolationObserved &&
    intents.every((intent) => orders.filter((order) => order.intent === intent.id).length <= 1)
  const completed = intents.every(
    (intent) => intent.confirmed && orders.some((order) => order.intent === intent.id),
  )
  const replayConsistent = intents.every((intent) => {
    const originalOrder = orders.find((order) => order.intent === intent.id)
    // A lost first reply can leave the client seeing only O2. Checking that all
    // received IDs agree would miss that O1 was the original committed effect.
    // Missing confirmations are evaluated separately by the recovery check.
    return intent.receivedIds.every((orderId) => orderId === originalOrder?.id)
  })
  const payloadCorrect =
    orders.every(
      (order) => order.amount === intents.find((intent) => intent.id === order.intent)?.amount,
    ) &&
    (scenarioId !== 'changed-payload' || (mismatchesRejected === 1 && mismatchesAccepted === 0))
  const checks: Check[] = [
    {
      id: 'at-most-once',
      label: t('At most one order per intent', '每个意图最多一张订单'),
      passed: onePerIntent,
      detail: t(
        `${orders.length} saved order(s) for ${intents.length} distinct purchase intent(s).`,
        `${intents.length} 个不同购买意图产生 ${orders.length} 张已保存订单。`,
      ),
    },
    {
      id: 'recovery',
      label: t('Every valid purchase completes', '每次有效购买最终完成'),
      passed: completed,
      detail: t(
        'Once finite faults end, every legitimate purchase must obtain a confirmed result.',
        '有限故障结束后，每次合法购买都必须得到确认结果。',
      ),
    },
    {
      id: 'stable-result',
      label: t('Retries return the original order', '重试返回原订单'),
      passed: replayConsistent,
      detail: t(
        'Every returned order ID must match the first committed order for that intent. Missing confirmations are checked separately under recovery.',
        '每个返回的订单 ID 都必须匹配该意图首次提交的订单。没有收到确认的问题由恢复检查单独判断。',
      ),
    },
    {
      id: 'payload',
      label: t('Purchase parameters remain consistent', '购买参数保持一致'),
      passed: payloadCorrect,
      detail: t(
        'Different parameters under an existing key are rejected; independent intents remain separate.',
        '已有键下更改参数会被拒绝，不同购买意图则保持独立。',
      ),
    },
  ]
  const passed = checks.every((check) => check.passed)
  emit(
    passed ? t('Scenario passed', '场景通过') : t('Counterexample found', '发现反例'),
    passed
      ? t(
          'Observed orders and client outcomes satisfy all checks for this fault schedule.',
          '此故障日程中，订单与客户端结果满足全部检查。',
        )
      : t(
          'Compare what the buyer knew with what survived in the database.',
          '对照买家当时知道的结果与数据库中实际保留的状态。',
        ),
    passed ? 'success' : 'danger',
  )
  return {
    levelId: 'checkout',
    scenarioId,
    strategyId,
    frames,
    checks,
    passed,
    summary: passed
      ? t(
          'This bounded case passed. Run all fault schedules to challenge the repair.',
          '本次有限场景通过。运行全部故障日程，继续检验修复。',
        )
      : t(
          'The repair still duplicates an order, loses recovery, or accepts inconsistent parameters.',
          '修复仍会重复创建订单、无法恢复，或接受不一致参数。',
        ),
  }
}

function statusLabel(status: string): Text {
  const labels: Record<string, Text> = {
    'in-flight': t('In flight', '传输中'),
    processing: t('Processing', '处理中'),
    'order-saved': t('Order saved; key pending', '订单已存，键待存'),
    'lost-request': t('Request lost', '请求丢失'),
    'lost-reply': t('Reply lost', '回复丢失'),
    interrupted: t('Interrupted', '已中断'),
    rejected: t('Rejected', '已拒绝'),
    'in-progress': t('Retryable: in progress', '可重试：处理中'),
    confirmed: t('Confirmed', '已确认'),
    replayed: t('Replayed', '已重放'),
  }
  return labels[status] ?? t(status, status)
}
