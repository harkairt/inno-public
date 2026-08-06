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
]
