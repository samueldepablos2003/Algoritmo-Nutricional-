import {
  type DiagramClinicalContext,
  type DiagramEdge,
  type DiagramNode,
  type EdgeStyle,
  type EditableDiagram,
  type NodeShape,
  type NodeTone,
} from '../types/algorithm';
import { normalizeTags } from './algorithmLogic';
import {
  buildNodeShapeSvgMarkup,
  computeAdaptiveNodeMetrics,
  DEFAULT_EDGE_LABEL_FONT_SIZE,
  resolveEdgeBadgeColors,
  resolveEdgeColor,
  resolveNodeColors,
} from './diagramTheme';

export const CANVAS_DEFAULT_WIDTH = 1600;
export const DEFAULT_NODE_WIDTH = 310;
export const DEFAULT_NODE_HEIGHT = 104;
export const MIN_NODE_WIDTH = 170;
export const MIN_NODE_HEIGHT = 64;
export const SNAP_THRESHOLD_PX = 8;

export interface AlignmentGuide {
  axis: 'x' | 'y';
  position: number;
  start: number;
  end: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: AlignmentGuide[];
}

export interface EdgeGeometry {
  pathD: string;
  labelX: number;
  labelY: number;
  strokeColor: string;
  isDashed: boolean;
}

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const VALID_SHAPES = new Set<NodeShape>([
  'process',
  'decision',
  'pill',
  'oval',
  'diamond',
  'parallelogram',
  'hexagon',
  'block-arrow',
  'thin-arrow',
  'double-arrow',
]);
const VALID_TONES = new Set<NodeTone>(['white', 'gray', 'mint', 'amber', 'rose', 'blue']);
const VALID_EDGE_STYLES = new Set<EdgeStyle>(['solid', 'dashed', 'straight']);

/**
 * Creates a clean clinical starter diagram when entering the Generador studio.
 */
export function createStarterDiagram(): EditableDiagram {
  const base: EditableDiagram = {
    title: 'Algoritmo Clínico de Soporte Nutricional',
    subtitle: 'Edita los cuadros con doble clic, arrástralos libremente o genera uno nuevo con IA',
    tags: ['Soporte Nutricional'],
    notes: '• Evaluar riesgo nutricional en las primeras 24–48 horas.\n• Priorizar la vía oral o enteral cuando el tracto gastrointestinal es funcional.',
    nodes: [
      {
        id: 'n1',
        x: 0,
        y: 0,
        width: 350,
        height: 92,
        title: '1. Tamizaje Nutricional Inicial',
        body: 'Aplicar NRS-2002 o MUST al ingreso hospitalario',
        shape: 'pill',
        tone: 'gray',
      },
      {
        id: 'n2',
        x: 0,
        y: 0,
        width: 340,
        height: 102,
        title: '2. ¿Tracto Gastrointestinal Funcional?',
        body: 'Evaluar tolerancia oral, hemodinamia y ausencia de obstrucción',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n3',
        x: 0,
        y: 0,
        width: 320,
        height: 104,
        title: '3A. Nutrición Enteral Temprana',
        body: 'Iniciar fórmula polimérica estándar (< 48 h) y progresar a meta calórica',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'n4',
        x: 0,
        y: 0,
        width: 320,
        height: 104,
        title: '3B. Evaluar Nutrición Parenteral',
        body: 'Considerar vía central o periférica según duración prevista y riesgo',
        shape: 'process',
        tone: 'rose',
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'Sí · Funcional', style: 'solid' },
      { id: 'e3', from: 'n2', to: 'n4', label: 'No · Contraindicado', style: 'dashed' },
    ],
  };

  return autoLayoutDiagram(base);
}

/**
 * Estimates a balanced box height from title and body text length.
 */
export function estimateNodeSize(title: string, body: string, shape: NodeShape): {
  width: number;
  height: number;
} {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const isGeometricCustom =
    shape === 'diamond' ||
    shape === 'oval' ||
    shape === 'hexagon' ||
    shape === 'parallelogram';
  const baseWidth =
    shape === 'diamond'
      ? 350
      : shape === 'decision' || shape === 'pill'
        ? 340
        : isGeometricCustom
          ? 340
          : 320;
  const maxLen = Math.max(cleanTitle.length, Math.min(cleanBody.length, 110));
  const width = Math.min(420, Math.max(260, baseWidth + (maxLen > 55 ? 36 : 0)));

  const charsPerBodyLine = isGeometricCustom ? 34 : 42;
  const charsPerTitleLine = isGeometricCustom ? 28 : 35;

  const bodyLines = cleanBody
    ? cleanBody
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerBodyLine)), 0)
    : 0;
  const titleLines = Math.max(1, Math.ceil(cleanTitle.length / charsPerTitleLine));
  const verticalPad = shape === 'diamond' ? 68 : isGeometricCustom ? 52 : 42;
  const height = Math.min(230, Math.max(84, verticalPad + titleLines * 22 + bodyLines * 19));

  return { width, height };
}

function sanitizeClinicalContext(raw: unknown): DiagramClinicalContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const rec = raw as Record<string, unknown>;
  const summary = typeof rec.summary === 'string' ? rec.summary.trim() : '';
  const targetPopulation =
    typeof rec.targetPopulation === 'string' && rec.targetPopulation.trim()
      ? rec.targetPopulation.trim()
      : undefined;
  const clinicalSetting =
    typeof rec.clinicalSetting === 'string' && rec.clinicalSetting.trim()
      ? rec.clinicalSetting.trim()
      : undefined;
  const protocolSource =
    typeof rec.protocolSource === 'string' && rec.protocolSource.trim()
      ? rec.protocolSource.trim()
      : undefined;
  const primaryObjective =
    typeof rec.primaryObjective === 'string' && rec.primaryObjective.trim()
      ? rec.primaryObjective.trim()
      : undefined;

  if (!summary && !targetPopulation && !clinicalSetting && !protocolSource && !primaryObjective) {
    return undefined;
  }

  return {
    summary: summary || primaryObjective || protocolSource || '',
    ...(targetPopulation ? { targetPopulation } : {}),
    ...(clinicalSetting ? { clinicalSetting } : {}),
    ...(protocolSource ? { protocolSource } : {}),
    ...(primaryObjective ? { primaryObjective } : {}),
  };
}

/**
 * Sanitizes raw JSON produced by Gemini into a valid EditableDiagram and applies Auto-Layout.
 */
