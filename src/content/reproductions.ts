/** Standalone teaching programs. Each source runs with Node; no package install. */
export const searchReproduction = String.raw`// ReplayFault: search generations / 搜索输入代际
// Run: node replayfault-search.mjs
// A deterministic event model, not a browser or a test of your application.
// 确定性事件模型；不是浏览器，也不会测试你的应用。
import assert from 'node:assert/strict';

function simulate(mode, inputs) {
  const events = [];
  let sequence = 0;
  let generation = 0;
  let latestStarted = 0;
  let query = '';
  let visible = null;
  const commits = [];
  const enqueue = (at, run) => events.push({ at, run, sequence: sequence++ });

  for (const input of inputs) {
    enqueue(input.at, () => {
      // Invalidate old work WHEN INTENT CHANGES, before a debounce delay.
      // 输入意图变化时立即使旧结果失效，不要等到防抖后发请求才更新。
      const mine = ++generation;
      query = input.query;
      visible = null;
      if (!query) return; // clearing also invalidates old work / 清空也使旧工作失效
      enqueue(input.at + (input.debounce ?? 0), () => {
        if (mine !== generation) return; // superseded debounce / 已被新输入替代
        const requestVersion = ++latestStarted;
        enqueue(input.at + (input.debounce ?? 0) + input.latency, () => {
          const accept = mode === 'bug'
            || (mode === 'requestVersion' && requestVersion === latestStarted)
            || (mode === 'queryText' && input.query === query)
            || (mode === 'generation' && mine === generation);
          if (!accept) return;
          visible = { query: input.query, generation: mine };
          commits.push({ mine, current: generation, stale: mine !== generation });
        });
      });
    });
  }
  while (events.length) {
    events.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
    events.shift().run();
  }
  return { visible, commits, generation };
}

const reversedResponses = [
  { at: 0, query: 'cat', latency: 300 },
  { at: 50, query: 'cats', latency: 30 },
];
const debounceGap = [
  { at: 0, query: 'cat', latency: 250 },
  { at: 100, query: 'cats', latency: 20, debounce: 200 },
];
const repeatedText = [
  { at: 0, query: 'cat', latency: 400 },
  { at: 50, query: 'dog', latency: 40 },
  { at: 100, query: 'cat', latency: 30 },
];

// BUG: an old response replaces the latest query's result.
// 故障：旧响应覆盖最新查询结果。
assert.equal(simulate('bug', reversedResponses).visible.query, 'cat');

// INCOMPLETE FIX: only numbering dispatched requests misses the debounce gap.
// 不完整修复：只在发出请求时编号，会漏掉防抖等待期间返回的旧响应。
assert.ok(simulate('requestVersion', debounceGap).commits.some((x) => x.stale));

// INCOMPLETE FIX: identical text can belong to different user intentions.
// 不完整修复：两次相同文字可能属于不同输入意图。
assert.ok(simulate('queryText', repeatedText).commits.some((x) => x.stale));

// FIX: only the current input generation may commit a result.
// 修复：只有当前输入代际的响应可以提交结果。
for (const inputs of [reversedResponses, debounceGap, repeatedText]) {
  const fixed = simulate('generation', inputs);
  assert.equal(fixed.commits.some((x) => x.stale), false);
  assert.equal(fixed.visible.generation, fixed.generation);
  assert.equal(fixed.visible.query, inputs.at(-1).query);
}

const cleared = simulate('generation', [
  { at: 0, query: 'cat', latency: 300 },
  { at: 100, query: '', latency: 0 },
]);
assert.equal(cleared.visible, null);
assert.equal(cleared.commits.some((x) => x.stale), false);

console.log('PASS: reproduced stale commits; generation guard passed all 4 schedules.');
console.log('通过：已复现旧结果提交；输入代际保护通过全部 4 组事件顺序。');
// Cancellation can save work, but guard every result/error/loading commit too.
// 取消可以节省工作；结果、错误和加载状态的提交仍需检查所属代际。
`

