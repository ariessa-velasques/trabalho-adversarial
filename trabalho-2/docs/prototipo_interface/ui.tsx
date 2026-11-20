import { useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, XCircle, HelpCircle, Clock, Eye, X } from 'lucide-react'
import type { Attempt } from './data'

export const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

const TONES = {
  neutral: 'bg-white text-neutral-status border-line',
  accepted: 'bg-[#ecfdf3] text-accepted border-[#abefc6]',
  refused: 'bg-danger-bg text-refused border-[#fecdca]',
  verification: 'bg-warning-bg text-verification border-[#fedf89]',
  limited: 'bg-[#eef4ff] text-limited border-[#c7d7fe]',
  bot: 'bg-[#f4f0ff] text-bot border-[#d9ccff]',
  engine: 'bg-[#e6f6f7] text-engine border-[#b2dfe2]',
  accent: 'bg-[#fff1ec] text-[#b93815] border-[#f9c4b3]',
}
export type Tone = keyof typeof TONES

export function Pill({ tone = 'neutral', icon, children, mono }: { tone?: Tone; icon?: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], mono && 'num')}>
      {icon}
      {children}
    </span>
  )
}

export function ResultPill({ r }: { r: Attempt['result'] }) {
  const m = {
    accepted: ['accepted', <CheckCircle2 size={12} key="i" />, 'Aceito'],
    coupon_already_used: ['refused', <XCircle size={12} key="i" />, 'Recusado'],
    verification_required: ['verification', <HelpCircle size={12} key="i" />, 'Verificação'],
    rate_limited: ['limited', <Clock size={12} key="i" />, 'Limite'],
  } as const
  const [t, i, l] = m[r]
  return <Pill tone={t} icon={i}>{l}</Pill>
}