export function normalizeAiDiagramPayload(
  raw: unknown,
  options?: { sourceImageDataUrl?: string }
): EditableDiagram {
  if (!raw || typeof raw !== 'object') {
    throw new Error('La respuesta de la IA no tiene la estructura esperada.');
  }
  const obj = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  if (rawNodes.length === 0) {
    throw new Error('La IA no devolvió nodos clínicos para construir el algoritmo.');
  }

  const idMap = new Map<string, string>();
  const nodes: DiagramNode[] = [];

  for (let i = 0; i < rawNodes.length; i++) {
    const item = rawNodes[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawId = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim() : `n${i + 1}`;
    const safeId = idMap.has(rawId) ? `${rawId}_${i}` : rawId;
    idMap.set(rawId, safeId);

    const title =
      typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim() : `Paso ${i + 1}`;
    const body = typeof rec.body === 'string' ? rec.body.trim() : '';
    const shape: NodeShape = VALID_SHAPES.has(rec.shape as NodeShape)
      ? (rec.shape as NodeShape)
      : 'process';
    const tone: NodeTone = VALID_TONES.has(rec.tone as NodeTone)
      ? (rec.tone as NodeTone)
      : shape === 'decision' || shape === 'diamond'
        ? 'blue'
        : 'white';
    const comment =
      typeof rec.comment === 'string' && rec.comment.trim() ? rec.comment.trim() : undefined;

    const { width, height } = estimateNodeSize(title, body, shape);
    nodes.push({
      id: safeId,
      x: 0,
      y: 0,
      width,
      height,
      title,
      body,
      shape,
      tone,
      ...(comment ? { comment } : {}),
    });
  }

  if (nodes.length === 0) {
    throw new Error('No se encontraron nodos válidos en la respuesta.');
  }

  const validIds = new Set(nodes.map((n) => n.id));
  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  const edges: DiagramEdge[] = [];
  const edgeDedup = new Set<string>();

  for (let i = 0; i < rawEdges.length; i++) {
    const item = rawEdges[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const fromRaw = typeof rec.from === 'string' ? rec.from.trim() : '';
    const toRaw = typeof rec.to === 'string' ? rec.to.trim() : '';
    const from = idMap.get(fromRaw) ?? fromRaw;
    const to = idMap.get(toRaw) ?? toRaw;
    if (!validIds.has(from) || !validIds.has(to) || from === to) continue;

    const dedupKey = `${from}->${to}`;
    const reverseKey = `${to}->${from}`;
    if (edgeDedup.has(dedupKey) || edgeDedup.has(reverseKey)) continue;
    edgeDedup.add(dedupKey);

    const style: EdgeStyle = VALID_EDGE_STYLES.has(rec.style as EdgeStyle)
      ? (rec.style as EdgeStyle)
      : 'solid';
    const label = typeof rec.label === 'string' ? rec.label.trim() : '';

    edges.push({
      id: `edge-${i + 1}-${from}-${to}`,
      from,
      to,
      label,
      style,
    });
  }

  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : [];

  const validSourceImage =
    typeof options?.sourceImageDataUrl === 'string' &&
    options.sourceImageDataUrl.trim().startsWith('data:image/')
      ? options.sourceImageDataUrl.trim()
      : typeof obj.sourceImageDataUrl === 'string' &&
          obj.sourceImageDataUrl.trim().startsWith('data:image/')
        ? obj.sourceImageDataUrl.trim()
        : undefined;

  const clinicalContext = sanitizeClinicalContext(obj.clinicalContext);
  const reference =
    typeof obj.reference === 'string' && obj.reference.trim()
      ? obj.reference.trim()
      : clinicalContext?.protocolSource;

  const rawSubtitle = typeof obj.subtitle === 'string' ? obj.subtitle.trim() : '';
  const resolvedSubtitle =
    rawSubtitle ||
    (clinicalContext?.summary ? clinicalContext.summary.slice(0, 140) : '');

  const diagram: EditableDiagram = {
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : 'Algoritmo Clínico Nutricional',
    subtitle: resolvedSubtitle,
    tags: normalizeTags(rawTags.length > 0 ? rawTags : ['Nutrición Clínica']),
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
    nodes,
    edges,
    ...(clinicalContext ? { clinicalContext } : {}),
    ...(reference ? { reference } : {}),
    ...(validSourceImage ? { sourceImageDataUrl: validSourceImage } : {}),
  };

  return autoLayoutDiagram(diagram);
}

/**
 * Hierarchical symmetric Auto-Layout (layered topological rank assignment + centered rows).
 * Reorganizes nodes cleanly without overlaps, preserving user content & styles.
 */
export function autoLayoutDiagram(diagram: EditableDiagram): EditableDiagram {
  const { nodes, edges } = diagram;
  if (nodes.length === 0) return diagram;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const n of nodes) {
    outgoing.set(n.id, []);
    incomingCount.set(n.id, 0);
  }

  for (const e of edges) {
    if (!nodeById.has(e.from) || !nodeById.has(e.to) || e.from === e.to) continue;
    outgoing.get(e.from)!.push(e.to);
    incomingCount.set(e.to, (incomingCount.get(e.to) ?? 0) + 1);
  }

  // Assign layers via longest-path BFS with cycle protection
  const rank = new Map<string, number>();
  const roots = nodes.filter((n) => (incomingCount.get(n.id) ?? 0) === 0);
  const startNodes = roots.length > 0 ? roots : [nodes[0]];

  const queue: string[] = [];
  for (const r of startNodes) {
    rank.set(r.id, 0);
    queue.push(r.id);
  }

  let safetySteps = 0;
  const maxSteps = nodes.length * nodes.length + 20;

  while (queue.length > 0 && safetySteps < maxSteps) {
    safetySteps++;
    const currentId = queue.shift()!;
    const currentRank = rank.get(currentId) ?? 0;
    for (const nextId of outgoing.get(currentId) ?? []) {
      const candidateRank = currentRank + 1;
      const existingRank = rank.get(nextId);
      if (existingRank === undefined || (candidateRank > existingRank && candidateRank < nodes.length)) {
        rank.set(nextId, candidateRank);
        queue.push(nextId);
      }
    }
  }

  // Assign any disconnected nodes cleanly to subsequent ranks
  let maxRank = 0;
  for (const r of rank.values()) {
    if (r > maxRank) maxRank = r;
  }
  for (const n of nodes) {
    if (!rank.has(n.id)) {
      maxRank += 1;
      rank.set(n.id, maxRank);
    }
  }

  // Group nodes into rows by rank
  const layers = new Map<number, DiagramNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const list = layers.get(r) ?? [];
    list.push(n);
    layers.set(r, list);
  }

  const sortedRanks = Array.from(layers.keys()).sort((a, b) => a - b);
  const HORIZONTAL_GAP = 64;
  const VERTICAL_GAP = 86;
  const TOP_MARGIN = 156;
  const CENTER_X = CANVAS_DEFAULT_WIDTH / 2;

  const positioned = new Map<string, DiagramNode>();
  let currentY = TOP_MARGIN;

  for (const r of sortedRanks) {
    const rowNodes = layers.get(r)!;

    // Order nodes in row by average X of their already-placed parent(s) to reduce edge crossings
    if (r > 0 && rowNodes.length > 1) {
      rowNodes.sort((a, b) => {
        const parentCenter = (nodeId: string) => {
          const parentXs = edges
            .filter((e) => e.to === nodeId)
            .map((e) => positioned.get(e.from))
            .filter((p): p is DiagramNode => Boolean(p))
            .map((p) => p.x + p.width / 2);
          if (parentXs.length === 0) return CENTER_X;
          return parentXs.reduce((acc, v) => acc + v, 0) / parentXs.length;
        };
        return parentCenter(a.id) - parentCenter(b.id);
      });
    }

    const totalRowWidth =
      rowNodes.reduce((sum, n) => sum + n.width, 0) +
      Math.max(0, rowNodes.length - 1) * HORIZONTAL_GAP;

    let cursorX = Math.round(CENTER_X - totalRowWidth / 2);
    let maxRowHeight = 0;

    for (const n of rowNodes) {
      positioned.set(n.id, {
        ...n,
        x: cursorX,
        y: currentY,
      });
      cursorX += n.width + HORIZONTAL_GAP;
      if (n.height > maxRowHeight) maxRowHeight = n.height;
    }

    currentY += maxRowHeight + VERTICAL_GAP;
  }

  return {
    ...diagram,
    nodes: nodes.map((n) => positioned.get(n.id) ?? n),
  };
}

// ---------------------------------------------------------------------------
// Smart Hierarchical Auto-Layout (Sugiyama-inspired, adaptive-size aware)
// Designed for large, dense clinical algorithms with zero overlapping boxes,
// clean branch separation, virtual skip-edge corridors, and dynamic spacing.
// ---------------------------------------------------------------------------

interface LayoutItem {
  id: string;
  isVirtual: boolean;
  node?: DiagramNode;
  renderW: number;
  renderH: number;
  rank: number;
  semanticOrder: number;
  originalIndex: number;
  centerX: number;
}

function getEdgeSemanticBias(label: string): number {
  const norm = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!norm) return 0;

  if (
    /^si\b/.test(norm) ||
    norm.includes('seguro') ||
    norm.includes('segura') ||
    norm.includes('tolera') ||
    norm.includes('funcional') ||
    norm.includes('via oral') ||
    norm.includes('estable') ||
    norm.includes('positivo') ||
    norm.includes('leve') ||
    norm.includes('bajo riesgo') ||
    norm.includes('adecuad')
  ) {
    return -1;
  }

  if (
    /^no\b/.test(norm) ||
    norm.includes('contraind') ||
    norm.includes('insegur') ||
    norm.includes('aspiracion') ||
    norm.includes('severa') ||
    norm.includes('grave') ||
    norm.includes('alto riesgo') ||
    norm.includes('fallo') ||
    norm.includes('intoleran') ||
    norm.includes('parenteral') ||
    norm.includes('sonda') ||
    norm.includes('gastrostomia') ||
    norm.includes('np') ||
    norm.includes('npo') ||
    norm.includes('critico')
  ) {
    return 1;
  }

  return 0;
}

function computeReadableBaseSize(node: DiagramNode): { width: number; height: number } {
  const titleLen = node.title.trim().length;
  const body = node.body.trim();
  const bodyLen = body.length;
  const lineBreaks = body ? body.split('\n').length - 1 : 0;
  const totalChars = titleLen + bodyLen;

  const isTapered =
    node.shape === 'diamond' ||
    node.shape === 'oval' ||
    node.shape === 'hexagon' ||
    node.shape === 'parallelogram';

  // Target comfortable reading width so dense clinical boxes stay well-proportioned
  let idealWidth = 310;
  if (totalChars > 240 || bodyLen > 180) {
    idealWidth = 410;
  } else if (totalChars > 150 || bodyLen > 110 || lineBreaks >= 3) {
    idealWidth = 380;
  } else if (totalChars > 90 || bodyLen > 60) {
    idealWidth = 350;
  } else if (node.shape === 'decision' || node.shape === 'pill' || isTapered) {
    idealWidth = 336;
  }

  if (node.shape === 'diamond') {
    idealWidth = Math.max(idealWidth, 360);
  }

  // Respect user-widened boxes (up to a sensible ceiling), while expanding cramped boxes
  const width = Math.round(
    Math.min(440, Math.max(MIN_NODE_WIDTH, Math.max(node.width, idealWidth)))
  );

  // Measure baseline height at scale=1 with the readable width
  const baselineMetrics = computeAdaptiveNodeMetrics({ ...node, width, height: MIN_NODE_HEIGHT }, 1);
  // Keep user-tall boxes unless excessively empty; always guarantee text fits comfortably
  const maxReasonableHeight = Math.max(baselineMetrics.height + 32, 110);
  const height = Math.round(
    Math.max(baselineMetrics.height, Math.min(node.height, maxReasonableHeight))
  );

  return { width, height };
}

function countAdjacentLayerCrossings(
  upperIds: string[],
  lowerIds: string[],
  adjDown: Map<string, string[]>
): number {
  const lowerPos = new Map<string, number>();
  lowerIds.forEach((id, idx) => lowerPos.set(id, idx));

  const edgePairs: Array<[number, number]> = [];
  upperIds.forEach((uId, uIdx) => {
    const targets = adjDown.get(uId) ?? [];
    for (const vId of targets) {
      const vIdx = lowerPos.get(vId);
      if (vIdx !== undefined) {
        edgePairs.push([uIdx, vIdx]);
      }
    }
  });

  let crossings = 0;
  for (let i = 0; i < edgePairs.length; i++) {
    const [u1, v1] = edgePairs[i];
    for (let j = i + 1; j < edgePairs.length; j++) {
      const [u2, v2] = edgePairs[j];
      if ((u1 < u2 && v1 > v2) || (u1 > u2 && v1 < v2)) {
        crossings++;
      }
    }
  }
  return crossings;
}

function countTotalCrossings(
  layerOrder: string[][],
  adjDown: Map<string, string[]>
): number {
  let total = 0;
  for (let r = 0; r < layerOrder.length - 1; r++) {
    total += countAdjacentLayerCrossings(layerOrder[r], layerOrder[r + 1], adjDown);
  }
  return total;
}

