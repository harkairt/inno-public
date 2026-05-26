import { z } from 'zod'

const MAX_CONFIG_JSON_SIZE = 50_000

const allowedChartTypes = ['bar', 'line', 'pie', 'doughnut', 'radar', 'scatter'] as const

const datasetSchema = z
  .object({
    label: z.string().optional(),
    data: z
      .array(
        z.union([
          z.number(),
          z.null(),
          z.object({
            x: z.union([z.number(), z.string()]),
            y: z.number(),
          }),
        ]),
      )
      .max(1000),
    backgroundColor: z.union([z.string(), z.array(z.string())]).optional(),
    borderColor: z.union([z.string(), z.array(z.string())]).optional(),
    borderWidth: z.number().optional(),
    fill: z.union([z.boolean(), z.string(), z.number()]).optional(),
    tension: z.number().optional(),
    pointRadius: z.number().optional(),
    pointBackgroundColor: z.string().optional(),
    pointBorderColor: z.string().optional(),
    type: z.enum(allowedChartTypes).optional(),
    hidden: z.boolean().optional(),
  })
  // Chart.js datasets accept many type-specific styling props; .loose() allows passthrough while validating core fields. Safe because JSON.parse cannot produce functions.
  .loose()

const dataSchema = z.object({
  labels: z
    .array(z.union([z.string(), z.number()]))
    .max(500)
    .optional(),
  datasets: z.array(datasetSchema).min(1).max(20),
})

// Options are loosely validated — Chart.js options API is deeply nested and context-dependent; the 50KB size guard bounds total payload.
const chartConfigSchema = z.object({
  type: z.enum(allowedChartTypes),
  data: dataSchema,
  options: z.record(z.string(), z.unknown()).optional(),
})

export type ChartConfig = z.infer<typeof chartConfigSchema>

export const parseChartConfig = (jsonString: string): ChartConfig | null => {
  if (jsonString.length > MAX_CONFIG_JSON_SIZE) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(jsonString)
    const result = chartConfigSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}
