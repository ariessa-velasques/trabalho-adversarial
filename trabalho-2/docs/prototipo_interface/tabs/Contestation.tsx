import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Clock, Download, HelpCircle, MessageSquare, Plus, XCircle, Search } from 'lucide-react'
import { EVIDENCE_LABEL, STATUS_LABEL, attemptsOf, brl, dec, rounds, type CStatus, type Contest } from '../data'
import { useApp } from '../state'
import { Banner, Btn, Empty, Hidden, Kpi, Modal, Panel, Pill, download, inputCls, cx, type Tone } from '../ui'

const ST: Record<CStatus, { tone: Tone; icon: React.ReactNode }> = {
  open: { tone: 'limited', icon: <Circle size={11} /> },
  under_review: { tone: 'verification', icon: <Clock size={11} /> },
  reverted: { tone: 'accepted', icon: <CheckCircle2 size={11} /> },
  maintained: { tone: 'refused', icon: <XCircle size={11} /> },
  inconclusive: { tone: 'neutral', icon: <HelpCircle size={11} /> },
}
const StatusPill = ({ s }: { s: CStatus }) => <Pill tone={ST[s].tone} icon={ST[s].icon}>{STATUS_LABEL[s]}</Pill>
const Sla = ({ h }: { h: number }) => h < 0 ? <span className="inline-flex items-center gap-1 text-verification"><AlertTriangle size={12} />Fora do SLA</span> : h > 0 ? <span>SLA: {h} h restantes</span> : null