function resolveRowCollisions(
  items: LayoutItem[],
  realGap: number,
  virtualGap: number
): void {
  if (items.length <= 1) return;

  const gapBetween = (a: LayoutItem, b: LayoutItem) =>
    a.isVirtual || b.isVirtual ? virtualGap : realGap;

  const originalDesired = items.map((it) => it.centerX);

  // Forward pass (strict non-overlap left-to-right)
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const minCenter = prev.centerX + prev.renderW / 2 + gapBetween(prev, curr) + curr.renderW / 2;
    if (curr.centerX < minCenter) {
      curr.centerX = minCenter;
    }
  }

  // Re-balance global drift so the row stays centered around its desired barycenter
  let totalShift = 0;
  let realCount = 0;
  for (let i = 0; i < items.length; i++) {
    if (!items[i].isVirtual) {
      totalShift += items[i].centerX - originalDesired[i];
      realCount++;
    }
  }
  if (realCount > 0) {
    const avgDrift = totalShift / realCount;
    for (const it of items) {
      it.centerX -= avgDrift;
    }
  }

  // Backward pull-back for any loose items on the left that drifted too far
  for (let i = items.length - 2; i >= 0; i--) {
    const curr = items[i];
    const next = items[i + 1];
    const maxCenter = next.centerX - next.renderW / 2 - gapBetween(curr, next) - curr.renderW / 2;
    if (curr.centerX > maxCenter) {
      curr.centerX = maxCenter;
    }
  }
}

/**
 * Intelligent Sugiyama-inspired hierarchical layout built specifically for large,
 * dense clinical algorithms:
 * - Adapts proportions & uses true `computeAdaptiveNodeMetrics` footprint (respecting fontScale)
 * - Separates disconnected components & detached cards cleanly
 * - Inserts virtual skip-edge corridors so multi-row jumps never slice through middle cards
 * - Minimizes edge crossings via multi-pass top-down/bottom-up barycenter sweeps
 * - Aligns branches to parent subtrees with dynamic label-aware row & column gaps
 * - Enforces a final pairwise bounding-box safety invariant guaranteeing zero overlaps
 */
