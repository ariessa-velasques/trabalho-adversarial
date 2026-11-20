import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Lock,
  Play,
  RotateCcw,
  Save,
  Upload,
  XCircle,
} from 'lucide-react'
import { PRESETS, defaultCfg, hashCfg, useApp, validate, type Cfg } from '../app/AppContext'
import { brl } from '../data/format'
import { download } from '../lib/download'
import { Banner, Btn, Field, NumInput, PageHeader, Panel, Segmented, Switch, cx, inputCls } from '../components/ui'

const PRESET_CARDS: {
  id: Cfg['preset']
  name: string
  rounds: number
  mode: string
  defense: string
  time: string
  description: string
}[] = [
  {
    id: 'demo',
    name: 'Demonstração',
    rounds: 6,
    mode: 'adaptativo',
    defense: 'redesenho',
    time: '~13 s',
    description: 'Vídeo e apresentação: o ciclo completo AM1 → AM3 → recuo.',
  },
  {
    id: 'compare',
    name: 'Comparar defesas',
    rounds: 3,
    mode: 'determinístico',
    defense: 'B1 · B2 · redesenho',
    time: '~8 s',
    description: 'Mesma seed nas três defesas para a tabela comparativa.',
  },
  {
    id: 'quick',
    name: 'Teste rápido',
    rounds: 3,
    mode: 'determinístico',
    defense: 'redesenho',
    time: '~6 s',
    description: 'Iteração e teste de configuração.',
  },
]

function Section({
  n,
  title,
  summary,
  open,
  onToggle,
  invalid,
  children,
}: {
  n: number
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <div className="panel overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-[5px] border border-line bg-paper text-[11px] font-semibold text-muted">
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{title}</span>
          <span className="mt-0.5 block truncate text-[11.5px] text-muted">{summary}</span>
        </span>
        {invalid ? (
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-refused">
            <XCircle size={13} />
            corrigir
          </span>
        ) : (
          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-medium text-accepted sm:flex">
            <CheckCircle2 size={13} />
            válido
          </span>
        )}
        <ChevronDown size={15} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  )
}

