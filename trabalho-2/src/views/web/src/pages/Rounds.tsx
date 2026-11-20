import { Fragment, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Download,
  GitBranch,
  Shield,
} from 'lucide-react'
import { useApp } from '../app/AppContext'
import { EVENT_LABEL, TRIGGER_HINT } from '../data/demo'
import { brl, int, pct } from '../data/format'
import { eventForView, isVisibleInView } from '../data/derive'
import type { Attempt, Card, Contest } from '../data/types'
import {
  Banner,
  Btn,
  CopyBtn,
  Empty,
  Hidden,
  PageHeader,
  Panel,
  Pill,
  ResultPill,
  Stat,
  StatStrip,
  cx,
} from '../components/ui'
import { download } from '../lib/download'

const PAGE = 25
const STAGES = ['Ação', 'Resposta', 'Observação', 'Adaptação']

function Pager({
  page,
  setPage,
  total,
}: {
  page: number
  setPage: (page: number) => void
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE))
  return (
    <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-muted">
      <span className="num">
        {total === 0 ? 0 : page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {int(total)}
      </span>
      <div className="flex items-center gap-2">
        <Btn className="h-7 px-2" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Anterior
        </Btn>
        <span className="num">
          {page + 1} / {pages}
        </span>
        <Btn className="h-7 px-2" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          Próxima
        </Btn>
      </div>
    </div>
  )
}

function CausalCard({ card, stage }: { card: Card; stage: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-line/70 px-3 py-3 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
      <p className="rule-label md:hidden">
        {stage + 1}. {STAGES[stage]}
      </p>
      <p className="text-[13.5px] font-semibold leading-[1.3]">{card.title}</p>
      <p className="num text-[11.5px] leading-4 text-muted">{card.detail}</p>
      {card.trigger && (
        <div className="mt-auto pt-1.5">
          <Pill tone="accent" icon={<AlertTriangle size={10} />} mono>
            {card.trigger}
          </Pill>
          <p className="mt-1 text-[10.5px] leading-3.5 text-muted">{card.triggerHint ?? TRIGGER_HINT[card.trigger]}</p>
        </div>
      )}
    </div>
  )
}

