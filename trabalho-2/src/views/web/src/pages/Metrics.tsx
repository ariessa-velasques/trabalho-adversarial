import { useState } from 'react'
import { BarChart3, Check, Download } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { brl, dec, int, pct } from '../data/format'
import { costPerApproved, eventForView, isVisibleInView, netBot } from '../data/derive'
import { Banner, Btn, Empty, PageHeader, Panel, Stat, StatStrip, cx } from '../components/ui'
import { Chart } from '../components/charts'
import { download } from '../lib/download'

const COLORS = {
  accepted: '#17703f',
  refused: '#a6291f',
  verification: '#8a5a08',
  limited: '#3a3fa0',
  bot: '#5746c8',
  engine: '#0a6b63',
  neutral: '#46524b',
}

const COMPARISON = [
  { name: 'B1 fixa', redemptions: 1150, fraud: 1040, conversion: 0.96, fp: 0.005, fn: 1040, defense: 0, cpa: 0, alerts: 3 },
  { name: 'B2 fixa', redemptions: 780, fraud: 560, conversion: 0.58, fp: 0.09, fn: 560, defense: 3100, cpa: 9.4, alerts: 1 },
  { name: 'Redesenho', redemptions: 557, fraud: 480, conversion: 0.78, fp: 0.018, fn: 480, defense: 4860, cpa: 11.87, alerts: 0 },
]

