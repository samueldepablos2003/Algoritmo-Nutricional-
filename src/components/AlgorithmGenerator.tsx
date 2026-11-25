import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GitBranch,
  Hand,
  LayoutGrid,
  ListChecks,
  LocateFixed,
  MessageSquare,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Route,
  Save,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  NODE_TONE_STYLES,
  type AlgorithmItem,
  type DiagramClinicalContext,
  type DiagramColorMode,
  type DiagramEdge,
  type DiagramNode,
  type DiagramPaletteId,
  type EdgeStyle,
  type EditableDiagram,
  type NodeShape,
  type NodeTone,
} from '../types/algorithm';
import { clampZoom, stepZoom } from '../utils/algorithmLogic';
import {
  computeDiagramEdgeGeometries,
  computeEdgeGeometry,
  computePreviewEdgePath,
  computeSnapAndGuides,
  createHistory,
  createStarterDiagram,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
  pushHistory,
  redoHistory,
  serializeDiagramToSvgDataUrl,
  smartAutoLayoutDiagram,
  undoHistory,
  type AlignmentGuide,
  type HistoryState,
} from '../utils/diagramEngine';
import {
  ALL_NODE_SHAPE_LABELS,
  computeAdaptiveNodeMetrics,
  DEFAULT_BODY_FONT_SIZE,
  DEFAULT_EDGE_LABEL_FONT_SIZE,
  DEFAULT_TITLE_FONT_SIZE,
  getShapeInnerPadding,
  isCustomSvgShape,
  resolveEdgeBadgeColors,
  resolveEdgeColor,
  resolveNodeColors,
} from '../utils/diagramTheme';
import {
  createInitialWalkthrough,
  getAvailableOutgoingEdges,
  getCurrentNodeId,
  getSelectableEdgeIds,
  isWalkthroughComplete,
  rewindWalkthroughToNode,
  selectWalkthroughEdge,
  stepBackWalkthrough,
  type WalkthroughState,
} from '../utils/walkthroughEngine';
import { AlgorithmContextPopover } from './AlgorithmContextPopover';
import { EditorFormatPanel } from './EditorFormatPanel';
import { EditorShapesPopover } from './EditorShapesPopover';
import { GeneratorAiDrawer } from './GeneratorAiDrawer';
import { NodeCommentPopover } from './NodeCommentPopover';
import { NodeShapeBackdrop } from './NodeShapeBackdrop';
import { OriginalImagePip } from './OriginalImagePip';
import { SelectedTextPanel, type SelectedTextKind } from './SelectedTextPanel';
import { WalkthroughPanel } from './WalkthroughPanel';
import { ZoomPercentInput } from './ZoomPercentInput';

interface AlgorithmGeneratorProps {
  initialAlgorithm: AlgorithmItem | null;
  openAiDrawerInitially?: boolean;
  initialMode?: 'edit' | 'walkthrough';
  /** When true, renders inside the unified full-screen algorithm viewer without its own top header */
  embedded?: boolean;
  /** Optional externally-edited title from the unified viewer header */
  externalTitle?: string;
  /** Optional ref populated with an imperative save trigger for the host header */
  saveHandlerRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  /** Optional callback notified when saving state changes */
  onSavingChange?: (saving: boolean) => void;
  onBack: () => void;
  onSaveToLibrary: (payload: {
    id?: string;
    title: string;
    subtitle?: string;
    tags: string[];
    imageDataUrl: string;
    sourceImageDataUrl?: string;
    reference?: string;
    notes: string;
    diagram: EditableDiagram;
  }) => Promise<void>;
}

type StudioMode = 'edit' | 'walkthrough';
type EditorTool = 'select' | 'pan' | 'connect';

const EDGE_STYLE_LABELS: Record<EdgeStyle, string> = {
  solid: 'Flecha sólida',
  straight: 'Línea recta',
  dashed: 'Línea punteada',
};

const SHAPE_LABELS: Record<NodeShape, string> = ALL_NODE_SHAPE_LABELS;

type SelectedTextTarget =
  | { kind: 'node-title' | 'node-body'; nodeId: string }
  | { kind: 'edge-label'; edgeId: string };

