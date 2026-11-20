import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, Crosshair, Download, GitBranch, Shield, Check } from 'lucide-react'
import { EVENT_LABEL, POLICIES, TRIGGER_HINT, attemptsOf, brl, cpa, dec, eventsOf, int, pct, rounds, type Attempt, type Card, type Contest } from '../data'
import { useApp } from '../state'
import { Banner, Btn, CopyBtn, Empty, Hidden, Kpi, Panel, Pill, ResultPill, cx, download } from '../ui'
import { visibleEvent } from './Execution'

const PAGE = 25

function Pager({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE))
  return (
    <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted">
      <span className="num">{total === 0 ? 0 : page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {int(total)}</span>
      <div className="flex items-center gap-2">
        <Btn className="h-7 px-2" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Btn>
        <span className="num">{page + 1} / {pages}</span>
        <Btn className="h-7 px-2" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima</Btn>
      </div>
    </div>
  )
}

function CausalCard({ c, lane }: { c: Card; lane: 'bot' | 'engine' }) {
  const bot = lane === 'bot'
  return (
    <div className={cx('rounded-lg border bg-white p-3', bot ? 'border-l-4 border-l-bot border-line' : 'border-l-4 border-l-engine border-line')}>
      <p className={cx('mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide', bot ? 'text-bot' : 'text-engine')}>
        {bot ? <Crosshair size={12} /> : <Shield size={12} />}{bot ? 'Bot' : 'Motor'}
      </p>
      <p className="text-[13px] font-semibold leading-snug">{c.t}</p>
      <p className="num mt-1 text-xs text-muted">{c.e}</p>
      {c.trig && <div className="mt-2" title={c.trigHint ?? TRIGGER_HINT[c.trig]}><Pill tone="accent" icon={<AlertTriangle size={11} />} mono>{c.trig}</Pill><p className="mt-1 text-[11px] text-muted">{c.trigHint ?? TRIGGER_HINT[c.trig]}</p></div>}
    </div>
  )
}

