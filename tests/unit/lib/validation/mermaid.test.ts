import { describe, expect, it } from 'vitest'
import { parseMermaidData } from '@/lib/validation/mermaid'

const reasonOf = (source: string) => {
  const result = parseMermaidData(source)
  return result.isErr() ? result.error.reason : undefined
}

describe('parseMermaidData', () => {
  it('accepts a static Mermaid diagram without transforming its source', () => {
    const source = 'flowchart LR\n  A[Start] --> B[Finish]'
    const result = parseMermaidData(source)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ source })
  })

  it('rejects blank content', () => {
    expect(reasonOf(' \n\t ')).toBe('empty')
  })

  it('rejects content over the size limit before further parsing', () => {
    expect(reasonOf('x'.repeat(50_001))).toBe('oversize')
  })

  it.each([
    'flowchart LR\n A --> B[https://example.com]',
    'flowchart LR\n A --> B[data:text/plain,unsafe]',
    'flowchart LR\n A --> B[//example.com]',
  ])('rejects external references', (source) => {
    expect(reasonOf(source)).toBe('external-reference')
  })

  it.each([
    '%%{init: { "theme": "dark" }}%%\nflowchart LR\n A --> B',
    '---\ntitle: Unsafe\n---\nflowchart LR\n A --> B',
  ])('rejects diagram-authored configuration', (source) => {
    expect(reasonOf(source)).toBe('directive')
  })

  it('rejects interactive click statements', () => {
    expect(reasonOf('flowchart LR\n A --> B\n click A "https://example.com"')).toBe(
      'external-reference',
    )
    expect(reasonOf('flowchart LR\n A --> B\n click A callback')).toBe('interactive')
  })

  it('rejects HTML labels', () => {
    expect(reasonOf('flowchart LR\n A[<b>Unsafe</b>] --> B')).toBe('html-label')
  })
})
