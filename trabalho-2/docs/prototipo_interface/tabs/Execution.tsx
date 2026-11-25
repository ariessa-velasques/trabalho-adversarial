import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Footprints, Terminal, Check, Circle, Loader2, Pause, Play, Square, X, SkipForward } from 'lucide-react'
import { EVENT_LABEL, attemptsOf, brl, dec, eventsOf, int, rounds, totals, type Ev } from '../data'
import { useApp } from '../state'
import { Banner, Btn, CopyBtn, Hidden, Panel, Segmented, cx } from '../ui'
import LiveSim from './LiveSim'
import AlertLog from './AlertLog'


export function visibleEvent(e: Ev, view: string) {
  if (view === 'bot') return e.visibility === 'public' || e.type === 'coupon_decided'
  if (view === 'engine') return e.type !== 'bot_cost_recorded' && e.type !== 'bot_strategy_changed'
  return true
}

export default function Execution() {
  const { run, cfg, view, startRun, pauseRun, resumeRun, stopRun, goTab, toast, setSpeed, stepManual, autoFinish } = useApp()
  const [sel, setSel] = useState<Ev | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  const cur = Math.min(run.done, run.total - 1)
  const rd = rounds[cur]
  const evs = useMemo(() => eventsOf(rd), [rd])
  const simRd = run.status === 'running' ? rd : rounds[Math.max(0, Math.min(run.done, run.total) - 1)]
  const simAtt = useMemo(() => attemptsOf(simRd), [simRd])
  const ticksN = Math.min(8, rd.attempts)
  const frac = run.status === 'done' ? 1 : (run.tick + (run.mode === 'manual' && run.stage >= 4 ? 1 : 0)) / ticksN
  const t = totals(run.done)
  const pctDone = Math.round(((run.status === 'done' ? run.total : run.done + frac) / run.total) * 100)

  if (run.status === 'idle') {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-semibold">Pronto para executar</h1>
            <p className="mt-1 text-muted">{cfg.label}</p>
            <p className="num mt-0.5 text-xs text-muted">{cfg.runMode === 'deterministic' ? 'determinístico' : 'LLM'} · {cfg.scenario} · {cfg.defense} · seed {cfg.seed}</p>
          </div>
          <Btn onClick={() => goTab(0)}>Abrir configuração</Btn>
        </div>
        <Panel>
          <div className="grid grid-cols-2 gap-6">
            <ul className="space-y-2 text-[13px]">
              <li className="flex items-center gap-2 text-accepted"><Check size={15} />Configuração válida</li>
              <li className="flex items-center gap-2 text-accepted"><Check size={15} />Chave LLM não necessária</li>
              <li className="flex items-center gap-2 text-accepted"><Check size={15} />Sem chamadas externas</li>
            </ul>
            <ul className="space-y-1 text-[13px]">
              <li><b className="num">{cfg.rounds}</b> rodadas × 7 dias</li>
              <li><b className="num">~{cfg.rounds === 6 ? '1.000' : cfg.rounds * 160}</b> contas sintéticas</li>
              <li>orçamento <b className="num">{brl(cfg.acqBudget)}</b></li>
            </ul>
          </div>
          <div className="mt-6 flex justify-center gap-3 border-t border-line pt-5">
            <Btn variant="primary" icon={<Play size={14} />} onClick={() => startRun(false)}>Executar tudo</Btn>
            <Btn icon={<Footprints size={14} />} onClick={() => startRun(false, 'manual')}>Passo a passo na interface</Btn>
            <Btn icon={<SkipForward size={14} />} onClick={() => startRun(true)}>Executar rodada a rodada</Btn>
            <Btn icon={<Terminal size={14} />} onClick={() => startRun(false, 'brute')}>Modo bruto (sem interface)</Btn>
          </div>
          <p className="mt-3 text-center text-xs text-muted">Passo a passo: você avança cada etapa da interface com um clique. Executar tudo: animação automática e lenta. Modo bruto: rápido, sem interface, com todos os avisos adversariais.</p>
        </Panel>
      </div>
    )
  }

  const live = run.status === 'running'
  const shown = evs.filter((e) => visibleEvent(e, view)).slice(0, Math.max(1, Math.round(evs.length * frac)))
  const feed = shown.slice(-40).reverse()
  const noTrigger = rounds[run.total - 1].engLane[3].t.startsWith('Nenhum')
  const label = (e: Ev) => EVENT_LABEL[e.type] ?? e.type
  const live1 = (n: number) => Math.round(n * frac)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold">
            {live && run.mode !== 'manual' && <Loader2 size={20} className="animate-spin text-accent" />}
            {live ? (run.mode === 'manual' ? 'Passo a passo' : 'Executando…') : run.status === 'paused' ? 'Execução pausada' : 'Execução concluída'}
          </h1>
          <p className="num text-xs text-muted">{run.id} · hash {run.hash}</p>
        </div>
        <div className="flex gap-2">
          {live && run.mode !== 'manual' && <Btn icon={<Pause size={14} />} onClick={pauseRun} disabled={run.pauseReq}>{run.pauseReq ? 'Pausando ao fim da rodada…' : 'Pausar após rodada'}</Btn>}
          {run.status === 'paused' && <Btn variant="primary" icon={<Play size={14} />} onClick={resumeRun}>{run.step ? 'Próxima rodada' : 'Continuar'}</Btn>}
          {(live || run.status === 'paused') && <Btn variant="danger" icon={<Square size={13} />} onClick={() => setConfirmStop(true)}>Parar</Btn>}
        </div>
      </div>

      {confirmStop && (
        <Banner kind="warn" title="Parar a execução?" action={<div className="flex gap-2"><Btn variant="danger" onClick={() => { stopRun(); setConfirmStop(false) }}>Parar</Btn><Btn onClick={() => setConfirmStop(false)}>Cancelar</Btn></div>}>
          O JSONL parcial é preservado e a execução fica marcada como pausada.
        </Banner>
      )}
      {run.status === 'paused' && <Banner kind="warn" title={`Execução pausada na rodada ${run.done}`}>As rodadas concluídas já estão disponíveis em Rodadas e Métricas.</Banner>}
      {run.status === 'done' && (
        <>
          <Banner kind="success" title={`${run.total} rodadas concluídas em ${dec(run.elapsed, 1)} s · ${int(t.redemptions)} resgates · ${brl(t.budget)} consumidos`}
            action={<div className="flex gap-2"><Btn onClick={() => goTab(2)}>Ver rodadas</Btn><Btn onClick={() => goTab(3)}>Ver métricas</Btn><Btn onClick={() => toast('Pacote de evidências exportado em saidas/runs/' + run.id)}>Exportar evidências</Btn></div>} />
          {noTrigger && <Banner kind="warn" title={`A rodada ${run.total} não mudou a política — nenhum gatilho foi acionado.`}>Isso também é evidência.</Banner>}
        </>
      )}

      <Panel>
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eaecf0]" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
            <div className="h-full bg-accent transition-[width]" style={{ width: pctDone + '%' }} />
          </div>
          <p className="num text-[13px] text-muted">{run.done} de {run.total} rodadas · {pctDone}%</p>
        </div>
        <ol className="mt-4 flex items-center">
          {rounds.slice(0, run.total).map((r, i) => {
            const done = i < run.done, active = i === run.done && run.status !== 'done'
            return (
              <li key={r.r} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span className={cx('grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-semibold', done ? 'border-accepted bg-accepted text-white' : active ? 'border-accent text-accent' : 'border-line text-muted')}>
                    {done ? <Check size={15} /> : active ? <Circle size={10} fill="currentColor" /> : r.r}
                  </span>
                  <span className="text-xs text-muted">{done ? 'concluída' : active ? 'em curso' : 'pendente'}</span>
                </div>
                {i < run.total - 1 && <span className={cx('mx-2 mb-5 h-0.5 flex-1', done ? 'bg-accepted' : 'bg-line')} />}
              </li>
            )
          })}
        </ol>
      </Panel>

      {run.mode !== 'brute' ? (
        <>
          {run.mode === 'manual' && live && <ManualBar />}
          {run.mode === 'visual' && <div className="flex items-center justify-end gap-2 text-[13px]">
            <span className="text-muted">Velocidade da simulação</span>
            <Segmented value={String(run.speed)} onChange={(v) => setSpeed(Number(v))} options={[{ v: '1200', l: 'Rápido' }, { v: '3000', l: 'Normal' }, { v: '6000', l: 'Lento' }]} />
          </div>}
          <LiveSim rd={simRd} attempts={simAtt} idx={run.status === 'running' ? Math.min(simAtt.length - 1, Math.floor((simAtt.length * run.tick) / ticksN)) : simAtt.length - 1}
            live={live && run.mode !== 'manual'} tickMs={run.speed} view={view} cfg={cfg} stage={run.mode === 'manual' && live ? run.stage : undefined} />
        </>
      ) : (
        <Banner kind="info" title="Modo bruto">Sem simulação visual. Os avisos aparecem no registro abaixo conforme as rodadas avançam.</Banner>
      )}
      {(run.mode === 'brute' || run.status !== 'running') && (
        <AlertLog done={run.done} cur={live ? cur : Math.max(0, run.done - 1)} frac={live ? frac : 1} total={run.total} finished={run.status === 'done'} view={view} live={live} />
      )}

      <div className="grid grid-cols-[1fr_1fr] gap-5">
        <Panel title={`Rodada ${rd.r} · ${rd.dates}${view !== 'engine' ? ` · ${rd.attack}` : ''}`}>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px]">
            <dt className="text-muted">Tática</dt><dd className="text-right font-medium">{view === 'engine' ? <Hidden what="Tática" /> : rd.tactic}</dd>
            <dt className="text-muted">Política</dt><dd className="num text-right font-medium">{view === 'bot' ? <Hidden what="Política" /> : `${rd.policy} · ${rd.defense.toLowerCase()}`}</dd>
            <dt className="text-muted">Tentativas</dt><dd className="num text-right font-medium">{live1(rd.attempts)} / {rd.attempts}</dd>
            <dt className="text-muted">Aceitas</dt><dd className="num text-right font-medium">{live1(rd.accepted)}</dd>
            <dt className="text-muted">Recusadas</dt><dd className="num text-right font-medium">{live1(rd.refused)}</dd>
            <dt className="text-muted">Resgates</dt><dd className="num text-right font-medium">{live1(rd.redemptions)}</dd>
            <dt className="text-muted">Orçamento debitado</dt><dd className="num text-right font-medium">{view === 'bot' ? <Hidden what="Orçamento" /> : brl(live1(rd.budget))}</dd>
            <dt className="text-muted">Custo do bot</dt><dd className="num text-right font-medium">{view === 'engine' ? <Hidden what="Custo" /> : brl(live1(rd.botCost))}</dd>
          </dl>
          {view !== 'bot' && rd.r >= 3 && cfg.defense === 'redesign' && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted">Controles AM3 ativos</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                {[[cfg.generic, 'mensagem genérica'], [cfg.limitOn, `limite ${cfg.limitMax}/${cfg.limitWindow} h`], [cfg.probing, `sondagem ≥ ${cfg.probingMin}`], [cfg.contestation, 'contestação']].map(([on, l]) => (
                  <span key={String(l)} className={cx('rounded-full border px-2 py-0.5', on ? 'border-[#b2dfe2] bg-[#e6f6f7] text-engine' : 'border-line text-muted line-through')}>{on ? '✓ ' : ''}{l}</span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Eventos ao vivo" right={<span className="num text-xs text-muted">{int(shown.length)} de {int(evs.length)}</span>}>
          <ul className="max-h-[360px] divide-y divide-line overflow-auto">
            {feed.map((e) => (
              <li key={e.seq}>
                <button onClick={() => setSel(e)} className="flex w-full items-baseline gap-3 py-1.5 text-left text-[13px] hover:bg-[#f9fafb]">
                  <span className="num text-xs text-muted">{e.time}</span>
                  <span className="num font-medium">{e.type}</span>
                  <span className="num truncate text-xs text-muted">{e.account} · {view === 'bot' ? e.result : e.result}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {sel && (
        <aside className="fixed inset-y-0 right-0 z-40 w-[40%] max-w-xl overflow-auto border-l border-line bg-white p-5 shadow-2xl" onKeyDown={(e) => e.key === 'Escape' && setSel(null)}>
          <div className="flex items-start justify-between">
            <div><h2 className="text-lg font-semibold">{label(sel)}</h2><p className="num text-xs text-muted">evt_{String(sel.seq).padStart(6, '0')} · {sel.actor}</p></div>
            <button aria-label="Fechar" autoFocus onClick={() => setSel(null)} className="rounded p-1 hover:bg-[#f2f4f7]"><X size={18} /></button>
          </div>
          <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">Hora simulada</dt><dd className="num">{sel.time}</dd>
            <dt className="text-muted">Conta</dt><dd className="num">{sel.account}</dd>
            <dt className="text-muted">Resultado</dt><dd className="num">{sel.result}</dd>
            <dt className="text-muted">Motivo interno</dt><dd className="num">{view === 'bot' ? <Hidden what="Motivo" /> : sel.reason}</dd>
            <dt className="text-muted">Política</dt><dd className="num">{view === 'bot' ? <Hidden what="Política" /> : sel.policy}</dd>
          </dl>
          {view !== 'bot' && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between"><span className="text-xs font-medium text-muted">payload</span><CopyBtn label="Copiar" text={JSON.stringify(sel.payload)} onDone={toast} /></div>
              <pre className="num overflow-auto rounded-lg bg-[#f7f7f5] p-3 text-xs">{JSON.stringify(sel.payload, null, 2)}</pre>
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
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return
      if (e.key === 'ArrowRight') stepManual('next')
      if (e.key === 'ArrowLeft') stepManual('prev')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [stepManual])
  const first = run.done === 0 && run.tick === 0 && run.stage === 0
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-[#fff8f5] p-3">
      <Btn icon={<ChevronLeft size={14} />} disabled={first} onClick={() => stepManual('prev')}>Passo anterior</Btn>
      <Btn variant="primary" onClick={() => stepManual('next')}>{run.stage >= 4 ? 'Próxima tentativa' : 'Próximo passo'} <ChevronRight size={14} /></Btn>
      <Btn onClick={() => stepManual('attempt')}>Pular tentativa</Btn>
      <Btn onClick={() => stepManual('round')}>Concluir rodada</Btn>
      <Btn className="ml-auto" icon={<Play size={14} />} onClick={autoFinish}>Continuar automaticamente</Btn>
      <p className="w-full text-xs text-muted">Use as teclas ← e → para avançar e voltar. Etapa {run.stage + 1} de 5 · tentativa {run.tick + 1} da amostra · rodada {run.done + 1}.</p>
    </div>
  )
}
