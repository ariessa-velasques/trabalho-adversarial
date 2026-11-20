import { useState } from 'react'
import { Panel } from './ui'

export interface Series {
  name: string
  color: string
  values: number[]
  dashed?: boolean
}

const W = 560
const H = 230
const PAD = { left: 46, right: 40, top: 14, bottom: 30 }

const niceMax = (value: number) => {
  const power = 10 ** Math.floor(Math.log10(Math.max(value, 1)))
  const fraction = value / power
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
}

export function Chart({
  title,
  sub,
  labels,
  bars = [],
  lines = [],
  stacked,
  unit = '',
  unit2 = '',
  format = (n) => String(n),
  format2,
  reference,
  dualAxis,
  description,
}: {
  title: string
  sub?: string
  labels: string[]
  bars?: Series[]
  lines?: Series[]
  stacked?: boolean
  unit?: string
  unit2?: string
  format?: (n: number) => string
  format2?: (n: number) => string
  reference?: { value: number; label: string }
  dualAxis?: boolean
  description: string
}) {
  const [showTable, setShowTable] = useState(false)
  const count = labels.length

  const barMax = Math.max(
    1,
    ...(stacked
      ? labels.map((_, index) => bars.reduce((acc, series) => acc + (series.values[index] ?? 0), 0))
      : bars.flatMap((series) => series.values)),
  )
  const lineValues = lines.flatMap((series) => series.values)
  const lineMax = Math.max(1, ...lineValues, reference && !dualAxis && !bars.length ? reference.value : 0)
  const primaryMax = bars.length ? barMax : lineMax
  const useSecondAxis = Boolean(dualAxis && bars.length > 0 && lines.length > 0)
  const leftMax = niceMax(Math.max(primaryMax, !useSecondAxis && reference ? reference.value : 0))
  const rightMax = niceMax(useSecondAxis ? Math.max(lineMax, reference ? reference.value : 0) : lineMax)
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(count, 1)
  const y = (value: number, max = leftMax) => PAD.top + innerH - (value / max) * innerH
  const x = (index: number) => PAD.left + slot * index + slot / 2
  const barWidth = Math.min(36, (slot * 0.68) / (stacked ? 1 : Math.max(bars.length, 1)))
  const lineMaxAxis = useSecondAxis ? rightMax : leftMax
  const formatLine = format2 ?? format
  const ticks = [0, 0.5, 1]

  return (
    <Panel
      title={title}
      sub={sub}
      right={
        <button
          type="button"
          onClick={() => setShowTable((current) => !current)}
          className="text-[11.5px] font-medium text-limited underline decoration-limited/40 underline-offset-2 hover:decoration-limited"
          aria-expanded={showTable}
        >
          {showTable ? 'Ver gráfico' : 'Ver dados'}
        </button>
      }
    >
      {showTable ? (
        <div className="overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-1 pr-2 font-medium">Rodada</th>
                {[...bars, ...lines].map((series) => (
                  <th key={series.name} className="py-1 pr-2 font-medium">
                    {series.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => (
                <tr key={label} className="border-t border-line">
                  <td className="py-1 pr-2">{label}</td>
                  {bars.map((series) => (
                    <td key={series.name} className="num py-1 pr-2">
                      {format(series.values[index] ?? 0)}
                    </td>
                  ))}
                  {lines.map((series) => (
                    <td key={series.name} className="num py-1 pr-2">
                      {formatLine(series.values[index] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} className="w-full">
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(leftMax * tick)}
                  y2={y(leftMax * tick)}
                  stroke="#e1e4de"
                />
                <text x={PAD.left - 7} y={y(leftMax * tick) + 4} textAnchor="end" fontSize="10" fill="#5c6661">
                  {format(leftMax * tick)}
                </text>
                {useSecondAxis && (
                  <text x={W - PAD.right + 7} y={y(rightMax * tick) + 4} fontSize="10" fill="#5c6661">
                    {formatLine(rightMax * tick)}
                  </text>
                )}
              </g>
            ))}

            <text x={PAD.left - 7} y={9} textAnchor="end" fontSize="9" fill="#8a938e">
              {unit}
            </text>
            {useSecondAxis && (
              <text x={W - PAD.right + 7} y={9} fontSize="9" fill="#8a938e">
                {unit2}
              </text>
            )}

            {labels.map((label, index) => (
              <text key={label} x={x(index)} y={H - 10} textAnchor="middle" fontSize="10" fill="#5c6661">
                {label}
              </text>
            ))}

            {bars.map((series, seriesIndex) =>
              series.values.map((value, index) => {
                const before = stacked
                  ? bars.slice(0, seriesIndex).reduce((acc, item) => acc + (item.values[index] ?? 0), 0)
                  : 0
                const barX = stacked
                  ? x(index) - barWidth / 2
                  : x(index) - (barWidth * bars.length) / 2 + seriesIndex * barWidth
                const top = y(before + value)
                const base = y(before)
                return (
                  <rect
                    key={`${series.name}-${index}`}
                    x={barX}
                    y={top}
                    width={Math.max(1, barWidth - 1)}
                    height={Math.max(0, base - top)}
                    fill={series.color}
                    rx="1"
                  >
                    <title>{`${series.name} · ${labels[index]}: ${format(value)}`}</title>
                  </rect>
                )
              }),
            )}

            {reference && (
              <g>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(reference.value, lineMaxAxis)}
                  y2={y(reference.value, lineMaxAxis)}
                  stroke="#161a18"
                  strokeDasharray="4 3"
                />
              </g>
            )}

            {lines.map((series) => (
              <g key={series.name}>
                <polyline
                  fill="none"
                  stroke={series.color}
                  strokeWidth="2"
                  strokeDasharray={series.dashed ? '5 3' : undefined}
                  strokeLinejoin="round"
                  points={series.values.map((value, index) => `${x(index)},${y(value, lineMaxAxis)}`).join(' ')}
                />
                {series.values.map((value, index) => (
                  <circle
                    key={index}
                    cx={x(index)}
                    cy={y(value, lineMaxAxis)}
                    r="3.5"
                    fill="#fff"
                    stroke={series.color}
                    strokeWidth="2"
                  >
                    <title>{`${series.name} · ${labels[index]}: ${formatLine(value)}`}</title>
                  </circle>
                ))}
              </g>
            ))}
          </svg>

          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            {bars.map((series) => (
              <li key={series.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: series.color }} />
                {series.name}
              </li>
            ))}
            {lines.map((series) => (
              <li key={series.name} className="flex items-center gap-1.5">
                <svg width="18" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    x2="18"
                    y1="4"
                    y2="4"
                    stroke={series.color}
                    strokeWidth="2"
                    strokeDasharray={series.dashed ? '5 3' : undefined}
                  />
                </svg>
                {series.name}
              </li>
            ))}
            {reference && (
              <li className="flex items-center gap-1.5">
                <svg width="18" height="8" aria-hidden="true">
                  <line x1="0" x2="18" y1="4" y2="4" stroke="#161a18" strokeWidth="1.5" strokeDasharray="4 3" />
                </svg>
                {reference.label}
              </li>
            )}
          </ul>
        </>
      )}
    </Panel>
  )
}