function Lane({
  actor,
  cards,
  visible,
  label,
}: {
  actor: 'bot' | 'engine'
  cards: Card[]
  visible: boolean
  label: string
}) {
  const Icon = actor === 'bot' ? Crosshair : Shield
  return (
    <div className={cx('lane overflow-hidden rounded-lg border border-line', actor === 'bot' ? 'lane-bot' : 'lane-engine')}>
      <div className="grid md:grid-cols-[104px_repeat(4,minmax(0,1fr))]">
        <div className="flex items-center gap-1.5 border-b border-line/70 px-3 py-2 md:border-b-0 md:border-r">
          <Icon size={12} className={actor === 'bot' ? 'text-bot' : 'text-engine'} />
          <span className={cx('text-[11.5px] font-semibold', actor === 'bot' ? 'text-bot' : 'text-engine')}>{label}</span>
        </div>
        {visible ? (
          cards.map((card, index) => <CausalCard key={index} card={card} stage={index} />)
        ) : (
          <div className="col-span-full grid place-items-center px-3 py-6 md:col-span-4">
            <Hidden what={`Raia ${label.toLowerCase()}`} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function Rounds() {
  const { run, view, round, setRound, toast, goTab, source } = useApp()
  const [sub, setSub] = useState(0)
  const [compare, setCompare] = useState(true)

  if (run.done === 0) {
    return (
      <Empty
        icon={<GitBranch />}
        title="Nenhuma rodada ainda"
        text="Configure o experimento e clique em Executar."
        cta={
          <Btn variant="primary" onClick={() => goTab(run.status === 'idle' ? 0 : 1)}>
            {run.status === 'idle' ? 'Abrir configuração' : 'Acompanhar execução'}
          </Btn>
        }
      />
    )
  }

  const index = Math.min(round, run.done) - 1
  const current = source.rounds[index]
  const previous = index > 0 ? source.rounds[index - 1] : null
  const rate = (value: typeof current) => value.accepted / value.attempts
  const showBot = view !== 'engine'
  const showEngine = view !== 'bot'

  const metric = (
    label: string,
    value: number,
    format: (n: number) => string,
    key: keyof typeof current,
    hidden?: boolean,
    lowIsGood?: boolean,
  ) => {
    if (hidden) return <Stat key={label} label={label} value="—" sub="oculto na visão" />
    const delta = previous ? value - (previous[key] as number) : 0
    return (
      <Stat
        key={label}
        label={label}
        value={format(value)}
        delta={
          compare && previous
            ? {
                value: `${delta > 0 ? '↑' : delta < 0 ? '↓' : '='} ${format(Math.abs(delta))}`,
                good: delta === 0 ? null : lowIsGood ? delta < 0 : null,
              }
            : undefined
        }
      />
    )
  }

  const visiblePills = current.pills.filter((_, i) => i === 1 || (i === 0 && showBot) || (i === 2 && showEngine))
  const engineTrigger = current.engineLane[3]
  const botTrigger = current.botLane[3]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rodadas"
        description="Selecione uma rodada para abrir a cadeia causal entre os dois agentes."
        actions={
          <>
            <Btn onClick={() => setCompare(!compare)} aria-pressed={compare}>
              {compare ? 'Ocultar comparação' : 'Comparar com anterior'}
            </Btn>
            <Btn
              icon={<Download size={13} />}
              onClick={() => {
                const columns = [
                  'round',
                  ...(showBot ? ['attack'] : []),
                  ...(showEngine ? ['defense'] : []),
                  'attempts',
                  'accepted',
                  'refused',
                ]
                download(
                  'rodadas.csv',
                  [columns.join(',')]
                    .concat(
                      source.rounds
                        .slice(0, run.done)
                        .map((item) =>
                          [
                            item.r,
                            ...(showBot ? [item.attack] : []),
                            ...(showEngine ? [item.defense] : []),
                            item.attempts,
                            item.accepted,
                            item.refused,
                          ].join(','),
                        ),
                    )
                    .join('\n'),
                  'text/csv',
                )
                toast('rodadas.csv baixado')
              }}
            >
              CSV
            </Btn>
          </>
        }
      />

      <ol className="scroll-thin flex items-stretch gap-2 overflow-x-auto pb-1" aria-label="Linha do tempo de rodadas">
        {source.rounds.slice(0, run.total).map((item, i) => {
          const done = i < run.done
          const active = index === i
          const trigger = item.engineLane[3].trigger || item.botLane[3].trigger
          return (
            <li key={item.r} className="min-w-[148px] flex-1">
              <button
                type="button"
                disabled={!done}
                aria-current={active}
                onClick={() => setRound(item.r)}
                className={cx(
                  'h-full w-full rounded-lg border bg-surface p-3 text-left transition-colors',
                  active ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-line-strong',
                  !done && 'opacity-45',
                )}
              >
                <p className="flex items-center justify-between">
                  <span className="num text-[16px] font-semibold">{item.r}</span>
                  {done && trigger && <AlertTriangle size={13} className="text-verification" aria-label="gatilho acionado" />}
                </p>
                <p className={cx('num mt-0.5 text-[12px] font-medium', rate(item) >= 0.5 ? 'text-accepted' : 'text-refused')}>
                  {done ? `${pct(rate(item))} aceitação` : 'pendente'}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  {!done ? 'aguardando execução' : `${showBot ? item.attack : ''}${showBot && showEngine ? ' · ' : ''}${showEngine ? item.defense : ''}`}
                </p>
              </button>
            </li>
          )
        })}
      </ol>

      <Panel>
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="mr-1 text-[15px] font-semibold">
            Rodada {current.r} · {current.dates}
          </h2>
          {visiblePills.map((pill) => (
            <Pill key={pill} mono>
              {pill}
            </Pill>
          ))}
        </div>
        <div className="mt-2 grid gap-3 text-[12.5px] sm:grid-cols-2">
          {showBot ? (
            <p>
              <b className="text-bot">Bot:</b> {current.summary.bot}
            </p>
          ) : (
            <Hidden what="Resumo do bot" />
          )}
          {showEngine ? (
            <p>
              <b className="text-engine">Motor:</b> {current.summary.engine}
            </p>
          ) : (
            <Hidden what="Resumo do motor" />
          )}
        </div>
      </Panel>

      <div>
        <div className="mb-2 hidden grid-cols-[104px_repeat(4,minmax(0,1fr))] gap-x-2 md:grid">
          <span />
          {STAGES.map((stage, i) => (
            <span key={stage} className="flex items-center gap-1.5">
              <span className="num text-[10px] text-faint">{i + 1}</span>
              <span className="rule-label">{stage}</span>
              {i < STAGES.length - 1 && <ArrowRight size={10} className="text-faint" />}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          <Lane actor="bot" cards={current.botLane} visible={showBot} label="Bot" />
          <Lane actor="engine" cards={current.engineLane} visible={showEngine} label="Motor" />
        </div>

        <p className="mt-2 text-[11.5px] leading-4 text-muted">
          Cada gatilho aponta para o número observado que o disparou.{' '}
          {!engineTrigger.trigger && !botTrigger.trigger &&
            'Nenhum gatilho disparou. A política foi mantida — a ausência de mudança também é evidência.'}
        </p>
      </div>

      <StatStrip cols={8}>
        {metric('Tentativas', current.attempts, int, 'attempts')}
        {metric('Aceitas', current.accepted, int, 'accepted')}
        {metric('Recusadas', current.refused, int, 'refused')}
        {metric('Verificações', current.verifications, int, 'verifications')}
        {metric('Limites', current.limited, int, 'limited')}
        {metric('Resgates', current.redemptions, int, 'redemptions')}
        {metric('Orçamento', current.budget, (n) => brl(n), 'budget', view === 'bot')}
        {metric('Custo do bot', current.botCost, (n) => brl(n), 'botCost', view === 'engine', true)}
      </StatStrip>

      <div>
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
          {['Resumo', `Tentativas ${int(current.attempts)}`, 'Eventos', 'Políticas'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={sub === i}
              onClick={() => setSub(i)}
              className={cx(
                'shrink-0 border-b-2 px-3 py-2 text-[12.5px] font-medium',
                sub === i ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {sub === 0 && <Summary index={index} />}
          {sub === 1 && <AttemptsTab key={current.r} index={index} />}
          {sub === 2 && <EventsTab key={current.r} index={index} />}
          {sub === 3 && <PolicyTab index={index} />}
        </div>
      </div>
    </div>
  )
}

function Summary({ index }: { index: number }) {
  const { view, source } = useApp()
  const round = source.rounds[index]
  const triggers = [round.engineLane[3], round.botLane[3]].filter((card) => card.trigger)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="O que o bot viu">
        {view === 'engine' ? (
          <Hidden what="Visão do bot" />
        ) : (
          <ul className="list-disc space-y-1.5 pl-4 text-[12px]">
            <li>
              Respostas públicas de {int(round.attempts)} tentativas: {int(round.accepted)} aceitas.
            </li>
            <li>Mensagem de recusa {round.r < 3 ? 'detalhada — revela o motivo.' : 'genérica — não revela o motivo.'}</li>
            <li>
              Verificações pedidas: {round.verifications}; limites: {round.limited}.
            </li>
            <li>Custo da própria tática: {brl(round.botCost)}.</li>
          </ul>
        )}
      </Panel>

      <Panel title="O que o motor viu">
        {view === 'bot' ? (
          <Hidden what="Visão do motor" />
        ) : (
          <ul className="list-disc space-y-1.5 pl-4 text-[12px]">
            <li>
              Política vigente <span className="num">{round.policy}</span> ({round.defense}).
            </li>
            <li>Sinais e relações entre contas; sem rótulo de legitimidade.</li>
            <li>
              Conversão agregada da coorte: <span className="num">{pct(round.conversion)}</span>.
            </li>
            <li>Orçamento debitado: {brl(round.budget)}.</li>
          </ul>
        )}
      </Panel>

      <div className="lg:col-span-2">
        <Panel title="Gatilhos acionados e mudanças">
          {triggers.length === 0 ? (
            <p className="text-[12px]">Nenhum gatilho disparou; política mantida.</p>
          ) : (
            <ul className="space-y-2 text-[12px]">
              {triggers
                .filter((card) => (card === round.engineLane[3] ? view !== 'bot' : view !== 'engine'))
                .map((card) => (
                  <li key={card.title} className="flex flex-wrap items-center gap-2">
                    <Pill tone="accent" mono icon={<AlertTriangle size={10} />}>
                      {card.trigger}
                    </Pill>
                    <span className="text-muted">{card.triggerHint}</span>
                    <ArrowRight size={12} className="text-muted" />
                    <span className="font-medium">{card.title}</span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function AttemptsTab({ index }: { index: number }) {
  const { view, cfg, contests, setContests, toast, goTab, source } = useApp()
  const round = source.rounds[index]
  const all = useMemo(() => source.attemptsOf(round), [source, round])
  const [result, setResult] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)

  const rows = all.filter(
    (attempt) =>
      (result === 'all' || attempt.result === result) &&
      (!query || attempt.account.includes(query) || attempt.id.includes(query)),
  )
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE)
  const operational = view !== 'bot'
  const bot = view !== 'engine'
  const evaluation = view === 'eval'
  const canContest = cfg.contestation && view !== 'bot'
  const columns = 7 + (operational ? 6 : 0) + (bot ? 1 : 0) + (evaluation ? 1 : 0)
  const header = 'sticky top-0 z-10 bg-[#f7f8f4] px-2.5 text-left text-[11px] font-semibold text-muted'

  const contest = (attempt: Attempt) => {
    if (contests.some((item) => item.attempt === attempt.id)) {
      toast(`Já existe contestação para ${attempt.id}`)
      goTab(4)
      return
    }
    const now = new Date()
    const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const created: Contest = {
      id: `con_${String(13 + contests.length).padStart(5, '0')}`,
      attempt: attempt.id,
      account: attempt.account,
      round: round.r,
      date,
      evidence: 'none',
      status: 'open',
      message: attempt.message,
      reason: attempt.reason,
      rules: [attempt.reason],
      score: attempt.score,
      policy: round.policy,
      decidedAt: `${round.dates.split('–')[0]} ${attempt.time}`,
      note: '',
      slaHours: 24,
      signals: [
        { key: 'dispositivo', value: attempt.device, shared: attempt.shared ? `${attempt.shared} contas` : undefined },
        { key: 'endereço', value: attempt.address },
        { key: 'telefone', value: attempt.phone },
      ],
      cost: 0,
      history: [{ at: `${date} ${time}`, text: 'Contestação aberta' }],
    }
    setContests([created, ...contests])
    toast(`Contestação ${created.id} aberta`)
  }

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <select
          aria-label="Filtrar por resultado"
          className="h-7 rounded-md border border-line bg-surface px-2 text-[11.5px]"
          value={result}
          onChange={(event) => {
            setResult(event.target.value)
            setPage(0)
          }}
        >
          <option value="all">Todos os resultados</option>
          <option value="accepted">Aceito</option>
          <option value="coupon_already_used">Recusado</option>
          <option value="verification_required">Verificação</option>
          <option value="rate_limited">Limite</option>
        </select>
        <input
          aria-label="Buscar conta"
          placeholder="Buscar conta ou tentativa"
          className="h-7 w-52 rounded-md border border-line bg-surface px-2 text-[11.5px]"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setPage(0)
          }}
        />
        {!operational && <span className="text-[11px] text-muted">Sinais e motivo interno ocultos na visão do bot.</span>}
        <span className="num ml-auto text-[10.5px] text-muted">{int(rows.length)} tentativas</span>
      </div>

      <div className="scroll-thin max-h-[560px] overflow-auto">
        <table className="w-full min-w-[1120px] text-[12px]">
          <thead>
            <tr className="h-9">
              <th className={header} />
              <th className={header}>Tentativa</th>
              <th className={header}>Conta</th>
              {operational && (
                <>
                  <th className={header}>E-mail</th>
                  <th className={header}>Telefone</th>
                  <th className={header}>CPF</th>
                  <th className={header}>Dispositivo</th>
                  <th className={header}>Endereço</th>
                </>
              )}
              <th className={header}>Resultado</th>
              <th className={header}>Mensagem</th>
              {operational && <th className={header}>Motivo interno</th>}
              <th className={cx(header, 'text-right')}>Pedido</th>
              {bot && <th className={cx(header, 'text-right')}>Custo</th>}
              {evaluation && <th className={header}>Rótulo</th>}
              <th className={header}>Hora</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((attempt) => (
              <Fragment key={attempt.id}>
                <tr className="h-10 border-t border-line hover:bg-[#fafbf8]">
                  <td className="pl-1.5">
                    <button
                      type="button"
                      aria-label="Expandir tentativa"
                      aria-expanded={open === attempt.id}
                      onClick={() => setOpen(open === attempt.id ? null : attempt.id)}
                      className="rounded p-1 text-muted hover:bg-[#eceee9] hover:text-ink"
                    >
                      {open === attempt.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </td>
                  <td className="num px-2.5">{attempt.id}</td>
                  <td className="num px-2.5">{attempt.account}</td>
                  {operational && (
                    <>
                      <td className="num px-2.5">{attempt.email}</td>
                      <td className="num px-2.5">{attempt.phone}</td>
                      <td className="num px-2.5">{attempt.cpf}</td>
                      <td className="num px-2.5">{attempt.device}</td>
                      <td className="num px-2.5">{attempt.address}</td>
                    </>
                  )}
                  <td className="px-2.5">
                    <ResultPill result={attempt.result} />
                  </td>
                  <td className="max-w-[220px] truncate px-2.5 text-muted" title={attempt.message}>
                    {attempt.message}
                  </td>
                  {operational && <td className="num px-2.5">{attempt.reason}</td>}
                  <td className="num px-2.5 text-right">{brl(attempt.order, 2)}</td>
                  {bot && <td className="num px-2.5 text-right">{brl(attempt.cost, 2)}</td>}
                  {evaluation && (
                    <td className="px-2.5">
                      <Pill tone={attempt.label === 'fraude' ? 'refused' : 'accepted'}>
                        {attempt.label === 'fraude' ? 'conta suspeita' : 'legítima'}
                      </Pill>
                    </td>
                  )}
                  <td className="num px-2.5">{attempt.time}</td>
                </tr>
                {open === attempt.id && (
                  <tr className="bg-[#f7f8f4]">
                    <td colSpan={columns} className="px-5 py-3">
                      <div className="grid gap-5 text-[11.5px] md:grid-cols-3">
                        <div>
                          <p className="rule-label">Decisão</p>
                          <p>
                            Resultado público: <span className="num">{attempt.result}</span>
                          </p>
                          <p>
                            Verificação: <span className="num">{attempt.verification}</span>
                          </p>
                          {operational && (
                            <p>
                              Score: <span className="num">{attempt.score.toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="rule-label">Sinais</p>
                          {operational ? (
                            <>
                              <p className="num">
                                {attempt.device}
                                {attempt.shared ? ` · ${attempt.shared} contas` : ''}
                              </p>
                              <p className="num">
                                {attempt.address} · {attempt.phone}
                              </p>
                            </>
                          ) : (
                            <Hidden what="Sinais" />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {evaluation && (
                            <p className="num text-[10.5px] text-muted">
                              {attempt.person} · tática {attempt.tactic}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3">
                            <CopyBtn text={attempt.id} onDone={toast} />
                            {attempt.result !== 'accepted' && canContest && (
                              <button
                                type="button"
                                className="text-[11.5px] font-medium text-limited underline decoration-limited/40 underline-offset-2 hover:decoration-limited"
                                onClick={() => contest(attempt)}
                              >
                                Abrir contestação
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns} className="py-10 text-center text-[12px] text-muted">
                  Nenhuma tentativa com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={rows.length} />
    </Panel>
  )
}

function EventsTab({ index }: { index: number }) {
  const { view, toast, source } = useApp()
  const round = source.rounds[index]
  const all = useMemo(() => source.eventsOf(round).filter((event) => isVisibleInView(event, view)), [source, round, view])
  const [type, setType] = useState('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<number | null>(null)

  const rows = all.filter((event) => type === 'all' || event.type === type)
  const types = [...new Set(all.map((event) => event.type))]
  const header = 'bg-[#f7f8f4] px-2.5 text-left text-[11px] font-semibold text-muted'

  return (
    <Panel flush className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <select
          aria-label="Filtrar por tipo"
          className="h-7 rounded-md border border-line bg-surface px-2 text-[11.5px]"
          value={type}
          onChange={(event) => {
            setType(event.target.value)
            setPage(0)
          }}
        >
          <option value="all">Todos os tipos</option>
          {types.map((item) => (
            <option key={item} value={item}>
              {EVENT_LABEL[item] ?? item}
            </option>
          ))}
        </select>
        <Btn
          className="ml-auto h-7"
          icon={<Download size={12} />}
          onClick={() => {
            download(
              `events_round${round.r}.jsonl`,
              rows.map((event) => JSON.stringify(eventForView(event, view))).join('\n'),
              'application/jsonl',
            )
            toast('JSONL baixado')
          }}
        >
          Baixar JSONL
        </Btn>
      </div>

      <div className="scroll-thin max-h-[520px] overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0">
            <tr className="h-9">
              <th className={header}>seq</th>
              <th className={header}>Hora</th>
              <th className={header}>Tipo</th>
              <th className={header}>Ator</th>
              <th className={header}>Conta</th>
              <th className={header}>Resultado</th>
              {view !== 'bot' && (
                <>
                  <th className={header}>Motivo interno</th>
                  <th className={header}>Política</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((event) => (
              <Fragment key={event.seq}>
                <tr
                  onClick={() => view !== 'bot' && setOpen(open === event.seq ? null : event.seq)}
                  className={cx(
                    'h-10 border-t border-line',
                    view !== 'bot' && 'cursor-pointer hover:bg-[#fafbf8]',
                  )}
                >
                  <td className="num px-2.5">{event.seq}</td>
                  <td className="num px-2.5">{event.time}</td>
                  <td className="px-2.5">{EVENT_LABEL[event.type] ?? event.type}</td>
                  <td className="px-2.5">{event.actor}</td>
                  <td className="num px-2.5">{event.account}</td>
                  <td className="num px-2.5">{event.result}</td>
                  {view !== 'bot' && (
                    <>
                      <td className="num px-2.5">{event.reason}</td>
                      <td className="num px-2.5">{event.policy}</td>
                    </>
                  )}
                </tr>
                {open === event.seq && (
                  <tr className="bg-[#f7f8f4]">
                    <td colSpan={view === 'bot' ? 6 : 8} className="px-5 py-3">
                      {view === 'bot' ? (
                        <Hidden what="Payload" />
                      ) : (
                        <pre className="num text-[11px] leading-5">{JSON.stringify(event.payload, null, 2)}</pre>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={rows.length} />
    </Panel>
  )
}

function PolicyTab({ index }: { index: number }) {
  const { view, toast, source } = useApp()
  const round = source.rounds[index]
  const next = source.rounds[index + 1]

  if (view === 'bot') {
    return (
      <Banner kind="info" title="Política oculta">
        A política do motor não é visível ao bot.
      </Banner>
    )
  }

  const currentPolicy = source.policies[round.policy]
  const nextPolicy = next ? source.policies[next.policy] : null

  if (!nextPolicy) {
    return (
      <Banner kind="info" title="Sem mudança">
        Nenhum gatilho disparou. A política foi mantida — a ausência de mudança também é evidência.
      </Banner>
    )
  }

  const keys = Object.keys(currentPolicy)
  const diff = keys
    .filter((key) => currentPolicy[key] !== nextPolicy[key])
    .map((key) => `- ${key}: ${currentPolicy[key]}\n+ ${key}: ${nextPolicy[key]}`)
    .join('\n')

  return (
    <Panel
      title={`${round.policy} → ${next.policy}`}
      sub={
        round.engineLane[3].trigger
          ? `Gatilho: ${round.engineLane[3].trigger} (${round.engineLane[3].triggerHint})`
          : 'Calibragem sem gatilho de motor'
      }
      right={
        <Btn
          className="h-7"
          onClick={() => {
            navigator.clipboard?.writeText(diff).then(() => toast('Diff copiado')).catch(() => toast('Não foi possível copiar'))
          }}
        >
          Copiar diff
        </Btn>
      }
    >
      <div className="overflow-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10.5px] text-muted">
              <th className="w-1/4 py-1 font-medium">Regra</th>
              <th className="w-[37%] font-medium">{round.policy}</th>
              <th className="font-medium">{next.policy}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const changed = currentPolicy[key] !== nextPolicy[key]
              return (
                <tr key={key} className="border-t border-line">
                  <td className="py-2 text-muted">{key}</td>
                  <td className={cx('num', changed && 'bg-refused-soft text-refused')}>
                    {changed && '− '}
                    {currentPolicy[key]}
                  </td>
                  <td className={cx('num', changed && 'bg-accepted-soft text-accepted')}>
                    {changed && '+ '}
                    {nextPolicy[key]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
