export type View = 'eval' | 'bot' | 'engine'

export const RUN_ID = 'run_20261120_1432_a1b2c3'

export const brl = (n: number, d = 0) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d })
export const int = (n: number) => n.toLocaleString('pt-BR')
export const pct = (n: number, d = 0) =>
  (n * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
export const dec = (n: number, d = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export interface Card {
  t: string
  e: string
  trig?: string
  trigHint?: string
}
export interface Round {
  r: number
  dates: string
  attack: string
  tactic: string
  defense: string
  policy: string
  attempts: number
  accepted: number
  refused: number
  verif: number
  limited: number
  redemptions: number
  budget: number
  botCost: number
  conv: number
  fraudRed: number
  fp: number
  summary: { bot: string; engine: string }
  pills: string[]
  botLane: Card[]
  engLane: Card[]
}

export const rounds: Round[] = [
  {
    r: 1, dates: '3–9 nov', attack: 'AM1', tactic: 'E-mails descartáveis', defense: 'B1', policy: 'pol_v1',
    attempts: 200, accepted: 200, refused: 0, verif: 0, limited: 0, redemptions: 200, budget: 4000, botCost: 0, conv: 0.96,
    fraudRed: 190, fp: 0,
    summary: { bot: 'Cria 200 contas com e-mails descartáveis e resgata todas.', engine: 'Só valida e-mail; aprova tudo e vê o pico de cadastros.' },
    pills: ['AM1 / P1', 'pico de cadastros', 'B1'],
    botLane: [
      { t: 'E-mails descartáveis', e: '200 contas · custo R$ 0' },
      { t: 'Resposta pública', e: 'Cupom aceito em 200 de 200 tentativas' },
      { t: 'Aceitação 100%', e: 'Nenhuma verificação pedida · ROI indefinido (custo 0)' },
      { t: 'Escala para SMS virtual + CPF (AM2)', e: 'Roteiro AM1 → AM2; sem gatilho de bot' },
    ],
    engLane: [
      { t: 'Verificação leve (B1)', e: 'Só e-mail · mensagem detalhada' },
      { t: 'Aceita 200 · recusa 0', e: 'Resgates 200 · R$ 4.000 debitados' },
      { t: 'Cadastros 200 vs. base de 100', e: 'Multiplicador observado 2,0×', trig: 'signup_volume_high', trigHint: 'cadastros ≥ 2× o volume base' },
      { t: 'Muda para B2 (SMS + CPF + dispositivo)', e: 'pol_v1 → pol_v2', trig: 'signup_volume_high', trigHint: 'cadastros ≥ 2× o volume base' },
    ],
  },
  {
    r: 2, dates: '10–16 nov', attack: 'AM2', tactic: 'SMS virtual + CPF + emulador', defense: 'B2', policy: 'pol_v2',
    attempts: 250, accepted: 140, refused: 80, verif: 30, limited: 0, redemptions: 140, budget: 2800, botCost: 1250, conv: 0.55,
    fraudRed: 100, fp: 9,
    summary: { bot: 'Compra sinais a R$ 5 e contorna parte da verificação rígida.', engine: 'Detecta relações entre contas, mas ainda explica a recusa.' },
    pills: ['AM2 / P2', 'relações detectadas', 'B2'],
    botLane: [
      { t: 'SMS virtual + CPF + emulador', e: '250 tentativas · custo R$ 1.250' },
      { t: 'Recusas explicam o motivo', e: '“Este CPF já foi usado em outra conta.” × 80' },
      { t: 'Mensagem vira oráculo', e: 'Aceitação 56% · 80 recusas detalhadas', trig: 'detailed_refusal_seen', trigHint: 'recusa com motivo identificável' },
      { t: 'Sondagem de um sinal por vez (AM3)', e: 'Usa a mensagem para testar campo a campo', trig: 'detailed_refusal_seen', trigHint: 'recusa com motivo identificável' },
    ],
    engLane: [
      { t: 'Verificação rígida (B2)', e: 'SMS + CPF + dispositivo · custo R$ 1,00 por verificação' },
      { t: 'Recusa 80 · verifica 30', e: 'shared_device e shared_cpf dominam' },
      { t: 'Conversão legítima cai a 55%', e: '9 falsos positivos · atrito na verificação' },
      { t: 'Mantém B2; sem gatilho de motor', e: 'pol_v2 → pol_v3 por redesenho da seção 5' },
    ],
  },
  {
    r: 3, dates: '17–23 nov', attack: 'AM3', tactic: 'Sondagem de 1 sinal', defense: 'Redesenho', policy: 'pol_v3',
    attempts: 220, accepted: 110, refused: 90, verif: 12, limited: 8, redemptions: 110, budget: 2200, botCost: 1760, conv: 0.61,
    fraudRed: 90, fp: 7,
    summary: { bot: 'Varia um sinal por tentativa para descobrir o que é barrado.', engine: 'Redesenho com 4 controles; detecta a sequência de sondagem.' },
    pills: ['AM3 / P3', 'sondagem detectada', 'redesenho'],
    botLane: [
      { t: 'Sondagem de um sinal por vez', e: '220 tentativas · custo R$ 1.760' },
      { t: 'Recusa 90 · verificação 12 · limite 8', e: 'Mensagem agora genérica' },
      { t: 'Aceitação 50% · R$ 16 por aprovada', e: 'A mensagem deixou de ser oráculo' },
      { t: 'Rotação de vários sinais', e: 'Troca telefone, CPF, dispositivo e endereço', trig: 'acceptance_rate_low', trigHint: 'aceitação < 50%' },
    ],
    engLane: [
      { t: 'Redesenho + 4 controles', e: 'Mensagem genérica · limite 3/24 h · sondagem · contestação' },
      { t: 'Recusa 90 · pede 12 · limita 8', e: '12 sequências de sondagem marcadas' },
      { t: '12 sondagens · 20 contestações', e: '5 revertidas · 7 falsos positivos' },
      { t: 'Política endurece: pol_v3 → pol_v4', e: 'Detecção cobre até 2 campos; limite 2/24 h', trig: 'probing_detected', trigHint: '≥ 3 tentativas com 1 campo alterado' },
    ],
  },
  {
    r: 4, dates: '24–30 nov', attack: 'AM3', tactic: 'Rotação de vários sinais', defense: 'Redesenho', policy: 'pol_v4',
    attempts: 300, accepted: 105, refused: 160, verif: 25, limited: 10, redemptions: 105, budget: 2100, botCost: 3600, conv: 0.64,
    fraudRed: 100, fp: 4,
    summary: { bot: 'Rotaciona quatro sinais a R$ 12; custo passa do desconto.', engine: 'Mantém a política endurecida e corta o ganho do atacante.' },
    pills: ['AM3 / P3', 'rotação de sinais', 'redesenho'],
    botLane: [
      { t: 'Rotação de vários sinais', e: '300 tentativas · custo R$ 3.600' },
      { t: 'Recusa 160 · verificação 25', e: 'Aceitação 35%' },
      { t: 'Custo por aprovada R$ 34,29', e: 'Acima do desconto de R$ 20 · net −R$ 1.500', trig: 'cost_per_approved_high', trigHint: 'custo por aprovada > R$ 20' },
      { t: 'Recuo para conta única (A1)', e: 'Abandona o ataque em escala', trig: 'cost_per_approved_high', trigHint: 'custo por aprovada > R$ 20' },
    ],
    engLane: [
      { t: 'Política pol_v4', e: 'Sondagem em até 2 campos · limite 2/24 h' },
      { t: 'Recusa 160 · limita 10', e: 'probing_sequence e shared_device' },
      { t: 'Falsos positivos caem a 4', e: 'Conversão legítima 64%' },
      { t: 'Suaviza a política: pol_v4 → pol_v5', e: 'Volume de atacante some; reduz atrito', trig: 'shared_signals_high', trigHint: 'sinais compartilhados caíram abaixo de 20%' },
    ],
  },
  {
    r: 5, dates: '1–7 dez', attack: 'A1', tactic: 'Recuo para conta única', defense: 'Redesenho suavizado', policy: 'pol_v5',
    attempts: 1, accepted: 1, refused: 0, verif: 0, limited: 0, redemptions: 1, budget: 20, botCost: 0, conv: 0.72,
    fraudRed: 0, fp: 1,
    summary: { bot: 'Opera uma conta legítima; usa o cupom uma única vez.', engine: 'Defesa suavizada reduz atrito para o cliente real.' },
    pills: ['A1', 'recuo', 'redesenho suavizado'],
    botLane: [
      { t: 'Conta única (A1)', e: '1 tentativa · custo R$ 0' },
      { t: 'Cupom aceito', e: '1 de 1' },
      { t: 'ROI preservado', e: 'Net +R$ 20 · sem custo de tática' },
      { t: 'Mantém A1', e: 'Sem gatilho de bot' },
    ],
    engLane: [
      { t: 'Política pol_v5', e: 'Verificação por e-mail + SMS para suspeitos' },
      { t: 'Aceita 1', e: 'Resgate R$ 20' },
      { t: 'Conversão legítima 72%', e: 'Nenhum sinal de ataque' },
      { t: 'Nenhum gatilho disparou', e: 'Política mantida; pol_v5 → pol_v6 só calibra limiares' },
    ],
  },
  {
    r: 6, dates: '8–14 dez', attack: 'A1', tactic: 'A1 residual', defense: 'Redesenho calibrado', policy: 'pol_v6',
    attempts: 1, accepted: 1, refused: 0, verif: 0, limited: 0, redemptions: 1, budget: 20, botCost: 0, conv: 0.78,
    fraudRed: 0, fp: 1,
    summary: { bot: 'Permanece em conta única; patamar estável.', engine: 'Limiares calibrados; nenhuma mudança de política.' },
    pills: ['A1', 'patamar estável', 'calibrado'],
    botLane: [
      { t: 'A1 residual', e: '1 tentativa · custo R$ 0' },
      { t: 'Cupom aceito', e: '1 de 1' },
      { t: 'Estável', e: 'Net +R$ 20' },
      { t: 'Mantém A1', e: 'Nenhum gatilho' },
    ],
    engLane: [
      { t: 'Política pol_v6', e: 'Compartilhamento de dispositivo ≤ 25%' },
      { t: 'Aceita 1', e: 'Sem recusas' },
      { t: 'Conversão legítima 78%', e: 'Melhor patamar da execução' },
      { t: 'Nenhum gatilho disparou', e: 'A política foi mantida — a ausência de mudança também é evidência' },
    ],
  },
]

export const totals = (n = 6) => {
  const rs = rounds.slice(0, n)
  const sum = (f: (r: Round) => number) => rs.reduce((a, r) => a + f(r), 0)
  const t = {
    attempts: sum((r) => r.attempts), accepted: sum((r) => r.accepted), refused: sum((r) => r.refused),
    verif: sum((r) => r.verif), limited: sum((r) => r.limited), redemptions: sum((r) => r.redemptions),
    budget: sum((r) => r.budget), botCost: sum((r) => r.botCost), fraudRed: sum((r) => r.fraudRed), fp: sum((r) => r.fp),
  }
  const net = t.redemptions * 20 - t.botCost
  return { ...t, net, roi: t.botCost ? net / t.botCost : 0, cpa: t.accepted ? t.botCost / t.accepted : 0, loss: t.fraudRed * 14 }
}

export const netBot = (r: Round) => 20 * r.redemptions - r.botCost
export const cpa = (r: Round) => (r.accepted ? r.botCost / r.accepted : 0)

// pseudo-random determinístico
const lcg = (seed: number) => {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

export interface Attempt {
  id: string; account: string; email: string; phone: string; cpf: string; device: string; address: string
  result: 'accepted' | 'coupon_already_used' | 'verification_required' | 'rate_limited'
  message: string; reason: string; order: number; cost: number; time: string; verification: string; tactic: string
  label: 'fraude' | 'legítima'; person: string; shared: number; score: number
}

export const RESULT_LABEL: Record<Attempt['result'], string> = {
  accepted: 'Aceito', coupon_already_used: 'Recusado', verification_required: 'Verificação', rate_limited: 'Limite',
}
const GENERIC = 'Não foi possível aplicar o cupom neste pedido.'

export const attemptsOf = (rd: Round): Attempt[] => {
  const rnd = lcg(42 + rd.r * 977)
  const kinds: Attempt['result'][] = [
    ...Array(rd.accepted).fill('accepted'), ...Array(rd.refused).fill('coupon_already_used'),
    ...Array(rd.verif).fill('verification_required'), ...Array(rd.limited).fill('rate_limited'),
  ]
  const missing = rd.attempts - kinds.length
  for (let i = 0; i < missing; i++) kinds.push('accepted')
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]] }
  const reasons: Record<string, string[]> = {
    coupon_already_used: ['shared_device', 'shared_cpf', 'shared_phone', 'shared_address', 'virtual_phone_range', 'probing_sequence'],
    verification_required: ['shared_device', 'virtual_phone_range', 'manual_review'],
    rate_limited: ['attempt_limit_exceeded'], accepted: ['eligible'],
  }
  const costPer = rd.attempts ? rd.botCost / rd.attempts : 0
  return kinds.map((result, i) => {
    const n = rd.r * 1000 + i
    const fraud = rd.attack !== 'A1' && rnd() > 0.1
    const reason = reasons[result][Math.floor(rnd() * reasons[result].length)]
    const shared = reason.startsWith('shared') ? 2 + Math.floor(rnd() * 3) : 0
    const mm = String(Math.floor(rnd() * 59)).padStart(2, '0')
    const detailed = rd.r < 3
    return {
      id: `att_${String(n).padStart(5, '0')}`, account: `acc_${String(n % 100000).padStart(5, '0')}`,
      email: `ana.s+${i % 40}@…`, phone: `…${String(n % 10000).padStart(4, '0')}`, cpf: `***.***.***-${String(n % 100).padStart(2, '0')}`,
      device: `dev_${(Math.floor(rnd() * 0xffff)).toString(16).padStart(4, '0')}`, address: `addr_${100 + Math.floor(rnd() * 90)}`,
      result,
      message: result === 'accepted' ? 'Cupom aplicado.' : detailed ? (reason === 'shared_cpf' ? 'Este CPF já foi usado em outra conta.' : 'Este dispositivo já resgatou o cupom.') : GENERIC,
      reason, order: 30.01 + Math.floor(rnd() * 3000) / 100, cost: costPer, time: `${String(8 + Math.floor(rnd() * 12)).padStart(2, '0')}:${mm}`,
      verification: result === 'verification_required' ? (rd.defense === 'B1' ? 'email' : 'sms') : 'none', tactic: rd.tactic,
      label: fraud ? 'fraude' : 'legítima', person: `per_${String(100 + Math.floor(rnd() * 400)).padStart(5, '0')}`, shared, score: Math.round(rnd() * 100) / 100,
    }
  })
}

