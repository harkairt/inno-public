import { describe, it, expect } from 'vitest'
import { parseChartConfig } from '@/lib/validation/chart'

const validBarChart = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{ label: 'Sales', data: [10, 20, 30] }],
    },
    ...overrides,
  })

describe('parseChartConfig', () => {
  describe('valid configs', () => {
    it('parses a bar chart', () => {
      const result = parseChartConfig(validBarChart())
      expect(result).not.toBeNull()
      expect(result!.type).toBe('bar')
      expect(result!.data.datasets).toHaveLength(1)
    })

    it('parses a line chart with options', () => {
      const result = parseChartConfig(
        validBarChart({
          type: 'line',
          options: { scales: { y: { beginAtZero: true } } },
        }),
      )
      expect(result).not.toBeNull()
      expect(result!.type).toBe('line')
      expect(result!.options).toBeDefined()
    })

    it('parses scatter with point data', () => {
      const result = parseChartConfig(
        JSON.stringify({
          type: 'scatter',
          data: {
            datasets: [
              {
                data: [
                  { x: 1, y: 2 },
                  { x: 3, y: 4 },
                ],
              },
            ],
          },
        }),
      )
      expect(result).not.toBeNull()
    })

    it('allows extra dataset props via .loose()', () => {
      const result = parseChartConfig(
        JSON.stringify({
          type: 'bar',
          data: {
            labels: ['A'],
            datasets: [{ data: [1], barThickness: 20, hoverBackgroundColor: 'red' }],
          },
        }),
      )
      expect(result).not.toBeNull()
    })

    it.each(['bar', 'line', 'pie', 'doughnut', 'radar', 'scatter'] as const)(
      'accepts chart type "%s"',
      (type) => {
        const result = parseChartConfig(validBarChart({ type }))
        expect(result).not.toBeNull()
        expect(result!.type).toBe(type)
      },
    )

    it('accepts chart without labels', () => {
      const result = parseChartConfig(
        JSON.stringify({
          type: 'bar',
          data: { datasets: [{ data: [1, 2, 3] }] },
        }),
      )
      expect(result).not.toBeNull()
    })
  })

  describe('invalid JSON', () => {
    it('rejects malformed JSON', () => {
      expect(parseChartConfig('{not json}')).toBeNull()
    })

    it('rejects empty string', () => {
      expect(parseChartConfig('')).toBeNull()
    })
  })

  describe('size guard', () => {
    it('rejects input exceeding 50KB', () => {
      const huge = validBarChart({ padding: 'x'.repeat(51_000) })
      expect(parseChartConfig(huge)).toBeNull()
    })

    it('accepts input at boundary', () => {
      const filler = 'x'.repeat(49_000)
      const input = validBarChart({ padding: filler })
      expect(input.length).toBeLessThanOrEqual(50_000)
      expect(parseChartConfig(input)).not.toBeNull()
    })
  })

  describe('missing required fields', () => {
    it('rejects missing type', () => {
      const json = JSON.stringify({
        data: { datasets: [{ data: [1] }] },
      })
      expect(parseChartConfig(json)).toBeNull()
    })

    it('rejects missing data', () => {
      const json = JSON.stringify({ type: 'bar' })
      expect(parseChartConfig(json)).toBeNull()
    })

    it('rejects missing datasets', () => {
      const json = JSON.stringify({ type: 'bar', data: { labels: ['A'] } })
      expect(parseChartConfig(json)).toBeNull()
    })

    it('rejects empty datasets array', () => {
      const json = JSON.stringify({ type: 'bar', data: { datasets: [] } })
      expect(parseChartConfig(json)).toBeNull()
    })
  })

  describe('invalid values', () => {
    it('rejects unsupported chart type', () => {
      expect(parseChartConfig(validBarChart({ type: 'bubble' }))).toBeNull()
    })

    it('rejects more than 20 datasets', () => {
      const datasets = Array.from({ length: 21 }, (_, i) => ({ data: [i] }))
      const json = JSON.stringify({ type: 'bar', data: { datasets } })
      expect(parseChartConfig(json)).toBeNull()
    })

    it('rejects more than 1000 data points', () => {
      const data = Array.from({ length: 1001 }, (_, i) => i)
      const json = JSON.stringify({
        type: 'bar',
        data: { datasets: [{ data }] },
      })
      expect(parseChartConfig(json)).toBeNull()
    })

    it('rejects more than 500 labels', () => {
      const labels = Array.from({ length: 501 }, (_, i) => `L${i}`)
      const json = JSON.stringify({
        type: 'bar',
        data: { labels, datasets: [{ data: [1] }] },
      })
      expect(parseChartConfig(json)).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('allows null values in data array', () => {
      const result = parseChartConfig(
        JSON.stringify({
          type: 'line',
          data: { datasets: [{ data: [1, null, 3] }] },
        }),
      )
      expect(result).not.toBeNull()
      expect(result!.data.datasets[0].data).toEqual([1, null, 3])
    })

    it('allows dataset with type override', () => {
      const result = parseChartConfig(
        JSON.stringify({
          type: 'bar',
          data: {
            labels: ['A', 'B'],
            datasets: [{ data: [1, 2], type: 'line' }, { data: [3, 4] }],
          },
        }),
      )
      expect(result).not.toBeNull()
      expect(result!.data.datasets[0].type).toBe('line')
    })
  })
})
