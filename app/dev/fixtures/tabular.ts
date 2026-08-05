import type { TableData, PivotData } from '@/lib/validation/table'
import type { ChartConfig } from '@/lib/validation/chart'
import type ChatTable from '@/app/components/chat/ChatTable.vue'
import type ChatChart from '@/app/components/chat/ChatChart.vue'
import type ChatPivotTable from '@/app/components/chat/ChatPivotTable.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'

type ChatTableProps = InstanceType<typeof ChatTable>['$props']
type ChatChartProps = InstanceType<typeof ChatChart>['$props']
type ChatPivotTableProps = InstanceType<typeof ChatPivotTable>['$props']

export const salesRows: PivotData = [
  { region: 'Budapest', product: 'Alfa', revenue: 12450.5, signedAt: '2026-01-14', renewed: true },
  { region: 'Budapest', product: 'Beta', revenue: 8300, signedAt: '2026-02-03', renewed: false },
  { region: 'Debrecen', product: 'Alfa', revenue: 4120.75, signedAt: '2026-02-19', renewed: true },
  { region: 'Vienna', product: 'Gamma', revenue: 22890, signedAt: '2026-03-07', renewed: true },
  { region: 'Vienna', product: 'Alfa', revenue: 1980.2, signedAt: '2026-03-22', renewed: false },
  { region: 'Bratislava', product: 'Beta', revenue: null, signedAt: '2026-04-01', renewed: false },
]

export const salesTable: TableData = {
  columns: [
    { name: 'region', type: 'string' },
    { name: 'product', type: 'string' },
    { name: 'revenue', type: 'number' },
    { name: 'signedAt', type: 'date' },
    { name: 'renewed', type: 'boolean' },
  ],
  rows: salesRows,
}

const paginatedTable: TableData = {
  columns: [
    { name: 'id', type: 'number' },
    { name: 'agent', type: 'string' },
    { name: 'handled', type: 'number' },
  ],
  rows: Array.from({ length: 47 }, (_, i) => ({
    id: i + 1,
    agent: `Agent ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
    handled: (i * 37) % 211,
  })),
}

const emptyTable: TableData = {
  columns: [
    { name: 'region', type: 'string' },
    { name: 'revenue', type: 'number' },
  ],
  rows: [],
}

export const barChart: ChartConfig = {
  type: 'bar',
  data: {
    labels: ['Budapest', 'Debrecen', 'Vienna', 'Bratislava'],
    datasets: [
      {
        label: 'Revenue (EUR)',
        data: [20750, 4120, 24870, 0],
        backgroundColor: ['#0E5C5C', '#2A827A', '#F4A261', '#283618'],
      },
    ],
  },
  options: { plugins: { legend: { display: false } } },
}

const lineChart: ChartConfig = {
  type: 'line',
  data: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Sessions',
        data: [120, 190, 145, 260, 310, 280],
        borderColor: '#0E5C5C',
        tension: 0.35,
        fill: false,
      },
      {
        label: 'Answered options',
        data: [40, 72, 61, 118, 154, 149],
        borderColor: '#F4A261',
        tension: 0.35,
        fill: false,
      },
    ],
  },
}

const pieChart: ChartConfig = {
  type: 'pie',
  data: {
    labels: ['Alfa', 'Beta', 'Gamma'],
    datasets: [
      {
        data: [18551, 8300, 22890],
        backgroundColor: ['#0E5C5C', '#F4A261', '#283618'],
      },
    ],
  },
}

export const tableScenarios: Scenario<ChatTableProps>[] = [
  {
    id: 'table-mixed',
    title: 'Mixed column types (string / number / date / boolean, one null cell)',
    props: { tableData: salesTable },
  },
  {
    id: 'table-paginated',
    title: '47 rows — filter + pagination',
    props: { tableData: paginatedTable },
  },
  {
    id: 'table-empty',
    title: 'No rows — empty state',
    props: { tableData: emptyTable },
  },
]

export const chartScenarios: Scenario<ChatChartProps>[] = [
  { id: 'chart-bar', title: 'Bar', props: { config: barChart } },
  { id: 'chart-line', title: 'Line — two datasets', props: { config: lineChart } },
  { id: 'chart-pie', title: 'Pie', props: { config: pieChart } },
]

export const pivotScenarios: Scenario<ChatPivotTableProps>[] = [
  {
    id: 'pivot-sales',
    title: 'Opens a modal with a Table tab and a lazy-loaded Pivot tab',
    props: { data: salesRows },
  },
]