export interface Ev {
  seq: number; time: string; type: string; actor: 'bot' | 'engine' | 'checkout' | 'review' | 'system'
  account: string; result: string; reason: string; policy: string; visibility: 'public' | 'operational' | 'evaluation'
  payload: Record<string, unknown>
}
export const EVENT_LABEL: Record<string, string> = {
  coupon_decided: 'Cupom decidido', probing_detected: 'Sondagem detectada', limit_triggered: 'Limite acionado',
  redemption_completed: 'Resgate concluído', policy_changed: 'Política alterada', bot_strategy_changed: 'Tática alterada',
  bot_cost_recorded: 'Custo registrado', round_started: 'Rodada iniciada', round_completed: 'Rodada concluída',
  relation_detected: 'Relação detectada',
}
export const eventsOf = (rd: Round): Ev[] => {
  const at = attemptsOf(rd)
  const evs: Ev[] = []
  let seq = (rd.r - 1) * 1000
  const push = (e: Omit<Ev, 'seq'>) => evs.push({ ...e, seq: ++seq })
  push({ time: '00:00:00', type: 'round_started', actor: 'system', account: '—', result: '—', reason: '—', policy: rd.policy, visibility: 'public', payload: { round: rd.r, window: rd.dates } })
  at.forEach((a, i) => {
    const t = `${a.time}:${String(i % 60).padStart(2, '0')}`
    push({ time: t, type: 'coupon_decided', actor: 'engine', account: a.account, result: a.result, reason: a.reason, policy: rd.policy, visibility: 'operational', payload: { rules_fired: [a.reason], score: a.score } })
    if (a.result === 'accepted') push({ time: t, type: 'redemption_completed', actor: 'checkout', account: a.account, result: 'accepted', reason: '—', policy: rd.policy, visibility: 'public', payload: { discount: 20, order_value: +a.order.toFixed(2) } })
    if (a.reason === 'probing_sequence') push({ time: t, type: 'probing_detected', actor: 'engine', account: a.account, result: a.result, reason: a.reason, policy: rd.policy, visibility: 'operational', payload: { attempts: 3, changed_field: 'device_id' } })
    if (a.result === 'rate_limited') push({ time: t, type: 'limit_triggered', actor: 'engine', account: a.account, result: a.result, reason: a.reason, policy: rd.policy, visibility: 'operational', payload: { scope: 'device', window_hours: 24 } })
    if (a.cost > 0 && i % 10 === 0) push({ time: t, type: 'bot_cost_recorded', actor: 'bot', account: a.account, result: '—', reason: '—', policy: rd.policy, visibility: 'evaluation', payload: { cost: +a.cost.toFixed(2) } })
  })
  push({ time: '23:59:59', type: 'round_completed', actor: 'system', account: '—', result: '—', reason: '—', policy: rd.policy, visibility: 'public', payload: { redemptions: rd.redemptions } })
  return evs
}

