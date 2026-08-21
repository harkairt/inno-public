import type {
  AISessionDTO,
  AISessionMessageDTO,
  OptionsMessagePayload,
  UserDTO,
} from '@/types/api/schemas'
import { AIAnswerType, OptionsUIControlType } from '@/types/enums'
import { markdownScenarios } from '@/app/dev/fixtures/markdown'
import { optionsScenarios, SAMPLE_IMAGE_DATA_URI } from '@/app/dev/fixtures/options'
import { tableScenarios, chartScenarios, pivotScenarios } from '@/app/dev/fixtures/tabular'
import { echartsScenarios } from '@/app/dev/fixtures/echarts'
import { barRaceScenarios } from '@/app/dev/fixtures/barRace'
import { cytoscapeScenarios } from '@/app/dev/fixtures/cytoscape'
import { leafletScenarios } from '@/app/dev/fixtures/leaflet'

type MarkdownFixture = { id: string; title: string; props: { content?: string | null } }
type TableFixture = { id: string; title: string; props: { tableData?: { rows?: unknown[] } } }
type ValueFixture = { id: string; title: string; props: Record<string, unknown> }
type RenderedFixture = { id: string; title: string; content: string }
type FixtureGroup = {
  fenceType: string
  description: string
  fixtures: RenderedFixture[]
}
type OptionFixture = {
  id: string
  props: { payload: OptionsMessagePayload; isActive?: boolean; selectedAnswer?: string }
}

// Vue component prop types do not resolve cleanly when imported into this fixture.
// The gallery only needs these serializable values to build synthetic API messages.
const markdownFixtures = markdownScenarios as unknown as MarkdownFixture[]
const tableFixtures = tableScenarios as unknown as TableFixture[]
const chartFixtures = chartScenarios as unknown as ValueFixture[]
const pivotFixtures = pivotScenarios as unknown as ValueFixture[]
const echartFixtures = echartsScenarios as unknown as ValueFixture[]
const barRaceFixtures = barRaceScenarios as unknown as ValueFixture[]
const cytoscapeFixtures = cytoscapeScenarios as unknown as ValueFixture[]
const leafletFixtures = leafletScenarios as unknown as ValueFixture[]
const optionFixtures = optionsScenarios as unknown as OptionFixture[]

export const galleryUser: UserDTO = {
  id: 4242,
  createdAt: '2026-01-02T08:00:00.000Z',
  updatedAt: null,
  name: 'Gallery User',
  email: 'gallery@innochat.dev',
  status: 'active',
  invitationAccepted: true,
  roles: ['user'],
  isVirtual: false,
  url: null,
  image: null,
  darkImage: null,
  userIds: [],
  users: null,
  isAvailable: true,
}

const AGENT_CODE = 'innochat-agent'
const AGENT_NAME = 'InnoChat Agent'
const SESSION_ID = 'dev-gallery-session'
const DAY_MS = 86_400_000

const fence = (language: string, value: unknown) =>
  `\`\`\`${language}\n${JSON.stringify(value, null, 2)}\n\`\`\``

const at = (dayOffset: number, hour: number, minute: number): string => {
  const date = new Date(Date.now() + dayOffset * DAY_MS)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const answeredPayload: OptionsMessagePayload = {
  Text: 'Which report would you like?',
  MultiSelectEnabled: false,
  IsPlainTextEnabled: false,
  UIControlType: OptionsUIControlType.RadioButton,
  Items: [
    { Key: 'k1', Value: '**Revenue** by region' },
    { Key: 'k2', Value: 'Renewals with `signedAt` breakdown' },
    { Key: 'k3', Value: 'Both' },
  ],
}

const activePayload: OptionsMessagePayload = {
  Text: 'Which follow-ups should I include? Select any, or add your own.',
  MultiSelectEnabled: true,
  IsPlainTextEnabled: true,
  UIControlType: OptionsUIControlType.RadioButton,
  Items: [
    { Key: 'k1', Value: 'Quarter-over-quarter chart' },
    { Key: 'k2', Value: 'Raw rows as an attachment' },
    {
      Key: 'k3',
      Value: `Visual summary\n\n![InnoChat palette](${SAMPLE_IMAGE_DATA_URI})`,
    },
    { Key: 'k4', Value: 'A short *written* summary' },
  ],
}

const agentMessage = (
  messageID: string,
  sendDate: string,
  messageText: string,
  messageType: AIAnswerType = AIAnswerType.Text,
): AISessionMessageDTO => ({
  isRated: false,
  rating: null,
  readByUsers: [],
  messageID,
  messageText,
  messageType,
  sendDate,
  senderName: AGENT_NAME,
  senderUserCode: AGENT_CODE,
  sessionId: SESSION_ID,
})

const userMessage = (
  messageID: string,
  sendDate: string,
  messageText: string,
): AISessionMessageDTO => ({
  isRated: false,
  rating: null,
  readByUsers: [],
  messageID,
  messageText,
  messageType: AIAnswerType.Text,
  sendDate,
  senderName: galleryUser.name,
  senderUserCode: galleryUser.email,
  sessionId: SESSION_ID,
})

export const ACTIVE_OPTIONS_MESSAGE_ID = 'gallery-active-options'

const conversationMessages: AISessionMessageDTO[] = [
  agentMessage(
    'msg-1',
    at(-1, 9, 12),
    'Good morning! I can walk you through each supported response renderer. What would help most?',
  ),
  userMessage('msg-2', at(-1, 9, 13), 'Show me every renderer, grouped by type.'),
  agentMessage(
    'msg-3',
    at(-1, 9, 15),
    'Absolutely. I’ll introduce each fence type, then show all of its examples together.',
  ),
]

const markdownFixturesFor = (...ids: string[]): RenderedFixture[] =>
  markdownFixtures
    .filter((scenario) => ids.includes(scenario.id))
    .map((scenario) => ({
      id: scenario.id,
      title: scenario.title,
      content: scenario.props.content ?? '',
    }))

const rowFixtures: RenderedFixture[] = tableFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('rows', scenario.props.tableData?.rows ?? []),
}))