export default function Config() {
  const { cfg, setCfg, run, goTab, toast } = useApp()
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true })
  const [checked, setChecked] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const validation = validate(cfg)
  const errorCount = Object.keys(validation.errors).length
  const hash = hashCfg(cfg)
  const set = <K extends keyof Cfg>(key: K, value: Cfg[K]) => setCfg({ ...cfg, [key]: value })
  const llmBlocked = cfg.runMode === 'adversarial_validation'
  const dirty =
    cfg.label !== defaultCfg.label || cfg.notes !== defaultCfg.notes || hashCfg(cfg) !== hashCfg(defaultCfg)
  const stale = run.status !== 'idle' && run.hash !== hash
  const toggle = (n: number) => setOpen({ ...open, [n]: !open[n] })
  const E = validation.errors
  const defenseName = { B1: 'B1 · verificação leve', B2: 'B2 · verificação rígida', redesign: 'redesenho' }[cfg.defense]
  const estimatedAccounts = cfg.rounds === 6 ? '~1.000' : `~${cfg.rounds * 160}`
  const activeControls = [cfg.generic, cfg.limitOn, cfg.probing, cfg.contestation].filter(Boolean).length

  const reset = () => {
    setCfg(defaultCfg)
    setConfirmReset(false)
    toast('Padrões restaurados (preset Demonstração)')
  }

  const loadJson = (file?: File) => {
    if (!file) return
    file
      .text()
      .then((text) => {
        try {
          const parsed = JSON.parse(text) as Partial<Cfg>
          const next = { ...cfg }
          const record = next as Record<string, unknown>
          for (const key of Object.keys(defaultCfg) as (keyof Cfg)[]) {
            if (key in parsed) record[key] = parsed[key]
          }
          setCfg(next)
          toast('JSON carregado e validado')
        } catch {
          toast('JSON inválido: verifique o arquivo')
        }
      })
      .catch(() => toast('Não foi possível ler o arquivo'))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configure o experimento"
        description="Escolha um preset ou ajuste os parâmetros. A mesma seed com a mesma configuração gera a mesma execução."
        actions={
          <>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium hover:bg-[#f0f1ed] focus-within:outline-2">
              <Upload size={13} />
              Carregar JSON
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(event) => loadJson(event.target.files?.[0])}
              />
            </label>
            <Btn
              icon={<Save size={13} />}
              onClick={() => {
                download('scenarios.json', JSON.stringify({ config_hash: hash, ...cfg }, null, 2), 'application/json')
                toast('scenarios.json baixado')
              }}
            >
              Salvar JSON
            </Btn>
            <Btn icon={<RotateCcw size={13} />} onClick={() => (dirty ? setConfirmReset(true) : reset())}>
              Restaurar padrões
            </Btn>
          </>
        }
      />

      {confirmReset && (
        <Banner
          kind="warn"
          title="Restaurar padrões?"
          action={
            <div className="flex gap-2">
              <Btn variant="danger" onClick={reset}>
                Restaurar
              </Btn>
              <Btn onClick={() => setConfirmReset(false)}>Cancelar</Btn>
            </div>
          }
        >
          Suas edições serão descartadas e o preset Demonstração volta a valer.
        </Banner>
      )}

      {stale && (
        <Banner kind="info" title="A configuração mudou.">
          A próxima execução usará um novo <span className="num">config_hash</span> ({hash}).
        </Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Presets">
        {PRESET_CARDS.map((preset) => {
          const selected = cfg.preset === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setCfg({ ...cfg, ...PRESETS[preset.id], preset: preset.id })}
              className={cx(
                'relative rounded-[10px] border bg-surface p-4 text-left transition-colors',
                selected ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-line-strong',
              )}
            >
              {selected && (
                <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
                  <Check size={12} />
                </span>
              )}
              <p className="text-[13px] font-semibold">{preset.name}</p>
              <p className="mt-1 text-[12px] text-muted">
                <span className="num font-semibold text-ink">{preset.rounds}</span> rodadas · {preset.mode} ·{' '}
                {preset.defense} · <span className="num">{preset.time}</span>
              </p>
              <p className="mt-1.5 text-[11.5px] leading-4 text-muted">{preset.description}</p>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="space-y-3">
          <Section
            n={1}
            title="Identificação"
            summary={`${cfg.label} · seed ${cfg.seed} · ${cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'}`}
            open={!!open[1]}
            onToggle={() => toggle(1)}
            invalid={Boolean(E.label || E.seed)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da execução (run_label)" error={E.label}>
                <input className={inputCls(!!E.label)} value={cfg.label} onChange={(event) => set('label', event.target.value)} />
              </Field>
              <Field label="Seed mestra (seeds.master)" help="Mesma seed + mesma config = mesma execução." error={E.seed}>
                <div className="flex gap-2">
                  <NumInput value={cfg.seed} onChange={(value) => set('seed', value)} error={!!E.seed} />
                  <Btn onClick={() => set('seed', Math.floor(Math.random() * 9999))}>Sortear</Btn>
                </div>
              </Field>
              <Field label="Rodadas (rounds)" help="Cada rodada equivale a 7 dias simulados.">
                <select className={inputCls()} value={cfg.rounds} onChange={(event) => set('rounds', Number(event.target.value))}>
                  {[3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="Modo de cenário (modes.scenario)"
                help="Adaptativo: só muda se o gatilho disparar. Guiado: força AM1→AM2→AM3 nas rodadas 1–3."
              >
                <Segmented
                  value={cfg.scenario}
                  onChange={(value) => set('scenario', value)}
                  options={[
                    { value: 'adaptive', label: 'Adaptativo' },
                    { value: 'guided', label: 'Guiado' },
                  ]}
                  label="Modo de cenário"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Observações (notes)">
                  <textarea
                    className={cx(inputCls(), 'h-16 resize-y py-1.5')}
                    value={cfg.notes}
                    onChange={(event) => set('notes', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section
            n={2}
            title="Agentes"
            summary={cfg.runMode === 'deterministic' ? 'Determinístico · sem chamadas externas' : `Validação adversarial · ${cfg.provider}`}
            open={!!open[2]}
            onToggle={() => toggle(2)}
          >
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Modo de execução">
              {(
                [
                  ['deterministic', 'Determinístico', 'Padrão. Reproduzível, sem chaves nem rede.'],
                  ['adversarial_validation', 'Validação adversarial (LLM)', 'Opcional. Uma chamada por rodada; exige chave de API.'],
                ] as const
              ).map(([id, title, description]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={cfg.runMode === id}
                  onClick={() => set('runMode', id)}
                  className={cx(
                    'rounded-lg border p-3 text-left',
                    cfg.runMode === id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong',
                  )}
                >
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-4 text-muted">{description}</p>
                </button>
              ))}
            </div>

            <div className={cx('mt-4 grid gap-4 sm:grid-cols-2', cfg.runMode === 'deterministic' && 'opacity-55')}>
              <Field label="Provedor">
                <select
                  disabled={cfg.runMode === 'deterministic'}
                  className={inputCls()}
                  value={cfg.provider}
                  onChange={(event) => set('provider', event.target.value)}
                >
                  <option>anthropic</option>
                  <option>groq</option>
                </select>
              </Field>
              <Field label="Modelo">
                <select
                  disabled={cfg.runMode === 'deterministic'}
                  className={inputCls()}
                  value={cfg.model}
                  onChange={(event) => set('model', event.target.value)}
                >
                  <option>claude-sonnet-4</option>
                  <option>claude-haiku-4</option>
                </select>
              </Field>
              <Field label={`Temperatura: ${cfg.temperature.toLocaleString('pt-BR')}`} help="0 reduz variação; não garante replay bit a bit.">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  disabled={cfg.runMode === 'deterministic'}
                  value={cfg.temperature}
                  onChange={(event) => set('temperature', Number(event.target.value))}
                  className="w-full accent-[#cc4419]"
                />
              </Field>
              <Field label="Chamadas por rodada (max_calls_per_round)" help="Uma chamada por rodada; o executor é determinístico.">
                <NumInput
                  disabled={cfg.runMode === 'deterministic'}
                  value={cfg.maxCalls}
                  onChange={(value) => set('maxCalls', value)}
                />
              </Field>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[12px]">
              <Lock size={12} className="text-muted" />
              Chave de API: <span className="font-medium">não verificada</span>
              <span className="text-muted">· lida pelo backend, nunca pelo navegador</span>
            </p>

            {llmBlocked && (
              <div className="mt-3">
                <Banner
                  kind="warn"
                  title="Modo bloqueado nesta versão"
                  action={<Btn onClick={() => set('runMode', 'deterministic')}>Voltar ao determinístico</Btn>}
                >
                  O modo de validação adversarial precisa da chave no backend. Enquanto o endpoint não expõe o status,
                  execute no modo determinístico.
                </Banner>
              </div>
            )}
          </Section>

          <Section
            n={3}
            title="Defesa"
            summary={`${defenseName}${cfg.defense === 'redesign' ? ` · ${activeControls}/4 controles AM3` : ''}`}
            open={!!open[3]}
            onToggle={() => toggle(3)}
            invalid={Boolean(E.limitMax)}
          >
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Defesa">
              {(
                [
                  ['B1', 'B1 — Verificação leve', 'Só e-mail. Mensagem detalhada. Sem controles AM3.'],
                  ['B2', 'B2 — Verificação rígida', 'SMS + CPF + dispositivo. Mensagem detalhada. Sem controles AM3.'],
                  ['redesign', 'Redesenho da seção 5', 'Escolhe B1/B2 por indícios e adiciona os 4 controles da AM3.'],
                ] as const
              ).map(([id, title, description]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={cfg.defense === id}
                  onClick={() => set('defense', id)}
                  className={cx(
                    'rounded-lg border p-3 text-left',
                    cfg.defense === id ? 'border-engine bg-engine-soft' : 'border-line hover:border-line-strong',
                  )}
                >
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-1 text-[11.5px] leading-4 text-muted">{description}</p>
                </button>
              ))}
            </div>

            <div className={cx('mt-4 divide-y divide-line rounded-lg border border-line', cfg.defense !== 'redesign' && 'opacity-50')}>
              {[
                {
                  key: 'generic' as const,
                  title: 'Mensagem genérica',
                  description: 'Troca “Este CPF já foi usado” por “Não foi possível aplicar o cupom neste pedido.”',
                },
                {
                  key: 'limitOn' as const,
                  title: 'Limite de tentativas',
                  description: 'Mostra o selo “limite” nas tentativas.',
                  extra: (
                    <div className="flex items-center gap-1.5 text-[11.5px]">
                      <div className="w-12">
                        <NumInput
                          value={cfg.limitMax}
                          onChange={(value) => set('limitMax', value)}
                          error={!!E.limitMax}
                          disabled={cfg.defense !== 'redesign'}
                        />
                      </div>
                      tentativas /
                      <div className="w-14">
                        <NumInput
                          value={cfg.limitWindow}
                          unit="h"
                          onChange={(value) => set('limitWindow', value)}
                          disabled={cfg.defense !== 'redesign'}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'probing' as const,
                  title: 'Detecção de sondagem',
                  description: 'Marca sequências com um campo alterado e pode recusar o conjunto.',
                  extra: (
                    <div className="flex items-center gap-1.5 text-[11.5px]">
                      ≥
                      <div className="w-12">
                        <NumInput
                          value={cfg.probingMin}
                          onChange={(value) => set('probingMin', value)}
                          disabled={cfg.defense !== 'redesign'}
                        />
                      </div>
                      tentativas
                    </div>
                  ),
                },
                {
                  key: 'contestation' as const,
                  title: 'Canal de contestação',
                  description: 'Habilita a aba Contestação para a recusa.',
                },
              ].map((control) => (
                <div key={control.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <Switch
                    on={cfg[control.key]}
                    onChange={(value) => set(control.key, value)}
                    label={control.title}
                    disabled={cfg.defense !== 'redesign'}
                  />
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[12.5px] font-medium">{control.title}</p>
                    <p className="text-[11.5px] leading-4 text-muted">{control.description}</p>
                  </div>
                  {control.extra}
                </div>
              ))}
            </div>
            {cfg.defense !== 'redesign' && (
              <p className="mt-2 text-[11.5px] text-muted">Os controles da AM3 existem apenas no redesenho.</p>
            )}
          </Section>

          <Section
            n={4}
            title="Economia"
            summary={`Cupom ${brl(cfg.discount)} · mínimo ${brl(cfg.minOrder)} · orçamento ${brl(cfg.acqBudget)}`}
            open={!!open[4]}
            onToggle={() => toggle(4)}
            invalid={Boolean(E.discount || E.minOrder || E.acqBudget || E.atkBudget || E.commission)}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Desconto (coupon.discount)" help="Fixo na regra do trabalho; editável só para cenário." error={E.discount}>
                <NumInput value={cfg.discount} unit="R$" step={0.5} onChange={(value) => set('discount', value)} error={!!E.discount} />
              </Field>
              <Field label="Pedido mínimo (coupon.min_order)" help="Borda: R$ 30,00 é inelegível; R$ 30,01 é elegível." error={E.minOrder}>
                <NumInput value={cfg.minOrder} unit="R$" step={0.01} onChange={(value) => set('minOrder', value)} error={!!E.minOrder} />
              </Field>
              <Field label="Comissão (commission_rate)" help="≈ R$ 6 em pedido de R$ 30." error={E.commission}>
                <NumInput value={cfg.commission} unit="%" onChange={(value) => set('commission', value)} error={!!E.commission} />
              </Field>
              <Field label="Orçamento da plataforma" help="Debitado só na conclusão do pedido." error={E.acqBudget}>
                <NumInput value={cfg.acqBudget} unit="R$" step={1000} onChange={(value) => set('acqBudget', value)} error={!!E.acqBudget} />
              </Field>
              <Field label="Orçamento do atacante" help="Nunca somar com o da plataforma." error={E.atkBudget}>
                <NumInput value={cfg.atkBudget} unit="R$" step={500} onChange={(value) => set('atkBudget', value)} error={!!E.atkBudget} />
              </Field>
              <div className="hidden sm:block" />
              <Field label="E-mail descartável (AM1)">
                <NumInput value={cfg.costEmail} unit="R$" step={0.5} onChange={(value) => set('costEmail', value)} />
              </Field>
              <Field label="SMS virtual + CPF (AM2)">
                <NumInput value={cfg.costSms} unit="R$" step={0.5} onChange={(value) => set('costSms', value)} />
              </Field>
              <Field label="Emulador + endereço (extensão)">
                <NumInput value={cfg.costEmu} unit="R$" step={0.5} onChange={(value) => set('costEmu', value)} />
              </Field>
              <Field label="Recuo: custo por aprovada" help="Gatilho de recuo para A1.">
                <NumInput value={cfg.retreatCpa} unit="R$" step={0.5} onChange={(value) => set('retreatCpa', value)} />
              </Field>
              <Field label="Margem de segurança">
                <NumInput value={cfg.safety} unit="%" onChange={(value) => set('safety', value)} />
              </Field>
            </div>
            <p className="mt-3 text-[11.5px] text-muted">
              O custo é cobrado por tentativa, inclusive nas recusadas. O indicador de recuo é o custo por conta aprovada.
            </p>
          </Section>

          <Section
            n={5}
            title="Coorte legítima"
            summary={`${cfg.legit} clientes por rodada · ${cfg.sharedDevice}% dispositivo compartilhado`}
            open={!!open[5]}
            onToggle={() => toggle(5)}
            invalid={Boolean(E.legit || E.sharedDevice || E.sharedAddress || E.abandon)}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Clientes novos" help="Sintéticos, por rodada." error={E.legit}>
                <NumInput value={cfg.legit} onChange={(value) => set('legit', value)} error={!!E.legit} />
              </Field>
              <Field label="Dispositivo compartilhado" help="Famílias e repúblicas: geram falsos positivos em P3." error={E.sharedDevice}>
                <NumInput value={cfg.sharedDevice} unit="%" onChange={(value) => set('sharedDevice', value)} error={!!E.sharedDevice} />
              </Field>
              <Field label="Endereço compartilhado" help="Idem." error={E.sharedAddress}>
                <NumInput value={cfg.sharedAddress} unit="%" onChange={(value) => set('sharedAddress', value)} error={!!E.sharedAddress} />
              </Field>
              <Field label="Abandono" help="Desiste após a verificação." error={E.abandon}>
                <NumInput value={cfg.abandon} unit="%" onChange={(value) => set('abandon', value)} error={!!E.abandon} />
              </Field>
            </div>
          </Section>

          <Section
            n={6}
            title="Saídas"
            summary={`${Object.values(cfg.outputs).filter(Boolean).length} arquivos em saidas/runs/<run_id>/`}
            open={!!open[6]}
            onToggle={() => toggle(6)}
          >
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {Object.keys(cfg.outputs).map((key) => (
                <label key={key} className="flex items-center gap-2 text-[12.5px]">
                  <input
                    type="checkbox"
                    className="accent-[#cc4419]"
                    checked={cfg.outputs[key]}
                    onChange={(event) => set('outputs', { ...cfg.outputs, [key]: event.target.checked })}
                  />
                  <span className="num">{key}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-muted">
              O JSONL é a fonte; os CSV são derivados. A pasta é somente leitura.
            </p>
          </Section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-[132px]">
          <Panel title="Resumo da execução">
            <dl className="space-y-1.5 text-[12.5px]">
              {[
                ['Rodadas', String(cfg.rounds)],
                ['Modo', cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'],
                ['Defesa', defenseName],
                ['Contas estimadas', estimatedAccounts],
                ['Orçamento', brl(cfg.acqBudget)],
                ['Custo estimado', 'R$ 0'],
                ['LLM', cfg.runMode === 'deterministic' ? 'desligado' : cfg.provider],
              ].map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-muted">{key}</dt>
                  <dd className="num text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {errorCount > 0 ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-refused">
                  <XCircle size={14} />
                  {errorCount} {errorCount === 1 ? 'erro impede' : 'erros impedem'} a execução
                </p>
              ) : llmBlocked ? (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-verification">
                  <AlertTriangle size={14} />
                  Chave de API ausente
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-accepted">
                  <CheckCircle2 size={14} />
                  Configuração válida
                </p>
              )}

              {checked &&
                Object.values(E).map((message) => (
                  <p key={message} className="text-[11.5px] text-refused">
                    • {message}
                  </p>
                ))}
              {validation.warnings.map((warning) => (
                <p key={warning} className="flex gap-1.5 text-[11.5px] text-verification">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  {warning}
                </p>
              ))}
              {checked && !errorCount && !validation.warnings.length && (
                <p className="text-[11.5px] text-muted">Nenhum erro ou aviso.</p>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Btn
                className="flex-1"
                onClick={() => {
                  setChecked(true)
                  toast(errorCount ? `${errorCount} erro(s) encontrado(s)` : 'Configuração válida')
                }}
              >
                Validar
              </Btn>
              <Btn
                variant="primary"
                className="flex-1"
                disabled={errorCount > 0 || llmBlocked}
                title={llmBlocked ? 'A chave é lida pelo backend. Volte ao modo determinístico.' : undefined}
                icon={<Play size={13} />}
                onClick={() => goTab(1)}
              >
                Executar
              </Btn>
            </div>
            <p className="num mt-3 text-[11px] text-muted">hash: {hash}…</p>
          </Panel>

          <p className="px-1 text-[11px] leading-4 text-muted">
            A configuração é a mesma nos dois entrypoints. O JSON exportado aqui é o que o backend Python consome para
            reproduzir a execução. Enquanto o backend está em esqueleto, as telas usam o cenário sintético de referência.
          </p>
        </aside>
      </div>
    </div>
  )
}