export const POLICIES: Record<string, Record<string, string>> = {
  pol_v1: { defense_mode: 'light', verificação: 'e-mail', mensagem: 'detalhada', 'limite de tentativas': 'desligado', 'detecção de sondagem': 'desligada', 'canal de contestação': 'desligado' },
  pol_v2: { defense_mode: 'strict', verificação: 'SMS + CPF + dispositivo', mensagem: 'detalhada', 'limite de tentativas': 'desligado', 'detecção de sondagem': 'desligada', 'canal de contestação': 'desligado' },
  pol_v3: { defense_mode: 'adaptive_redesign', verificação: 'SMS + CPF + dispositivo', mensagem: 'genérica', 'limite de tentativas': '3 / 24 h', 'detecção de sondagem': '≥ 3 tentativas, 1 campo', 'canal de contestação': 'ligado' },
  pol_v4: { defense_mode: 'adaptive_redesign', verificação: 'SMS + CPF + dispositivo', mensagem: 'genérica', 'limite de tentativas': '2 / 24 h', 'detecção de sondagem': '≥ 3 tentativas, até 2 campos', 'canal de contestação': 'ligado' },
  pol_v5: { defense_mode: 'adaptive_redesign', verificação: 'e-mail + SMS (suspeitos)', mensagem: 'genérica', 'limite de tentativas': '3 / 24 h', 'detecção de sondagem': '≥ 3 tentativas, até 2 campos', 'canal de contestação': 'ligado' },
  pol_v6: { defense_mode: 'adaptive_redesign', verificação: 'e-mail + SMS (suspeitos)', mensagem: 'genérica', 'limite de tentativas': '3 / 24 h', 'detecção de sondagem': '≥ 3 tentativas, até 2 campos', 'canal de contestação': 'ligado' },
}

