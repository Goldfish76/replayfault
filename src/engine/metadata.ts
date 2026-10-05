import { t, type Level } from './types'

export const levels: Level[] = [
  {
    id: 'search',
    title: t('The result that arrived too late', '迟到的搜索结果'),
    subtitle: t('A newer search. An older answer.', '新的搜索，旧的答案。'),
    description: t(
      'Two searches share one screen. Their responses do not arrive in the order they were sent.',
      '两次搜索共用一个页面，但响应不一定按发出顺序返回。',
    ),
    objective: t(
      'Keep results, errors, and loading owned by the latest user intent.',
      '让最新用户意图拥有结果、错误与加载状态的更新权。',
    ),
    strategies: [
      {
        id: 'unguarded',
        label: t('Accept every response', '接受所有响应'),
        description: t(
          'Every completed request writes to the screen.',
          '每个完成的请求都更新页面。',
        ),
        code: 'const data = await search(query);\nsetResults(data);\nsetLoading(false);',
      },
      {
        id: 'debounce',
        label: t('Debounce 200 ms', '防抖 200 毫秒'),
        description: t(
          'Wait for a typing pause. In-flight requests can still overlap.',
          '等待输入停顿；已发出的请求仍可能重叠。',
        ),
        code: 'clearTimeout(timer);\ntimer = setTimeout(() => searchAndRender(query), 200);',
      },
      {
        id: 'cancel',
        label: t('Cancel previous fetch', '取消上一次 fetch'),
        description: t(
          'Abort network and body work. Independent post-processing keeps running.',
          '取消网络和响应体读取；独立的后处理仍会继续。',
        ),
        code: 'previousController?.abort();\nconst controller = new AbortController();\nconst data = await fetchAndRead(query, controller.signal);\nsetResults(await independentTransform(data));',
      },
      {
        id: 'latest',
        label: t('Guard every UI write', '保护每一次界面更新'),
        description: t(
          'Advance intent generation on every change; ignore stale success, error, and cleanup.',
          '每次意图变化都推进版本；忽略过期成功、错误与清理。',
        ),
        code: 'const mine = ++generation;\ntry {\n  const data = await search(query);\n  if (mine === generation) setResults(data);\n} catch (error) {\n  if (mine === generation) setError(error);\n} finally {\n  if (mine === generation) setLoading(false);\n}',
      },
      {
        id: 'latest-cancel',
        label: t('Guard + cancel', '版本保护 + 取消'),
        description: t(
          'Use ownership for correctness and cancellation to avoid unnecessary work.',
          '用版本所有权保证正确，用取消减少无效工作。',
        ),
        code: 'const mine = ++generation;\npreviousController?.abort();\n// Pass a new signal to fetch.\n// Guard success, failure, and finally with mine === generation.\n// Clearing input also advances generation.',
      },
    ],
    scenarios: [
      {
        id: 'out-of-order',
        label: t('Reversed responses', '响应顺序颠倒'),
        description: t(
          'Apple is slow; banana is fast. The older result arrives last.',
          'apple 很慢，banana 很快，旧结果最后到达。',
        ),
      },
      {
        id: 'debounce-pause',
        label: t('A pause between keystrokes', '两次输入间停顿'),
        description: t(
          'Both searches outlive a 200 ms debounce window.',
          '两次输入都越过 200 毫秒防抖窗口，请求仍有重叠。',
        ),
      },
      {
        id: 'post-processing',
        label: t('Fetch already finished', 'fetch 已经完成'),
        description: t(
          'The old response is parsed before the next search, but its independent transform is still pending.',
          '旧响应已解析完，但新搜索开始时，其独立转换仍未完成。',
        ),
      },
      {
        id: 'stale-error',
        label: t('An old request fails', '旧请求迟来报错'),
        description: t(
          'An obsolete failure tries to replace a successful new result.',
          '一个过期错误试图覆盖新的成功结果。',
        ),
      },
      {
        id: 'stale-cleanup',
        label: t('Old cleanup stops the spinner', '旧清理结束新加载'),
        description: t(
          'An old request fails while the current one is still pending. Its cleanup clears loading too early.',
          '旧请求失败时，新请求仍在等待。旧清理过早结束了加载。',
        ),
      },
      {
        id: 'clear-input',
        label: t('Clear the search', '清空搜索'),
        description: t(
          'Clear the box while a response is still on its way.',
          '响应仍在路上时清空搜索框。',
        ),
      },
      {
        id: 'latest-failure',
        label: t('The current request fails', '当前请求失败'),
        description: t(
          'The newest search really fails. Silencing every error is not a repair.',
          '最新搜索确实失败了；吞掉所有错误并不是修复。',
        ),
      },
      {
        id: 'same-query-filter',
        label: t('Same text, different filter', '同样文字，不同筛选'),
        description: t(
          'Search text stays the same while the category changes.',
          '搜索文字没变，但分类筛选发生了变化。',
        ),
      },
    ],
    modelNotes: [
      t(
        'Requests have network, body, and independent transformation phases. Abort cancels the first two; it cannot undo an already completed operation.',
        '请求分为网络、响应体读取、独立转换三个阶段。取消可终止前两者，不能撤销已完成操作。',
      ),
      t(
        'Every event runs synchronously to completion. A new input can interleave only between events, never inside a synchronous callback.',
        '每个事件同步执行完毕；输入只能插入事件之间，不能插进同步回调中途。',
      ),
      t(
        'The simplified UI clears old results on a new intent. It does not model caching, React scheduling, or real bandwidth.',
        '简化界面在新意图开始时清空旧结果；不模拟缓存、React 调度或真实带宽。',
      ),
      t(
        'Cancellation is allowed to pass cases it genuinely fixes. Correctness is tested through resulting state, not a preferred strategy name.',
        '取消策略可以通过它真正修好的案例；判定依据是结果状态，不是某个预设策略名称。',
      ),
    ],
    sources: [
      {
        title: 'React — Fetching data and stale responses',
        url: 'https://react.dev/learn/you-might-not-need-an-effect#fetching-data',
      },
      {
        title: 'MDN — Canceling a fetch request',
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#canceling_a_request',
      },
    ],
  },
  {
    id: 'checkout',
    title: t('One purchase, two orders', '一次购买，两张订单'),
    subtitle: t('A timeout is an unknown outcome.', '超时，意味着结果未知。'),
    description: t(
      'The server saved an order. Its response disappeared. A retry can create a second order.',
      '服务器保存了订单，响应却丢失了。重试可能创建第二张订单。',
    ),
    objective: t(
      'Preserve one order per purchase intent while allowing recovery and genuinely new purchases.',
      '一次购买意图只产生一张订单，同时允许恢复与真正的新购买。',
    ),
    strategies: [
      {
        id: 'new-key',
        label: t('A new key on every retry', '每次重试使用新键'),
        description: t(
          'The server cannot recognize retries of the same purchase.',
          '服务器无法识别同一次购买的重试。',
        ),
        code: 'function retry() {\n  return createOrder({ key: newId(), cart });\n}',
      },
      {
        id: 'no-retry',
        label: t('Never retry', '永不重试'),
        description: t(
          'Avoid retry duplicates, but a lost request never completes.',
          '避开重试重复，却无法恢复丢失的请求。',
        ),
        code: 'try { await createOrder(cart); }\ncatch { showUnknownOutcome(); /* stop */ }',
      },
      {
        id: 'memory',
        label: t('Remember keys in memory', '只在内存记住键'),
        description: t(
          'A process-local map handles repeats until that process restarts.',
          '进程内存映射可处理重复请求，但重启后会遗忘。',
        ),
        code: 'if (memory.has(key)) return memory.get(key);\n// Local in-flight coordination included.\nconst order = await saveOrder(cart);\nmemory.set(key, order);',
      },
      {
        id: 'split',
        label: t('Save order, then save key', '先保存订单，再保存键'),
        description: t(
          'Two durable writes leave a crash window; check-then-write also races.',
          '两次独立持久化留下崩溃窗口，先查再写也存在竞争。',
        ),
        code: 'const previous = await findKey(key);\nif (previous) return previous;\nconst order = await saveOrder(cart); // first commit\nawait saveKey(key, order);          // second commit',
      },
      {
        id: 'atomic',
        label: t('One durable transaction', '一个持久化事务'),
        description: t(
          'Reuse the intent key. Claim it uniquely and commit the order and replay result together.',
          '重用意图键，以唯一约束协调，并一起提交订单与可重放结果。',
        ),
        code: '// Same intent => same scoped key on every attempt.\ntransaction(() => {\n  claimUniqueKey(account, operation, key);\n  validateSamePayload();\n  createOrderAndStoreReplayResult();\n});\n// Existing key => original order; mismatched payload => reject.',
      },
    ],
    scenarios: [
      {
        id: 'lost-response',
        label: t('Success response lost', '成功响应丢失'),
        description: t(
          'The first order commits, but its reply never reaches the buyer.',
          '首张订单已提交，但回复没有到达买家。',
        ),
      },
      {
        id: 'parallel',
        label: t('Concurrent attempts', '并发尝试'),
        description: t(
          'Two requests for one purchase reach the server almost together.',
          '同一次购买的两个请求几乎同时抵达服务器。',
        ),
      },
      {
        id: 'restart',
        label: t('Restart after commit', '提交后重启'),
        description: t(
          'The service restarts after saving the order and before the buyer receives a result.',
          '保存订单后、买家获得结果前，服务发生重启。',
        ),
      },
      {
        id: 'split-crash',
        label: t('Crash between writes', '两次写入之间崩溃'),
        description: t(
          'Crash after the order write and before the separate key write.',
          '订单写入之后、独立的幂等键写入之前崩溃。',
        ),
      },
      {
        id: 'lost-request',
        label: t('Request never arrived', '请求从未抵达'),
        description: t(
          'The first attempt is dropped before the server can do any work.',
          '首次请求在服务器处理之前就丢失了。',
        ),
      },
      {
        id: 'new-purchase',
        label: t('Buy the same thing again', '再次购买同样商品'),
        description: t(
          'Two independent purchase intents have identical cart contents. Both should succeed.',
          '两次独立购买具有相同购物车内容，两次都应成功。',
        ),
      },
      {
        id: 'changed-payload',
        label: t('Same key, different cart', '相同键，不同购物车'),
        description: t(
          'A later request reuses a key but changes the cart. It must be rejected.',
          '后续请求复用了键，却更改购物车；应明确拒绝。',
        ),
      },
      {
        id: 'before-commit',
        label: t('Crash before commit', '提交前崩溃'),
        description: t(
          'The service loses staged work before any order commits, then recovers.',
          '订单尚未提交，服务丢失暂存工作，然后恢复。',
        ),
      },
    ],
    modelNotes: [
      t(
        'This lesson creates orders in one simulated database; it does not perform payments or claim universal exactly-once delivery.',
        '本关只在一个模拟数据库创建订单；不进行支付，也不声称实现普遍的消息恰好投递一次。',
      ),
      t(
        'A purchase intent, an HTTP attempt, and an idempotency key are distinct. Keys are scoped to an account and operation.',
        '购买意图、HTTP 尝试与幂等键互不等同。键以账户及操作为作用域。',
      ),
      t(
        'The database transaction is atomic and durable. Crashes occur at declared boundaries; in-flight commit ambiguity and disk failures are outside this model.',
        '数据库事务被建模为原子且持久。崩溃发生在明确边界；提交中的不确定性与磁盘故障不在此模型内。',
      ),
      t(
        'In-progress duplicates receive a retryable response. Keys remain retained throughout this bounded simulation; production retention policies vary.',
        '处理中重复请求得到可重试响应。在有限模拟期间保留键；真实系统的保留策略各异。',
      ),
      t(
        'A local transaction cannot roll back an external payment. Outbox delivery, provider idempotency, and reconciliation belong in a later lesson.',
        '本地事务不能回滚外部支付。outbox 投递、支付方幂等和对账属于后续关卡。',
      ),
    ],
    sources: [
      {
        title: 'AWS — Making retries safe with idempotent APIs',
        url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/',
      },
      {
        title: 'PostgreSQL — Transactions',
        url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html',
      },
      {
        title: 'Stripe — Idempotent requests',
        url: 'https://docs.stripe.com/api/idempotent_requests',
      },
    ],
  },
]

export function getLevel(id: string): Level {
  const level = levels.find((item) => item.id === id)
  if (!level) throw new Error(`Unknown level: ${id}`)
  return level
}
