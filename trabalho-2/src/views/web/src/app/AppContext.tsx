import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createDemoSource, type SimulatorSource } from '../data/source'
import type { Contest, View } from '../data/types'

export type Preset = 'demo' | 'compare' | 'quick'
export type Defense = 'B1' | 'B2' | 'redesign'
export type ScenarioMode = 'adaptive' | 'guided'
export type ExecutionMode = 'deterministic' | 'adversarial_validation'
export type PlaybackMode = 'visual' | 'brute' | 'manual'

export interface Cfg {
  preset: Preset
  label: string
  seed: number
  scenario: ScenarioMode
  notes: string
  rounds: number

  runMode: ExecutionMode
  provider: string
  model: string
  temperature: number
  maxCalls: number

  defense: Defense
  generic: boolean
  limitOn: boolean
  limitMax: number
  limitWindow: number
  probing: boolean
  probingMin: number
  contestation: boolean

  discount: number
  minOrder: number
  acqBudget: number
  atkBudget: number
  commission: number

  costEmail: number
  costSms: number
  costEmu: number
  retreatCpa: number
  safety: number

  legit: number
  sharedDevice: number
  sharedAddress: number
  abandon: number

  outputs: Record<string, boolean>
}

export const PRESETS: Record<Preset, Partial<Cfg>> = {
  demo: {
    label: 'Demonstração — 6 rodadas',
    rounds: 6,
    scenario: 'adaptive',
    runMode: 'deterministic',
    defense: 'redesign',
  },
  compare: {
    label: 'Comparar defesas — 3 rodadas',
    rounds: 3,
    scenario: 'guided',
    runMode: 'deterministic',
    defense: 'redesign',
  },
  quick: {
    label: 'Teste rápido — 3 rodadas',
    rounds: 3,
    scenario: 'adaptive',
    runMode: 'deterministic',
    defense: 'redesign',
  },
}

export const defaultCfg: Cfg = {
  preset: 'demo',
  label: 'Demonstração — 6 rodadas',
  seed: 42,
  scenario: 'adaptive',
  notes: '',
  rounds: 6,

  runMode: 'deterministic',
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  temperature: 0,
  maxCalls: 1,

  defense: 'redesign',
  generic: true,
  limitOn: true,
  limitMax: 3,
  limitWindow: 24,
  probing: true,
  probingMin: 3,
  contestation: true,

  discount: 20,
  minOrder: 30,
  acqBudget: 100000,
  atkBudget: 5000,
  commission: 20,

  costEmail: 0,
  costSms: 5,
  costEmu: 12,
  retreatCpa: 20,
  safety: 0,

  legit: 100,
  sharedDevice: 12,
  sharedAddress: 18,
  abandon: 8,

  outputs: {
    'events.jsonl': true,
    'metrics.csv': true,
    'redemptions.csv': true,
    'attempts.csv': true,
    'llm_transcript.json': false,
  },
}

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

/** FNV-1a de 32 bits sobre a configuração canônica. */
export const hashCfg = (cfg: Cfg) => {
  const { label: _label, notes: _notes, ...rest } = cfg
  const json = JSON.stringify(stable(rest))
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash = Math.imul(hash ^ json.charCodeAt(i), 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, '0').slice(0, 6)
}

export interface Validation {
  errors: Record<string, string>
  warnings: string[]
}

