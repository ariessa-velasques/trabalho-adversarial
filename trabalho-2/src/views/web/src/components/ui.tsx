import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  HelpCircle,
  Info,
  X,
  XCircle,
} from 'lucide-react'
import type { Attempt } from '../data/types'

export const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ')

const TONES = {
  neutral: 'border-line bg-surface text-neutral',
  accepted: 'border-[#b7dcc4] bg-accepted-soft text-accepted',
  refused: 'border-[#ecc3bd] bg-refused-soft text-refused',
  verification: 'border-[#ecd9a8] bg-verification-soft text-verification',
  limited: 'border-[#c6c9e8] bg-limited-soft text-limited',
  bot: 'border-[#d3caf7] bg-bot-soft text-bot',
  engine: 'border-[#b9dcd6] bg-engine-soft text-engine',
  accent: 'border-[#f0c4b3] bg-accent-soft text-accent-ink',
} as const

export type Tone = keyof typeof TONES

export function Pill({
  tone = 'neutral',
  icon,
  children,
  mono,
  className,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[2px] text-[11px] font-medium',
        TONES[tone],
        mono && 'num',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function ResultPill({ result }: { result: Attempt['result'] }) {
  const map = {
    accepted: ['accepted', <CheckCircle2 size={11} key="i" />, 'Aceito'],
    coupon_already_used: ['refused', <XCircle size={11} key="i" />, 'Recusado'],
    verification_required: ['verification', <HelpCircle size={11} key="i" />, 'Verificação'],
    rate_limited: ['limited', <Clock size={11} key="i" />, 'Limite'],
  } as const
  const [tone, icon, label] = map[result]
  return (
    <Pill tone={tone} icon={icon}>
      {label}
    </Pill>
  )
}

export function Panel({
  children,
  className,
  title,
  sub,
  right,
  flush,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
  sub?: ReactNode
  right?: ReactNode
  flush?: boolean
}) {
  return (
    <section className={cx('panel min-w-0', className)}>
      {title && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-5 text-ink">{title}</h2>
            {sub && <p className="mt-0.5 text-[12.5px] leading-4 text-muted">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 max-w-[70ch] text-[14px] text-muted">{description}</p>}
        {meta && <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: ReactNode
}

export function Btn({ children, variant = 'secondary', icon, className, ...props }: ButtonProps) {
  const variants = {
    primary: 'border-accent bg-accent text-white hover:bg-accent-ink disabled:border-[#e0b4a5] disabled:bg-[#e0b4a5]',
    secondary: 'border-line bg-surface text-ink hover:bg-[#f0f1ed] disabled:text-faint',
    ghost: 'border-transparent bg-transparent text-neutral hover:bg-[#eceee9] disabled:text-faint',
    danger: 'border-[#ecc3bd] bg-surface text-refused hover:bg-refused-soft',
  }[variant]

  return (
    <button
      {...props}
      className={cx(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors',
        variants,
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function Banner({
  kind = 'info',
  title,
  children,
  action,
}: {
  kind?: 'info' | 'warn' | 'error' | 'success'
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  const map = {
    info: ['border-[#c3d7ee] bg-[#f2f7fc] text-[#1c4f82]', <Info size={15} key="i" />],
    warn: ['border-[#ecd9a8] bg-verification-soft text-verification', <AlertTriangle size={15} key="i" />],
    error: ['border-[#ecc3bd] bg-refused-soft text-refused', <XCircle size={15} key="i" />],
    success: ['border-[#b7dcc4] bg-accepted-soft text-accepted', <CheckCircle2 size={15} key="i" />],
  }[kind]

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cx('flex items-start gap-2.5 rounded-lg border px-3 py-2.5', map[0] as string)}
    >
      <span className="mt-[1px] shrink-0">{map[1]}</span>
      <div className="min-w-0 flex-1 text-[12.5px] text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[#3f4a44]">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function StatStrip({ children, cols }: { children: ReactNode; cols?: 4 | 6 | 8 }) {
  return (
    <div className="stat-strip" data-cols={cols}>
      {children}
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  delta,
  hint,
  tone,
}: {
  label: string
  value: string
  sub?: string
  delta?: { value: string; good?: boolean | null }
  hint?: string
  tone?: string
}) {
  return (
    <div className="stat" title={hint}>
      <p className="text-[11.5px] font-medium text-muted">{label}</p>
      <p className={cx('num mt-0.5 text-[22px] font-semibold leading-7', tone)}>{value}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-4">
        {delta && (
          <span
            className={cx(
              'num font-medium',
              delta.good === true && 'text-accepted',
              delta.good === false && 'text-refused',
              delta.good == null && 'text-muted',
            )}
          >
            {delta.value}
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
      <div className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-muted">
        {icon}
      </div>
      <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="text-[13px] text-muted">{text}</p>
      {cta}
    </div>
  )
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx(
        'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors',
        on ? 'border-accent bg-accent' : 'border-line-strong bg-[#dfe3dd]',
        disabled && 'opacity-45',
      )}
    >
      <span
        className={cx(
          'absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white transition-[left]',
          on ? 'left-[17px]' : 'left-[2px]',
        )}
      />
    </button>
  )
}

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string
  help?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-refused">
          <XCircle size={11} />
          {error}
        </p>
      ) : (
        help && <p className="mt-1 text-[11.5px] leading-4 text-muted">{help}</p>
      )}
    </label>
  )
}

export const inputCls = (error?: boolean) =>
  cx(
    'h-8 w-full rounded-md border bg-surface px-2 text-[13px] text-ink outline-none transition-colors focus:border-accent disabled:bg-[#f1f2ee] disabled:text-muted',
    error ? 'border-refused' : 'border-line',
  )

export function NumInput({
  value,
  onChange,
  unit,
  error,
  step = 1,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  unit?: string
  error?: boolean
  step?: number
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        aria-invalid={error}
        onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
        className={cx(inputCls(error), 'num', unit && 'pr-8')}
      />
      {unit && <span className="pointer-events-none absolute right-2 top-[7px] text-[11px] text-muted">{unit}</span>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-[#f0f1ed] p-[2px]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition-colors',
            value === option.value ? 'bg-surface text-ink shadow-[0_1px_1px_rgba(22,26,24,0.06)]' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4" onMouseDown={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-surface p-5 shadow-xl outline-none"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-[#f0f1ed] hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Hidden({ what }: { what: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded border border-dashed border-line-strong px-1.5 py-[1px] text-[11px] text-muted">
      <Eye size={11} />
      {what} oculto nesta visão
    </span>
  )
}

export function CopyBtn({
  text,
  label = 'Copiar ID',
  onDone,
}: {
  text: string
  label?: string
  onDone?: (message: string) => void
}) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      className="text-[11.5px] font-medium text-limited underline decoration-limited/40 underline-offset-2 hover:decoration-limited"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true)
            onDone?.(`Copiado: ${text}`)
            window.setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => onDone?.('Não foi possível copiar'))
      }}
    >
      {copied ? 'Copiado' : label}
    </button>
  )
}
