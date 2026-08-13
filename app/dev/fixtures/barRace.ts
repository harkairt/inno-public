import type ChatBarRace from '@/app/components/chat/ChatBarRace.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import type { BarRaceData } from '@/lib/validation/barRace'

type ChatBarRaceProps = InstanceType<typeof ChatBarRace>['$props']

const populationRace: BarRaceData = {
  categories: ['China', 'India', 'USA', 'Indonesia', 'Brazil', 'Pakistan', 'Bangladesh', 'Russia'],
  start: 1960,
  end: 1970,
  step: 2,
  sort: 'desc',
  maxBars: 5,
  stepDuration: null,
  frames: [
    {
      China: 667,
      India: 434,
      USA: 186,
      Indonesia: 97,
      Brazil: 72,
      Pakistan: 45,
      Bangladesh: 48,
      Russia: 120,
    },
    {
      China: 672,
      India: 456,
      USA: 192,
      Indonesia: 102,
      Brazil: 76,
      Pakistan: 49,
      Bangladesh: 52,
      Russia: 122,
    },
    {
      China: 715,
      India: 480,
      USA: 198,
      Indonesia: 108,
      Brazil: 81,
      Pakistan: 53,
      Bangladesh: 56,
      Russia: 126,
    },
    {
      China: 776,
      India: 511,
      USA: 205,
      Indonesia: 115,
      Brazil: 88,
      Pakistan: 58,
      Bangladesh: 61,
      Russia: 130,
    },
    {
      China: 818,
      India: 541,
      USA: 210,
      Indonesia: 120,
      Brazil: 95,
      Pakistan: 63,
      Bangladesh: 66,
      Russia: 131,
    },
    {
      China: 830,
      India: 555,
      USA: 213,
      Indonesia: 123,
      Brazil: 98,
      Pakistan: 66,
      Bangladesh: 69,
      Russia: 132,
    },
  ],
}

const revenueRace: BarRaceData = {
  categories: ['Product A', 'Product B', 'Product C', 'Product D'],
  start: 2020,
  end: 2024,
  step: 1,
  sort: 'desc',
  maxBars: null,
  stepDuration: 1500,
  frames: [
    { 'Product A': 120, 'Product B': 95, 'Product C': 80, 'Product D': 60 },
    { 'Product A': 140, 'Product B': 130, 'Product C': 105, 'Product D': 85 },
    { 'Product A': 155, 'Product B': 180, 'Product C': 130, 'Product D': 120 },
    { 'Product A': 160, 'Product B': 210, 'Product C': 195, 'Product D': 140 },
    { 'Product A': 170, 'Product B': 195, 'Product C': 250, 'Product D': 230 },
  ],
}

const scenarioSource = (data: BarRaceData) => JSON.stringify(data, null, 2)

export const barRaceScenarios: Scenario<ChatBarRaceProps>[] = [
  {
    id: 'bar-race-population',
    title: 'Population bar race — top 5 of 8 categories',
    props: { data: populationRace, blockIndex: 0, source: scenarioSource(populationRace) },
  },
  {
    id: 'bar-race-revenue',
    title: 'Revenue bar race — all categories, no maxBars',
    props: { data: revenueRace, blockIndex: 1, source: scenarioSource(revenueRace) },
  },
]
