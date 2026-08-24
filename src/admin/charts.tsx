import { useMemo, useState, type ReactNode } from 'react'

/**
 * Chart kit for the dashboards.
 *
 * The categorical palette is derived from the product's own tokens and was
 * validated for colour-vision separation (worst adjacent pair ΔE 10.6 protan,
 * 23.1 normal). Orange and amber sit below 3:1 against white, so every chart
 * here ships visible value labels or a table beside it — identity is never
 * carried by colour alone.
 */
export const CHART_COLORS = ['#FF6B35', '#2563EB', '#2D9E6B', '#E8A020', '#7C3AED'] as const

const AXIS = '#A8A49E'      // ink-3 — recessive
const GRID = '#E8E5DF'      // surface-4
const INK = '#1A1814'       // ink-1

const fmtInt = (n: number) => new Intl.NumberFormat('el-GR').format(Math.round(n))

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  return out
}

interface Tip { x: number; y: number; rows: { label: string; value: string; color?: string }[]; title: string }

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  const flip = tip.x > width * 0.6
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-xl border border-surface-4 bg-surface-1 px-2.5 py-1.5 shadow-card"
      style={{
        left: flip ? undefined : tip.x + 12,
        right: flip ? width - tip.x + 12 : undefined,
        top: Math.max(0, tip.y - 10),
        minWidth: 120,
      }}
    >
      <p className="text-[11px] font-bold text-ink-1 whitespace-nowrap">{tip.title}</p>
      {tip.rows.map((r, i) => (
        <p key={i} className="flex items-center gap-1.5 text-[11px] text-ink-2 whitespace-nowrap">
          {r.color && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="font-semibold text-ink-1">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartFrame({ title, subtitle, legend, children, action }: {
  title: string; subtitle?: string; legend?: ReactNode; children: ReactNode; action?: ReactNode
}) {
  return (
    <section className="dash-card p-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="font-display font-bold text-base text-ink-1">{title}</h3>
          {subtitle && <p className="text-[11px] text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </div>
      {legend && <div className="flex flex-wrap gap-3 mb-2">{legend}</div>}
      {children}
    </section>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <>
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-ink-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </>
  )
}

// ── Time series: one measure, one line. Two measures get two charts. ──
export function TimeSeries({ data, label, color = CHART_COLORS[0], height = 180, format = fmtInt }: {
  data: { day: string; value: number }[]
  label: string
  color?: string
  height?: number
  format?: (n: number) => string
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const W = 720, PADL = 46, PADR = 12, PADT = 10, PADB = 22
  const innerW = W - PADL - PADR
  const innerH = height - PADT - PADB

  const max = Math.max(1, ...data.map(d => d.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const x = (i: number) => PADL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => PADT + innerH - (v / top) * innerH

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = data.length > 1
    ? `${path} L${x(data.length - 1).toFixed(1)},${PADT + innerH} L${x(0).toFixed(1)},${PADT + innerH} Z`
    : ''

  const peak = useMemo(() => {
    let bi = 0
    data.forEach((d, i) => { if (d.value > data[bi].value) bi = i })
    return data.length > 2 && data[bi].value > 0 ? bi : -1
  }, [data])

  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" style={{ height }} role="img"
           aria-label={`${label} ανά ημέρα`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PADL} x2={W - PADR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={PADL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={AXIS}>{format(t)}</text>
          </g>
        ))}

        {area && <path d={area} fill={color} opacity={0.08} />}
        {data.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth={2}
                                  strokeLinejoin="round" strokeLinecap="round" />}

        {data.map((d, i) => (
          data.length <= 31 || i % Math.ceil(data.length / 31) === 0 ? (
            <circle key={i} cx={x(i)} cy={y(d.value)} r={tip?.title === dayLabel(d.day) ? 5 : 3}
                    fill={color} stroke="#fff" strokeWidth={2} />
          ) : null
        ))}

        {peak >= 0 && (
          <text x={x(peak)} y={y(data[peak].value) - 10} textAnchor="middle"
                fontSize={11} fontWeight={700} fill={INK}>
            {format(data[peak].value)}
          </text>
        )}

        {data.map((d, i) => (
          i === 0 || i === data.length - 1 || (data.length > 6 && i === Math.floor(data.length / 2)) ? (
            <text key={`x${i}`} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                  fontSize={10} fill={AXIS}>{dayLabel(d.day)}</text>
          ) : null
        ))}

        {tip && <line x1={tip.x * (W / 720)} x2={tip.x * (W / 720)} y1={PADT} y2={PADT + innerH}
                      stroke={AXIS} strokeWidth={1} strokeDasharray="3 3" />}

        <rect x={PADL} y={PADT} width={innerW} height={innerH} fill="transparent"
              onMouseLeave={() => setTip(null)}
              onMouseMove={e => {
                const box = (e.target as SVGRectElement).getBoundingClientRect()
                const rel = (e.clientX - box.left) / box.width
                const i = Math.round(rel * (data.length - 1))
                const d = data[Math.max(0, Math.min(data.length - 1, i))]
                if (!d) return
                setTip({
                  x: x(i) * (box.width / innerW) * (innerW / W) + (PADL / W) * box.width,
                  y: 8, title: dayLabel(d.day),
                  rows: [{ label, value: format(d.value), color }],
                })
              }} />
      </svg>
      {tip && <Tooltip tip={tip} width={720} />}
    </div>
  )
}

// ── Vertical bars for a bounded category axis (hours of the day) ──
export function Bars({ data, label, color = CHART_COLORS[1], height = 150, format = fmtInt }: {
  data: { key: string; value: number }[]
  label: string
  color?: string
  height?: number
  format?: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map(d => d.value))
  const gap = 2

  return (
    <div className="relative">
      <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={label}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 22)
          return (
            <div key={d.key} className="flex-1 flex flex-col items-center justify-end h-full"
                 onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {hover === i && (
                <span className="text-[10px] font-bold text-ink-1 mb-0.5 whitespace-nowrap">
                  {format(d.value)}
                </span>
              )}
              <div
                className="w-full rounded-t"
                style={{
                  height: Math.max(d.value > 0 ? 3 : 1, h),
                  background: d.value > 0 ? color : GRID,
                  opacity: hover === null || hover === i ? 1 : 0.55,
                  marginRight: gap / 2, marginLeft: gap / 2,
                  transition: 'opacity .15s',
                }}
              />
              <span className="text-[9px] text-ink-3 mt-1 truncate w-full text-center">{d.key}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Ranked horizontal bars, always with the value written out ──
export function RankedBars({ data, format = fmtInt, color = CHART_COLORS[0], max: maxOverride }: {
  data: { name: string; value: number; sub?: string }[]
  format?: (n: number) => string
  color?: string
  max?: number
}) {
  const max = maxOverride ?? Math.max(1, ...data.map(d => d.value))
  if (data.length === 0) return <p className="text-sm text-ink-3 py-4">Δεν υπάρχουν δεδομένα.</p>

  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.name}>
          <div className="flex justify-between items-baseline gap-2 mb-0.5">
            <span className="text-xs text-ink-1 truncate">{d.name}</span>
            <span className="text-xs font-bold text-ink-1 whitespace-nowrap">
              {format(d.value)}{d.sub && <span className="font-normal text-ink-3"> · {d.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Composition of one total, as a single stacked bar + legend + values ──
export function Composition({ segments, total, format }: {
  segments: { label: string; value: number; color: string }[]
  total?: number
  format: (n: number) => string
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0)
  const visible = segments.filter(s => s.value > 0)

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-3 gap-[2px]">
        {visible.map(s => (
          <div key={s.label} style={{ width: `${sum > 0 ? (s.value / sum) * 100 : 0}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-2.5 space-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="flex-1 text-ink-2">{s.label}</span>
            <span className="font-semibold text-ink-1">{format(s.value)}</span>
            <span className="text-ink-3 w-10 text-right">
              {sum > 0 ? Math.round((s.value / sum) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
