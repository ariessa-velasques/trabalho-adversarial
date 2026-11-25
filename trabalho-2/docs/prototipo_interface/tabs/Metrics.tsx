import { useState } from 'react'
import { BarChart3, Check, Download } from 'lucide-react'
import { brl, cpa, dec, int, netBot, pct, rounds } from '../data'
import { useApp } from '../state'
import { Banner, Btn, Chart, Empty, Kpi, Panel, cx, download } from '../ui'

const C = { acc: '#067647', ref: '#b42318', ver: '#b54708', lim: '#3538cd', bot: '#6d4aff', eng: '#0e7c86', neu: '#475467' }

export default function Metrics() {
  const { run, view, cfg, goTab, toast } = useApp()
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(6)
  const [cohort, setCohort] = useState('all')
  const [defSel, setDefSel] = useState('redesign')
  const [formulas, setFormulas] = useState(false)
  if (run.done === 0) return <Empty icon={<BarChart3 />} title="Sem métricas ainda" text="Execute uma simulação para ver resgates, custos e comparação de defesas." cta={<Btn variant="primary" onClick={() => goTab(run.status === 'idle' ? 0 : 1)}>{run.status === 'idle' ? 'Abrir configuração' : 'Acompanhar execução'}</Btn>} />

  const hi = Math.min(to, run.done)
  const lo = Math.min(from, hi)
  const rs = rounds.slice(lo - 1, hi)
  const prev = lo > 1 ? rounds[lo - 2] : null
  const last = rs[rs.length - 1]
  const sum = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0)
  const T = { red: sum((r) => r.redemptions), bud: sum((r) => r.budget), cost: sum((r) => r.botCost), acc: sum((r) => r.accepted), att: sum((r) => r.attempts), fraud: sum((r) => r.fraudRed), fp: sum((r) => r.fp) }
  const net = T.red * 20 - T.cost
  const roi = T.cost ? net / T.cost : 0
  const labels = rs.map((r) => String(r.r))
  const isBot = view === 'bot', isEng = view === 'engine'
  const legit = Math.max(1, rs.length * cfg.legit)
  const na = 'oculto nesta visão'
  const K = (label: string, value: string, extra: { sub?: string; hint: string; hide?: boolean; tone?: string; delta?: { v: string; good?: boolean | null } }) =>
    extra.hide ? <Kpi key={label} label={label} value="—" sub={na} /> : <Kpi key={label} label={label} value={value} sub={extra.sub} hint={extra.hint} tone={extra.tone} delta={extra.delta} />
  const dpct = (a: number, b: number) => ({ v: `${a - b >= 0 ? '+' : '−'}${dec(Math.abs(a - b) * 100, 1)} p.p.`, good: null as boolean | null })

  const smallSample = rs.some((r) => r.attempts < 10)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[26px] font-semibold">Métricas</h1><p className="text-muted">Como as decisões de um lado mudaram o comportamento do outro, e a que custo.</p></div>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <label className="flex items-center gap-1.5">Run <select className="h-8 rounded-lg border border-line px-2 num text-xs"><option>{run.id.slice(0, 16)}…</option></select></label>
          <label className="flex items-center gap-1.5">Defesa <select value={defSel} onChange={(e) => setDefSel(e.target.value)} className="h-8 rounded-lg border border-line px-2"><option value="redesign">Redesenho</option><option value="B1">B1</option><option value="B2">B2</option></select></label>
          <label className="flex items-center gap-1.5">Rodadas
            <select aria-label="De" value={lo} onChange={(e) => { setFrom(+e.target.value); if (+e.target.value > to) setTo(+e.target.value) }} className="h-8 rounded-lg border border-line px-2">{rounds.slice(0, run.done).map((r) => <option key={r.r}>{r.r}</option>)}</select>—
            <select aria-label="Até" value={hi} onChange={(e) => setTo(+e.target.value)} className="h-8 rounded-lg border border-line px-2">{rounds.slice(lo - 1, run.done).map((r) => <option key={r.r}>{r.r}</option>)}</select></label>
          <label className="flex items-center gap-1.5">Coorte <select value={cohort} onChange={(e) => setCohort(e.target.value)} className="h-8 rounded-lg border border-line px-2"><option value="all">Todas</option><option value="legit" disabled={view !== 'eval'}>Legítima</option><option value="susp" disabled={view !== 'eval'}>Suspeita</option></select></label>
        </div>
      </div>

      {run.status !== 'done' && <Banner kind="info" title={`Execução parcial: ${run.done} de ${run.total} rodadas`}>Os números cobrem apenas as rodadas concluídas.</Banner>}
      {smallSample && <Banner kind="warn">Poucas tentativas nesta rodada. Valores de custo por aprovação podem oscilar; use a comparação entre defesas com a mesma seed.</Banner>}

      <div className="grid grid-cols-6 gap-3">
        {K('Resgates totais', int(T.red), { sub: `${int(T.att)} tentativas`, hint: 'Pedidos concluídos com desconto aplicado.', delta: { v: `+${int(T.red)}`, good: null } })}
        {K('Orçamento consumido', brl(T.bud), { sub: `${pct(T.bud / cfg.acqBudget, 1)} de ${brl(cfg.acqBudget)}`, hint: 'budget_debited = 20 × resgates', hide: isBot })}
        {K('Perda líquida (fraude)', brl(T.fraud * 14), { sub: `${int(T.fraud)} resgates de fraude`, hint: 'net_loss = orçamento debitado − comissão, por coorte fraudulenta', hide: view !== 'eval' })}
        {K('Custo do bot', brl(T.cost), { sub: `ROI ${dec(roi)}`, hint: 'spend = Σ custo da tática por tentativa. Conta do atacante: nunca somada à perda da plataforma.', hide: isEng, tone: 'text-bot' })}
        {K('Custo por aceita', brl(T.acc ? T.cost / T.acc : 0, 2), { sub: 'referência R$ 20,00', hint: 'cost_per_approved = spend / aprovações', hide: isEng, tone: T.acc && T.cost / T.acc > 20 ? 'text-refused' : undefined })}
        {K('ROI do bot', T.cost ? dec(roi) : 'n/d', { sub: `net ${net >= 0 ? '+' : '−'}${brl(Math.abs(net))}`, hint: 'roi = net_bot acumulado / Σ gasto. Indefinido se gasto = 0.', hide: isEng })}
        {K('Taxa de aceitação', pct(T.acc / T.att, 1), { hint: 'aprovações / tentativas', delta: prev ? dpct(T.acc / T.att, prev.accepted / prev.attempts) : undefined })}
        {K('Conversão legítima', pct(last.conv), { hint: 'conversion = cadastros concluídos / iniciados', hide: isBot, delta: prev ? dpct(last.conv, prev.conv) : undefined })}
        {K('Falsos positivos', pct(T.fp / legit, 1), { sub: `${T.fp} recusas legítimas`, hint: 'legit_refused / legit_attempts', hide: view !== 'eval' })}
        {K('Falsos negativos', int(T.fraud), { sub: 'fraude aceita', hint: 'fraud_accepted / fraud_attempts (contagem)', hide: view !== 'eval' })}
        {K('Contestações', `${Math.round(T.att ? 20 * (rs.length / 6) : 0)} / 25%`, { sub: 'abertas / reversão', hint: 'reversal_rate = revertidas / resolvidas', hide: isBot })}
        {K('Alertas de orçamento', '0', { sub: 'limiar de 20% não atingido', hint: 'budget_consumption_alert = 20%', hide: isBot })}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Chart title="Resgates e orçamento por rodada" sub="Barras: resgates · linha: orçamento debitado" labels={labels} unit="resgates" unit2="R$" y2Lines
          bars={[{ name: 'Resgates', color: C.eng, values: rs.map((r) => r.redemptions) }]} lines={isBot ? [] : [{ name: 'Orçamento debitado (R$)', color: C.ver, values: rs.map((r) => r.budget) }]} fmt={int} fmt2={(n) => brl(n)}
          desc={`Resgates por rodada de ${lo} a ${hi}; a rodada 1 tem o pico de ${rounds[0].redemptions}.`} />
        <Chart title="Aceitação × custo por aprovada" sub="Barras: aceitação · linha tracejada: custo por aprovada, marco R$ 20" labels={labels} unit="%" unit2="R$" y2Lines
          bars={[{ name: 'Aceitação (%)', color: C.acc, values: rs.map((r) => Math.round((r.accepted / r.attempts) * 100)) }]}
          lines={isEng ? [] : [{ name: 'Custo por aprovada (R$)', color: C.ref, dash: '5 3', values: rs.map((r) => +cpa(r).toFixed(2)) }]} ref={isEng ? undefined : { value: 20, label: 'R$ 20 · valor do desconto' }} fmt={(n) => dec(n, 0)} fmt2={(n) => brl(n)}
          desc="Aceitação cai de 100% para 35% enquanto o custo por aprovada ultrapassa R$ 20 na rodada 4." />
        <Chart title="Resultado das tentativas" sub="Aceito, recusado, verificação e limite por rodada" labels={labels} stacked unit="tentativas" fmt={int}
          bars={[{ name: 'Aceito', color: C.acc, values: rs.map((r) => r.accepted) }, { name: 'Recusado', color: C.ref, values: rs.map((r) => r.refused) }, { name: 'Verificação', color: C.ver, values: rs.map((r) => r.verif) }, { name: 'Limite', color: C.lim, values: rs.map((r) => r.limited) }]}
          desc="Tentativas por resultado em cada rodada; recusas dominam na rodada 4." />
        <Chart title="Conversão legítima × falsos positivos" sub="Custo da defesa para o cliente real" labels={labels} unit="%" fmt={(n) => dec(n, 0)}
          lines={isBot ? [] : [{ name: 'Conversão legítima (%)', color: C.eng, values: rs.map((r) => Math.round(r.conv * 100)) }, ...(view === 'eval' ? [{ name: 'Falsos positivos (%)', color: C.ref, dash: '5 3', values: rs.map((r) => +(r.fp / cfg.legit * 100).toFixed(1)) }] : [])]}
          desc="A conversão legítima cai a 55% com B2 e se recupera a 78% com a defesa calibrada." />
      </div>

      <Panel title="Custo do bot × perda da plataforma" sub="Dois atores, duas contas, eixos separados. Nunca somar (ADR-012)." >
        <div className="grid grid-cols-2 gap-5">
          {isEng ? <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">Custo do bot oculto na visão do motor.</p> :
            <Chart title="Custo do bot (R$)" labels={labels} unit="R$" fmt={(n) => brl(n)} bars={[{ name: 'Custo do bot', color: C.bot, values: rs.map((r) => r.botCost) }]} desc="Custo da tática do bot por rodada." />}
          {view !== 'eval' ? <p className="rounded-lg border border-dashed border-line p-6 text-center text-muted">Perda atribuída à fraude exige rótulos; disponível só na visão de avaliação.</p> :
            <Chart title="Perda líquida da plataforma (R$)" labels={labels} unit="R$" fmt={(n) => brl(n)} bars={[{ name: 'Perda (fraude × R$ 14)', color: C.ref, values: rs.map((r) => r.fraudRed * 14) }]} desc="Perda líquida da plataforma atribuída à fraude por rodada." />}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-5">
        <Panel title="Funil: cadastro → verificação → pedido → resgate" sub="Onde o atrito derruba a conversão">
          {[['Cadastros iniciados', 1.0], ['Verificação concluída', 0.76], ['Pedido iniciado', 0.52], ['Resgate', 0.46]].map(([l, f], i) => {
            const base = Math.round(T.att * 1.25)
            const v = Math.round(base * (f as number))
            return (
              <div key={String(l)} className="mb-2.5">
                <div className="mb-1 flex justify-between text-xs"><span>{l}</span><span className="num text-muted">{int(v)} · {pct(f as number)}</span></div>
                <div className="h-5 rounded bg-[#f2f4f7]"><div className={cx('h-full rounded', i === 3 ? 'bg-accepted' : 'bg-engine')} style={{ width: `${(f as number) * 100}%`, opacity: 1 - i * 0.12 }} /></div>
              </div>
            )
          })}
        </Panel>
        <Panel title="Reuso de sinais" sub="Parcela de contas que compartilham o sinal, por rodada">
          {view === 'bot' ? <p className="text-muted">Sinais de relação ficam ocultos na visão do bot.</p> : (
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted"><th className="py-1">Rodada</th>{['Dispositivo', 'CPF', 'Telefone', 'Endereço'].map((s) => <th key={s}>{s}</th>)}</tr></thead>
              <tbody>{rs.map((r) => {
                const base = [r.r === 1 ? 0.05 : r.r < 5 ? 0.25 + r.r * 0.06 : 0.12, r.r === 2 ? 0.34 : r.r < 5 ? 0.18 : 0.04, r.r === 2 ? 0.3 : r.r < 5 ? 0.2 : 0.05, r.r < 5 ? 0.28 : 0.14]
                return <tr key={r.r} className="border-t border-line"><td className="num py-1">{r.r}</td>{base.map((b, i) => <td key={i} className="p-0.5"><div className="num rounded py-1.5 text-center font-medium" style={{ background: `rgba(14,124,134,${0.1 + b * 1.6})`, color: b > 0.3 ? '#fff' : '#171a1f' }}>{pct(b)}</div></td>)}</tr>
              })}</tbody>
            </table>
          )}
        </Panel>
      </div>

      {!isBot && (
        <Panel title="Painel AM3">
          <div className="grid grid-cols-6 gap-4 text-[13px]">
            {[['Sondagens detectadas', String(rs.filter((r) => r.r >= 3).length ? 12 : 0)], ['Limites acionados', String(sum((r) => r.limited))], ['Mensagem genérica', cfg.generic ? 'ligada' : 'desligada'], ['Contestações', '20'], ['Reversões', '5'], ['Tempo médio', '18 h']].map(([k, v]) => (
              <div key={k}><p className="text-xs text-muted">{k}</p><p className="num text-xl font-semibold">{v}</p></div>
            ))}
          </div>
        </Panel>
      )}

      {view === 'eval' && (
        <Panel title="Comparação de defesas" sub="Valores de referência, ilustrativos. Cada melhor célula é por métrica, não uma “melhor geral”.">
          {cfg.preset !== 'compare' && <div className="mb-3"><Banner kind="info">Execute a mesma seed nas três defesas (preset Comparar defesas) para comparar com dados da sua execução.</Banner></div>}
          <CompareTable />
        </Panel>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Btn icon={<Download size={14} />} onClick={() => { download('metrics.csv', ['round,attempts,accepted,refused,verifications,limited,redemptions,budget_debited,bot_cost,net_bot'].concat(rs.map((r) => [r.r, r.attempts, r.accepted, r.refused, r.verif, r.limited, r.redemptions, r.budget, r.botCost, netBot(r)].join(','))).join('\n'), 'text/csv'); toast('metrics.csv baixado') }}>Exportar métricas</Btn>
          <Btn icon={<Download size={14} />} onClick={() => toast('redemptions.csv exportado em saidas/runs/' + run.id)}>Exportar resgates</Btn>
          <Btn icon={<Download size={14} />} onClick={() => toast('attempts.csv exportado em saidas/runs/' + run.id)}>Exportar tentativas</Btn>
          <Btn icon={<Download size={14} />} onClick={() => toast('events.jsonl exportado em saidas/runs/' + run.id)}>JSONL</Btn>
          <button className="ml-auto text-[13px] font-medium text-limited underline" aria-expanded={formulas} onClick={() => setFormulas(!formulas)}>Fórmulas e definições {formulas ? '▾' : '▸'}</button>
        </div>
        {formulas && <pre className="num mt-3 overflow-auto rounded-lg bg-[#f7f7f5] p-3 text-xs leading-5">{`spend(r)              = Σ custo da tática por tentativa
net_bot(r)            = 20 × resgates(r) − spend(r)
cost_per_approved(r)  = spend(r) / aprovações(r)
roi                   = net_bot acumulado / Σ spend
budget_debited        = 20 × resgates
net_loss              = budget_debited − comissão
false_positive_rate   = legit_refused / legit_attempts
false_negative_rate   = fraud_accepted / fraud_attempts
reversal_rate         = revertidas / contestações resolvidas`}</pre>}
      </Panel>
    </div>
  )
}

