import { DEMO_RUN_ID, INITIAL_CONTESTS, POLICIES, ROUNDS } from './demo'
import { alertsOf, attemptsOf, eventsOf, finalAlert, totals } from './derive'
import type { Alert, Attempt, Contest, Ev, Policy, Round } from './types'

/**
 * Fonte de dados da interface.
 *
 * `createDemoSource` é a implementação atual: dados sintéticos e determinísticos
 * a partir da seed. Quando o simulador Python expuser a execução, basta criar um
 * `createHttpSource(baseUrl)` que implemente esta interface e trocar a criação no
 * `AppProvider`. Nenhuma tela precisa saber de onde o dado veio.
 */
export interface SimulatorSource {
  kind: 'demo' | 'api'
  runId: string
  seed: number
  rounds: Round[]
  policies: Record<string, Policy>
  initialContests: Contest[]
  attemptsOf: (round: Round) => Attempt[]
  eventsOf: (round: Round) => Ev[]
  alertsOf: (round: Round) => Alert[]
  totals: (count?: number) => ReturnType<typeof totals>
  finalAlert: () => Alert
}

export const createDemoSource = (seed = 42): SimulatorSource => ({
  kind: 'demo',
  runId: DEMO_RUN_ID,
  seed,
  rounds: ROUNDS,
  policies: POLICIES,
  initialContests: INITIAL_CONTESTS,
  attemptsOf: (round) => attemptsOf(round, seed),
  eventsOf: (round) => eventsOf(round, seed),
  alertsOf: (round) => alertsOf(round, ROUNDS),
  totals: (count) => totals(ROUNDS, count),
  finalAlert,
})
