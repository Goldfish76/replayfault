# ReplayFault

[![CI](https://github.com/Goldfish76/replayfault/actions/workflows/ci.yml/badge.svg)](https://github.com/Goldfish76/replayfault/actions/workflows/ci.yml)

**Make an async bug happen. Replay it. Find out whether the fix holds.**

ReplayFault is an open-source browser lab for the bugs that depend on *when* something happens. Step through a failing event sequence, compare strategies under the same scenario, and share the scene to explain the result to someone else.

Two cases · eight scenarios and five strategies per case · English and Chinese

[简体中文](README.zh-CN.md) · [Model notes](docs/models.md) · [Contribute](CONTRIBUTING.md)

**[Play ReplayFault in your browser →](https://goldfish76.github.io/replayfault/)**

![ReplayFault: replay an async failure and compare repair strategies](docs/replayfault-demo.gif)

[View the static screenshot](docs/screenshot.png)

## Two small incidents, one useful question

| Incident | What goes wrong | What the replay checks |
| --- | --- | --- |
| Search results arrive out of order | Old work changes the current result, error, or loading state. | Does the latest user intent own every UI update and reach an outcome? |
| An order is created twice | A lost response, concurrent retry, or restart exposes a duplicate order. | Can each purchase recover, keep one order, and reject inconsistent retry parameters? |

Each case asks: does this strategy still work under this event sequence?

## Try a case

1. Pick a case, scenario, and strategy.
2. Run the replay, pause, step forward, or select an event to inspect its state. At the end, inspect each check and its explanation.
3. Compare another strategy under the same scenario.
4. Select **Test all scenarios** to challenge that strategy against all eight declared scenarios in the case.
5. Use **Share scene** to capture the current scene, or **Example code** to download the case's standalone teaching program.

The same configuration in the same app version produces the same modeled replay. The interface and the checks use the same simulation result, so the explanation follows what actually happened in the model.

The app runs in your browser and can be served as static files. It requires no account, API key, or application backend.

## Share a scene or take home the code

Scene links capture the case, scenario, strategy, replay position, and language using a versioned URL fragment. Local storage keeps only your language and verified-case progress.

**Example code** downloads one file for the selected case: `replayfault-search.mjs` or `replayfault-checkout.mjs`. Each is a fixed, dependency-free teaching program with its own assertions. It is separate from the interactive engine and does not export your current scene. After downloading, run the relevant file with Node.js:

```sh
node replayfault-search.mjs
node replayfault-checkout.mjs
```

See [sharing and download details](docs/models.md#sharing-and-downloading) for the format and differences in coverage.

## Run locally

Install Node.js 22.12 or newer and pnpm (the project pins pnpm 11.19.0), then:

```sh
git clone https://github.com/Goldfish76/replayfault.git
cd replayfault
pnpm install
pnpm dev
```

Open the local URL printed by the development server.

```sh
pnpm test      # Run the unit and model tests
pnpm build     # Type-check and build the static app
pnpm check     # Run tests and the build together
pnpm test:e2e  # Run browser interaction tests
```

Local browser tests use installed Microsoft Edge on Windows. Other platforms and CI use Playwright's Chromium; install it before the first run:

```sh
pnpm exec playwright install chromium
```

The browser tests start their own local development server. Set `PLAYWRIGHT_CHANNEL` to select a browser channel. For example, to use the downloaded Chromium on Windows PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chromium"
pnpm test:e2e
```

## What a successful replay means

ReplayFault v0.1.0 contains two curated teaching models. A successful check means the selected strategy satisfies the case's assertions under the modeled conditions. It does not validate a real application's code, network, database, or deployment.

The clock and event ordering are simulated. Use the lab to understand a mechanism, reproduce an example, and discuss a fix; verify a production fix in its actual environment. See [the model assumptions and limits](docs/models.md).

## Help make the examples better

Useful contributions include a reproducible counterexample, a clearer explanation, an accessibility improvement, or a small scenario with explicit assertions. Start with [CONTRIBUTING.md](CONTRIBUTING.md). New cases should earn their place through a concrete failure and a testable explanation.

If you want to return to these examples or follow new cases, you can star the repository.

## Sources and license

The examples draw on documented asynchronous failure patterns. [Sources and acknowledgements](docs/sources.md) identify the relevant primary references and related projects. ReplayFault's examples are independently implemented teaching models.

[MIT](LICENSE) © 2026 ReplayFault contributors.