export const AlgorithmGenerator: React.FC<AlgorithmGeneratorProps> = ({
  initialAlgorithm,
  openAiDrawerInitially = false,
  initialMode = 'edit',
  embedded = false,
  externalTitle,
  saveHandlerRef,
  onSavingChange,
  onBack,
  onSaveToLibrary,
}) => {
  const initialDiagram = useMemo(() => {
    if (!initialAlgorithm?.diagram) return createStarterDiagram();
    const fallbackSource =
      initialAlgorithm.diagram.sourceImageDataUrl ?? initialAlgorithm.sourceImageDataUrl;
    return fallbackSource
      ? { ...initialAlgorithm.diagram, sourceImageDataUrl: fallbackSource }
      : initialAlgorithm.diagram;
  }, [initialAlgorithm]);

  const [history, setHistory] = useState<HistoryState<EditableDiagram>>(() =>
    createHistory(initialDiagram)
  );
  const diagram = history.present;

  const [studioMode, setStudioMode] = useState<StudioMode>(initialMode);
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState>(() =>
    createInitialWalkthrough(initialDiagram)
  );
  const [walkthroughPanelOpen, setWalkthroughPanelOpen] = useState(initialMode === 'walkthrough');

  const [tool, setTool] = useState<EditorTool>('select');
  const [connectStyle, setConnectStyle] = useState<EdgeStyle>('solid');
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [connectHoverTargetId, setConnectHoverTargetId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [showAddNodeMenu, setShowAddNodeMenu] = useState(false);
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [contextPopoverOpen, setContextPopoverOpen] = useState(false);
  const [selectedTextTarget, setSelectedTextTarget] = useState<SelectedTextTarget | null>(null);
  const [commentingNodeId, setCommentingNodeId] = useState<string | null>(null);
  const [commentAnchor, setCommentAnchor] = useState<{ left: number; top: number } | null>(null);
  const [commentHintVisible, setCommentHintVisible] = useState(false);
  const commentHintTimerRef = useRef<number | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(
    initialMode === 'walkthrough' ? false : openAiDrawerInitially
  );
  const [isSaving, setIsSaving] = useState(false);

  // Viewport zoom & pan (always starts at 100% per algorithm)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // High-frequency refs for 60/120fps zero-re-render drag, resize, pan & connector preview
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const worldLayerRef = useRef<HTMLDivElement | null>(null);
  const nodeElsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const edgePathElsRef = useRef<
    Map<string, { visible: SVGPathElement | null; hit: SVGPathElement | null; glow: SVGPathElement | null }>
  >(new Map());
  const edgeLabelElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const guideXLineRef = useRef<SVGLineElement | null>(null);
  const guideYLineRef = useRef<SVGLineElement | null>(null);
  const connectPreviewPathRef = useRef<SVGPathElement | null>(null);

  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const connectSourceIdRef = useRef(connectSourceId);
  connectSourceIdRef.current = connectSourceId;
  const connectStyleRef = useRef(connectStyle);
  connectStyleRef.current = connectStyle;
  const connectHoverTargetIdRef = useRef(connectHoverTargetId);
  connectHoverTargetIdRef.current = connectHoverTargetId;

  const rafIdRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ clientX: number; clientY: number; altKey: boolean } | null>(
    null
  );

  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const dragSessionRef = useRef<
    | {
        mode: 'move' | 'resize';
        nodeId: string;
        startClientX: number;
        startClientY: number;
        initialNode: DiagramNode;
        currentRect: { x: number; y: number; width: number; height: number };
        connectedEdges: DiagramEdge[];
        otherNodes: DiagramNode[];
        nodeLookup: Map<string, DiagramNode>;
        hasMoved: boolean;
        clickedTextKind?: 'node-title' | 'node-body';
      }
    | {
        mode: 'connect-drag';
        sourceId: string;
        startClientX: number;
        startClientY: number;
        hasDragged: boolean;
        fromQuickHandle: boolean;
      }
    | null
  >(null);

  const commitDiagram = useCallback((next: EditableDiagram) => {
    setHistory((prev) => pushHistory(prev, next));
  }, []);

  const fitCanvasToView = useCallback((targetDiagram: EditableDiagram) => {
    const vp = canvasViewportRef.current;
    if (!vp || targetDiagram.nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of targetDiagram.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const vpW = vp.clientWidth;
    const vpH = vp.clientHeight;
    if (vpW === 0 || vpH === 0) return;

    // Always default zoom to 100% per algorithm
    const nextZoom = 1;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const rightDockReserve = 76;
    const nextPan = {
      x: Math.round((vpW - rightDockReserve) / 2 - contentCenterX * nextZoom),
      y:
        contentH + 64 <= vpH
          ? Math.round(vpH / 2 - contentCenterY * nextZoom)
          : Math.round(32 - minY * nextZoom),
    };
    void contentW;

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const applyZoomCentered = useCallback((rawZoom: number) => {
    const nextZoom = clampZoom(rawZoom);
    const vp = canvasViewportRef.current;
    if (!vp) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      return;
    }

    const prevZoom = zoomRef.current;
    const centerX = vp.clientWidth / 2;
    const centerY = vp.clientHeight / 2;
    const worldX = (centerX - panRef.current.x) / prevZoom;
    const worldY = (centerY - panRef.current.y) / prevZoom;
    const nextPan = {
      x: Math.round(centerX - worldX * nextZoom),
      y: Math.round(centerY - worldY * nextZoom),
    };

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    if (worldLayerRef.current) {
      worldLayerRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
    }
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  useEffect(() => {
    fitCanvasToView(initialDiagram);
  }, [initialDiagram, fitCanvasToView]);

  const globalFontScale = diagram.fontScale ?? 1;
  const globalPaletteId: DiagramPaletteId = diagram.paletteId ?? 'original';
  const globalColorMode: DiagramColorMode = diagram.colorMode ?? 'color';

  const adaptiveMetricsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeAdaptiveNodeMetrics>>();
    for (const n of diagram.nodes) {
      map.set(n.id, computeAdaptiveNodeMetrics(n, globalFontScale));
    }
    return map;
  }, [diagram.nodes, globalFontScale]);

  const renderedNodes = useMemo(
    () =>
      diagram.nodes.map((n) => {
        const metrics = adaptiveMetricsMap.get(n.id);
        if (!metrics) return n;
        if (metrics.width === n.width && metrics.height === n.height) return n;
        return { ...n, width: metrics.width, height: metrics.height };
      }),
    [diagram.nodes, adaptiveMetricsMap]
  );

  const nodeMap = useMemo(
    () => new Map(renderedNodes.map((n) => [n.id, n])),
    [renderedNodes]
  );

  // Memoize graph-aware edge geometries once per diagram change (staggered rails, obstacle detours & label separation)
  const edgeGeometries = useMemo(
    () => computeDiagramEdgeGeometries(renderedNodes, diagram.edges),
    [renderedNodes, diagram.edges]
  );

  // Generous explicit world-space viewBox so all arrows stay strictly inside the SVG viewport
  // (prevents Chromium/WebKit compositor dirty-rect clipping/freezing bugs seen with 1x1 overflow-visible SVGs)
  const svgBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = 1600;
    let maxY = 1000;
    for (const n of renderedNodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    const PAD = 3200;
    const x = Math.floor(minX - PAD);
    const y = Math.floor(minY - PAD);
    const width = Math.ceil(maxX - minX + PAD * 2);
    const height = Math.ceil(maxY - minY + PAD * 2);
    return { x, y, width, height };
  }, [renderedNodes]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId
    ? diagram.edges.find((e) => e.id === selectedEdgeId) ?? null
    : null;

  // Derived Guided Walkthrough state
  const isWalkthrough = studioMode === 'walkthrough';
  const currentWalkthroughNodeId = getCurrentNodeId(walkthroughState);
  const currentWalkthroughNode = currentWalkthroughNodeId
    ? nodeMap.get(currentWalkthroughNodeId) ?? null
    : null;
  const walkthroughAvailableEdges = useMemo(
    () => (isWalkthrough ? getAvailableOutgoingEdges(diagram, walkthroughState) : []),
    [isWalkthrough, diagram, walkthroughState]
  );
  const walkthroughCurrentOutgoingEdgeIds = useMemo(
    () => new Set(walkthroughAvailableEdges.map((e) => e.id)),
    [walkthroughAvailableEdges]
  );
  const walkthroughSelectableEdgeIds = useMemo(
    () => (isWalkthrough ? getSelectableEdgeIds(diagram, walkthroughState) : new Set<string>()),
    [isWalkthrough, diagram, walkthroughState]
  );
  const walkthroughVisitedEdgeIds = useMemo(
    () =>
      new Set(
        walkthroughState.steps
          .map((s) => s.viaEdgeId)
          .filter((id): id is string => Boolean(id))
      ),
    [walkthroughState]
  );
  const walkthroughStepIndexByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    walkthroughState.steps.forEach((step, idx) => {
      map.set(step.nodeId, idx);
    });
    return map;
  }, [walkthroughState]);
  const walkthroughComplete = useMemo(
    () => (isWalkthrough ? isWalkthroughComplete(diagram, walkthroughState) : false),
    [isWalkthrough, diagram, walkthroughState]
  );

  const handleSwitchStudioMode = useCallback(
    (nextMode: StudioMode) => {
      if (nextMode === studioMode) return;
      setStudioMode(nextMode);
      if (nextMode === 'walkthrough') {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setEditingNodeId(null);
        setConnectSourceId(null);
        setShowAddNodeMenu(false);
        setAiDrawerOpen(false);
        setWalkthroughState(createInitialWalkthrough(diagram));
        setWalkthroughPanelOpen(true);
        window.setTimeout(() => fitCanvasToView(diagram), 40);
      } else {
        setWalkthroughPanelOpen(false);
        setAiDrawerOpen(true);
        window.setTimeout(() => fitCanvasToView(diagram), 320);
      }
    },
    [studioMode, diagram, fitCanvasToView]
  );

  const handleSelectWalkthroughEdge = useCallback(
    (edgeId: string) => {
      setWalkthroughState((prev) => selectWalkthroughEdge(diagram, prev, edgeId));
    },
    [diagram]
  );

  const handleRewindWalkthroughToNode = useCallback((nodeId: string) => {
    setWalkthroughState((prev) => rewindWalkthroughToNode(prev, nodeId));
  }, []);

  const handleStepBackWalkthrough = useCallback(() => {
    setWalkthroughState((prev) => stepBackWalkthrough(prev));
  }, []);

  const handleResetWalkthrough = useCallback(() => {
    setWalkthroughState(createInitialWalkthrough(diagram));
  }, [diagram]);

  const handleDeleteSelection = useCallback(() => {
    if (selectedNodeId) {
      commitDiagram({
        ...diagram,
        nodes: diagram.nodes.filter((n) => n.id !== selectedNodeId),
        edges: diagram.edges.filter(
          (e) => e.from !== selectedNodeId && e.to !== selectedNodeId
        ),
      });
      setSelectedNodeId(null);
      setEditingNodeId(null);
    } else if (selectedEdgeId) {
      commitDiagram({
        ...diagram,
        edges: diagram.edges.filter((e) => e.id !== selectedEdgeId),
      });
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, diagram, commitDiagram]);

  // Keyboard shortcuts: Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z redo, Delete/Backspace, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (commentingNodeId) {
          setCommentingNodeId(null);
          setCommentAnchor(null);
        } else if (contextPopoverOpen) {
          setContextPopoverOpen(false);
        } else if (selectedTextTarget) {
          setSelectedTextTarget(null);
        } else if (formatPanelOpen) {
          setFormatPanelOpen(false);
        } else if (editingNodeId) {
          setEditingNodeId(null);
        } else if (connectSourceId) {
          setConnectSourceId(null);
        } else if (showAddNodeMenu) {
          setShowAddNodeMenu(false);
        } else if (selectedNodeId || selectedEdgeId) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
        }
        return;
      }

      if (isTyping) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          setHistory((h) => redoHistory(h));
        } else {
          setHistory((h) => undoHistory(h));
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setHistory((h) => redoHistory(h));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId || selectedEdgeId) {
          e.preventDefault();
          handleDeleteSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commentingNodeId,
    contextPopoverOpen,
    selectedTextTarget,
    formatPanelOpen,
    editingNodeId,
    connectSourceId,
    showAddNodeMenu,
    selectedNodeId,
    selectedEdgeId,
    handleDeleteSelection,
  ]);

  const handleAddNode = (shape: NodeShape) => {
    const vp = canvasViewportRef.current;
    const widthForShape =
      shape === 'diamond'
        ? 290
        : shape === 'oval'
          ? 270
          : shape === 'block-arrow' || shape === 'thin-arrow' || shape === 'double-arrow'
            ? 300
            : DEFAULT_NODE_WIDTH;
    const heightForShape =
      shape === 'diamond'
        ? 136
        : shape === 'pill'
          ? 84
          : shape === 'oval'
            ? 96
            : shape === 'block-arrow' || shape === 'thin-arrow' || shape === 'double-arrow'
              ? 100
              : DEFAULT_NODE_HEIGHT;

    const centerWorldX = vp
      ? Math.round((vp.clientWidth / 2 - pan.x) / zoom - widthForShape / 2)
      : 640;
    const centerWorldY = vp
      ? Math.round((vp.clientHeight / 2 - pan.y) / zoom - heightForShape / 2)
      : 320;

    // Slight stagger if another node sits directly at that spot
    const offset = (diagram.nodes.length % 4) * 22;
    const defaultTitleByShape: Record<NodeShape, string> = {
      oval: 'Inicio / Resultado',
      process: 'Nueva conducta nutricional',
      diamond: '¿Criterio clínico?',
      pill: 'Inicio / Meta clínica',
      parallelogram: 'Entrada / Valoración',
      hexagon: 'Preparación / Protocolo',
      'block-arrow': 'Dirección terapéutica',
      'thin-arrow': 'Transición clínica',
      'double-arrow': 'Relación bidireccional',
      decision: '¿Criterio clínico?',
    };
    const defaultBodyByShape: Record<NodeShape, string> = {
      oval: 'Haz clic en el texto para editar',
      process: 'Haz clic en el texto para editar el detalle clínico',
      diamond: 'Define el punto de decisión (Sí / No)',
      pill: 'Objetivo o fase del algoritmo',
      parallelogram: 'Datos o parámetros clínicos',
      hexagon: 'Parámetros previos o requisitos',
      'block-arrow': 'Siguiente intervención',
      'thin-arrow': 'Paso intermedio',
      'double-arrow': 'Ajuste continuo',
      decision: 'Define el punto de decisión (Sí / No)',
    };
    const defaultToneByShape: Record<NodeShape, NodeTone> = {
      oval: 'mint',
      process: 'white',
      diamond: 'blue',
      pill: 'gray',
      parallelogram: 'blue',
      hexagon: 'amber',
      'block-arrow': 'gray',
      'thin-arrow': 'white',
      'double-arrow': 'gray',
      decision: 'blue',
    };

    const newNode: DiagramNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: centerWorldX + offset,
      y: centerWorldY + offset,
      width: widthForShape,
      height: heightForShape,
      title: defaultTitleByShape[shape] ?? 'Nueva conducta nutricional',
      body: defaultBodyByShape[shape] ?? 'Haz clic en el texto para editar',
      shape,
      tone: defaultToneByShape[shape] ?? 'white',
    };

    commitDiagram({
      ...diagram,
      nodes: [...diagram.nodes, newNode],
    });
    setSelectedNodeId(newNode.id);
    setSelectedEdgeId(null);
    setTool('select');
    setShowAddNodeMenu(false);
  };

  const handleAutoLayout = () => {
    const aligned = smartAutoLayoutDiagram(diagram);
    commitDiagram(aligned);
    fitCanvasToView(aligned);
  };

  const handleUpdateSelectedNode = (patch: Partial<DiagramNode>) => {
    if (!selectedNodeId) return;
    commitDiagram({
      ...diagram,
      nodes: diagram.nodes.map((n) => (n.id === selectedNodeId ? { ...n, ...patch } : n)),
    });
  };

  const handleUpdateSelectedEdge = (patch: Partial<DiagramEdge>) => {
    if (!selectedEdgeId) return;
    commitDiagram({
      ...diagram,
      edges: diagram.edges.map((e) => (e.id === selectedEdgeId ? { ...e, ...patch } : e)),
    });
  };

  const handleUpdateGlobalFormat = (
    patch: Partial<Pick<EditableDiagram, 'colorMode' | 'paletteId' | 'fontScale'>>
  ) => {
    commitDiagram({
      ...diagram,
      ...patch,
    });
  };

  const handleResetGlobalFormat = () => {
    commitDiagram({
      ...diagram,
      colorMode: 'color',
      paletteId: 'original',
      fontScale: 1,
    });
  };

  const openCommentPopoverForNode = (nodeId: string) => {
    const vp = canvasViewportRef.current;
    const nodeEl = nodeElsRef.current.get(nodeId);
    if (vp && nodeEl) {
      const vpRect = vp.getBoundingClientRect();
      const boxRect = nodeEl.getBoundingClientRect();
      const popoverW = 336;
      const popoverH = 196;
      const rawLeft = boxRect.right - vpRect.left + 12;
      const clampedLeft =
        rawLeft + popoverW <= vpRect.width - 76
          ? rawLeft
          : Math.max(16, boxRect.left - vpRect.left - popoverW - 12);
      const rawTop = boxRect.top - vpRect.top;
      const clampedTop = Math.min(
        Math.max(16, rawTop),
        Math.max(16, vpRect.height - popoverH - 76)
      );
      setCommentAnchor({ left: Math.round(clampedLeft), top: Math.round(clampedTop) });
    } else {
      setCommentAnchor({ left: 24, top: 24 });
    }
    setCommentingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setShowAddNodeMenu(false);
    setCommentHintVisible(false);
  };

  const handleToolbarCommentClick = () => {
    if (!selectedNodeId) {
      setCommentHintVisible(true);
      if (commentHintTimerRef.current !== null) {
        window.clearTimeout(commentHintTimerRef.current);
      }
      commentHintTimerRef.current = window.setTimeout(() => {
        setCommentHintVisible(false);
      }, 2600);
      return;
    }
    if (commentingNodeId === selectedNodeId) {
      setCommentingNodeId(null);
      setCommentAnchor(null);
      return;
    }
    openCommentPopoverForNode(selectedNodeId);
  };

  const handleSaveNodeComment = (nodeId: string, comment: string) => {
    commitDiagram({
      ...diagram,
      nodes: diagram.nodes.map((n) =>
        n.id === nodeId ? { ...n, comment: comment || undefined } : n
      ),
    });
    setCommentingNodeId(null);
    setCommentAnchor(null);
  };

  const handleSaveClinicalContext = (nextContext: DiagramClinicalContext | undefined) => {
    commitDiagram({
      ...diagram,
      clinicalContext: nextContext,
      ...(nextContext?.protocolSource ? { reference: nextContext.protocolSource } : {}),
    });
  };

  // Live update helper for the floating "Texto seleccionado" panel
  const updateSelectedTextTarget = (
    updater: (current: EditableDiagram) => EditableDiagram
  ) => {
    setHistory((prev) => ({
      ...prev,
      present: updater(prev.present),
    }));
  };

  const activeTextInfo = useMemo(() => {
    if (!selectedTextTarget) return null;
    if (selectedTextTarget.kind === 'edge-label') {
      const edge = diagram.edges.find((e) => e.id === selectedTextTarget.edgeId);
      if (!edge) return null;
      return {
        kind: 'edge-label' as SelectedTextKind,
        text: edge.label,
        fontSize: edge.labelFontSize ?? DEFAULT_EDGE_LABEL_FONT_SIZE,
        opacity: edge.labelOpacity ?? 1,
      };
    }
    const node = diagram.nodes.find((n) => n.id === selectedTextTarget.nodeId);
    if (!node) return null;
    if (selectedTextTarget.kind === 'node-title') {
      return {
        kind: 'node-title' as SelectedTextKind,
        text: node.title,
        fontSize: node.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE,
        opacity: node.titleOpacity ?? 1,
      };
    }
    return {
      kind: 'node-body' as SelectedTextKind,
      text: node.body,
      fontSize: node.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE,
      opacity: node.bodyOpacity ?? 1,
    };
  }, [selectedTextTarget, diagram.nodes, diagram.edges]);

  const handleDuplicateSelectedTextElement = () => {
    if (!selectedTextTarget) return;
    if (selectedTextTarget.kind === 'edge-label') {
      const edge = diagram.edges.find((e) => e.id === selectedTextTarget.edgeId);
      if (!edge) return;
      commitDiagram({
        ...diagram,
        edges: diagram.edges.map((e) =>
          e.id === edge.id ? { ...e, label: `${e.label} (copia)` } : e
        ),
      });
      return;
    }
    const sourceNode = diagram.nodes.find((n) => n.id === selectedTextTarget.nodeId);
    if (!sourceNode) return;
    const duplicate: DiagramNode = {
      ...sourceNode,
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      x: sourceNode.x + 28,
      y: sourceNode.y + 28,
    };
    commitDiagram({
      ...diagram,
      nodes: [...diagram.nodes, duplicate],
    });
    setSelectedNodeId(duplicate.id);
    setSelectedTextTarget({ kind: selectedTextTarget.kind, nodeId: duplicate.id });
  };

  const handleDeleteSelectedTextElement = () => {
    if (!selectedTextTarget) return;
    if (selectedTextTarget.kind === 'edge-label') {
      commitDiagram({
        ...diagram,
        edges: diagram.edges.map((e) =>
          e.id === selectedTextTarget.edgeId ? { ...e, label: '' } : e
        ),
      });
      setSelectedTextTarget(null);
      return;
    }
    if (selectedTextTarget.kind === 'node-body') {
      commitDiagram({
        ...diagram,
        nodes: diagram.nodes.map((n) =>
          n.id === selectedTextTarget.nodeId ? { ...n, body: '' } : n
        ),
      });
      setSelectedTextTarget(null);
      return;
    }
    commitDiagram({
      ...diagram,
      nodes: diagram.nodes.filter((n) => n.id !== selectedTextTarget.nodeId),
      edges: diagram.edges.filter(
        (e) =>
          e.from !== selectedTextTarget.nodeId && e.to !== selectedTextTarget.nodeId
      ),
    });
    setSelectedNodeId(null);
    setSelectedTextTarget(null);
  };

  const handleResetSelectedTextElement = () => {
    if (!selectedTextTarget) return;
    if (selectedTextTarget.kind === 'edge-label') {
      commitDiagram({
        ...diagram,
        edges: diagram.edges.map((e) =>
          e.id === selectedTextTarget.edgeId
            ? { ...e, labelFontSize: undefined, labelOpacity: undefined }
            : e
        ),
      });
      return;
    }
    commitDiagram({
      ...diagram,
      nodes: diagram.nodes.map((n) => {
        if (n.id !== selectedTextTarget.nodeId) return n;
        if (selectedTextTarget.kind === 'node-title') {
          return { ...n, titleFontSize: undefined, titleOpacity: undefined };
        }
        return { ...n, bodyFontSize: undefined, bodyOpacity: undefined };
      }),
    });
  };

  // Direct DOM helpers for 60/120fps zero-lag canvas updates
  const hideAlignmentGuides = useCallback(() => {
    if (guideXLineRef.current) guideXLineRef.current.style.display = 'none';
    if (guideYLineRef.current) guideYLineRef.current.style.display = 'none';
  }, []);

  const updateAlignmentGuidesDom = useCallback((nextGuides: AlignmentGuide[]) => {
    const gx = nextGuides.find((g) => g.axis === 'x') ?? null;
    const gy = nextGuides.find((g) => g.axis === 'y') ?? null;

    if (guideXLineRef.current) {
      if (gx) {
        guideXLineRef.current.setAttribute('x1', String(gx.position));
        guideXLineRef.current.setAttribute('y1', String(gx.start));
        guideXLineRef.current.setAttribute('x2', String(gx.position));
        guideXLineRef.current.setAttribute('y2', String(gx.end));
        guideXLineRef.current.style.display = '';
      } else {
        guideXLineRef.current.style.display = 'none';
      }
    }

    if (guideYLineRef.current) {
      if (gy) {
        guideYLineRef.current.setAttribute('x1', String(gy.start));
        guideYLineRef.current.setAttribute('y1', String(gy.position));
        guideYLineRef.current.setAttribute('x2', String(gy.end));
        guideYLineRef.current.setAttribute('y2', String(gy.position));
        guideYLineRef.current.style.display = '';
      } else {
        guideYLineRef.current.style.display = 'none';
      }
    }
  }, []);

  const hideConnectPreviewDom = useCallback(() => {
    if (connectPreviewPathRef.current) {
      connectPreviewPathRef.current.style.display = 'none';
      connectPreviewPathRef.current.setAttribute('d', '');
    }
    if (connectHoverTargetIdRef.current !== null) {
      connectHoverTargetIdRef.current = null;
      setConnectHoverTargetId(null);
    }
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const vp = canvasViewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const rect = vp.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current,
    };
  }, []);

  const findNodeAtWorldPoint = useCallback((worldX: number, worldY: number, excludeId: string) => {
    const nodes = diagramRef.current.nodes;
    const HIT_PAD = 8;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.id === excludeId) continue;
      if (
        worldX >= n.x - HIT_PAD &&
        worldX <= n.x + n.width + HIT_PAD &&
        worldY >= n.y - HIT_PAD &&
        worldY <= n.y + n.height + HIT_PAD
      ) {
        return n;
      }
    }
    return null;
  }, []);

  const applyLiveNodeRectToDom = useCallback(
    (
      session: Extract<NonNullable<typeof dragSessionRef.current>, { mode: 'move' | 'resize' }>,
      rect: { x: number; y: number; width: number; height: number }
    ) => {
      const nodeEl = nodeElsRef.current.get(session.nodeId);
      if (nodeEl) {
        nodeEl.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
        if (session.mode === 'resize') {
          nodeEl.style.width = `${rect.width}px`;
          nodeEl.style.height = `${rect.height}px`;
          if (session.initialNode.shape === 'pill') {
            nodeEl.style.borderRadius = `${Math.round(rect.height / 2)}px`;
          }
        }
      }

      const liveNode: DiagramNode = {
        ...session.initialNode,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };

      for (const edge of session.connectedEdges) {
        const src = edge.from === session.nodeId ? liveNode : session.nodeLookup.get(edge.from);
        const tgt = edge.to === session.nodeId ? liveNode : session.nodeLookup.get(edge.to);
        if (!src || !tgt) continue;
        const geom = computeEdgeGeometry(src, tgt, edge);

        const edgeRefs = edgePathElsRef.current.get(edge.id);
        if (edgeRefs) {
          edgeRefs.visible?.setAttribute('d', geom.pathD);
          edgeRefs.hit?.setAttribute('d', geom.pathD);
          edgeRefs.glow?.setAttribute('d', geom.pathD);
        }

        const labelEl = edgeLabelElsRef.current.get(edge.id);
        if (labelEl) {
          labelEl.style.transform = `translate3d(${geom.labelX}px, ${geom.labelY}px, 0) translate(-50%, -50%)`;
        }
      }
    },
    []
  );

  const createConnectorBetween = useCallback(
    (sourceId: string, targetId: string, keepConnectTool: boolean) => {
      if (sourceId === targetId) return;
      const currentDiagram = diagramRef.current;
      const alreadyExists = currentDiagram.edges.some(
        (edge) => edge.from === sourceId && edge.to === targetId
      );
      if (!alreadyExists) {
        const style = connectStyleRef.current;
        const newEdge: DiagramEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          from: sourceId,
          to: targetId,
          label: style === 'dashed' ? 'Alternativa' : '',
          style,
        };
        commitDiagram({
          ...currentDiagram,
          edges: [...currentDiagram.edges, newEdge],
        });
        setSelectedEdgeId(newEdge.id);
        setSelectedNodeId(null);
      }
      if (!keepConnectTool) {
        setTool('select');
      }
      setConnectSourceId(null);
      hideConnectPreviewDom();
    },
    [commitDiagram, hideConnectPreviewDom]
  );

  const flushPointerFrame = useCallback(() => {
    rafIdRef.current = null;
    const pointer = latestPointerRef.current;
    if (!pointer) return;

    // 1. Live Pan (zero React re-renders)
    const panSession = panStartRef.current;
    if (panSession) {
      const nextX = panSession.originX + (pointer.clientX - panSession.x);
      const nextY = panSession.originY + (pointer.clientY - panSession.y);
      panSession.currentX = nextX;
      panSession.currentY = nextY;
      panRef.current = { x: nextX, y: nextY };
      if (worldLayerRef.current) {
        worldLayerRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(${zoomRef.current})`;
      }
      if (canvasViewportRef.current) {
        canvasViewportRef.current.style.backgroundPosition = `${nextX}px ${nextY}px`;
      }
      return;
    }

    // 2. Active Node Drag / Resize / Connect-Drag (zero React re-renders)
    const session = dragSessionRef.current;
    if (session) {
      if (session.mode === 'connect-drag') {
        const distSq =
          (pointer.clientX - session.startClientX) ** 2 +
          (pointer.clientY - session.startClientY) ** 2;
        if (distSq > 25) {
          session.hasDragged = true;
        }
        const srcNode = diagramRef.current.nodes.find((n) => n.id === session.sourceId);
        if (srcNode && connectPreviewPathRef.current) {
          const worldPt = screenToWorld(pointer.clientX, pointer.clientY);
          const hovered = findNodeAtWorldPoint(worldPt.x, worldPt.y, session.sourceId);
          const nextHoverId = hovered ? hovered.id : null;
          if (nextHoverId !== connectHoverTargetIdRef.current) {
            connectHoverTargetIdRef.current = nextHoverId;
            setConnectHoverTargetId(nextHoverId);
          }
          const pathD = computePreviewEdgePath(
            srcNode,
            worldPt.x,
            worldPt.y,
            connectStyleRef.current,
            hovered
          );
          connectPreviewPathRef.current.setAttribute('d', pathD);
          connectPreviewPathRef.current.setAttribute(
            'stroke-dasharray',
            connectStyleRef.current === 'dashed' ? '6 5' : ''
          );
          connectPreviewPathRef.current.style.display = '';
        }
        return;
      }

      const dxWorld = (pointer.clientX - session.startClientX) / zoomRef.current;
      const dyWorld = (pointer.clientY - session.startClientY) / zoomRef.current;
      if (Math.abs(dxWorld) > 1.5 || Math.abs(dyWorld) > 1.5) {
        session.hasMoved = true;
      }

      if (session.mode === 'move') {
        const proposedX = Math.round(session.initialNode.x + dxWorld);
        const proposedY = Math.round(session.initialNode.y + dyWorld);
        if (pointer.altKey) {
          session.currentRect = {
            x: proposedX,
            y: proposedY,
            width: session.initialNode.width,
            height: session.initialNode.height,
          };
          hideAlignmentGuides();
        } else {
          const snap = computeSnapAndGuides(
            {
              id: session.nodeId,
              width: session.initialNode.width,
              height: session.initialNode.height,
            },
            proposedX,
            proposedY,
            session.otherNodes
          );
          session.currentRect = {
            x: snap.x,
            y: snap.y,
            width: session.initialNode.width,
            height: session.initialNode.height,
          };
          updateAlignmentGuidesDom(snap.guides);
        }
        applyLiveNodeRectToDom(session, session.currentRect);
      } else {
        const nextWidth = Math.max(
          MIN_NODE_WIDTH,
          Math.round(session.initialNode.width + dxWorld)
        );
        const nextHeight = Math.max(
          MIN_NODE_HEIGHT,
          Math.round(session.initialNode.height + dyWorld)
        );
        session.currentRect = {
          x: session.initialNode.x,
          y: session.initialNode.y,
          width: nextWidth,
          height: nextHeight,
        };
        hideAlignmentGuides();
        applyLiveNodeRectToDom(session, session.currentRect);
      }
      return;
    }

    // 3. Click-to-click Connect Mode Live Rubber-Band Preview
    const activeSrcId = connectSourceIdRef.current;
    if (activeSrcId && connectPreviewPathRef.current) {
      const srcNode = diagramRef.current.nodes.find((n) => n.id === activeSrcId);
      if (srcNode) {
        const worldPt = screenToWorld(pointer.clientX, pointer.clientY);
        const hovered = findNodeAtWorldPoint(worldPt.x, worldPt.y, activeSrcId);
        const nextHoverId = hovered ? hovered.id : null;
        if (nextHoverId !== connectHoverTargetIdRef.current) {
          connectHoverTargetIdRef.current = nextHoverId;
          setConnectHoverTargetId(nextHoverId);
        }
        const pathD = computePreviewEdgePath(
          srcNode,
          worldPt.x,
          worldPt.y,
          connectStyleRef.current,
          hovered
        );
        connectPreviewPathRef.current.setAttribute('d', pathD);
        connectPreviewPathRef.current.setAttribute(
          'stroke-dasharray',
          connectStyleRef.current === 'dashed' ? '6 5' : ''
        );
        connectPreviewPathRef.current.style.display = '';
      }
    }
  }, [
    applyLiveNodeRectToDom,
    findNodeAtWorldPoint,
    hideAlignmentGuides,
    screenToWorld,
    updateAlignmentGuidesDom,
  ]);

  const schedulePointerFrame = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = window.requestAnimationFrame(flushPointerFrame);
    }
  }, [flushPointerFrame]);

  // Keep live drag DOM position intact if a selection state render occurs right after pointerdown
  useLayoutEffect(() => {
    const session = dragSessionRef.current;
    if (session && (session.mode === 'move' || session.mode === 'resize') && session.hasMoved) {
      applyLiveNodeRectToDom(session, session.currentRect);
    }
  });

  // Hide rubber-band preview whenever connectSourceId clears
  useEffect(() => {
    if (!connectSourceId && dragSessionRef.current?.mode !== 'connect-drag') {
      hideConnectPreviewDom();
    }
  }, [connectSourceId, hideConnectPreviewDom]);

  // Cancel any pending RAF or timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
      if (commentHintTimerRef.current !== null) {
        window.clearTimeout(commentHintTimerRef.current);
      }
    };
  }, []);

  // Non-passive cursor-centered wheel zoom (eliminates passive wheel warnings & zoom drift)
  useEffect(() => {
    const vp = canvasViewportRef.current;
    if (!vp) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const prevZoom = zoomRef.current;
      const deltaFactor = e.ctrlKey ? -e.deltaY * 0.01 : e.deltaY < 0 ? 0.1 : -0.1;
      const nextZoom = clampZoom(prevZoom + deltaFactor);
      if (Math.abs(nextZoom - prevZoom) < 0.0005) return;

      const worldX = (pointerX - panRef.current.x) / prevZoom;
      const worldY = (pointerY - panRef.current.y) / prevZoom;
      const nextPan = {
        x: Math.round(pointerX - worldX * nextZoom),
        y: Math.round(pointerY - worldY * nextZoom),
      };

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      if (worldLayerRef.current) {
        worldLayerRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
      }
      vp.style.backgroundPosition = `${nextPan.x}px ${nextPan.y}px`;
      setZoom(nextZoom);
      setPan(nextPan);
    };

    vp.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const handleQuickPortPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    node: DiagramNode
  ) => {
    if (e.button !== 0 || isWalkthrough) return;
    e.stopPropagation();
    setShowAddNodeMenu(false);
    setEditingNodeId(null);
    setSelectedEdgeId(null);
    setConnectSourceId(node.id);
    canvasViewportRef.current?.setPointerCapture(e.pointerId);

    dragSessionRef.current = {
      mode: 'connect-drag',
      sourceId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasDragged: true,
      fromQuickHandle: true,
    };
    latestPointerRef.current = { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey };
    schedulePointerFrame();
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: DiagramNode
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (isWalkthrough) {
      if (walkthroughStepIndexByNodeId.has(node.id)) {
        handleRewindWalkthroughToNode(node.id);
        return;
      }
      // If this node is the direct target of a currently selectable connection, activate that connection
      const matchingEdge = diagram.edges.find(
        (edge) => edge.to === node.id && walkthroughSelectableEdgeIds.has(edge.id)
      );
      if (matchingEdge) {
        handleSelectWalkthroughEdge(matchingEdge.id);
      }
      return;
    }

    if (tool === 'connect') {
      if (!connectSourceId) {
        setConnectSourceId(node.id);
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);
        canvasViewportRef.current?.setPointerCapture(e.pointerId);
        dragSessionRef.current = {
          mode: 'connect-drag',
          sourceId: node.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          hasDragged: false,
          fromQuickHandle: false,
        };
        latestPointerRef.current = { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey };
      } else if (connectSourceId === node.id) {
        setConnectSourceId(null);
        hideConnectPreviewDom();
      } else {
        createConnectorBetween(connectSourceId, node.id, true);
      }
      return;
    }

    if (tool === 'pan') return;
    if (editingNodeId === node.id) return;

    if (selectedNodeId !== node.id) setSelectedNodeId(node.id);
    if (selectedEdgeId !== null) setSelectedEdgeId(null);
    if (editingNodeId !== null) setEditingNodeId(null);
    if (showAddNodeMenu) setShowAddNodeMenu(false);

    // Capture pointer directly on the canvas viewport so events never drop mid-drag
    canvasViewportRef.current?.setPointerCapture(e.pointerId);

    const connectedEdges = diagram.edges.filter(
      (edge) => edge.from === node.id || edge.to === node.id
    );
    const otherNodes = diagram.nodes.filter((n) => n.id !== node.id);
    const nodeLookup = new Map(diagram.nodes.map((n) => [n.id, n]));

    const nodeEl = nodeElsRef.current.get(node.id);
    if (nodeEl) {
      nodeEl.style.zIndex = '25';
      nodeEl.style.willChange = 'transform';
    }

    const targetEl = e.target as HTMLElement | null;
    const textPart = targetEl?.closest<HTMLElement>('[data-text-part]')?.dataset.textPart;
    const clickedTextKind =
      textPart === 'title'
        ? ('node-title' as const)
        : textPart === 'body'
          ? ('node-body' as const)
          : undefined;

    dragSessionRef.current = {
      mode: 'move',
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialNode: node,
      currentRect: { x: node.x, y: node.y, width: node.width, height: node.height },
      connectedEdges,
      otherNodes,
      nodeLookup,
      hasMoved: false,
      clickedTextKind,
    };
  };

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    node: DiagramNode
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    canvasViewportRef.current?.setPointerCapture(e.pointerId);

    const connectedEdges = diagram.edges.filter(
      (edge) => edge.from === node.id || edge.to === node.id
    );
    const nodeLookup = new Map(diagram.nodes.map((n) => [n.id, n]));

    dragSessionRef.current = {
      mode: 'resize',
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialNode: node,
      currentRect: { x: node.x, y: node.y, width: node.width, height: node.height },
      connectedEdges,
      otherNodes: [],
      nodeLookup,
      hasMoved: false,
    };
  };

  const handlePointerMoveGlobal = (e: React.PointerEvent<HTMLDivElement>) => {
    const needsTracking =
      Boolean(panStartRef.current) ||
      Boolean(dragSessionRef.current) ||
      Boolean(connectSourceIdRef.current);
    if (!needsTracking) return;

    latestPointerRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      altKey: e.altKey,
    };
    schedulePointerFrame();
  };

  const handlePointerUpGlobal = (e: React.PointerEvent<HTMLDivElement>) => {
    if (canvasViewportRef.current?.hasPointerCapture(e.pointerId)) {
      canvasViewportRef.current.releasePointerCapture(e.pointerId);
    }

    // Synchronously flush the final pointer coordinate before committing
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      latestPointerRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        altKey: e.altKey,
      };
      flushPointerFrame();
    }

    if (panStartRef.current) {
      const finalPan = {
        x: panStartRef.current.currentX,
        y: panStartRef.current.currentY,
      };
      panStartRef.current = null;
      setIsPanning(false);
      setPan(finalPan);
      return;
    }

    const session = dragSessionRef.current;
    if (!session) return;
    dragSessionRef.current = null;

    if (session.mode === 'connect-drag') {
      const worldPt = screenToWorld(e.clientX, e.clientY);
      const targetNode = findNodeAtWorldPoint(worldPt.x, worldPt.y, session.sourceId);

      if (targetNode) {
        createConnectorBetween(session.sourceId, targetNode.id, !session.fromQuickHandle);
      } else if (session.fromQuickHandle || session.hasDragged) {
        // Released on empty canvas after dragging -> cancel cleanly
        setConnectSourceId(null);
        hideConnectPreviewDom();
      }
      // If user simply clicked source node in Connect mode without dragging,
      // keep connectSourceId active so click-to-click works seamlessly!
      return;
    }

    hideAlignmentGuides();

    const nodeEl = nodeElsRef.current.get(session.nodeId);
    if (nodeEl) {
      nodeEl.style.zIndex = '';
      nodeEl.style.willChange = '';
    }

    if (session.hasMoved) {
      const finalRect = session.currentRect;
      const currentDiagram = diagramRef.current;
      commitDiagram({
        ...currentDiagram,
        nodes: currentDiagram.nodes.map((n) =>
          n.id === session.nodeId
            ? {
                ...n,
                x: finalRect.x,
                y: finalRect.y,
                width: finalRect.width,
                height: finalRect.height,
              }
            : n
        ),
      });
    } else if (session.mode === 'move' && session.clickedTextKind) {
      setSelectedTextTarget({
        kind: session.clickedTextKind,
        nodeId: session.nodeId,
      });
      setFormatPanelOpen(false);
      setCommentingNodeId(null);
      setCommentAnchor(null);
    }
  };

  const handleCanvasBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setShowAddNodeMenu(false);
    setCommentingNodeId(null);
    setCommentAnchor(null);

    if (tool === 'pan') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y,
        currentX: panRef.current.x,
        currentY: panRef.current.y,
      };
      return;
    }

    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedTextTarget(null);
    setEditingNodeId(null);
    setConnectSourceId(null);
    hideConnectPreviewDom();

    // Allow subtle click-drag panning on empty background in select mode too
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
      currentX: panRef.current.x,
      currentY: panRef.current.y,
    };
  };

  const activeSourceImageUrl =
    diagram.sourceImageDataUrl ?? initialAlgorithm?.sourceImageDataUrl;

  const handleSaveDiagram = useCallback(async () => {
    setIsSaving(true);
    onSavingChange?.(true);
    try {
      const resolvedTitle =
        (externalTitle !== undefined ? externalTitle : diagram.title).trim() ||
        'Algoritmo Clínico Nutricional';
      const diagramWithTitle: EditableDiagram = {
        ...diagram,
        title: resolvedTitle,
      };
      const diagramToSave: EditableDiagram = activeSourceImageUrl
        ? { ...diagramWithTitle, sourceImageDataUrl: activeSourceImageUrl }
        : diagramWithTitle;
      const svgDataUrl = serializeDiagramToSvgDataUrl(diagramToSave);
      await onSaveToLibrary({
        id: initialAlgorithm?.id,
        title: resolvedTitle,
        subtitle: diagramToSave.subtitle.trim() || undefined,
        tags: diagramToSave.tags.length > 0 ? diagramToSave.tags : ['Nutrición Clínica'],
        imageDataUrl: svgDataUrl,
        sourceImageDataUrl: activeSourceImageUrl,
        reference: diagramToSave.reference?.trim() || undefined,
        notes: diagramToSave.notes,
        diagram: diagramToSave,
      });
    } finally {
      setIsSaving(false);
      onSavingChange?.(false);
    }
  }, [activeSourceImageUrl, diagram, externalTitle, initialAlgorithm?.id, onSaveToLibrary, onSavingChange]);

  useEffect(() => {
    if (!saveHandlerRef) return;
    saveHandlerRef.current = handleSaveDiagram;
    return () => {
      saveHandlerRef.current = null;
    };
  }, [saveHandlerRef, handleSaveDiagram]);

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div
      data-testid="algorithm-generator"
      className={
        embedded
          ? 'relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-[#1D1D1F]'
          : 'fixed inset-0 z-40 flex flex-col bg-white text-[#1D1D1F]'
      }
    >
      {/* Top Frosted macOS Studio Bar (standalone Generador mode only) */}
      {!embedded && (
      <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] mac-glass-strong px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la biblioteca"
            title="Volver a la biblioteca"
            data-testid="generator-back-btn"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E5EA] bg-white/90 text-[#1D1D1F] transition-colors hover:bg-white shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1 max-w-sm">
            <label htmlFor="generator-title-input" className="sr-only">
              Título del algoritmo
            </label>
            <input
              id="generator-title-input"
              type="text"
              readOnly={isWalkthrough}
              value={diagram.title}
              onChange={(e) =>
                setHistory((prev) => ({
                  ...prev,
                  present: { ...prev.present, title: e.target.value },
                }))
              }
              placeholder="Título del algoritmo clínico…"
              className={`h-9 w-full truncate rounded-lg border border-transparent bg-transparent px-2 text-[15px] font-semibold tracking-[-0.015em] text-[#1D1D1F] transition-colors focus:outline-none ${
                isWalkthrough
                  ? 'cursor-default'
                  : 'hover:border-[#E5E5EA] hover:bg-white/70 focus:border-[#0071E3] focus:bg-white'
              }`}
            />
          </div>
        </div>

        {/* Center/Right macOS Segmented Mode Switch: Editar vs Recorrido Guiado */}
        <div
          role="tablist"
          aria-label="Modo del estudio de algoritmos"
          className="inline-flex h-9 items-center rounded-[10px] border border-[#E5E5EA] bg-[#ECECEF]/85 p-0.5 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isWalkthrough}
            data-testid="mode-edit-btn"
            onClick={() => handleSwitchStudioMode('edit')}
            className={`inline-flex h-full items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-medium transition-all whitespace-nowrap ${
              !isWalkthrough
                ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden md:inline">Editar</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isWalkthrough}
            data-testid="mode-walkthrough-btn"
            onClick={() => handleSwitchStudioMode('walkthrough')}
            className={`inline-flex h-full items-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-medium transition-all whitespace-nowrap ${
              isWalkthrough
                ? 'bg-white text-[#0071E3] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            <Route className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Recorrido Guiado</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isWalkthrough && (
            <button
              type="button"
              onClick={() => void handleSaveDiagram()}
              disabled={isSaving || diagram.nodes.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#0071E3] px-4 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all hover:bg-[#0077ED] active:scale-[0.98] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isSaving ? 'Guardando…' : 'Guardar'}
              </span>
              <span className="sm:hidden">{isSaving ? '…' : 'Guardar'}</span>
            </button>
          )}
        </div>
      </header>
      )}

      {/* Main Freeform Workspace */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Collapsible Minimalist AI Input Panel */}
        <GeneratorAiDrawer
          visible={!isWalkthrough}
          open={aiDrawerOpen}
          onToggleOpen={() => setAiDrawerOpen((prev) => !prev)}
          onClose={() => setAiDrawerOpen(false)}
          onDiagramGenerated={(generated) => {
            commitDiagram(generated);
            setWalkthroughState(createInitialWalkthrough(generated));
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setEditingNodeId(null);
            setContextPopoverOpen(false);
            window.setTimeout(() => fitCanvasToView(generated), 40);
          }}
        />

        {/* Freeform Stage Container (centers inspectors, canvas & dock cleanly alongside side panels) */}
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Persistent Floating Corner Preview of Original Uploaded Image */}
          <OriginalImagePip
            imageDataUrl={activeSourceImageUrl}
            title={diagram.title}
            className={
              isWalkthrough
                ? 'bottom-4 right-20 sm:bottom-5 sm:right-24'
                : formatPanelOpen || activeTextInfo
                  ? 'bottom-4 left-4'
                  : 'top-4 left-4'
            }
          />

          {/* Floating Algorithm Context / Introduction Popover */}
          <AlgorithmContextPopover
            open={contextPopoverOpen}
            context={diagram.clinicalContext}
            fallbackSubtitle={diagram.subtitle}
            fallbackReference={diagram.reference ?? initialAlgorithm?.reference}
            editable={!isWalkthrough}
            onSave={handleSaveClinicalContext}
            onClose={() => setContextPopoverOpen(false)}
          />

          {/* Floating Global Format & Color Palettes Panel */}
          {!isWalkthrough && (
            <EditorFormatPanel
              open={formatPanelOpen}
              colorMode={globalColorMode}
              paletteId={globalPaletteId}
              fontScale={globalFontScale}
              onChangeColorMode={(mode) => handleUpdateGlobalFormat({ colorMode: mode })}
              onChangePalette={(pid) => handleUpdateGlobalFormat({ paletteId: pid })}
              onChangeFontScale={(scale) => handleUpdateGlobalFormat({ fontScale: scale })}
              onReset={handleResetGlobalFormat}
              onClose={() => setFormatPanelOpen(false)}
            />
          )}

          {/* Floating Specific Selected Text Panel */}
          {!isWalkthrough && activeTextInfo && selectedTextTarget && (
            <SelectedTextPanel
              open
              kind={activeTextInfo.kind}
              text={activeTextInfo.text}
              fontSize={activeTextInfo.fontSize}
              opacity={activeTextInfo.opacity}
              onChangeText={(nextText) => {
                updateSelectedTextTarget((curr) => {
                  if (selectedTextTarget.kind === 'edge-label') {
                    return {
                      ...curr,
                      edges: curr.edges.map((e) =>
                        e.id === selectedTextTarget.edgeId ? { ...e, label: nextText } : e
                      ),
                    };
                  }
                  return {
                    ...curr,
                    nodes: curr.nodes.map((n) => {
                      if (n.id !== selectedTextTarget.nodeId) return n;
                      return selectedTextTarget.kind === 'node-title'
                        ? { ...n, title: nextText }
                        : { ...n, body: nextText };
                    }),
                  };
                });
              }}
              onChangeFontSize={(nextSize) => {
                updateSelectedTextTarget((curr) => {
                  if (selectedTextTarget.kind === 'edge-label') {
                    return {
                      ...curr,
                      edges: curr.edges.map((e) =>
                        e.id === selectedTextTarget.edgeId
                          ? { ...e, labelFontSize: nextSize }
                          : e
                      ),
                    };
                  }
                  return {
                    ...curr,
                    nodes: curr.nodes.map((n) => {
                      if (n.id !== selectedTextTarget.nodeId) return n;
                      return selectedTextTarget.kind === 'node-title'
                        ? { ...n, titleFontSize: nextSize }
                        : { ...n, bodyFontSize: nextSize };
                    }),
                  };
                });
              }}
              onChangeOpacity={(nextOpacity) => {
                updateSelectedTextTarget((curr) => {
                  if (selectedTextTarget.kind === 'edge-label') {
                    return {
                      ...curr,
                      edges: curr.edges.map((e) =>
                        e.id === selectedTextTarget.edgeId
                          ? { ...e, labelOpacity: nextOpacity }
                          : e
                      ),
                    };
                  }
                  return {
                    ...curr,
                    nodes: curr.nodes.map((n) => {
                      if (n.id !== selectedTextTarget.nodeId) return n;
                      return selectedTextTarget.kind === 'node-title'
                        ? { ...n, titleOpacity: nextOpacity }
                        : { ...n, bodyOpacity: nextOpacity };
                    }),
                  };
                });
              }}
              onDuplicate={handleDuplicateSelectedTextElement}
              onDelete={handleDeleteSelectedTextElement}
              onReset={handleResetSelectedTextElement}
              onClose={() => setSelectedTextTarget(null)}
            />
          )}

          {/* Contextual Selection Style Bar (Bottom-Centered) */}
          {!isWalkthrough && selectedNode && !editingNodeId && (
          <div
            role="region"
            aria-label="Propiedades del nodo seleccionado"
            data-testid="node-inspector"
            onPointerDown={(e) => e.stopPropagation()}
            className="mac-toast-in absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#E5E5EA] mac-glass-strong px-3 py-1.5 mac-dock-shadow"
          >
            <div className="flex items-center gap-1" role="group" aria-label="Color del nodo">
              {(Object.keys(NODE_TONE_STYLES) as NodeTone[]).map((toneKey) => {
                const spec = NODE_TONE_STYLES[toneKey];
                const resolved = resolveNodeColors(toneKey, globalPaletteId, globalColorMode);
                const active = selectedNode.tone === toneKey;
                return (
                  <button
                    key={toneKey}
                    type="button"
                    onClick={() => handleUpdateSelectedNode({ tone: toneKey })}
                    aria-label={`Color ${spec.label}`}
                    aria-pressed={active}
                    title={spec.label}
                    className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
                  >
                    <span
                      style={{
                        backgroundColor: resolved.fill,
                        boxShadow: active
                          ? '0 0 0 2px #FFFFFF, 0 0 0 3.5px #0071E3'
                          : `inset 0 0 0 1.5px ${resolved.stroke}`,
                      }}
                      className="h-4.5 w-4.5 rounded-full"
                    />
                  </button>
                );
              })}
            </div>

            <div className="h-5 w-px bg-[#D1D1D6]" aria-hidden="true" />

            <select
              aria-label="Forma del cuadro"
              value={selectedNode.shape}
              onChange={(e) => handleUpdateSelectedNode({ shape: e.target.value as NodeShape })}
              className="h-7 rounded-lg border border-[#E5E5EA] bg-white px-2 text-[12px] font-medium text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none"
            >
              {(
                [
                  'oval',
                  'process',
                  'diamond',
                  'pill',
                  'parallelogram',
                  'hexagon',
                  'block-arrow',
                  'thin-arrow',
                  'double-arrow',
                  'decision',
                ] as NodeShape[]
              ).map((shapeKey) => (
                <option key={shapeKey} value={shapeKey}>
                  {SHAPE_LABELS[shapeKey]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contextual Connector Editor Bar (Bottom-Centered) */}
        {!isWalkthrough && selectedEdge && (
          <div
            role="region"
            aria-label="Propiedades del conector seleccionado"
            data-testid="edge-inspector"
            onPointerDown={(e) => e.stopPropagation()}
            className="mac-toast-in absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#E5E5EA] mac-glass-strong px-3 py-1.5 mac-dock-shadow"
          >
            <input
              type="text"
              value={selectedEdge.label}
              onChange={(e) => handleUpdateSelectedEdge({ label: e.target.value })}
              placeholder="Etiqueta (ej. Sí, No, < 60%)…"
              aria-label="Etiqueta de la conexión"
              className="h-7 w-44 rounded-lg border border-[#E5E5EA] bg-white px-2.5 text-[12.5px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none"
            />
            <div className="h-5 w-px bg-[#D1D1D6]" aria-hidden="true" />
            {(['solid', 'straight', 'dashed'] as EdgeStyle[]).map((styleKey) => (
              <button
                key={styleKey}
                type="button"
                onClick={() => handleUpdateSelectedEdge({ style: styleKey })}
                aria-pressed={selectedEdge.style === styleKey}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors whitespace-nowrap ${
                  selectedEdge.style === styleKey
                    ? 'bg-[#1D1D1F] text-white'
                    : 'text-[#1D1D1F] hover:bg-white/90'
                }`}
              >
                {EDGE_STYLE_LABELS[styleKey]}
              </button>
            ))}
          </div>
        )}

        {/* Subtle Hint if User Clicks Comment Button Without Selecting a Node */}
        {!isWalkthrough && commentHintVisible && (
          <div className="mac-toast-in pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-[#0071E3]/30 bg-[#F0F7FF]/95 px-4 py-1.5 text-[12.5px] font-medium text-[#0C4A6E] shadow-xs whitespace-nowrap">
            Selecciona un cuadro y luego pulsa el ícono de comentario para añadirle una nota
          </div>
        )}

        {/* Connect Mode Subtle Hint Banner */}
        {!isWalkthrough && tool === 'connect' && !selectedEdge && !selectedNode && !commentHintVisible && (
          <div className="mac-toast-in pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-[#0071E3]/30 bg-[#F0F7FF]/95 px-4 py-1.5 text-[12.5px] font-medium text-[#0C4A6E] shadow-xs whitespace-nowrap">
            {connectSourceId
              ? 'Haz clic o suelta sobre el cuadro de destino para crear la flecha'
              : `Modo conectar (${EDGE_STYLE_LABELS[connectStyle]}): haz clic o arrastra desde un cuadro`}
          </div>
        )}

        {/* Interactive Freeform Vector Canvas */}
        <div
          ref={canvasViewportRef}
          data-testid="freeform-canvas"
          data-node-count={renderedNodes.length}
          data-edge-count={diagram.edges.length}
          data-zoom={zoomPercent}
          onPointerDown={handleCanvasBackgroundPointerDown}
          onPointerMove={handlePointerMoveGlobal}
          onPointerUp={handlePointerUpGlobal}
          onPointerCancel={handlePointerUpGlobal}
          style={{
            backgroundImage: 'radial-gradient(#E5E5EA 1px, transparent 1px)',
            backgroundSize: `${Math.round(24 * zoom)}px ${Math.round(24 * zoom)}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          className={`relative flex-1 overflow-hidden bg-white select-none touch-none ${
            tool === 'pan' || isPanning
              ? isPanning
                ? 'cursor-grabbing'
                : 'cursor-grab'
              : tool === 'connect'
                ? 'cursor-crosshair'
                : 'cursor-default'
          }`}
        >
          {/* Transformed World Layer */}
          <div
            ref={worldLayerRef}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute inset-0"
          >
            {/* World-Space SVG Layer: Connectors + Live Preview Arrow + Magnetic Blue Alignment Guides */}
            <svg
              className="pointer-events-none absolute overflow-visible"
              style={{
                left: svgBounds.x,
                top: svgBounds.y,
                width: svgBounds.width,
                height: svgBounds.height,
              }}
              viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.width} ${svgBounds.height}`}
            >
              <defs>
                {Array.from(
                  new Set<string>([
                    '#0071E3',
                    '#6E6E73',
                    '#15803D',
                    '#B45309',
                    ...diagram.edges.map((edge) => {
                      const g = edgeGeometries.get(edge.id);
                      return g
                        ? resolveEdgeColor(g.strokeColor, globalPaletteId, globalColorMode)
                        : '#6E6E73';
                    }),
                  ])
                ).map((hex) => (
                  <marker
                    key={hex}
                    id={`ff-arrow-${hex.replace('#', '')}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 1 1.5 L 8.5 5 L 1 8.5"
                      fill="none"
                      stroke={hex}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </marker>
                ))}
              </defs>

              {/* Edges */}
              {diagram.edges.map((edge) => {
                const geom = edgeGeometries.get(edge.id);
                if (!geom) return null;
                const isSelected = !isWalkthrough && edge.id === selectedEdgeId;
                const isVisitedEdge = isWalkthrough && walkthroughVisitedEdgeIds.has(edge.id);
                const isCurrentChoiceEdge =
                  isWalkthrough && walkthroughCurrentOutgoingEdgeIds.has(edge.id);
                const isAlternativeBranchEdge =
                  isWalkthrough &&
                  !isCurrentChoiceEdge &&
                  walkthroughSelectableEdgeIds.has(edge.id);
                const isSelectableEdge = isCurrentChoiceEdge || isAlternativeBranchEdge;

                const themedStrokeColor = resolveEdgeColor(
                  geom.strokeColor,
                  globalPaletteId,
                  globalColorMode
                );
                const strokeColor =
                  isSelected ||
                  (isVisitedEdge && (geom.strokeColor === '#6E6E73' || geom.strokeColor === '#8E8E93'))
                    ? '#0071E3'
                    : isCurrentChoiceEdge && geom.strokeColor === '#6E6E73'
                      ? '#0071E3'
                      : themedStrokeColor;

                const markerId = `ff-arrow-${strokeColor.replace('#', '')}`;

                const edgeOpacity = !isWalkthrough
                  ? 1
                  : isVisitedEdge
                    ? 1
                    : isCurrentChoiceEdge
                      ? 0.92
                      : isAlternativeBranchEdge
                        ? 0.34
                        : 0.16;

                const strokeWidth = isVisitedEdge
                  ? 3.4
                  : isCurrentChoiceEdge
                    ? 2.5
                    : isSelected
                      ? 2.6
                      : 2;

                const handleEdgeClick = (e: React.PointerEvent<SVGPathElement>) => {
                  e.stopPropagation();
                  if (isWalkthrough) {
                    if (isSelectableEdge) {
                      handleSelectWalkthroughEdge(edge.id);
                    }
                    return;
                  }
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
                  setEditingNodeId(null);
                };

                const bindEdgeRef = (
                  kind: 'visible' | 'hit' | 'glow',
                  el: SVGPathElement | null
                ) => {
                  const existing = edgePathElsRef.current.get(edge.id) ?? {
                    visible: null,
                    hit: null,
                    glow: null,
                  };
                  existing[kind] = el;
                  if (!existing.visible && !existing.hit && !existing.glow) {
                    edgePathElsRef.current.delete(edge.id);
                  } else {
                    edgePathElsRef.current.set(edge.id, existing);
                  }
                };

                return (
                  <g
                    key={edge.id}
                    style={
                      isWalkthrough
                        ? { opacity: edgeOpacity, transition: 'opacity 220ms ease' }
                        : undefined
                    }
                    className={`pointer-events-auto ${
                      !isWalkthrough || isSelectableEdge ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {/* Subtle soft glow beneath illuminated active route edges */}
                    {isVisitedEdge && (
                      <path
                        ref={(el) => bindEdgeRef('glow', el)}
                        d={geom.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeOpacity="0.18"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Wide invisible hit path for effortless selection */}
                    <path
                      ref={(el) => bindEdgeRef('hit', el)}
                      d={geom.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="20"
                      onPointerDown={handleEdgeClick}
                    />
                    <path
                      ref={(el) => bindEdgeRef('visible', el)}
                      d={geom.pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={geom.isDashed ? '6 5' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd={`url(#${markerId})`}
                      onPointerDown={handleEdgeClick}
                    />
                  </g>
                );
              })}

              {/* Live Rubber-Band Connector Preview (updated directly via RAF at 60/120fps) */}
              <path
                ref={connectPreviewPathRef}
                data-testid="connector-preview-path"
                d=""
                fill="none"
                stroke="#0071E3"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd="url(#ff-arrow-0071E3)"
                style={{ display: 'none' }}
              />

              {/* Keynote-Style Magnetic Blue Alignment Guides (direct DOM refs for zero re-renders) */}
              <line
                ref={guideXLineRef}
                x1="0"
                y1="0"
                x2="0"
                y2="0"
                stroke="#0071E3"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                style={{ display: 'none' }}
              />
              <line
                ref={guideYLineRef}
                x1="0"
                y1="0"
                x2="0"
                y2="0"
                stroke="#0071E3"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                style={{ display: 'none' }}
              />
            </svg>

            {/* Interactive Edge Labels & Clickable Walkthrough Connection Buttons */}
            {diagram.edges.map((edge) => {
              const geom = edgeGeometries.get(edge.id);
              if (!geom) return null;

              const isVisitedEdge = isWalkthrough && walkthroughVisitedEdgeIds.has(edge.id);
              const isCurrentChoiceEdge =
                isWalkthrough && walkthroughCurrentOutgoingEdgeIds.has(edge.id);
              const isAlternativeBranchEdge =
                isWalkthrough &&
                !isCurrentChoiceEdge &&
                walkthroughSelectableEdgeIds.has(edge.id);
              const isSelectableEdge = isCurrentChoiceEdge || isAlternativeBranchEdge;
              const hasLabel = edge.label.trim().length > 0;

              // In edit mode, only render labels that have text.
              // In walkthrough mode, also render a sleek clickable "Continuar" badge on unlabeled current outgoing connections!
              if (!hasLabel && !isCurrentChoiceEdge) return null;

              const isSelected = !isWalkthrough && edge.id === selectedEdgeId;

              const labelOpacity = !isWalkthrough
                ? 1
                : isVisitedEdge || isCurrentChoiceEdge
                  ? 1
                  : isAlternativeBranchEdge
                    ? 0.52
                    : 0.18;

              const badgeColors = resolveEdgeBadgeColors(
                geom.strokeColor,
                globalPaletteId,
                globalColorMode
              );
              const edgeLabelFontSize = Number(
                ((edge.labelFontSize ?? DEFAULT_EDGE_LABEL_FONT_SIZE) * globalFontScale).toFixed(2)
              );
              const edgeCustomOpacity =
                typeof edge.labelOpacity === 'number' && Number.isFinite(edge.labelOpacity)
                  ? edge.labelOpacity
                  : 1;

              return (
                <button
                  key={`label-${edge.id}`}
                  ref={(el) => {
                    if (el) {
                      edgeLabelElsRef.current.set(edge.id, el);
                    } else {
                      edgeLabelElsRef.current.delete(edge.id);
                    }
                  }}
                  type="button"
                  data-testid={
                    isWalkthrough ? `walkthrough-edge-btn-${edge.id}` : `edge-label-${edge.id}`
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isWalkthrough) {
                      if (isSelectableEdge) {
                        handleSelectWalkthroughEdge(edge.id);
                      }
                      return;
                    }
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    setSelectedTextTarget({ kind: 'edge-label', edgeId: edge.id });
                    setFormatPanelOpen(false);
                    setCommentingNodeId(null);
                    setCommentAnchor(null);
                  }}
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${geom.labelX}px, ${geom.labelY}px, 0) translate(-50%, -50%)`,
                    opacity: labelOpacity * edgeCustomOpacity,
                    fontSize: `${edgeLabelFontSize}px`,
                    ...(isWalkthrough || isSelected
                      ? {}
                      : {
                          backgroundColor: badgeColors.fill,
                          color: badgeColors.text,
                          borderColor: '#FFFFFF',
                        }),
                  }}
                  className={`absolute inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 font-semibold transition-[opacity,color,background-color,border-color] duration-150 whitespace-nowrap ${
                    isCurrentChoiceEdge
                      ? 'cursor-pointer border-[#0071E3] bg-white text-[#0071E3] shadow-[0_4px_14px_-4px_rgba(0,113,227,0.38)] ring-2 ring-[#0071E3]/15 hover:bg-[#0071E3] hover:text-white'
                      : isAlternativeBranchEdge
                        ? 'cursor-pointer border-[#D1D1D6] bg-white/95 text-[#6E6E73] hover:opacity-100 hover:border-[#0071E3] hover:text-[#0071E3] hover:shadow-xs'
                        : isVisitedEdge
                          ? geom.strokeColor === '#15803D'
                            ? 'border-[#15803D] bg-[#15803D] text-white shadow-xs'
                            : geom.strokeColor === '#B45309'
                              ? 'border-[#B45309] bg-[#B45309] text-white shadow-xs'
                              : 'border-[#0071E3] bg-[#0071E3] text-white shadow-xs'
                          : isSelected
                            ? 'border-[#0071E3] bg-[#F0F7FF] text-[#0071E3]'
                            : ''
                  }`}
                >
                  {isVisitedEdge && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
                  <span>{hasLabel ? edge.label : 'Continuar'}</span>
                  {isCurrentChoiceEdge && (
                    <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}

            {/* Interactive Nodes Layer */}
            {renderedNodes.map((node) => {
              const toneStyle = resolveNodeColors(node.tone, globalPaletteId, globalColorMode);
              const metrics =
                adaptiveMetricsMap.get(node.id) ??
                computeAdaptiveNodeMetrics(node, globalFontScale);
              const isSelected = !isWalkthrough && node.id === selectedNodeId;
              const isConnectSource = !isWalkthrough && node.id === connectSourceId;
              const isConnectTargetHover = !isWalkthrough && node.id === connectHoverTargetId;
              const isEditing = !isWalkthrough && node.id === editingNodeId;
              const usesCustomVector = isCustomSvgShape(node.shape);
              const innerPadding = getShapeInnerPadding(node.shape);
              const hasComment = Boolean(node.comment?.trim());
              const isTitleFocused =
                !isWalkthrough &&
                selectedTextTarget?.kind === 'node-title' &&
                selectedTextTarget.nodeId === node.id;
              const isBodyFocused =
                !isWalkthrough &&
                selectedTextTarget?.kind === 'node-body' &&
                selectedTextTarget.nodeId === node.id;

              const borderRadius =
                node.shape === 'pill'
                  ? '9999px'
                  : node.shape === 'decision'
                    ? '18px'
                    : '14px';

              const stepIndex = walkthroughStepIndexByNodeId.get(node.id);
              const isVisitedNode = isWalkthrough && stepIndex !== undefined;
              const isCurrentNode = isWalkthrough && node.id === currentWalkthroughNodeId;
              const isCurrentChoiceTarget =
                isWalkthrough &&
                !isVisitedNode &&
                diagram.edges.some(
                  (edge) => edge.to === node.id && walkthroughCurrentOutgoingEdgeIds.has(edge.id)
                );
              const isAlternativeTarget =
                isWalkthrough &&
                !isVisitedNode &&
                !isCurrentChoiceTarget &&
                diagram.edges.some(
                  (edge) => edge.to === node.id && walkthroughSelectableEdgeIds.has(edge.id)
                );
              const isSelectableTarget = isCurrentChoiceTarget || isAlternativeTarget;

              const nodeOpacity = !isWalkthrough
                ? 1
                : isVisitedNode
                  ? 1
                  : isCurrentChoiceTarget
                    ? 0.94
                    : isAlternativeTarget
                      ? 0.34
                      : 0.2;

              const resolvedBorderColor =
                isCurrentNode || isSelected || isConnectSource || isConnectTargetHover || isVisitedNode
                  ? '#0071E3'
                  : toneStyle.stroke;

              const resolvedBorderWidth =
                isCurrentNode ||
                isVisitedNode ||
                isSelected ||
                isConnectSource ||
                isConnectTargetHover ||
                node.shape === 'decision'
                  ? 2
                  : 1.5;

              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) {
                      nodeElsRef.current.set(node.id, el);
                    } else {
                      nodeElsRef.current.delete(node.id);
                    }
                  }}
                  data-testid={`diagram-node-${node.id}`}
                  data-shape={node.shape}
                  data-walkthrough-state={
                    !isWalkthrough
                      ? undefined
                      : isCurrentNode
                        ? 'active'
                        : isVisitedNode
                          ? 'visited'
                          : isSelectableTarget
                            ? 'available'
                            : 'dimmed'
                  }
                  onPointerDown={(e) => handleNodePointerDown(e, node)}
                  onDoubleClick={(e) => {
                    if (isWalkthrough) return;
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    setEditingNodeId(node.id);
                  }}
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                    width: node.width,
                    height: node.height,
                    paddingLeft: `${innerPadding.px}px`,
                    paddingRight: `${innerPadding.px}px`,
                    paddingTop: `${innerPadding.py}px`,
                    paddingBottom: `${innerPadding.py}px`,
                    opacity: nodeOpacity,
                    ...(usesCustomVector
                      ? {
                          backgroundColor: 'transparent',
                          borderColor: 'transparent',
                          borderWidth: 0,
                        }
                      : {
                          borderRadius,
                          backgroundColor: toneStyle.fill,
                          borderColor: resolvedBorderColor,
                          borderWidth: resolvedBorderWidth,
                          boxShadow: isConnectTargetHover
                            ? '0 0 0 4px rgba(0, 113, 227, 0.28), 0 12px 26px -10px rgba(0, 113, 227, 0.25)'
                            : isCurrentNode
                              ? '0 0 0 4px rgba(0, 113, 227, 0.22), 0 14px 30px -12px rgba(0, 113, 227, 0.28)'
                              : isVisitedNode
                                ? '0 8px 22px -10px rgba(0, 113, 227, 0.18)'
                                : isSelected || isConnectSource
                                  ? '0 0 0 3px rgba(0, 113, 227, 0.16), 0 10px 24px -10px rgba(29,29,31,0.14)'
                                  : '0 2px 8px -4px rgba(29,29,31,0.08)',
                        }),
                  }}
                  className={`group absolute flex flex-col items-center justify-center text-center transition-[opacity,box-shadow,border-color,background-color] duration-150 ${
                    usesCustomVector ? '' : 'border'
                  } ${
                    isWalkthrough
                      ? isVisitedNode || isSelectableTarget
                        ? 'cursor-pointer'
                        : 'cursor-default'
                      : tool === 'connect'
                        ? 'cursor-crosshair'
                        : isEditing
                          ? 'cursor-text'
                          : 'cursor-move'
                  }`}
                >
                  {/* Custom Geometric Vector Shape Backdrop */}
                  {usesCustomVector && (
                    <NodeShapeBackdrop
                      shape={node.shape}
                      width={node.width}
                      height={node.height}
                      fill={toneStyle.fill}
                      stroke={resolvedBorderColor}
                      strokeWidth={resolvedBorderWidth}
                      highlightRing={
                        isSelected || isCurrentNode || isConnectSource || isConnectTargetHover
                      }
                    />
                  )}

                  {node.shape === 'decision' && (
                    <span
                      style={{
                        borderColor: toneStyle.stroke,
                        color: toneStyle.titleColor,
                      }}
                      className="pointer-events-none absolute -top-2.5 left-4 z-10 rounded-full border bg-white px-2 py-0.5 text-[9.5px] font-bold tracking-[0.05em]"
                    >
                      DECISIÓN
                    </span>
                  )}

                  {/* Passive Saved Comment Indicator (only shown on nodes that already have a saved comment) */}
                  {hasComment && !isEditing && (
                    <span
                      data-testid={`node-comment-badge-${node.id}`}
                      title={`Comentario: ${node.comment}`}
                      className="pointer-events-none absolute -left-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[#0071E3]/40 bg-white text-[#0071E3] shadow-xs"
                    >
                      <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />
                    </span>
                  )}

                  {/* Step Number Badge on Illuminated Active Path Nodes */}
                  {isVisitedNode && stepIndex !== undefined && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute -right-2.5 -top-2.5 z-20 flex h-6 w-6 items-center justify-center rounded-full font-mono-tabular text-[11px] font-bold shadow-sm ${
                        isCurrentNode
                          ? 'bg-[#0071E3] text-white'
                          : 'border border-[#0071E3]/40 bg-white text-[#0071E3]'
                      }`}
                    >
                      {stepIndex + 1}
                    </span>
                  )}

                  {isEditing ? (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="relative z-10 flex h-full w-full flex-col justify-center gap-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={node.title}
                        onChange={(e) =>
                          setHistory((prev) => ({
                            ...prev,
                            present: {
                              ...prev.present,
                              nodes: prev.present.nodes.map((n) =>
                                n.id === node.id ? { ...n, title: e.target.value } : n
                              ),
                            },
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingNodeId(null);
                        }}
                        aria-label="Editar título del nodo"
                        className="w-full rounded bg-white/90 px-1.5 py-0.5 text-center text-[14px] font-bold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                      />
                      <textarea
                        rows={2}
                        value={node.body}
                        onChange={(e) =>
                          setHistory((prev) => ({
                            ...prev,
                            present: {
                              ...prev.present,
                              nodes: prev.present.nodes.map((n) =>
                                n.id === node.id ? { ...n, body: e.target.value } : n
                              ),
                            },
                          }))
                        }
                        aria-label="Editar descripción del nodo"
                        className="w-full resize-none rounded bg-white/90 px-1.5 py-0.5 text-center text-[12px] leading-snug text-[#3A3A3C] focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                      />
                    </div>
                  ) : (
                    <div className="relative z-10 flex w-full flex-col items-center justify-center gap-1 overflow-hidden">
                      <p
                        data-text-part="title"
                        style={{
                          color: toneStyle.titleColor,
                          fontSize: `${metrics.titleFontSize}px`,
                          opacity: metrics.titleOpacity,
                        }}
                        className={`rounded px-1 font-bold leading-snug tracking-[-0.01em] transition-shadow ${
                          !isWalkthrough && tool === 'select'
                            ? 'cursor-text hover:ring-1 hover:ring-[#0071E3]/45'
                            : 'pointer-events-none'
                        } ${isTitleFocused ? 'ring-1.5 ring-[#0071E3] bg-[#0071E3]/6' : ''}`}
                      >
                        {node.title}
                      </p>
                      {node.body && (
                        <p
                          data-text-part="body"
                          style={{
                            color: toneStyle.bodyColor,
                            fontSize: `${metrics.bodyFontSize}px`,
                            opacity: metrics.bodyOpacity,
                          }}
                          className={`rounded px-1 font-medium leading-snug transition-shadow ${
                            !isWalkthrough && tool === 'select'
                              ? 'cursor-text hover:ring-1 hover:ring-[#0071E3]/45'
                              : 'pointer-events-none'
                          } ${isBodyFocused ? 'ring-1.5 ring-[#0071E3] bg-[#0071E3]/6' : ''}`}
                        >
                          {node.body}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quick Drag-to-Connect Handles anchored at exact geometric edge midpoints */}
                  {isSelected && !isEditing && tool !== 'pan' && (
                    <>
                      <button
                        type="button"
                        aria-label="Arrastrar para conectar desde arriba"
                        title="Arrastra hacia otro cuadro para conectar"
                        onPointerDown={(e) => handleQuickPortPointerDown(e, node)}
                        className="absolute left-1/2 top-0 z-20 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-[#0071E3] bg-white shadow-xs hover:scale-125 hover:bg-[#0071E3]"
                      />
                      <button
                        type="button"
                        aria-label="Arrastrar para conectar desde abajo"
                        title="Arrastra hacia otro cuadro para conectar"
                        onPointerDown={(e) => handleQuickPortPointerDown(e, node)}
                        className="absolute bottom-0 left-1/2 z-20 flex h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-[#0071E3] bg-white shadow-xs hover:scale-125 hover:bg-[#0071E3]"
                      />
                      <button
                        type="button"
                        aria-label="Arrastrar para conectar desde la derecha"
                        title="Arrastra hacia otro cuadro para conectar"
                        onPointerDown={(e) => handleQuickPortPointerDown(e, node)}
                        className="absolute right-0 top-1/2 z-20 flex h-3.5 w-3.5 translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-[#0071E3] bg-white shadow-xs hover:scale-125 hover:bg-[#0071E3]"
                      />
                      <button
                        type="button"
                        aria-label="Arrastrar para conectar desde la izquierda"
                        title="Arrastra hacia otro cuadro para conectar"
                        onPointerDown={(e) => handleQuickPortPointerDown(e, node)}
                        className="absolute left-0 top-1/2 z-20 flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-[#0071E3] bg-white shadow-xs hover:scale-125 hover:bg-[#0071E3]"
                      />
                    </>
                  )}

                  {/* Bottom-Right Resize Handle anchored exactly at corner */}
                  {isSelected && !isEditing && (
                    <div
                      role="separator"
                      aria-label="Redimensionar cuadro"
                      onPointerDown={(e) => handleResizePointerDown(e, node)}
                      className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-[#1D1D1F] bg-white shadow-xs hover:scale-115"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Floating Section Comment Composer anchored cleanly in viewport coordinates */}
          {!isWalkthrough && commentingNodeId && commentAnchor && (() => {
            const targetNode = diagram.nodes.find((n) => n.id === commentingNodeId);
            if (!targetNode) return null;
            return (
              <div
                style={{ left: commentAnchor.left, top: commentAnchor.top }}
                className="absolute z-40"
              >
                <NodeCommentPopover
                  nodeTitle={targetNode.title}
                  initialComment={targetNode.comment ?? ''}
                  onSave={(comment) => handleSaveNodeComment(targetNode.id, comment)}
                  onCancel={() => {
                    setCommentingNodeId(null);
                    setCommentAnchor(null);
                  }}
                />
              </div>
            );
          })()}
        </div>

        {/* Right-Side Vertical Floating macOS Dock (Walkthrough Navigation vs Editor Tools) */}
        {isWalkthrough ? (
          <div
            role="toolbar"
            aria-orientation="vertical"
            aria-label="Controles de Recorrido Guiado"
            data-testid="walkthrough-dock"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-4 top-1/2 z-30 flex max-h-[calc(100%-2rem)] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[#E5E5EA] mac-study-dock px-2 py-2.5 mac-dock-shadow sm:right-5"
          >
            <button
              type="button"
              onClick={handleStepBackWalkthrough}
              disabled={walkthroughState.steps.length <= 1}
              aria-label="Paso anterior del recorrido"
              title="Paso anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleResetWalkthrough}
              disabled={walkthroughState.steps.length <= 1}
              aria-label="Reiniciar recorrido guiado"
              title="Reiniciar recorrido"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

            <span
              title={
                walkthroughComplete
                  ? `Final · ${walkthroughState.steps.length} pasos`
                  : `Paso ${walkthroughState.steps.length}`
              }
              className="px-0.5 text-center font-mono-tabular text-[10.5px] font-semibold leading-tight text-[#6E6E73]"
            >
              {walkthroughComplete
                ? `Fin · ${walkthroughState.steps.length}`
                : `Paso ${walkthroughState.steps.length}`}
            </span>

            <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

            <div className="flex flex-col items-center gap-0.5">
              <button
                type="button"
                onClick={() => applyZoomCentered(stepZoom(zoomRef.current, 'in'))}
                aria-label="Acercar lienzo"
                title="Acercar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-white/90"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <ZoomPercentInput
                zoom={zoom}
                onChangeZoom={applyZoomCentered}
                ariaLabel="Porcentaje de zoom del recorrido"
              />
              <button
                type="button"
                onClick={() => applyZoomCentered(stepZoom(zoomRef.current, 'out'))}
                aria-label="Alejar lienzo"
                title="Alejar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-white/90"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => fitCanvasToView(diagram)}
                aria-label="Restablecer zoom al 100% y centrar"
                title="Centrar al 100%"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E6E73] hover:bg-white/90 hover:text-[#1D1D1F]"
              >
                <LocateFixed className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setContextPopoverOpen((v) => !v)}
              aria-pressed={contextPopoverOpen}
              aria-label="Contexto del algoritmo"
              title="Contexto del algoritmo"
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                contextPopoverOpen
                  ? 'bg-[#0071E3] text-white'
                  : 'text-[#1D1D1F] hover:bg-white/90'
              }`}
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {!contextPopoverOpen && Boolean(diagram.clinicalContext?.summary) && (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0071E3]"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setWalkthroughPanelOpen((v) => !v)}
              aria-pressed={walkthroughPanelOpen}
              aria-label={walkthroughPanelOpen ? 'Ocultar Recorrido Guiado' : 'Mostrar Recorrido Guiado'}
              title="Recorrido Guiado"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                walkthroughPanelOpen
                  ? 'bg-[#1D1D1F] text-white'
                  : 'text-[#1D1D1F] hover:bg-white/90'
              }`}
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
        <div
          role="toolbar"
          aria-orientation="vertical"
          aria-label="Herramientas de diagramación"
          data-testid="generator-dock"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-[#E5E5EA] mac-study-dock px-2 py-2.5 mac-dock-shadow sm:right-5"
        >
          {/* Select / Pan */}
          <button
            type="button"
            onClick={() => {
              setTool('select');
              setConnectSourceId(null);
            }}
            aria-pressed={tool === 'select'}
            aria-label="Herramienta seleccionar"
            title="Seleccionar y arrastrar cuadros"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              tool === 'select'
                ? 'bg-[#1D1D1F] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <MousePointer2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setTool('pan');
              setConnectSourceId(null);
            }}
            aria-pressed={tool === 'pan'}
            aria-label="Herramienta mover lienzo"
            title="Mover lienzo"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              tool === 'pan'
                ? 'bg-[#1D1D1F] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <Hand className="h-4 w-4" />
          </button>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          {/* Formas Button with 3x3 Floating Shapes Popover opening to the left */}
          <div className="relative">
            <button
              type="button"
              data-testid="shapes-toolbar-btn"
              onClick={() => setShowAddNodeMenu((v) => !v)}
              aria-expanded={showAddNodeMenu}
              aria-label="Agregar forma al algoritmo"
              title="Formas"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                showAddNodeMenu
                  ? 'bg-[#1D1D1F] text-white'
                  : 'text-[#1D1D1F] hover:bg-white/90'
              }`}
            >
              <Square className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>

            {showAddNodeMenu && (
              <EditorShapesPopover onSelectShape={handleAddNode} />
            )}
          </div>

          {/* Conectar Tool + Left-side Connector Line Style Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (tool === 'connect') {
                  setTool('select');
                  setConnectSourceId(null);
                } else {
                  setTool('connect');
                  setConnectSourceId(null);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                  setEditingNodeId(null);
                  setShowAddNodeMenu(false);
                }
              }}
              aria-pressed={tool === 'connect'}
              aria-label="Conectar cuadros"
              title="Conectar cuadros"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                tool === 'connect'
                  ? 'bg-[#0071E3] text-white'
                  : 'text-[#1D1D1F] hover:bg-white/90'
              }`}
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            {tool === 'connect' && (
              <div className="mac-toast-in absolute right-full top-1/2 mr-3 flex -translate-y-1/2 items-center gap-0.5 rounded-xl border border-[#E5E5EA] mac-glass-strong p-1 mac-dock-shadow">
                {(['solid', 'straight', 'dashed'] as EdgeStyle[]).map((styleKey) => (
                  <button
                    key={styleKey}
                    type="button"
                    onClick={() => setConnectStyle(styleKey)}
                    aria-pressed={connectStyle === styleKey}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors whitespace-nowrap ${
                      connectStyle === styleKey
                        ? 'bg-[#1D1D1F] text-white'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {styleKey === 'solid' ? 'Sólida' : styleKey === 'straight' ? 'Recta' : 'Punteada'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comentario en recuadro seleccionado (Right Vertical Toolbar) */}
          <button
            type="button"
            data-testid="comment-toolbar-btn"
            onClick={handleToolbarCommentClick}
            aria-pressed={Boolean(commentingNodeId)}
            aria-label="Agregar o editar comentario del cuadro seleccionado"
            title={
              selectedNode
                ? selectedNode.comment
                  ? 'Editar comentario del cuadro seleccionado'
                  : 'Agregar comentario al cuadro seleccionado'
                : 'Selecciona un cuadro para agregar un comentario'
            }
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              commentingNodeId
                ? 'bg-[#0071E3] text-white'
                : selectedNode?.comment
                  ? 'bg-[#EFF6FF] text-[#0071E3] hover:bg-[#DBEAFE]'
                  : selectedNode
                    ? 'text-[#1D1D1F] hover:bg-white/90'
                    : 'text-[#8E8E93] hover:bg-white/90 hover:text-[#1D1D1F]'
            }`}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Contexto / Introducción del Algoritmo (Floating Popover Trigger) */}
          <button
            type="button"
            data-testid="context-toolbar-btn"
            onClick={() => {
              setContextPopoverOpen((prev) => {
                const next = !prev;
                if (next) {
                  setFormatPanelOpen(false);
                  setShowAddNodeMenu(false);
                  setCommentingNodeId(null);
                  setCommentAnchor(null);
                }
                return next;
              });
            }}
            aria-pressed={contextPopoverOpen}
            aria-label="Ver o editar contexto del algoritmo"
            title="Contexto del algoritmo"
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              contextPopoverOpen
                ? 'bg-[#0071E3] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {!contextPopoverOpen && Boolean(diagram.clinicalContext?.summary) && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0071E3]"
              />
            )}
          </button>

          {/* Formato Global & Paletas de Colores Button (Three Dots) */}
          <button
            type="button"
            data-testid="format-toolbar-btn"
            onClick={() => {
              setFormatPanelOpen((prev) => {
                const next = !prev;
                if (next) {
                  setSelectedTextTarget(null);
                  setShowAddNodeMenu(false);
                  setContextPopoverOpen(false);
                }
                return next;
              });
            }}
            aria-pressed={formatPanelOpen}
            aria-label="Formato global y paletas de colores"
            title="Formato y paletas de colores"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              formatPanelOpen
                ? 'bg-[#1D1D1F] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Auto-Layout Button */}
          <button
            type="button"
            onClick={handleAutoLayout}
            aria-label="Auto-Ordenar algoritmo"
            title="Auto-Ordenar y alinear cuadros"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#0071E3] transition-colors hover:bg-white/90"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          {/* Undo / Redo / Delete */}
          <button
            type="button"
            onClick={() => setHistory((h) => undoHistory(h))}
            disabled={history.past.length === 0}
            aria-label="Deshacer cambio"
            title="Deshacer (⌘Z)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setHistory((h) => redoHistory(h))}
            disabled={history.future.length === 0}
            aria-label="Rehacer cambio"
            title="Rehacer (⇧⌘Z)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleDeleteSelection}
            disabled={!selectedNodeId && !selectedEdgeId}
            aria-label="Eliminar elemento seleccionado"
            title="Eliminar (Delete)"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:opacity-35"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          {/* Zoom Controls with Manual Percentage Input */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => applyZoomCentered(stepZoom(zoomRef.current, 'in'))}
              aria-label="Acercar lienzo"
              title="Acercar"
              className="flex h-7 w-8 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-white/90"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <ZoomPercentInput
              zoom={zoom}
              onChangeZoom={applyZoomCentered}
              ariaLabel="Porcentaje de zoom del editor"
            />
            <button
              type="button"
              onClick={() => applyZoomCentered(stepZoom(zoomRef.current, 'out'))}
              aria-label="Alejar lienzo"
              title="Alejar"
              className="flex h-7 w-8 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-white/90"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fitCanvasToView(diagram)}
              aria-label="Restablecer zoom al 100% y centrar"
              title="Centrar al 100%"
              className="flex h-7 w-8 items-center justify-center rounded-lg text-[#6E6E73] hover:bg-white/90 hover:text-[#1D1D1F]"
            >
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="sr-only" aria-live="polite">
            {tool === 'connect' ? <GitBranch /> : null}
          </span>
        </div>
        )}
        </div>

        {/* Right Frosted Checklist & Summary Panel in Walkthrough Mode */}
        <WalkthroughPanel
          open={isWalkthrough && walkthroughPanelOpen}
          diagram={diagram}
          state={walkthroughState}
          currentNode={currentWalkthroughNode}
          availableEdges={walkthroughAvailableEdges}
          isComplete={walkthroughComplete}
          onSelectEdge={handleSelectWalkthroughEdge}
          onRewindToNode={handleRewindWalkthroughToNode}
          onStepBack={handleStepBackWalkthrough}
          onReset={handleResetWalkthrough}
          onClose={() => setWalkthroughPanelOpen(false)}
        />
      </div>
    </div>
  );
};