export default function Rounds() {
  const { run, view, round, setRound, cfg, contests, setContests, toast, goTab } = useApp()
  const [sub, setSub] = useState(0)
  const [compare, setCompare] = useState(true)
  if (run.done === 0) {
    return <Empty icon={<GitBranch />} title="Nenhuma rodada ainda" text="Configure o experimento e clique em Executar." cta={<Btn variant="primary" onClick={() => goTab(run.status === 'idle' ? 0 : 1)}>{run.status === 'idle' ? 'Abrir configuração' : 'Acompanhar execução'}</Btn>} />
  }
  const idx = Math.min(round, run.done) - 1
  const rd = rounds[idx]
  const prev = idx > 0 ? rounds[idx - 1] : null
  const rate = (r: typeof rd) => r.accepted / r.attempts
  const showBot = view !== 'engine', showEng = view !== 'bot'

  const metric = (label: string, v: number, f: (n: number) => string, key: 'attempts' | 'accepted' | 'refused' | 'verif' | 'limited' | 'redemptions' | 'budget' | 'botCost', hide?: boolean, lowGood?: boolean) => {
    if (hide) return <Kpi key={label} label={label} value="—" sub="oculto na visão" />
    const d = prev ? v - prev[key] : 0
    return <Kpi key={label} label={label} value={f(v)} delta={compare && prev ? { v: `${d > 0 ? '↑' : d < 0 ? '↓' : '='} ${f(Math.abs(d))}`, good: d === 0 ? null : lowGood ? d < 0 : null } : undefined} />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div><h1 className="text-[26px] font-semibold">Rodadas</h1><p className="text-muted">Selecione uma rodada para abrir a cadeia causal.</p></div>
        <div className="flex gap-2">
          <Btn onClick={() => setCompare(!compare)} aria-pressed={compare}>{compare ? 'Ocultar comparação' : 'Comparar com anterior'}</Btn>
          <Btn icon={<Download size={14} />} onClick={() => { download('rodadas.csv', ['round,attack,defense,attempts,accepted,refused'].concat(rounds.slice(0, run.done).map((r) => [r.r, r.attack, r.defense, r.attempts, r.accepted, r.refused].join(','))).join('\n'), 'text/csv'); toast('rodadas.csv baixado') }}>CSV</Btn>
        </div>
      </div>

      <ol className="flex items-stretch gap-2 overflow-x-auto pb-1" aria-label="Linha do tempo de rodadas">
        {rounds.slice(0, run.total).map((r, i) => {
          const ok = i < run.done, on = idx === i
          const trig = r.engLane[3].trig || r.botLane[3].trig
          return (
            <li key={r.r} className="min-w-[150px] flex-1">
              <button disabled={!ok} aria-current={on} onClick={() => setRound(r.r)}
                className={cx('h-full w-full rounded-xl border bg-surface p-3 text-left', on ? 'border-accent ring-2 ring-accent/30' : 'border-line', !ok && 'opacity-50')}>
                <p className="flex items-center justify-between"><span className="num text-lg font-semibold">{r.r}</span>{ok && trig && <AlertTriangle size={14} className="text-verification" aria-label="gatilho acionado" />}</p>
                <p className={cx('num text-[13px] font-medium', rate(r) >= 0.5 ? 'text-accepted' : 'text-refused')}>{ok ? `${pct(rate(r))} aceitação` : 'pendente'}</p>
                <p className="mt-0.5 text-xs text-muted">{showBot ? r.attack : ''}{showBot && showEng ? ' · ' : ''}{showEng ? r.defense : ''}</p>
              </button>
            </li>
          )
        })}
      </ol>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Rodada {rd.r} · {rd.dates}</h2>
          {rd.pills.filter((p, i) => (i === 0 ? true : i === 2 ? showEng : true) && !(view === 'engine' && i === 0) && !(view === 'bot' && i === 2)).map((p) => <Pill key={p} tone="neutral" mono>{p}</Pill>)}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 text-[13px]">
          {showBot ? <p><b className="text-bot">Bot:</b> {rd.summary.bot}</p> : <Hidden what="Resumo do bot" />}
          {showEng ? <p><b className="text-engine">Motor:</b> {rd.summary.engine}</p> : <Hidden what="Resumo do motor" />}
        </div>
      </Panel>

      <div>
        <div className="grid grid-cols-[88px_repeat(4,1fr)] gap-x-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span />{['Ação', 'Resposta', 'Observação', 'Adaptação'].map((h, i) => <span key={h} className="flex items-center gap-1.5">{h}{i < 3 && <ArrowRight size={12} />}</span>)}
        </div>
        {([['bot', 'Bot', rd.botLane, showBot], ['engine', 'Motor', rd.engLane, showEng]] as const).map(([lane, name, cards, vis]) => (
          <div key={lane} className="mt-2 grid grid-cols-[88px_repeat(4,1fr)] items-stretch gap-x-3 rounded-xl border border-dashed border-line bg-[#fbfbfa] p-2">
            <span className={cx('self-center text-xs font-semibold', lane === 'bot' ? 'text-bot' : 'text-engine')}>Raia {name}</span>
            {vis ? cards.map((c, i) => <CausalCard key={i} c={c} lane={lane} />) : <div className="col-span-4 grid place-items-center py-5"><Hidden what={`Raia ${name.toLowerCase()}`} /></div>}
          </div>
        ))}
        <p className="mt-2 text-xs text-muted">Cada gatilho aponta para o número observado que o disparou. {!rd.engLane[3].trig && !rd.botLane[3].trig && 'Nenhum gatilho disparou. A política foi mantida — a ausência de mudança também é evidência.'}</p>
      </div>

      <div className="grid grid-cols-8 gap-3">
        {metric('Tentativas', rd.attempts, int, 'attempts')}
        {metric('Aceitas', rd.accepted, int, 'accepted')}
        {metric('Recusadas', rd.refused, int, 'refused')}
        {metric('Verificações', rd.verif, int, 'verif')}
        {metric('Limites', rd.limited, int, 'limited')}
        {metric('Resgates', rd.redemptions, int, 'redemptions')}
        {metric('Orçamento', rd.budget, (n) => brl(n), 'budget', view === 'bot')}
        {metric('Custo do bot', rd.botCost, (n) => brl(n), 'botCost', view === 'engine', true)}
      </div>

      <div>
        <div role="tablist" className="flex gap-1 border-b border-line">
          {['Resumo', `Tentativas ${int(rd.attempts)}`, 'Eventos', 'Políticas'].map((t, i) => (
            <button key={t} role="tab" aria-selected={sub === i} onClick={() => setSub(i)} className={cx('border-b-2 px-4 py-2 text-[13px] font-medium', sub === i ? 'border-accent' : 'border-transparent text-muted')}>{t}</button>
          ))}
        </div>
        <div className="pt-4">
          {sub === 0 && <Summary idx={idx} />}
          {sub === 1 && <AttemptsTab key={rd.r} idx={idx} />}
          {sub === 2 && <EventsTab key={rd.r} idx={idx} />}
          {sub === 3 && <PolicyTab idx={idx} />}
        </div>
      </div>
    </div>
  )
}

