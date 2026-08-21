import type MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import { SAMPLE_IMAGE_DATA_URI } from '@/app/dev/fixtures/options'
import { salesRows, barChart } from '@/app/dev/fixtures/tabular'
import { echartsBar } from '@/app/dev/fixtures/echarts'
import { simpleGraph } from '@/app/dev/fixtures/cytoscape'

type MarkdownContentProps = InstanceType<typeof MarkdownContent>['$props']

const fence = (lang: string, body: string) => '```' + lang + '\n' + body + '\n```'

const prose = `# Heading 1

## Heading 2

Body copy with **bold**, *emphasis*, ~~strikethrough~~ and a hard
line break above this word.

- unordered item
- nested list:
  1. first
  2. second
- last item

> Blockquote: the backend can send anything markdown-it accepts.

---

Trailing paragraph after a horizontal rule.`

const linksAndImages = `An inline [link to example.com](https://example.com/docs) and a bare URL that
linkify turns into an anchor: https://example.com/raw?a=1&b=2

![InnoChat palette](${SAMPLE_IMAGE_DATA_URI})`

const code = `Inline \`useMarkdown()\` reference, then a highlighted block:

${fence('ts', `const { parse, toPlainText } = useMarkdown()\nconst html = parse('**hi**')`)}

${fence('json', '{ "answer": "Option A", "confidence": 0.92 }')}

${fence('', 'plain fenced block with no language')}`

const table = `| Region | Revenue | Renewed |
| --- | ---: | :---: |
| Budapest | 20 750 | yes |
| Vienna | 24 870 | yes |
| Bratislava | — | no |`

const math = `Inline math: $E = mc^2$, and a display block:

\\[ \\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2} \\]`

const overflow = `A very long unbroken token must not blow out the bubble width:
Lorem_ipsum_dolor_sit_amet_consectetur_adipiscing_elit_sed_do_eiusmod_tempor_incididunt_ut_labore

https://example.com/a/very/long/path/that/keeps/going/and/going/and/going?query=alsoveryverylong&more=true`

const svgRenderingPipeline = `<svg width="760" height="320" viewBox="0 0 760 320" role="img" aria-labelledby="svg-gallery-title">
  <title id="svg-gallery-title">Validated SVG rendering pipeline</title>
  <defs>
    <linearGradient id="background" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="shield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect width="760" height="320" rx="28" fill="url(#background)"/>
  <text x="380" y="48" fill="#f8fafc" font-family="Inter, sans-serif" font-size="24" font-weight="700" text-anchor="middle">Safe SVG rendering</text>
  <text x="380" y="76" fill="#94a3b8" font-family="Inter, sans-serif" font-size="14" text-anchor="middle">Raw fence to validated, isolated image</text>

  <g transform="translate(54 112)">
    <rect width="172" height="132" rx="18" fill="#1e293b" stroke="#475569" stroke-width="2"/>
    <circle cx="24" cy="24" r="5" fill="#fb7185"/>
    <circle cx="42" cy="24" r="5" fill="#fbbf24"/>
    <circle cx="60" cy="24" r="5" fill="#34d399"/>
    <path d="M28 64L16 76L28 88" fill="none" stroke="#5eead4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M62 64L74 76L62 88" fill="none" stroke="#5eead4" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 98L52 54" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>
    <text x="110" y="78" fill="#e2e8f0" font-family="Inter, sans-serif" font-size="17" font-weight="700" text-anchor="middle">SVG fence</text>
    <text x="110" y="101" fill="#94a3b8" font-family="Inter, sans-serif" font-size="12" text-anchor="middle">untrusted input</text>
  </g>

  <path d="M242 178H296" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="7 7"/>
  <path d="M296 178L284 170V186Z" fill="#64748b"/>

  <g>
    <path d="M380 112L426 130V169C426 204 406 229 380 242C354 229 334 204 334 169V130Z" fill="url(#shield)"/>
    <path d="M356 174L372 190L405 153" fill="none" stroke="#ecfeff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="380" y="271" fill="#ccfbf1" font-family="Inter, sans-serif" font-size="14" font-weight="700" text-anchor="middle">ALLOWLISTED</text>
  </g>

  <path d="M464 178H518" fill="none" stroke="#64748b" stroke-width="3" stroke-dasharray="7 7"/>
  <path d="M518 178L506 170V186Z" fill="#64748b"/>

  <g transform="translate(534 112)">
    <rect width="172" height="132" rx="18" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
    <rect x="17" y="17" width="138" height="82" rx="10" fill="#dbeafe"/>
    <circle cx="126" cy="40" r="11" fill="#fbbf24"/>
    <path d="M28 88L65 54L88 75L107 61L145 88Z" fill="#0f766e"/>
    <text x="86" y="117" fill="#334155" font-family="Inter, sans-serif" font-size="13" font-weight="700" text-anchor="middle">isolated image</text>
  </g>
</svg>`

const mermaidFlowchart = `flowchart TB
  Invoice[Számla beérkezik] --> Amount{Összeg > 500e Ft}
  Amount -->|Igen| Approval[Vezetői jóváhagyás]
  Amount -->|Nem| Booking[Automatikus könyvelés]
  Approval --> Booking
  Booking --> ERP[(ERP könyvelés)]`

