import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Crosshair,
  HelpCircle,
  Loader2,
  RotateCcw,
  Shield,
  Smartphone,
  XCircle,
} from 'lucide-react'
import type { Cfg } from '../app/AppContext'
import { brl, dec } from '../data/format'
import type { Attempt, Round } from '../data/types'
import { Hidden, Panel, Pill, ResultPill, cx } from '../components/ui'

const STEPS = ['Cadastro', 'Verificação', 'Checkout', 'Análise', 'Resposta']

const RULES: { id: string; label: string; from: number }[] = [
  { id: 'shared_device', label: 'Dispositivo já visto em outra conta', from: 2 },
  { id: 'shared_cpf', label: 'CPF já usado', from: 2 },
  { id: 'shared_phone', label: 'Telefone já usado', from: 2 },
  { id: 'shared_address', label: 'Endereço compartilhado', from: 2 },
  { id: 'virtual_phone_range', label: 'Faixa de telefone virtual', from: 2 },
  { id: 'probing_sequence', label: 'Sequência de sondagem (1 campo muda)', from: 3 },
  { id: 'attempt_limit_exceeded', label: 'Limite de tentativas (3 / 24 h)', from: 3 },
]

function FormField({
  label,
  value,
  show = true,
  active,
}: {
  label: string
  value: string
  show?: boolean
  active?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <div
        className={cx(
          'num mt-0.5 flex h-8 items-center rounded-md border px-2 text-[11.5px]',
          active ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
        )}
      >
        {show ? value : <span className="text-[#b9beb8]">—</span>}
        {active && show && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-ink" />}
      </div>
    </div>
  )
}

function Phone({ attempt, round, stage, cfg }: { attempt: Attempt; round: Round; stage: number; cfg: Cfg }) {
  const strict = round.defense !== 'B1'
  const accepted = attempt.result === 'accepted'

  return (
    <div className="mx-auto w-[264px] overflow-hidden rounded-[20px] border border-[#c8cec7] bg-surface shadow-[0_1px_2px_rgba(22,26,24,0.06)]">
      <div className="flex items-center justify-between bg-accent px-4 py-2.5 text-white">
        <span className="text-[13px] font-semibold">PedeJá</span>
        <span className="text-[10px] opacity-90">{STEPS[stage]}</span>
      </div>

      <div className="flex min-h-[304px] flex-col gap-2.5 p-3.5">
        {stage === 0 && (
          <>
            <p className="text-[14px] font-semibold">Criar conta</p>
            <p className="text-[11px] leading-4 text-muted">
              Ganhe R$ {cfg.discount} no primeiro pedido acima de R$ {cfg.minOrder}.
            </p>
            <FormField label="E-mail" value={attempt.email} active />
            <FormField label="Senha" value="••••••••" />
            <div className="mt-auto flex h-8 items-center justify-center rounded-md bg-accent text-[11.5px] font-semibold text-white ring-2 ring-accent/20">
              Criar conta
            </div>
          </>
        )}

        {stage === 1 &&
          (strict ? (
            <>
              <p className="text-[14px] font-semibold">Verifique sua identidade</p>
              <FormField label="Telefone (SMS)" value={attempt.phone} active />
              <FormField label="CPF" value={attempt.cpf} />
              <FormField label="Dispositivo" value={attempt.device} />
              <p className="mt-auto flex items-center gap-1 text-[11px] text-muted">
                <Check size={12} className="text-accepted" />
                Código SMS confirmado
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold">Confirme seu e-mail</p>
              <p className="text-[11px] leading-4 text-muted">
                Enviamos um link para <span className="num">{attempt.email}</span>.
              </p>
              <p className="mt-auto flex items-center gap-1 text-[11px] text-muted">
                <Check size={12} className="text-accepted" />
                E-mail confirmado (verificação leve)
              </p>
            </>
          ))}

        {stage >= 2 && (
          <>
            <p className="text-[14px] font-semibold">Checkout</p>
            <div className="rounded-md border border-line p-2 text-[11px]">
              <div className="flex justify-between">
                <span>Pedido</span>
                <span className="num">{brl(attempt.order, 2)}</span>
              </div>
              <div className="mt-1 flex justify-between text-muted">
                <span>Endereço</span>
                <span className="num">{attempt.address}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="num flex h-8 flex-1 items-center rounded-md border border-dashed border-accent bg-accent-soft px-2 text-[11px] font-semibold">
                BEMVINDO
              </div>
              <span
                className={cx(
                  'rounded-md px-2.5 py-[7px] text-[11px] font-semibold text-white',
                  stage === 2 ? 'bg-accent ring-2 ring-accent/20' : 'bg-[#98a2b3]',
                )}
              >
                Aplicar
              </span>
            </div>
            {stage === 3 && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <Loader2 size={12} className="animate-spin" />
                Aplicando cupom…
              </p>
            )}
            {stage === 4 && (
              <div
                className={cx(
                  'mt-auto rounded-md border p-2.5 text-[11px]',
                  accepted
                    ? 'border-[#b7dcc4] bg-accepted-soft text-accepted'
                    : attempt.result === 'verification_required'
                      ? 'border-[#ecd9a8] bg-verification-soft text-verification'
                      : attempt.result === 'rate_limited'
                        ? 'border-[#c6c9e8] bg-limited-soft text-limited'
                        : 'border-[#ecc3bd] bg-refused-soft text-refused',
                )}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  {accepted ? (
                    <CheckCircle2 size={13} />
                  ) : attempt.result === 'verification_required' ? (
                    <HelpCircle size={13} />
                  ) : attempt.result === 'rate_limited' ? (
                    <Clock size={13} />
                  ) : (
                    <XCircle size={13} />
                  )}
                  {accepted
                    ? `Cupom aplicado: −${brl(cfg.discount, 2)}`
                    : attempt.result === 'verification_required'
                      ? 'Verificação necessária'
                      : attempt.result === 'rate_limited'
                        ? 'Aguarde para tentar de novo'
                        : 'Cupom não aplicado'}
                </p>
                <p className="mt-1 leading-4 text-ink/80">
                  {accepted
                    ? `Total ${brl(attempt.order - cfg.discount, 2)}`
                    : attempt.result === 'verification_required'
                      ? `Confirme seu ${attempt.verification === 'email' ? 'e-mail' : 'telefone por SMS'} para continuar.`
                      : attempt.result === 'rate_limited'
                        ? 'Muitas tentativas neste dispositivo.'
                        : attempt.message}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EnginePanel({ attempt, round, stage }: { attempt: Attempt; round: Round; stage: number }) {
  const strict = round.defense !== 'B1'
  const signals: [string, string, number][] = [
    ['e-mail', attempt.email, 0],
    ['telefone', strict ? attempt.phone : '— (não coletado)', 1],
    ['CPF', strict ? attempt.cpf : '— (não coletado)', 1],
    ['dispositivo', strict ? attempt.device : '— (não coletado)', 1],
    ['endereço', attempt.address, 2],
  ]
  const active = (from: number) => (round.r === 1 ? false : from === 3 ? round.r >= 3 : true)

  return (
    <div className="space-y-3 text-[12px]">
      <div>
        <p className="rule-label">Sinais recebidos</p>
        <ul className="mt-1 divide-y divide-line rounded-md border border-line">
          {signals.map(([key, value, from]) => (
            <li key={key} className="flex justify-between px-2.5 py-1.5 text-[11px]">
              <span className="text-muted">{key}</span>
              <span className="num">{stage >= from ? value : '…'}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="rule-label">Regras ({round.policy})</p>
        <ul className="mt-1 space-y-1">
          {RULES.map((rule) => {
            const on = active(rule.from)
            const fired = stage >= 3 && on && attempt.reason === rule.id
            return (
              <li
                key={rule.id}
                className={cx(
                  'flex items-center gap-2 rounded px-1.5 py-1 text-[11px]',
                  fired ? 'bg-refused-soft font-medium text-refused' : on ? '' : 'text-faint',
                )}
              >
                {fired ? (
                  <AlertTriangle size={11} />
                ) : stage >= 3 && on ? (
                  <Check size={11} className="text-accepted" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
                )}
                <span className="flex-1">{rule.label}</span>
                {!on && <span className="text-[10px]">inativa</span>}
                {fired && attempt.shared > 0 && <span className="num text-[10px]">{attempt.shared} contas</span>}
              </li>
            )
          })}
        </ul>
      </div>

      <div className={cx('rounded-md border p-2.5', stage >= 4 ? 'border-[#b9dcd6] bg-engine-soft' : 'border-line')}>
        {stage < 4 ? (
          <p className="text-[11px] text-muted">{stage === 3 ? 'Calculando decisão…' : 'Aguardando checkout'}</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">Decisão</span>
              <ResultPill result={attempt.result} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span className="text-muted">score</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#e4e7e1]">
                <div className="h-full bg-engine" style={{ width: `${attempt.score * 100}%` }} />
              </div>
              <span className="num">{dec(attempt.score)}</span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              Motivo interno: <span className="num font-medium text-ink">{attempt.reason}</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function BotPanel({ attempt, round, stage, view }: { attempt: Attempt; round: Round; stage: number; view: string }) {
  const detailed = round.r < 3 && attempt.result !== 'accepted'
  const learned =
    stage < 4
      ? 'Aguardando resposta do checkout…'
      : attempt.result === 'accepted'
        ? 'Resgate concluído. A tática funciona; mantém o volume.'
        : attempt.result === 'rate_limited'
          ? 'Limite atingido neste dispositivo. Troca de sessão e de dispositivo na próxima conta.'
          : detailed
            ? `A mensagem revela o motivo (“${attempt.message}”). Troca só esse sinal na próxima tentativa.`
            : 'Mensagem genérica: só sabe que foi recusado. Precisa de mais tentativas para inferir a regra.'

  return (
    <div className="space-y-3 text-[12px]">
      {view === 'eval' && (
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={attempt.label === 'fraude' ? 'refused' : 'accepted'}>
            {attempt.label === 'fraude' ? 'conta suspeita' : 'cliente legítimo'}
          </Pill>
          <Pill mono>{attempt.person}</Pill>
        </div>
      )}

      <dl className="space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Tática</dt>
          <dd className="text-right font-medium">
            {attempt.label === 'legítima' && view === 'eval' ? 'Cliente real (A1)' : attempt.tactic}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Custo desta tentativa</dt>
          <dd className="num font-medium">
            {attempt.label === 'legítima' && view === 'eval' ? 'R$ 0,00' : brl(attempt.cost, 2)}
          </dd>
        </div>
      </dl>

      <div className="rounded-md border border-[#d3caf7] bg-bot-soft p-2.5 text-[11px]">
        <p className="mb-1 font-semibold text-bot">O que o bot observa e decide</p>
        <p>{learned}</p>
      </div>
    </div>
  )
}

function narration(attempt: Attempt, round: Round, stage: number, view: string, cfg: Cfg) {
  const strict = round.defense !== 'B1'
  const who =
    view === 'eval' && attempt.label === 'legítima' ? 'Um cliente legítimo' : view === 'engine' ? 'Uma conta nova' : 'O bot'

  if (stage === 0) {
    return `Passo 1 · Cadastro (PE1). ${who} abre o app e cria a conta ${attempt.account} com o e-mail ${attempt.email}. ${
      view === 'eval' && attempt.label === 'fraude' ? `Tática em uso: ${attempt.tactic}.` : ''
    }`
  }
  if (stage === 1) {
    return strict
      ? `Passo 2 · Verificação (B2). O PedeJá exige telefone por SMS, CPF e identifica o dispositivo (${attempt.device}). Cada sinal apresentado chega ao motor.`
      : 'Passo 2 · Verificação leve (B1). Só o e-mail é confirmado; o motor não recebe telefone, CPF nem dispositivo.'
  }
  if (stage === 2) {
    return `Passo 3 · Checkout (PE2). Pedido de ${brl(attempt.order, 2)} (acima de R$ ${cfg.minOrder}); o cupom BEMVINDO é aplicado. A regra confere a conta, não a pessoa.`
  }
  if (stage === 3) {
    return round.r === 1
      ? 'Passo 4 · Análise. O motor em B1 só confere se o e-mail é novo; nenhuma outra regra está ativa.'
      : 'Passo 4 · Análise. O motor cruza os sinais com o histórico (dispositivo, CPF, telefone, endereço) e aplica as regras da política vigente.'
  }

  const outcome =
    attempt.result === 'accepted'
      ? 'Cupom aceito: o resgate é concluído e R$ 20 saem do orçamento.'
      : attempt.result === 'verification_required'
        ? 'O checkout pede uma verificação extra.'
        : attempt.result === 'rate_limited'
          ? 'O limite de tentativas foi atingido e o cupom fica indisponível por um tempo.'
          : 'Cupom recusado.'
  return `Passo 5 · Resposta (PE3). ${outcome} ${
    attempt.result !== 'accepted' ? `Mensagem pública: “${attempt.message}”. ` : ''
  }${view !== 'bot' ? `Motivo interno registrado: ${attempt.reason}.` : ''}`
}

export default function LiveSim({
  round,
  attempts,
  index,
  live,
  tickMs,
  view,
  cfg,
  onPick,
  stage: controlledStage,
}: {
  round: Round
  attempts: Attempt[]
  index: number
  live: boolean
  tickMs: number
  view: string
  cfg: Cfg
  onPick?: () => void
  stage?: number
}) {
  const controlled = controlledStage !== undefined
  const [pinned, setPinned] = useState<number | null>(null)
  const [replay, setReplay] = useState(0)
  const [internalStage, setInternalStage] = useState(4)
  const currentIndex = pinned ?? index
  const attempt = attempts[Math.min(currentIndex, attempts.length - 1)]
  const animate = (live && pinned === null) || replay > 0
  const stage = controlled ? controlledStage : internalStage

  useEffect(() => {
    if (live) setPinned(null)
  }, [live])

  useEffect(() => {
    if (!attempt || controlled) return
    if (!animate) {
      setInternalStage(4)
      return
    }
    setInternalStage(0)
    const step = Math.max(110, tickMs / 5)
    const timer = window.setInterval(() => setInternalStage((value) => (value >= 4 ? 4 : value + 1)), step)
    return () => window.clearInterval(timer)
  }, [attempt?.id, animate, replay, tickMs, controlled])

  if (!attempt) return null

  const recent = attempts.slice(Math.max(0, index - 5), index + 1).reverse()

  return (
    <Panel
      title={`Simulação ao vivo · rodada ${round.r}`}
      sub={`Tentativa ${currentIndex + 1} de ${attempts.length} · conta ${attempt.account}`}
      right={
        controlled ? undefined : (
          <button
            type="button"
            onClick={() => {
              setPinned(currentIndex)
              setReplay((value) => value + 1)
            }}
            className="flex items-center gap-1 text-[11.5px] font-medium text-limited underline decoration-limited/40 underline-offset-2 hover:decoration-limited"
          >
            <RotateCcw size={11} />
            Reproduzir esta tentativa
          </button>
        )
      }
    >
      {controlled && (
        <p
          className="mb-3 rounded-md border border-[#f0c4b3] bg-accent-soft px-3 py-2 text-[12px] leading-5"
          aria-live="polite"
        >
          {narration(attempt, round, stage, view, cfg)}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-1 text-[10.5px]">
        {STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span
              className={cx(
                'rounded-full px-2 py-[3px] font-medium',
                i === stage
                  ? 'bg-accent text-white'
                  : i < stage
                    ? 'bg-accepted-soft text-accepted'
                    : 'bg-[#eceee9] text-muted',
              )}
            >
              {i + 1}. {step}
            </span>
            {i < STEPS.length - 1 && <span className="text-[#b9beb8]">›</span>}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[264px_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-muted">
            <Smartphone size={12} />
            App do cliente (PE1 · PE2 · PE3)
          </p>
          <Phone attempt={attempt} round={round} stage={stage} cfg={cfg} />
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-engine">
            <Shield size={12} />
            Motor antifraude
          </p>
          {view === 'bot' ? <Hidden what="Análise do motor" /> : <EnginePanel attempt={attempt} round={round} stage={stage} />}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold text-bot">
            <Crosshair size={12} />
            {view === 'eval' ? 'Quem está tentando' : 'Bot'}
          </p>
          {view === 'engine' ? (
            <Hidden what="Tática e custo do bot" />
          ) : (
            <BotPanel attempt={attempt} round={round} stage={stage} view={view} />
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <p className="rule-label mb-1.5">Últimas tentativas</p>
        <ul className="flex flex-wrap gap-1.5">
          {recent.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={controlled}
                onClick={() => {
                  setPinned(attempts.indexOf(item))
                  setReplay((value) => value + 1)
                  onPick?.()
                }}
                className={cx(
                  'flex items-center gap-2 rounded-md border px-2 py-1 text-[10.5px] hover:bg-[#f7f8f4] disabled:cursor-default',
                  i === 0 ? 'border-accent' : 'border-line',
                )}
              >
                <span className="num">{item.account}</span>
                <ResultPill result={item.result} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
