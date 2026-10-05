import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

const cases = [
  {
    id: 'search',
    title: 'The result that arrived too late',
    correct: 'Guard every UI write',
    filename: 'replayfault-search.mjs',
  },
  {
    id: 'checkout',
    title: 'One purchase, two orders',
    correct: 'One durable transaction',
    filename: 'replayfault-checkout.mjs',
  },
] as const

async function enterCase(page: Page, title: string) {
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport)
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport)
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('home opens both cases and returns without losing navigation', async ({ page }, testInfo) => {
  const browserErrors: string[] = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bad timing.Good instincts.')
  await expect(page.getByRole('heading', { level: 3, name: cases[0].title })).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: cases[1].title })).toBeVisible()
  await attachScreenshot(page, testInfo, 'desktop-home')
  for (const scenario of cases) {
    await enterCase(page, scenario.title)
    await expect(page.getByRole('region', { name: 'Simulation workspace' })).toBeVisible()
    await page.getByRole('button', { name: 'All cases', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Open your first case', exact: true }),
    ).toBeVisible()
  }
  expect(browserErrors).toEqual([])
})

for (const scenario of cases) {
  test(`${scenario.id}: incorrect strategy exposes a counterexample; correct strategy passes every declared scenario`, async ({
    page,
  }) => {
    await page.goto('/')
    await enterCase(page, scenario.title)
    const scenarioCount = await page
      .getByRole('combobox', { name: 'Scenario', exact: true })
      .locator('option')
      .count()
    expect(scenarioCount).toBeGreaterThanOrEqual(8)

    await page.getByRole('button', { name: /Test all scenarios/ }).click()
    await expect(
      page.getByRole('heading', { name: 'There is still a way to break it.', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.suite-results .suite-row.fail').first()).toBeVisible()
    await expect(page.locator('.suite-results .suite-row')).toHaveCount(scenarioCount)

    await page
      .getByRole('group', { name: 'Repair strategies', exact: true })
      .getByRole('button', { name: new RegExp(scenario.correct) })
      .click()
    await page.getByRole('button', { name: /Test all scenarios/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Your fix survived this case file.', exact: true }),
    ).toBeVisible()
    await expect(page.locator('.suite-results .suite-row.pass')).toHaveCount(scenarioCount)
    await expect(page.locator('.suite-results .suite-row.fail')).toHaveCount(0)
    await expect(page.locator('.suite-heading')).toContainText(
      `${scenarioCount} / ${scenarioCount}`,
    )

    // A result row opens that exact scenario at its final frame.
    const lastResult = page.locator('.suite-results .suite-row').last()
    const lastLabel = (await lastResult.locator('span').textContent())!
    await lastResult.click()
    await expect(page.getByRole('combobox', { name: 'Scenario', exact: true })).toHaveValue(
      (await page
        .getByRole('combobox', { name: 'Scenario', exact: true })
        .locator('option')
        .filter({ hasText: lastLabel })
        .getAttribute('value'))!,
    )
    await expect(page.getByText('This scenario passes.', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'All cases', exact: true }).click()
    await expect(page.locator(`.case-${scenario.id} .solved-badge`)).toHaveText('Verified')
  })

  test(`${scenario.id}: the downloaded standalone example runs its assertions`, async ({
    page,
  }) => {
    await page.goto('/')
    await enterCase(page, scenario.title)
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Example code', exact: true }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe(scenario.filename)
    expect(await download.failure()).toBeNull()
    const downloadedPath = await download.path()
    expect(downloadedPath).not.toBeNull()
    const source = await readFile(downloadedPath!, 'utf8')
    expect(source).toContain("import assert from 'node:assert/strict'")
    const result = spawnSync(process.execPath, ['--input-type=module'], {
      input: source,
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(result.error).toBeUndefined()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('PASS:')
    expect(result.stdout).toContain('通过：')
  })
}

test('step, run, pause, finish, replay, restart and keyboard controls operate on the timeline', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open your first case', exact: true }).click()
  await page.clock.install()
  const position = page.getByRole('slider', { name: 'Replay position', exact: true })
  await expect(position).toHaveValue('0')
  await page.getByRole('button', { name: 'Next event', exact: true }).click()
  await expect(position).toHaveValue('1')
  await page.getByRole('button', { name: 'Run', exact: true }).click()
  await page.clock.runFor(900)
  await expect(position).toHaveValue('2')
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.clock.runFor(2_000)
  await expect(position).toHaveValue('2')

  await position.focus()
  await position.press('End')
  await expect(page.getByRole('button', { name: 'Next event', exact: true })).toBeDisabled()
  await expect(page.getByText('A counterexample found.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(position).toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Restart replay', exact: true }).click()
  await expect(position).toHaveValue('0')
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeVisible()

  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.press('ArrowRight')
  await expect(position).toHaveValue('1')
})

test('the keyboard skip link keeps the current case and replay position', async ({ page }) => {
  await page.goto('/')
  await enterCase(page, cases[1].title)
  await page.getByRole('button', { name: 'Next event', exact: true }).click()
  const urlBeforeSkip = page.url()
  const position = page.getByRole('slider', { name: 'Replay position', exact: true })
  await expect(position).toHaveValue('1')

  const skipLink = page.getByRole('link', { name: 'Skip to content', exact: true })
  await skipLink.focus()
  await skipLink.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(
    page.getByRole('heading', { level: 1, name: cases[1].title, exact: true }),
  ).toBeVisible()
  await expect(position).toHaveValue('1')
  await expect(page).toHaveURL(urlBeforeSkip)
})

test('a shared hash restores scenario, strategy, timeline position and Chinese in a new page', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await enterCase(page, cases[0].title)
  await page
    .getByRole('combobox', { name: 'Scenario', exact: true })
    .selectOption('same-query-filter')
  await page
    .getByRole('group', { name: 'Repair strategies', exact: true })
    .getByRole('button', { name: /Guard every UI write/ })
    .click()
  await page.getByRole('button', { name: 'Next event', exact: true }).click()
  await page.getByRole('button', { name: 'Next event', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await page.getByRole('button', { name: '分享场景', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('场景链接已复制')
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toBe(page.url())
  const params = new URLSearchParams(new URL(shared).hash.slice(5))
  expect(Object.fromEntries(params)).toMatchObject({
    v: '1',
    level: 'search',
    scenario: 'same-query-filter',
    strategy: 'latest',
    step: '2',
    lang: 'zh',
  })

  const restored = await context.newPage()
  await restored.goto(shared)
  await expect(
    restored.getByRole('heading', { level: 1, name: '迟到的搜索结果', exact: true }),
  ).toBeVisible()
  await expect(restored.getByRole('combobox', { name: '场景', exact: true })).toHaveValue(
    'same-query-filter',
  )
  await expect(restored.getByRole('slider', { name: '回放位置', exact: true })).toHaveValue('2')
  await expect(
    restored
      .getByRole('group', { name: '修复策略', exact: true })
      .getByRole('button', { name: /保护每一次界面更新/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await restored.getByRole('tab', { name: '学习笔记', exact: true }).click()
  await expect(
    restored.getByRole('heading', { name: '区分“工作完成”和“结果仍可接受”。', exact: true }),
  ).toBeVisible()
  await restored.getByRole('button', { name: '需要一点提示？', exact: false }).click()
  await expect(restored.getByText('1 · 跟踪一条旧响应', { exact: true })).toBeVisible()
  await restored.getByRole('button', { name: '切换至英文', exact: true }).click()
  await expect(
    restored.getByRole('heading', { level: 1, name: cases[0].title, exact: true }),
  ).toBeVisible()
  await expect(restored.getByRole('slider', { name: 'Replay position', exact: true })).toHaveValue(
    '2',
  )
})

for (const width of [320, 375]) {
  test(`mobile ${width}px: English and Chinese home and both labs have no horizontal overflow`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 812 })
    await page.goto('/')
    await expectNoHorizontalOverflow(page)
    await attachScreenshot(page, testInfo, `home-${width}`)
    for (const scenario of cases) {
      await enterCase(page, scenario.title)
      await expectNoHorizontalOverflow(page)
      const slider = page.getByRole('slider', { name: 'Replay position', exact: true })
      await slider.focus()
      await slider.press('End')
      await page.getByRole('button', { name: /Test all scenarios/ }).click()
      await expectNoHorizontalOverflow(page)
      await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click()
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
      await expectNoHorizontalOverflow(page)
      await attachScreenshot(page, testInfo, `${scenario.id}-zh-${width}`)
      await page.getByRole('button', { name: '切换至英文', exact: true }).click()
      await page.getByRole('button', { name: 'All cases', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Switch to Chinese', exact: true }).click()
    await expectNoHorizontalOverflow(page)
  })
}
