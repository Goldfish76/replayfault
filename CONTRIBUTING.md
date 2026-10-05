# Contributing to ReplayFault

Thank you for helping make async failures easier to understand. Small, reproducible improvements are especially useful.

English and Chinese issues are welcome. 欢迎使用中文或英文提交问题和建议。

## Report something incorrect

Open a bug report with:

- The case, scenario, strategy, and scene link made with **Share scene**.
- What you did, what happened, and what you expected.
- Your browser and app version, if available.
- A source or minimal counterexample when the issue concerns the model's correctness.

Use synthetic data in reports. The built-in cases do not need private code or real customer records.

For a downloaded-code issue, include the `.mjs` filename, Node.js version, and terminal output. Downloads are fixed examples for each case; they do not capture the selected browser scenario.

## Propose a case before building it

Open a scenario proposal first so we can agree on scope. Include:

1. A concrete symptom and the audience who encounters it.
2. The smallest event sequence that causes the failure.
3. An explicit assertion that distinguishes success from failure.
4. At least one candidate fix and the assumptions it needs.
5. Primary references and any limits of the teaching model.

A useful scenario lets someone explain a real mechanism without a large amount of setup. New cloud services, accounts, arbitrary-code execution, or additional runtimes need a clear reason; the current product is a small static browser app.

## Develop and check a change

Use Node.js 22.12 or newer and pnpm 11.19.0.

```sh
pnpm install
pnpm dev
pnpm check
pnpm test:e2e
```

`pnpm check` runs `pnpm test` and `pnpm build`; each can also run separately. Browser tests start a local server automatically. Local Windows runs use installed Microsoft Edge. For Playwright Chromium on other platforms or in CI, first run `pnpm exec playwright install chromium` (CI also installs its system dependencies). `PLAYWRIGHT_CHANNEL` overrides the browser channel; use `chromium` to select downloaded Chromium on Windows.

Keep a pull request focused. For simulation changes, include a behavioral test for the failure or invariant being changed. Replay the affected case in the browser as well: check that the visible explanation and end-of-replay check details agree with the result.

For interface changes, check keyboard navigation and readable labels. For documentation changes, check links and keep the English and Chinese README consistent.

The interactive engine lives in `src/engine/`; lesson text and the separate downloadable programs live in `src/content/`. When changing a mechanism, check both implementations and describe their intended coverage. Shared scenes use schema `v=1` in `src/lib/session.ts`; consider existing links before changing identifiers or their meaning.

In the pull request description, state the problem, the resulting behavior, and what you verified. State any checks you could not run.

## Case quality

- Identical input must produce the same event sequence and result.
- A failure must follow from the model, rather than from a decorative animation.
- A passing check must name its assumptions and scope.
- Alternative valid solutions should be recognized when the model supports them.
- References should support the mechanism being taught. Reimplement examples in your own words and code; do not copy material without appropriate permission and attribution.

## License

By submitting a contribution, you agree that your contribution is provided under this repository's [MIT license](LICENSE). Keep appropriate notices for any permitted third-party material.
