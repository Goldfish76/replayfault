export * from './types'
export { levels, getLevel } from './metadata'
import { getLevel } from './metadata'
import { simulateSearch } from './search'
import { simulateCheckout } from './checkout'
import type { LevelId, Run, SuiteResult } from './types'

export function simulate(levelId: LevelId, scenarioId: string, strategyId: string): Run {
  const level = getLevel(levelId)
  if (!level.scenarios.some((scenario) => scenario.id === scenarioId))
    throw new Error(`Unknown scenario: ${scenarioId}`)
  if (!level.strategies.some((strategy) => strategy.id === strategyId))
    throw new Error(`Unknown strategy: ${strategyId}`)
  return levelId === 'search'
    ? simulateSearch(scenarioId, strategyId)
    : simulateCheckout(scenarioId, strategyId)
}

export function checkSuite(levelId: LevelId, strategyId: string): SuiteResult {
  const results = getLevel(levelId).scenarios.map((scenario) =>
    simulate(levelId, scenario.id, strategyId),
  )
  return {
    results,
    passed: results.every((result) => result.passed),
    passedCount: results.filter((result) => result.passed).length,
    total: results.length,
  }
}
