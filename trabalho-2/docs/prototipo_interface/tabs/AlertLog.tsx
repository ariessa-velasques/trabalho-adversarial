import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { alertsOf, finalAlert, rounds, type Alert, type Sev } from '../data'
import { Panel, cx } from '../ui'

const SEV = {
  alert: { l: 'ALERTA', c: 'text-[#ff8a7a]', i: <OctagonAlert size={12} /> },
  warn: { l: 'AVISO', c: 'text-[#fdb022]', i: <AlertTriangle size={12} /> },
  info: { l: 'INFO', c: 'text-[#84caff]', i: <Info size={12} /> },
}

export default function AlertLog({ done, cur, frac, total, finished, view, live }: { done: number; cur: number; frac: number; total: number; finished: boolean; view: string; live: boolean }) {
  const [sev, setSev] = useState<Sev | 'all'>('all')
  const ref = useRef<HTMLDivElement>(null)
  const all = useMemo(() => {
    const list: Alert[] = []
    for (let i = 0; i < Math.min(total, finished ? total : cur + 1); i++) {
      const a = alertsOf(rounds[i])
      list.push(...(i < done || finished ? a : a.slice(0, Math.max(1, Math.ceil(a.length * frac)))))
    }
    if (finished) list.push(finalAlert())
    return list.filter((a) => a.vis === 'all' || view === 'eval' || a.vis === (view === 'bot' ? 'bot' : 'engine'))
  }, [done, cur, frac, total, finished, view])
  const rows = all.filter((a) => sev === 'all' || a.sev === sev)
  const n = (s: Sev) => all.filter((a) => a.sev === s).length

  useEffect(() => { if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [rows.length, live])

  return (
    <Panel title="Registro de avisos adversariais" sub="Modo bruto: sem interface, todos os avisos previstos no trabalho, na ordem em que ocorrem."
      right={<div className="flex gap-1.5 text-xs">
        {([['all', `Todos ${all.length}`], ['alert', `Alertas ${n('alert')}`], ['warn', `Avisos ${n('warn')}`], ['info', `Info ${n('info')}`]] as const).map(([k, l]) => (
          <button key={k} aria-pressed={sev === k} onClick={() => setSev(k)} className={cx('rounded-full border px-2.5 py-1 font-medium', sev === k ? 'border-ink bg-ink text-white' : 'border-line bg-white')}>{l}</button>
        ))}
      </div>}>
      <div ref={ref} role="log" aria-live="off" className="max-h-[460px] overflow-auto rounded-lg bg-ink p-3 font-mono text-xs leading-6 text-[#e4e7ec]">
        {rows.length === 0 && <p className="text-[#98a2b3]">Aguardando eventos…</p>}
        {rows.map((a, i) => (
          <div key={i} className="flex gap-3 border-b border-white/5 py-0.5 last:border-0">
            <span className="w-14 shrink-0 text-[#98a2b3]">{a.round === 99 ? 'fim' : `r${a.round}`}</span>
            <span className={cx('flex w-[68px] shrink-0 items-center gap-1 font-semibold', SEV[a.sev].c)}>{SEV[a.sev].i}{SEV[a.sev].l}</span>
            <span className="w-[170px] shrink-0 truncate text-[#fedf89]" title={a.tag}>{a.tag}</span>
            <span className="w-16 shrink-0 text-[#98a2b3]">{a.actor}</span>
            <span className="flex-1">{a.text}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
