import type { DiagramEdge, DiagramNode, EditableDiagram } from '../types/algorithm';

export interface WalkthroughStep {
  nodeId: string;
  viaEdgeId: string | null;
  decisionLabel: string | null;
}

export interface WalkthroughState {
  steps: WalkthroughStep[];
}

/**
 * Detects the natural clinical starting node of an EditableDiagram.
 * Prefers root nodes (in-degree 0), ordered by top-most position and pill shape.
 */
export function findStartNodeId(diagram: EditableDiagram): string | null {
  if (diagram.nodes.length === 0) return null;

  const validIds = new Set(diagram.nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  for (const n of diagram.nodes) {
    inDegree.set(n.id, 0);
  }
  for (const e of diagram.edges) {
    if (validIds.has(e.from) && validIds.has(e.to) && e.from !== e.to) {
      inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    }
  }

  const roots = diagram.nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  const candidates = roots.length > 0 ? roots : [...diagram.nodes];

  candidates.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 24) return a.y - b.y;
    if (a.shape === 'pill' && b.shape !== 'pill') return -1;
    if (b.shape === 'pill' && a.shape !== 'pill') return 1;
    return a.x - b.x;
  });

  return candidates[0]?.id ?? null;
}

/**
 * Creates the initial Guided Walkthrough state anchored at the detected (or explicit) start node.
 */
export function createInitialWalkthrough(
  diagram: EditableDiagram,
  explicitStartNodeId?: string
): WalkthroughState {
  const validStart =
    explicitStartNodeId && diagram.nodes.some((n) => n.id === explicitStartNodeId)
      ? explicitStartNodeId
      : findStartNodeId(diagram);

  if (!validStart) {
    return { steps: [] };
  }

  return {
    steps: [
      {
        nodeId: validStart,
        viaEdgeId: null,
        decisionLabel: null,
      },
    ],
  };
}

export function getCurrentNodeId(state: WalkthroughState): string | null {
  if (state.steps.length === 0) return null;
  return state.steps[state.steps.length - 1].nodeId;
}

/**
 * Returns valid outgoing edges from the current active node, ordered left-to-right
 * by target node X coordinate for natural visual reading order.
 */
export function getAvailableOutgoingEdges(
  diagram: EditableDiagram,
  state: WalkthroughState
): DiagramEdge[] {
  const currentId = getCurrentNodeId(state);
  if (!currentId) return [];

  const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));
  const visitedNodeIds = new Set(state.steps.map((s) => s.nodeId));

  return diagram.edges
    .filter(
      (edge) =>
        edge.from === currentId &&
        edge.to !== currentId &&
        nodeMap.has(edge.to) &&
        !visitedNodeIds.has(edge.to)
    )
    .sort((a, b) => {
      const nodeA = nodeMap.get(a.to)!;
      const nodeB = nodeMap.get(b.to)!;
      return nodeA.x - nodeB.x;
    });
}

/**
 * Returns all edges that are currently interactive/clickable on the diagram:
 * - Outgoing edges from the current active node (advance forward)
 * - Sibling outgoing edges from any previously visited node in the path (one-click branch switch)
 */
export function getSelectableEdgeIds(
  diagram: EditableDiagram,
  state: WalkthroughState
): Set<string> {
  const result = new Set<string>();
  const validNodeIds = new Set(diagram.nodes.map((n) => n.id));
  const visitedEdgeIds = new Set(
    state.steps.map((s) => s.viaEdgeId).filter((id): id is string => Boolean(id))
  );

  for (let i = 0; i < state.steps.length; i++) {
    const stepNodeId = state.steps[i].nodeId;
    const prefixNodeIds = new Set(state.steps.slice(0, i + 1).map((s) => s.nodeId));

    for (const edge of diagram.edges) {
      if (
        edge.from === stepNodeId &&
        edge.to !== stepNodeId &&
        validNodeIds.has(edge.to) &&
        !prefixNodeIds.has(edge.to) &&
        !visitedEdgeIds.has(edge.id)
      ) {
        result.add(edge.id);
      }
    }
  }

  return result;
}