export function smartAutoLayoutDiagram(diagram: EditableDiagram): EditableDiagram {
  const { nodes, edges } = diagram;
  if (nodes.length === 0) return diagram;

  const fontScale = diagram.fontScale ?? 1;
  const originalIndexMap = new Map<string, number>();
  nodes.forEach((n, idx) => originalIndexMap.set(n.id, idx));

  // Stage 1: Compute balanced readable base sizes & true rendered footprint
  const sizedNodeMap = new Map<string, DiagramNode>();
  const footprintMap = new Map<string, { w: number; h: number }>();

  for (const n of nodes) {
    const { width, height } = computeReadableBaseSize(n);
    const sized: DiagramNode = { ...n, width, height };
    sizedNodeMap.set(n.id, sized);

    const rendered = computeAdaptiveNodeMetrics(sized, fontScale);
    // Add modest safety buffer for DOM text wrapping variance + DECISIÓN pill badge
    const badgeTopExtra = sized.shape === 'decision' ? 14 : 0;
    footprintMap.set(n.id, {
      w: rendered.width,
      h: rendered.height + 16 + badgeTopExtra,
    });
  }

  const validEdges = edges.filter(
    (e) => sizedNodeMap.has(e.from) && sizedNodeMap.has(e.to) && e.from !== e.to
  );

  // Stage 2: Partition into undirected connected components
  const undirected = new Map<string, Set<string>>();
  for (const n of nodes) undirected.set(n.id, new Set());
  for (const e of validEdges) {
    undirected.get(e.from)!.add(e.to);
    undirected.get(e.to)!.add(e.from);
  }

  const visitedComp = new Set<string>();
  const components: string[][] = [];
  for (const n of nodes) {
    if (visitedComp.has(n.id)) continue;
    const comp: string[] = [];
    const stack = [n.id];
    visitedComp.add(n.id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of undirected.get(cur) ?? []) {
        if (!visitedComp.has(nb)) {
          visitedComp.add(nb);
          stack.push(nb);
        }
      }
    }
    comp.sort((a, b) => (originalIndexMap.get(a) ?? 0) - (originalIndexMap.get(b) ?? 0));
    components.push(comp);
  }

  // Main multi-node components sorted largest first; isolated single nodes placed in a clean dock below
  const multiComponents = components
    .filter((c) => c.length > 1)
    .sort((a, b) => b.length - a.length);
  const isolatedIds = components.filter((c) => c.length === 1).map((c) => c[0]);

  if (multiComponents.length === 0 && isolatedIds.length > 0) {
    // All nodes are disconnected: arrange in a clean grid
    const cols = Math.min(3, Math.ceil(Math.sqrt(isolatedIds.length)));
    const HORIZ_GAP = 96;
    const VERT_GAP = 92;
    const rows: string[][] = [];
    for (let i = 0; i < isolatedIds.length; i += cols) {
      rows.push(isolatedIds.slice(i, i + cols));
    }

    const positioned = new Map<string, DiagramNode>();
    let curY = 128;
    for (const row of rows) {
      const rowW =
        row.reduce((sum, id) => sum + (footprintMap.get(id)?.w ?? 320), 0) +
        Math.max(0, row.length - 1) * HORIZ_GAP;
      let curX = Math.round(CANVAS_DEFAULT_WIDTH / 2 - rowW / 2);
      let maxH = 0;
      for (const id of row) {
        const sn = sizedNodeMap.get(id)!;
        const fp = footprintMap.get(id)!;
        positioned.set(id, { ...sn, x: curX, y: curY });
        curX += fp.w + HORIZ_GAP;
        if (fp.h > maxH) maxH = fp.h;
      }
      curY += maxH + VERT_GAP;
    }

    return {
      ...diagram,
      nodes: nodes.map((n) => positioned.get(n.id) ?? n),
    };
  }

  // Layout each connected component independently and stack cleanly vertically
  const finalCoords = new Map<string, { x: number; y: number }>();
  let componentCursorY = 120;

  for (const compIds of multiComponents) {
    const compSet = new Set(compIds);
    const compEdges = validEdges.filter((e) => compSet.has(e.from) && compSet.has(e.to));

    // Build directed adjacency for cycle-safe DFS
    const rawOut = new Map<string, DiagramEdge[]>();
    const rawIn = new Map<string, DiagramEdge[]>();
    for (const id of compIds) {
      rawOut.set(id, []);
      rawIn.set(id, []);
    }
    for (const e of compEdges) {
      rawOut.get(e.from)!.push(e);
      rawIn.get(e.to)!.push(e);
    }

    // Identify back-edges via DFS starting from natural roots
    const roots = compIds.filter((id) => (rawIn.get(id)?.length ?? 0) === 0);
    const dfsOrder = [
      ...roots,
      ...compIds.filter((id) => !roots.includes(id)),
    ];

    const dfsState = new Map<string, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=done
    const backEdgeIds = new Set<string>();

    const visitDfs = (u: string) => {
      dfsState.set(u, 1);
      for (const e of rawOut.get(u) ?? []) {
        const st = dfsState.get(e.to) ?? 0;
        if (st === 1) {
          backEdgeIds.add(e.id);
        } else if (st === 0) {
          visitDfs(e.to);
        }
      }
      dfsState.set(u, 2);
    };

    for (const id of dfsOrder) {
      if ((dfsState.get(id) ?? 0) === 0) {
        visitDfs(id);
      }
    }

    const dagEdges = compEdges.filter((e) => !backEdgeIds.has(e.id));
    const dagOut = new Map<string, DiagramEdge[]>();
    const dagIn = new Map<string, DiagramEdge[]>();
    const inDeg = new Map<string, number>();

    for (const id of compIds) {
      dagOut.set(id, []);
      dagIn.set(id, []);
      inDeg.set(id, 0);
    }
    for (const e of dagEdges) {
      dagOut.get(e.from)!.push(e);
      dagIn.get(e.to)!.push(e);
      inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
    }

    // Topological longest-path layering
    const rank = new Map<string, number>();
    const topoQueue: string[] = [];
    for (const id of compIds) {
      if ((inDeg.get(id) ?? 0) === 0) {
        rank.set(id, 0);
        topoQueue.push(id);
      }
    }

    const remInDeg = new Map(inDeg);
    let qIdx = 0;
    while (qIdx < topoQueue.length) {
      const u = topoQueue[qIdx++];
      const uRank = rank.get(u) ?? 0;
      for (const e of dagOut.get(u) ?? []) {
        const nextRank = uRank + 1;
        if ((rank.get(e.to) ?? -1) < nextRank) {
          rank.set(e.to, nextRank);
        }
        const nextDeg = (remInDeg.get(e.to) ?? 1) - 1;
        remInDeg.set(e.to, nextDeg);
        if (nextDeg === 0) {
          topoQueue.push(e.to);
        }
      }
    }

    for (const id of compIds) {
      if (!rank.has(id)) rank.set(id, 0);
    }

    // Pull secondary roots down close to their merge point (keep the primary entry root at rank 0)
    const primaryRoot =
      roots.find((id) => {
        const shape = sizedNodeMap.get(id)?.shape;
        return shape === 'pill' || shape === 'oval';
      }) ?? roots[0];

    for (const id of roots) {
      if (id === primaryRoot) continue;
      const children = dagOut.get(id) ?? [];
      if (children.length > 0) {
        const minChildRank = Math.min(...children.map((e) => rank.get(e.to) ?? 1));
        if (minChildRank > 1) {
          rank.set(id, minChildRank - 1);
        }
      }
    }

    // Normalize ranks to contiguous 0..maxRank
    const uniqueRanks = Array.from(new Set(compIds.map((id) => rank.get(id) ?? 0))).sort(
      (a, b) => a - b
    );
    const rankRemap = new Map<number, number>();
    uniqueRanks.forEach((r, idx) => rankRemap.set(r, idx));
    for (const id of compIds) {
      rank.set(id, rankRemap.get(rank.get(id) ?? 0) ?? 0);
    }
    const maxRank = uniqueRanks.length - 1;

    // Stage 3: Build virtual corridor nodes for skip-level edges (span > 1)
    const itemMap = new Map<string, LayoutItem>();
    for (const id of compIds) {
      const sn = sizedNodeMap.get(id)!;
      const fp = footprintMap.get(id)!;
      const incomingBias = (dagIn.get(id) ?? []).reduce(
        (acc, e) => acc + getEdgeSemanticBias(e.label),
        0
      );
      itemMap.set(id, {
        id,
        isVirtual: false,
        node: sn,
        renderW: fp.w,
        renderH: fp.h,
        rank: rank.get(id) ?? 0,
        semanticOrder: incomingBias,
        originalIndex: originalIndexMap.get(id) ?? 0,
        centerX: 0,
      });
    }

    const adjDown = new Map<string, string[]>();
    const adjUp = new Map<string, string[]>();
    const ensureAdj = (id: string) => {
      if (!adjDown.has(id)) adjDown.set(id, []);
      if (!adjUp.has(id)) adjUp.set(id, []);
    };
    for (const id of compIds) ensureAdj(id);

    let virtualCounter = 0;
    for (const e of dagEdges) {
      const rFrom = rank.get(e.from) ?? 0;
      const rTo = rank.get(e.to) ?? 0;
      const span = rTo - rFrom;
      if (span <= 0) continue;

      if (span === 1) {
        adjDown.get(e.from)!.push(e.to);
        adjUp.get(e.to)!.push(e.from);
      } else {
        const edgeBias = getEdgeSemanticBias(e.label);
        let prevId = e.from;
        for (let r = rFrom + 1; r < rTo; r++) {
          const virtId = `__virt_${virtualCounter++}_${e.id}_${r}`;
          itemMap.set(virtId, {
            id: virtId,
            isVirtual: true,
            renderW: 64,
            renderH: 1,
            rank: r,
            semanticOrder: edgeBias,
            originalIndex: 10000 + virtualCounter,
            centerX: 0,
          });
          ensureAdj(virtId);
          adjDown.get(prevId)!.push(virtId);
          adjUp.get(virtId)!.push(prevId);
          prevId = virtId;
        }
        adjDown.get(prevId)!.push(e.to);
        adjUp.get(e.to)!.push(prevId);
      }
    }

    // Group items into layers
    let layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
    for (const item of itemMap.values()) {
      layers[item.rank].push(item.id);
    }

    // Initial semantic ordering within each layer
    for (const layer of layers) {
      layer.sort((a, b) => {
        const ia = itemMap.get(a)!;
        const ib = itemMap.get(b)!;
        if (ia.semanticOrder !== ib.semanticOrder) return ia.semanticOrder - ib.semanticOrder;
        return ia.originalIndex - ib.originalIndex;
      });
    }

    // Multi-pass barycenter crossing minimization (keep strictly best ordering)
    let bestLayers = layers.map((row) => [...row]);
    let bestCrossings = countTotalCrossings(bestLayers, adjDown);

    for (let sweep = 0; sweep < 6; sweep++) {
      // Top-down barycenter sweep
      for (let r = 1; r <= maxRank; r++) {
        const upperPos = new Map<string, number>();
        layers[r - 1].forEach((id, idx) => upperPos.set(id, idx));
        const currentPos = new Map<string, number>();
        layers[r].forEach((id, idx) => currentPos.set(id, idx));

        const bary = new Map<string, number>();
        for (const id of layers[r]) {
          const parents = adjUp.get(id) ?? [];
          if (parents.length === 0) {
            bary.set(id, currentPos.get(id) ?? 0);
          } else {
            const sum = parents.reduce((acc, p) => acc + (upperPos.get(p) ?? 0), 0);
            bary.set(id, sum / parents.length);
          }
        }

        layers[r].sort((a, b) => {
          const diff = (bary.get(a) ?? 0) - (bary.get(b) ?? 0);
          if (Math.abs(diff) > 0.001) return diff;
          const ia = itemMap.get(a)!;
          const ib = itemMap.get(b)!;
          if (ia.semanticOrder !== ib.semanticOrder) return ia.semanticOrder - ib.semanticOrder;
          return (currentPos.get(a) ?? 0) - (currentPos.get(b) ?? 0);
        });
      }

      const afterDown = countTotalCrossings(layers, adjDown);
      if (afterDown < bestCrossings) {
        bestCrossings = afterDown;
        bestLayers = layers.map((row) => [...row]);
      }

      // Bottom-up barycenter sweep
      for (let r = maxRank - 1; r >= 0; r--) {
        const lowerPos = new Map<string, number>();
        layers[r + 1].forEach((id, idx) => lowerPos.set(id, idx));
        const currentPos = new Map<string, number>();
        layers[r].forEach((id, idx) => currentPos.set(id, idx));

        const bary = new Map<string, number>();
        for (const id of layers[r]) {
          const children = adjDown.get(id) ?? [];
          if (children.length === 0) {
            bary.set(id, currentPos.get(id) ?? 0);
          } else {
            const sum = children.reduce((acc, c) => acc + (lowerPos.get(c) ?? 0), 0);
            bary.set(id, sum / children.length);
          }
        }

        layers[r].sort((a, b) => {
          const diff = (bary.get(a) ?? 0) - (bary.get(b) ?? 0);
          if (Math.abs(diff) > 0.001) return diff;
          return (currentPos.get(a) ?? 0) - (currentPos.get(b) ?? 0);
        });
      }

      const afterUp = countTotalCrossings(layers, adjDown);
      if (afterUp < bestCrossings) {
        bestCrossings = afterUp;
        bestLayers = layers.map((row) => [...row]);
      }
    }

    layers = bestLayers;

    // Stage 4: Subtree-aligned horizontal coordinate assignment
    const maxRowLen = Math.max(...layers.map((row) => row.filter((id) => !itemMap.get(id)!.isVirtual).length));
    const hasLongLabels = compEdges.some((e) => e.label.trim().length > 22);
    const baseHorizGap =
      compIds.length >= 12 || maxRowLen >= 3
        ? hasLongLabels
          ? 116
          : 102
        : hasLongLabels
          ? 98
          : 88;
    const virtualGap = 44;

    // Layer 0 centered around x = 0
    {
      const rowItems = layers[0].map((id) => itemMap.get(id)!);
      const totalW =
        rowItems.reduce((sum, it) => sum + it.renderW, 0) +
        rowItems.slice(1).reduce((sum, it, idx) => {
          const prev = rowItems[idx];
          return sum + (prev.isVirtual || it.isVirtual ? virtualGap : baseHorizGap);
        }, 0);
      let cursor = -totalW / 2;
      for (let i = 0; i < rowItems.length; i++) {
        const it = rowItems[i];
        it.centerX = cursor + it.renderW / 2;
        const next = rowItems[i + 1];
        if (next) {
          cursor += it.renderW + (it.isVirtual || next.isVirtual ? virtualGap : baseHorizGap);
        }
      }
    }

    // Top-down placement aligned to parent subtrees
    for (let r = 1; r <= maxRank; r++) {
      const rowIds = layers[r];
      const rowItems = rowIds.map((id) => itemMap.get(id)!);

      // Group single-parent fan-out siblings to spread them symmetrically under their parent
      const singleParentChildren = new Map<string, LayoutItem[]>();
      for (const it of rowItems) {
        const parents = adjUp.get(it.id) ?? [];
        if (parents.length === 1) {
          const pId = parents[0];
          const list = singleParentChildren.get(pId) ?? [];
          list.push(it);
          singleParentChildren.set(pId, list);
        }
      }

      for (const it of rowItems) {
        const parents = adjUp.get(it.id) ?? [];
        if (parents.length === 0) {
          it.centerX = 0;
        } else if (parents.length === 1) {
          const pItem = itemMap.get(parents[0])!;
          const siblings = singleParentChildren.get(parents[0]) ?? [it];
          if (siblings.length === 1) {
            it.centerX = pItem.centerX;
          } else {
            const sibTotalW =
              siblings.reduce((sum, s) => sum + s.renderW, 0) +
              siblings.slice(1).reduce((sum, s, idx) => {
                const prev = siblings[idx];
                return sum + (prev.isVirtual || s.isVirtual ? virtualGap : baseHorizGap);
              }, 0);
            let sibCursor = pItem.centerX - sibTotalW / 2;
            for (let si = 0; si < siblings.length; si++) {
              const s = siblings[si];
              if (s.id === it.id) {
                it.centerX = sibCursor + s.renderW / 2;
                break;
              }
              const sNext = siblings[si + 1];
              sibCursor += s.renderW + (sNext && (s.isVirtual || sNext.isVirtual) ? virtualGap : baseHorizGap);
            }
          }
        } else {
          const parentCenters = parents.map((pId) => itemMap.get(pId)!.centerX);
          it.centerX = parentCenters.reduce((a, b) => a + b, 0) / parentCenters.length;
        }
      }

      resolveRowCollisions(rowItems, baseHorizGap, virtualGap);
    }

    // Bottom-up parent recentering (2 passes) strictly clamped within sibling clearance
    for (let pass = 0; pass < 2; pass++) {
      for (let r = maxRank - 1; r >= 0; r--) {
        const rowItems = layers[r].map((id) => itemMap.get(id)!);
        for (let i = 0; i < rowItems.length; i++) {
          const it = rowItems[i];
          const children = (adjDown.get(it.id) ?? []).map((cId) => itemMap.get(cId)!);
          if (children.length === 0) continue;

          const minChildX = Math.min(...children.map((c) => c.centerX));
          const maxChildX = Math.max(...children.map((c) => c.centerX));
          const targetCenter = (minChildX + maxChildX) / 2;

          let minAllowed = -Infinity;
          let maxAllowed = Infinity;
          if (i > 0) {
            const leftSib = rowItems[i - 1];
            const g = leftSib.isVirtual || it.isVirtual ? virtualGap : baseHorizGap;
            minAllowed = leftSib.centerX + leftSib.renderW / 2 + g + it.renderW / 2;
          }
          if (i < rowItems.length - 1) {
            const rightSib = rowItems[i + 1];
            const g = rightSib.isVirtual || it.isVirtual ? virtualGap : baseHorizGap;
            maxAllowed = rightSib.centerX - rightSib.renderW / 2 - g - it.renderW / 2;
          }

          if (minAllowed <= maxAllowed) {
            it.centerX = Math.max(minAllowed, Math.min(maxAllowed, targetCenter));
          }
        }
      }

      // Top-down single-child alignment polish within collision-free sibling intervals
      for (let r = 1; r <= maxRank; r++) {
        const rowItems = layers[r].map((id) => itemMap.get(id)!);
        for (let i = 0; i < rowItems.length; i++) {
          const it = rowItems[i];
          const parents = adjUp.get(it.id) ?? [];
          if (parents.length === 0) continue;
          const parentItems = parents.map((pId) => itemMap.get(pId)!);
          if (parents.length === 1 && (adjDown.get(parents[0])?.length ?? 0) > 1) {
            continue;
          }
          const targetCenter =
            parentItems.reduce((sum, p) => sum + p.centerX, 0) / parentItems.length;

          let minAllowed = -Infinity;
          let maxAllowed = Infinity;
          if (i > 0) {
            const leftSib = rowItems[i - 1];
            const g = leftSib.isVirtual || it.isVirtual ? virtualGap : baseHorizGap;
            minAllowed = leftSib.centerX + leftSib.renderW / 2 + g + it.renderW / 2;
          }
          if (i < rowItems.length - 1) {
            const rightSib = rowItems[i + 1];
            const g = rightSib.isVirtual || it.isVirtual ? virtualGap : baseHorizGap;
            maxAllowed = rightSib.centerX - rightSib.renderW / 2 - g - it.renderW / 2;
          }
          if (minAllowed <= maxAllowed) {
            it.centerX = Math.max(minAllowed, Math.min(maxAllowed, targetCenter));
          }
        }
      }
    }

    // Stage 5: Compute dynamic label-aware vertical row positions
    const rowY = new Array<number>(maxRank + 1).fill(0);
    const rowHeight = new Array<number>(maxRank + 1).fill(0);

    for (let r = 0; r <= maxRank; r++) {
      const realItems = layers[r]
        .map((id) => itemMap.get(id)!)
        .filter((it) => !it.isVirtual);
      rowHeight[r] =
        realItems.length > 0 ? Math.max(...realItems.map((it) => it.renderH)) : 96;
    }

    let curY = componentCursorY;
    for (let r = 0; r <= maxRank; r++) {
      rowY[r] = curY;
      if (r < maxRank) {
        const bandEdges = compEdges.filter((e) => {
          const rFrom = rank.get(e.from) ?? 0;
          const rTo = rank.get(e.to) ?? 0;
          return (rFrom === r && rTo === r + 1) || (rFrom <= r && rTo >= r + 1);
        });
        const directBandEdges = bandEdges.filter(
          (e) => (rank.get(e.from) ?? 0) === r && (rank.get(e.to) ?? 0) === r + 1
        );
        const labeledCount = directBandEdges.filter((e) => e.label.trim().length > 0).length;
        const maxLabelLen = directBandEdges.reduce(
          (m, e) => Math.max(m, e.label.trim().length),
          0
        );
        const horizontalElbows = directBandEdges.filter((e) => {
          const sx = itemMap.get(e.from)?.centerX ?? 0;
          const tx = itemMap.get(e.to)?.centerX ?? 0;
          return Math.abs(sx - tx) > 20;
        }).length;

        const nextRowHasDecision = layers[r + 1].some(
          (id) => itemMap.get(id)?.node?.shape === 'decision'
        );

        let gap = 104;
        if (labeledCount > 0) gap = Math.max(gap, 118);
        if (maxLabelLen > 24 || fontScale > 1.08) gap = Math.max(gap, 130);
        if (horizontalElbows >= 3) {
          gap += Math.min(56, (horizontalElbows - 2) * 14);
        }
        if (nextRowHasDecision) {
          gap += 14;
        }
        curY += rowHeight[r] + gap;
      } else {
        curY += rowHeight[r];
      }
    }

    // Center component horizontally around CANVAS_DEFAULT_WIDTH / 2
    let compMinX = Infinity;
    let compMaxX = -Infinity;
    for (const id of compIds) {
      const it = itemMap.get(id)!;
      compMinX = Math.min(compMinX, it.centerX - it.renderW / 2);
      compMaxX = Math.max(compMaxX, it.centerX + it.renderW / 2);
    }
    const compCenter = (compMinX + compMaxX) / 2;
    let shiftX = CANVAS_DEFAULT_WIDTH / 2 - compCenter;
    if (compMinX + shiftX < 80) {
      shiftX = 80 - compMinX;
    }

    for (const id of compIds) {
      const it = itemMap.get(id)!;
      const sn = sizedNodeMap.get(id)!;
      const rendered = computeAdaptiveNodeMetrics(sn, fontScale);
      // Place node centered inside its reserved footprint column
      const x = Math.round(it.centerX + shiftX - rendered.width / 2);
      const y = Math.round(rowY[it.rank]);
      finalCoords.set(id, { x, y });
    }

    componentCursorY = curY + 120;
  }

  // Place isolated / detached nodes neatly below all connected components
  if (isolatedIds.length > 0) {
    const cols = Math.min(3, isolatedIds.length);
    const HORIZ_GAP = 96;
    const VERT_GAP = 88;
    let isoY = componentCursorY;
    for (let i = 0; i < isolatedIds.length; i += cols) {
      const slice = isolatedIds.slice(i, i + cols);
      const rowW =
        slice.reduce((sum, id) => sum + (footprintMap.get(id)?.w ?? 320), 0) +
        Math.max(0, slice.length - 1) * HORIZ_GAP;
      let isoX = Math.max(80, Math.round(CANVAS_DEFAULT_WIDTH / 2 - rowW / 2));
      let maxH = 0;
      for (const id of slice) {
        const fp = footprintMap.get(id)!;
        finalCoords.set(id, { x: isoX, y: Math.round(isoY) });
        isoX += fp.w + HORIZ_GAP;
        if (fp.h > maxH) maxH = fp.h;
      }
      isoY += maxH + VERT_GAP;
    }
  }

  // Final Pairwise Bounding-Box Safety Guard (guarantees 0 overlaps at rendered fontScale)
  const MIN_CLEARANCE_X = 44;
  const MIN_CLEARANCE_Y = 40;
  const positionedList = nodes.map((n) => {
    const sn = sizedNodeMap.get(n.id)!;
    const coord = finalCoords.get(n.id) ?? { x: sn.x, y: sn.y };
    const fp = footprintMap.get(n.id)!;
    return {
      node: { ...sn, x: coord.x, y: coord.y },
      w: fp.w,
      h: fp.h,
    };
  });

  for (let iter = 0; iter < 8; iter++) {
    let anyMoved = false;
    for (let i = 0; i < positionedList.length; i++) {
      for (let j = i + 1; j < positionedList.length; j++) {
        const a = positionedList[i];
        const b = positionedList[j];

        const aCx = a.node.x + a.w / 2;
        const aCy = a.node.y + a.h / 2;
        const bCx = b.node.x + b.w / 2;
        const bCy = b.node.y + b.h / 2;

        const reqDx = (a.w + b.w) / 2 + MIN_CLEARANCE_X;
        const reqDy = (a.h + b.h) / 2 + MIN_CLEARANCE_Y;
        const overlapX = reqDx - Math.abs(bCx - aCx);
        const overlapY = reqDy - Math.abs(bCy - aCy);

        if (overlapX > 0 && overlapY > 0) {
          anyMoved = true;
          // If nodes sit on roughly the same row, separate horizontally; otherwise push lower node down
          if (Math.abs(a.node.y - b.node.y) < Math.min(a.h, b.h) * 0.45) {
            const push = Math.ceil(overlapX / 2);
            if (aCx <= bCx) {
              a.node.x -= push;
              b.node.x += push;
            } else {
              a.node.x += push;
              b.node.x -= push;
            }
          } else {
            const pushY = Math.ceil(overlapY);
            if (a.node.y <= b.node.y) {
              b.node.y += pushY;
            } else {
              a.node.y += pushY;
            }
          }
        }
      }
    }
    if (!anyMoved) break;
  }

  // Re-clamp left margin cleanly if safety guard nudged a node left of 60px
  let globalMinX = Infinity;
  for (const item of positionedList) {
    if (item.node.x < globalMinX) globalMinX = item.node.x;
  }
  if (Number.isFinite(globalMinX) && globalMinX < 64) {
    const shift = Math.ceil(64 - globalMinX);
    for (const item of positionedList) {
      item.node.x += shift;
    }
  }

  return {
    ...diagram,
    nodes: positionedList.map((item) => item.node),
  };
}

