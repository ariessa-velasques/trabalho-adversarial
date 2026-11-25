import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  HelpCircle,
  MessageSquare,
  Plus,
  Search,
  XCircle,
} from 'lucide-react'
import { useApp } from '../app/AppContext'
import { brl, dec } from '../data/format'
import { CONTEST_STATUS_LABEL, EVIDENCE_LABEL, GENERIC_MESSAGE } from '../data/demo'
import type { Contest, ContestStatus } from '../data/types'
import {
  Banner,
  Btn,
  Empty,
  Modal,
  PageHeader,
  Panel,
  Pill,
  Stat,
  StatStrip,
  cx,
  inputCls,
  type Tone,
} from '../components/ui'
import { download } from '../lib/download'

const STATUS_STYLE: Record<ContestStatus, { tone: Tone; icon: React.ReactNode }> = {
  open: { tone: 'limited', icon: <Circle size={10} /> },
  under_review: { tone: 'verification', icon: <Clock size={10} /> },
  reverted: { tone: 'accepted', icon: <CheckCircle2 size={10} /> },
  maintained: { tone: 'refused', icon: <XCircle size={10} /> },
  inconclusive: { tone: 'neutral', icon: <HelpCircle size={10} /> },
}

const StatusPill = ({ status }: { status: ContestStatus }) => (
  <Pill tone={STATUS_STYLE[status].tone} icon={STATUS_STYLE[status].icon}>
    {CONTEST_STATUS_LABEL[status]}
  </Pill>
)

const Sla = ({ hours }: { hours: number }) =>
  hours < 0 ? (
    <span className="inline-flex items-center gap-1 text-verification">
      <AlertTriangle size={11} />
      Fora do SLA
    </span>
  ) : hours > 0 ? (
    <span>SLA: {hours} h restantes</span>
  ) : null

