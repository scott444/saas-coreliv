export interface Reading {
  timestamp: string
  metric: string
  value: number
}

export type HistoryRange = '24h' | '7d'
