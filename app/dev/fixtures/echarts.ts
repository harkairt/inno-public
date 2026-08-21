import type ChatEChart from '@/app/components/chat/ChatEChart.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import type { EChartsOption } from '@/lib/validation/echarts'

type ChatEChartProps = InstanceType<typeof ChatEChart>['$props']

export const echartsBar: EChartsOption = {
  xAxis: { type: 'category', data: ['Budapest', 'Debrecen', 'Vienna', 'Bratislava'] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'bar',
      data: [
        { value: 20750, name: 'Budapest' },
        { value: 4120, name: 'Debrecen' },
        { value: 24870, name: 'Vienna' },
        { value: 0, name: 'Bratislava' },
      ],
    },
  ],
}

const echartsLine: EChartsOption = {
  xAxis: { type: 'category', data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
  yAxis: { type: 'value' },
  series: [
    { type: 'line', name: 'Sessions', data: [120, 190, 145, 260, 310, 280], smooth: true },
    { type: 'line', name: 'Answered', data: [40, 72, 61, 118, 154, 149], smooth: true },
  ],
  legend: { show: true },
}

const echartsPrompt: EChartsOption = {
  xAxis: { type: 'category', data: ['Alfa', 'Beta', 'Gamma'] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'bar',
      data: [
        { value: 18551, name: 'Alfa', prompt: 'Tell me more about Alfa' },
        { value: 8300, name: 'Beta', prompt: 'Tell me more about Beta' },
        { value: 22890, name: 'Gamma', prompt: 'Tell me more about Gamma' },
      ],
    },
  ],
}

const echartsDonut: EChartsOption = {
  title: { text: 'Ticket status', left: 'center' },
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['45%', '72%'],
      data: [
        { value: 68, name: 'Resolved' },
        { value: 19, name: 'In progress' },
        { value: 13, name: 'Waiting' },
      ],
    },
  ],
}

const echartsStackedArea: EChartsOption = {
  tooltip: { trigger: 'axis' },
  legend: { show: true },
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  yAxis: { type: 'value' },
  series: [
    {
      type: 'line',
      name: 'Support',
      stack: 'requests',
      areaStyle: {},
      smooth: true,
      data: [42, 58, 49, 63, 55],
    },
    {
      type: 'line',
      name: 'Sales',
      stack: 'requests',
      areaStyle: {},
      smooth: true,
      data: [28, 34, 41, 36, 48],
    },
  ],
}

const echartsScatter: EChartsOption = {
  title: { text: 'Resolution time vs. customer score', left: 'center' },
  tooltip: { trigger: 'item' },
  xAxis: { type: 'value', name: 'Hours to resolve' },
  yAxis: { type: 'value', name: 'Score' },
  series: [
    {
      type: 'scatter',
      name: 'Tickets',
      symbolSize: 14,
      data: [
        [1.2, 4.9],
        [2.4, 4.7],
        [3.1, 4.3],
        [4.8, 3.8],
        [6.2, 3.4],
        [7.5, 3.1],
      ],
    },
  ],
}

const scenarioSource = (option: EChartsOption) => JSON.stringify(option, null, 2)

export const echartsScenarios: Scenario<ChatEChartProps>[] = [
  {
    id: 'echart-bar',
    title: 'Bar chart',
    props: { option: echartsBar, blockIndex: 0, source: scenarioSource(echartsBar) },
  },
  {
    id: 'echart-line',
    title: 'Line chart — two series with legend',
    props: { option: echartsLine, blockIndex: 1, source: scenarioSource(echartsLine) },
  },
  {
    id: 'echart-prompt',
    title: 'Bars with prompt data — click to fill composer',
    props: { option: echartsPrompt, blockIndex: 2, source: scenarioSource(echartsPrompt) },
  },
  {
    id: 'echart-donut',
    title: 'Donut chart with title, tooltip, and legend',
    props: { option: echartsDonut, blockIndex: 3, source: scenarioSource(echartsDonut) },
  },
  {
    id: 'echart-stacked-area',
    title: 'Stacked area chart',
    props: {
      option: echartsStackedArea,
      blockIndex: 4,
      source: scenarioSource(echartsStackedArea),
    },
  },
  {
    id: 'echart-scatter',
    title: 'Scatter chart with numeric axes',
    props: { option: echartsScatter, blockIndex: 5, source: scenarioSource(echartsScatter) },
  },
]
