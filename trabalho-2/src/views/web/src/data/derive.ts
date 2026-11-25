import { GENERIC_MESSAGE, POLICIES, RESULT_LABEL } from './demo'
import type { Alert, Attempt, AttemptResult, Ev, Round, Severity } from './types'

export const netBot = (round: Round) => 20 * round.redemptions - round.botCost
export const costPerApproved = (round: Round) => (round.accepted ? round.botCost / round.accepted : 0)

export interface Totals {
  attempts: number
  accepted: number
  refused: number
  verifications: number
  limited: number
  redemptions: number
  budget: number
  botCost: number
  fraudRedemptions: number
  falsePositives: number
  net: number
  roi: number
  cpa: number
  loss: number
}

export const totals = (rounds: Round[], count = rounds.length): Totals => {
  const selected = rounds.slice(0, count)
  const sum = (pick: (round: Round) => number) => selected.reduce((acc, round) => acc + pick(round), 0)
  const aggregate = {
    attempts: sum((r) => r.attempts),
    accepted: sum((r) => r.accepted),
    refused: sum((r) => r.refused),
    verifications: sum((r) => r.verifications),
    limited: sum((r) => r.limited),
    redemptions: sum((r) => r.redemptions),
    budget: sum((r) => r.budget),
    botCost: sum((r) => r.botCost),
    fraudRedemptions: sum((r) => r.fraudRedemptions),
    falsePositives: sum((r) => r.falsePositives),
  }
  const net = aggregate.redemptions * 20 - aggregate.botCost
  return {
    ...aggregate,
    net,
    roi: aggregate.botCost ? net / aggregate.botCost : 0,
    cpa: aggregate.accepted ? aggregate.botCost / aggregate.accepted : 0,
    loss: aggregate.fraudRedemptions * 14,
  }
}

/** Gerador pseudoaleatório determinístico: mesma seed, mesma execução. */
const lcg = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const REASONS: Record<AttemptResult, string[]> = {
  coupon_already_used: [
    'shared_device',
    'shared_cpf',
    'shared_phone',
    'shared_address',
    'virtual_phone_range',
    'probing_sequence',
  ],
  verification_required: ['shared_device', 'virtual_phone_range', 'manual_review'],
  rate_limited: ['attempt_limit_exceeded'],
  accepted: ['eligible'],
}

export const attemptsOf = (round: Round, seed = 42): Attempt[] => {
  const random = lcg(seed + round.r * 977)
  const kinds: AttemptResult[] = [
    ...Array<AttemptResult>(round.accepted).fill('accepted'),
    ...Array<AttemptResult>(round.refused).fill('coupon_already_used'),
    ...Array<AttemptResult>(round.verifications).fill('verification_required'),
    ...Array<AttemptResult>(round.limited).fill('rate_limited'),
  ]
  while (kinds.length < round.attempts) kinds.push('accepted')
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[kinds[i], kinds[j]] = [kinds[j], kinds[i]]
  }

  const costPerAttempt = round.attempts ? round.botCost / round.attempts : 0

  return kinds.map((result, i) => {
    const n = round.r * 1000 + i
    const fraud = round.attack !== 'A1' && random() > 0.1
    const reason = REASONS[result][Math.floor(random() * REASONS[result].length)]
    const shared = reason.startsWith('shared') ? 2 + Math.floor(random() * 3) : 0
    const minutes = String(Math.floor(random() * 59)).padStart(2, '0')
    const detailed = round.r < 3
    const message =
      result === 'accepted'
        ? 'Cupom aplicado.'
        : detailed
          ? reason === 'shared_cpf'
            ? 'Este CPF já foi usado em outra conta.'
            : 'Este dispositivo já resgatou o cupom.'
          : GENERIC_MESSAGE

    return {
      id: `att_${String(n).padStart(5, '0')}`,
      account: `acc_${String(n % 100000).padStart(5, '0')}`,
      email: `ana.s+${i % 40}@…`,
      phone: `…${String(n % 10000).padStart(4, '0')}`,
      cpf: `***.***.***-${String(n % 100).padStart(2, '0')}`,
      device: `dev_${Math.floor(random() * 0xffff).toString(16).padStart(4, '0')}`,
      address: `addr_${100 + Math.floor(random() * 90)}`,
      result,
      message,
      reason,
      order: 30.01 + Math.floor(random() * 3000) / 100,
      cost: costPerAttempt,
      time: `${String(8 + Math.floor(random() * 12)).padStart(2, '0')}:${minutes}`,
      verification:
        result === 'verification_required' ? (round.defense === 'B1' ? 'email' : 'sms') : 'none',
      tactic: round.tactic,
      label: fraud ? 'fraude' : 'legítima',
      person: `per_${String(100 + Math.floor(random() * 400)).padStart(5, '0')}`,
      shared,
      score: Math.round(random() * 100) / 100,
    }
  })
}