export const markdownScenarios: Scenario<MarkdownContentProps>[] = [
  { id: 'md-prose', title: 'Prose — headings, lists, blockquote, rule', props: { content: prose } },
  { id: 'md-links', title: 'Links, linkified URL, image', props: { content: linksAndImages } },
  { id: 'md-code', title: 'Inline code + fenced blocks (Shiki)', props: { content: code } },
  { id: 'md-table', title: 'Markdown table with alignment', props: { content: table } },
  { id: 'md-math', title: 'KaTeX — inline and display', props: { content: math } },
  { id: 'md-overflow', title: 'Long unbroken token and URL', props: { content: overflow } },
  {
    id: 'md-rows',
    title: 'Embedded ```rows block → ChatTable',
    props: { content: fence('rows', JSON.stringify(salesRows, null, 2)) },
  },
  {
    id: 'md-h-rows',
    title: 'Embedded ```h-rows block → ChatTable with declared column types',
    props: {
      content: fence(
        'h-rows',
        JSON.stringify(
          [
            [
              { name: 'agent', type: 'string' },
              { name: 'handled', type: 'number' },
            ],
            { agent: 'Agent A1', handled: 37 },
            { agent: 'Agent B1', handled: 74 },
            { agent: 'Agent C1', handled: 111 },
          ],
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-pivot',
    title: 'Embedded ```pivot block → ChatPivotTable',
    props: { content: fence('pivot', JSON.stringify(salesRows, null, 2)) },
  },
  {
    id: 'md-chart',
    title: 'Embedded ```chart.js block → ChatChart',
    props: { content: fence('chart.js', JSON.stringify(barChart, null, 2)) },
  },
  {
    id: 'md-echarts',
    title: 'Embedded ```echarts block → ChatEChart',
    props: { content: fence('echarts', JSON.stringify(echartsBar, null, 2)) },
  },
  {
    id: 'md-echarts-rejected',
    title: 'Rejected ```echarts block (external reference) → stays a code block',
    props: {
      content: fence(
        'echarts',
        JSON.stringify(
          {
            xAxis: { type: 'category', data: ['A', 'B'] },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: [1, 2] }],
            graphic: { type: 'image', style: { image: 'image://evil.png' } },
          },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-echarts-unparseable',
    title: 'Malformed ```echarts block → stays a code block',
    props: { content: fence('echarts', '{ "series": [ ') },
  },
  {
    id: 'md-cytoscape',
    title: 'Embedded ```cytoscape block → ChatCytoscape',
    props: { content: fence('cytoscape', JSON.stringify(simpleGraph, null, 2)) },
  },
  {
    id: 'md-cytoscape-rejected',
    title: 'Rejected ```cytoscape block (external reference) → stays a code block',
    props: {
      content: fence(
        'cytoscape',
        JSON.stringify(
          {
            elements: {
              nodes: [{ data: { id: 'a', icon: 'https://evil.com/x.png' } }],
              edges: [],
            },
          },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-leaflet-markers',
    title: 'Embedded ```leaflet block → ChatMap with markers',
    props: {
      content: fence(
        'leaflet',
        JSON.stringify(
          {
            center: [48.2082, 16.3738],
            zoom: 13,
            markers: [
              { lat: 48.2082, lng: 16.3738, title: 'Vienna', description: 'Capital of Austria' },
            ],
          },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-leaflet-mixed',
    title: 'Embedded ```leaflet block → ChatMap with markers, polyline, polygon',
    props: {
      content: fence(
        'leaflet',
        JSON.stringify(
          {
            markers: [
              { lat: 48.2082, lng: 16.3738, title: 'Vienna' },
              { lat: 47.8095, lng: 13.055, title: 'Salzburg' },
            ],
            polylines: [
              {
                coordinates: [
                  [48.2082, 16.3738],
                  [47.8095, 13.055],
                ],
                color: '#3b82f6',
                weight: 3,
              },
            ],
            polygons: [
              {
                coordinates: [
                  [48.22, 16.35],
                  [48.22, 16.4],
                  [48.19, 16.4],
                  [48.19, 16.35],
                ],
                color: '#10b981',
                fillColor: '#10b98133',
                weight: 2,
              },
            ],
          },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-leaflet-rejected',
    title: 'Rejected ```leaflet block (HTML in popup) → stays a code block',
    props: {
      content: fence(
        'leaflet',
        JSON.stringify(
          {
            markers: [{ lat: 48.2082, lng: 16.3738, title: '<script>alert(1)</script>' }],
          },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-svg',
    title: 'Embedded ```svg block → isolated SVG image',
    props: {
      content: `The SVG root declares \`width="760"\` and \`height="320"\`, so the rendered image has an explicit intrinsic size.\n\n${fence('svg', svgRenderingPipeline)}`,
    },
  },
  {
    id: 'md-mermaid',
    title: 'Embedded ```mermaid block → isolated Mermaid diagram',
    props: { content: fence('mermaid', mermaidFlowchart) },
  },
  {
    id: 'md-mermaid-rejected',
    title: 'Rejected ```mermaid block (interactive click) → stays a code block',
    props: {
      content: fence('mermaid', 'flowchart LR\n  A --> B\n  click A "https://example.com"'),
    },
  },
  {
    id: 'md-video',
    title: 'Embedded ```video block → native HTML5 video player',
    props: {
      content: fence(
        'video',
        JSON.stringify(
          { src: '/videos/demo.webm', title: 'Product walkthrough', muted: true },
          null,
          2,
        ),
      ),
    },
  },
  {
    id: 'md-video-rejected',
    title: 'Rejected ```video block (external URL) → stays a code block',
    props: { content: fence('video', JSON.stringify({ src: 'https://example.com/video.mp4' })) },
  },
]
