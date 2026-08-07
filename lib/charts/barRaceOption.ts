import type { BarRaceData } from '@/lib/validation/barRace'

export const BAR_RACE_FRAME_INTERVAL_MS = 1000
export const BAR_RACE_UPDATE_DURATION_MS = 800

export function formatFrameLabel(data: BarRaceData, frameIndex: number): string {
  const value = data.start + frameIndex * data.step
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function buildBarRaceOption(data: BarRaceData, frameIndex: number): Record<string, unknown> {
  const frame = data.frames[frameIndex] ?? {}
  const maxVisible =
    data.maxBars != null
      ? Math.min(data.maxBars, data.categories.length) - 1
      : data.categories.length - 1

  return {
    xAxis: {
      type: 'value',
      max: 'dataMax',
    },
    yAxis: {
      type: 'category',
      data: data.categories,
      inverse: data.sort !== 'asc',
      max: maxVisible,
      animationDuration: 300,
      animationDurationUpdate: 300,
    },
    series: [
      {
        type: 'bar',
        realtimeSort: true,
        seriesLayoutBy: 'column',
        label: {
          show: true,
          position: 'right',
          valueAnimation: true,
        },
        data: data.categories.map((name) => ({
          name,
          value: frame[name] ?? 0,
        })),
      },
    ],
    grid: {
      right: 80,
      left: 10,
      containLabel: true,
    },
    animationDuration: 0,
    animationDurationUpdate: BAR_RACE_UPDATE_DURATION_MS,
    animationEasingUpdate: 'linear' as const,
  }
}