export const TRIGGER_HINT: Record<string, string> = {
  signup_volume_high: 'cadastros ≥ 2× o volume base', detailed_refusal_seen: 'recusa com motivo identificável',
  probing_detected: '≥ 3 tentativas com 1 campo alterado', cost_per_approved_high: 'custo por aprovada > R$ 20',
  acceptance_rate_low: 'aceitação < 50%',
}

export type CStatus = 'open' | 'under_review' | 'maintained' | 'reverted' | 'inconclusive'
export interface Contest {
  id: string; attempt: string; account: string; round: number; date: string; evidence: string; status: CStatus
  message: string; reason: string; rules: string[]; score: number; policy: string; decidedAt: string
  note: string; slaHours: number; abuse?: boolean; history: { at: string; text: string }[]; outcome?: string
  signals: { k: string; v: string; shared?: string }[]; cost: number
}
export const EVIDENCE_LABEL: Record<string, string> = {
  address_proof: 'Comprovante de endereço', device_info: 'Informação do dispositivo', support_message: 'Mensagem ao suporte', none: 'Sem evidência',
}
export const STATUS_LABEL: Record<CStatus, string> = {
  open: 'Aberta', under_review: 'Em análise', maintained: 'Mantida', reverted: 'Revertida', inconclusive: 'Inconclusiva',
}
const sig = (n: number, d: string, a: string, p: string): Contest['signals'] => [
  { k: 'dispositivo', v: d, shared: `${n} contas` }, { k: 'endereço', v: a, shared: `${n + 1} contas` }, { k: 'telefone', v: p },
]
export const initialContests: Contest[] = [
  { id: 'con_00007', attempt: 'att_00312', account: 'acc_00042', round: 3, date: '18/11', evidence: 'address_proof', status: 'under_review', message: GENERIC, reason: 'shared_device', rules: ['shared_device', 'probing_sequence'], score: 0.82, policy: 'pol_v3', decidedAt: '17/11 10:02', note: 'Mora com 3 pessoas.', slaHours: 6, signals: sig(3, 'dev_8f21', 'addr_120', '…0042'), cost: 18, history: [{ at: '18/11 08:00', text: 'Contestação aberta' }, { at: '18/11 09:10', text: 'Em análise' }] },
  { id: 'con_00008', attempt: 'att_00340', account: 'acc_00077', round: 4, date: '19/11', evidence: 'none', status: 'open', message: GENERIC, reason: 'shared_address', rules: ['shared_address'], score: 0.64, policy: 'pol_v4', decidedAt: '19/11 09:40', note: 'Aguardando evidência.', slaHours: 14, signals: sig(2, 'dev_41ac', 'addr_133', '…0077'), cost: 0, history: [{ at: '19/11 10:00', text: 'Contestação aberta' }] },
  { id: 'con_00009', attempt: 'att_00355', account: 'acc_00102', round: 4, date: '19/11', evidence: 'device_info', status: 'inconclusive', message: GENERIC, reason: 'virtual_phone_range', rules: ['virtual_phone_range'], score: 0.7, policy: 'pol_v4', decidedAt: '19/11 11:12', note: 'Sinais insuficientes.', slaHours: 0, signals: sig(1, 'dev_77be', 'addr_141', '…0102'), cost: 18, history: [{ at: '19/11 12:00', text: 'Aberta' }, { at: '19/11 15:20', text: 'Encerrada como inconclusiva' }] },
  { id: 'con_00010', attempt: 'att_00371', account: 'acc_00118', round: 4, date: '20/11', evidence: 'support_message', status: 'reverted', message: GENERIC, reason: 'shared_address', rules: ['shared_address'], score: 0.55, policy: 'pol_v4', decidedAt: '20/11 08:03', note: 'República universitária confirmada.', slaHours: 0, signals: sig(4, 'dev_90ee', 'addr_150', '…0118'), cost: 18, outcome: 'Nova avaliação no checkout: cupom aceito, pedido de R$ 41,90 concluído, resgate debitado uma vez.', history: [{ at: '20/11 08:30', text: 'Aberta' }, { at: '20/11 14:30', text: 'Revertida · nova avaliação aceita' }] },
  { id: 'con_00011', attempt: 'att_00388', account: 'acc_00131', round: 4, date: '20/11', evidence: 'none', status: 'maintained', message: GENERIC, reason: 'probing_sequence', rules: ['probing_sequence', 'attempt_limit_exceeded'], score: 0.93, policy: 'pol_v4', decidedAt: '20/11 09:15', note: 'Sequência de sondagem confirmada.', slaHours: 0, abuse: true, signals: sig(5, 'dev_8f21', 'addr_120', '…0131'), cost: 18, history: [{ at: '20/11 09:30', text: 'Aberta' }, { at: '20/11 11:00', text: 'Mantida' }] },
  { id: 'con_00012', attempt: 'att_00402', account: 'acc_00140', round: 3, date: '18/11', evidence: 'address_proof', status: 'open', message: GENERIC, reason: 'shared_device', rules: ['shared_device'], score: 0.6, policy: 'pol_v3', decidedAt: '18/11 14:00', note: '', slaHours: -3, signals: sig(2, 'dev_2d30', 'addr_122', '…0140'), cost: 0, history: [{ at: '18/11 15:00', text: 'Contestação aberta' }] },
]