/**
 * Activates a connection (edge) in the Guided Walkthrough:
 * - If edge.from is the current node, advances along that connection.
 * - If edge.from is an earlier visited node in the active path, automatically rewinds
 *   to that decision point and switches immediately to the newly clicked branch.
 */
export function selectWalkthroughEdge(
  diagram: EditableDiagram,
  state: WalkthroughState,
  edgeId: string
): WalkthroughState {
  const edge = diagram.edges.find((e) => e.id === edgeId);
  if (!edge) return state;
  if (!diagram.nodes.some((n) => n.id === edge.to)) return state;

  const sourceStepIndex = state.steps.findIndex((s) => s.nodeId === edge.from);
  if (sourceStepIndex === -1) return state;

  const baseSteps = state.steps.slice(0, sourceStepIndex + 1);
  if (baseSteps.some((s) => s.nodeId === edge.to)) {
    return state;
  }

  return {
    steps: [
      ...baseSteps,
      {
        nodeId: edge.to,
        viaEdgeId: edge.id,
        decisionLabel: edge.label.trim() || null,
      },
    ],
  };
}

/**
 * Rewinds the active path back to a previously visited node so the clinician/student
 * can reconsider a decision and explore another branch.
 */
export function rewindWalkthroughToNode(
  state: WalkthroughState,
  nodeId: string
): WalkthroughState {
  const idx = state.steps.findIndex((s) => s.nodeId === nodeId);
  if (idx === -1) return state;
  return {
    steps: state.steps.slice(0, idx + 1),
  };
}

/**
 * Moves back one step along the active path (keeps the starting node intact).
 */
export function stepBackWalkthrough(state: WalkthroughState): WalkthroughState {
  if (state.steps.length <= 1) return state;
  return {
    steps: state.steps.slice(0, -1),
  };
}

/**
 * True when the current active node has reached a terminal clinical conduct
 * (no remaining unvisited outgoing connections).
 */
export function isWalkthroughComplete(
  diagram: EditableDiagram,
  state: WalkthroughState
): boolean {
  if (state.steps.length === 0) return false;
  return getAvailableOutgoingEdges(diagram, state).length === 0;
}

/**
 * Produces a clean, copy-ready Spanish clinical summary of the active decision path
 * and final therapeutic conduct.
 */
export function formatWalkthroughSummary(
  diagram: EditableDiagram,
  state: WalkthroughState
): string {
  const nodeMap = new Map<string, DiagramNode>(diagram.nodes.map((n) => [n.id, n]));
  const resolvedSteps = state.steps
    .map((step) => ({
      step,
      node: nodeMap.get(step.nodeId),
    }))
    .filter((entry): entry is { step: WalkthroughStep; node: DiagramNode } => Boolean(entry.node));

  if (resolvedSteps.length === 0) {
    return diagram.title;
  }

  const lines: string[] = [
    `RECORRIDO CLÍNICO · ${diagram.title}`,
    '',
    'Ruta de decisión:',
  ];

  resolvedSteps.forEach(({ step, node }, idx) => {
    const decisionPrefix = step.decisionLabel ? `[${step.decisionLabel}] → ` : '';
    const bodySuffix = node.body.trim() ? ` — ${node.body.trim().replace(/\s*\n\s*/g, ' · ')}` : '';
    lines.push(`${idx + 1}. ${decisionPrefix}${node.title}${bodySuffix}`);
  });

  const finalNode = resolvedSteps[resolvedSteps.length - 1].node;
  lines.push('');
  lines.push(`Conducta terapéutica final: ${finalNode.title}`);
  if (finalNode.body.trim()) {
    lines.push(finalNode.body.trim());
  }

  return lines.join('\n');
}
