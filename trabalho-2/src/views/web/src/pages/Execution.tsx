import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Footprints,
  Pause,
  Play,
  SkipForward,
  Square,
  Terminal,
  X,
} from 'lucide-react'
import { useApp } from '../app/AppContext'
import { brl, dec, int } from '../data/format'
import { EVENT_LABEL } from '../data/demo'
import { eventForView, isVisibleInView } from '../data/derive'
import type { Ev } from '../data/types'
import { Banner, Btn, CopyBtn, Hidden, PageHeader, Panel, Segmented, cx } from '../components/ui'
import { download } from '../lib/download'
import LiveSim from './LiveSim'
import AlertLog from './AlertLog'

export default function Execution() {
  const {
    run,
    cfg,
    view,
    source,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    goTab,
    toast,
    setSpeed,
    setRound,
  } = useApp()
  const [selected, setSelected] = useState<Ev | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)

  const roundIndex =
    run.status === 'running' || run.status === 'idle'
      ? Math.min(run.done, Math.max(0, source.rounds.length - 1))
      : Math.max(0, Math.min(run.done - 1, source.rounds.length - 1))
  const currentRound = source.rounds[roundIndex]
  const events = useMemo(() => source.eventsOf(currentRound), [source, currentRound])
  const simulationAttempts = useMemo(() => source.attemptsOf(currentRound), [source, currentRound])
  const ticks = Math.max(1, Math.min(8, currentRound.attempts))
  const fraction =
    run.status === 'running' ? (run.tick + (run.mode === 'manual' ? Math.min(run.stage, 4) : 0)) / ticks : 1
  const aggregate = source.totals(run.done)
  const progress = Math.round(
    ((run.status === 'running' ? run.done + fraction : run.status === 'done' ? run.total : run.done) / run.total) * 100,
  )

  if (run.status === 'idle') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <PageHeader
          title="Pronto para executar"
          description={cfg.label}
          meta={
            <>
              <span className="num">{cfg.runMode === 'deterministic' ? 'determinístico' : 'LLM'}</span>
              <span>{cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'}</span>
              <span>{cfg.defense === 'redesign' ? 'redesenho' : cfg.defense}</span>
              <span className="num">seed {cfg.seed}</span>
            </>
          }
          actions={<Btn onClick={() => goTab(0)}>Abrir configuração</Btn>}
        />

        <Panel>
          <div className="grid gap-6 sm:grid-cols-2">
            <ul className="space-y-2 text-[12.5px]">
              <li className="flex items-center gap-2 text-accepted">
                <Check size={14} />
                Configuração válida
              </li>
              <li className="flex items-center gap-2 text-accepted">
                <Check size={14} />
                Chave LLM não necessária
              </li>
              <li className="flex items-center gap-2 text-accepted">
                <Check size={14} />
                Sem chamadas externas
              </li>
            </ul>
            <ul className="space-y-1 text-[12.5px]">
              <li>
                <b className="num">{cfg.rounds}</b> rodadas × 7 dias
              </li>
              <li>
                <b className="num">~{cfg.rounds === 6 ? '1.000' : cfg.rounds * 160}</b> contas sintéticas
              </li>
              <li>
                orçamento <b className="num">{brl(cfg.acqBudget)}</b>
              </li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2 border-t border-line pt-5">
            <Btn variant="primary" icon={<Play size={13} />} onClick={() => startRun(false)}>
              Executar tudo
            </Btn>
            <Btn icon={<Footprints size={13} />} onClick={() => startRun(false, 'manual')}>
              Passo a passo na interface
            </Btn>
            <Btn icon={<SkipForward size={13} />} onClick={() => startRun(true)}>
              Executar rodada a rodada
            </Btn>
            <Btn icon={<Terminal size={13} />} onClick={() => startRun(false, 'brute')}>
              Modo bruto (sem interface)
            </Btn>
          </div>
          <p className="mt-3 text-center text-[11px] leading-4 text-muted">
            Passo a passo: você avança cada etapa da interface com um clique. Executar tudo: animação automática e lenta.
            Modo bruto: rápido, sem interface, com todos os avisos adversariais.
          </p>
        </Panel>
      </div>
    )
  }

  const live = run.status === 'running'
  const shownEvents = events
    .filter((event) => isVisibleInView(event, view))
    .slice(0, Math.max(1, Math.round(events.length * fraction)))
  const feed = shownEvents.slice(-40).reverse()
  const noTrigger = source.rounds[run.total - 1].engineLane[3].title.startsWith('Nenhum')
  const liveCount = (value: number) => Math.round(value * fraction)
  const eventLabel = (event: Ev) => EVENT_LABEL[event.type] ?? event.type

  const exportEvidence = () => {
    const completed = source.rounds.slice(0, run.done)
    const events = completed.flatMap((round) =>
      source.eventsOf(round).filter((event) => isVisibleInView(event, view)).map((event) => eventForView(event, view)),
    )
    download(
      `${run.id || 'run'}.json`,
      JSON.stringify(
        {
          run_id: run.id,
          master_seed: run.seed,
          config_hash: run.hash,
          view,
          exported_at: new Date().toISOString(),
          rounds_completed: completed.length,
          events,
        },
        null,
        2,
      ),
      'application/json',
    )
    toast('Evidências exportadas em JSON')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={
          live
            ? run.mode === 'manual'
              ? 'Passo a passo'
              : 'Executando…'
            : run.status === 'paused'
              ? 'Execução pausada'
              : 'Execução concluída'
        }
        meta={
          <>
            <span className="num">{run.id || 'sem run_id'}</span>
            <span className="num">hash {run.hash}</span>
            <span className="num">seed {run.seed}</span>
          </>
        }
        actions={
          <>
            {live && run.mode !== 'manual' && (
              <Btn
                icon={<Pause size={13} />}
                onClick={pauseRun}
                disabled={run.pauseRequested}
              >
                {run.pauseRequested ? 'Pausando ao fim da rodada…' : 'Pausar após rodada'}
              </Btn>
            )}
            {run.status === 'paused' && (
              <Btn variant="primary" icon={<Play size={13} />} onClick={resumeRun}>
                {run.step ? 'Próxima rodada' : 'Continuar'}
              </Btn>
            )}
            {(live || run.status === 'paused') && (
              <Btn variant="danger" icon={<Square size={11} />} onClick={() => setConfirmStop(true)}>
                Parar
              </Btn>
            )}
          </>
        }
      />

      {confirmStop && (
        <Banner
          kind="warn"
          title="Parar a execução?"
          action={
            <div className="flex gap-2">
              <Btn
                variant="danger"
                onClick={() => {
                  stopRun()
                  setConfirmStop(false)
                }}
              >
                Parar
              </Btn>
              <Btn onClick={() => setConfirmStop(false)}>Cancelar</Btn>
            </div>
          }
        >
          O JSONL parcial é preservado e a execução fica marcada como pausada.
        </Banner>
      )}

      {run.status === 'paused' && (
        <Banner kind="warn" title={`Execução pausada na rodada ${run.done}`}>
          As rodadas concluídas já estão disponíveis em Rodadas e Métricas.
        </Banner>
      )}

      {run.status === 'done' && (
        <>
          <Banner
            kind="success"
            title={`${run.total} rodadas concluídas em ${dec(run.elapsed, 1)} s · ${int(aggregate.redemptions)} resgates · orçamento ${brl(aggregate.budget)}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => goTab(2)}>Ver rodadas</Btn>
                <Btn onClick={() => goTab(3)}>Ver métricas</Btn>
                <Btn onClick={exportEvidence}>Exportar evidências</Btn>
              </div>
            }
          />
          {noTrigger && (
            <Banner kind="warn" title={`A rodada ${run.total} não mudou a política — nenhum gatilho foi acionado.`}>
              Isso também é evidência.
            </Banner>
          )}
        </>
      )}

      <Panel>
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e7e1]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da execução"
          >
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="num shrink-0 text-[11.5px] text-muted">
            {run.done} de {run.total} rodadas · {progress}%
          </p>
        </div>

        <ol className="scroll-thin mt-4 flex items-center overflow-x-auto pb-1">
          {source.rounds.slice(0, run.total).map((round, index) => {
            const done = index < run.done
            const active = index === run.done && run.status !== 'done'
            return (
              <li key={round.r} className="flex min-w-[120px] flex-1 items-center last:min-w-0 last:flex-none">
                <button
                  type="button"
                  onClick={() => {
                    if (done) {
                      setRound(round.r)
                      goTab(2)
                    }
                  }}
                  disabled={!done}
                  className="flex flex-col items-center gap-1 disabled:cursor-default"
                  aria-label={`Rodada ${round.r}: ${done ? 'concluída' : active ? 'em curso' : 'pendente'}`}
                >
                  <span
                    className={cx(
                      'grid h-7 w-7 place-items-center rounded-full border-2 text-[11.5px] font-semibold',
                      done
                        ? 'border-accepted bg-accepted text-white'
                        : active
                          ? 'border-accent text-accent'
                          : 'border-line text-muted',
                    )}
                  >
                    {done ? <Check size={13} /> : active ? <Circle size={8} fill="currentColor" /> : round.r}
                  </span>
                  <span className="text-[10.5px] text-muted">{done ? 'concluída' : active ? 'em curso' : 'pendente'}</span>
                </button>
                {index < run.total - 1 && (
                  <span className={cx('mx-2 mb-5 h-px flex-1', done ? 'bg-accepted' : 'bg-line')} />
                )}
              </li>
            )
          })}
        </ol>
      </Panel>

      {run.mode !== 'brute' ? (
        <>
          {run.mode === 'manual' && live && <ManualBar />}
          {run.mode === 'visual' && (
            <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
              <span className="text-muted">Velocidade da simulação</span>
              <Segmented
                value={String(run.speed)}
                onChange={(value) => setSpeed(Number(value))}
                options={[
                  { value: '400', label: 'Rápido' },
                  { value: '900', label: 'Normal' },
                  { value: '1800', label: 'Lento' },
                ]}
                label="Velocidade da simulação"
              />
            </div>
          )}
          <LiveSim
            round={currentRound}
            attempts={simulationAttempts}
            index={
              run.status === 'running'
                ? Math.min(simulationAttempts.length - 1, Math.floor((simulationAttempts.length * run.tick) / ticks))
                : simulationAttempts.length - 1
            }
            live={live && run.mode !== 'manual'}
            tickMs={run.speed}
            view={view}
            cfg={cfg}
            stage={run.mode === 'manual' && live ? run.stage : undefined}
          />
        </>
      ) : (
        <Banner kind="info" title="Modo bruto">
          Sem simulação visual. Os avisos aparecem no registro abaixo conforme as rodadas avançam.
        </Banner>
      )}

      {(run.mode === 'brute' || run.status !== 'running') && (
        <AlertLog
          done={run.done}
          current={live ? roundIndex : Math.max(0, run.done - 1)}
          fraction={live ? fraction : 1}
          total={run.total}
          finished={run.status === 'done'}
          view={view}
          live={live}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Rodada ${currentRound.r} · ${currentRound.dates}${view !== 'engine' ? ` · ${currentRound.attack}` : ''}`}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
            <dt className="text-muted">Tática</dt>
            <dd className="text-right font-medium">
              {view === 'engine' ? <Hidden what="Tática" /> : currentRound.tactic}
            </dd>
            <dt className="text-muted">Política</dt>
            <dd className="num text-right font-medium">
              {view === 'bot' ? <Hidden what="Política" /> : `${currentRound.policy} · ${currentRound.defense.toLowerCase()}`}
            </dd>
            <dt className="text-muted">Tentativas</dt>
            <dd className="num text-right font-medium">
              {liveCount(currentRound.attempts)} / {currentRound.attempts}
            </dd>
            <dt className="text-muted">Aceitas</dt>
            <dd className="num text-right font-medium">{liveCount(currentRound.accepted)}</dd>
            <dt className="text-muted">Recusadas</dt>
            <dd className="num text-right font-medium">{liveCount(currentRound.refused)}</dd>
            <dt className="text-muted">Resgates</dt>
            <dd className="num text-right font-medium">{liveCount(currentRound.redemptions)}</dd>
            <dt className="text-muted">Orçamento debitado</dt>
            <dd className="num text-right font-medium">
              {view === 'bot' ? <Hidden what="Orçamento" /> : brl(liveCount(currentRound.budget))}
            </dd>
            <dt className="text-muted">Custo do bot</dt>
            <dd className="num text-right font-medium">
              {view === 'engine' ? <Hidden what="Custo" /> : brl(liveCount(currentRound.botCost))}
            </dd>
          </dl>

          {view !== 'bot' && currentRound.r >= 3 && run.defense === 'redesign' && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="rule-label">Controles AM3 ativos</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(
                  [
                    [cfg.generic, 'mensagem genérica'],
                    [cfg.limitOn, `limite ${cfg.limitMax}/${cfg.limitWindow} h`],
                    [cfg.probing, `sondagem ≥ ${cfg.probingMin}`],
                    [cfg.contestation, 'contestação'],
                  ] as const
                ).map(([on, label]) => (
                  <span
                    key={label}
                    className={cx(
                      'rounded-full border px-2 py-[2px] text-[10.5px]',
                      on ? 'border-[#b9dcd6] bg-engine-soft text-engine' : 'border-line text-muted line-through',
                    )}
                  >
                    {on ? '✓ ' : ''}
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title="Eventos ao vivo"
          right={
            <span className="num text-[11px] text-muted">
              {int(shownEvents.length)} de {int(events.length)}
            </span>
          }
        >
          <ul className="scroll-thin max-h-[360px] divide-y divide-line overflow-auto">
            {feed.map((event) => (
              <li key={event.seq}>
                <button
                  type="button"
                  onClick={() => setSelected(eventForView(event, view))}
                  className="flex w-full items-baseline gap-3 py-1.5 text-left text-[11.5px] hover:bg-[#f7f8f4]"
                >
                  <span className="num w-14 shrink-0 text-[10.5px] text-muted">{event.time}</span>
                  <span className="num min-w-0 flex-1 truncate font-medium" title={eventLabel(event)}>
                    {event.type}
                  </span>
                  <span className="num hidden shrink-0 text-[10.5px] text-muted sm:inline">{event.account}</span>
                  <span className="num shrink-0 text-[10.5px] text-muted">{event.result}</span>
                </button>
              </li>
            ))}
            {feed.length === 0 && <li className="py-6 text-center text-[12px] text-muted">Aguardando eventos…</li>}
          </ul>
        </Panel>
      </div>

      {selected && (
        <aside
          className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-auto border-l border-line bg-surface p-5 shadow-2xl sm:w-[min(92vw,36rem)]"
          aria-label="Detalhe do evento"
          onKeyDown={(event) => event.key === 'Escape' && setSelected(null)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-semibold">{eventLabel(selected)}</h2>
              <p className="num text-[11px] text-muted">
                evt_{String(selected.seq).padStart(6, '0')} · {selected.actor} · {selected.visibility}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              autoFocus
              onClick={() => setSelected(null)}
              className="rounded-md p-1 text-muted hover:bg-[#f0f1ed] hover:text-ink"
            >
              <X size={17} />
            </button>
          </div>

          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[12px]">
            <dt className="text-muted">Hora simulada</dt>
            <dd className="num">{selected.time}</dd>
            <dt className="text-muted">Conta</dt>
            <dd className="num">{selected.account}</dd>
            <dt className="text-muted">Resultado</dt>
            <dd className="num">{selected.result}</dd>
            <dt className="text-muted">Motivo interno</dt>
            <dd className="num">{view === 'bot' ? <Hidden what="Motivo" /> : selected.reason}</dd>
            <dt className="text-muted">Política</dt>
            <dd className="num">{view === 'bot' ? <Hidden what="Política" /> : selected.policy}</dd>
          </dl>

          {view !== 'bot' && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted">payload</span>
                <CopyBtn label="Copiar" text={JSON.stringify(selected.payload)} onDone={toast} />
              </div>
              <pre className="num scroll-thin overflow-auto rounded-md bg-paper p-3 text-[11px] leading-5">
                {JSON.stringify(selected.payload, null, 2)}
              </pre>
            </div>
          )}
        </aside>
      )}
    </div>
  )
}

function ManualBar() {
  const { run, stepManual, autoFinish } = useApp()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'ArrowRight') stepManual('next')
      if (event.key === 'ArrowLeft') stepManual('prev')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stepManual])

  const first = run.done === 0 && run.tick === 0 && run.stage === 0

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f0c4b3] bg-accent-soft p-3">
      <Btn icon={<ChevronLeft size={13} />} disabled={first} onClick={() => stepManual('prev')}>
        Passo anterior
      </Btn>
      <Btn variant="primary" onClick={() => stepManual('next')}>
        {run.stage >= 4 ? 'Próxima tentativa' : 'Próximo passo'}
        <ChevronRight size={13} />
      </Btn>
      <Btn onClick={() => stepManual('attempt')}>Pular tentativa</Btn>
      <Btn onClick={() => stepManual('round')}>Concluir rodada</Btn>
      <Btn className="ml-auto" icon={<Play size={13} />} onClick={autoFinish}>
        Continuar automaticamente
      </Btn>
      <p className="w-full text-[11px] text-muted">
        Use ← e → para avançar e voltar. Etapa {run.stage + 1} de 5 · tentativa {run.tick + 1} da amostra · rodada{' '}
        {run.done + 1}.
      </p>
    </div>
  )
}