/**
 * Computes Keynote / Apple Freeform magnetic snap position & blue alignment guides
 * when dragging a node relative to sibling nodes.
 */
export function computeSnapAndGuides(
  draggingNode: { id: string; width: number; height: number },
  proposedX: number,
  proposedY: number,
  otherNodes: DiagramNode[],
  threshold: number = SNAP_THRESHOLD_PX
): SnapResult {
  let snappedX = proposedX;
  let snappedY = proposedY;
  let bestDx = threshold + 1;
  let bestDy = threshold + 1;

  let xGuide: AlignmentGuide | null = null;
  let yGuide: AlignmentGuide | null = null;

  const dragLeft = proposedX;
  const dragCenterX = proposedX + draggingNode.width / 2;
  const dragRight = proposedX + draggingNode.width;

  const dragTop = proposedY;
  const dragCenterY = proposedY + draggingNode.height / 2;
  const dragBottom = proposedY + draggingNode.height;

  for (const other of otherNodes) {
    if (other.id === draggingNode.id) continue;

    const otherLeft = other.x;
    const otherCenterX = other.x + other.width / 2;
    const otherRight = other.x + other.width;

    const xPairs: Array<[number, number, number]> = [
      [dragLeft, otherLeft, otherLeft],
      [dragCenterX, otherCenterX, otherCenterX - draggingNode.width / 2],
      [dragRight, otherRight, otherRight - draggingNode.width],
      [dragLeft, otherRight, otherRight],
      [dragRight, otherLeft, otherLeft - draggingNode.width],
    ];

    for (const [dragAnchor, targetAnchor, nextX] of xPairs) {
      const dist = Math.abs(dragAnchor - targetAnchor);
      if (dist <= threshold && dist < bestDx) {
        bestDx = dist;
        snappedX = Math.round(nextX);
        xGuide = {
          axis: 'x',
          position: Math.round(targetAnchor),
          start: Math.min(proposedY, other.y) - 24,
          end: Math.max(proposedY + draggingNode.height, other.y + other.height) + 24,
        };
      }
    }

    const otherTop = other.y;
    const otherCenterY = other.y + other.height / 2;
    const otherBottom = other.y + other.height;

    const yPairs: Array<[number, number, number]> = [
      [dragTop, otherTop, otherTop],
      [dragCenterY, otherCenterY, otherCenterY - draggingNode.height / 2],
      [dragBottom, otherBottom, otherBottom - draggingNode.height],
    ];

    for (const [dragAnchor, targetAnchor, nextY] of yPairs) {
      const dist = Math.abs(dragAnchor - targetAnchor);
      if (dist <= threshold && dist < bestDy) {
        bestDy = dist;
        snappedY = Math.round(nextY);
        yGuide = {
          axis: 'y',
          position: Math.round(targetAnchor),
          start: Math.min(proposedX, other.x) - 24,
          end: Math.max(proposedX + draggingNode.width, other.x + other.width) + 24,
        };
      }
    }
  }

  const guides: AlignmentGuide[] = [];
  if (xGuide) guides.push(xGuide);
  if (yGuide) guides.push(yGuide);

  return { x: snappedX, y: snappedY, guides };
}

