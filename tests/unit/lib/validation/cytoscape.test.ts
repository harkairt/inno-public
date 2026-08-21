import { describe, it, expect } from 'vitest'
import { parseCytoscapeConfig } from '@/lib/validation/cytoscape'

const validGraph = {
  elements: {
    nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
    edges: [{ data: { source: 'a', target: 'b' } }],
  },
}

const validFlatElements = {
  elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }, { data: { source: 'a', target: 'b' } }],
}

function reasonOf(json: string): string | undefined {
  const result = parseCytoscapeConfig(json)
  return result.isErr() ? result.error.reason : undefined
}

describe('parseCytoscapeConfig — valid configs', () => {
  it('accepts a valid graph with object-form elements', () => {
    const json = JSON.stringify(validGraph)
    const result = parseCytoscapeConfig(json)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().elements).toEqual(validGraph.elements)
  })

  it('accepts a valid graph with flat array elements', () => {
    const json = JSON.stringify(validFlatElements)
    const result = parseCytoscapeConfig(json)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().elements).toEqual(validFlatElements.elements)
  })

  it('accepts optional layout and style fields', () => {
    const config = {
      ...validGraph,
      layout: { name: 'circle' },
      style: [{ selector: 'node', style: { 'background-color': '#f00' } }],
    }
    const result = parseCytoscapeConfig(JSON.stringify(config))

    expect(result.isOk()).toBe(true)
    const value = result._unsafeUnwrap()
    expect(value.layout).toEqual({ name: 'circle' })
    expect(value.style).toEqual(config.style)
  })

  it('omits layout and style from result when not present in input', () => {
    const result = parseCytoscapeConfig(JSON.stringify(validGraph))

    expect(result.isOk()).toBe(true)
    const value = result._unsafeUnwrap()
    expect(value.layout).toBeUndefined()
    expect(value.style).toBeUndefined()
  })
})

describe('parseCytoscapeConfig — size guard', () => {
  it('rejects a body over 50 000 characters', () => {
    const padded = JSON.stringify({
      elements: { nodes: [{ data: { id: 'a'.repeat(50_000) } }], edges: [] },
    })
    expect(reasonOf(padded)).toBe('oversize')
  })

  it('reports oversize rather than unparseable for an oversize non-JSON body', () => {
    expect(reasonOf('x'.repeat(50_001))).toBe('oversize')
  })
})

describe('parseCytoscapeConfig — structure', () => {
  it('rejects truncated JSON as unparseable', () => {
    expect(reasonOf('{"elements": {')).toBe('unparseable')
  })

  it.each([['{}'], ['[]'], ['null'], ['3'], ['""']])(
    'rejects %s as not-an-object',
    (json: string) => {
      expect(reasonOf(json)).toBe('not-an-object')
    },
  )
})

describe('parseCytoscapeConfig — missing/invalid elements', () => {
  it('rejects when elements is missing', () => {
    expect(reasonOf('{"layout":{"name":"grid"}}')).toBe('missing-elements')
  })

  it('rejects empty elements object', () => {
    expect(reasonOf(JSON.stringify({ elements: { nodes: [], edges: [] } }))).toBe(
      'invalid-elements',
    )
  })

  it('rejects empty elements array', () => {
    expect(reasonOf(JSON.stringify({ elements: [] }))).toBe('invalid-elements')
  })

  it('rejects node without data.id', () => {
    expect(reasonOf(JSON.stringify({ elements: { nodes: [{ data: {} }], edges: [] } }))).toBe(
      'invalid-elements',
    )
  })

  it('rejects edge without data.source', () => {
    expect(
      reasonOf(
        JSON.stringify({
          elements: {
            nodes: [{ data: { id: 'a' } }],
            edges: [{ data: { target: 'a' } }],
          },
        }),
      ),
    ).toBe('invalid-elements')
  })

  it('rejects edge without data.target', () => {
    expect(
      reasonOf(
        JSON.stringify({
          elements: {
            nodes: [{ data: { id: 'a' } }],
            edges: [{ data: { source: 'a' } }],
          },
        }),
      ),
    ).toBe('invalid-elements')
  })

  it('rejects flat array with invalid element', () => {
    expect(reasonOf(JSON.stringify({ elements: [{ data: {} }] }))).toBe('invalid-elements')
  })
})

describe('parseCytoscapeConfig — layout allowlist', () => {
  it.each(['cose', 'grid', 'circle', 'breadthfirst', 'concentric', 'random', 'preset', 'null'])(
    'accepts layout %s',
    (name) => {
      const json = JSON.stringify({ ...validGraph, layout: { name } })
      expect(parseCytoscapeConfig(json).isOk()).toBe(true)
    },
  )

  it('rejects an unknown layout', () => {
    expect(reasonOf(JSON.stringify({ ...validGraph, layout: { name: 'dagre' } }))).toBe(
      'invalid-layout',
    )
  })

  it('rejects layout without name', () => {
    expect(reasonOf(JSON.stringify({ ...validGraph, layout: { spacing: 50 } }))).toBe(
      'invalid-layout',
    )
  })
})

describe('parseCytoscapeConfig — style allowlist', () => {
  it('accepts style with allowed properties', () => {
    const config = {
      ...validGraph,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#f00',
            'border-color': '#000',
            shape: 'ellipse',
            label: 'data(id)',
          },
        },
      ],
    }
    expect(parseCytoscapeConfig(JSON.stringify(config)).isOk()).toBe(true)
  })

  it('rejects background-image in style', () => {
    const config = {
      ...validGraph,
      style: [{ selector: 'node', style: { 'background-image': 'url(x.png)' } }],
    }
    expect(reasonOf(JSON.stringify(config))).toBe('invalid-style')
  })

  it('rejects unknown style property', () => {
    const config = {
      ...validGraph,
      style: [{ selector: 'node', style: { 'z-index': 99 } }],
    }
    expect(reasonOf(JSON.stringify(config))).toBe('invalid-style')
  })

  it('rejects style rule without selector', () => {
    const config = {
      ...validGraph,
      style: [{ style: { 'background-color': '#f00' } }],
    }
    expect(reasonOf(JSON.stringify(config))).toBe('invalid-style')
  })

  it('rejects non-array style', () => {
    const config = {
      ...validGraph,
      style: { selector: 'node', style: { 'background-color': '#f00' } },
    }
    expect(reasonOf(JSON.stringify(config))).toBe('invalid-style')
  })
})

describe('parseCytoscapeConfig — external references', () => {
  it.each([
    [
      'https URL in node data',
      { elements: { nodes: [{ data: { id: 'a', icon: 'https://x.com/i.png' } }], edges: [] } },
    ],
    [
      'data URI in style',
      {
        ...validGraph,
        style: [
          { selector: 'node', style: { 'background-color': 'data:image/svg+xml;base64,PHN2Zz4=' } },
        ],
      },
    ],
    [
      'javascript scheme',
      { elements: { nodes: [{ data: { id: 'a', label: 'javascript:alert(1)' } }], edges: [] } },
    ],
    [
      'protocol-relative',
      { elements: { nodes: [{ data: { id: 'a', ref: '//cdn.example.com/a.png' } }], edges: [] } },
    ],
  ])('rejects %s', (_label, config) => {
    expect(reasonOf(JSON.stringify(config))).toBe('external-reference')
  })

  it('accepts plain text values that do not match external prefixes', () => {
    const config = {
      elements: {
        nodes: [{ data: { id: 'server', label: 'My Server' } }],
        edges: [],
      },
    }
    expect(parseCytoscapeConfig(JSON.stringify(config)).isOk()).toBe(true)
  })
})
