import { useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Clock, Crosshair, HelpCircle, Loader2, RotateCcw, Shield, Smartphone, XCircle } from 'lucide-react'
import { brl, dec, type Attempt, type Round } from '../data'
import type { Cfg } from '../state'
import { Hidden, Panel, Pill, ResultPill, cx } from '../ui'

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

function Field({ label, value, show, active }: { label: string; value: string; show: boolean; active?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className={cx('num flex h-8 items-center rounded-lg border px-2.5 text-xs', active ? 'border-accent bg-[#fff8f5]' : 'border-line bg-white')}>
        {show ? value : <span className="text-[#c4c9d2]">—</span>}
        {active && show && <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-ink" />}
      </div>
    </div>
  )
}

function Phone({ a, rd, stage, cfg }: { a: Attempt; rd: Round; stage: number; cfg: Cfg }) {
  const strict = rd.defense !== 'B1'
  const accepted = a.result === 'accepted'
  return (
    <div className="mx-auto w-[270px] overflow-hidden rounded-[22px] border-2 border-[#d0d5dd] bg-white shadow-sm">
      <div className="flex items-center justify-between bg-accent px-4 py-2.5 text-white">
        <span className="text-sm font-semibold">PedeJá</span>
        <span className="text-[10px] opacity-90">{STEPS[stage]}</span>
      </div>
      <div className="flex h-[300px] flex-col gap-2.5 p-4">
        {stage === 0 && (
          <>
            <p className="text-[15px] font-semibold">Criar conta</p>
            <p className="text-[11px] text-muted">Ganhe R$ {cfg.discount} no primeiro pedido acima de R$ {cfg.minOrder}.</p>
            <Field label="E-mail" value={a.email} show active />
            <Field label="Senha" value="••••••••" show />
            <div className="mt-auto rounded-lg bg-accent py-2 text-center text-xs font-semibold text-white ring-2 ring-accent/30">Criar conta</div>
          </>
        )}
        {stage === 1 && (
          strict ? (
            <>
              <p className="text-[15px] font-semibold">Verifique sua identidade</p>
              <Field label="Telefone (SMS)" value={a.phone} show active />
              <Field label="CPF" value={a.cpf} show />
              <Field label="Dispositivo" value={a.device} show />
              <p className="mt-auto flex items-center gap-1 text-[11px] text-muted"><Check size={12} className="text-accepted" />Código SMS confirmado</p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold">Confirme seu e-mail</p>
              <p className="text-xs text-muted">Enviamos um link para <span className="num">{a.email}</span>.</p>
              <p className="mt-auto flex items-center gap-1 text-[11px] text-muted"><Check size={12} className="text-accepted" />E-mail confirmado (verificação leve)</p>
            </>
          )
        )}
        {stage >= 2 && (
          <>
            <p className="text-[15px] font-semibold">Checkout</p>
            <div className="rounded-lg border border-line p-2.5 text-xs">
              <div className="flex justify-between"><span>Pedido</span><span className="num">{brl(a.order, 2)}</span></div>
              <div className="mt-1 flex justify-between text-muted"><span>Endereço</span><span className="num">{a.address}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="num flex h-8 flex-1 items-center rounded-lg border border-dashed border-accent bg-[#fff8f5] px-2.5 text-xs font-semibold">BEMVINDO</div>
              <span className={cx('rounded-lg px-2.5 py-2 text-xs font-semibold text-white', stage === 2 ? 'bg-accent ring-2 ring-accent/30' : 'bg-[#98a2b3]')}>Aplicar</span>
            </div>
            {stage === 3 && <p className="flex items-center gap-1.5 text-xs text-muted"><Loader2 size={13} className="animate-spin" />Aplicando cupom…</p>}
            {stage === 4 && (
              <div className={cx('mt-auto rounded-lg border p-2.5 text-xs', accepted ? 'border-[#abefc6] bg-[#ecfdf3] text-accepted' : a.result === 'verification_required' ? 'border-[#fedf89] bg-warning-bg text-verification' : a.result === 'rate_limited' ? 'border-[#c7d7fe] bg-[#eef4ff] text-limited' : 'border-[#fecdca] bg-danger-bg text-refused')}>
                <p className="flex items-center gap-1.5 font-semibold">
                  {accepted ? <CheckCircle2 size={14} /> : a.result === 'verification_required' ? <HelpCircle size={14} /> : a.result === 'rate_limited' ? <Clock size={14} /> : <XCircle size={14} />}
                  {accepted ? `Cupom aplicado: −${brl(cfg.discount, 2)}` : a.result === 'verification_required' ? 'Verificação necessária' : a.result === 'rate_limited' ? 'Aguarde para tentar de novo' : 'Cupom não aplicado'}
                </p>
                <p className="mt-1 text-ink/80">{accepted ? `Total ${brl(a.order - cfg.discount, 2)}` : a.result === 'verification_required' ? `Confirme seu ${a.verification === 'email' ? 'e-mail' : 'telefone por SMS'} para continuar.` : a.result === 'rate_limited' ? 'Muitas tentativas neste dispositivo.' : a.message}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Engine({ a, rd, stage }: { a: Attempt; rd: Round; stage: number }) {
  const strict = rd.defense !== 'B1'
  const sig: [string, string, number][] = [
    ['e-mail', a.email, 0], ['telefone', strict ? a.phone : '— (não coletado)', 1], ['CPF', strict ? a.cpf : '— (não coletado)', 1],
    ['dispositivo', strict ? a.device : '— (não coletado)', 1], ['endereço', a.address, 2],
  ]
  const active = (from: number) => rd.r === 1 ? false : from === 3 ? rd.r >= 3 : true
  return (
    <div className="space-y-3 text-[13px]">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Sinais recebidos</p>
        <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
          {sig.map(([k, v, s]) => (
            <li key={k} className="flex justify-between px-2.5 py-1.5 text-xs"><span className="text-muted">{k}</span><span className="num">{stage >= s ? v : '…'}</span></li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Regras ({rd.policy})</p>
        <ul className="mt-1 space-y-1">
          {RULES.map((r) => {
            const on = active(r.from)
            const fired = stage >= 3 && on && a.reason === r.id
            return (
              <li key={r.id} className={cx('flex items-center gap-2 rounded px-2 py-1 text-xs', fired ? 'bg-danger-bg font-medium text-refused' : on ? '' : 'text-[#98a2b3]')}>
                {fired ? <AlertTriangle size={12} /> : stage >= 3 && on ? <Check size={12} className="text-accepted" /> : <span className="h-3 w-3 rounded-full border border-line" />}
                <span className="flex-1">{r.label}</span>
                {!on && <span className="text-[10px]">inativa</span>}
                {fired && a.shared > 0 && <span className="num text-[10px]">{a.shared} contas</span>}
              </li>
            )
          })}
        </ul>
      </div>
      <div className={cx('rounded-lg border p-2.5', stage >= 4 ? 'border-engine/40 bg-[#f0fafa]' : 'border-line')}>
        {stage < 4 ? <p className="text-xs text-muted">{stage === 3 ? 'Calculando decisão…' : 'Aguardando checkout'}</p> : (
          <>
            <div className="flex items-center justify-between"><span className="text-xs text-muted">Decisão</span><ResultPill r={a.result} /></div>
            <div className="mt-2 flex items-center gap-2 text-xs"><span className="text-muted">score</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded bg-[#eaecf0]"><div className="h-full bg-engine" style={{ width: `${a.score * 100}%` }} /></div><span className="num">{dec(a.score)}</span></div>
            <p className="mt-1.5 text-xs text-muted">Motivo interno: <span className="num font-medium text-ink">{a.reason}</span></p>
          </>
        )}
      </div>
    </div>
  )
}

function Bot({ a, rd, stage, view }: { a: Attempt; rd: Round; stage: number; view: string }) {
  const detailed = rd.r < 3 && a.result !== 'accepted'
  const learned = stage < 4 ? 'Aguardando resposta do checkout…'
    : a.result === 'accepted' ? 'Resgate concluído. A tática funciona; mantém o volume.'
    : a.result === 'rate_limited' ? 'Limite atingido neste dispositivo. Troca de sessão e de dispositivo na próxima conta.'
    : detailed ? `A mensagem revela o motivo (“${a.message}”). Troca só esse sinal na próxima tentativa.`
    : 'Mensagem genérica: só sabe que foi recusado. Precisa de mais tentativas para inferir a regra.'
  return (
    <div className="space-y-3 text-[13px]">
      {view === 'eval' && <div className="flex flex-wrap gap-1.5"><Pill tone={a.label === 'fraude' ? 'refused' : 'accepted'}>{a.label === 'fraude' ? 'conta suspeita' : 'cliente legítimo'}</Pill><Pill mono>{a.person}</Pill></div>}
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between"><dt className="text-muted">Tática</dt><dd className="text-right font-medium">{a.label === 'legítima' && view === 'eval' ? 'Cliente real (A1)' : a.tactic}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Custo desta tentativa</dt><dd className="num font-medium">{a.label === 'legítima' && view === 'eval' ? 'R$ 0,00' : brl(a.cost, 2)}</dd></div>
      </dl>
      <div className="rounded-lg border border-bot/30 bg-[#f9f7ff] p-2.5 text-xs">
        <p className="mb-1 font-semibold text-bot">O que o bot observa e decide</p>
        <p>{learned}</p>
      </div>
    </div>
  )
}

function narration(a: Attempt, rd: Round, stage: number, view: string, cfg: Cfg): string {
  const strict = rd.defense !== 'B1'
  const who = view === 'eval' && a.label === 'legítima' ? 'Um cliente legítimo' : view === 'engine' ? 'Uma conta nova' : 'O bot'
  if (stage === 0) return `Passo 1 · Cadastro (PE1). ${who} abre o app e cria a conta ${a.account} com o e-mail ${a.email}. ${view === 'eval' && a.label === 'fraude' ? `Tática em uso: ${a.tactic}.` : ''}`
  if (stage === 1) return strict ? `Passo 2 · Verificação (B2). O PedeJá exige telefone por SMS, CPF e identifica o dispositivo (${a.device}). Cada sinal apresentado chega ao motor.` : 'Passo 2 · Verificação leve (B1). Só o e-mail é confirmado; o motor não recebe telefone, CPF nem dispositivo.'
  if (stage === 2) return `Passo 3 · Checkout (PE2). Pedido de ${brl(a.order, 2)} (acima de R$ ${cfg.minOrder}); o cupom BEMVINDO é aplicado. A regra confere a conta, não a pessoa.`
  if (stage === 3) return rd.r === 1 ? 'Passo 4 · Análise. O motor em B1 só confere se o e-mail é novo; nenhuma outra regra está ativa.' : 'Passo 4 · Análise. O motor cruza os sinais com o histórico (dispositivo, CPF, telefone, endereço) e aplica as regras da política vigente.'
  const out = a.result === 'accepted' ? 'Cupom aceito: o resgate é concluído e R$ 20 saem do orçamento.' : a.result === 'verification_required' ? 'O checkout pede uma verificação extra.' : a.result === 'rate_limited' ? 'O limite de tentativas foi atingido e o cupom fica indisponível por um tempo.' : 'Cupom recusado.'
  return `Passo 5 · Resposta (PE3). ${out} ${a.result !== 'accepted' ? `Mensagem pública: “${a.message}”. ` : ''}${view !== 'bot' ? `Motivo interno registrado: ${a.reason}.` : ''}`
}

export default function LiveSim({ rd, attempts, idx, live, tickMs, view, cfg, onPick, stage: stageProp }: {
  rd: Round; attempts: Attempt[]; idx: number; live: boolean; tickMs: number; view: string; cfg: Cfg; onPick?: () => void; stage?: number
}) {
  const controlled = stageProp !== undefined
  const [pinned, setPinned] = useState<number | null>(null)
  const [replay, setReplay] = useState(0)
  const cur = pinned ?? idx
  const a = attempts[Math.min(cur, attempts.length - 1)]
  const animate = (live && pinned === null) || replay > 0
  const [stageS, setStage] = useState(4)
  const stage = controlled ? stageProp! : stageS

  useEffect(() => { if (live) setPinned(null) }, [live])
  useEffect(() => {
    if (!a || controlled) return
    if (!animate) { setStage(4); return }
    setStage(0)
    const step = Math.max(110, tickMs / 5)
    const t = setInterval(() => setStage((s) => (s >= 4 ? 4 : s + 1)), step)
    return () => clearInterval(t)
  }, [a?.id, animate, replay, tickMs, controlled])

  if (!a) return null
  const recent = attempts.slice(Math.max(0, idx - 5), idx + 1).reverse()
  return (
    <Panel title={`Simulação ao vivo · rodada ${rd.r}`} sub={`Tentativa ${cur + 1} de ${attempts.length} · conta ${a.account}`}
      right={controlled ? undefined : <button onClick={() => { setPinned(cur); setReplay((r) => r + 1) }} className="flex items-center gap-1 text-xs font-medium text-limited underline"><RotateCcw size={12} />Reproduzir esta tentativa</button>}>
      {controlled && <p className="mb-3 rounded-lg border border-accent/30 bg-[#fff8f5] px-3 py-2 text-[13px]" aria-live="polite">{narration(a, rd, stage, view, cfg)}</p>}
      <div className="mb-4 flex items-center gap-1 text-[11px]">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className={cx('rounded-full px-2 py-0.5 font-medium', i === stage ? 'bg-accent text-white' : i < stage ? 'bg-[#ecfdf3] text-accepted' : 'bg-[#f2f4f7] text-muted')}>{i + 1}. {s}</span>
            {i < 4 && <span className="text-[#c4c9d2]">›</span>}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-[290px_1fr_1fr] gap-6">
        <div>
          <p className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><Smartphone size={13} />App do cliente (PE1 · PE2 · PE3)</p>
          <Phone a={a} rd={rd} stage={stage} cfg={cfg} />
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-engine"><Shield size={13} />Motor antifraude</p>
          {view === 'bot' ? <Hidden what="Análise do motor" /> : <Engine a={a} rd={rd} stage={stage} />}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-bot"><Crosshair size={13} />{view === 'eval' ? 'Quem está tentando' : 'Bot'}</p>
          {view === 'engine' ? <Hidden what="Tática e custo do bot" /> : <Bot a={a} rd={rd} stage={stage} view={view} />}
        </div>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Últimas tentativas</p>
        <ul className="flex flex-wrap gap-2">
          {recent.map((r, i) => (
            <li key={r.id}>
              <button disabled={controlled} onClick={() => { setPinned(attempts.indexOf(r)); setReplay((x) => x + 1); onPick?.() }} className={cx('flex items-center gap-2 rounded-lg border px-2 py-1 text-xs hover:bg-[#f9fafb]', i === 0 ? 'border-accent' : 'border-line')}>
                <span className="num">{r.account}</span><ResultPill r={r.result} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}
