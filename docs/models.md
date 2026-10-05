# Model assumptions and limits

ReplayFault v0.1.0 contains two deterministic teaching models. Each case has eight declared scenarios and five selectable strategies. The goal is to make a failure inspectable and a claim about a fix testable.

## What is deterministic?

A configuration selects a case, scenario, and strategy. In the same app version, these inputs produce the same event sequence and result. The interface plays back snapshots of that simulation. The displayed milliseconds are virtual event times, not measured browser or server performance.

A counterexample is a modeled sequence in which a strategy violates an assertion. At the end of a replay, the interface shows each check's result and explanation. **Test all scenarios** runs the selected strategy through the eight declared scenarios for that case. Passing that finite set does not prove the absence of all possible failures. Checks use the resulting state rather than a preferred strategy name.

## Search responses arriving out of order

This case tracks the current user intent, its requests, and the result, error, and loading state displayed to the user. Text, filters, and clearing the input can change the intent even before a new request is sent.

The five strategies accept every response, debounce by 200 ms, cancel the previous fetch, guard every UI write by intent generation, or combine guarding and cancellation.

The eight scenarios cover reversed responses, a pause across the debounce window, pending independent post-processing after fetch completes, stale errors, stale loading cleanup, cleared input, failure of the latest request, and an unchanged query with a new filter.

The checks require:

- No obsolete callback writes current results or errors.
- Old cleanup does not finish loading for an unfinished current intent.
- The final state shows the current result, current error, or intentionally empty view.
- The UI eventually finishes waiting.

The model separates network, body-reading, and independent transformation phases. Cancellation can stop the first two; it does not undo completed work or automatically cancel the independent transform. Each modeled event runs synchronously to completion, with new input arriving between events.

The simplified view clears old results on a new intent. It does not model React scheduling, caching, component unmounts, input-method composition, a full browser network stack, or real bandwidth. The shown strategy snippets explain the mechanism; they are not complete application integrations.

## Repeated order requests

This case distinguishes a purchase intent, individual request attempts, and an idempotency key scoped to a buyer and operation. The goal includes recovery and genuine new purchases, as well as avoiding duplicates.

The five strategies use a new key on every retry, never retry, remember keys in process memory, save the order and key separately, or commit the order and replay result under one atomic durable transaction with a unique key claim.

The eight scenarios cover a lost success response, concurrent attempts, restart after commit, a crash between separate writes, a request that never arrives, a new purchase with identical contents, different parameters under the same key, and a crash before commit.

The checks require:

- At most one order for each purchase intent throughout the replay.
- Every valid purchase obtains a confirmed result once the finite faults end.
- Retries return the original order identifier.
- Order parameters remain consistent and changed parameters under an existing key are rejected.

The database is an abstraction whose committed state survives modeled handler restarts. The atomic strategy assumes an atomic, durable transaction and uniqueness coordination. In-progress duplicates receive a retryable result. Keys remain retained for the duration of the simulation. Crashes occur only at declared event boundaries.

The app does not implement durable storage, actual database transactions, or a payment provider. It leaves out uncertain in-flight commits, disk failures, key expiry, production payload canonicalization, authorization, and cross-service workflows. A local transaction does not automatically cover an external payment. A passing replay does not establish end-to-end exactly-once delivery.

## Comparing strategies

Keep the case and scenario fixed, then change the strategy. The strategy can change the events and state transitions that follow. Inspect the intermediate trace as well as the final result, then run **Test all scenarios** to look for another declared counterexample.

If you find an additional sequence the model should represent, report the sequence and the assertion it violates.

## Sharing and downloading

### Scene links

**Share scene** creates a URL fragment with schema version `v=1` and these fields:

| Field | Meaning |
| --- | --- |
| `level` | `search` or `checkout` |
| `scenario` | A declared scenario identifier for that case |
| `strategy` | A declared strategy identifier for that case |
| `step` | The zero-based replay frame index |
| `lang` | `en` or `zh` |

For example, the fragment below selects the search case's reversed-response scenario with the generation guard at its first frame:

```text
#lab?v=1&level=search&scenario=out-of-order&strategy=latest&step=0&lang=en
```

The button copies the complete link. If the browser denies clipboard access, it downloads the link as `replayfault-scene.txt` instead. The fragment contains configuration, not the full event trace, code, or test results. Schema version `v=1` is a link format version, not a pinned app release: include the app version when reporting a result.

### Downloadable examples

**Example code** downloads one fixed standalone program for the selected case. It does not vary with the chosen scenario, strategy, replay position, or language.

| File | What its assertions cover |
| --- | --- |
| `replayfault-search.mjs` | Reversed responses, a debounce input-to-dispatch gap, repeated query text, and cleared input; contrasts stale commits with an input-generation guard. |
| `replayfault-checkout.mjs` | A check-then-create race, lost reply after commit, concurrent retries, changed parameters, a new purchase, failure before commit, and a new key incorrectly used for the same intent. |

Run the downloaded file with Node.js 22.12 or newer:

```sh
node replayfault-search.mjs
# Or, for the order case:
node replayfault-checkout.mjs
```

No package installation, network connection, credentials, payment SDK, or database is needed. These programs are separate minimal implementations, not exports of the browser engine. In particular, the search download checks result commits; the browser case additionally checks error and loading ownership.

The order program's store exists only in memory. Recreating its handler models a service restart while retaining that store; exiting Node loses the data. Assertions exercise the stated abstraction, not real storage durability.

### Local preferences

Local storage keeps only the selected language and the IDs of cases whose full scenario suite has passed. It does not save the replay, hints, or selected strategy. Clearing site storage resets those local preferences. A scene link restores its own scene and language independently of saved progress.

## 模型边界摘要

- 首版两关，每关八个已声明场景、五种策略。同一应用版本中的相同配置产生相同结果；毫秒数为虚拟事件时间。
- 搜索关检查结果、错误、加载状态的归属，以及最新意图最终能否结束等待。取消可以修复它确实能阻止的场景，但不会自动取消独立后处理。
- 订单关同时检查不重复、可恢复、结果一致和参数一致。它模拟明确边界上的崩溃与重启，并假定事务原子性和已提交状态的持久性；没有实现真实存储或支付。
- “检验全部场景”运行当前关卡的八个场景。通过有限检查不代表所有条件下都正确，也不验证另一个真实应用。
- “分享场景”保存关卡、场景、策略、帧位置与语言，链接格式为 `v=1`。它不包含完整轨迹，也没有固定应用版本。
- “下载示例”获取本关固定的 `.mjs` 教学程序，不随当前场景和策略变化。两个程序有各自的断言，与网页引擎分开实现；搜索下载只检查结果提交。
- 本地存储只保存语言与已通过整组场景检验的关卡进度。

See [sources and acknowledgements](sources.md) for primary references.
