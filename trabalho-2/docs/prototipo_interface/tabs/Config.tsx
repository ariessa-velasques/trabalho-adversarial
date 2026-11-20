import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Lock, Play, RotateCcw, Check, Upload, Save, XCircle } from 'lucide-react'
import { PRESETS, defaultCfg, hashCfg, validate, useApp, type Cfg } from '../state'
import { Banner, Btn, Field, NumInput, Panel, Segmented, Switch, cx, download, inputCls } from '../ui'
import { brl } from '../data'

const PRESET_CARDS: { id: Cfg['preset']; name: string; rounds: number; mode: string; defense: string; time: string; desc: string }[] = [
  { id: 'demo', name: 'Demonstração', rounds: 6, mode: 'adaptativo', defense: 'redesenho', time: '~13 s', desc: 'Vídeo e apresentação: o ciclo completo AM1 → AM3 → recuo.' },
  { id: 'compare', name: 'Comparar defesas', rounds: 3, mode: 'determinístico', defense: 'B1 · B2 · redesenho', time: '~8 s', desc: 'Mesma seed nas três defesas para a tabela comparativa.' },
  { id: 'quick', name: 'Teste rápido', rounds: 3, mode: 'determinístico', defense: 'redesenho', time: '~6 s', desc: 'Iteração e teste de configuração.' },
]

