import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Fingerprint,
  FlaskConical,
  GitBranch,
  GitFork,
  Globe2,
  Layers3,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  SkipForward,
  Terminal,
  Timer,
  X,
  XCircle,
} from 'lucide-react'
import { levels, simulate, checkSuite } from './engine'
import type { LevelId, Text } from './engine'
import { lessonContent } from './content/catalog'
import {
  downloadText,
  makeShare,
  parseShare,
  readPreferences,
  savePreferences,
} from './lib/session'
import type { Language } from './lib/session'

const REPO = 'https://github.com/Goldfish76/replayfault'
const initialPreferences = readPreferences()
const initialShare = parseShare(window.location.hash)
const initialLevel = levels.find((l) => l.id === initialShare?.level) || levels[0]
const initialScenario =
  initialLevel.scenarios.find((s) => s.id === initialShare?.scenario) || initialLevel.scenarios[0]
const initialStrategy =
  initialLevel.strategies.find((s) => s.id === initialShare?.strategy) || initialLevel.strategies[0]

function App() {
  const [lang, setLang] = useState<Language>(initialShare?.lang || initialPreferences.lang)
  const [view, setView] = useState<'home' | 'lab'>(initialShare ? 'lab' : 'home')
  const [levelId, setLevelId] = useState<LevelId>(initialLevel.id)
  const [scenarioId, setScenarioId] = useState(initialScenario.id)
  const [strategyId, setStrategyId] = useState(initialStrategy.id)
  const [step, setStep] = useState(initialShare?.step || 0)
  const [playing, setPlaying] = useState(false)
  const [hintCount, setHintCount] = useState(0)
  const [suite, setSuite] = useState<ReturnType<typeof checkSuite> | null>(null)
  const [solved, setSolved] = useState<string[]>(initialPreferences.solved)
  const [toast, setToast] = useState('')
  const [notesTab, setNotesTab] = useState<'investigate' | 'learn'>('investigate')
  const [showCode, setShowCode] = useState(false)
  const suiteRef = useRef<HTMLDivElement>(null)
  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en)
  const tx = (text: Text) => text[lang]
  const level = levels.find((l) => l.id === levelId)!
  const scenario = level.scenarios.find((s) => s.id === scenarioId) || level.scenarios[0]
  const strategy = level.strategies.find((s) => s.id === strategyId) || level.strategies[0]
  const lesson = lessonContent[levelId]
  const run = useMemo(
    () => simulate(levelId, scenario.id, strategy.id),
    [levelId, scenario.id, strategy.id],
  )
  const frameIndex = Math.min(step, run.frames.length - 1)
  const frame = run.frames[frameIndex]
  const finished = frameIndex === run.frames.length - 1

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
    savePreferences(lang, solved)
  }, [lang, solved])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    if (!playing || finished) {
      if (finished) setPlaying(false)
      return
    }
    const timer = setInterval(() => setStep((n) => Math.min(n + 1, run.frames.length - 1)), 850)
    return () => clearInterval(timer)
  }, [playing, finished, run.frames.length])
  useEffect(() => {
    if (view !== 'lab') return
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select,button,a,summary')) return
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault()
        setPlaying(false)
        setStep((n) => Math.min(n + 1, run.frames.length - 1))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [view, run.frames.length])
  useEffect(() => {
    const onHash = () => {
      const incoming = parseShare(window.location.hash)
      if (!incoming) {
        setView('home')
        setPlaying(false)
        return
      }
      const next = levels.find((l) => l.id === incoming.level) || levels[0]
      setLevelId(next.id)
      setScenarioId(
        next.scenarios.find((s) => s.id === incoming.scenario)?.id || next.scenarios[0].id,
      )
      setStrategyId(
        next.strategies.find((s) => s.id === incoming.strategy)?.id || next.strategies[0].id,
      )
      setStep(incoming.step || 0)
      setLang(incoming.lang || 'en')
      setView('lab')
      setPlaying(false)
      setSuite(null)
      setHintCount(0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  function enter(id: LevelId) {
    const next = levels.find((l) => l.id === id)!
    setLevelId(id)
    setScenarioId(next.scenarios[0].id)
    setStrategyId(next.strategies[0].id)
    setStep(0)
    setPlaying(false)
    setSuite(null)
    setHintCount(0)
    setNotesTab('investigate')
    setView('lab')
    setShowCode(false)
    history.pushState(
      null,
      '',
      makeShare({
        level: id,
        scenario: next.scenarios[0].id,
        strategy: next.strategies[0].id,
        step: 0,
        lang,
      }),
    )
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function home() {
    setView('home')
    setPlaying(false)
    history.pushState(null, '', window.location.pathname + window.location.search)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  function chooseScenario(id: string) {
    setScenarioId(id)
    setStep(0)
    setPlaying(false)
  }
  function chooseStrategy(id: string) {
    setStrategyId(id)
    setStep(0)
    setPlaying(false)
    setSuite(null)
  }
  function validate() {
    setPlaying(false)
    const result = checkSuite(levelId, strategy.id)
    setSuite(result)
    if (result.passed) setSolved((prev) => (prev.includes(levelId) ? prev : [...prev, levelId]))
    setTimeout(
      () =>
        suiteRef.current?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'nearest',
        }),
      30,
    )
  }
  async function share() {
    const hash = makeShare({
      level: levelId,
      scenario: scenario.id,
      strategy: strategy.id,
      step: frameIndex,
      lang,
    })
    const url = window.location.origin + window.location.pathname + hash
    history.replaceState(null, '', hash)
    try {
      await navigator.clipboard.writeText(url)
      setToast(
        t(
          'Scene link copied. Same timing, same result.',
          '场景链接已复制。相同配置，可以复现相同结果。',
        ),
      )
    } catch {
      downloadText('replayfault-scene.txt', url)
      setToast(t('Scene link saved as a text file.', '场景链接已保存为文本文件。'))
    }
  }
  function download() {
    downloadText(
      lesson.reproduction.filename,
      lesson.reproduction.source,
      'text/javascript;charset=utf-8',
    )
    setToast(
      t('Runnable example downloaded. Run it with Node.js.', '示例已下载，可以用 Node.js 运行。'),
    )
  }

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          const main = document.getElementById('main')
          main?.focus({ preventScroll: true })
          main?.scrollIntoView({ behavior: 'instant' })
        }}
      >
        {t('Skip to content', '跳至内容')}
      </a>
      <header className="site-header">
        <button className="brand" onClick={home} aria-label="ReplayFault home">
          <span className="brand-mark">
            <RotateCcw size={19} />
          </span>
          <span>
            Replay<span className="brand-fault">Fault</span>
          </span>
          <span className="version">LAB / 01</span>
        </button>
        <nav aria-label={t('Main navigation', '主导航')}>
          <button
            className="header-link"
            onClick={() =>
              view === 'home'
                ? document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth' })
                : home()
            }
          >
            {t('The cases', '全部案例')}
          </button>
          <button
            className="language-toggle"
            onClick={() => setLang((l) => (l === 'en' ? 'zh' : 'en'))}
            aria-label={t('Switch to Chinese', '切换至英文')}
          >
            <Globe2 size={15} />
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <a className="github-link" href={REPO} target="_blank" rel="noreferrer">
            <GitFork size={17} />
            <span>GitHub</span>
            <ArrowRight size={14} />
          </a>
        </nav>
      </header>

      {view === 'home' ? (
        <main id="main" tabIndex={-1}>
          <section className="hero wrap">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" />
                {t('THE INTERACTIVE DEBUGGING LAB', '交互式故障实验室')}
              </div>
              <h1>
                {t('Bad timing.', '偶发的故障，')}
                <br />
                <span>{t('Good instincts.', '必现的现场。')}</span>
              </h1>
              <p className="hero-description">
                {t(
                  'Make the bug happen. Follow the evidence. Test your fix against the timing that breaks it.',
                  '让 Bug 发生，沿着线索调查，再用另一种事件顺序检验你的修复。',
                )}
              </p>
              <div className="hero-actions">
                <button className="button primary" onClick={() => enter('search')}>
                  {t('Open your first case', '开始第一个案例')}
                  <ArrowRight size={18} />
                </button>
                <span className="hero-meta">
                  <Timer size={15} />
                  {t('5 minutes. No setup.', '5 分钟，直接开始。')}
                </span>
              </div>
              <div className="hero-tags">
                <span>
                  <Check size={13} />
                  {t('Free & open source', '免费开源')}
                </span>
                <span>
                  <Check size={13} />
                  {t('Runs in your browser', '浏览器内运行')}
                </span>
                <span>
                  <Check size={13} />
                  {t('No account needed', '无需注册')}
                </span>
              </div>
            </div>
            <div
              className="hero-diagram"
              aria-label={t(
                'A late search response overwrites a newer result',
                '迟到的搜索响应覆盖了较新的结果',
              )}
            >
              <div className="diagram-header">
                <span className="tiny-label">CASE FILE 001</span>
                <span className="tag warm">{t('RACE CONDITION', '响应竞态')}</span>
              </div>
              <div className="mini-search">
                <Search size={17} />
                <span>cat</span>
                <span className="mini-key">↵</span>
              </div>
              <div className="request-route">
                <span className="route-label">
                  #01 <b>ca</b>
                </span>
                <div className="route-line slow">
                  <span className="route-packet" />
                </div>
                <span className="route-ms">900 ms</span>
              </div>
              <div className="request-route">
                <span className="route-label">
                  #02 <b>cat</b>
                </span>
                <div className="route-line fast">
                  <span className="route-packet" />
                </div>
                <span className="route-ms">300 ms</span>
              </div>
              <div className="diagram-result">
                <span className="result-icon">
                  <RotateCcw size={20} />
                </span>
                <div>
                  <b>{t('Wait. Why did it go back?', '等等，结果怎么退回去了？')}</b>
                  <p>{t('The older request arrived last.', '旧请求最后到达。')}</p>
                </div>
                <span className="fault-signal" />
              </div>
              <div className="diagram-foot">
                <Fingerprint size={15} />
                {t(
                  'Same events. Different order. Different outcome.',
                  '同样的事件，不同的顺序，不同的结果。',
                )}
              </div>
              <span className="diagram-coordinate">TRACE / 00:00.900</span>
            </div>
          </section>

          <section id="cases" className="cases-section wrap">
            <div className="section-heading">
              <div>
                <div className="eyebrow">{t('SEASON 01 / OUT OF ORDER', '第一季 / 顺序失控')}</div>
                <h2>{t('Two small apps. Two real lessons.', '两个小应用，两种真实问题。')}</h2>
              </div>
              <span className="case-count">
                02 {t('CASES', '个案例')}
                <ArrowDown size={15} />
              </span>
            </div>
            <div className="case-grid">
              {levels.map((l, index) => (
                <button key={l.id} className={'case-card case-' + l.id} onClick={() => enter(l.id)}>
                  <div className="case-top">
                    <span className="case-number">0{index + 1}</span>
                    <span className="tag">
                      {index === 0 ? t('FRONTEND', '前端') : t('BACKEND', '后端')}
                    </span>
                    {solved.includes(l.id) && (
                      <span className="solved-badge">
                        <CheckCircle2 size={13} />
                        {t('Verified', '已通过')}
                      </span>
                    )}
                  </div>
                  <div className="case-illustration" aria-hidden="true">
                    {l.id === 'search' ? (
                      <>
                        <div className="illus-search">
                          <Search size={20} />
                          <span>cat</span>
                        </div>
                        <div className="illus-result good">
                          <span />
                          <span />
                          <span />
                          <Check size={16} />
                        </div>
                        <div className="illus-result bad">
                          <RotateCcw size={16} />
                          <span />
                          <span />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="receipt">
                          <ShoppingBag size={19} />
                          <span>ORDER #001</span>
                          <i />
                          <i />
                          <b>1 ×</b>
                        </div>
                        <div className="receipt duplicate">
                          <ShoppingBag size={19} />
                          <span>ORDER #002</span>
                          <i />
                          <i />
                          <b>1 ×</b>
                        </div>
                        <div className="duplicate-label">× 2 ?</div>
                      </>
                    )}
                  </div>
                  <h3>{tx(l.title)}</h3>
                  <p>{tx(l.subtitle)}</p>
                  <div className="case-bottom">
                    <span>
                      <Timer size={14} />
                      {l.id === 'search' ? '4–6' : '6–8'} {t('min', '分钟')}
                    </span>
                    <span>
                      {t('Investigate', '进入调查')}
                      <ArrowRight size={17} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="method-section wrap">
            <div className="method-intro">
              <div className="eyebrow">{t('LEARN IT BY BREAKING IT', '亲手复现，真正理解')}</div>
              <h2>{t('A fix is a hypothesis.', '每一次修复，都是一个假设。')}</h2>
              <p>
                {t(
                  'Put it through a different sequence of events. Find out what it really guarantees.',
                  '换一组事件顺序，检验它究竟能保证什么。',
                )}
              </p>
            </div>
            <div className="method-steps">
              {[
                {
                  icon: Search,
                  n: '01',
                  title: t('Follow the evidence', '跟随线索'),
                  body: t(
                    'Pause the incident. Inspect what each part of the system knows.',
                    '暂停事故，看看系统各部分实际知道什么。',
                  ),
                },
                {
                  icon: GitBranch,
                  n: '02',
                  title: t('Change the mechanism', '改变机制'),
                  body: t(
                    'Choose a repair strategy and replay the exact same incident.',
                    '修改处理策略，重放完全相同的事故。',
                  ),
                },
                {
                  icon: ShieldCheck,
                  n: '03',
                  title: t('Challenge your fix', '检验修复'),
                  body: t(
                    'Run the counterexamples. Take home the code and the lesson.',
                    '运行反例，带走代码和理解。',
                  ),
                },
              ].map((x) => (
                <div className="method-step" key={x.n}>
                  <span className="method-icon">
                    <x.icon size={20} />
                  </span>
                  <div>
                    <h3>
                      <span>{x.n}</span>
                      {x.title}
                    </h3>
                    <p>{x.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <div className="open-note wrap">
            <Code2 size={20} />
            <p>
              {t(
                'Built to be understood. Every scenario, repair, and check is open source.',
                '每个场景、修复策略和检查规则都可查看源码。',
              )}
            </p>
            <a href={REPO} target="_blank" rel="noreferrer">
              {t('Explore the source', '查看源代码')}
              <ArrowUpRight />
            </a>
          </div>
        </main>
      ) : (
        <main id="main" className="lab wrap" tabIndex={-1}>
          <div className="lab-breadcrumb">
            <button onClick={home}>
              <ArrowLeft size={14} />
              {t('All cases', '全部案例')}
            </button>
            <span>/</span>
            <span>
              {levelId === 'search' ? '01' : '02'} · {tx(level.title)}
            </span>
            <span className="lab-model">
              <span className="live-dot" />
              {t('DETERMINISTIC LAB', '可重复的教学模型')}
            </span>
          </div>
          <div className="lab-heading">
            <div>
              <div className="eyebrow">
                {t('YOUR CASE', '当前案例')} / {levelId === 'search' ? '001' : '002'}
              </div>
              <h1>{tx(level.title)}</h1>
              <p>{tx(level.description)}</p>
            </div>
            <div className="lab-actions">
              <button className="button secondary compact" onClick={share}>
                <Copy size={15} />
                {t('Share scene', '分享场景')}
              </button>
              <button className="button secondary compact" onClick={download}>
                <Download size={15} />
                {t('Example code', '下载示例')}
              </button>
            </div>
          </div>
          <div className="objective">
            <span>
              <Fingerprint size={17} />
              {t('OBJECTIVE', '目标')}
            </span>
            <p>{tx(level.objective)}</p>
          </div>
          <div className="workbench">
            <section
              className="simulation-panel"
              aria-label={t('Simulation workspace', '模拟工作区')}
            >
              <div className="panel-heading">
                <span className="tiny-label">
                  <FlaskConical size={14} />
                  {t('THE SCENE', '故障现场')}
                </span>
                <label className="scenario-picker">
                  <span className="sr-only">{t('Scenario', '场景')}</span>
                  <select value={scenario.id} onChange={(e) => chooseScenario(e.target.value)}>
                    {level.scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {tx(s.label)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              <p className="scene-brief">{tx(scenario.description)}</p>
              <div className={'actors actors-' + levelId}>
                {frame.actors.map((actor, index) => (
                  <div className={'actor tone-' + actor.tone} key={actor.id}>
                    <div className="actor-label">
                      {levelId === 'search' ? (
                        index === 0 ? (
                          <Search size={15} />
                        ) : (
                          <Layers3 size={15} />
                        )
                      ) : index === 0 ? (
                        <ShoppingBag size={15} />
                      ) : (
                        <Layers3 size={15} />
                      )}
                      {tx(actor.label)}
                    </div>
                    <div className="actor-value">{tx(actor.value)}</div>
                    <div className="actor-detail">{tx(actor.detail)}</div>
                  </div>
                ))}
              </div>
              <div className="request-board">
                <div className="request-board-label">
                  <GitBranch size={13} />
                  {t('REQUEST TRACE', '请求轨迹')}
                  <span>
                    {frame.requests.length} {t('tracked', '条记录')}
                  </span>
                </div>
                {frame.requests.length === 0 ? (
                  <div className="trace-empty">
                    {t(
                      'Start the replay to watch the first request.',
                      '开始回放，观察第一个请求。',
                    )}
                  </div>
                ) : (
                  frame.requests.map((request) => (
                    <div className={'request-row tone-' + request.tone} key={request.id}>
                      <span className="request-dot" />
                      <div className="request-main">
                        <b>{tx(request.label)}</b>
                        <span>{tx(request.detail)}</span>
                      </div>
                      <span className="request-status">{tx(request.status)}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="metrics">
                {frame.metrics.map((metric) => (
                  <div key={metric.id}>
                    <span>{tx(metric.label)}</span>
                    <b>{metric.value}</b>
                  </div>
                ))}
              </div>
              <div className="transport">
                <div className="transport-buttons">
                  <button
                    className="icon-button"
                    aria-label={t('Restart replay', '重新回放')}
                    onClick={() => {
                      setStep(0)
                      setPlaying(false)
                    }}
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    className="button primary compact"
                    onClick={() => {
                      if (finished) setStep(0)
                      setPlaying(!playing)
                    }}
                  >
                    {playing ? <Pause size={15} /> : <Play size={15} />}
                    <span>
                      {playing
                        ? t('Pause', '暂停')
                        : finished
                          ? t('Replay', '重放')
                          : t('Run', '运行')}
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t('Next event', '下一事件')}
                    disabled={finished}
                    onClick={() => {
                      setPlaying(false)
                      setStep((n) => Math.min(n + 1, run.frames.length - 1))
                    }}
                  >
                    <SkipForward size={18} />
                  </button>
                </div>
                <span className="time-display">
                  {String(frame.time).padStart(4, '0')} <small>ms</small>
                  <span className="frame-count">
                    {frameIndex + 1}/{run.frames.length}
                  </span>
                </span>
              </div>
              <label className="scrubber">
                <span className="sr-only">{t('Replay position', '回放位置')}</span>
                <input
                  type="range"
                  min={0}
                  max={run.frames.length - 1}
                  value={frameIndex}
                  onChange={(e) => {
                    setPlaying(false)
                    setStep(Number(e.target.value))
                  }}
                />
              </label>
              <div
                className={'current-event tone-' + frame.event.tone}
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="event-indicator" />
                <div>
                  <b>{tx(frame.event.label)}</b>
                  <p>{tx(frame.event.detail)}</p>
                </div>
              </div>
              {finished && (
                <div className={'run-result ' + (run.passed ? 'pass' : 'fail')}>
                  {run.passed ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  <div>
                    <b>
                      {run.passed
                        ? t('This scenario passes.', '本场景通过。')
                        : t('A counterexample found.', '发现了一个反例。')}
                    </b>
                    <p>{tx(run.summary)}</p>
                  </div>
                </div>
              )}
              {finished && (
                <div className="assertions" aria-label={t('Scenario checks', '场景检查')}>
                  <h3>{t('What the evidence says', '证据说明了什么')}</h3>
                  {run.checks.map((check) => (
                    <div className={'assertion ' + (check.passed ? 'pass' : 'fail')} key={check.id}>
                      {check.passed ? (
                        <CheckCircle2 size={15} aria-label={t('Pass', '通过')} />
                      ) : (
                        <XCircle size={15} aria-label={t('Fail', '失败')} />
                      )}
                      <div>
                        <b>{tx(check.label)}</b>
                        <p>{tx(check.detail)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="investigation-panel">
              <div
                className="side-tabs"
                role="tablist"
                aria-label={t('Case information', '案例资料')}
              >
                <button
                  role="tab"
                  aria-selected={notesTab === 'investigate'}
                  aria-controls="case-information"
                  className={notesTab === 'investigate' ? 'active' : ''}
                  onClick={() => setNotesTab('investigate')}
                >
                  <Terminal size={14} />
                  {t('Event log', '事件日志')}
                </button>
                <button
                  role="tab"
                  aria-selected={notesTab === 'learn'}
                  aria-controls="case-information"
                  className={notesTab === 'learn' ? 'active' : ''}
                  onClick={() => setNotesTab('learn')}
                >
                  <BookOpen size={14} />
                  {t('Field notes', '学习笔记')}
                </button>
              </div>
              <div id="case-information" role="tabpanel">
                {notesTab === 'investigate' ? (
                  <>
                    <div className="log-head">
                      {t('Click an event to inspect that moment.', '点击事件，回到当时的现场。')}
                    </div>
                    <ol className="event-log">
                      {run.frames.slice(0, frameIndex + 1).map((f, i) => (
                        <li key={f.id}>
                          <button
                            className={
                              (i === frameIndex ? 'selected ' : '') + 'tone-' + f.event.tone
                            }
                            onClick={() => {
                              setStep(i)
                              setPlaying(false)
                            }}
                          >
                            <span className="log-time">
                              {f.time}
                              <small>ms</small>
                            </span>
                            <span className="log-line" />
                            <span className="log-label">{tx(f.event.label)}</span>
                            {i === frameIndex && <ChevronRight size={13} />}
                          </button>
                        </li>
                      ))}
                    </ol>
                    {frameIndex === 0 && (
                      <div className="log-prompt">
                        <Play size={16} />
                        <p>
                          {t(
                            'Run the scene, then pause when something looks wrong.',
                            '运行场景，在发现异常时暂停。',
                          )}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="field-notes">
                    <h3>{tx(lesson.debrief.headline)}</h3>
                    <p>{tx(lesson.debrief.body)}</p>
                    <ol>
                      {lesson.debrief.steps.map((s, i) => (
                        <li key={i}>{tx(s)}</li>
                      ))}
                    </ol>
                    <details>
                      <summary>{t('Model assumptions', '模型假设')}</summary>
                      <ul>
                        {lesson.assumptions.map((s, i) => (
                          <li key={i}>{tx(s)}</li>
                        ))}
                      </ul>
                    </details>
                    <details>
                      <summary>{t('Where the model stops', '模型边界')}</summary>
                      <ul>
                        {lesson.limits.map((s, i) => (
                          <li key={i}>{tx(s)}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="source-links">
                      {lesson.sources.map((s) => (
                        <a href={s.url} key={s.url} target="_blank" rel="noreferrer">
                          {tx(s.label)}
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="hint-area">
                <button
                  className="hint-button"
                  onClick={() => setHintCount((n) => Math.min(n + 1, lesson.hints.length))}
                  disabled={hintCount === lesson.hints.length}
                >
                  <Lightbulb size={16} />
                  {hintCount === lesson.hints.length
                    ? t('All hints revealed', '已显示全部提示')
                    : t('Need a nudge?', '需要一点提示？')}
                  <span>
                    {hintCount}/{lesson.hints.length}
                  </span>
                </button>
                {lesson.hints.slice(0, hintCount).map((hint, i) => (
                  <div className="hint" key={i}>
                    <b>{tx(hint.title)}</b>
                    <p>{tx(hint.body)}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <section className="repair-section">
            <div className="repair-heading">
              <div>
                <div className="eyebrow">{t('CHANGE ONE THING', '尝试一种修复')}</div>
                <h2>{t('What would you change?', '你会怎么改？')}</h2>
                <p>
                  {t(
                    'Each strategy changes the simulation. Try it, then challenge it.',
                    '每种策略都会改变模拟行为。试一遍，再用反例检验。',
                  )}
                </p>
              </div>
              <button className="button dark" onClick={validate}>
                <ShieldCheck size={17} />
                {t('Test all scenarios', '检验全部场景')}
                <span>{level.scenarios.length}</span>
              </button>
            </div>
            <div
              className="strategy-grid"
              role="group"
              aria-label={t('Repair strategies', '修复策略')}
            >
              {level.strategies.map((s, index) => (
                <button
                  className={'strategy-card ' + (s.id === strategy.id ? 'selected' : '')}
                  key={s.id}
                  aria-pressed={s.id === strategy.id}
                  onClick={() => chooseStrategy(s.id)}
                >
                  <div className="strategy-card-top">
                    <span className="strategy-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="radio-dot">{s.id === strategy.id && <Check size={10} />}</span>
                  </div>
                  <b>{tx(s.label)}</b>
                  <p>{tx(s.description)}</p>
                </button>
              ))}
            </div>
            <button
              className="code-toggle"
              onClick={() => setShowCode((v) => !v)}
              aria-expanded={showCode}
            >
              <Code2 size={15} />
              {t('Inspect the mechanism', '查看策略机制')}
              <ChevronDown size={14} />
            </button>
            {showCode && (
              <pre className="code-block">
                <code>{strategy.code}</code>
              </pre>
            )}
            {suite && (
              <div
                className={'suite-results ' + (suite.passed ? 'suite-pass' : '')}
                ref={suiteRef}
                aria-live="polite"
              >
                <div className="suite-heading">
                  <span className="suite-icon">
                    {suite.passed ? <ShieldCheck size={23} /> : <FlaskConical size={23} />}
                  </span>
                  <div>
                    <h3>
                      {suite.passed
                        ? t('Your fix survived this case file.', '这组修复通过了案例检验。')
                        : t('There is still a way to break it.', '仍然有一种情况会出错。')}
                    </h3>
                    <p>
                      {suite.passedCount} / {suite.total}{' '}
                      {t(
                        'declared scenarios pass. These checks apply to this teaching model.',
                        '个已声明场景通过。结论仅适用于此教学模型。',
                      )}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setSuite(null)}
                    aria-label={t('Close results', '关闭结果')}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="suite-grid">
                  {suite.results.map((result) => (
                    <button
                      className={'suite-row ' + (result.passed ? 'pass' : 'fail')}
                      key={result.scenarioId}
                      onClick={() => {
                        chooseScenario(result.scenarioId)
                        setStep(result.frames.length - 1)
                        window.scrollTo({ top: 200, behavior: 'smooth' })
                      }}
                    >
                      {result.passed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      <span>
                        {tx(level.scenarios.find((s) => s.id === result.scenarioId)!.label)}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
                <div className="suite-footer">
                  <button
                    className="text-button"
                    onClick={() => {
                      setNotesTab('learn')
                      window.scrollTo({ top: 200, behavior: 'smooth' })
                    }}
                  >
                    <BookOpen size={15} />
                    {t('Read the debrief', '阅读复盘')}
                  </button>
                  <button className="text-button" onClick={download}>
                    <Download size={15} />
                    {t('Take the example with you', '下载可运行示例')}
                  </button>
                  {suite.passed && (
                    <button
                      className="text-button"
                      onClick={() => enter(levelId === 'search' ? 'checkout' : 'search')}
                    >
                      {t('Try the other case', '体验另一个案例')}
                      <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
          <div className="lab-bottom-note">
            <CircleHelp size={15} />
            <p>
              {t(
                'A controlled teaching model. No real requests, payments, or production systems are involved.',
                '这是可控的教学模型，未连接真实请求、支付或生产系统。',
              )}
            </p>
            <a href={REPO + '/issues/new/choose'} target="_blank" rel="noreferrer">
              {t('Found a better counterexample?', '发现更好的反例？')}
              <ExternalLink size={12} />
            </a>
          </div>
        </main>
      )}
      <footer className="site-footer wrap">
        <span className="footer-brand">
          <RotateCcw size={14} />
          ReplayFault
        </span>
        <span>{t('Small failures. Lasting understanding.', '从小小的故障，建立持久的理解。')}</span>
        <div>
          <a href={REPO + '/blob/main/LICENSE'} target="_blank" rel="noreferrer">
            MIT
          </a>
          <a href={REPO + '/blob/main/CONTRIBUTING.md'} target="_blank" rel="noreferrer">
            {t('Contribute', '参与贡献')}
          </a>
          <span>v0.1.0</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </>
  )
}

function ArrowUpRight() {
  return <ArrowRight size={15} style={{ transform: 'rotate(-40deg)' }} />
}
export default App
