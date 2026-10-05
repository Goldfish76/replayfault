import { checkoutReproduction, searchReproduction } from './reproductions'

export type ContentLocale = 'en' | 'zh'
export type LocalizedText = Readonly<Record<ContentLocale, string>>
export type LessonId = 'search' | 'checkout'

export interface LessonContent {
  id: LessonId
  title: LocalizedText
  summary: LocalizedText
  goal: LocalizedText
  hints: readonly { title: LocalizedText; body: LocalizedText }[]
  debrief: {
    headline: LocalizedText
    body: LocalizedText
    steps: readonly LocalizedText[]
  }
  pitfalls: readonly {
    title: LocalizedText
    wrongFix: LocalizedText
    why: LocalizedText
    betterFix: LocalizedText
  }[]
  assumptions: readonly LocalizedText[]
  limits: readonly LocalizedText[]
  sources: readonly { label: LocalizedText; url: string }[]
  reproduction: {
    filename: string
    language: 'javascript'
    description: LocalizedText
    run: LocalizedText
    readme: LocalizedText
    source: string
  }
}

export const getText = (value: LocalizedText, locale: ContentLocale): string => value[locale]
const text = (en: string, zh: string): LocalizedText => ({ en, zh })

export const lessonContent: Readonly<Record<LessonId, LessonContent>> = {
  search: {
    id: 'search',
    title: text('Search went backwards', '搜索结果倒退了'),
    summary: text(
      'A customer keeps typing. A slower, older response arrives last and replaces the result they actually asked for.',
      '用户仍在输入，较慢的旧响应最后到达，覆盖了用户现在想看的结果。',
    ),
    goal: text(
      'Let only the current input generation commit UI state. The final result must still load; suppressing every response is not a fix.',
      '只允许当前输入代际提交界面状态，同时让最终结果正常加载；丢弃所有响应并不是修复。',
    ),
    hints: [
      {
        title: text('1 · Follow one old response', '1 · 跟踪一条旧响应'),
        body: text(
          'Compare when the user changed the input with when each response writes to the screen. Arrival order does not tell you which result is current.',
          '对照输入变化时刻和响应写入界面的时刻。最后到达的响应，不一定属于当前输入。',
        ),
      },
      {
        title: text('2 · Look inside the debounce gap', '2 · 检查防抖等待期间'),
        body: text(
          'The user can change their mind before the next request is sent. An older response must lose permission to update the UI at that input change, not at the later dispatch.',
          '新请求发出之前，用户就可能改变输入。旧响应应在输入变化时失去更新权限，而不是等到新请求发出时。',
        ),
      },
      {
        title: text('3 · Guard the commit with a generation', '3 · 用输入代际保护提交'),
        body: text(
          'Increment a generation when the input or filter changes, including clearing the input. Capture it for the scheduled request, then compare it with the current generation before committing results, errors, or loading state.',
          '输入或筛选变化时递增 generation，清空输入也一样。让计划中的请求保存该值；提交结果、错误或加载状态前，检查它是否仍等于当前 generation。',
        ),
      },
    ],
    debrief: {
      headline: text(
        'Separate finishing work from accepting its result.',
        '区分“工作完成”和“结果仍可接受”。',
      ),
      body: text(
        'A request may finish successfully after its user intent has become obsolete. Keep timing and ownership separate: a generation identifies which input owns a result, and the commit guard checks that ownership.',
        '请求可以正常完成，但发起它的用户意图已经过时。时间与归属应分开判断：generation 标明结果属于哪次输入，提交检查决定它是否仍有权更新界面。',
      ),
      steps: [
        text(
          'Reproduce the old response committing after a newer input.',
          '先复现：新输入出现后，旧响应仍提交了结果。',
        ),
        text(
          'Invalidate old generations immediately on input change, including during debounce.',
          '输入变化时立即使旧代际失效，包括防抖等待期间。',
        ),
        text(
          'Check the captured generation at every asynchronous UI commit.',
          '每次异步更新界面时，检查请求捕获的代际。',
        ),
        text(
          'Replay reversed responses, a debounce gap, and repeated query text. Check that the latest result still appears.',
          '重放响应倒序、防抖间隙和重复输入文字，确认最新结果仍能显示。',
        ),
      ],
    },
    pitfalls: [
      {
        title: text('Only increase debounce', '只把防抖时间调长'),
        wrongFix: text(
          'Send fewer requests and assume the race is gone.',
          '减少请求数量，就认为竞争已经消失。',
        ),
        why: text(
          'An already-started request can still finish during the waiting interval.',
          '已经发出的旧请求，仍可能在等待期间完成。',
        ),
        betterFix: text(
          'Use debounce to manage request volume and a generation guard to manage correctness.',
          '用防抖控制请求量，用代际检查保证结果归属。',
        ),
      },
      {
        title: text('Number requests only when sent', '只在发出请求时编号'),
        wrongFix: text(
          'Accept the latest dispatched request, regardless of newer unsent input.',
          '只认最新发出的请求，忽略尚未发出的新输入。',
        ),
        why: text(
          'The input can already be newer while a debounce timer has not fired.',
          '防抖计时器尚未触发时，输入也可能已经变了。',
        ),
        betterFix: text(
          'Advance the intent generation in the input-change path, then capture it for dispatch.',
          '在输入变化路径递增意图代际，再让待发送的请求捕获该值。',
        ),
      },
      {
        title: text('Compare only the query string', '只比较查询文字'),
        wrongFix: text(
          'Allow any response whose query matches the current text.',
          '只要响应的查询文字与当前文字相同，就允许写入。',
        ),
        why: text(
          'The sequence cat → dog → cat contains two different cat intentions. Equal text does not identify the same request generation.',
          'cat → dog → cat 包含两次不同的 cat 输入意图。文字相同，不代表请求代际相同。',
        ),
        betterFix: text(
          'Compare generation identity; keep query text for display and cache policy.',
          '比较代际身份；查询文字另用于展示和缓存策略。',
        ),
      },
      {
        title: text('Treat cancellation as the whole fix', '把取消当成完整修复'),
        wrongFix: text(
          'Abort the old fetch and remove all commit guards.',
          '取消旧 fetch，然后移除所有提交检查。',
        ),
        why: text(
          'Supported work can be cancelled, but other asynchronous stages and already-settled callbacks need their own ownership check.',
          '可取消的工作可以停止，但其他异步阶段及已完成后待执行的回调仍需检查归属。',
        ),
        betterFix: text(
          'Cancel obsolete work when supported, and retain the generation check before UI writes.',
          '在支持时取消过期工作，同时保留更新界面前的代际检查。',
        ),
      },
    ],
    assumptions: [
      text(
        'This lab models one search view with monotonically increasing intent generations. Text, filters, and clearing the input can change the intent.',
        '本关模拟一个搜索界面和单调递增的意图代际。文字、筛选变化和清空输入都可能改变意图。',
      ),
      text(
        'Request timings and response ordering are controlled teaching inputs, not measured browser or network performance.',
        '请求耗时和响应顺序是可控的教学输入，不是真实浏览器或网络性能测量。',
      ),
      text(
        'For the same scenario, the same actions replay the same event order; animation speed does not change that order.',
        '同一场景采用相同操作时，会重放同一事件顺序；动画速度不改变事件顺序。',
      ),
    ],
    limits: [
      text(
        'This is a local model, not an automated test of your application or a complete data-fetching library.',
        '这是本地模型，不会自动测试你的应用，也不是完整的数据获取库。',
      ),
      text(
        'Real interfaces must also handle unmounts, failures, loading indicators, cached results, and text composition. Their state writes need a consistent ownership policy.',
        '真实界面还需处理卸载、失败、加载提示、缓存结果及输入法组合输入；这些状态更新都需要一致的归属策略。',
      ),
      text(
        'Cancelling a client operation does not promise that a server has cancelled or rolled back its work.',
        '取消客户端操作，并不保证服务端已经取消或回滚其工作。',
      ),
    ],
    sources: [
      {
        label: text(
          'React: fetching data and ignoring obsolete responses',
          'React：获取数据与忽略过期响应',
        ),
        url: 'https://react.dev/reference/react/useEffect#fetching-data-with-effects',
      },
      {
        label: text('MDN: AbortController.abort()', 'MDN：AbortController.abort()'),
        url: 'https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort',
      },
    ],
    reproduction: {
      filename: 'replayfault-search.mjs',
      language: 'javascript',
      description: text(
        'Download a standalone JavaScript model with assertions for the bug and the generation fix.',
        '下载独立 JavaScript 模型，包含故障和代际修复的断言对照。',
      ),
      run: text(
        'Run with Node.js 22+: node replayfault-search.mjs',
        '使用 Node.js 22+ 运行：node replayfault-search.mjs',
      ),
      readme: text(
        'Save the file and run the command in its folder. No dependency installation or network is required. The program checks reversed response order, the input-to-dispatch debounce gap, repeated query text, and clearing the input. This minimal download models result commits; the interactive lab also exercises error and loading ownership. PASS describes these model assertions only; it does not validate your real application. The scheduler advances virtual time, so the numbers are fixtures rather than recommended timeout values.',
        '保存文件后，在所在文件夹运行上述命令。无需安装依赖或联网。程序检查响应倒序、输入至发送之间的防抖间隙、重复查询文字及清空输入。这个最小下载只模拟结果提交；交互关卡还检查错误和加载状态的归属。PASS 只表示这些模型断言通过，不代表真实应用已通过测试。调度器使用虚拟时间，数值只是复现条件，不是推荐超时参数。',
      ),
      source: searchReproduction,
    },
  },
  checkout: {
    id: 'checkout',
    title: text('One purchase, two orders', '买一次，却下了两单'),
    summary: text(
      'The server creates an order, but the reply is lost. A retry looks like a new purchase unless the service remembers the original intent.',
      '服务端已经创建订单，但回包丢失。除非服务能识别原来的购买意图，否则重试看起来就像一次新购买。',
    ),
    goal: text(
      'Create one order per purchase intent, return the recorded result on retries, and still allow genuinely new purchases.',
      '每次购买意图只创建一个订单；重试返回已记录的结果；真正的新购买仍能正常下单。',
    ),
    hints: [
      {
        title: text('1 · Inspect the order ledger', '1 · 检查订单账本'),
        body: text(
          'A timeout tells the caller that a response did not arrive in time. Check whether the order was already committed before assuming that the purchase failed.',
          '超时只告诉调用方：响应未按时到达。先检查订单是否已经提交，不要直接认定购买失败。',
        ),
      },
      {
        title: text('2 · Give the intent a stable identity', '2 · 给购买意图一个稳定身份'),
        body: text(
          'The same purchase must keep the same key across attempts. A different purchase needs a different key, even when the customer and basket are identical.',
          '同一次购买的多次尝试必须沿用同一个键。新的购买需要新的键，即使客户和购物篮完全相同。',
        ),
      },
      {
        title: text(
          '3 · Commit the effect and replay record together',
          '3 · 同时提交业务效果与重放记录',
        ),
        body: text(
          'A key alone is not enough. Model an atomic, persistent boundary for the order and its key/result record, reject changed payloads on a reused key, and replay the stored result after a lost reply.',
          '仅有键还不够。订单与键及结果记录需要同一个原子持久化边界；旧键对应的请求参数发生变化时应拒绝；回包丢失后重放已记录的结果。',
        ),
      },
    ],
    debrief: {
      headline: text(
        'The caller can be uncertain even after the server succeeds.',
        '服务端已经成功，调用方仍可能不知道。',
      ),
      body: text(
        'A stable intent key lets the service recognize a retry. The guarantee comes from how the service coordinates that key with the business effect and stored result, not from the header name. This lab assumes that coordination is atomic and durable in the modeled store.',
        '稳定的意图键让服务识别重试。保证来自服务如何协调这个键、业务效果和已保存结果，而不是请求头的名字。本关将这一协调抽象为存储中的原子持久化操作。',
      ),
      steps: [
        text(
          'Trace the first attempt through the commit, then the lost response.',
          '跟踪第一次尝试：先提交订单，然后回包丢失。',
        ),
        text(
          'Keep the same scoped key and request parameters for retries of that purchase intent.',
          '同一购买意图的重试，沿用同作用域的键和相同请求参数。',
        ),
        text(
          'Commit the order and replay record atomically; serialize or otherwise safely coordinate competing requests for the key.',
          '原子提交订单与重放记录，并串行化或以其他正确机制协调同键并发请求。',
        ),
        text(
          'Replay after a lost reply and a modeled handler restart; then verify that a new intent still creates a new order.',
          '在丢失回包及模拟处理器重启后重试，再确认新的购买意图仍能创建新订单。',
        ),
      ],
    },
    pitfalls: [
      {
        title: text('Generate a fresh key on every retry', '每次重试都生成新键'),
        wrongFix: text(
          'Use a random key each time the network call runs.',
          '每次发网络请求都使用一个随机新键。',
        ),
        why: text(
          'The service sees independent operations, so even a correct idempotency implementation can create multiple orders.',
          '服务会把它们当成不同操作；即使幂等实现正确，也会创建多个订单。',
        ),
        betterFix: text(
          'Create the key once for the purchase intent and retain it across retry attempts.',
          '每次购买意图只生成一次键，并让重试保留它。',
        ),
      },
      {
        title: text('Use the customer or basket as the key', '把客户或购物篮当成键'),
        wrongFix: text(
          'Reuse one key whenever the customer buys the same items.',
          '客户购买相同商品时，总是使用同一个键。',
        ),
        why: text(
          'Two deliberate purchases can have identical contents; collapsing them loses a valid order.',
          '两次有意购买可以包含完全相同的商品；合并它们会丢掉一个有效订单。',
        ),
        betterFix: text(
          'Represent each explicit purchase intent separately and scope keys to the authenticated caller or tenant.',
          '分别标识每次明确的购买意图，并将键限定在已认证调用方或租户的作用域内。',
        ),
      },
      {
        title: text('Check, create, then remember', '先检查、再创建、最后记住'),
        wrongFix: text(
          'Look up the key, create an order, and write the deduplication record in separate operations.',
          '分开查询键、创建订单、写去重记录。',
        ),
        why: text(
          'Concurrent attempts can both pass the check. A crash after the order write can also leave no record to identify a retry.',
          '并发尝试可能同时通过检查；创建订单后崩溃，也可能来不及留下识别重试的记录。',
        ),
        betterFix: text(
          'Use a real transactional or equivalent design that coordinates the key, business effect, and replay result under concurrency and crashes.',
          '采用真实事务或等效设计，在并发和崩溃情况下协调键、业务效果及可重放结果。',
        ),
      },
      {
        title: text('Disable the button and call it solved', '禁用按钮就算修好了'),
        wrongFix: text(
          'Prevent a second click in one tab and rely on that for server correctness.',
          '阻止当前标签页再次点击，就依靠它保证服务端正确性。',
        ),
        why: text(
          'Network retries, other tabs, and reconnects can still produce additional attempts.',
          '网络重试、其他标签页及重新连接仍会产生额外尝试。',
        ),
        betterFix: text(
          'Use button state for user experience and server-side idempotency for the operation contract.',
          '按钮状态用于改善体验，操作契约由服务端幂等机制保证。',
        ),
      },
    ],
    assumptions: [
      text(
        'One modeled order and its replay record share an atomic commit boundary. The key is scoped to a caller and bound to fixed request parameters.',
        '一个模型订单与其重放记录共享原子提交边界。键限定到调用方，并绑定固定请求参数。',
      ),
      text(
        'Committed model state survives a modeled handler restart; it is not an implementation of durable storage.',
        '已提交的模型状态可跨模拟处理器重启保留；这不是持久化存储的实际实现。',
      ),
      text(
        'Keys do not expire during this exercise. The scenario controls response loss and timing without issuing real requests.',
        '本练习期间键不会过期。场景直接控制回包丢失与时序，不发出真实请求。',
      ),
    ],
    limits: [
      text(
        'The in-memory reproduction loses all data when Node exits. Production needs persistent storage, appropriate uniqueness/concurrency guarantees, and recovery tests.',
        '内存复现在 Node 退出后会丢失全部数据。生产实现需要持久化存储、合适的唯一性与并发保证，以及恢复测试。',
      ),
      text(
        'A local database transaction does not include a remote payment automatically. External effects require the provider’s idempotency contract and a coordinated recovery or reconciliation design.',
        '本地数据库事务不会自动包含远程支付。外部副作用需要结合提供方的幂等契约，并设计协调恢复或状态核对方案。',
      ),
      text(
        'Real key expiry, payload canonicalization, authorization, uncertain outcomes, and cross-service workflows need explicit contracts. This lab does not prove end-to-end exactly-once delivery.',
        '真实系统的键过期、请求规范化、授权、未知结果及跨服务流程都需要明确契约。本关不证明端到端恰好一次投递。',
      ),
      text(
        'These assertions validate a small teaching model, not your checkout, payment provider, or database implementation.',
        '这些断言只验证一个小型教学模型，不验证你的结账、支付提供方或数据库实现。',
      ),
    ],
    sources: [
      {
        label: text(
          'AWS Builders’ Library: making retries safe with idempotent APIs',
          'AWS Builders’ Library：用幂等 API 保证重试安全',
        ),
        url: 'https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/',
      },
      {
        label: text(
          'Stripe API: idempotent requests and parameter matching',
          'Stripe API：幂等请求与参数匹配',
        ),
        url: 'https://docs.stripe.com/api/idempotent_requests',
      },
    ],
    reproduction: {
      filename: 'replayfault-checkout.mjs',
      language: 'javascript',
      description: text(
        'Download a single-file JavaScript model with a duplicate-order race and an atomic idempotency contrast.',
        '下载单文件 JavaScript 模型，对照重复订单竞争与原子幂等方案。',
      ),
      run: text(
        'Run with Node.js 22+: node replayfault-checkout.mjs',
        '使用 Node.js 22+ 运行：node replayfault-checkout.mjs',
      ),
      readme: text(
        'Save the file and run the command in its folder. No packages, credentials, network, payment SDK, or database are used. Assertions cover a check-then-create race, a lost reply after commit, concurrent retries, changed payload rejection, a new purchase, and failure before commit. The store is an in-memory abstraction with serialized atomic updates, not persistent storage; recreating the handler models a service restart but exiting Node erases it. A real system must supply the durability and concurrency guarantees assumed here. External payment effects are outside the modeled transaction.',
        '保存文件后，在所在文件夹运行上述命令。不需要依赖包、凭据、网络、支付 SDK 或数据库。断言涵盖先检查再创建的竞争、提交后回包丢失、并发重试、拒绝变更参数、新购买及提交前失败。存储是具有串行原子更新的内存抽象，并非持久化存储；重建处理器模拟服务重启，但退出 Node 就会清空数据。真实系统必须提供模型所假定的持久性和并发保证。外部支付效果不在这个模型事务内。',
      ),
      source: checkoutReproduction,
    },
  },
}