/**
 * Computes clean orthogonal / straight SVG path and label midpoint between two nodes.
 */
export function computeEdgeGeometry(
  source: DiagramNode,
  target: DiagramNode,
  edge: DiagramEdge
): EdgeGeometry {
  const sxCenter = source.x + source.width / 2;
  const syCenter = source.y + source.height / 2;
  const txCenter = target.x + target.width / 2;
  const tyCenter = target.y + target.height / 2;

  const isDashed = edge.style === 'dashed';
  const normalizedLabel = edge.label.toLowerCase();
  const strokeColor = isDashed
    ? '#8E8E93'
    : normalizedLabel.startsWith('sí') || normalizedLabel.startsWith('si') || normalizedLabel.includes('funcional')
      ? '#15803D'
      : normalizedLabel.startsWith('no') || normalizedLabel.includes('contraind') || normalizedLabel.includes('íleo')
        ? '#B45309'
        : '#6E6E73';

  // Choose anchor ports cleanly based on relative positions without overlap kinks
  const targetIsBelow = target.y >= source.y + source.height - 2;
  const targetIsAbove = source.y >= target.y + target.height - 2;

  let startX = sxCenter;
  let startY = source.y + source.height;
  let endX = txCenter;
  let endY = target.y;

  if (targetIsBelow) {
    startX = sxCenter;
    startY = source.y + source.height;
    endX = txCenter;
    endY = target.y;
  } else if (targetIsAbove) {
    startX = sxCenter;
    startY = source.y;
    endX = txCenter;
    endY = target.y + target.height;
  } else if (txCenter >= sxCenter) {
    startX = source.x + source.width;
    startY = syCenter;
    endX = target.x;
    endY = tyCenter;
  } else {
    startX = source.x;
    startY = syCenter;
    endX = target.x + target.width;
    endY = tyCenter;
  }

  const r = (v: number) => Math.round(v * 10) / 10;

  if (edge.style === 'straight' || Math.abs(startX - endX) < 3 || Math.abs(startY - endY) < 3) {
    return {
      pathD: `M ${r(startX)} ${r(startY)} L ${r(endX)} ${r(endY)}`,
      labelX: r((startX + endX) / 2),
      labelY: r((startY + endY) / 2),
      strokeColor,
      isDashed,
    };
  }

  // Smooth rounded orthogonal elbow connector (Apple macOS flowchart aesthetic)
  if (targetIsBelow || targetIsAbove) {
    const midY = r((startY + endY) / 2);
    const dirX = endX > startX ? 1 : -1;
    const dirY = endY > startY ? 1 : -1;
    const radius = Math.max(
      0,
      Math.min(12, Math.abs(endX - startX) / 2, Math.abs(midY - startY), Math.abs(endY - midY))
    );

    const pathD = [
      `M ${r(startX)} ${r(startY)}`,
      `L ${r(startX)} ${r(midY - dirY * radius)}`,
      `Q ${r(startX)} ${midY} ${r(startX + dirX * radius)} ${midY}`,
      `L ${r(endX - dirX * radius)} ${midY}`,
      `Q ${r(endX)} ${midY} ${r(endX)} ${r(midY + dirY * radius)}`,
      `L ${r(endX)} ${r(endY)}`,
    ].join(' ');

    return {
      pathD,
      labelX: r((startX + endX) / 2),
      labelY: midY,
      strokeColor,
      isDashed,
    };
  }

  // Smooth rounded horizontal orthogonal elbow connector
  const midX = r((startX + endX) / 2);
  const dirX = endX > startX ? 1 : -1;
  const dirY = endY > startY ? 1 : -1;
  const radius = Math.max(
    0,
    Math.min(12, Math.abs(endY - startY) / 2, Math.abs(midX - startX), Math.abs(endX - midX))
  );

  const pathD = [
    `M ${r(startX)} ${r(startY)}`,
    `L ${r(midX - dirX * radius)} ${r(startY)}`,
    `Q ${midX} ${r(startY)} ${midX} ${r(startY + dirY * radius)}`,
    `L ${midX} ${r(endY - dirY * radius)}`,
    `Q ${midX} ${r(endY)} ${r(midX + dirX * radius)} ${r(endY)}`,
    `L ${r(endX)} ${r(endY)}`,
  ].join(' ');

  return {
    pathD,
    labelX: midX,
    labelY: r((startY + endY) / 2),
    strokeColor,
    isDashed,
  };
}

function buildRoundedPolylinePath(points: Array<{ x: number; y: number }>, maxRadius = 12): string {
  const round1 = (v: number) => Math.round(v * 10) / 10;
  // Remove consecutive duplicate or collinear points
  const pts: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    const prev = pts[pts.length - 1];
    if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 0.5) {
      pts.push({ x: round1(p.x), y: round1(p.y) });
    }
  }
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  const cmds: string[] = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y);
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 0.5 || len2 < 0.5) continue;

    // Collinear check
    const cross = Math.abs((v1x / len1) * (v2y / len2) - (v1y / len1) * (v2x / len2));
    if (cross < 0.01) {
      cmds.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    const r = Math.min(maxRadius, len1 / 2, len2 / 2);
    const pBeforeX = round1(curr.x - (v1x / len1) * r);
    const pBeforeY = round1(curr.y - (v1y / len1) * r);
    const pAfterX = round1(curr.x + (v2x / len2) * r);
    const pAfterY = round1(curr.y + (v2y / len2) * r);

    cmds.push(`L ${pBeforeX} ${pBeforeY}`);
    cmds.push(`Q ${curr.x} ${curr.y} ${pAfterX} ${pAfterY}`);
  }

  const last = pts[pts.length - 1];
  cmds.push(`L ${last.x} ${last.y}`);
  return cmds.join(' ');
}

function segmentIntersectsNodeRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  node: DiagramNode,
  pad = 12
): boolean {
  const left = node.x - pad;
  const right = node.x + node.width + pad;
  const top = node.y - pad;
  const bottom = node.y + node.height + pad;

  const segMinX = Math.min(x1, x2);
  const segMaxX = Math.max(x1, x2);
  const segMinY = Math.min(y1, y2);
  const segMaxY = Math.max(y1, y2);

  return segMaxX > left && segMinX < right && segMaxY > top && segMinY < bottom;
}

/**
 * Graph-aware multi-edge geometry router:
 * - Slightly distributes crowded fan-out / fan-in anchor ports so arrows don't clump
 * - Staggers overlapping horizontal rails across inter-row channels
 * - Detours skip-level vertical edges cleanly around intermediate obstacle boxes
 * - Separates colliding branch label pills away from each other and from node boxes
 */
