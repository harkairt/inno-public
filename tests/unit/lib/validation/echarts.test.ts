import { describe, it, expect } from 'vitest'
import { parseEChartsOption, hasActionableItems, MAX_PROMPT_LENGTH } from '@/lib/validation/echarts'

const validBarChart = {
  title: { text: 'Revenue by region' },
  tooltip: {},
  xAxis: { type: 'category', data: ['North', 'South'] },
  yAxis: { type: 'value' },
  series: [{ name: 'Q4', type: 'bar', data: [820, 932] }],
}

function reasonOf(json: string): string | undefined {
  const result = parseEChartsOption(json)
  return result.isErr() ? result.error.reason : undefined
}

describe('S1 parseEChartsOption — valid definitions', () => {
  it('accepts a valid bar chart and returns exactly what JSON.parse would', () => {
    const json = JSON.stringify(validBarChart)
    const result = parseEChartsOption(json)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(JSON.parse(json))
  })

  it('does not require series, axes or a known chart kind', () => {
    expect(parseEChartsOption('{"title":{"text":"just a title"}}').isOk()).toBe(true)
    expect(parseEChartsOption('{"series":[{"type":"notAKindWeKnow"}]}').isOk()).toBe(true)
  })
})

describe('S2 parseEChartsOption — size guard', () => {
  it('rejects a body over 50 000 characters', () => {
    const padded = `{"title":{"text":"${'a'.repeat(50_000)}"}}`
    expect(reasonOf(padded)).toBe('oversize')
  })

  it('reports oversize rather than unparseable for an oversize non-JSON body', () => {
    expect(reasonOf('x'.repeat(50_001))).toBe('oversize')
  })

  it('accepts a body of exactly 50 000 characters', () => {
    const filler = 'a'.repeat(50_000 - '{"title":{"text":""}}'.length)
    const exact = `{"title":{"text":"${filler}"}}`
    expect(exact).toHaveLength(50_000)
    expect(parseEChartsOption(exact).isOk()).toBe(true)
  })
})

describe('S3, S4 parseEChartsOption — structure', () => {
  it('rejects truncated JSON as unparseable', () => {
    expect(reasonOf('{"series": [{"type": "bar"')).toBe('unparseable')
  })

  it.each([['{}'], ['[]'], ['null'], ['3'], ['""']])(
    'rejects %s as not-an-object',
    (json: string) => {
      expect(reasonOf(json)).toBe('not-an-object')
    },
  )
})

