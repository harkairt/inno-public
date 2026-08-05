import type MarkdownContent from '@/app/components/chat/MarkdownContent.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import { SAMPLE_IMAGE_DATA_URI } from '@/app/dev/fixtures/options'
import { salesRows, barChart } from '@/app/dev/fixtures/tabular'

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

![Vonno palette](${SAMPLE_IMAGE_DATA_URI})`

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
]
