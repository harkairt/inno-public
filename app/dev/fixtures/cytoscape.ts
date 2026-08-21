import type ChatCytoscape from '@/app/components/chat/ChatCytoscape.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'
import type { CytoscapeConfig } from '@/lib/validation/cytoscape'

type ChatCytoscapeProps = InstanceType<typeof ChatCytoscape>['$props']

export const simpleGraph: CytoscapeConfig = {
  elements: {
    nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } }],
    edges: [{ data: { source: 'a', target: 'b' } }, { data: { source: 'b', target: 'c' } }],
  },
}

export const breadthfirstTree: CytoscapeConfig = {
  elements: {
    nodes: [
      { data: { id: 'root' } },
      { data: { id: 'child-1' } },
      { data: { id: 'child-2' } },
      { data: { id: 'leaf-1' } },
      { data: { id: 'leaf-2' } },
    ],
    edges: [
      { data: { source: 'root', target: 'child-1' } },
      { data: { source: 'root', target: 'child-2' } },
      { data: { source: 'child-1', target: 'leaf-1' } },
      { data: { source: 'child-2', target: 'leaf-2' } },
    ],
  },
  layout: { name: 'breadthfirst' },
}

export const styledGraph: CytoscapeConfig = {
  elements: {
    nodes: [{ data: { id: 'server' } }, { data: { id: 'db' } }, { data: { id: 'cache' } }],
    edges: [
      { data: { source: 'server', target: 'db' } },
      { data: { source: 'server', target: 'cache' } },
    ],
  },
  layout: { name: 'circle' },
  style: [
    { selector: 'node', style: { 'background-color': '#6366f1', shape: 'round-rectangle' } },
    { selector: 'edge', style: { 'line-color': '#a5b4fc', 'target-arrow-color': '#a5b4fc' } },
  ],
}

const scenarioSource = (config: CytoscapeConfig) => JSON.stringify(config, null, 2)

export const cytoscapeScenarios: Scenario<ChatCytoscapeProps>[] = [
  {
    id: 'cytoscape-simple',
    title: 'Simple 3-node graph (cose layout)',
    props: { config: simpleGraph, blockIndex: 0, source: scenarioSource(simpleGraph) },
  },
  {
    id: 'cytoscape-tree',
    title: 'Breadthfirst tree layout',
    props: { config: breadthfirstTree, blockIndex: 1, source: scenarioSource(breadthfirstTree) },
  },
  {
    id: 'cytoscape-styled',
    title: 'Styled graph — custom node/edge colors, circle layout',
    props: { config: styledGraph, blockIndex: 2, source: scenarioSource(styledGraph) },
  },
]
