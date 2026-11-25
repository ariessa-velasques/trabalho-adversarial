import { createContext, useContext } from 'react'
import type { Contest, View } from './data'

export interface Cfg {
  preset: 'demo' | 'compare' | 'quick'
  label: string; seed: number; scenario: 'adaptive' | 'guided'; notes: string; rounds: number
  runMode: 'deterministic' | 'adversarial_validation'; provider: string; model: string; temperature: number; maxCalls: number
  defense: 'B1' | 'B2' | 'redesign'
  generic: boolean; limitOn: boolean; limitMax: number; limitWindow: number; probing: boolean; probingMin: number; contestation: boolean
  discount: number; minOrder: number; acqBudget: number; atkBudget: number; commission: number
  costEmail: number; costSms: number; costEmu: number; retreatCpa: number; safety: number
  legit: number; sharedDevice: number; sharedAddress: number; abandon: number
  outputs: Record<string, boolean>
}

export const PRESETS: Record<Cfg['preset'], Partial<Cfg>> = {
  demo: { label: 'Demonstração — 6 rodadas', rounds: 6, scenario: 'adaptive', runMode: 'deterministic', defense: 'redesign' },
  compare: { label: 'Comparar defesas — 3 rodadas', rounds: 3, scenario: 'guided', runMode: 'deterministic', defense: 'redesign' },
  quick: { label: 'Teste rápido — 3 rodadas', rounds: 3, scenario: 'adaptive', runMode: 'deterministic', defense: 'redesign' },
}

export const defaultCfg: Cfg = {
  preset: 'demo', label: 'Demonstração — 6 rodadas', seed: 42, scenario: 'adaptive', notes: '', rounds: 6,
  runMode: 'deterministic', provider: 'anthropic', model: 'claude-sonnet-4', temperature: 0, maxCalls: 1,
  defense: 'redesign', generic: true, limitOn: true, limitMax: 3, limitWindow: 24, probing: true, probingMin: 3, contestation: true,
  discount: 20, minOrder: 30, acqBudget: 100000, atkBudget: 5000, commission: 20,
  costEmail: 0, costSms: 5, costEmu: 12, retreatCpa: 20, safety: 0,
  legit: 100, sharedDevice: 12, sharedAddress: 18, abandon: 8,
  outputs: { 'events.jsonl': true, 'metrics.csv': true, 'redemptions.csv': true, 'attempts.csv': true, 'llm_transcript.json': false },
}

export const hashCfg = (c: Cfg) => {
  const s = JSON.stringify({ ...c, label: undefined, notes: undefined })
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 6)
}

export interface Validation { errors: Record<string, string>; warnings: string[] }
export const validate = (c: Cfg): Validation => {
  const e: Record<string, string> = {}
  const w: string[] = []
  if (!c.label.trim()) e.label = 'Dê um nome à execução.'
  if (!Number.isInteger(c.seed)) e.seed = 'A seed precisa ser um número inteiro.'
  if (!(c.discount > 0)) e.discount = 'O desconto precisa ser maior que R$ 0.'
  if (!(c.minOrder >= 0)) e.minOrder = 'Informe um valor mínimo válido.'
  if (!(c.acqBudget > 0)) e.acqBudget = 'Informe um orçamento maior que zero.'
  if (!(c.atkBudget >= 0)) e.atkBudget = 'Informe um orçamento válido.'
  if (!(c.commission >= 0 && c.commission <= 100)) e.commission = 'A comissão fica entre 0% e 100%.'
  for (const k of ['sharedDevice', 'sharedAddress', 'abandon'] as const) if (!(c[k] >= 0 && c[k] <= 100)) e[k] = 'Use um valor entre 0% e 100%.'
  if (!(c.legit >= 0)) e.legit = 'Informe um número válido.'
  if (c.limitOn && !(c.limitMax >= 1)) e.limitMax = 'O limite mínimo é 1 tentativa.'
  if (c.seed === 42) w.push('Seed 42 já foi usada nesta sessão: a execução será idêntica se a configuração não mudar.')
  if (c.atkBudget > c.acqBudget) w.push('O orçamento de ataque é maior que o da plataforma.')
  if (c.legit === 0) w.push('Coorte legítima igual a 0: não haverá falsos positivos para medir.')
  return { errors: e, warnings: w }
}

export interface Run {
  status: 'idle' | 'running' | 'paused' | 'done'
  done: number; tick: number; total: number; id: string; hash: string; label: string; step: boolean; pauseReq: boolean
  defense: Cfg['defense']; seed: number; elapsed: number; speed: number; mode: 'visual' | 'brute' | 'manual'; stage: number
}

export interface Ctx {
  view: View; cfg: Cfg; setCfg: (c: Cfg) => void; run: Run; startRun: (step: boolean, mode?: 'visual' | 'brute' | 'manual') => void
  pauseRun: () => void; resumeRun: () => void; stopRun: () => void
  contests: Contest[]; setContests: (c: Contest[]) => void
  toast: (m: string) => void; goTab: (t: number) => void; round: number; setRound: (r: number) => void
  keyOk: boolean; setSpeed: (ms: number) => void
  stepManual: (a: 'next' | 'prev' | 'attempt' | 'round') => void; autoFinish: () => void
}
export const AppCtx = createContext<Ctx>(null as unknown as Ctx)
export const useApp = () => useContext(AppCtx)