export const eventsOf = (round: Round, seed = 42): Ev[] => {
  const attempts = attemptsOf(round, seed)
  const events: Ev[] = []
  let seq = (round.r - 1) * 1000
  const push = (event: Omit<Ev, 'seq'>) => {
    seq += 1
    events.push({ ...event, seq })
  }

  push({
    time: '00:00:00',
    type: 'round_started',
    actor: 'system',
    account: '—',
    result: '—',
    reason: '—',
    policy: round.policy,
    visibility: 'public',
    payload: { round: round.r, window: round.dates },
  })

  attempts.forEach((attempt, i) => {
    const time = `${attempt.time}:${String(i % 60).padStart(2, '0')}`
    push({
      time,
      type: 'coupon_decided',
      actor: 'engine',
      account: attempt.account,
      result: attempt.result,
      reason: attempt.reason,
      policy: round.policy,
      visibility: 'operational',
      payload: { rules_fired: [attempt.reason], score: attempt.score },
    })
    if (attempt.result === 'accepted') {
      push({
        time,
        type: 'redemption_completed',
        actor: 'checkout',
        account: attempt.account,
        result: 'accepted',
        reason: '—',
        policy: round.policy,
        visibility: 'public',
        payload: { discount: 20, order_value: Number(attempt.order.toFixed(2)) },
      })
    }
    if (attempt.reason === 'probing_sequence') {
      push({
        time,
        type: 'probing_detected',
        actor: 'engine',
        account: attempt.account,
        result: attempt.result,
        reason: attempt.reason,
        policy: round.policy,
        visibility: 'operational',
        payload: { attempts: 3, changed_field: 'device_id' },
      })
    }
    if (attempt.result === 'rate_limited') {
      push({
        time,
        type: 'limit_triggered',
        actor: 'engine',
        account: attempt.account,
        result: attempt.result,
        reason: attempt.reason,
        policy: round.policy,
        visibility: 'operational',
        payload: { scope: 'device', window_hours: 24 },
      })
    }
    if (attempt.cost > 0 && i % 10 === 0) {
      push({
        time,
        type: 'bot_cost_recorded',
        actor: 'bot',
        account: attempt.account,
        result: '—',
        reason: '—',
        policy: round.policy,
        visibility: 'evaluation',
        payload: { cost: Number(attempt.cost.toFixed(2)) },
      })
    }
  })

  push({
    time: '23:59:59',
    type: 'round_completed',
    actor: 'system',
    account: '—',
    result: '—',
    reason: '—',
    policy: round.policy,
    visibility: 'public',
    payload: { redemptions: round.redemptions },
  })

  return events
}

/** Eventos que cada visão pode enxergar (ADR-006, separação de informação). */
export const isVisibleInView = (event: Ev, view: string) => {
  if (view === 'bot') return event.visibility === 'public' || event.type === 'coupon_decided'
  if (view === 'engine') return event.type !== 'bot_cost_recorded' && event.type !== 'bot_strategy_changed'
  return true
}

/** Remove do evento o que a visão do bot não pode exportar nem manter em memória. */
export const eventForView = (event: Ev, view: string): Ev =>
  view === 'bot'
    ? { ...event, reason: '—', policy: '—', payload: {}, visibility: 'public' }
    : event

const money = (n: number) =>
  n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

