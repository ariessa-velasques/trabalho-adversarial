import { useEffect, useRef, useState } from 'react'
import { BarChart3, GitBranch, MessageSquare, Play, SlidersHorizontal, Crosshair, Shield, ClipboardCheck, Download } from 'lucide-react'
import { RUN_ID, initialContests, rounds, type Contest, type View } from './data'
import { AppCtx, defaultCfg, hashCfg, type Cfg, type Run } from './state'
import { Btn, download } from './ui'
import Config from './tabs/Config'
import Execution from './tabs/Execution'
import Rounds from './tabs/Rounds'
import Metrics from './tabs/Metrics'
import Contestation from './tabs/Contestation'

const TABS = [
  { l: 'Configuração', i: SlidersHorizontal },
  { l: 'Execução', i: Play },
  { l: 'Rodadas', i: GitBranch },
  { l: 'Métricas', i: BarChart3 },
  { l: 'Contestação', i: MessageSquare },
]
const idle: Run = { status: 'idle', done: 0, tick: 0, total: 6, id: RUN_ID, hash: '', label: '', step: false, pauseReq: false, defense: 'redesign', seed: 42, elapsed: 0, speed: 3000, mode: 'visual', stage: 0 }
const TICKS = 6


export default function App() {
  const [tab, setTab] = useState(0)
  const [view, setView] = useState<View>('eval')
  const [cfg, setCfg] = useState<Cfg>(defaultCfg)
  const [run, setRun] = useState<Run>(idle)
  const [contests, setContests] = useState<Contest[]>(initialContests)
  const [round, setRound] = useState(3)
  const [toasts, setToasts] = useState<{ id: number; m: string }[]>([])
  const tid = useRef(0)

  const toast = (m: string) => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, m }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  const startRun = (step: boolean, mode: 'visual' | 'brute' | 'manual' = 'visual') => {
    const total = cfg.rounds
    setRound(Math.min(3, total))
    setRun({ ...idle, mode, speed: mode === 'brute' ? 140 : run.speed <= 140 ? 3000 : run.speed, status: 'running', total, step, hash: hashCfg(cfg), label: cfg.label, defense: cfg.defense, seed: cfg.seed })
    setTab(1)
  }

  useEffect(() => {
    if (run.status !== 'running' || run.mode === 'manual') return
    const t = setTimeout(() => {
      setRun((r) => {
        const ticksN = Math.min(8, rounds[Math.min(r.done, rounds.length - 1)].attempts)
        if (r.tick + 1 < ticksN) return { ...r, tick: r.tick + 1 }
        const done = r.done + 1
        const status = done >= r.total ? 'done' : r.step || r.pauseReq ? 'paused' : 'running'
        return { ...r, tick: 0, done, status, pauseReq: false, elapsed: (done * 8 * r.speed) / 1000 }
      })
    }, run.speed)
    return () => clearTimeout(t)
  }, [run.status, run.tick, run.done, run.speed])

  useEffect(() => {
    if (run.status === 'done') toast(`Execução concluída: ${run.total} rodadas`)
    if (run.status === 'paused') toast(`Execução pausada na rodada ${run.done}`)
  }, [run.status])

  const ctx = {
    view, cfg, setCfg, run, startRun, contests, setContests, toast, goTab: setTab, round, setRound,
    pauseRun: () => setRun((r) => ({ ...r, pauseReq: true })),
    resumeRun: () => setRun((r) => ({ ...r, status: 'running', pauseReq: false })),
    stopRun: () => setRun((r) => ({ ...r, status: 'paused', pauseReq: false, step: true })),
    keyOk: false,
    stepManual: (a: 'next' | 'prev' | 'attempt' | 'round') => setRun((r) => {
      if (r.status !== 'running') return r
      const ticksOf = (i: number) => Math.min(8, rounds[Math.min(i, rounds.length - 1)].attempts)
      const nextRound = (): Run => { const d = r.done + 1; return { ...r, done: d, tick: 0, stage: 0, status: d >= r.total ? 'done' : 'running', elapsed: d * 8 * 3 } }
      const nextAttempt = (): Run => (r.tick + 1 < ticksOf(r.done) ? { ...r, tick: r.tick + 1, stage: 0 } : nextRound())
      if (a === 'round') return nextRound()
      if (a === 'attempt') return nextAttempt()
      if (a === 'next') return r.stage < 4 ? { ...r, stage: r.stage + 1 } : nextAttempt()
      if (r.stage > 0) return { ...r, stage: r.stage - 1 }
      if (r.tick > 0) return { ...r, tick: r.tick - 1, stage: 4 }
      if (r.done > 0) return { ...r, done: r.done - 1, tick: ticksOf(r.done - 1) - 1, stage: 4 }
      return r
    }),
    autoFinish: () => setRun((r) => ({ ...r, mode: 'visual', speed: r.speed <= 140 ? 3000 : r.speed })),
    setSpeed: (ms: number) => setRun((r) => ({ ...r, speed: ms })),
  }
  const hasRun = run.status !== 'idle'
  const exportAll = () => {
    const rows = ['round,attack,defense,attempts,accepted,refused,verifications,limited,redemptions,budget_debited,bot_cost']
    rounds.slice(0, Math.max(run.done, 1)).forEach((r) => rows.push([r.r, r.attack, r.defense, r.attempts, r.accepted, r.refused, r.verif, r.limited, r.redemptions, r.budget, r.botCost].join(',')))
    download('metrics.csv', rows.join('\n'), 'text/csv')
    toast('metrics.csv baixado')
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surface">
          <div className="flex h-14 items-center gap-6 px-8">
            <div className="leading-tight">
              <p className="text-[15px] font-semibold">PedeJá <span className="text-muted">· Laboratório adversarial</span></p>
              <p className="text-xs text-muted">Simulador do cupom <span className="num">BEMVINDO</span></p>
            </div>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted">
              <span className="num">{hasRun ? run.id : 'sem execução'}</span>
              <span className="num">seed {cfg.seed}</span>
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${run.status === 'running' ? 'bg-accepted' : run.status === 'done' ? 'bg-accepted' : run.status === 'paused' ? 'bg-verification' : 'bg-[#98a2b3]'}`} />
                {{ idle: 'ocioso', running: 'executando', paused: 'pausado', done: 'concluído' }[run.status]}
              </span>
              <span>{cfg.runMode === 'deterministic' ? 'determinístico' : 'LLM'} | {cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'}</span>
              <div className="flex items-center gap-2 border-l border-line pl-4">
                <span className="font-medium text-ink">Visão</span>
                <div role="radiogroup" aria-label="Modo de visualização" className="inline-flex rounded-lg border border-line bg-[#f2f4f7] p-0.5">
                  {([['eval', 'Avaliação', ClipboardCheck], ['bot', 'Bot', Crosshair], ['engine', 'Motor', Shield]] as const).map(([v, l, I]) => (
                    <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-medium ${view === v ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
                      <I size={13} className={view === v ? (v === 'bot' ? 'text-bot' : v === 'engine' ? 'text-engine' : 'text-accent') : ''} />{l}
                    </button>
                  ))}
                </div>
              </div>
              <Btn onClick={exportAll} icon={<Download size={14} />}>Exportar</Btn>
            </div>
          </div>
          <nav className="flex gap-1 px-8" role="tablist" aria-label="Seções">
            {TABS.map((t, i) => (
              <button key={t.l} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] font-medium ${tab === i ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                <t.i size={16} />{t.l}
              </button>
            ))}
          </nav>
        </header>

        {view !== 'eval' && (
          <div className={`border-b px-8 py-2 text-[13px] ${view === 'bot' ? 'border-[#d9ccff] bg-[#f4f0ff]' : 'border-[#b2dfe2] bg-[#e6f6f7]'}`}>
            {view === 'bot' ? (
              <>Você está vendo a execução como o <b>bot</b> viu: apenas respostas públicas, próprias contas e custos. Rótulos, motivos internos e a política do motor ficam ocultos.</>
            ) : (
              <>Você está vendo a execução como o <b>motor</b> viu: sinais, histórico, relações, limites e orçamento. Tática, custo do bot e rótulos ficam ocultos.</>
            )}
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-8 py-6">
          {tab === 0 && <Config />}
          {tab === 1 && <Execution />}
          {tab === 2 && <Rounds />}
          {tab === 3 && <Metrics />}
          {tab === 4 && <Contestation />}
        </main>

        <footer className="border-t border-line bg-surface px-8 py-2.5 text-xs text-muted">
          Dados sintéticos · nenhum dado pessoal real · execução local · v0.1
        </footer>

        <div className="fixed bottom-12 right-6 z-50 flex flex-col gap-2" aria-live="polite">
          {toasts.map((t) => <div key={t.id} className="rounded-lg bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">{t.m}</div>)}
        </div>
      </div>
    </AppCtx.Provider>
  )
}