export default function Contestation() {
  const { run, view, cfg, setCfg, contests, setContests, toast, goTab } = useApp()
  const [selId, setSelId] = useState<string>('con_00007')
  const [fStatus, setFStatus] = useState('all')
  const [fRound, setFRound] = useState('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('sla')
  const [modal, setModal] = useState(false)
  const [check, setCheck] = useState<Record<string, boolean>>({})

  if (run.done === 0) return <Empty icon={<MessageSquare />} title="Nenhuma contestação" text="Nenhuma contestação nesta execução. Ative o canal de contestação na configuração ou simule uma recusa." cta={<Btn variant="primary" onClick={() => goTab(0)}>Abrir configuração</Btn>} />
  if (!cfg.contestation) return <Empty icon={<MessageSquare />} title="Canal de contestação desligado" text="O quarto controle da AM3 está desativado: clientes legítimos recusados não têm caminho de revisão." cta={<Btn variant="primary" onClick={() => { setCfg({ ...cfg, contestation: true, defense: 'redesign' }); toast('Canal de contestação ativado') }}>Ativar canal de contestação</Btn>} />
  if (view === 'bot') return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <h1 className="text-[26px] font-semibold">Contestação</h1>
      <Banner kind="info" title="Sua contestação foi aberta">Na visão do bot só aparece o resultado público: “Não foi possível aplicar o cupom neste pedido.” Fila, motivo interno e decisão de revisão ficam ocultos.</Banner>
    </div>
  )

  const list = contests.filter((c) => c.round <= run.done)
  const sel = list.find((c) => c.id === selId) ?? list[0]
  const filtered = list.filter((c) => (fStatus === 'all' || c.status === fStatus) && (fRound === 'all' || c.round === +fRound) && (!q || c.account.includes(q) || c.id.includes(q)))
    .sort((a, b) => sort === 'sla' ? (a.slaHours || 99) - (b.slaHours || 99) : sort === 'recent' ? b.id.localeCompare(a.id) : b.score - a.score)
  const n = (s: CStatus) => list.filter((c) => c.status === s).length
  const resolved = n('maintained') + n('reverted')
  const patch = (id: string, p: Partial<Contest>) => setContests(contests.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const now = '21/11 ' + String(9 + (contests.reduce((a, c) => a + c.history.length, 0) % 8)).padStart(2, '0') + ':15'

  const resolve = (c: Contest, status: 'maintained' | 'reverted' | 'inconclusive') => {
    let outcome: string | undefined
    if (status === 'reverted') {
      const ok = c.score < 0.75
      outcome = ok ? 'Nova avaliação no checkout: coupon_decided = accepted. Pedido concluído; resgate debitado uma vez.' : 'Nova avaliação no checkout: coupon_decided = refused (indício persistente). Sem resgate.'
    }
    patch(c.id, { status, outcome, slaHours: 0, cost: c.cost || 18, history: [...c.history, { at: now, text: { maintained: 'Mantida', reverted: 'Revertida · checkout reavaliou', inconclusive: 'Encerrada como inconclusiva' }[status] }] })
    toast(`${c.id}: ${STATUS_LABEL[status].toLowerCase()}`)
  }
  const done = sel && ['maintained', 'reverted', 'inconclusive'].includes(sel.status)

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-semibold">Contestação</h1>
          <p className="text-muted">Caminho de revisão para o cliente legítimo recusado, sem aprovação automática.</p>
        </div>
        <div className="flex gap-2">
          <Btn icon={<Download size={14} />} onClick={() => { download('contestacoes.csv', ['id,account,round,status,evidence,cost'].concat(list.map((c) => [c.id, c.account, c.round, c.status, c.evidence, c.cost].join(','))).join('\n'), 'text/csv'); toast('contestacoes.csv baixado') }}>Exportar</Btn>
          <Btn variant="primary" icon={<Plus size={14} />} onClick={() => setModal(true)}>Simular contestação</Btn>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-3">
        <Kpi label="Abertas" value={String(n('open'))} />
        <Kpi label="Em análise" value={String(n('under_review'))} />
        <Kpi label="Revertidas" value={String(n('reverted'))} />
        <Kpi label="Mantidas" value={String(n('maintained'))} />
        <Kpi label="Inconclusivas" value={String(n('inconclusive'))} />
        <Kpi label="Tempo médio" value="18 h" />
        {view === 'eval' ? <Kpi label="Custo de atendimento" value={brl(list.reduce((a, c) => a + c.cost, 0))} /> : <Kpi label="Custo de atendimento" value="—" sub="oculto" />}
        <Kpi label="Taxa de reversão" value={resolved ? Math.round((n('reverted') / resolved) * 100) + '%' : 'n/d'} hint="Reversão não é aprovação automática; o checkout reavalia primeira compra, valor e orçamento." />
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5">
        <Panel title="Fila" right={<select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 rounded-lg border border-line px-2 text-xs"><option value="sla">SLA mais próximo</option><option value="recent">Mais recente</option><option value="impact">Maior impacto</option></select>}>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative"><Search size={13} className="absolute left-2 top-2.5 text-muted" /><input aria-label="Buscar" placeholder="Conta ou ID" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 w-36 rounded-lg border border-line pl-7 text-[13px]" /></div>
            <select aria-label="Status" value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-8 rounded-lg border border-line px-2 text-[13px]"><option value="all">Todos os status</option>{(Object.keys(STATUS_LABEL) as CStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
            <select aria-label="Rodada" value={fRound} onChange={(e) => setFRound(e.target.value)} className="h-8 rounded-lg border border-line px-2 text-[13px]"><option value="all">Todas as rodadas</option>{rounds.slice(2, run.done).map((r) => <option key={r.r} value={r.r}>Rodada {r.r}</option>)}</select>
          </div>
          <ul className="max-h-[540px] space-y-2 overflow-auto">
            {filtered.map((c) => (
              <li key={c.id}>
                <button onClick={() => setSelId(c.id)} aria-current={sel?.id === c.id} className={cx('w-full rounded-lg border p-3 text-left', sel?.id === c.id ? 'border-accent bg-[#fff8f5]' : 'border-line hover:bg-[#fafafa]')}>
                  <div className="flex items-center justify-between"><span className="num text-[13px] font-semibold">{c.account} · rodada {c.round} · {c.date}</span><StatusPill s={c.status} /></div>
                  <p className="mt-1 truncate text-xs text-muted">“{c.message}”</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted"><span>Evidência: {EVIDENCE_LABEL[c.evidence]}</span><Sla h={c.slaHours} /></div>
                  {c.abuse && <div className="mt-1.5"><Pill tone="refused" icon={<AlertTriangle size={11} />}>padrão de abuso</Pill></div>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="py-8 text-center text-muted">Nenhuma contestação com esses filtros.</li>}
          </ul>
        </Panel>

        {sel && (
          <Panel>
            <div className="flex items-start justify-between">
              <div><h2 className="num text-lg font-semibold">{sel.id} · {sel.account}</h2><p className="text-xs text-muted">Aberta em {sel.date} · política <span className="num">{sel.policy}</span></p></div>
              <StatusPill s={sel.status} />
            </div>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Decisão original</h3>
            <div className="mt-1.5 rounded-lg bg-[#f9fafb] p-3 text-[13px]">
              <p>Recusado · “{sel.message}”</p>
              <p className="mt-1 text-xs text-muted">Decidida em {sel.decidedAt}</p>
              <p className="mt-1">Motivo interno: {view === 'engine' || view === 'eval' ? <span className="num font-medium">{sel.reason}</span> : <Hidden what="Motivo" />} · regras: <span className="num">{sel.rules.join(', ')}</span> · score <span className="num">{dec(sel.score)}</span></p>
            </div>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Sinais apresentados</h3>
            <table className="mt-1.5 w-full text-[13px]"><tbody>{sel.signals.map((s) => (
              <tr key={s.k} className="border-t border-line"><td className="py-1.5 text-muted">{s.k}</td><td className="num">{s.v}</td><td className="text-right">{s.shared && <Pill tone="verification" icon={<AlertTriangle size={11} />}>{s.shared} usam este sinal</Pill>}</td></tr>))}</tbody></table>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Evidência simulada</h3>
            <div className="mt-1.5 grid grid-cols-2 gap-3">
              <select aria-label="Tipo de evidência" disabled={!!done} value={sel.evidence} onChange={(e) => patch(sel.id, { evidence: e.target.value })} className={inputCls()}>{Object.entries(EVIDENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input aria-label="Observação" disabled={!!done} placeholder="Observação" value={sel.note} onChange={(e) => patch(sel.id, { note: e.target.value })} className={inputCls()} />
            </div>

            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Checklist de revisão</h3>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
              {['Primeira compra', 'Valor > R$ 30,00', 'Orçamento disponível', 'Relação legítima', 'Sem reincidência'].map((k) => (
                <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="accent-[#e4572e]" disabled={!!done} checked={!!check[sel.id + k]} onChange={(e) => setCheck({ ...check, [sel.id + k]: e.target.checked })} />{k}</label>
              ))}
            </div>

            {sel.outcome && <div className="mt-4"><Banner kind={sel.outcome.includes('accepted') ? 'success' : 'warn'} title="Resultado da reversão">{sel.outcome}</Banner></div>}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <Btn variant="danger" disabled={!!done} onClick={() => resolve(sel, 'maintained')}>Manter</Btn>
              <Btn disabled={!!done} onClick={() => resolve(sel, 'reverted')}>Reverter</Btn>
              <Btn disabled={!!done} onClick={() => resolve(sel, 'inconclusive')}>Inconclusiva</Btn>
              <Btn variant="primary" className="ml-auto" disabled={!!done} onClick={() => { patch(sel.id, { status: 'under_review', history: sel.status === 'under_review' ? sel.history : [...sel.history, { at: now, text: 'Em análise · evidência salva' }] }); toast('Evidência salva; contestação em análise') }}>Salvar e resolver</Btn>
            </div>
            <p className="mt-2 text-xs text-muted">Reverter não concede o cupom automaticamente; o checkout reavalia primeira compra, valor e orçamento.</p>
          </Panel>
        )}
      </div>

      {sel && (
        <Panel title="Histórico da revisão" right={<span className="num text-xs text-muted">custo {view === 'eval' ? brl(sel.cost) : '—'} · tempo {done ? '6,5 h' : 'em curso'}</span>}>
          <ol className="space-y-2 border-l-2 border-line pl-4">
            {sel.history.map((h, i) => (
              <li key={i} className="relative text-[13px]"><span className="absolute -left-[22px] top-1.5 h-2 w-2 rounded-full bg-engine" /><span className="num text-xs text-muted">{h.at}</span> · <span className="text-muted">review</span> · {h.text}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">Decisão revertida gera nova avaliação no checkout, não resgate automático.</p>
        </Panel>
      )}

      {modal && <SimModal onClose={() => setModal(false)} onCreate={(c) => { setContests([c, ...contests]); setSelId(c.id); setModal(false); toast(`Contestação ${c.id} aberta`) }} />}
    </div>
  )
}

function SimModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Contest) => void }) {
  const { contests, run } = useApp()
  const [r, setR] = useState(Math.min(3, run.done))
  const refused = useMemo(() => attemptsOf(rounds[r - 1]).filter((a) => a.result !== 'accepted').slice(0, 20), [r])
  const [aid, setAid] = useState('')
  const [ev, setEv] = useState('address_proof')
  const [note, setNote] = useState('')
  const a = refused.find((x) => x.id === aid) ?? refused[0]
  return (
    <Modal title="Simular contestação" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-[13px] font-medium">Rodada<select className={inputCls()} value={r} onChange={(e) => { setR(+e.target.value); setAid('') }}>{rounds.slice(0, run.done).filter((x) => x.refused + x.verif + x.limited > 0).map((x) => <option key={x.r}>{x.r}</option>)}</select></label>
        <label className="block text-[13px] font-medium">Recusa elegível<select className={inputCls()} value={a?.id} onChange={(e) => setAid(e.target.value)}>{refused.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.account} · {x.reason}</option>)}</select></label>
        <label className="block text-[13px] font-medium">Evidência<select className={inputCls()} value={ev} onChange={(e) => setEv(e.target.value)}>{Object.entries(EVIDENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block text-[13px] font-medium">Observação<input className={inputCls()} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="flex justify-end gap-2 pt-2">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn variant="primary" disabled={!a} onClick={() => a && onCreate({
            id: `con_${String(13 + contests.length).padStart(5, '0')}`, attempt: a.id, account: a.account, round: r, date: '21/11', evidence: ev, status: 'open', message: a.message, reason: a.reason, rules: [a.reason], score: a.score,
            policy: rounds[r - 1].policy, decidedAt: `${rounds[r - 1].dates.split('–')[0]} ${a.time}`, note, slaHours: 24, cost: 0,
            signals: [{ k: 'dispositivo', v: a.device, shared: a.shared ? `${a.shared} contas` : undefined }, { k: 'endereço', v: a.address }, { k: 'telefone', v: a.phone }],
            history: [{ at: '21/11 09:00', text: 'Contestação aberta (contestation_opened)' }],
          })}>Abrir contestação</Btn>
        </div>
      </div>
    </Modal>
  )
}
