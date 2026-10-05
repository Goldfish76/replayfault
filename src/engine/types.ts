export type Text = { en: string; zh: string }
export const t = (en: string, zh: string): Text => ({ en, zh })
export type LevelId = 'search' | 'checkout'
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
export interface Strategy {
  id: string
  label: Text
  description: Text
  code: string
}
export interface Scenario {
  id: string
  label: Text
  description: Text
}
export interface Level {
  id: LevelId
  title: Text
  subtitle: Text
  description: Text
  objective: Text
  strategies: Strategy[]
  scenarios: Scenario[]
  modelNotes: Text[]
  sources: { title: string; url: string }[]
}
export interface RequestView {
  id: string
  label: Text
  status: Text
  detail: Text
  tone: Tone
}
export interface Frame {
  id: number
  time: number
  event: { label: Text; detail: Text; tone: Tone }
  actors: { id: string; label: Text; value: Text; detail: Text; tone: Tone }[]
  metrics: { id: string; label: Text; value: string }[]
  requests: RequestView[]
  /** Machine-readable teaching state for inspection and deterministic checks. */
  state?: Record<string, unknown>
}
export interface Check {
  id: string
  label: Text
  passed: boolean
  detail: Text
}
export interface Run {
  levelId: LevelId
  scenarioId: string
  strategyId: string
  frames: Frame[]
  checks: Check[]
  passed: boolean
  summary: Text
}
export interface SuiteResult {
  results: Run[]
  passed: boolean
  passedCount: number
  total: number
}
