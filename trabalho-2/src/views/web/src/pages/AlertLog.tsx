import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { useApp } from '../app/AppContext'
import { alertsVisibleInView } from '../data/derive'
import type { Alert, Severity } from '../data/types'
import { Panel, cx } from '../components/ui'

const SEVERITY = {
  alert: { label: 'ALERTA', color: 'text-[#ff9d8e]', icon: <OctagonAlert size={11} /> },
  warn: { label: 'AVISO', color: 'text-[#f5c168]', icon: <AlertTriangle size={11} /> },
  info: { label: 'INFO', color: 'text-[#8ec5f0]', icon: <Info size={11} /> },
}

export default function AlertLog({
  done,
  current,
  fraction,
  total,
  finished,
  view,
  live,
}: {
  done: number
  current: number
  fraction: number
  total: number
  finished: boolean
  view: string
  live: boolean
}) {
  const { source, cfg } = useApp()
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const ref = useRef<HTMLDivElement>(null)

  const all = useMemo(() => {
    const list: Alert[] = []
    const limit = Math.min(total, finished ? total : current + 1)
    for (let i = 0; i < limit; i++) {
      const alerts = source.alertsOf(source.rounds[i])
      list.push(
        ...(i < done || finished ? alerts : alerts.slice(0, Math.max(1, Math.ceil(alerts.length * fraction)))),
      )
    }
    if (finished) list.push(source.finalAlert())
    return alertsVisibleInView(list, view)
  }, [done, current, fraction, total, finished, view, source])

  const rows = all.filter((alert) => severity === 'all' || alert.severity === severity)
  const count = (value: Severity) => all.filter((alert) => alert.severity === value).length

  useEffect(() => {
    if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [rows.length, live])

  return (
    <Panel
      title="Registro de avisos adversariais"
      sub={
        cfg.runMode === 'deterministic'
          ? 'Sem interface: todos os avisos previstos no trabalho, na ordem em que ocorrem.'
          : 'Avisos da execução, na ordem em que ocorrem.'
      }
      right={
        <div className="flex flex-wrap gap-1 text-[10.5px]">
          {(
            [
              ['all', `Todos ${all.length}`],
              ['alert', `Alertas ${count('alert')}`],
              ['warn', `Avisos ${count('warn')}`],
              ['info', `Info ${count('info')}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={severity === key}
              onClick={() => setSeverity(key)}
              className={cx(
                'rounded-full border px-2 py-[2px] font-medium',
                severity === key ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div
        ref={ref}
        role="log"
        aria-live="off"
        className="scroll-thin max-h-[440px] overflow-auto rounded-md bg-ink p-3 font-mono text-[10.5px] leading-5 text-[#e4e7ec]"
      >
        {rows.length === 0 && <p className="text-[#98a2b3]">Aguardando eventos…</p>}
        {rows.map((alert, index) => (
          <div key={index} className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-white/5 py-0.5 last:border-0">
            <span className="w-10 shrink-0 text-[#98a2b3]">{alert.round === 99 ? 'fim' : `r${alert.round}`}</span>
            <span className={cx('flex w-[62px] shrink-0 items-center gap-1 font-semibold', SEVERITY[alert.severity].color)}>
              {SEVERITY[alert.severity].icon}
              {SEVERITY[alert.severity].label}
            </span>
            <span className="w-[150px] shrink-0 truncate text-[#f5d9a8]" title={alert.tag}>
              {alert.tag}
            </span>
            <span className="w-16 shrink-0 text-[#98a2b3]">{alert.actor}</span>
            <span className="min-w-[240px] flex-1">{alert.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
