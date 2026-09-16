import type { HistoryRange, Reading, SystemType } from '@/domain'

/** Small deterministic PRNG so charts are stable between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

interface MetricSpec {
  metric: string
  base: number
  amplitude: number
  noise: number
  decimals: number
  /** 0..1 phase offset of the daily sine wave */
  phase: number
}

const METRICS: Record<SystemType, MetricSpec[]> = {
  Heating: [
    { metric: 'currentTemp', base: 20.5, amplitude: 1.2, noise: 0.25, decimals: 1, phase: 0.35 },
    { metric: 'targetTemp', base: 21, amplitude: 0, noise: 0, decimals: 0, phase: 0 },
    { metric: 'humidity', base: 45, amplitude: 6, noise: 2, decimals: 0, phase: 0.6 },
  ],
  Cooling: [
    { metric: 'currentTemp', base: 23.8, amplitude: 1.8, noise: 0.3, decimals: 1, phase: 0.2 },
    { metric: 'targetTemp', base: 23, amplitude: 0, noise: 0, decimals: 0, phase: 0 },
  ],
  Irrigation: [
    { metric: 'soilMoisture', base: 42, amplitude: 10, noise: 3, decimals: 0, phase: 0.75 },
    { metric: 'flowLitersPerHour', base: 35, amplitude: 35, noise: 8, decimals: 0, phase: 0.1 },
  ],
  Appliance: [{ metric: 'powerDrawWatts', base: 600, amplitude: 600, noise: 120, decimals: 0, phase: 0.45 }],
}

export function generateHistory(systemId: string, type: SystemType, range: HistoryRange): Reading[] {
  const rand = mulberry32(hash(systemId + range))
  const now = Date.now()
  const stepMs = range === '24h' ? 15 * 60_000 : 60 * 60_000
  const points = range === '24h' ? 96 : 168
  const readings: Reading[] = []

  for (const spec of METRICS[type]) {
    for (let i = points - 1; i >= 0; i--) {
      const ts = now - i * stepMs
      const dayFraction = (((ts / 86_400_000) % 1) + spec.phase) % 1
      const wave = Math.sin(dayFraction * Math.PI * 2) * spec.amplitude
      const jitter = (rand() - 0.5) * 2 * spec.noise
      const raw = Math.max(0, spec.base + wave + jitter)
      readings.push({
        timestamp: new Date(ts).toISOString(),
        metric: spec.metric,
        value: Number(raw.toFixed(spec.decimals)),
      })
    }
  }

  return readings.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