export const alertsOf = (round: Round, allRounds: Round[]): Alert[] => {
  const out: Alert[] = []
  const add = (
    severity: Severity,
    tag: string,
    actor: Alert['actor'],
    visibility: Alert['visibility'],
    text: string,
  ) => out.push({ round: round.r, severity, tag, actor, visibility, text })

  add(
    'info',
    'round_started',
    'sistema',
    'all',
    `Rodada ${round.r} iniciada · janela ${round.dates} · política ${round.policy} (${round.defense})`,
  )

  if (round.r === 1) {
    add(
      'alert',
      'AM1 · P1 falhou',
      'avaliador',
      'eval',
      'E-mail novo deixou de significar pessoa nova: 200 contas com e-mails descartáveis e variações nome+N a custo R$ 0.',
    )
    add(
      'warn',
      'signup_volume_high',
      'motor',
      'engine',
      'Pico de cadastros: 200 contas, 2,0× o volume base, concentradas em poucos domínios e sem segunda compra.',
    )
  }
  if (round.r === 2) {
    add(
      'alert',
      'AM2 · P2 falhou',
      'avaliador',
      'eval',
      'SMS virtual, CPF vazado e emulador contornam a verificação rígida: c ≈ R$ 5 contra R$ 20 de desconto. Dados de terceiros envolvidos.',
    )
    add(
      'warn',
      'relation_detected',
      'motor',
      'engine',
      'Mesmo CPF em vários aparelhos e faixas de telefone virtual detectados em 80 recusas.',
    )
    add(
      'warn',
      'conversion_drop',
      'motor',
      'engine',
      'Conclusão de cadastro caiu de 70% para 55% por causa de SMS + CPF em todos os cadastros (atrito sobre o cliente legítimo).',
    )
    add(
      'alert',
      'detailed_refusal_seen',
      'bot',
      'bot',
      'As recusas explicam o sinal (“Este CPF já foi usado”): a mensagem virou oráculo (PE3). Sondagem de um sinal por vez fica possível.',
    )
  }
  if (round.r >= 3) {
    add(
      'alert',
      round.r === 3 ? 'AM3 · risco 9 · sondagem' : 'AM3 · rotação de sinais',
      'avaliador',
      'eval',
      round.r === 3
        ? 'Bot varia um único sinal por tentativa e lê a resposta. Ameaça prioritária (probabilidade 3 × impacto 3).'
        : 'Bot troca vários sinais de uma vez (c ≈ R$ 12) e infere a regra pela taxa de aceitação de lotes.',
    )
    add(
      'alert',
      'probing_detected',
      'motor',
      'engine',
      round.r === 3
        ? '12 sequências de sondagem: ≥ 3 tentativas com um campo alterado. Conjunto recusado.'
        : '18 sequências com até 2 campos alterados. Conjuntos recusados em bloco.',
    )
    add(
      'warn',
      'limit_triggered',
      'motor',
      'all',
      `${round.limited} tentativas barradas pelo limite (3 / 24 h por dispositivo, sessão e cartão).`,
    )
    add(
      'info',
      'generic_message_on',
      'motor',
      'all',
      'Mensagem pública genérica: “Não foi possível aplicar o cupom neste pedido.” O motivo real fica só no registro interno.',
    )
    add(
      'warn',
      'contestation_opened',
      'motor',
      'engine',
      round.r === 3
        ? '12 contestações abertas após recusas; canal sem aprovação automática.'
        : '8 contestações abertas; 1 com padrão de abuso (mesmo dispositivo contesta repetidamente).',
    )
    add(
      'warn',
      'false_positives',
      'avaliador',
      'eval',
      `${round.falsePositives} clientes legítimos recusados (famílias e repúblicas que dividem aparelho ou endereço, P3).`,
    )
  }
  if (round.r === 4) {
    add(
      'alert',
      'cost_per_approved_high',
      'bot',
      'bot',
      'Custo por aprovada R$ 34,29 passou de R$ 20. Net do bot −R$ 1.500: a fraude deixou de compensar.',
    )
  }

  const cumulativeBudget = totals(allRounds, round.r).budget
  add(
    cumulativeBudget / 100000 >= 0.2 ? 'alert' : 'info',
    'budget_alert',
    'motor',
    'engine',
    `Orçamento consumido: ${money(cumulativeBudget)} (${((cumulativeBudget / 100000) * 100).toFixed(1)}%). Limiar de 20% ${cumulativeBudget / 100000 >= 0.2 ? 'atingido' : 'não atingido; sem alerta'}.`,
  )

  const engineCard = round.engineLane[3]
  const botCard = round.botLane[3]
  if (engineCard.trigger) {
    add(
      'warn',
      'policy_changed',
      'motor',
      'engine',
      `${round.policy} → pol_v${round.r + 1}: ${engineCard.title} · gatilho ${engineCard.trigger} (${engineCard.triggerHint}).`,
    )
  }
  if (botCard.trigger) {
    add(
      'warn',
      'bot_strategy_changed',
      'bot',
      'bot',
      `Tática alterada: ${botCard.title} · gatilho ${botCard.trigger} (${botCard.triggerHint}).`,
    )
  }
  if (!engineCard.trigger && !botCard.trigger) {
    add(
      'info',
      'no_trigger',
      'sistema',
      'all',
      'Nenhum gatilho disparou. A política foi mantida; a ausência de mudança também é evidência.',
    )
  }

  return out
}

export const alertsVisibleInView = (alerts: Alert[], view: string) =>
  alerts.filter(
    (alert) => alert.visibility === 'all' || view === 'eval' || alert.visibility === (view === 'bot' ? 'bot' : 'engine'),
  )

export const finalAlert = (): Alert => ({
  round: 99,
  severity: 'info',
  tag: 'run_completed',
  actor: 'avaliador',
  visibility: 'eval',
  text: 'Risco residual da AM3 estimado em 4 (2 × 2). Estimativa qualitativa: o resultado aceito/recusado continua informativo e testes distribuídos ainda passam.',
})

export const policyDiff = (from: string, to: string) => {
  const a = POLICIES[from]
  const b = POLICIES[to]
  if (!a || !b) return []
  return Object.keys(a)
    .filter((key) => a[key] !== b[key])
    .map((key) => ({ key, from: a[key], to: b[key] }))
}

export const resultLabel = (result: Attempt['result']) => RESULT_LABEL[result]