export const checkoutReproduction = String.raw`// ReplayFault: checkout idempotency / 订单幂等
// Run: node replayfault-checkout.mjs
// No network, payment SDK, or database is used. No real money or order is sent.
// 不连接网络、支付 SDK 或数据库，不会真实扣款或下单。
import assert from 'node:assert/strict';

// BUG: checking a key separately from applying its effect leaves a race.
// 故障：检查幂等键与提交业务结果分开执行，存在竞争窗口。
const naive = { orders: [], records: new Map() };
async function naiveHandle(key) {
  if (naive.records.has(key)) return naive.records.get(key);
  await Promise.resolve(); // both callers can pass the check / 两个调用都通过检查
  const response = { orderId: 'order-' + (naive.orders.length + 1) };
  naive.orders.push(response);
  naive.records.set(key, response);
  return response;
}
await Promise.all([naiveHandle('intent-1'), naiveHandle('intent-1')]);
assert.equal(naive.orders.length, 2);

// This IN-MEMORY model provides one serialized atomic commit boundary.
// 这个内存模型提供一个串行、原子的提交边界。
// It stands in for durable transactional storage; it is NOT durable storage.
// 它代替持久化事务存储来演示语义，自身并不持久化。
// Recreating a handler below models a server restart; exiting Node erases data.
// 下文重建处理器模拟服务重启；退出 Node 后所有数据都会消失。
class AtomicStoreModel {
  state = { orders: [], records: new Map() };
  tail = Promise.resolve();

  transaction(change, crashBeforeCommit = false) {
    const pending = this.tail.then(() => {
      const draft = structuredClone(this.state);
      const result = change(draft);
      if (crashBeforeCommit) throw new Error('Crash before atomic commit');
      this.state = draft; // order + replay record become visible together
      return structuredClone(result);
    });
    this.tail = pending.catch(() => {});
    return pending;
  }
}

function createHandler(store) {
  return async function handle(request, fault = {}) {
    const { customer, key, sku, quantity } = request;
    if (!customer || !key || !sku || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Invalid request');
    }
    const scopedKey = JSON.stringify([customer, key]);
    // Fixed fields for this demo only; a real API defines its canonical payload.
    // 示例仅比较固定字段；真实 API 必须明确定义规范化请求参数。
    const fingerprint = JSON.stringify([sku, quantity]);
    const response = await store.transaction((draft) => {
      const prior = draft.records.get(scopedKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new Error('Key payload mismatch');
        return prior.response;
      }
      const result = { orderId: 'order-' + (draft.orders.length + 1) };
      draft.orders.push({ ...result, customer, sku, quantity });
      draft.records.set(scopedKey, { fingerprint, response: result });
      return result;
    }, fault.crashBeforeCommit);
    if (fault.dropResponse) throw new Error('Response lost after commit');
    return response;
  };
}

const request = { customer: 'customer-1', key: 'intent-1', sku: 'mug', quantity: 1 };
const store = new AtomicStoreModel();
let handle = createHandler(store);

// A committed order survives a lost response in the model.
// 模型中回包丢失不会撤销已经提交的订单。
await assert.rejects(handle(request, { dropResponse: true }), /Response lost/);
assert.equal(store.state.orders.length, 1);
handle = createHandler(store); // same modeled durable store / 复用模型中的持久状态
const replayed = await handle(request);
assert.equal(replayed.orderId, 'order-1');
assert.equal(store.state.orders.length, 1);

// Concurrent retries replay one committed result.
// 并发重试复用同一个已提交结果。
const concurrent = await Promise.all([handle(request), handle(request)]);
assert.deepEqual(concurrent[0], concurrent[1]);
assert.equal(store.state.orders.length, 1);

// New purchase intent, new key; changed payload on the old key is rejected.
// 新购买意图使用新键；旧键对应的请求参数不能被悄悄改写。
await assert.rejects(handle({ ...request, quantity: 2 }), /payload mismatch/);
await handle({ ...request, key: 'intent-2' });
assert.equal(store.state.orders.length, 2);

// A pre-commit failure writes neither order nor deduplication record.
// 提交前失败时，订单和去重记录都不写入。
const third = { ...request, key: 'intent-3' };
await assert.rejects(handle(third, { crashBeforeCommit: true }), /before atomic commit/);
assert.equal(store.state.orders.length, 2);
assert.equal(store.state.records.size, 2);
await handle(third);
assert.equal(store.state.orders.length, 3);
assert.equal(store.state.records.size, 3);

// A new key on each retry still creates duplicates, even with this atomic store.
// 即使存储原子可靠，每次重试换键仍会创建重复业务操作。
const wrongKeys = new AtomicStoreModel();
const wrongHandle = createHandler(wrongKeys);
await wrongHandle({ ...request, key: 'attempt-1' });
await wrongHandle({ ...request, key: 'attempt-2' });
assert.equal(wrongKeys.state.orders.length, 2);

console.log('PASS: reproduced the race; atomic key/effect/result model passed all checks.');
console.log('通过：已复现竞争；幂等键、业务效果与结果的原子模型通过全部检查。');
// Real systems need persistent storage and an appropriate concurrency guarantee.
// 真实系统需要持久化存储及合适的并发保证。
// External payments cannot be made atomic by wrapping local code in a DB transaction.
// 本地数据库事务不会自动让远程支付也成为同一个原子操作。
// Coordinate external effects using the provider's idempotency contract and recovery.
// 外部副作用需要结合提供方的幂等契约、状态核对和恢复方案。
`