const stamp = () => {
  const date = new Date()
  return {
    date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default function Contestation() {
  const { run, view, cfg, setCfg, contests, setContests, toast, goTab, source } = useApp()
  const [selectedId, setSelectedId] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterRound, setFilterRound] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('sla')
  const [modal, setModal] = useState(false)
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})

  if (run.done === 0) {
    return (
      <Empty
        icon={<MessageSquare />}
        title="Nenhuma contestação"
        text="Nenhuma contestação nesta execução. Ative o canal de contestação na configuração ou simule uma recusa."
        cta={
          <Btn variant="primary" onClick={() => goTab(0)}>
            Abrir configuração
          </Btn>
        }
      />
    )
  }

  if (!cfg.contestation) {
    return (
      <Empty
        icon={<MessageSquare />}
        title="Canal de contestação desligado"
        text="O quarto controle da AM3 está desativado: clientes legítimos recusados não têm caminho de revisão."
        cta={
          <Btn
            variant="primary"
            onClick={() => {
              setCfg({ ...cfg, contestation: true, defense: 'redesign' })
              toast('Canal de contestação ativado')
            }}
          >
            Ativar canal de contestação
          </Btn>
        }
      />
    )
  }

  if (view === 'bot') {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-6">
        <PageHeader title="Contestação" />
        <Banner kind="info" title="Sua contestação foi aberta">
          Na visão do bot só aparece o resultado público: “Não foi possível aplicar o cupom neste pedido.” Fila, motivo
          interno e decisão de revisão ficam ocultos.
        </Banner>
      </div>
    )
  }

  const list = contests.filter((contest) => contest.round <= run.done)
  if (list.length === 0) {
    return (
      <Empty
        icon={<MessageSquare />}
        title="Nenhuma contestação nesta execução"
        text="Abra uma contestação a partir de uma recusa para exercitar o caminho de revisão."
        cta={
          <Btn variant="primary" onClick={() => setModal(true)}>
            Simular contestação
          </Btn>
        }
      />
    )
  }

  const filtered = list
    .filter(
      (contest) =>
        (filterStatus === 'all' || contest.status === filterStatus) &&
        (filterRound === 'all' || contest.round === Number(filterRound)) &&
        (!query || contest.account.includes(query) || contest.id.includes(query)),
    )
    .sort((a, b) =>
      sort === 'sla'
        ? (a.slaHours || 99) - (b.slaHours || 99)
        : sort === 'recent'
          ? b.id.localeCompare(a.id)
          : b.score - a.score,
    )

  const selected = filtered.find((contest) => contest.id === selectedId) ?? filtered[0] ?? list[0]

  const count = (status: ContestStatus) => list.filter((contest) => contest.status === status).length
  const resolved = count('maintained') + count('reverted')
  const patch = (id: string, changes: Partial<Contest>) =>
    setContests(contests.map((contest) => (contest.id === id ? { ...contest, ...changes } : contest)))
  const { date, time } = stamp()
  const now = `${date} ${time}`
  const isDone = ['maintained', 'reverted', 'inconclusive'].includes(selected.status)

  const resolve = (contest: Contest, status: 'maintained' | 'reverted' | 'inconclusive') => {
    let outcome: string | undefined
    if (status === 'reverted') {
      const accepted = contest.score < 0.75
      outcome = accepted
        ? 'Nova avaliação no checkout: coupon_decided = accepted. Pedido concluído; resgate debitado uma vez.'
        : 'Nova avaliação no checkout: coupon_decided = refused (indício persistente). Sem resgate.'
    }
    patch(contest.id, {
      status,
      outcome,
      slaHours: 0,
      cost: contest.cost || 18,
      history: [
        ...contest.history,
        {
          at: now,
          text: { maintained: 'Mantida', reverted: 'Revertida · checkout reavaliou', inconclusive: 'Encerrada como inconclusiva' }[
            status
          ],
        },
      ],
    })
    toast(`${contest.id}: ${CONTEST_STATUS_LABEL[status].toLowerCase()}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contestação"
        description="Caminho de revisão para o cliente legítimo recusado, sem aprovação automática."
        actions={
          <>
            <Btn
              icon={<Download size={13} />}
              onClick={() => {
                const columns = ['id', 'account', 'round', 'status', 'evidence', ...(view === 'eval' ? ['cost'] : [])]
                download(
                  'contestacoes.csv',
                  [columns.join(',')]
                    .concat(
                      list.map((contest) =>
                        [contest.id, contest.account, contest.round, contest.status, contest.evidence, ...(view === 'eval' ? [contest.cost] : [])].join(','),
                      ),
                    )
                    .join('\n'),
                  'text/csv',
                )
                toast('contestacoes.csv baixado')
              }}
            >
              Exportar
            </Btn>
            <Btn variant="primary" icon={<Plus size={13} />} onClick={() => setModal(true)}>
              Simular contestação
            </Btn>
          </>
        }
      />

      <StatStrip cols={8}>
        <Stat label="Abertas" value={String(count('open'))} />
        <Stat label="Em análise" value={String(count('under_review'))} />
        <Stat label="Revertidas" value={String(count('reverted'))} />
        <Stat label="Mantidas" value={String(count('maintained'))} />
        <Stat label="Inconclusivas" value={String(count('inconclusive'))} />
        <Stat label="Tempo médio" value="18 h" sub="estimado no cenário" />
        {view === 'eval' ? (
          <Stat label="Custo de atendimento" value={brl(list.reduce((acc, contest) => acc + contest.cost, 0))} />
        ) : (
          <Stat label="Custo de atendimento" value="—" sub="oculto na visão" />
        )}
        <Stat
          label="Taxa de reversão"
          value={resolved ? `${Math.round((count('reverted') / resolved) * 100)}%` : 'n/d'}
          hint="Reversão não é aprovação automática; o checkout reavalia primeira compra, valor e orçamento."
        />
      </StatStrip>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel
          title="Fila"
          right={
            <select
              aria-label="Ordenar"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="h-7 rounded-md border border-line bg-surface px-2 text-[11px]"
            >
              <option value="sla">SLA mais próximo</option>
              <option value="recent">Mais recente</option>
              <option value="impact">Maior impacto</option>
            </select>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2.5 text-muted" />
              <input
                aria-label="Buscar contestação"
                placeholder="Conta ou ID"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-7 w-36 rounded-md border border-line bg-surface pl-6 pr-2 text-[11.5px]"
              />
            </div>
            <select
              aria-label="Status"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="h-7 rounded-md border border-line bg-surface px-2 text-[11.5px]"
            >
              <option value="all">Todos os status</option>
              {(Object.keys(CONTEST_STATUS_LABEL) as ContestStatus[]).map((status) => (
                <option key={status} value={status}>
                  {CONTEST_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <select
              aria-label="Rodada"
              value={filterRound}
              onChange={(event) => setFilterRound(event.target.value)}
              className="h-7 rounded-md border border-line bg-surface px-2 text-[11.5px]"
            >
              <option value="all">Todas as rodadas</option>
              {source.rounds.slice(0, run.done).map((round) => (
                <option key={round.r} value={round.r}>
                  Rodada {round.r}
                </option>
              ))}
            </select>
          </div>

          <ul className="scroll-thin max-h-[540px] space-y-2 overflow-auto pr-1">
            {filtered.map((contest) => (
              <li key={contest.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(contest.id)}
                  aria-current={selected.id === contest.id}
                  className={cx(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    selected.id === contest.id ? 'border-accent bg-accent-soft' : 'border-line hover:bg-[#fafbf8]',
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="num text-[11.5px] font-semibold">
                      {contest.account} · rodada {contest.round} · {contest.date}
                    </span>
                    <StatusPill status={contest.status} />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted">“{contest.message}”</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-muted">
                    <span>Evidência: {EVIDENCE_LABEL[contest.evidence]}</span>
                    <Sla hours={contest.slaHours} />
                  </div>
                  {contest.abuse && (
                    <div className="mt-1.5">
                      <Pill tone="refused" icon={<AlertTriangle size={10} />}>
                        padrão de abuso
                      </Pill>
                    </div>
                  )}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="py-8 text-center text-[12px] text-muted">Nenhuma contestação com esses filtros.</li>
            )}
          </ul>
        </Panel>

        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="num text-[15px] font-semibold">
                {selected.id} · {selected.account}
              </h2>
              <p className="text-[10.5px] text-muted">
                Aberta em {selected.date} · política <span className="num">{selected.policy}</span>
              </p>
            </div>
            <StatusPill status={selected.status} />
          </div>

          <h3 className="rule-label mt-4">Decisão original</h3>
          <div className="mt-1.5 rounded-md bg-[#f7f8f4] p-3 text-[12px]">
            <p>Recusado · “{selected.message}”</p>
            <p className="mt-1 text-[10.5px] text-muted">Decidida em {selected.decidedAt}</p>
            <p className="mt-1">
              Motivo interno: <span className="num font-medium">{selected.reason}</span> · regras:{' '}
              <span className="num">{selected.rules.join(', ')}</span> · score <span className="num">{dec(selected.score)}</span>
            </p>
          </div>

          <h3 className="rule-label mt-4">Sinais apresentados</h3>
          <table className="mt-1.5 w-full text-[11.5px]">
            <tbody>
              {selected.signals.map((signal) => (
                <tr key={signal.key} className="border-t border-line">
                  <td className="py-1.5 text-muted">{signal.key}</td>
                  <td className="num">{signal.value}</td>
                  <td className="text-right">
                    {signal.shared && (
                      <Pill tone="verification" icon={<AlertTriangle size={10} />}>
                        {signal.shared} usam este sinal
                      </Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="rule-label mt-4">Evidência simulada</h3>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            <select
              aria-label="Tipo de evidência"
              disabled={isDone}
              value={selected.evidence}
              onChange={(event) => patch(selected.id, { evidence: event.target.value })}
              className={inputCls()}
            >
              {Object.entries(EVIDENCE_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="Observação"
              disabled={isDone}
              placeholder="Observação"
              value={selected.note}
              onChange={(event) => patch(selected.id, { note: event.target.value })}
              className={inputCls()}
            />
          </div>

          <h3 className="rule-label mt-4">Checklist de revisão</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px]">
            {['Primeira compra', 'Valor > R$ 30,00', 'Orçamento disponível', 'Relação legítima', 'Sem reincidência'].map((item) => (
              <label key={item} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  className="accent-[#cc4419]"
                  disabled={isDone}
                  checked={!!checklist[selected.id + item]}
                  onChange={(event) => setChecklist({ ...checklist, [selected.id + item]: event.target.checked })}
                />
                {item}
              </label>
            ))}
          </div>

          {selected.outcome && (
            <div className="mt-4">
              <Banner kind={selected.outcome.includes('accepted') ? 'success' : 'warn'} title="Resultado da reversão">
                {selected.outcome}
              </Banner>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Btn variant="danger" disabled={isDone} onClick={() => resolve(selected, 'maintained')}>
              Manter
            </Btn>
            <Btn disabled={isDone} onClick={() => resolve(selected, 'reverted')}>
              Reverter
            </Btn>
            <Btn disabled={isDone} onClick={() => resolve(selected, 'inconclusive')}>
              Inconclusiva
            </Btn>
            <Btn
              variant="primary"
              className="ml-auto"
              disabled={isDone}
              onClick={() => {
                patch(selected.id, {
                  status: 'under_review',
                  history:
                    selected.status === 'under_review'
                      ? selected.history
                      : [...selected.history, { at: now, text: 'Em análise · evidência salva' }],
                })
                toast('Evidência salva; contestação em análise')
              }}
            >
              Salvar e resolver
            </Btn>
          </div>
          <p className="mt-2 text-[10.5px] text-muted">
            Reverter não concede o cupom automaticamente; o checkout reavalia primeira compra, valor e orçamento.
          </p>
        </Panel>
      </div>

      <Panel
        title="Histórico da revisão"
        right={
          <span className="num text-[10.5px] text-muted">
            custo {view === 'eval' ? brl(selected.cost) : '—'} · tempo {isDone ? '6,5 h' : 'em curso'}
          </span>
        }
      >
        <ol className="space-y-2 border-l-2 border-line pl-4">
          {selected.history.map((entry, index) => (
            <li key={index} className="relative text-[12px]">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-engine" />
              <span className="num text-[10.5px] text-muted">{entry.at}</span> · <span className="text-muted">review</span> ·{' '}
              {entry.text}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[10.5px] text-muted">
          Decisão revertida gera nova avaliação no checkout, não resgate automático.
        </p>
      </Panel>

      {modal && (
        <SimulationModal
          onClose={() => setModal(false)}
          onCreate={(created) => {
            setContests([created, ...contests])
            setSelectedId(created.id)
            setModal(false)
            toast(`Contestação ${created.id} aberta`)
          }}
        />
      )}
    </div>
  )
}

function SimulationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (contest: Contest) => void }) {
  const { contests, run, source } = useApp()
  const [roundNumber, setRoundNumber] = useState(Math.min(3, run.done))
  const [attemptId, setAttemptId] = useState('')
  const [evidence, setEvidence] = useState('address_proof')
  const [note, setNote] = useState('')

  const refused = useMemo(
    () => source.attemptsOf(source.rounds[roundNumber - 1]).filter((attempt) => attempt.result !== 'accepted').slice(0, 20),
    [source, roundNumber],
  )
  const attempt = refused.find((item) => item.id === attemptId) ?? refused[0]
  const { date, time } = stamp()

  return (
    <Modal title="Simular contestação" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-[12px] font-medium">
          Rodada
          <select
            className={cx(inputCls(), 'mt-1')}
            value={roundNumber}
            onChange={(event) => {
              setRoundNumber(Number(event.target.value))
              setAttemptId('')
            }}
          >
            {source.rounds
              .slice(0, run.done)
              .filter((round) => round.refused + round.verifications + round.limited > 0)
              .map((round) => (
                <option key={round.r}>{round.r}</option>
              ))}
          </select>
        </label>

        <label className="block text-[12px] font-medium">
          Recusa elegível
          <select className={cx(inputCls(), 'mt-1')} value={attempt?.id} onChange={(event) => setAttemptId(event.target.value)}>
            {refused.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id} · {item.account} · {item.reason}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] font-medium">
          Evidência
          <select className={cx(inputCls(), 'mt-1')} value={evidence} onChange={(event) => setEvidence(event.target.value)}>
            {Object.entries(EVIDENCE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-[12px] font-medium">
          Observação
          <input className={cx(inputCls(), 'mt-1')} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn
            variant="primary"
            disabled={!attempt}
            onClick={() =>
              attempt &&
              onCreate({
                id: `con_${String(13 + contests.length).padStart(5, '0')}`,
                attempt: attempt.id,
                account: attempt.account,
                round: roundNumber,
                date,
                evidence,
                status: 'open',
                message: attempt.message || GENERIC_MESSAGE,
                reason: attempt.reason,
                rules: [attempt.reason],
                score: attempt.score,
                policy: source.rounds[roundNumber - 1].policy,
                decidedAt: `${source.rounds[roundNumber - 1].dates.split('–')[0]} ${attempt.time}`,
                note,
                slaHours: 24,
                cost: 0,
                signals: [
                  { key: 'dispositivo', value: attempt.device, shared: attempt.shared ? `${attempt.shared} contas` : undefined },
                  { key: 'endereço', value: attempt.address },
                  { key: 'telefone', value: attempt.phone },
                ],
                history: [{ at: `${date} ${time}`, text: 'Contestação aberta (contestation_opened)' }],
              })
            }
          >
            Abrir contestação
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
