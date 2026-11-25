import { Download, SlidersHorizontal, Play, GitBranch, BarChart3, MessageSquare, ClipboardCheck, Crosshair, Shield } from 'lucide-react'
import { AppProvider, useApp } from './app/AppContext'
import { Btn } from './components/ui'
import { download } from './lib/download'
import Config from './pages/Config'
import Execution from './pages/Execution'
import Rounds from './pages/Rounds'
import Metrics from './pages/Metrics'
import Contestation from './pages/Contestation'

const TABS = [
  { label: 'Configuração', icon: SlidersHorizontal },
  { label: 'Execução', icon: Play },
  { label: 'Rodadas', icon: GitBranch },
  { label: 'Métricas', icon: BarChart3 },
  { label: 'Contestação', icon: MessageSquare },
]

const VIEWS = [
  { value: 'eval', label: 'Avaliação', icon: ClipboardCheck },
  { value: 'bot', label: 'Bot', icon: Crosshair },
  { value: 'engine', label: 'Motor', icon: Shield },
] as const

const STATUS_LABEL = { idle: 'ocioso', running: 'executando', paused: 'pausado', done: 'concluído' } as const

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
        <defs>
          <clipPath id="ticket">
            <rect x="1.5" y="4.5" width="25" height="19" rx="4" />
          </clipPath>
        </defs>
        <rect x="1.5" y="4.5" width="25" height="19" rx="4" fill="#fff" stroke="#161a18" strokeWidth="1.5" />
        <g clipPath="url(#ticket)">
          <rect x="1.5" y="4.5" width="12.5" height="19" fill="#f1eefe" />
          <rect x="14" y="4.5" width="12.5" height="19" fill="#e9f4f1" />
        </g>
        <line x1="14" x2="14" y1="6" y2="22" stroke="#c8cec7" strokeWidth="1" strokeDasharray="2.2 2" />
        <circle cx="19" cy="9" r="2" fill="#cc4419" />
      </svg>
      <div className="leading-[1.15]">
        <p className="text-[14px] font-semibold tracking-[-0.01em]">
          PedeJá <span className="font-normal text-muted">· Laboratório adversarial</span>
        </p>
        <p className="text-[11.5px] text-muted">
          Simulador do cupom <span className="num font-medium text-ink">BEMVINDO</span>
        </p>
      </div>
    </div>
  )
}