describe('S5, S6 parseEChartsOption — external references', () => {
  it('rejects an image:// reference nested deep inside a series markPoint', () => {
    const json = JSON.stringify({
      series: [
        {
          type: 'bar',
          data: [1],
          markPoint: { data: [{ symbol: 'image://https://example.com/a.png' }] },
        },
      ],
    })

    expect(reasonOf(json)).toBe('external-reference')
  })

  it.each([
    ['absolute https', 'https://example.com/a.png'],
    ['protocol-relative', '//cdn.example.com/a.png'],
    ['data URI', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['javascript scheme', 'javascript:alert(1)'],
    ['file scheme', 'file:///etc/passwd'],
    ['uppercase scheme', 'HTTPS://example.com/a.png'],
  ])('rejects a %s value', (_label: string, value: string) => {
    expect(reasonOf(JSON.stringify({ series: [{ type: 'bar', symbol: value }] }))).toBe(
      'external-reference',
    )
  })

  it('rejects an external reference regardless of which key carries it', () => {
    const json = JSON.stringify({ graphic: { type: 'image', style: { image: 'https://x/y.png' } } })
    expect(reasonOf(json)).toBe('external-reference')
  })
})

describe('S7, S8 parseEChartsOption — navigation targets', () => {
  it('rejects a title link', () => {
    expect(reasonOf('{"title":{"text":"x","link":"/x"}}')).toBe('navigation-target')
  })

  it('rejects a nested sublink', () => {
    const json = JSON.stringify({ title: { text: 'x', subtext: 'y', sublink: '/y' } })
    expect(reasonOf(json)).toBe('navigation-target')
  })

  it('accepts a sankey definition whose links carry source/target endpoints', () => {
    const json = JSON.stringify({
      series: [
        {
          type: 'sankey',
          data: [{ name: 'a' }, { name: 'b' }],
          links: [{ source: 'a', target: 'b', value: 5 }],
        },
      ],
    })

    expect(parseEChartsOption(json).isOk()).toBe(true)
  })

  it('accepts an empty link value', () => {
    expect(parseEChartsOption('{"title":{"text":"x","link":""}}').isOk()).toBe(true)
  })
})

describe('S9 parseEChartsOption — text is never inspected for markup', () => {
  it.each([
    ['a less-than sign in a label', 'Revenue < 100k'],
    ['script-shaped text', '<script>alert(1)</script>'],
    ['a URL inside prose', 'see http://wiki for detail'],
  ])('accepts %s and passes it through untouched', (_label: string, label: string) => {
    const json = JSON.stringify({
      xAxis: { type: 'category', data: [label] },
      series: [{ type: 'bar', data: [1] }],
    })

    const result = parseEChartsOption(json)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(JSON.parse(json))
  })
})

const withPrompt = (prompt: unknown) => ({
  xAxis: { type: 'category', data: ['North'] },
  series: [{ type: 'bar', data: [{ value: 820, prompt }] }],
})

describe('S30 parseEChartsOption — a valid prompt survives untouched', () => {
  it('returns the authored prompt text exactly as written', () => {
    const json = JSON.stringify(withPrompt('Why did North drop?'))
    const result = parseEChartsOption(json)

    expect(result.isOk()).toBe(true)
    const option = result._unsafeUnwrap() as {
      series: { data: { prompt: string }[] }[]
    }
    expect(option.series[0]!.data[0]!.prompt).toBe('Why did North drop?')
    expect(option).toEqual(JSON.parse(json))
  })
})

describe('S31, S31a hasActionableItems', () => {
  it('S31 is true when a valid prompt is present', () => {
    expect(hasActionableItems(withPrompt('Why?'))).toBe(true)
  })

  it('S31 is false for the same chart without a prompt', () => {
    expect(
      hasActionableItems({
        xAxis: { type: 'category', data: ['North'] },
        series: [{ type: 'bar', data: [{ value: 820 }] }],
      }),
    ).toBe(false)
  })

  it('S31 is false for an empty option', () => {
    expect(hasActionableItems({})).toBe(false)
  })

  it('S31a is false when "prompt" only appears inside a label or series name', () => {
    expect(
      hasActionableItems({
        title: { text: 'prompt latency' },
        xAxis: { type: 'category', data: ['prompt'] },
        series: [{ name: 'prompt latency', type: 'bar', data: [1] }],
      }),
    ).toBe(false)
  })
})

describe('S32 parseEChartsOption — a prompt that is not usable text', () => {
  it.each([
    ['a number', 42],
    ['null', null],
    ['an object', { text: 'why' }],
    ['an empty string', ''],
    ['whitespace only', '   '],
  ])('rejects %s with invalid-prompt', (_label: string, prompt: unknown) => {
    expect(reasonOf(JSON.stringify(withPrompt(prompt)))).toBe('invalid-prompt')
  })
})

describe('S33 parseEChartsOption — prompt length boundary', () => {
  it('accepts exactly MAX_PROMPT_LENGTH characters', () => {
    expect(
      parseEChartsOption(JSON.stringify(withPrompt('a'.repeat(MAX_PROMPT_LENGTH)))).isOk(),
    ).toBe(true)
  })

  it('rejects one character over the limit', () => {
    expect(reasonOf(JSON.stringify(withPrompt('a'.repeat(MAX_PROMPT_LENGTH + 1))))).toBe(
      'invalid-prompt',
    )
  })
})

describe('S34 parseEChartsOption — prompts at any depth', () => {
  it('accepts prompts in series data and in a markPoint', () => {
    const option = {
      series: [
        { type: 'bar', data: [1, 2, 3, { value: 4, prompt: 'Why the spike?' }] },
        {
          type: 'line',
          data: [5],
          markPoint: { data: [{ name: 'peak', prompt: 'What caused the peak?' }] },
        },
      ],
    }

    const result = parseEChartsOption(JSON.stringify(option))
    expect(result.isOk()).toBe(true)
    expect(hasActionableItems(result._unsafeUnwrap())).toBe(true)
  })
})

describe('S35, S36 parseEChartsOption — prompt content rules', () => {
  it('S35 rejects a URL-shaped prompt as external-reference, not invalid-prompt', () => {
    expect(reasonOf(JSON.stringify(withPrompt('https://x')))).toBe('external-reference')
  })

  it('S36 accepts markup-shaped prompt text and passes it through untouched', () => {
    const json = JSON.stringify(withPrompt('<b>why</b>'))
    const result = parseEChartsOption(json)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(JSON.parse(json))
  })
})