export default function Metrics() {
  const { run, view, cfg, goTab, toast, source, contests } = useApp()
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(6)
  const [showFormulas, setShowFormulas] = useState(false)

  if (run.done === 0) {
    return (
      <Empty
        icon={<BarChart3 />}
        title="Sem métricas ainda"
        text="Execute uma simulação para ver resgates, custos e comparação de defesas."
        cta={
          <Btn variant="primary" onClick={() => goTab(run.status === 'idle' ? 0 : 1)}>
            {run.status === 'idle' ? 'Abrir configuração' : 'Acompanhar execução'}
          </Btn>
        }
      />
    )
  }

  const hi = Math.min(to, run.done)
  const lo = Math.min(from, hi)
  const rounds = source.rounds.slice(lo - 1, hi)
  const previous = lo > 1 ? source.rounds[lo - 2] : null
  const last = rounds[rounds.length - 1]
  const sum = (pick: (round: (typeof rounds)[number]) => number) => rounds.reduce((acc, round) => acc + pick(round), 0)

  const T = {
    redemptions: sum((round) => round.redemptions),
    budget: sum((round) => round.budget),
    cost: sum((round) => round.botCost),
    accepted: sum((round) => round.accepted),
    attempts: sum((round) => round.attempts),
    fraud: sum((round) => round.fraudRedemptions),
    fp: sum((round) => round.falsePositives),
  }
  const net = T.redemptions * 20 - T.cost
  const roi = T.cost ? net / T.cost : 0
  const labels = rounds.map((round) => String(round.r))
  const isBot = view === 'bot'
  const isEngine = view === 'engine'
  const legit = Math.max(1, rounds.length * cfg.legit)
  const smallSample = rounds.some((round) => round.attempts < 10)
  const rangeContests = contests.filter((contest) => contest.round >= lo && contest.round <= hi)
  const resolved = rangeContests.filter((contest) => contest.status === 'reverted' || contest.status === 'maintained').length
  const reverted = rangeContests.filter((contest) => contest.status === 'reverted').length
  const budgetAlert = T.budget / cfg.acqBudget >= 0.2
  const probingDetected = rounds.reduce((acc, round) => acc + (round.r === 3 ? 12 : round.r === 4 ? 18 : 0), 0)

  const deltaPct = (a: number, b: number) => ({
    value: `${a - b >= 0 ? '+' : '−'}${dec(Math.abs(a - b) * 100, 1)} p.p.`,
    good: null as boolean | null,
  })

  const hidden = (label: string) => <Stat key={label} label={label} value="—" sub="oculto na visão" />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Métricas"
        description="Como as decisões de um lado mudaram o comportamento do outro, e a que custo."
        meta={
          <>
            <span className="num">{run.id.slice(0, 24)}…</span>
            <span>{run.total} rodadas no total</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
            <label className="flex items-center gap-1.5">
              De
              <select
                aria-label="Rodada inicial"
                value={lo}
                onChange={(event) => {
                  setFrom(Number(event.target.value))
                  if (Number(event.target.value) > to) setTo(Number(event.target.value))
                }}
                className="h-7 rounded-md border border-line bg-surface px-2"
              >
                {source.rounds.slice(0, run.done).map((round) => (
                  <option key={round.r}>{round.r}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              até
              <select
                aria-label="Rodada final"
                value={hi}
                onChange={(event) => setTo(Number(event.target.value))}
                className="h-7 rounded-md border border-line bg-surface px-2"
              >
                {source.rounds.slice(lo - 1, run.done).map((round) => (
                  <option key={round.r}>{round.r}</option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      {run.status !== 'done' && (
        <Banner kind="info" title={`Execução parcial: ${run.done} de ${run.total} rodadas`}>
          Os números cobrem apenas as rodadas concluídas.
        </Banner>
      )}
      {smallSample && (
        <Banner kind="warn">
          Poucas tentativas nesta rodada. Valores de custo por aprovação podem oscilar; compare defesas com a mesma seed.
        </Banner>
      )}

      <StatStrip cols={6}>
        <Stat
          label="Resgates totais"
          value={int(T.redemptions)}
          sub={`${int(T.attempts)} tentativas`}
          hint="Pedidos concluídos com desconto aplicado."
        />
        {isBot ? (
          hidden('Orçamento consumido')
        ) : (
          <Stat
            label="Orçamento consumido"
            value={brl(T.budget)}
            sub={`${pct(T.budget / cfg.acqBudget, 1)} de ${brl(cfg.acqBudget)}`}
            hint="budget_debited = 20 × resgates"
          />
        )}
        {view !== 'eval' ? (
          hidden('Perda líquida (fraude)')
        ) : (
          <Stat
            label="Perda líquida (fraude)"
            value={brl(T.fraud * 14)}
            sub={`${int(T.fraud)} resgates de fraude`}
            hint="net_loss = orçamento debitado − comissão, por coorte fraudulenta"
          />
        )}
        {isEngine ? (
          hidden('Custo do bot')
        ) : (
          <Stat
            label="Custo do bot"
            value={brl(T.cost)}
            sub={`ROI ${dec(roi)}`}
            hint="spend = Σ custo da tática por tentativa. Conta do atacante: nunca somada à perda da plataforma."
            tone="text-bot"
          />
        )}
        {isEngine ? (
          hidden('Custo por aceita')
        ) : (
          <Stat
            label="Custo por aceita"
            value={brl(T.accepted ? T.cost / T.accepted : 0, 2)}
            sub="referência R$ 20,00"
            hint="cost_per_approved = spend / aprovações"
            tone={T.accepted && T.cost / T.accepted > 20 ? 'text-refused' : undefined}
          />
        )}
        {isEngine ? (
          hidden('ROI do bot')
        ) : (
          <Stat
            label="ROI do bot"
            value={T.cost ? dec(roi) : 'n/d'}
            sub={`net ${net >= 0 ? '+' : '−'}${brl(Math.abs(net))}`}
            hint="roi = net_bot acumulado / Σ gasto. Indefinido se gasto = 0."
          />
        )}
      </StatStrip>

      <StatStrip cols={6}>
        <Stat
          label="Taxa de aceitação"
          value={pct(T.accepted / T.attempts, 1)}
          hint="aprovações / tentativas"
          delta={previous ? deltaPct(T.accepted / T.attempts, previous.accepted / previous.attempts) : undefined}
        />
        {isBot ? (
          hidden('Conversão legítima')
        ) : (
          <Stat
            label="Conversão legítima"
            value={pct(last.conversion)}
            hint="conversion = cadastros concluídos / iniciados"
            delta={previous ? deltaPct(last.conversion, previous.conversion) : undefined}
          />
        )}
        {view !== 'eval' ? (
          hidden('Falsos positivos')
        ) : (
          <Stat
            label="Falsos positivos"
            value={pct(T.fp / legit, 1)}
            sub={`${T.fp} recusas legítimas`}
            hint="legit_refused / legit_attempts"
          />
        )}
        {view !== 'eval' ? (
          hidden('Falsos negativos')
        ) : (
          <Stat label="Falsos negativos" value={int(T.fraud)} sub="fraude aceita" hint="fraud_accepted" />
        )}
        {isBot ? (
          hidden('Contestações')
        ) : (
          <Stat
            label="Contestações"
            value={int(rangeContests.length)}
            sub={`${rangeContests.filter((contest) => contest.status === 'open' || contest.status === 'under_review').length} em aberto · reversão ${resolved ? pct(reverted / resolved) : 'n/d'}`}
            hint="reversal_rate = revertidas / resolvidas"
          />
        )}
        {isBot ? (
          hidden('Alertas de orçamento')
        ) : (
          <Stat
            label="Alertas de orçamento"
            value={budgetAlert ? '1' : '0'}
            sub={budgetAlert ? 'limiar de 20% atingido' : 'limiar de 20% não atingido'}
            hint="budget_consumption_alert = 20%"
            tone={budgetAlert ? 'text-verification' : undefined}
          />
        )}
      </StatStrip>

      <div className="grid gap-5 xl:grid-cols-2">
        <Chart
          title={isBot ? 'Resgates por rodada' : 'Resgates e orçamento por rodada'}
          sub={isBot ? 'Orçamento debitado oculto na visão do bot.' : 'Barras: resgates · linha: orçamento debitado'}
          labels={labels}
          unit="resgates"
          unit2="R$"
          dualAxis
          bars={[{ name: 'Resgates', color: COLORS.engine, values: rounds.map((round) => round.redemptions) }]}
          lines={
            isBot
              ? []
              : [
                  {
                    name: 'Orçamento debitado (R$)',
                    color: COLORS.verification,
                    values: rounds.map((round) => round.budget),
                  },
                ]
          }
          format={int}
          format2={(n) => brl(n)}
          description={`Resgates por rodada de ${lo} a ${hi}; a rodada 1 tem o pico de ${source.rounds[0].redemptions}.`}
        />

        <Chart
          title={isEngine ? 'Aceitação por rodada' : 'Aceitação × custo por aprovada'}
          sub={
            isEngine
              ? 'Custo do bot oculto na visão do motor.'
              : 'Barras: aceitação · linha tracejada: custo por aprovada, marco R$ 20'
          }
          labels={labels}
          unit="%"
          unit2="R$"
          dualAxis
          bars={[
            {
              name: 'Aceitação (%)',
              color: COLORS.accepted,
              values: rounds.map((round) => Math.round((round.accepted / round.attempts) * 100)),
            },
          ]}
          lines={
            isEngine
              ? []
              : [
                  {
                    name: 'Custo por aprovada (R$)',
                    color: COLORS.refused,
                    dashed: true,
                    values: rounds.map((round) => Number(costPerApproved(round).toFixed(2))),
                  },
                ]
          }
          reference={isEngine ? undefined : { value: 20, label: 'R$ 20 · valor do desconto' }}
          format={(n) => dec(n, 0)}
          format2={(n) => brl(n)}
          description="Aceitação cai de 100% para 35% enquanto o custo por aprovada ultrapassa R$ 20 na rodada 4."
        />

        <Chart
          title="Resultado das tentativas"
          sub="Aceito, recusado, verificação e limite por rodada"
          labels={labels}
          stacked
          unit="tentativas"
          format={int}
          bars={[
            { name: 'Aceito', color: COLORS.accepted, values: rounds.map((round) => round.accepted) },
            { name: 'Recusado', color: COLORS.refused, values: rounds.map((round) => round.refused) },
            { name: 'Verificação', color: COLORS.verification, values: rounds.map((round) => round.verifications) },
            { name: 'Limite', color: COLORS.limited, values: rounds.map((round) => round.limited) },
          ]}
          description="Tentativas por resultado em cada rodada; recusas dominam na rodada 4."
        />

        {isBot ? (
          <Panel title="Conversão legítima × falsos positivos" sub="Custo da defesa para o cliente real">
            <p className="py-10 text-center text-[12px] text-muted">Indicadores de conversão e rótulos ficam ocultos na visão do bot.</p>
          </Panel>
        ) : (
          <Chart
            title="Conversão legítima × falsos positivos"
            sub="Custo da defesa para o cliente real"
            labels={labels}
            unit="%"
            format={(n) => dec(n, 0)}
            lines={[
              {
                name: 'Conversão legítima (%)',
                color: COLORS.engine,
                values: rounds.map((round) => Math.round(round.conversion * 100)),
              },
              ...(view === 'eval'
                ? [
                    {
                      name: 'Falsos positivos (%)',
                      color: COLORS.refused,
                      dashed: true,
                      values: rounds.map((round) => Number(((round.falsePositives / cfg.legit) * 100).toFixed(1))),
                    },
                  ]
                : []),
            ]}
            description="A conversão legítima cai a 55% com B2 e se recupera a 78% com a defesa calibrada."
          />
        )}
      </div>

      <Panel title="Custo do bot × perda da plataforma" sub="Dois atores, duas contas, eixos separados. Nunca somar (ADR-012).">
        <div className="grid gap-5 xl:grid-cols-2">
          {isEngine ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-[12px] text-muted">
              Custo do bot oculto na visão do motor.
            </p>
          ) : (
            <Chart
              title="Custo do bot (R$)"
              labels={labels}
              unit="R$"
              format={(n) => brl(n)}
              bars={[{ name: 'Custo do bot', color: COLORS.bot, values: rounds.map((round) => round.botCost) }]}
              description="Custo da tática do bot por rodada."
            />
          )}
          {view !== 'eval' ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-[12px] text-muted">
              A perda atribuída à fraude exige rótulos; disponível só na visão de avaliação.
            </p>
          ) : (
            <Chart
              title="Perda líquida da plataforma (R$)"
              labels={labels}
              unit="R$"
              format={(n) => brl(n)}
              bars={[
                { name: 'Perda (fraude × R$ 14)', color: COLORS.refused, values: rounds.map((round) => round.fraudRedemptions * 14) },
              ]}
              description="Perda líquida da plataforma atribuída à fraude por rodada."
            />
          )}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Funil: cadastro → verificação → pedido → resgate" sub="Onde o atrito derruba a conversão">
          {isBot ? (
            <p className="py-10 text-center text-[12px] text-muted">O funil agregado da plataforma fica oculto na visão do bot.</p>
          ) : (
            (
              [
                ['Cadastros iniciados', 1.0],
                ['Verificação concluída', 0.76],
                ['Pedido iniciado', 0.52],
                ['Resgate', 0.46],
              ] as const
            ).map(([label, factor], index) => {
              const base = Math.round(T.attempts * 1.25)
              const value = Math.round(base * factor)
              return (
                <div key={label} className="mb-2.5">
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span>{label}</span>
                    <span className="num text-muted">
                      {int(value)} · {pct(factor)}
                    </span>
                  </div>
                  <div className="h-4 rounded-sm bg-[#eceee9]">
                    <div
                      className={cx('h-full rounded-sm', index === 3 ? 'bg-accepted' : 'bg-engine')}
                      style={{ width: `${factor * 100}%`, opacity: 1 - index * 0.12 }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </Panel>

        <Panel title="Reuso de sinais" sub="Parcela de contas que compartilham o sinal, por rodada">
          {isBot ? (
            <p className="py-10 text-center text-[12px] text-muted">Sinais de relação ficam ocultos na visão do bot.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[10.5px] text-muted">
                    <th className="py-1 font-medium">Rodada</th>
                    {['Dispositivo', 'CPF', 'Telefone', 'Endereço'].map((signal) => (
                      <th key={signal} className="font-medium">
                        {signal}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => {
                    const values = [
                      round.r === 1 ? 0.05 : round.r < 5 ? 0.25 + round.r * 0.06 : 0.12,
                      round.r === 2 ? 0.34 : round.r < 5 ? 0.18 : 0.04,
                      round.r === 2 ? 0.3 : round.r < 5 ? 0.2 : 0.05,
                      round.r < 5 ? 0.28 : 0.14,
                    ]
                    return (
                      <tr key={round.r} className="border-t border-line">
                        <td className="num py-1">{round.r}</td>
                        {values.map((value, i) => (
                          <td key={i} className="p-0.5">
                            <div
                              className="num rounded-sm py-1.5 text-center font-medium"
                              style={{
                                background: `rgba(10,107,99,${0.08 + value * 1.5})`,
                                color: value > 0.3 ? '#fff' : '#161a18',
                              }}
                            >
                              {pct(value)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {!isBot && (
        <Panel title="Painel AM3">
          <div className="grid grid-cols-2 gap-4 text-[12px] sm:grid-cols-3 xl:grid-cols-6">
            {[
              ['Sondagens detectadas', String(probingDetected)],
              ['Limites acionados', String(sum((round) => round.limited))],
              ['Mensagem genérica', cfg.generic ? 'ligada' : 'desligada'],
              ['Contestações', String(rangeContests.length)],
              ['Reversões', String(reverted)],
              ['Tempo médio', '18 h'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10.5px] text-muted">{label}</p>
                <p className="num text-[18px] font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {view === 'eval' && (
        <Panel
          title="Comparação de defesas"
          sub="Valores de referência, ilustrativos. Cada melhor célula é por métrica, não uma “melhor geral”."
        >
          {cfg.preset !== 'compare' && (
            <div className="mb-3">
              <Banner kind="info">
                Execute a mesma seed nas três defesas (preset Comparar defesas) para comparar com dados da sua execução.
              </Banner>
            </div>
          )}
          <CompareTable />
        </Panel>
      )}

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Btn
            icon={<Download size={13} />}
            onClick={() => {
              const columns = [
                'round',
                'attempts',
                'accepted',
                'refused',
                'verifications',
                'limited',
                'redemptions',
                ...(isBot ? ['bot_cost', 'net_bot'] : isEngine ? ['budget_debited'] : ['budget_debited', 'bot_cost', 'net_bot']),
              ]
              const values = (round: (typeof rounds)[number]) => [
                round.r,
                round.attempts,
                round.accepted,
                round.refused,
                round.verifications,
                round.limited,
                round.redemptions,
                ...(isBot
                  ? [round.botCost, netBot(round)]
                  : isEngine
                    ? [round.budget]
                    : [round.budget, round.botCost, netBot(round)]),
              ]
              download(
                'metrics.csv',
                [columns.join(',')].concat(rounds.map((round) => values(round).join(','))).join('\n'),
                'text/csv',
              )
              toast('metrics.csv baixado')
            }}
          >
            Exportar métricas
          </Btn>
          <Btn
            icon={<Download size={13} />}
            onClick={() => {
              const columns = ['round', 'redemptions', ...(isBot ? [] : ['budget_debited'])]
              const rows = rounds.map((round) => [
                round.r,
                round.redemptions,
                ...(isBot ? [] : [round.budget]),
              ])
              download(
                'redemptions.csv',
                [columns.join(',')].concat(rows.map((row) => row.join(','))).join('\n'),
                'text/csv',
              )
              toast('redemptions.csv baixado')
            }}
          >
            Exportar resgates
          </Btn>
          <Btn
            icon={<Download size={13} />}
            onClick={() => {
              const columns = [
                'round',
                'attempt',
                'account',
                'result',
                'order',
                ...(isEngine ? [] : ['cost']),
                ...(isBot ? [] : ['reason']),
                ...(view === 'eval' ? ['label'] : []),
                'time',
              ]
              const rows = rounds.flatMap((round) =>
                source.attemptsOf(round).map((attempt) => [
                  round.r,
                  attempt.id,
                  attempt.account,
                  attempt.result,
                  attempt.order.toFixed(2),
                  ...(isEngine ? [] : [attempt.cost.toFixed(2)]),
                  ...(isBot ? [] : [attempt.reason]),
                  ...(view === 'eval' ? [attempt.label] : []),
                  attempt.time,
                ]),
              )
              download(
                'attempts.csv',
                [columns.join(',')].concat(rows.map((row) => row.join(','))).join('\n'),
                'text/csv',
              )
              toast('attempts.csv baixado')
            }}
          >
            Exportar tentativas
          </Btn>
          <Btn
            icon={<Download size={13} />}
            onClick={() => {
              const events = rounds.flatMap((round) =>
                source
                  .eventsOf(round)
                  .filter((event) => isVisibleInView(event, view))
                  .map((event) => eventForView(event, view)),
              )
              download('events.jsonl', events.map((event) => JSON.stringify(event)).join('\n'), 'application/jsonl')
              toast('events.jsonl baixado')
            }}
          >
            JSONL
          </Btn>
          <button
            type="button"
            className="ml-auto text-[12px] font-medium text-limited underline decoration-limited/40 underline-offset-2 hover:decoration-limited"
            aria-expanded={showFormulas}
            onClick={() => setShowFormulas(!showFormulas)}
          >
            Fórmulas e definições {showFormulas ? '▾' : '▸'}
          </button>
        </div>
        {showFormulas && (
          <pre className="num scroll-thin mt-3 overflow-auto rounded-md bg-paper p-3 text-[11px] leading-5">{`spend(r)              = Σ custo da tática por tentativa
net_bot(r)            = 20 × resgates(r) − spend(r)
cost_per_approved(r)  = spend(r) / aprovações(r)
roi                   = net_bot acumulado / Σ spend
budget_debited        = 20 × resgates
net_loss              = budget_debited − comissão
false_positive_rate   = legit_refused / legit_attempts
false_negative_rate   = fraud_accepted / fraud_attempts
reversal_rate         = revertidas / contestações resolvidas`}</pre>
        )}
      </Panel>
    </div>
  )
}

function CompareTable() {
  const columns: {
    key: keyof (typeof COMPARISON)[number]
    label: string
    format: (n: number) => string
    lowIsBetter: boolean
  }[] = [
    { key: 'redemptions', label: 'Resgates', format: int, lowIsBetter: true },
    { key: 'fraud', label: 'Resgates de fraude', format: int, lowIsBetter: true },
    { key: 'conversion', label: 'Conversão legítima', format: (n) => pct(n), lowIsBetter: false },
    { key: 'fp', label: 'Falsos positivos', format: (n) => pct(n, 1), lowIsBetter: true },
    { key: 'fn', label: 'Falsos negativos', format: int, lowIsBetter: true },
    { key: 'defense', label: 'Custo da defesa', format: (n) => brl(n), lowIsBetter: true },
    { key: 'cpa', label: 'Custo por aprovação', format: (n) => brl(n, 2), lowIsBetter: false },
    { key: 'alerts', label: 'Alertas', format: int, lowIsBetter: true },
  ]
  const reference = COMPARISON[2]

  return (
    <div className="overflow-auto">
      <table className="w-full text-[11.5px]">
        <thead>
          <tr className="h-9 text-left text-[10.5px] text-muted">
            <th className="font-medium">Configuração</th>
            {columns.map((column) => (
              <th key={column.key} className="px-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.name} className="h-11 border-t border-line">
              <td className="font-medium">{row.name}</td>
              {columns.map((column) => {
                const value = row[column.key] as number
                const best =
                  column.key === 'cpa'
                    ? false
                    : COMPARISON.every((other) =>
                        column.lowIsBetter ? value <= (other[column.key] as number) : value >= (other[column.key] as number),
                      )
                const difference = value - (reference[column.key] as number)
                return (
                  <td key={column.key} className={cx('px-2', best && 'bg-accepted-soft')}>
                    <span className="num flex items-center gap-1 font-medium">
                      {best && <Check size={11} className="text-accepted" aria-label="melhor nesta métrica" />}
                      {column.format(value)}
                    </span>
                    {row !== reference && (
                      <span className="num text-[10px] text-muted">
                        Δ {difference >= 0 ? '+' : '−'}
                        {column.format(Math.abs(difference))}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