export function computeDiagramEdgeGeometries(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): Map<string, EdgeGeometry> {
  const result = new Map<string, EdgeGeometry>();
  if (edges.length === 0) return result;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const round1 = (v: number) => Math.round(v * 10) / 10;

  // Group downward outgoing and incoming edges per node for subtle port distribution
  const downOutByNode = new Map<string, DiagramEdge[]>();
  const downInByNode = new Map<string, DiagramEdge[]>();

  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;
    const isBelow = tgt.y >= src.y + src.height - 2;
    if (isBelow && edge.style !== 'straight') {
      const outList = downOutByNode.get(src.id) ?? [];
      outList.push(edge);
      downOutByNode.set(src.id, outList);

      const inList = downInByNode.get(tgt.id) ?? [];
      inList.push(edge);
      downInByNode.set(tgt.id, inList);
    }
  }

  const startXOffset = new Map<string, number>();
  const endXOffset = new Map<string, number>();

  for (const [nodeId, list] of downOutByNode.entries()) {
    if (list.length <= 1) continue;
    const src = nodeMap.get(nodeId)!;
    list.sort((a, b) => {
      const ta = nodeMap.get(a.to)!;
      const tb = nodeMap.get(b.to)!;
      return ta.x + ta.width / 2 - (tb.x + tb.width / 2);
    });
    const maxSpread = Math.min(72, src.width * 0.34);
    const step = list.length > 1 ? maxSpread / (list.length - 1) : 0;
    list.forEach((e, idx) => {
      startXOffset.set(e.id, round1(-maxSpread / 2 + idx * step));
    });
  }

  for (const [nodeId, list] of downInByNode.entries()) {
    if (list.length <= 1) continue;
    const tgt = nodeMap.get(nodeId)!;
    list.sort((a, b) => {
      const sa = nodeMap.get(a.from)!;
      const sb = nodeMap.get(b.from)!;
      return sa.x + sa.width / 2 - (sb.x + sb.width / 2);
    });
    const maxSpread = Math.min(72, tgt.width * 0.34);
    const step = list.length > 1 ? maxSpread / (list.length - 1) : 0;
    list.forEach((e, idx) => {
      endXOffset.set(e.id, round1(-maxSpread / 2 + idx * step));
    });
  }

  // Pre-compute horizontal rail staggering for downward orthogonal edges sharing a vertical corridor
  interface DownEdgeCandidate {
    edge: DiagramEdge;
    src: DiagramNode;
    tgt: DiagramNode;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    baseMidY: number;
    minX: number;
    maxX: number;
  }

  const downCandidates: DownEdgeCandidate[] = [];
  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;
    const isBelow = tgt.y >= src.y + src.height - 2;
    if (!isBelow || edge.style === 'straight') continue;

    const sx = round1(src.x + src.width / 2 + (startXOffset.get(edge.id) ?? 0));
    const sy = src.y + src.height;
    const tx = round1(tgt.x + tgt.width / 2 + (endXOffset.get(edge.id) ?? 0));
    const ty = tgt.y;
    if (Math.abs(sx - tx) < 3) continue;

    downCandidates.push({
      edge,
      src,
      tgt,
      startX: sx,
      startY: sy,
      endX: tx,
      endY: ty,
      baseMidY: round1((sy + ty) / 2),
      minX: Math.min(sx, tx),
      maxX: Math.max(sx, tx),
    });
  }

  // Assign distinct midY lanes whenever two downward elbows overlap in both X and Y bands
  const assignedMidY = new Map<string, number>();
  // Sort outer-span edges slightly earlier so inner siblings step cleanly beneath
  downCandidates.sort((a, b) => {
    if (Math.abs(a.baseMidY - b.baseMidY) > 12) return a.baseMidY - b.baseMidY;
    return Math.abs(b.endX - b.startX) - Math.abs(a.endX - a.startX);
  });

  const placedRails: Array<{ minX: number; maxX: number; midY: number }> = [];
  for (const cand of downCandidates) {
    const minAllowedY = cand.startY + 22;
    const maxAllowedY = cand.endY - 22;
    let chosenY = Math.max(minAllowedY, Math.min(maxAllowedY, cand.baseMidY));

    const offsets = [0, -18, 18, -36, 36, -54, 54];
    for (const off of offsets) {
      const candidateY = round1(cand.baseMidY + off);
      if (candidateY < minAllowedY || candidateY > maxAllowedY) continue;
      const collides = placedRails.some(
        (rail) =>
          Math.abs(rail.midY - candidateY) < 15 &&
          Math.min(rail.maxX, cand.maxX) - Math.max(rail.minX, cand.minX) > -10
      );
      if (!collides) {
        chosenY = candidateY;
        break;
      }
    }

    assignedMidY.set(cand.edge.id, chosenY);
    placedRails.push({ minX: cand.minX, maxX: cand.maxX, midY: chosenY });
  }

  // Compute each edge's geometry, with obstacle-detour routing for skip-level edges
  for (const edge of edges) {
    const src = nodeMap.get(edge.from);
    const tgt = nodeMap.get(edge.to);
    if (!src || !tgt) continue;

    const baseGeom = computeEdgeGeometry(src, tgt, edge);
    const isBelow = tgt.y >= src.y + src.height - 2;
    const isAbove = src.y >= tgt.y + tgt.height - 2;

    if (edge.style === 'straight' || (!isBelow && !isAbove)) {
      result.set(edge.id, baseGeom);
      continue;
    }

    const startX = isBelow
      ? round1(src.x + src.width / 2 + (startXOffset.get(edge.id) ?? 0))
      : round1(src.x + src.width / 2);
    const startY = isBelow ? src.y + src.height : src.y;
    const endX = isBelow
      ? round1(tgt.x + tgt.width / 2 + (endXOffset.get(edge.id) ?? 0))
      : round1(tgt.x + tgt.width / 2);
    const endY = isBelow ? tgt.y : tgt.y + tgt.height;

    const minSpanY = Math.min(startY, endY) + 4;
    const maxSpanY = Math.max(startY, endY) - 4;
    const intermediateNodes = nodes.filter(
      (n) =>
        n.id !== src.id &&
        n.id !== tgt.id &&
        n.y + n.height > minSpanY &&
        n.y < maxSpanY
    );

    const midY = assignedMidY.get(edge.id) ?? round1((startY + endY) / 2);

    // Check if the standard straight/3-segment path collides with any intermediate box
    const isBlockedByIntermediate =
      intermediateNodes.length > 0 &&
      intermediateNodes.some((obs) => {
        if (Math.abs(startX - endX) < 3) {
          return segmentIntersectsNodeRect(startX, startY, endX, endY, obs, 12);
        }
        return (
          segmentIntersectsNodeRect(startX, startY, startX, midY, obs, 10) ||
          segmentIntersectsNodeRect(startX, midY, endX, midY, obs, 10) ||
          segmentIntersectsNodeRect(endX, midY, endX, endY, obs, 10)
        );
      });

    if (isBlockedByIntermediate) {
      // Find clean unobstructed vertical corridor X outside intermediate boxes
      const PAD = 28;
      const obsMinX = Math.min(...intermediateNodes.map((o) => o.x));
      const obsMaxX = Math.max(...intermediateNodes.map((o) => o.x + o.width));

      const candidateXs: number[] = [
        round1((startX + endX) / 2),
        round1(obsMinX - PAD - 12),
        round1(obsMaxX + PAD + 12),
      ];
      for (const obs of intermediateNodes) {
        candidateXs.push(round1(obs.x - PAD));
        candidateXs.push(round1(obs.x + obs.width + PAD));
      }

      const isClearCorridor = (cx: number) =>
        intermediateNodes.every((obs) => cx < obs.x - 16 || cx > obs.x + obs.width + 16);

      const validCorridors = candidateXs.filter(isClearCorridor);
      const corridorX =
        validCorridors.length > 0
          ? validCorridors.reduce((best, cx) => {
              const bestCost = Math.abs(best - startX) + Math.abs(best - endX);
              const curCost = Math.abs(cx - startX) + Math.abs(cx - endX);
              return curCost < bestCost ? cx : best;
            }, validCorridors[0])
          : Math.abs(startX - obsMinX) < Math.abs(startX - obsMaxX)
            ? round1(obsMinX - 42)
            : round1(obsMaxX + 42);

      const dirY = endY > startY ? 1 : -1;
      const stubY1 = round1(startY + dirY * Math.min(28, Math.abs(endY - startY) * 0.2));
      const stubY2 = round1(endY - dirY * Math.min(28, Math.abs(endY - startY) * 0.2));

      const pts = [
        { x: startX, y: startY },
        { x: startX, y: stubY1 },
        { x: corridorX, y: stubY1 },
        { x: corridorX, y: stubY2 },
        { x: endX, y: stubY2 },
        { x: endX, y: endY },
      ];

      const pathD = buildRoundedPolylinePath(pts, 12);
      // Place label along the clear vertical corridor near the upper third
      const labelX = corridorX;
      const labelY = round1(stubY1 + (stubY2 - stubY1) * 0.34);

      result.set(edge.id, {
        pathD,
        labelX,
        labelY,
        strokeColor: baseGeom.strokeColor,
        isDashed: baseGeom.isDashed,
      });
      continue;
    }

    // Standard unobstructed downward/upward elbow with staggered midY and clean label anchor
    if (Math.abs(startX - endX) < 3) {
      result.set(edge.id, {
        pathD: `M ${startX} ${round1(startY)} L ${endX} ${round1(endY)}`,
        labelX: startX,
        labelY: round1((startY + endY) / 2),
        strokeColor: baseGeom.strokeColor,
        isDashed: baseGeom.isDashed,
      });
      continue;
    }

    const pts = [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY },
    ];
    const pathD = buildRoundedPolylinePath(pts, 12);

    // For fan-out branches, bias the label slightly toward the target side so sibling labels separate naturally
    const siblingsOut = downOutByNode.get(src.id)?.length ?? 1;
    const labelBias = siblingsOut > 1 ? 0.56 : 0.5;
    const labelX = round1(startX + (endX - startX) * labelBias);
    const labelY = midY;

    result.set(edge.id, {
      pathD,
      labelX,
      labelY,
      strokeColor: baseGeom.strokeColor,
      isDashed: baseGeom.isDashed,
    });
  }

  // 2D Label Pill Collision Resolution (between edge labels and against node boxes)
  interface LabelBox {
    edgeId: string;
    geom: EdgeGeometry;
    halfW: number;
    halfH: number;
  }

  const labelBoxes: LabelBox[] = [];
  for (const edge of edges) {
    const clean = edge.label.trim();
    if (!clean) continue;
    const geom = result.get(edge.id);
    if (!geom) continue;
    const fontSize = edge.labelFontSize ?? DEFAULT_EDGE_LABEL_FONT_SIZE;
    const w = Math.max(56, clean.length * (fontSize * 0.66) + 24);
    const h = Math.max(26, Math.round(fontSize * 2.1));
    labelBoxes.push({ edgeId: edge.id, geom, halfW: w / 2, halfH: h / 2 });
  }

  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    // Separate overlapping edge labels from each other
    for (let i = 0; i < labelBoxes.length; i++) {
      for (let j = i + 1; j < labelBoxes.length; j++) {
        const a = labelBoxes[i];
        const b = labelBoxes[j];
        const overlapX = a.halfW + b.halfW + 10 - Math.abs(b.geom.labelX - a.geom.labelX);
        const overlapY = a.halfH + b.halfH + 8 - Math.abs(b.geom.labelY - a.geom.labelY);
        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          if (overlapY <= overlapX) {
            const dy = round1(overlapY / 2 + 2);
            if (a.geom.labelY <= b.geom.labelY) {
              a.geom.labelY = round1(a.geom.labelY - dy);
              b.geom.labelY = round1(b.geom.labelY + dy);
            } else {
              a.geom.labelY = round1(a.geom.labelY + dy);
              b.geom.labelY = round1(b.geom.labelY - dy);
            }
          } else {
            const dx = round1(overlapX / 2 + 2);
            if (a.geom.labelX <= b.geom.labelX) {
              a.geom.labelX = round1(a.geom.labelX - dx);
              b.geom.labelX = round1(b.geom.labelX + dx);
            } else {
              a.geom.labelX = round1(a.geom.labelX + dx);
              b.geom.labelX = round1(b.geom.labelX - dx);
            }
          }
        }
      }
    }

    // Keep edge labels off node boxes
    for (const lb of labelBoxes) {
      for (const n of nodes) {
        const nCx = n.x + n.width / 2;
        const nCy = n.y + n.height / 2;
        const overlapX = lb.halfW + n.width / 2 + 8 - Math.abs(lb.geom.labelX - nCx);
        const overlapY = lb.halfH + n.height / 2 + 8 - Math.abs(lb.geom.labelY - nCy);
        if (overlapX > 0 && overlapY > 0) {
          moved = true;
          if (overlapY <= overlapX) {
            lb.geom.labelY = round1(
              lb.geom.labelY < nCy ? n.y - lb.halfH - 8 : n.y + n.height + lb.halfH + 8
            );
          } else {
            lb.geom.labelX = round1(
              lb.geom.labelX < nCx ? n.x - lb.halfW - 8 : n.x + n.width + lb.halfW + 8
            );
          }
        }
      }
    }

    if (!moved) break;
  }

  return result;
}