const chartFixturesForThread: RenderedFixture[] = chartFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('chart.js', scenario.props.config),
}))

const pivotFixturesForThread: RenderedFixture[] = pivotFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('pivot', scenario.props.data),
}))

const echartFixturesForThread: RenderedFixture[] = echartFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('echarts', scenario.props.option),
}))

const barRaceFixturesForThread: RenderedFixture[] = barRaceFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('bar-race', scenario.props.data),
}))

const cytoscapeFixturesForThread: RenderedFixture[] = cytoscapeFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('cytoscape', scenario.props.config),
}))

const leafletFixturesForThread: RenderedFixture[] = leafletFixtures.map((scenario) => ({
  id: scenario.id,
  title: scenario.title,
  content: fence('leaflet', scenario.props.data),
}))

const fixtureGroups: FixtureGroup[] = [
  {
    fenceType: 'Markdown',
    description: 'regular Markdown and standard code fences',
    fixtures: markdownFixturesFor(
      'md-prose',
      'md-links',
      'md-code',
      'md-table',
      'md-math',
      'md-overflow',
    ),
  },
  {
    fenceType: 'rows',
    description: 'tabular rows, including horizontal and paginated variants',
    fixtures: [...markdownFixturesFor('md-rows', 'md-h-rows'), ...rowFixtures],
  },
  {
    fenceType: 'pivot',
    description: 'pivot-table data',
    fixtures: [...markdownFixturesFor('md-pivot'), ...pivotFixturesForThread],
  },
  {
    fenceType: 'chart.js',
    description: 'Chart.js charts',
    fixtures: [...markdownFixturesFor('md-chart'), ...chartFixturesForThread],
  },
  {
    fenceType: 'echarts',
    description: 'ECharts, including invalid-input fallbacks',
    fixtures: [
      ...markdownFixturesFor('md-echarts-rejected', 'md-echarts-unparseable'),
      ...echartFixturesForThread,
    ],
  },
  {
    fenceType: 'bar-race',
    description: 'animated bar-race charts',
    fixtures: barRaceFixturesForThread,
  },
  {
    fenceType: 'cytoscape',
    description: 'Cytoscape graphs, including rejected input',
    fixtures: [
      ...markdownFixturesFor('md-cytoscape', 'md-cytoscape-rejected'),
      ...cytoscapeFixturesForThread,
    ],
  },
  {
    fenceType: 'leaflet',
    description: 'Leaflet maps, routes, polygons, and rejected input',
    fixtures: [
      ...markdownFixturesFor('md-leaflet-markers', 'md-leaflet-mixed', 'md-leaflet-rejected'),
      ...leafletFixturesForThread,
    ],
  },
  {
    fenceType: 'svg',
    description: 'validated, isolated SVG images',
    fixtures: markdownFixturesFor('md-svg'),
  },
]

const fixtureMessages = fixtureGroups
  .flatMap((group) => [
    {
      id: `intro-${group.fenceType}`,
      content: `## ${group.fenceType}\n\nNow I am showing ${group.description}.`,
    },
    ...group.fixtures.map((fixture) => ({
      id: `fixture-${fixture.id}`,
      content: `### ${fixture.title}\n\n${fixture.content}`,
    })),
  ])
  .map((message, index) => agentMessage(message.id, at(0, 10, 6 + index), message.content))

const optionMessages = [
  agentMessage(
    'intro-options',
    at(0, 11, 0),
    '## Options\n\nNow I am showing interactive option controls and their submitted answers.',
  ),
  agentMessage('msg-4', at(0, 11, 1), JSON.stringify(answeredPayload), AIAnswerType.Options),
  userMessage('msg-5', at(0, 11, 2), 'Renewals with `signedAt` breakdown'),
  ...optionFixtures
    .filter((scenario) => !scenario.props.isActive)
    .flatMap((scenario, index) => {
      const messageId = `fixture-option-${scenario.id}`
      return [
        agentMessage(
          messageId,
          at(0, 11, 3 + index * 2),
          JSON.stringify(scenario.props.payload),
          AIAnswerType.Options,
        ),
        userMessage(
          `${messageId}-answer`,
          at(0, 11, 4 + index * 2),
          scenario.props.selectedAnswer ?? '',
        ),
      ]
    }),
]

const activeOptionMessage = agentMessage(
  ACTIVE_OPTIONS_MESSAGE_ID,
  at(0, 11, 20),
  JSON.stringify(activePayload),
  AIAnswerType.Options,
)

export const threadMessages: AISessionMessageDTO[] = [
  ...conversationMessages,
  ...fixtureMessages,
  ...optionMessages,
  activeOptionMessage,
]

export const gallerySession: AISessionDTO = {
  agentDarkImage: null,
  agentId: 1,
  agentImage: null,
  insertDate: threadMessages[0]!.sendDate,
  modifiedAt: threadMessages.at(-1)!.sendDate,
  members: [galleryUser.email, AGENT_CODE, 'analyst@innochat.dev'],
  memberDetails: null,
  messages: threadMessages,
  sessionId: SESSION_ID,
  sessionName: 'Component gallery',
  userCode: galleryUser.email,
}