function CompareTable() {
  const rows = [
    { n: 'B1 fixa', red: 1150, fr: 1040, conv: 0.96, fp: 0.005, fn: 1040, def: 0, cpa: 0, al: 3 },
    { n: 'B2 fixa', red: 780, fr: 560, conv: 0.58, fp: 0.09, fn: 560, def: 3100, cpa: 9.4, al: 1 },
    { n: 'Redesenho', red: 557, fr: 480, conv: 0.78, fp: 0.018, fn: 480, def: 4860, cpa: 11.87, al: 0 },
  ]
  type R = (typeof rows)[number]
  const cols: { k: keyof R; l: string; f: (n: number) => string; low: boolean }[] = [
    { k: 'red', l: 'Resgates', f: int, low: true }, { k: 'fr', l: 'Resgates de fraude', f: int, low: true }, { k: 'conv', l: 'Conversão legítima', f: (n) => pct(n), low: false },
    { k: 'fp', l: 'Falsos positivos', f: (n) => pct(n, 1), low: true }, { k: 'fn', l: 'Falsos negativos', f: int, low: true }, { k: 'def', l: 'Custo da defesa', f: (n) => brl(n), low: true },
    { k: 'cpa', l: 'Custo por aprovação', f: (n) => brl(n, 2), low: false }, { k: 'al', l: 'Alertas', f: int, low: true },
  ]
  const ref = rows[2]
  return (
    <div className="overflow-auto">
      <table className="w-full text-[13px]">
        <thead><tr className="h-10 text-left text-xs text-muted"><th>Configuração</th>{cols.map((c) => <th key={c.k} className="px-2">{c.l}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.n} className="h-12 border-t border-line">
            <td className="font-medium">{r.n}</td>
            {cols.map((c) => {
              const v = r[c.k] as number
              const best = c.k === 'cpa' ? false : rows.every((o) => (c.low ? v <= (o[c.k] as number) : v >= (o[c.k] as number)))
              const d = v - (ref[c.k] as number)
              return (
                <td key={c.k} className={cx('px-2', best && 'bg-[#ecfdf3]')}>
                  <span className="num flex items-center gap-1 font-medium">{best && <Check size={12} className="text-accepted" aria-label="melhor nesta métrica" />}{c.f(v)}</span>
                  {r !== ref && <span className="num text-[11px] text-muted">Δ {d >= 0 ? '+' : '−'}{c.f(Math.abs(d))}</span>}
                </td>
              )
            })}
          </tr>))}
        </tbody>
      </table>
    </div>
  )
}