function Shell() {
  const {
    tab,
    goTab,
    view,
    setView,
    cfg,
    run,
    source,
    toast,
    toasts,
  } = useApp()

  const exportAll = () => {
    const columns = [
      'round',
      ...(view !== 'engine' ? ['attack'] : []),
      ...(view !== 'bot' ? ['defense'] : []),
      'attempts',
      'accepted',
      'refused',
      'verifications',
      'limited',
      'redemptions',
      ...(view !== 'bot' ? ['budget_debited'] : []),
      ...(view !== 'engine' ? ['bot_cost'] : []),
    ]
    const rows = [columns.join(',')]
    source.rounds.slice(0, run.done).forEach((round) => {
      rows.push(
        [
          round.r,
          ...(view !== 'engine' ? [round.attack] : []),
          ...(view !== 'bot' ? [round.defense] : []),
          round.attempts,
          round.accepted,
          round.refused,
          round.verifications,
          round.limited,
          round.redemptions,
          ...(view !== 'bot' ? [round.budget] : []),
          ...(view !== 'engine' ? [round.botCost] : []),
        ].join(','),
      )
    })
    download('metrics.csv', rows.join('\n'), 'text/csv')
    toast(`metrics.csv baixado · visão ${view === 'eval' ? 'avaliação' : view === 'bot' ? 'bot' : 'motor'}`)
  }

  const statusColor = {
    idle: 'bg-[#98a2b3]',
    running: 'bg-accent',
    paused: 'bg-verification',
    done: 'bg-accepted',
  }[run.status]

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-[6px]">
        <div className="mx-auto flex min-h-14 w-full max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 md:px-8 lg:py-0">
          <Brand />

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-muted">
            <span className="num hidden sm:inline">{run.status === 'idle' ? 'sem execução' : run.id}</span>
            <span className="num hidden md:inline">seed {cfg.seed}</span>
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
              {STATUS_LABEL[run.status]}
            </span>
            <span className="hidden items-center gap-1.5 xl:flex">
              <span>{cfg.runMode === 'deterministic' ? 'determinístico' : 'LLM'}</span>
              <span className="text-line-strong">/</span>
              <span>{cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'}</span>
            </span>

            <div className="flex items-center gap-2 border-line lg:border-l lg:pl-4">
              <span className="hidden text-[11px] font-medium text-ink lg:inline">Visão</span>
              <div
                role="radiogroup"
                aria-label="Modo de visualização"
                className="inline-flex rounded-md border border-line bg-[#f0f1ed] p-[2px]"
              >
                {VIEWS.map((item) => {
                  const Icon = item.icon
                  const active = view === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setView(item.value)}
                      className={`flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11.5px] font-medium transition-colors ${
                        active ? 'bg-surface text-ink shadow-[0_1px_1px_rgba(22,26,24,0.06)]' : 'text-muted hover:text-ink'
                      }`}
                    >
                      <Icon
                        size={12}
                        className={
                          active
                            ? item.value === 'bot'
                              ? 'text-bot'
                              : item.value === 'engine'
                                ? 'text-engine'
                                : 'text-accent'
                            : ''
                        }
                      />
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Btn
              onClick={exportAll}
              icon={<Download size={13} />}
              className="hidden sm:inline-flex"
              disabled={run.status === 'idle'}
              title={run.status === 'idle' ? 'Execute uma simulação para exportar as métricas.' : undefined}
            >
              Exportar
            </Btn>
          </div>
        </div>

        <nav
          className="scroll-thin mx-auto flex w-full max-w-[1440px] gap-0 overflow-x-auto px-4 md:px-8"
          role="tablist"
          aria-label="Seções"
        >
          {TABS.map((item, index) => {
            const Icon = item.icon
            const active = tab === index
            return (
              <button
                key={item.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTab(index)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors first:pl-0 sm:px-4 ${
                  active ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      {view !== 'eval' && (
        <div
          className={`border-b px-4 py-2 text-[12px] md:px-8 ${
            view === 'bot' ? 'border-[#d3caf7] bg-bot-soft text-[#3f308f]' : 'border-[#b9dcd6] bg-engine-soft text-[#08524c]'
          }`}
        >
          <div className="mx-auto flex max-w-[1440px] items-start gap-2">
            {view === 'bot' ? <Crosshair size={14} className="mt-[1px] shrink-0" /> : <Shield size={14} className="mt-[1px] shrink-0" />}
            <p>
              {view === 'bot' ? (
                <>
                  Você está vendo a execução como o <b>bot</b> viu: apenas respostas públicas, próprias contas e
                  custos. Rótulos, motivos internos e a política do motor ficam ocultos.
                </>
              ) : (
                <>
                  Você está vendo a execução como o <b>motor</b> viu: sinais, histórico, relações, limites e orçamento.
                  Tática, custo do bot e rótulos ficam ocultos.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <main id="conteudo" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-8 md:py-7">
        {tab === 0 && <Config />}
        {tab === 1 && <Execution />}
        {tab === 2 && <Rounds />}
        {tab === 3 && <Metrics />}
        {tab === 4 && <Contestation />}
      </main>

      <footer className="border-t border-line bg-surface px-4 py-2.5 text-[11px] text-muted md:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
          <span>Dados sintéticos, nenhum dado pessoal real, execução local</span>
          <span className="num">v0.1 / seed {cfg.seed}</span>
        </div>
      </footer>

      <div className="fixed bottom-5 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 md:right-6" aria-live="polite">
        {toasts.map((item) => (
          <div
            key={item.id}
            className="rounded-lg bg-ink px-3.5 py-2.5 text-[12px] text-white shadow-lg shadow-ink/15"
          >
            {item.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
