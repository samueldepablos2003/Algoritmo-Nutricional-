import {
  NODE_TONE_STYLES,
  type DiagramEdge,
  type DiagramNode,
  type EdgeStyle,
  type EditableDiagram,
  type NodeShape,
  type NodeTone,
} from '../types/algorithm';
import { normalizeTags } from './algorithmLogic';

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

const VALID_SHAPES = new Set<NodeShape>(['process', 'decision', 'pill']);
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
  const baseWidth = shape === 'decision' ? 340 : shape === 'pill' ? 340 : 320;
  const maxLen = Math.max(cleanTitle.length, Math.min(cleanBody.length, 90));
  const width = Math.min(400, Math.max(260, baseWidth + (maxLen > 55 ? 30 : 0)));

  const bodyLines = cleanBody
    ? cleanBody.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 44)), 0)
    : 0;
  const titleLines = Math.max(1, Math.ceil(cleanTitle.length / 36));
  const height = Math.min(180, Math.max(82, 40 + titleLines * 22 + bodyLines * 19));

  return { width, height };
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
      : shape === 'decision'
        ? 'blue'
        : 'white';

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
    if (edgeDedup.has(dedupKey)) continue;
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

  const diagram: EditableDiagram = {
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : 'Algoritmo Clínico Nutricional',
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle.trim() : '',
    tags: normalizeTags(rawTags.length > 0 ? rawTags : ['Nutrición Clínica']),
    notes: typeof obj.notes === 'string' ? obj.notes.trim() : '',
    nodes,
    edges,
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
  const footerHeight = 64;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of diagram.nodes) {
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

  const shiftedNodes = diagram.nodes.map((n) => ({
    ...n,
    x: Math.round(n.x + offsetX),
    y: Math.round(n.y + offsetY),
  }));
  const nodeMap = new Map(shiftedNodes.map((n) => [n.id, n]));

  const edgesSvg = diagram.edges
    .map((edge) => {
      const src = nodeMap.get(edge.from);
      const tgt = nodeMap.get(edge.to);
      if (!src || !tgt) return '';
      const geom = computeEdgeGeometry(src, tgt, edge);
      const markerId =
        geom.strokeColor === '#15803D'
          ? 'gen-arrow-green'
          : geom.strokeColor === '#B45309'
            ? 'gen-arrow-amber'
            : 'gen-arrow-gray';

      const dashAttr = geom.isDashed ? ' stroke-dasharray="6 5"' : '';
      let labelMarkup = '';
      if (edge.label.trim()) {
        const cleanLabel = edge.label.trim();
        const badgeW = Math.max(56, cleanLabel.length * 7.6 + 22);
        const badgeFill =
          geom.strokeColor === '#15803D'
            ? '#DCFCE7'
            : geom.strokeColor === '#B45309'
              ? '#FEF3C7'
              : '#F5F5F7';
        const badgeText =
          geom.strokeColor === '#15803D'
            ? '#166534'
            : geom.strokeColor === '#B45309'
              ? '#92400E'
              : '#1D1D1F';

        labelMarkup = `
          <rect x="${Math.round(geom.labelX - badgeW / 2)}" y="${Math.round(geom.labelY - 13)}" width="${Math.round(badgeW)}" height="26" rx="6" fill="${badgeFill}" stroke="#FFFFFF" stroke-width="2"/>
          <text x="${geom.labelX}" y="${geom.labelY + 4}" text-anchor="middle" class="t-branch" fill="${badgeText}">${escapeXml(cleanLabel)}</text>
        `;
      }

      return `
        <path d="${geom.pathD}" fill="none" stroke="${geom.strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${dashAttr} marker-end="url(#${markerId})"/>
        ${labelMarkup}
      `;
    })
    .join('\n');

  const nodesSvg = shiftedNodes
    .map((node) => {
      const style = NODE_TONE_STYLES[node.tone] ?? NODE_TONE_STYLES.white;
      const rx = node.shape === 'pill' ? Math.round(node.height / 2) : node.shape === 'decision' ? 18 : 14;
      const strokeW = node.shape === 'decision' ? 2 : 1.5;

      const maxCharsTitle = Math.max(16, Math.floor((node.width - 34) / 8.8));
      const maxCharsBody = Math.max(20, Math.floor((node.width - 34) / 7.2));
      const titleLines = wrapTextLines(node.title, maxCharsTitle);
      const bodyLines = node.body.trim() ? wrapTextLines(node.body, maxCharsBody) : [];

      const totalTextHeight = titleLines.length * 20 + (bodyLines.length > 0 ? 6 + bodyLines.length * 18 : 0);
      let cursorY = Math.round(node.y + (node.height - totalTextHeight) / 2 + 15);
      const cx = Math.round(node.x + node.width / 2);

      const titleSvg = titleLines
        .map((line) => {
          const y = cursorY;
          cursorY += 20;
          return `<text x="${cx}" y="${y}" text-anchor="middle" class="t-title" fill="${style.titleColor}">${escapeXml(line)}</text>`;
        })
        .join('');

      if (bodyLines.length > 0) cursorY += 4;
      const bodySvg = bodyLines
        .map((line) => {
          const y = cursorY;
          cursorY += 18;
          return `<text x="${cx}" y="${y}" text-anchor="middle" class="t-body" fill="${style.bodyColor}">${escapeXml(line)}</text>`;
        })
        .join('');

      const decisionTag =
        node.shape === 'decision'
          ? `<rect x="${node.x + 12}" y="${node.y - 9}" width="72" height="18" rx="9" fill="#FFFFFF" stroke="${style.stroke}" stroke-width="1"/><text x="${node.x + 48}" y="${node.y + 3}" text-anchor="middle" class="t-micro" fill="${style.titleColor}">DECISIÓN</text>`
          : '';

      return `
        <g>
          <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="${rx}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${strokeW}"/>
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
  <defs>
    <marker id="gen-arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#6E6E73" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="gen-arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#15803D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="gen-arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#B45309" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .t-title { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 15px; font-weight: 700; }
      .t-body { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 13px; font-weight: 500; }
      .t-branch { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 11.5px; font-weight: 700; }
      .t-micro { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 9.5px; font-weight: 700; letter-spacing: 0.05em; }
      .t-small { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 12px; font-weight: 500; fill: #8E8E93; }
    </style>
  </defs>

  <rect width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF"/>

  ${edgesSvg}
  ${nodesSvg}

  <line x1="72" y1="${totalHeight - 44}" x2="${totalWidth - 72}" y2="${totalHeight - 44}" stroke="#E5E5EA" stroke-width="1"/>
  <text x="72" y="${totalHeight - 20}" class="t-small">Biblioteca de Algoritmos de Tratamiento Médico Nutricional</text>
  <text x="${totalWidth - 72}" y="${totalHeight - 20}" text-anchor="end" class="t-small">Diagrama vectorial de alta nitidez</text>
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