function Summary({ idx }: { idx: number }) {
  const { view } = useApp()
  const rd = rounds[idx]
  const trig = [rd.engLane[3], rd.botLane[3]].filter((c) => c.trig)
  return (
    <div className="grid grid-cols-2 gap-5">
      <Panel title="O que o bot viu">
        {view === 'engine' ? <Hidden what="Visão do bot" /> : (
          <ul className="list-disc space-y-1.5 pl-4 text-[13px]">
            <li>Respostas públicas de {int(rd.attempts)} tentativas: {int(rd.accepted)} aceitas.</li>
            <li>Mensagem de recusa {rd.r < 3 ? 'detalhada — revela o motivo.' : 'genérica — não revela o motivo.'}</li>
            <li>Verificações pedidas: {rd.verif}; limites: {rd.limited}.</li>
            {view !== 'bot' || true ? <li>Custo da própria tática: {brl(rd.botCost)}.</li> : null}
          </ul>
        )}
      </Panel>
      <Panel title="O que o motor viu">
        {view === 'bot' ? <Hidden what="Visão do motor" /> : (
          <ul className="list-disc space-y-1.5 pl-4 text-[13px]">
            <li>Política vigente <span className="num">{rd.policy}</span> ({rd.defense}).</li>
            <li>Sinais e relações entre contas; sem rótulo de legitimidade.</li>
            <li>Conversão agregada da coorte: <span className="num">{pct(rd.conv)}</span>.</li>
            <li>Orçamento debitado: {brl(rd.budget)}.</li>
          </ul>
        )}
      </Panel>
      <div className="col-span-2">
        <Panel title="Gatilhos acionados e mudanças">
          {trig.length === 0 ? <p className="text-[13px]">Nenhum gatilho disparou; política mantida.</p> : (
            <ul className="space-y-2 text-[13px]">
              {trig.filter((c) => (c === rd.engLane[3] ? view !== 'bot' : view !== 'engine')).map((c) => (
                <li key={c.t} className="flex items-center gap-3"><Pill tone="accent" mono icon={<AlertTriangle size={11} />}>{c.trig}</Pill><span className="text-muted">{c.trigHint}</span><ArrowRight size={13} /><span className="font-medium">{c.t}</span></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

function AttemptsTab({ idx }: { idx: number }) {
  const { view, cfg, contests, setContests, toast, goTab } = useApp()
  const rd = rounds[idx]
  const all = useMemo(() => attemptsOf(rd), [rd])
  const [res, setRes] = useState('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const rows = all.filter((a) => (res === 'all' || a.result === res) && (!q || a.account.includes(q) || a.id.includes(q)))
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE)
  const op = view !== 'bot', bot = view !== 'engine', ev = view === 'eval'
  const canContest = cfg.contestation && view !== 'bot'
  const cols = 8 + (op ? 5 : 0) + (bot ? 1 : 0) + (ev ? 1 : 0)

  const contest = (a: Attempt) => {
    if (contests.some((c) => c.attempt === a.id)) { toast('Já existe contestação para ' + a.id); goTab(4); return }
    const c: Contest = {
      id: `con_${String(13 + contests.length).padStart(5, '0')}`, attempt: a.id, account: a.account, round: rd.r, date: '21/11', evidence: 'none', status: 'open',
      message: a.message, reason: a.reason, rules: [a.reason], score: a.score, policy: rd.policy, decidedAt: `${rd.dates.split('–')[0]} ${a.time}`, note: '', slaHours: 24,
      signals: [{ k: 'dispositivo', v: a.device, shared: a.shared ? `${a.shared} contas` : undefined }, { k: 'endereço', v: a.address }, { k: 'telefone', v: a.phone }], cost: 0,
      history: [{ at: '21/11 09:00', text: 'Contestação aberta' }],
    }
    setContests([c, ...contests])
    toast(`Contestação ${c.id} aberta`)
  }
  const th = 'sticky top-0 bg-[#f9fafb] px-3 text-left text-xs font-semibold text-muted'
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <select aria-label="Filtrar por resultado" className="h-8 rounded-lg border border-line px-2 text-[13px]" value={res} onChange={(e) => { setRes(e.target.value); setPage(0) }}>
          <option value="all">Todos os resultados</option><option value="accepted">Aceito</option><option value="coupon_already_used">Recusado</option><option value="verification_required">Verificação</option><option value="rate_limited">Limite</option>
        </select>
        <input aria-label="Buscar conta" placeholder="Buscar conta ou tentativa" className="h-8 w-56 rounded-lg border border-line px-2.5 text-[13px]" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
        {!op && <span className="text-xs text-muted">Sinais e motivo interno ocultos na visão do bot.</span>}
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[1100px] text-[13px]">
          <thead><tr className="h-10"><th className={th} /><th className={th}>Tentativa</th><th className={th}>Conta</th>
            {op && <><th className={th}>E-mail</th><th className={th}>Telefone</th><th className={th}>CPF</th><th className={th}>Dispositivo</th><th className={th}>Endereço</th></>}
            <th className={th}>Resultado</th><th className={th}>Mensagem</th>{op && <th className={th}>Motivo interno</th>}<th className={cx(th, 'text-right')}>Pedido</th>{bot && <th className={cx(th, 'text-right')}>Custo</th>}{ev && <th className={th}>Rótulo</th>}<th className={th}>Hora</th></tr></thead>
          <tbody>
            {pageRows.map((a) => (
              <>
                <tr key={a.id} className="h-11 border-t border-line hover:bg-[#fafafa]">
                  <td className="pl-2"><button aria-label="Expandir" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)} className="rounded p-1 hover:bg-[#f2f4f7]">{open === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button></td>
                  <td className="num px-3">{a.id}</td><td className="num px-3">{a.account}</td>
                  {op && <><td className="num px-3">{a.email}</td><td className="num px-3">{a.phone}</td><td className="num px-3">{a.cpf}</td><td className="num px-3">{a.device}</td><td className="num px-3">{a.address}</td></>}
                  <td className="px-3"><ResultPill r={a.result} /></td>
                  <td className="max-w-[220px] truncate px-3 text-muted" title={a.message}>{a.message}</td>
                  {op && <td className="num px-3">{a.reason}</td>}
                  <td className="num px-3 text-right">{brl(a.order, 2)}</td>
                  {bot && <td className="num px-3 text-right">{brl(a.cost, 2)}</td>}
                  {ev && <td className="px-3"><Pill tone={a.label === 'fraude' ? 'refused' : 'accepted'}>{a.label === 'fraude' ? 'conta suspeita' : 'legítima'}</Pill></td>}
                  <td className="num px-3">{a.time}</td>
                </tr>
                {open === a.id && (
                  <tr key={a.id + 'x'} className="bg-[#f9fafb]"><td colSpan={cols} className="px-6 py-3">
                    <div className="grid grid-cols-3 gap-6 text-[13px]">
                      <div><p className="text-xs font-semibold text-muted">Decisão</p><p>Resultado público: <span className="num">{a.result}</span></p><p>Verificação: <span className="num">{a.verification}</span></p>{op && <p>Score: <span className="num">{dec(a.score)}</span></p>}</div>
                      <div><p className="text-xs font-semibold text-muted">Sinais</p>{op ? <><p className="num">{a.device}{a.shared ? ` · ${a.shared} contas` : ''}</p><p className="num">{a.address} · {a.phone}</p></> : <Hidden what="Sinais" />}</div>
                      <div className="space-y-1.5">
                        {ev && <p className="num text-xs text-muted">{a.person} · tática {a.tactic}</p>}
                        <div className="flex items-center gap-3"><CopyBtn text={a.id} onDone={toast} />
                          {a.result !== 'accepted' && canContest && <button className="text-xs font-medium text-limited underline" onClick={() => contest(a)}>Abrir contestação</button>}</div>
                      </div>
                    </div>
                  </td></tr>
                )}
              </>
            ))}
            {pageRows.length === 0 && <tr><td colSpan={cols} className="py-10 text-center text-muted">Nenhuma tentativa com esses filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={rows.length} />
    </Panel>
  )
}

function EventsTab({ idx }: { idx: number }) {
  const { view, toast } = useApp()
  const rd = rounds[idx]
  const all = useMemo(() => eventsOf(rd).filter((e) => visibleEvent(e, view)), [rd, view])
  const [type, setType] = useState('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState<number | null>(null)
  const rows = all.filter((e) => type === 'all' || e.type === type)
  const types = [...new Set(all.map((e) => e.type))]
  const th = 'bg-[#f9fafb] px-3 text-left text-xs font-semibold text-muted'
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line p-3">
        <select aria-label="Filtrar por tipo" className="h-8 rounded-lg border border-line px-2 text-[13px]" value={type} onChange={(e) => { setType(e.target.value); setPage(0) }}>
          <option value="all">Todos os tipos</option>{types.map((t) => <option key={t} value={t}>{EVENT_LABEL[t] ?? t}</option>)}
        </select>
        <Btn className="ml-auto h-8" icon={<Download size={14} />} onClick={() => { download(`events_round${rd.r}.jsonl`, rows.map((e) => JSON.stringify(e)).join('\n'), 'application/jsonl'); toast('JSONL baixado') }}>Baixar JSONL</Btn>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0"><tr className="h-10"><th className={th}>seq</th><th className={th}>Hora</th><th className={th}>Tipo</th><th className={th}>Ator</th><th className={th}>Conta</th><th className={th}>Resultado</th>{view !== 'bot' && <><th className={th}>Motivo interno</th><th className={th}>Política</th></>}</tr></thead>
          <tbody>
            {rows.slice(page * PAGE, page * PAGE + PAGE).map((e) => (
              <>
                <tr key={e.seq} onClick={() => setOpen(open === e.seq ? null : e.seq)} className="h-11 cursor-pointer border-t border-line hover:bg-[#fafafa]">
                  <td className="num px-3">{e.seq}</td><td className="num px-3">{e.time}</td><td className="px-3">{EVENT_LABEL[e.type] ?? e.type}</td><td className="px-3">{e.actor}</td><td className="num px-3">{e.account}</td><td className="num px-3">{e.result}</td>
                  {view !== 'bot' && <><td className="num px-3">{e.reason}</td><td className="num px-3">{e.policy}</td></>}
                </tr>
                {open === e.seq && <tr key={e.seq + 'x'} className="bg-[#f9fafb]"><td colSpan={8} className="px-6 py-3"><pre className="num text-xs">{JSON.stringify(e.payload, null, 2)}</pre></td></tr>}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} setPage={setPage} total={rows.length} />
    </Panel>
  )
}

function PolicyTab({ idx }: { idx: number }) {
  const { view, toast } = useApp()
  const rd = rounds[idx]
  if (view === 'bot') return <Banner kind="info" title="Política oculta">A política do motor não é visível ao bot.</Banner>
  const next = rounds[idx + 1]
  const a = POLICIES[rd.policy], b = next ? POLICIES[next.policy] : null
  if (!b) return <Banner kind="info" title="Sem mudança">Nenhum gatilho disparou. A política foi mantida — a ausência de mudança também é evidência.</Banner>
  const keys = Object.keys(a)
  const text = keys.filter((k) => a[k] !== b[k]).map((k) => `- ${k}: ${a[k]}\n+ ${k}: ${b[k]}`).join('\n')
  return (
    <Panel title={`${rd.policy} → ${next.policy}`} sub={rd.engLane[3].trig ? `Gatilho: ${rd.engLane[3].trig} (${rd.engLane[3].trigHint})` : 'Calibragem sem gatilho de motor'} right={<Btn className="h-8" onClick={() => { navigator.clipboard?.writeText(text); toast('Diff copiado') }}>Copiar diff</Btn>}>
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-xs text-muted"><th className="w-1/4 py-1">Regra</th><th className="w-[37%]">{rd.policy}</th><th>{next.policy}</th></tr></thead>
        <tbody>{keys.map((k) => {
          const ch = a[k] !== b[k]
          return (
            <tr key={k} className="border-t border-line">
              <td className="py-2 text-muted">{k}</td>
              <td className={cx('num', ch && 'bg-danger-bg text-refused')}>{ch && '− '}{a[k]}</td>
              <td className={cx('num', ch && 'bg-[#ecfdf3] text-accepted')}>{ch && '+ '}{b[k]}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </Panel>
  )
}