/**
 * Computes a live rubber-band SVG path while interactively creating a connector.
 * Snaps cleanly to hoveredTarget when aiming over another node, or tracks the pointer smoothly.
 */
export function computePreviewEdgePath(
  source: DiagramNode,
  pointerX: number,
  pointerY: number,
  style: EdgeStyle,
  hoveredTarget?: DiagramNode | null
): string {
  if (hoveredTarget && hoveredTarget.id !== source.id) {
    return computeEdgeGeometry(source, hoveredTarget, {
      id: '__preview__',
      from: source.id,
      to: hoveredTarget.id,
      label: '',
      style,
    }).pathD;
  }

  const virtualTarget: DiagramNode = {
    id: '__cursor__',
    x: pointerX,
    y: pointerY,
    width: 1,
    height: 1,
    title: '',
    body: '',
    shape: 'process',
    tone: 'white',
  };

  return computeEdgeGeometry(source, virtualTarget, {
    id: '__preview__',
    from: source.id,
    to: '__cursor__',
    label: '',
    style,
  }).pathD;
}

/**
 * Immutable Undo/Redo History helpers (supports Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z).
 */
export function createHistory<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [] };
}

export function pushHistory<T>(history: HistoryState<T>, next: T, maxDepth = 40): HistoryState<T> {
  const past = [...history.past, history.present];
  if (past.length > maxDepth) {
    past.shift();
  }
  return { past, present: next, future: [] };
}

export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      if ((current + ' ' + words[i]).length <= maxCharsPerLine) {
        current += ' ' + words[i];
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines;
}

/**
 * Serializes an EditableDiagram into a crisp, publication-grade macOS SVG string
 * matching the exact aesthetic of the preloaded clinical algorithms in the library.
 */
export function serializeDiagramToSvg(diagram: EditableDiagram): string {
  const paddingX = 90;
  const headerHeight = 28;
  const footerHeight = 40;
  const fontScale = diagram.fontScale ?? 1;
  const paletteId = diagram.paletteId ?? 'original';
  const colorMode = diagram.colorMode ?? 'color';

  // Compute adaptive metrics for every node so scaled text never clips
  const adaptiveNodes = diagram.nodes.map((n) => {
    const metrics = computeAdaptiveNodeMetrics(n, fontScale);
    return {
      node: {
        ...n,
        width: metrics.width,
        height: metrics.height,
      },
      metrics,
    };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const { node: n } of adaptiveNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 400;
  }

  const contentWidth = Math.max(1080, maxX - minX + paddingX * 2);
  const contentHeight = Math.max(540, maxY - minY + 90);
  const totalWidth = Math.round(contentWidth);
  const totalHeight = Math.round(headerHeight + contentHeight + footerHeight);

  const offsetX = Math.round((totalWidth - (maxX - minX)) / 2 - minX);
  const offsetY = Math.round(headerHeight + 36 - minY);

  const shiftedItems = adaptiveNodes.map(({ node: n, metrics }) => ({
    node: {
      ...n,
      x: Math.round(n.x + offsetX),
      y: Math.round(n.y + offsetY),
    },
    metrics,
  }));
  const shiftedNodes = shiftedItems.map((item) => item.node);
  const edgeGeoms = computeDiagramEdgeGeometries(shiftedNodes, diagram.edges);

  // Collect dynamic arrowhead markers keyed by resolved hex color
  const markerMap = new Map<string, string>();
  const getMarkerId = (hex: string): string => {
    const existing = markerMap.get(hex);
    if (existing) return existing;
    const id = `gen-arrow-${markerMap.size}`;
    markerMap.set(hex, id);
    return id;
  };

  const edgesSvg = diagram.edges
    .map((edge) => {
      const geom = edgeGeoms.get(edge.id);
      if (!geom) return '';
      const strokeColor = resolveEdgeColor(geom.strokeColor, paletteId, colorMode);
      const markerId = getMarkerId(strokeColor);

      const dashAttr = geom.isDashed ? ' stroke-dasharray="6 5"' : '';
      let labelMarkup = '';
      if (edge.label.trim()) {
        const cleanLabel = edge.label.trim();
        const labelFontSize = Number(
          ((edge.labelFontSize ?? DEFAULT_EDGE_LABEL_FONT_SIZE) * fontScale).toFixed(2)
        );
        const labelOpacity =
          typeof edge.labelOpacity === 'number' && Number.isFinite(edge.labelOpacity)
            ? Math.min(1, Math.max(0, edge.labelOpacity))
            : 1;
        const badgeW = Math.max(56, cleanLabel.length * (labelFontSize * 0.66) + 22);
        const badgeH = Math.max(26, Math.round(labelFontSize * 2.1));
        const badgeColors = resolveEdgeBadgeColors(geom.strokeColor, paletteId, colorMode);

        labelMarkup = `
          <g opacity="${labelOpacity}">
            <rect x="${Math.round(geom.labelX - badgeW / 2)}" y="${Math.round(geom.labelY - badgeH / 2)}" width="${Math.round(badgeW)}" height="${badgeH}" rx="6" fill="${badgeColors.fill}" stroke="#FFFFFF" stroke-width="2"/>
            <text x="${geom.labelX}" y="${Math.round(geom.labelY + labelFontSize * 0.36)}" text-anchor="middle" class="t-branch" style="font-size:${labelFontSize}px" fill="${badgeColors.text}">${escapeXml(cleanLabel)}</text>
          </g>
        `;
      }

      return `
        <path d="${geom.pathD}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dashAttr} marker-end="url(#${markerId})"/>
        ${labelMarkup}
      `;
    })
    .join('\n');

  const markersSvg = Array.from(markerMap.entries())
    .map(
      ([hex, id]) => `
    <marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="${hex}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>`
    )
    .join('');

  const nodesSvg = shiftedItems
    .map(({ node, metrics }) => {
      const style = resolveNodeColors(node.tone, paletteId, colorMode);
      const strokeW = node.shape === 'decision' ? 2 : 1.5;
      const shapeSvg = buildNodeShapeSvgMarkup(
        node.shape,
        node.x,
        node.y,
        node.width,
        node.height,
        style.fill,
        style.stroke,
        strokeW
      );

      const innerW = Math.max(96, node.width - 36);
      const maxCharsTitle = Math.max(10, Math.floor(innerW / (metrics.titleFontSize * 0.58)));
      const maxCharsBody = Math.max(12, Math.floor(innerW / (metrics.bodyFontSize * 0.55)));
      const titleLines = wrapTextLines(node.title, maxCharsTitle);
      const bodyLines = node.body.trim() ? wrapTextLines(node.body, maxCharsBody) : [];

      const titleLineH = Math.round(metrics.titleFontSize * 1.34);
      const bodyLineH = Math.round(metrics.bodyFontSize * 1.36);
      const gap = titleLines.length > 0 && bodyLines.length > 0 ? Math.max(4, Math.round(5 * fontScale)) : 0;
      const totalTextHeight = titleLines.length * titleLineH + gap + bodyLines.length * bodyLineH;

      let cursorY = Math.round(node.y + (node.height - totalTextHeight) / 2 + metrics.titleFontSize * 0.96);
      const cx = Math.round(node.x + node.width / 2);

      const titleSvg = titleLines
        .map((line) => {
          const y = cursorY;
          cursorY += titleLineH;
          return `<text x="${cx}" y="${y}" text-anchor="middle" class="t-title" style="font-size:${metrics.titleFontSize}px" opacity="${metrics.titleOpacity}" fill="${style.titleColor}">${escapeXml(line)}</text>`;
        })
        .join('');

      if (bodyLines.length > 0) cursorY += gap;
      const bodySvg = bodyLines
        .map((line) => {
          const y = cursorY;
          cursorY += bodyLineH;
          return `<text x="${cx}" y="${y}" text-anchor="middle" class="t-body" style="font-size:${metrics.bodyFontSize}px" opacity="${metrics.bodyOpacity}" fill="${style.bodyColor}">${escapeXml(line)}</text>`;
        })
        .join('');

      const decisionTag =
        node.shape === 'decision'
          ? `<rect x="${node.x + 12}" y="${node.y - 9}" width="72" height="18" rx="9" fill="#FFFFFF" stroke="${style.stroke}" stroke-width="1"/><text x="${node.x + 48}" y="${node.y + 3}" text-anchor="middle" class="t-micro" fill="${style.titleColor}">DECISIÓN</text>`
          : '';

      return `
        <g>
          ${shapeSvg}
          ${decisionTag}
          ${titleSvg}
          ${bodySvg}
        </g>
      `;
    })
    .join('\n');

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <title>${escapeXml(diagram.title)}</title>
  <defs>${markersSvg}
    <style>
      .t-title { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 15px; font-weight: 700; }
      .t-body { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 13px; font-weight: 500; }
      .t-branch { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 11.5px; font-weight: 700; }
      .t-micro { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; }
    </style>
  </defs>

  <rect width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF"/>

  ${edgesSvg}
  ${nodesSvg}
</svg>
`.trim();
}

export function serializeDiagramToSvgDataUrl(diagram: EditableDiagram): string {
  const svg = serializeDiagramToSvg(diagram);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
