/**
 * Tipos do domínio expostos à interface.
 *
 * Estes tipos são o contrato entre a view e a fonte de dados. Hoje a fonte é
 * `demoSource(seed)`; quando o simulador Python estiver pronto, um adaptador
 * HTTP implementa a mesma interface e as telas não mudam.
 */

export type View = 'eval' | 'bot' | 'engine'

export interface Card {
  /** Título curto da etapa. */
  title: string
  /** Evidência numérica ou consequência observada. */
  detail: string
  /** Gatilho que provocou a adaptação, quando houver. */
  trigger?: string
  triggerHint?: string
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
  verifications: number
  limited: number
  redemptions: number
  budget: number
  botCost: number
  conversion: number
  fraudRedemptions: number
  falsePositives: number
  summary: { bot: string; engine: string }
  pills: string[]
  botLane: Card[]
  engineLane: Card[]
}

export type AttemptResult = 'accepted' | 'coupon_already_used' | 'verification_required' | 'rate_limited'

export interface Attempt {
  id: string
  account: string
  email: string
  phone: string
  cpf: string
  device: string
  address: string
  result: AttemptResult
  message: string
  reason: string
  order: number
  cost: number
  time: string
  verification: string
  tactic: string
  label: 'fraude' | 'legítima'
  person: string
  shared: number
  score: number
}

export type EventActor = 'bot' | 'engine' | 'checkout' | 'review' | 'system'
export type EventVisibility = 'public' | 'operational' | 'evaluation'

export interface Ev {
  seq: number
  time: string
  type: string
  actor: EventActor
  account: string
  result: string
  reason: string
  policy: string
  visibility: EventVisibility
  payload: Record<string, unknown>
}

export type Severity = 'info' | 'warn' | 'alert'

export interface Alert {
  round: number
  severity: Severity
  tag: string
  actor: 'sistema' | 'bot' | 'motor' | 'avaliador'
  visibility: 'all' | 'bot' | 'engine' | 'eval'
  text: string
}

export type ContestStatus = 'open' | 'under_review' | 'maintained' | 'reverted' | 'inconclusive'

export interface ContestSignal {
  key: string
  value: string
  shared?: string
}

export interface Contest {
  id: string
  attempt: string
  account: string
  round: number
  date: string
  evidence: string
  status: ContestStatus
  message: string
  reason: string
  rules: string[]
  score: number
  policy: string
  decidedAt: string
  note: string
  slaHours: number
  abuse?: boolean
  history: { at: string; text: string }[]
  outcome?: string
  signals: ContestSignal[]
  cost: number
}

export type Policy = Record<string, string>
