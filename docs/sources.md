# Sources and acknowledgements

ReplayFault's cases are independently implemented teaching models. These references explain the underlying mechanisms; they are not claims that ReplayFault reproduces a provider's implementation or a particular production incident.

## Primary references

### Search response ordering

- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) describes an earlier search response arriving after a newer one and discusses ignoring stale responses.
- [React: useEffect](https://react.dev/reference/react/useEffect) explains cleanup and includes a data-fetching example that guards against responses arriving out of order.
- [MDN: AbortController.abort()](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort) documents cancellation of supported asynchronous operations, including fetch and response-body consumption.

These references support the failure pattern. The ReplayFault model is not a full implementation of React or its lifecycle.

### Retries and duplicate effects

- [AWS Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/) discusses repeated requests, caller-provided request identifiers, and the assumptions behind retry-safe API behavior.
- [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) documents replaying results under the same key and checking request parameters. Its retention and concurrency behavior are provider-specific contracts.
- [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) explains atomic updates and durability, the properties assumed by the order model's transaction boundary.

The order case is a generic teaching example. It does not implement Stripe's full contract, make real payments, or run PostgreSQL. Its in-memory programs make the assumed boundary visible without supplying actual durable storage.

## Related projects

- [The Deadlock Empire](https://github.com/deadlockempire/deadlockempire.github.io) demonstrates how manually choosing an execution order can make concurrency problems understandable.
- [Breakscale](https://github.com/xevrion/breakscale) provides interactive system-design simulation and failure exploration.
- [SadServers](https://github.com/SadServers/sadservers) offers hands-on troubleshooting scenarios.

These projects helped frame the problem space during research. Their listing here is an acknowledgement, not an endorsement or a declaration that their code is included.

## 来源说明

以上一手资料用于支持案例中的故障机制。ReplayFault 独立实现教学模型，不复刻某一服务商的内部系统，也不将模型结果当作真实生产事故的测量数据。

如果某个模型与引用资料不一致，欢迎提交具体的事件序列、预期行为和对应来源。