export const validate = (cfg: Cfg): Validation => {
  const errors: Record<string, string> = {}
  const warnings: string[] = []

  if (!cfg.label.trim()) errors.label = 'Dê um nome à execução.'
  if (!Number.isInteger(cfg.seed)) errors.seed = 'A seed precisa ser um número inteiro.'
  if (!(cfg.discount > 0)) errors.discount = 'O desconto precisa ser maior que R$ 0.'
  if (!(cfg.minOrder >= 0)) errors.minOrder = 'Informe um valor mínimo válido.'
  if (!(cfg.acqBudget > 0)) errors.acqBudget = 'Informe um orçamento maior que zero.'
  if (!(cfg.atkBudget >= 0)) errors.atkBudget = 'Informe um orçamento válido.'
  if (!(cfg.commission >= 0 && cfg.commission <= 100)) errors.commission = 'A comissão fica entre 0% e 100%.'
  for (const key of ['sharedDevice', 'sharedAddress', 'abandon'] as const) {
    if (!(cfg[key] >= 0 && cfg[key] <= 100)) errors[key] = 'Use um valor entre 0% e 100%.'
  }
  if (!(cfg.legit >= 0)) errors.legit = 'Informe um número válido.'
  if (cfg.limitOn && !(cfg.limitMax >= 1)) errors.limitMax = 'O limite mínimo é 1 tentativa.'

  if (cfg.seed === 42) warnings.push('A seed 42 é a padrão; a execução será idêntica se a configuração não mudar.')
  if (cfg.atkBudget > cfg.acqBudget) warnings.push('O orçamento de ataque é maior que o da plataforma.')
  if (cfg.legit === 0) warnings.push('Coorte legítima igual a 0: não haverá falsos positivos para medir.')

  return { errors, warnings }
}

export interface Run {
  status: 'idle' | 'running' | 'paused' | 'done'
  done: number
  tick: number
  total: number
  id: string
  hash: string
  label: string
  step: boolean
  pauseRequested: boolean
  defense: Defense
  seed: number
  elapsed: number
  speed: number
  mode: PlaybackMode
  stage: number
}

const idleRun: Run = {
  status: 'idle',
  done: 0,
  tick: 0,
  total: 6,
  id: '',
  hash: '',
  label: '',
  step: false,
  pauseRequested: false,
  defense: 'redesign',
  seed: 42,
  elapsed: 0,
  speed: 900,
  mode: 'visual',
  stage: 0,
}

export interface Toast {
  id: number
  message: string
}

export interface Ctx {
  view: View
  setView: (view: View) => void
  cfg: Cfg
  setCfg: (cfg: Cfg) => void
  run: Run
  startRun: (step: boolean, mode?: PlaybackMode) => void
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => void
  stepManual: (action: 'next' | 'prev' | 'attempt' | 'round') => void
  autoFinish: () => void
  setSpeed: (ms: number) => void
  contests: Contest[]
  setContests: (contests: Contest[]) => void
  source: SimulatorSource
  toast: (message: string) => void
  toasts: Toast[]
  tab: number
  goTab: (tab: number) => void
  round: number
  setRound: (round: number) => void
}

const AppCtx = createContext<Ctx | null>(null)

export const useApp = () => {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp precisa estar dentro de AppProvider')
  return ctx
}