// ---------- Avisos adversariais (modo bruto) ----------
export type Sev = 'info' | 'warn' | 'alert'
export interface Alert {
  round: number; sev: Sev; tag: string; actor: 'sistema' | 'bot' | 'motor' | 'avaliador'
  vis: 'all' | 'bot' | 'engine' | 'eval'; text: string
}
export const alertsOf = (rd: Round): Alert[] => {
  const out: Alert[] = []
  const r = rd.r
  const add = (sev: Sev, tag: string, actor: Alert['actor'], vis: Alert['vis'], text: string) => out.push({ round: r, sev, tag, actor, vis, text })
  add('info', 'round_started', 'sistema', 'all', `Rodada ${r} iniciada · janela ${rd.dates} · política ${rd.policy} (${rd.defense})`)
  if (r === 1) {
    add('alert', 'AM1 · P1 falhou', 'avaliador', 'eval', 'E-mail novo deixou de significar pessoa nova: 200 contas com e-mails descartáveis e variações nome+N a custo R$ 0.')
    add('warn', 'signup_volume_high', 'motor', 'engine', 'Pico de cadastros: 200 contas, 2,0× o volume base, concentradas em poucos domínios e sem segunda compra.')
  }
  if (r === 2) {
    add('alert', 'AM2 · P2 falhou', 'avaliador', 'eval', 'SMS virtual, CPF vazado e emulador contornam a verificação rígida: c ≈ R$ 5 contra R$ 20 de desconto. Dados de terceiros envolvidos.')
    add('warn', 'relation_detected', 'motor', 'engine', 'Mesmo CPF em vários aparelhos e faixas de telefone virtual detectados em 80 recusas.')
    add('warn', 'conversion_drop', 'motor', 'engine', 'Conclusão de cadastro caiu de 70% para 55% por causa de SMS + CPF em todos os cadastros (atrito sobre o cliente legítimo).')
    add('alert', 'detailed_refusal_seen', 'bot', 'bot', 'As recusas explicam o sinal (“Este CPF já foi usado”): a mensagem virou oráculo (PE3). Sondagem de um sinal por vez fica possível.')
  }
  if (r >= 3) {
    add('alert', r === 3 ? 'AM3 · risco 9 · sondagem' : 'AM3 · rotação de sinais', 'avaliador', 'eval', r === 3 ? 'Bot varia um único sinal por tentativa e lê a resposta. Ameaça prioritária (probabilidade 3 × impacto 3).' : 'Bot troca vários sinais de uma vez (c ≈ R$ 12) e infere a regra pela taxa de aceitação de lotes.')
    add('alert', 'probing_detected', 'motor', 'engine', r === 3 ? '12 sequências de sondagem: ≥ 3 tentativas com um campo alterado. Conjunto recusado.' : '18 sequências com até 2 campos alterados. Conjuntos recusados em bloco.')
    add('warn', 'limit_triggered', 'motor', 'all', `${rd.limited} tentativas barradas pelo limite (3 / 24 h por dispositivo, sessão e cartão).`)
    add('info', 'generic_message_on', 'motor', 'all', 'Mensagem pública genérica: “Não foi possível aplicar o cupom neste pedido.” O motivo real fica só no registro interno.')
    add('warn', 'contestation_opened', 'motor', 'engine', r === 3 ? '12 contestações abertas após recusas; canal sem aprovação automática.' : '8 contestações abertas; 1 com padrão de abuso (mesmo dispositivo contesta repetidamente).')
    add('warn', 'false_positives', 'avaliador', 'eval', `${rd.fp} clientes legítimos recusados (famílias e repúblicas que dividem aparelho ou endereço, P3).`)
  }
  if (r === 4) {
    add('alert', 'cost_per_approved_high', 'bot', 'bot', 'Custo por aprovada R$ 34,29 passou de R$ 20. Net do bot −R$ 1.500: a fraude deixou de compensar.')
  }
  const cum = totals(r).budget
  add(cum / 100000 >= 0.2 ? 'alert' : 'info', 'budget_alert', 'motor', 'engine', `Orçamento consumido: ${brl(cum)} (${pct(cum / 100000, 1)}). Limiar de 20% ${cum / 100000 >= 0.2 ? 'atingido' : 'não atingido; sem alerta'}.`)
  const e = rd.engLane[3], b = rd.botLane[3]
  if (e.trig) add('warn', 'policy_changed', 'motor', 'engine', `${rd.policy} → pol_v${r + 1}: ${e.t.replace(/^.*?: /, '')} · gatilho ${e.trig} (${e.trigHint}).`)
  if (b.trig) add('warn', 'bot_strategy_changed', 'bot', 'bot', `Tática alterada: ${b.t} · gatilho ${b.trig} (${b.trigHint}).`)
  if (!e.trig && !b.trig) add('info', 'no_trigger', 'sistema', 'all', 'Nenhum gatilho disparou. A política foi mantida; a ausência de mudança também é evidência.')
  if (!e.trig && b.trig === undefined && r < 6 && r !== 2 && r !== 1 && r !== 3 && r !== 4) add('info', 'policy_calibrated', 'motor', 'engine', `${rd.policy} → pol_v${r + 1}: apenas calibragem de limiares.`)
  return out
}
export const finalAlert = (): Alert => ({
  round: 99, sev: 'info', tag: 'run_completed', actor: 'avaliador', vis: 'eval',
  text: 'Risco residual da AM3 estimado em 4 (2 × 2). Estimativa qualitativa: o resultado aceito/recusado continua informativo e testes distribuídos ainda passam.',
})