function Section({ n, title, summary, open, onToggle, bad, children }: { n: number; title: string; summary: string; open: boolean; onToggle: () => void; bad?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <button aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="num grid h-6 w-6 place-items-center rounded-full bg-[#f2f4f7] text-xs font-semibold">{n}</span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-xs text-muted">{summary}</span>
        </span>
        {bad ? <span className="flex items-center gap-1 text-xs font-medium text-refused"><XCircle size={14} />erro</span> : <span className="flex items-center gap-1 text-xs font-medium text-accepted"><CheckCircle2 size={14} />válido</span>}
        <ChevronDown size={16} className={cx('text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  )
}

export default function Config() {
  const { cfg, setCfg, run, goTab, toast, keyOk } = useApp()
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true })
  const [checked, setChecked] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const v = validate(cfg)
  const errN = Object.keys(v.errors).length
  const hash = hashCfg(cfg)
  const set = <K extends keyof Cfg>(k: K, val: Cfg[K]) => setCfg({ ...cfg, [k]: val })
  const llmBlocked = cfg.runMode === 'adversarial_validation' && !keyOk
  const dirty = JSON.stringify({ ...cfg, label: 0, notes: 0 }) !== JSON.stringify({ ...defaultCfg, label: 0, notes: 0 })
  const stale = run.status !== 'idle' && run.hash !== hash
  const tog = (n: number) => setOpen({ ...open, [n]: !open[n] })
  const E = v.errors
  const defName = { B1: 'B1 · verificação leve', B2: 'B2 · verificação rígida', redesign: 'redesenho' }[cfg.defense]
  const estAccounts = cfg.rounds === 6 ? '~1.000' : '~' + (cfg.rounds * 160)

  const reset = () => { setCfg(defaultCfg); setConfirmReset(false); toast('Padrões restaurados (preset Demonstração)') }
  const loadJson = (f?: File) => {
    if (!f) return
    f.text().then((t) => {
      try { setCfg({ ...cfg, ...JSON.parse(t) }); toast('JSON carregado e validado') } catch { toast('JSON inválido: verifique o arquivo') }
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[26px] font-semibold">Configure o experimento</h1>
          <p className="text-muted">Escolha um preset ou ajuste os parâmetros. Mesma seed e mesma configuração geram a mesma execução.</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-[#f2f4f7] focus-within:outline-2">
            <Upload size={14} />Carregar JSON<input type="file" accept="application/json" className="sr-only" onChange={(e) => loadJson(e.target.files?.[0])} />
          </label>
          <Btn icon={<Save size={14} />} onClick={() => { download('scenarios.json', JSON.stringify({ config_hash: hash, ...cfg }, null, 2), 'application/json'); toast('scenarios.json baixado') }}>Salvar JSON</Btn>
          <Btn icon={<RotateCcw size={14} />} onClick={() => (dirty ? setConfirmReset(true) : reset())}>Restaurar padrões</Btn>
        </div>
      </div>

      {confirmReset && (
        <Banner kind="warn" title="Restaurar padrões?" action={<div className="flex gap-2"><Btn variant="danger" onClick={reset}>Restaurar</Btn><Btn onClick={() => setConfirmReset(false)}>Cancelar</Btn></div>}>
          Suas edições serão descartadas e o preset Demonstração volta a valer.
        </Banner>
      )}
      {stale && <Banner kind="info" title="A configuração mudou.">A próxima execução usará um novo <span className="num">config_hash</span> ({hash}).</Banner>}

      <div className="grid grid-cols-3 gap-4" role="radiogroup" aria-label="Presets">
        {PRESET_CARDS.map((p) => {
          const sel = cfg.preset === p.id
          return (
            <button key={p.id} role="radio" aria-checked={sel} onClick={() => setCfg({ ...cfg, ...PRESETS[p.id], preset: p.id })}
              className={cx('relative rounded-xl border bg-surface p-4 text-left transition-colors', sel ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-[#b0b7c3]')}>
              {sel && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-accent text-white"><Check size={12} /></span>}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{p.name}</p>
              <p className="mt-1 text-[13px]"><span className="num font-semibold">{p.rounds}</span> rodadas · {p.mode} · {p.defense} · <span className="num">{p.time}</span></p>
              <p className="mt-1.5 text-xs text-muted">{p.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-[1fr_320px] items-start gap-6">
        <div className="space-y-3">
          <Section n={1} title="Identificação" summary={`${cfg.label} · seed ${cfg.seed} · ${cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'}`} open={!!open[1]} onToggle={() => tog(1)} bad={!!(E.label || E.seed)}>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome da execução (run_label)" error={E.label}><input className={inputCls(!!E.label)} value={cfg.label} onChange={(e) => set('label', e.target.value)} /></Field>
              <Field label="Seed mestra (seeds.master)" help="Mesma seed + mesma config = mesma execução." error={E.seed}>
                <div className="flex gap-2">
                  <NumInput value={cfg.seed} onChange={(n) => set('seed', n)} error={!!E.seed} />
                  <Btn onClick={() => set('seed', Math.floor(Math.random() * 9999))}>Sortear</Btn>
                </div>
              </Field>
              <Field label="Rodadas (rounds)" help="Cada rodada equivale a 7 dias simulados."><select className={inputCls()} value={cfg.rounds} onChange={(e) => set('rounds', Number(e.target.value))}>{[3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</select></Field>
              <Field label="Modo de cenário (modes.scenario)" help="Adaptativo: só muda se o gatilho disparar. Guiado: força AM1→AM2→AM3 nas rodadas 1–3.">
                <Segmented value={cfg.scenario} onChange={(s) => set('scenario', s)} options={[{ v: 'adaptive', l: 'Adaptativo' }, { v: 'guided', l: 'Guiado' }]} />
              </Field>
              <div className="col-span-2"><Field label="Observações (notes)"><textarea className={cx(inputCls(), 'h-16 py-2')} value={cfg.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
            </div>
          </Section>

          <Section n={2} title="Agentes" summary={cfg.runMode === 'deterministic' ? 'Determinístico · sem chamadas externas' : `Validação adversarial · ${cfg.provider}`} open={!!open[2]} onToggle={() => tog(2)}>
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Modo de execução">
              {([['deterministic', 'Determinístico', 'Padrão. Reproduzível, sem chaves nem rede.'], ['adversarial_validation', 'Validação adversarial (LLM)', 'Opcional. Uma chamada por rodada; exige chave de API.']] as const).map(([id, t, d]) => (
                <button key={id} role="radio" aria-checked={cfg.runMode === id} onClick={() => set('runMode', id)}
                  className={cx('rounded-lg border p-3 text-left', cfg.runMode === id ? 'border-accent bg-[#fff8f5]' : 'border-line')}>
                  <p className="font-semibold">{t}</p><p className="text-xs text-muted">{d}</p>
                </button>
              ))}
            </div>
            <div className={cx('mt-4 grid grid-cols-2 gap-4', cfg.runMode === 'deterministic' && 'opacity-60')}>
              <Field label="Provedor"><select disabled={cfg.runMode === 'deterministic'} className={inputCls()} value={cfg.provider} onChange={(e) => set('provider', e.target.value)}><option>anthropic</option><option>groq</option></select></Field>
              <Field label="Modelo"><select disabled={cfg.runMode === 'deterministic'} className={inputCls()} value={cfg.model} onChange={(e) => set('model', e.target.value)}><option>claude-sonnet-4</option><option>claude-haiku-4</option></select></Field>
              <Field label={`Temperatura: ${cfg.temperature.toLocaleString('pt-BR')}`} help="0 reduz variação; não garante replay bit a bit."><input type="range" min={0} max={1} step={0.1} disabled={cfg.runMode === 'deterministic'} value={cfg.temperature} onChange={(e) => set('temperature', Number(e.target.value))} className="w-full accent-[#e4572e]" /></Field>
              <Field label="Chamadas por rodada (max_calls_per_round)" help="Uma chamada por rodada; o executor é determinístico."><NumInput disabled={cfg.runMode === 'deterministic'} value={cfg.maxCalls} onChange={(n) => set('maxCalls', n)} /></Field>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[13px]"><Lock size={13} />Chave de API: <span className="font-medium">{keyOk ? 'Configurada' : 'Não configurada'}</span></p>
            {llmBlocked && <div className="mt-3"><Banner kind="warn" title="Modo bloqueado" action={<Btn onClick={() => set('runMode', 'deterministic')}>Voltar ao determinístico</Btn>}>O modo de validação adversarial precisa de uma chave de API. Adicione <span className="num">ANTHROPIC_API_KEY</span> ou <span className="num">GROQ_API_KEY</span> no <span className="num">.env</span> ou execute no modo determinístico.</Banner></div>}
          </Section>

          <Section n={3} title="Defesa" summary={`${defName}${cfg.defense === 'redesign' ? ` · ${[cfg.generic, cfg.limitOn, cfg.probing, cfg.contestation].filter(Boolean).length}/4 controles AM3` : ''}`} open={!!open[3]} onToggle={() => tog(3)} bad={!!E.limitMax}>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Defesa">
              {([['B1', 'B1 — Verificação leve', 'Só e-mail. Mensagem detalhada. Sem controles AM3.'], ['B2', 'B2 — Verificação rígida', 'SMS + CPF + dispositivo. Mensagem detalhada. Sem controles AM3.'], ['redesign', 'Redesenho da seção 5', 'Escolhe B1/B2 por indícios e adiciona os 4 controles da AM3.']] as const).map(([id, t, d]) => (
                <button key={id} role="radio" aria-checked={cfg.defense === id} onClick={() => set('defense', id)} className={cx('rounded-lg border p-3 text-left', cfg.defense === id ? 'border-engine bg-[#f0fafa]' : 'border-line')}>
                  <p className="font-semibold">{t}</p><p className="mt-1 text-xs text-muted">{d}</p>
                </button>
              ))}
            </div>
            <div className={cx('mt-4 divide-y divide-line rounded-lg border border-line', cfg.defense !== 'redesign' && 'opacity-50')}>
              {[
                { k: 'generic' as const, t: 'Mensagem genérica', d: 'Troca “Este CPF já foi usado” por “Não foi possível aplicar o cupom neste pedido.”' },
                { k: 'limitOn' as const, t: 'Limite de tentativas', d: 'Mostra o selo “limite” nas tentativas.', extra: (
                  <div className="flex items-center gap-2 text-xs"><div className="w-16"><NumInput value={cfg.limitMax} onChange={(n) => set('limitMax', n)} error={!!E.limitMax} disabled={cfg.defense !== 'redesign'} /></div>tentativas /<div className="w-20"><NumInput value={cfg.limitWindow} unit="h" onChange={(n) => set('limitWindow', n)} disabled={cfg.defense !== 'redesign'} /></div></div>) },
                { k: 'probing' as const, t: 'Detecção de sondagem', d: 'Marca sequências com um campo alterado e pode recusar o conjunto.', extra: (
                  <div className="flex items-center gap-2 text-xs">≥<div className="w-16"><NumInput value={cfg.probingMin} onChange={(n) => set('probingMin', n)} disabled={cfg.defense !== 'redesign'} /></div>tentativas</div>) },
                { k: 'contestation' as const, t: 'Canal de contestação', d: 'Habilita a aba Contestação para a recusa.' },
              ].map((c) => (
                <div key={c.k} className="flex items-center gap-4 px-3 py-2.5">
                  <Switch on={cfg[c.k]} onChange={(b) => set(c.k, b)} label={c.t} disabled={cfg.defense !== 'redesign'} />
                  <div className="flex-1"><p className="font-medium">{c.t}</p><p className="text-xs text-muted">{c.d}</p></div>
                  {c.extra}
                </div>
              ))}
            </div>
            {cfg.defense !== 'redesign' && <p className="mt-2 text-xs text-muted">Os controles da AM3 existem apenas no redesenho.</p>}
          </Section>

          <Section n={4} title="Economia" summary={`Cupom ${brl(cfg.discount)} · mínimo ${brl(cfg.minOrder)} · orçamento ${brl(cfg.acqBudget)}`} open={!!open[4]} onToggle={() => tog(4)} bad={!!(E.discount || E.minOrder || E.acqBudget || E.atkBudget || E.commission)}>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Desconto (coupon.discount)" help="Fixo na regra do trabalho; editável só para cenário." error={E.discount}><NumInput value={cfg.discount} unit="R$" step={0.5} onChange={(n) => set('discount', n)} error={!!E.discount} /></Field>
              <Field label="Pedido mínimo (coupon.min_order)" help="Borda: R$ 30,00 é inelegível; R$ 30,01 é elegível." error={E.minOrder}><NumInput value={cfg.minOrder} unit="R$" step={0.01} onChange={(n) => set('minOrder', n)} error={!!E.minOrder} /></Field>
              <Field label="Comissão (commission_rate)" help="≈ R$ 6 em pedido de R$ 30." error={E.commission}><NumInput value={cfg.commission} unit="%" onChange={(n) => set('commission', n)} error={!!E.commission} /></Field>
              <Field label="Orçamento da plataforma" help="Debitado só na conclusão do pedido." error={E.acqBudget}><NumInput value={cfg.acqBudget} unit="R$" step={1000} onChange={(n) => set('acqBudget', n)} error={!!E.acqBudget} /></Field>
              <Field label="Orçamento do atacante" help="Nunca somar com o da plataforma." error={E.atkBudget}><NumInput value={cfg.atkBudget} unit="R$" step={500} onChange={(n) => set('atkBudget', n)} error={!!E.atkBudget} /></Field>
              <div />
              <Field label="E-mail descartável (AM1)"><NumInput value={cfg.costEmail} unit="R$" step={0.5} onChange={(n) => set('costEmail', n)} /></Field>
              <Field label="SMS virtual + CPF (AM2)"><NumInput value={cfg.costSms} unit="R$" step={0.5} onChange={(n) => set('costSms', n)} /></Field>
              <Field label="Emulador + endereço (extensão)"><NumInput value={cfg.costEmu} unit="R$" step={0.5} onChange={(n) => set('costEmu', n)} /></Field>
              <Field label="Recuo: custo por aprovada" help="Gatilho de recuo para A1."><NumInput value={cfg.retreatCpa} unit="R$" step={0.5} onChange={(n) => set('retreatCpa', n)} /></Field>
              <Field label="Margem de segurança"><NumInput value={cfg.safety} unit="%" onChange={(n) => set('safety', n)} /></Field>
            </div>
            <p className="mt-3 text-xs text-muted">O custo é cobrado por tentativa, inclusive nas recusadas. O indicador de recuo é o custo por conta aprovada.</p>
          </Section>

          <Section n={5} title="Coorte legítima" summary={`${cfg.legit} clientes por rodada · ${cfg.sharedDevice}% dispositivo compartilhado`} open={!!open[5]} onToggle={() => tog(5)} bad={!!(E.legit || E.sharedDevice || E.sharedAddress || E.abandon)}>
            <div className="grid grid-cols-4 gap-4">
              <Field label="Clientes novos" help="Sintéticos, por rodada." error={E.legit}><NumInput value={cfg.legit} onChange={(n) => set('legit', n)} error={!!E.legit} /></Field>
              <Field label="Dispositivo compartilhado" help="Famílias e repúblicas: geram falsos positivos em P3." error={E.sharedDevice}><NumInput value={cfg.sharedDevice} unit="%" onChange={(n) => set('sharedDevice', n)} error={!!E.sharedDevice} /></Field>
              <Field label="Endereço compartilhado" help="Idem." error={E.sharedAddress}><NumInput value={cfg.sharedAddress} unit="%" onChange={(n) => set('sharedAddress', n)} error={!!E.sharedAddress} /></Field>
              <Field label="Abandono" help="Desiste após a verificação." error={E.abandon}><NumInput value={cfg.abandon} unit="%" onChange={(n) => set('abandon', n)} error={!!E.abandon} /></Field>
            </div>
          </Section>

          <Section n={6} title="Saídas" summary={`${Object.values(cfg.outputs).filter(Boolean).length} arquivos em saidas/runs/<run_id>/`} open={!!open[6]} onToggle={() => tog(6)}>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {Object.keys(cfg.outputs).map((k) => (
                <label key={k} className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-[#e4572e]" checked={cfg.outputs[k]} onChange={(e) => set('outputs', { ...cfg.outputs, [k]: e.target.checked })} /><span className="num">{k}</span></label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">O JSONL é a fonte; os CSV são derivados. A pasta é somente leitura.</p>
          </Section>
        </div>

        <aside className="sticky top-36 space-y-3">
          <Panel title="Resumo da execução">
            <dl className="space-y-1.5 text-[13px]">
              {[['Rodadas', String(cfg.rounds)], ['Modo', cfg.scenario === 'adaptive' ? 'adaptativo' : 'guiado'], ['Defesa', defName], ['Contas estimadas', estAccounts], ['Orçamento', brl(cfg.acqBudget)], ['Custo estimado', 'R$ 0'], ['LLM', cfg.runMode === 'deterministic' ? 'desligado' : cfg.provider]].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-2"><dt className="text-muted">{k}</dt><dd className="num text-right font-medium">{val}</dd></div>
              ))}
            </dl>
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {errN > 0 ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-refused"><XCircle size={15} />{errN} {errN === 1 ? 'erro impede' : 'erros impedem'} a execução</p>
              ) : llmBlocked ? (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-verification"><AlertTriangle size={15} />Chave de API ausente</p>
              ) : (
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-accepted"><CheckCircle2 size={15} />Configuração válida</p>
              )}
              {checked && Object.values(E).map((m) => <p key={m} className="text-xs text-refused">• {m}</p>)}
              {v.warnings.map((w) => <p key={w} className="flex gap-1.5 text-xs text-verification"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{w}</p>)}
              {checked && !errN && !v.warnings.length && <p className="text-xs text-muted">Nenhum erro ou aviso.</p>}
            </div>
            <div className="mt-4 flex gap-2">
              <Btn className="flex-1" onClick={() => { setChecked(true); toast(errN ? `${errN} erro(s) encontrado(s)` : 'Configuração válida') }}>Validar</Btn>
              <Btn variant="primary" className="flex-1" disabled={errN > 0 || llmBlocked} title={llmBlocked ? 'Adicione ANTHROPIC_API_KEY ou GROQ_API_KEY no .env ou volte ao modo determinístico.' : undefined} icon={<Play size={14} />} onClick={() => goTab(1)}>Executar</Btn>
            </div>
            <p className="num mt-3 text-xs text-muted">hash: {hash}…</p>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
