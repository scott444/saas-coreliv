import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Reading } from '@/domain'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTime } from '@/lib/format'

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  currentTemp: { label: 'Temperature', unit: '°C' },
  targetTemp: { label: 'Target', unit: '°C' },
  humidity: { label: 'Humidity', unit: '%' },
  soilMoisture: { label: 'Soil moisture', unit: '%' },
  flowLitersPerHour: { label: 'Flow', unit: 'L/h' },
  powerDrawWatts: { label: 'Power draw', unit: 'W' },
}

const SERIES_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)']

/** Metrics that share an axis are drawn together; each group becomes a tab. */
const GROUPS: string[][] = [['currentTemp', 'targetTemp'], ['humidity'], ['soilMoisture'], ['flowLitersPerHour'], ['powerDrawWatts']]

interface ChartRow {
  timestamp: number
  [metric: string]: number
}

export function HistoryChart({ readings }: { readings: Reading[] }) {
  const groups = useMemo(() => {
    const present = new Set(readings.map((r) => r.metric))
    return GROUPS.map((g) => g.filter((m) => present.has(m))).filter((g) => g.length > 0)
  }, [readings])

  const [activeIndex, setActiveIndex] = useState(0)
  const active = groups[Math.min(activeIndex, groups.length - 1)] ?? []

  const rows = useMemo<ChartRow[]>(() => {
    const byTs = new Map<number, ChartRow>()
    for (const r of readings) {
      if (!active.includes(r.metric)) continue
      const ts = new Date(r.timestamp).getTime()
      const row = byTs.get(ts) ?? { timestamp: ts }
      row[r.metric] = r.value
      byTs.set(ts, row)
    }
    return [...byTs.values()].sort((a, b) => a.timestamp - b.timestamp)
  }, [readings, active])

  if (groups.length === 0) return null
  const unit = METRIC_LABELS[active[0] ?? '']?.unit ?? ''

  return (
    <div className="space-y-3">
      {groups.length > 1 ? (
        <Tabs value={String(Math.min(activeIndex, groups.length - 1))} onValueChange={(v) => setActiveIndex(Number(v))}>
          <TabsList>
            {groups.map((g, i) => (
              <TabsTrigger key={g.join('+')} value={String(i)}>
                {METRIC_LABELS[g[0] ?? '']?.label ?? g[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className="h-64 w-full" role="img" aria-label={`${METRIC_LABELS[active[0] ?? '']?.label ?? 'History'} over the last 24 hours`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => formatTime(new Date(v).toISOString())}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              stroke="var(--color-border)"
              minTickGap={40}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              stroke="var(--color-border)"
              tickFormatter={(v: number) => `${v}${unit}`}
              width={56}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => formatTime(new Date(Number(v)).toISOString())}
              formatter={(value, name) => [`${value}${unit}`, METRIC_LABELS[String(name)]?.label ?? String(name)]}
            />
            {active.map((metric, i) => (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={metric === 'targetTemp' ? 1 : 2}
                strokeDasharray={metric === 'targetTemp' ? '4 4' : undefined}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