export function Panel({ children, className, title, sub, right }: { children: ReactNode; className?: string; title?: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-line bg-surface', className)}>
      {title && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={title ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function Btn({ children, variant = 'secondary', icon, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: ReactNode }) {
  const v = {
    primary: 'bg-accent text-white border-accent hover:bg-[#cf4a24] disabled:bg-[#f0b5a3] disabled:border-[#f0b5a3]',
    secondary: 'bg-white text-ink border-line hover:bg-[#f2f4f7] disabled:text-[#98a2b3]',
    ghost: 'border-transparent text-neutral-status hover:bg-[#eceef1] disabled:text-[#98a2b3]',
    danger: 'bg-white text-refused border-[#fecdca] hover:bg-danger-bg',
  }[variant]
  return (
    <button {...p} className={cx('inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors', v, className)}>
      {icon}
      {children}
    </button>
  )
}

export function Banner({ kind = 'info', title, children, action }: { kind?: 'info' | 'warn' | 'error' | 'success'; title?: string; children?: ReactNode; action?: ReactNode }) {
  const k = {
    info: ['bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]', <Info size={16} key="i" />],
    warn: ['bg-warning-bg border-[#fedf89] text-verification', <AlertTriangle size={16} key="i" />],
    error: ['bg-danger-bg border-[#fecdca] text-refused', <XCircle size={16} key="i" />],
    success: ['bg-[#ecfdf3] border-[#abefc6] text-accepted', <CheckCircle2 size={16} key="i" />],
  }[kind]
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-lg border px-3.5 py-2.5', k[0] as string)}>
      <span className="mt-0.5">{k[1]}</span>
      <div className="flex-1 text-[13px] text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[#344054]">{children}</div>}
      </div>
      {action}
    </div>
  )
}

export function Kpi({ label, value, sub, delta, hint, tone }: { label: string; value: string; sub?: string; delta?: { v: string; good?: boolean | null }; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5" title={hint}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={cx('num mt-1 text-[26px] font-semibold leading-8', tone)}>{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta && (
          <span className={cx('num font-medium', delta.good === true && 'text-accepted', delta.good === false && 'text-refused', delta.good == null && 'text-muted')}>
            {delta.v}
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, text, cta }: { icon: ReactNode; title: string; text: string; cta?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-white text-muted">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted">{text}</p>
      {cta}
    </div>
  )
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-accent' : 'bg-[#d0d5dd]', disabled && 'opacity-50')}>
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

export function Field({ label, help, error, children }: { label: string; help?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <p className="mt-1 flex items-center gap-1 text-xs text-refused"><XCircle size={12} />{error}</p> : help && <p className="mt-1 text-xs text-muted">{help}</p>}
    </label>
  )
}
export const inputCls = (err?: boolean) =>
  cx('h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] disabled:bg-[#f2f4f7] disabled:text-muted', err ? 'border-refused' : 'border-line')

export function NumInput({ value, onChange, unit, error, step = 1, disabled }: { value: number; onChange: (n: number) => void; unit?: string; error?: boolean; step?: number; disabled?: boolean }) {
  return (
    <div className="relative">
      <input type="number" step={step} value={Number.isFinite(value) ? value : ''} disabled={disabled} aria-invalid={error}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} className={cx(inputCls(error), 'num', unit && 'pr-10')} />
      {unit && <span className="pointer-events-none absolute right-2.5 top-2 text-xs text-muted">{unit}</span>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg border border-line bg-[#f2f4f7] p-0.5">
      {options.map((o) => (
        <button key={o.v} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={cx('rounded-md px-3 py-1 text-[13px] font-medium', value === o.v ? 'bg-white shadow-sm' : 'text-muted')}>{o.l}</button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button aria-label="Fechar" onClick={onClose} className="rounded p-1 hover:bg-[#f2f4f7]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Hidden({ what }: { what: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-line px-1.5 py-0.5 text-xs text-muted">
      <Eye size={11} /> {what} oculto nesta visão
    </span>
  )
}

// ---------- Charts (SVG) ----------
export interface Series { name: string; color: string; values: number[]; dash?: string }
const W = 520, H = 220, PL = 48, PR = 44, PT = 12, PB = 28

export function Chart({ title, sub, labels, bars = [], lines = [], stacked, unit = '', unit2 = '', fmt = (n: number) => String(n), fmt2, ref, y2Lines, desc }: {
  title: string; sub?: string; labels: string[]; bars?: Series[]; lines?: Series[]; stacked?: boolean; unit?: string; unit2?: string
  fmt?: (n: number) => string; fmt2?: (n: number) => string; ref?: { value: number; label: string }; y2Lines?: boolean; desc: string
}) {
  const [table, setTable] = useState(false)
  const n = labels.length
  const barMax = Math.max(1, ...(stacked ? labels.map((_, i) => bars.reduce((a, s) => a + (s.values[i] ?? 0), 0)) : bars.flatMap((s) => s.values)))
  const lineSrc = lines.flatMap((s) => s.values)
  const lineMax = Math.max(1, ...lineSrc, ref && !y2Lines && !bars.length ? ref.value : 0)
  const prim = bars.length ? barMax : lineMax
  const useY2 = y2Lines && bars.length > 0
  const nice = (m: number) => { const p = 10 ** Math.floor(Math.log10(m)); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p }
  const yMax = nice(Math.max(prim, !useY2 && ref ? ref.value : 0))
  const y2Max = nice(useY2 ? Math.max(lineMax, ref ? ref.value : 0) : lineMax)
  const iw = W - PL - PR, ih = H - PT - PB
  const slot = iw / Math.max(n, 1)
  const y = (v: number, m = yMax) => PT + ih - (v / m) * ih
  const x = (i: number) => PL + slot * i + slot / 2
  const bw = Math.min(40, (slot * 0.7) / (stacked ? 1 : Math.max(bars.length, 1)))
  const lm = useY2 ? y2Max : yMax
  const fl = fmt2 ?? fmt
  const ticks = [0, 0.5, 1]
  return (
    <Panel title={title} sub={sub} right={<button onClick={() => setTable(!table)} className="text-xs font-medium text-limited underline">{table ? 'Ver gráfico' : 'Ver dados'}</button>}>
      {table ? (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted"><th className="py-1">Rodada</th>{[...bars, ...lines].map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
          <tbody>{labels.map((l, i) => (
            <tr key={l} className="border-t border-line"><td className="py-1">{l}</td>
              {bars.map((s) => <td key={s.name} className="num">{fmt(s.values[i])}</td>)}
              {lines.map((s) => <td key={s.name} className="num">{fl(s.values[i])}</td>)}</tr>))}</tbody>
        </table>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc} className="w-full">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PL} x2={W - PR} y1={y(yMax * t)} y2={y(yMax * t)} stroke="#e4e7ec" />
                <text x={PL - 6} y={y(yMax * t) + 4} textAnchor="end" fontSize="10" fill="#667085" className="num">{fmt(yMax * t)}</text>
                {useY2 && <text x={W - PR + 6} y={y(y2Max * t) + 4} fontSize="10" fill="#667085" className="num">{fl(y2Max * t)}</text>}
              </g>
            ))}
            <text x={PL - 6} y={8} textAnchor="end" fontSize="9" fill="#667085">{unit}</text>
            {useY2 && <text x={W - PR + 6} y={8} fontSize="9" fill="#667085">{unit2}</text>}
            {labels.map((l, i) => <text key={l} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#667085">{l}</text>)}
            {bars.map((s, si) =>
              s.values.map((v, i) => {
                const before = stacked ? bars.slice(0, si).reduce((a, b) => a + (b.values[i] ?? 0), 0) : 0
                const bx = stacked ? x(i) - bw / 2 : x(i) - (bw * bars.length) / 2 + si * bw
                const top = y(before + v), base = y(before)
                return <rect key={`${si}-${i}`} x={bx} y={top} width={bw - 1} height={Math.max(0, base - top)} fill={s.color} rx="1.5"><title>{`${s.name} · ${labels[i]}: ${fmt(v)}`}</title></rect>
              }))}
            {ref && (
              <g>
                <line x1={PL} x2={W - PR} y1={y(ref.value, lm)} y2={y(ref.value, lm)} stroke="#171a1f" strokeDasharray="4 3" />
                <text x={PL + 4} y={y(ref.value, lm) - 4} fontSize="10" fill="#171a1f">{ref.label}</text>
              </g>
            )}
            {lines.map((s) => (
              <g key={s.name}>
                <polyline fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} points={s.values.map((v, i) => `${x(i)},${y(v, lm)}`).join(' ')} />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v, lm)} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2"><title>{`${s.name} · ${labels[i]}: ${fl(v)}`}</title></circle>
                ))}
              </g>
            ))}
          </svg>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {bars.map((s) => <li key={s.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</li>)}
            {lines.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <svg width="18" height="8"><line x1="0" x2="18" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} /></svg>{s.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

export function CopyBtn({ text, label = 'Copiar ID', onDone }: { text: string; label?: string; onDone?: (m: string) => void }) {
  return (
    <button className="text-xs font-medium text-limited underline" onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); onDone?.('Copiado: ' + text) }}>{label}</button>
  )
}

export function download(name: string, content: string, mime = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
