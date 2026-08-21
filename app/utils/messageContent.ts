import type { AISessionMessageDTO } from '@/types/api/schemas'
import { AIAnswerType } from '@/types/enums'

const WIDE_CONTENT_MARKERS = [
  '```rows',
  '```h-rows',
  '```pivot',
  '```chart.js',
  '```echarts',
  '```bar-race',
  '```cytoscape',
  '```leaflet',
  '```svg',
  '```mermaid',
  '```video',
]
const MD_TABLE_RE = /^\|.+\|/m

export function hasWideContent(message: AISessionMessageDTO): boolean {
  if (message.messageType === AIAnswerType.Options) return true
  if (message.messageType === AIAnswerType.DataTable) return true
  if (message.messageType === AIAnswerType.File) return true
  const text = message.messageText
  if (!text) return false
  return WIDE_CONTENT_MARKERS.some((marker) => text.includes(marker)) || MD_TABLE_RE.test(text)
}