const makeRunId = (hash: string) => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `run_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}_${hash}`
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState(0)
  const [view, setView] = useState<View>('eval')
  const [cfg, setCfg] = useState<Cfg>(defaultCfg)
  const [run, setRun] = useState<Run>(idleRun)
  const [contests, setContests] = useState<Contest[]>(createDemoSource(defaultCfg.seed).initialContests)
  const [source, setSource] = useState<SimulatorSource>(() => createDemoSource(defaultCfg.seed))
  const [round, setRound] = useState(1)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)
  const lastStatus = useRef<Run['status']>('idle')

  const toast = useCallback((message: string) => {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200)
  }, [])

  const startRun = useCallback(
    (step: boolean, mode: PlaybackMode = 'visual') => {
      const nextSource = createDemoSource(cfg.seed)
      const hash = hashCfg(cfg)
      setSource(nextSource)
      setContests(nextSource.initialContests)
      setRound(1)
      setRun({
        ...idleRun,
        mode,
        speed: mode === 'brute' ? 140 : run.speed <= 140 ? 900 : run.speed,
        status: 'running',
        total: cfg.rounds,
        step,
        hash,
        label: cfg.label,
        defense: cfg.defense,
        seed: cfg.seed,
        id: makeRunId(hash),
      })
      setTab(1)
    },
    [cfg, run.speed],
  )

  useEffect(() => {
    if (run.status !== 'running' || run.mode === 'manual') return
    const currentRound = source.rounds[Math.min(run.done, run.total - 1)]
    const ticks = Math.max(1, Math.min(8, currentRound.attempts))

    const timer = window.setTimeout(() => {
      setRun((current) => {
        const elapsed = current.elapsed + current.speed / 1000
        if (current.tick + 1 < ticks) return { ...current, tick: current.tick + 1, elapsed }
        const done = current.done + 1
        const finished = done >= current.total
        const status = finished ? 'done' : current.step || current.pauseRequested ? 'paused' : 'running'
        return { ...current, tick: 0, done, status, pauseRequested: false, elapsed }
      })
    }, run.speed)

    return () => window.clearTimeout(timer)
  }, [run.status, run.tick, run.done, run.speed, run.mode, run.total, source])

  useEffect(() => {
    if (lastStatus.current === run.status) return
    lastStatus.current = run.status
    if (run.status === 'done') toast(`Execução concluída: ${run.total} rodadas`)
    if (run.status === 'paused') toast(`Execução pausada na rodada ${run.done}`)
  }, [run.status, run.total, run.done, toast])

  const pauseRun = useCallback(() => setRun((current) => ({ ...current, pauseRequested: true })), [])

  const resumeRun = useCallback(
    () => setRun((current) => ({ ...current, status: 'running', pauseRequested: false })),
    [],
  )

  const stopRun = useCallback(
    () => setRun((current) => ({ ...current, status: 'paused', pauseRequested: false, step: true })),
    [],
  )

  const stepManual = useCallback(
    (action: 'next' | 'prev' | 'attempt' | 'round') => {
      setRun((current) => {
        if (current.status !== 'running') return current

        const ticksOf = (index: number) =>
          Math.max(1, Math.min(8, source.rounds[Math.min(index, source.rounds.length - 1)].attempts))

        const nextRound = (): Run => {
          const done = current.done + 1
          return {
            ...current,
            done,
            tick: 0,
            stage: 0,
            status: done >= current.total ? 'done' : 'running',
            elapsed: current.elapsed + 0.4,
          }
        }

        const nextAttempt = (): Run =>
          current.tick + 1 < ticksOf(current.done)
            ? { ...current, tick: current.tick + 1, stage: 0 }
            : nextRound()

        if (action === 'round') return nextRound()
        if (action === 'attempt') return nextAttempt()
        if (action === 'next') {
          return current.stage < 4 ? { ...current, stage: current.stage + 1 } : nextAttempt()
        }
        if (current.stage > 0) return { ...current, stage: current.stage - 1 }
        if (current.tick > 0) return { ...current, tick: current.tick - 1, stage: 4 }
        if (current.done > 0) {
          return { ...current, done: current.done - 1, tick: ticksOf(current.done - 1) - 1, stage: 4 }
        }
        return current
      })
    },
    [source],
  )

  const autoFinish = useCallback(() => {
    setRun((current) =>
      current.status === 'done'
        ? current
        : {
            ...current,
            mode: 'visual',
            step: false,
            pauseRequested: false,
            status: 'running',
            speed: current.speed <= 140 ? 900 : current.speed,
          },
    )
  }, [])

  const setSpeed = useCallback((ms: number) => setRun((current) => ({ ...current, speed: ms })), [])

  const value = useMemo<Ctx>(
    () => ({
      view,
      setView,
      cfg,
      setCfg,
      run,
      startRun,
      pauseRun,
      resumeRun,
      stopRun,
      stepManual,
      autoFinish,
      setSpeed,
      contests,
      setContests,
      source,
      toast,
      toasts,
      tab,
      goTab: setTab,
      round,
      setRound,
    }),
    [
      view,
      cfg,
      run,
      startRun,
      pauseRun,
      resumeRun,
      stopRun,
      stepManual,
      autoFinish,
      setSpeed,
      contests,
      source,
      toast,
      toasts,
      tab,
      round,
    ],
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
