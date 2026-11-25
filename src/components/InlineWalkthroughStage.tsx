import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ListChecks,
  LocateFixed,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import type { EditableDiagram } from '../types/algorithm';
import { clampZoom, stepZoom } from '../utils/algorithmLogic';
import { computeDiagramEdgeGeometries } from '../utils/diagramEngine';
import {
  computeAdaptiveNodeMetrics,
  DEFAULT_EDGE_LABEL_FONT_SIZE,
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
import { NodeShapeBackdrop } from './NodeShapeBackdrop';
import { OriginalImagePip } from './OriginalImagePip';
import { WalkthroughPanel } from './WalkthroughPanel';
import { ZoomPercentInput } from './ZoomPercentInput';

interface InlineWalkthroughStageProps {
  diagram: EditableDiagram;
  sourceImageDataUrl?: string;
  fallbackReference?: string;
  title: string;
}

export const InlineWalkthroughStage: React.FC<InlineWalkthroughStageProps> = ({
  diagram,
  sourceImageDataUrl,
  fallbackReference,
  title,
}) => {
  const [walkthroughState, setWalkthroughState] = useState<WalkthroughState>(() =>
    createInitialWalkthrough(diagram)
  );
  const [panelOpen, setPanelOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const panStartRef = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const fitCanvasToView = useCallback((target: EditableDiagram) => {
    const vp = viewportRef.current;
    if (!vp || target.nodes.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of target.nodes) {
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

    // Always start each algorithm at 100% zoom
    const nextZoom = 1;
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // On wide desktop screens, center cleanly inside the unobstructed canvas between the left floating panel and right dock
    const leftPanelReserve = vpW >= 1040 ? 375 : 0;
    const rightDockReserve = 76;
    const openAreaWidth = vpW - leftPanelReserve - rightDockReserve;
    const targetCenterX =
      leftPanelReserve > 0 && contentW + 64 <= openAreaWidth
        ? leftPanelReserve + openAreaWidth / 2
        : (vpW - rightDockReserve) / 2;

    const nextPan = {
      x: Math.round(targetCenterX - contentCenterX * nextZoom),
      y:
        contentH + 64 <= vpH
          ? Math.round(vpH / 2 - contentCenterY * nextZoom)
          : Math.round(32 - minY * nextZoom),
    };

    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const applyZoomCentered = useCallback((rawZoom: number) => {
    const nextZoom = clampZoom(rawZoom);
    const vp = viewportRef.current;
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
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
    }
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  // Reset walkthrough & center at 100% zoom whenever diagram switches
  useEffect(() => {
    setWalkthroughState(createInitialWalkthrough(diagram));
    const timer = window.setTimeout(() => fitCanvasToView(diagram), 30);
    return () => window.clearTimeout(timer);
  }, [diagram, fitCanvasToView]);

  // Cursor-centered wheel zoom
  useEffect(() => {
    const vp = viewportRef.current;
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
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0) scale(${nextZoom})`;
      }
      setZoom(nextZoom);
      setPan(nextPan);
    };

    vp.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const globalFontScale = diagram.fontScale ?? 1;
  const globalPaletteId = diagram.paletteId ?? 'original';
  const globalColorMode = diagram.colorMode ?? 'color';

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

  const edgeGeometries = useMemo(
    () => computeDiagramEdgeGeometries(renderedNodes, diagram.edges),
    [renderedNodes, diagram.edges]
  );

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
    const PAD = 2400;
    return {
      x: Math.floor(minX - PAD),
      y: Math.floor(minY - PAD),
      width: Math.ceil(maxX - minX + PAD * 2),
      height: Math.ceil(maxY - minY + PAD * 2),
    };
  }, [renderedNodes]);

  const currentNodeId = getCurrentNodeId(walkthroughState);
  const currentNode = currentNodeId ? nodeMap.get(currentNodeId) ?? null : null;

  const availableEdges = useMemo(
    () => getAvailableOutgoingEdges(diagram, walkthroughState),
    [diagram, walkthroughState]
  );
  const currentOutgoingEdgeIds = useMemo(
    () => new Set(availableEdges.map((e) => e.id)),
    [availableEdges]
  );
  const selectableEdgeIds = useMemo(
    () => getSelectableEdgeIds(diagram, walkthroughState),
    [diagram, walkthroughState]
  );
  const visitedEdgeIds = useMemo(
    () =>
      new Set(
        walkthroughState.steps
          .map((s) => s.viaEdgeId)
          .filter((id): id is string => Boolean(id))
      ),
    [walkthroughState]
  );
  const stepIndexByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    walkthroughState.steps.forEach((step, idx) => {
      map.set(step.nodeId, idx);
    });
    return map;
  }, [walkthroughState]);
  const complete = useMemo(
    () => isWalkthroughComplete(diagram, walkthroughState),
    [diagram, walkthroughState]
  );

  const handleSelectEdge = useCallback(
    (edgeId: string) => {
      setWalkthroughState((prev) => selectWalkthroughEdge(diagram, prev, edgeId));
    },
    [diagram]
  );

  const handleRewindToNode = useCallback((nodeId: string) => {
    setWalkthroughState((prev) => rewindWalkthroughToNode(prev, nodeId));
  }, []);

  const handleStepBack = useCallback(() => {
    setWalkthroughState((prev) => stepBackWalkthrough(prev));
  }, []);

  const handleReset = useCallback(() => {
    setWalkthroughState(createInitialWalkthrough(diagram));
  }, [diagram]);

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
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

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = panStartRef.current;
    if (!session) return;
    const nextX = session.originX + (e.clientX - session.x);
    const nextY = session.originY + (e.clientY - session.y);
    session.currentX = nextX;
    session.currentY = nextY;
    panRef.current = { x: nextX, y: nextY };
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0) scale(${zoomRef.current})`;
    }
    if (viewportRef.current) {
      viewportRef.current.style.backgroundPosition = `${nextX}px ${nextY}px`;
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = panStartRef.current;
    if (!session) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    panStartRef.current = null;
    setIsPanning(false);
    setPan({ x: session.currentX, y: session.currentY });
  };

  return (
    <div
      data-testid="inline-walkthrough-stage"
      className="relative flex min-h-0 flex-1 overflow-hidden bg-white"
    >
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <OriginalImagePip
          imageDataUrl={sourceImageDataUrl}
          title={title}
          className="bottom-4 right-20 sm:bottom-5 sm:right-24"
        />

        <div
          ref={viewportRef}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={handleViewportPointerUp}
          style={{
            backgroundImage: 'radial-gradient(circle, #D8D8DF 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          className={`relative flex-1 overflow-hidden bg-[#FCFCFE] select-none touch-none ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          <div
            ref={worldRef}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: '0 0',
              transition: isPanning
                ? 'none'
                : 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="absolute left-0 top-0 will-change-transform"
          >
            {/* Interactive Edges Layer */}
            <svg
              width={svgBounds.width}
              height={svgBounds.height}
              viewBox={`${svgBounds.x} ${svgBounds.y} ${svgBounds.width} ${svgBounds.height}`}
              style={{
                left: svgBounds.x,
                top: svgBounds.y,
                width: svgBounds.width,
                height: svgBounds.height,
              }}
              className="pointer-events-none absolute overflow-visible"
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
                    id={`iw-arrow-${hex.replace('#', '')}`}
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

              {diagram.edges.map((edge) => {
                const geom = edgeGeometries.get(edge.id);
                if (!geom) return null;

                const isVisitedEdge = visitedEdgeIds.has(edge.id);
                const isCurrentChoiceEdge = currentOutgoingEdgeIds.has(edge.id);
                const isAlternativeBranchEdge =
                  !isCurrentChoiceEdge && selectableEdgeIds.has(edge.id);
                const isSelectableEdge = isCurrentChoiceEdge || isAlternativeBranchEdge;

                const themedStrokeColor = resolveEdgeColor(
                  geom.strokeColor,
                  globalPaletteId,
                  globalColorMode
                );
                const strokeColor = isVisitedEdge
                  ? geom.strokeColor === '#15803D' || geom.strokeColor === '#B45309'
                    ? themedStrokeColor
                    : '#0071E3'
                  : isCurrentChoiceEdge
                    ? '#0071E3'
                    : themedStrokeColor;

                const markerId = `iw-arrow-${strokeColor.replace('#', '')}`;

                const edgeOpacity = isVisitedEdge
                  ? 1
                  : isCurrentChoiceEdge
                    ? 0.92
                    : isAlternativeBranchEdge
                      ? 0.34
                      : 0.16;

                const strokeWidth = isVisitedEdge ? 3.4 : isCurrentChoiceEdge ? 2.5 : 2;

                return (
                  <g
                    key={edge.id}
                    style={{ opacity: edgeOpacity, transition: 'opacity 220ms ease' }}
                    className={`pointer-events-auto ${
                      isSelectableEdge ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {isVisitedEdge && (
                      <path
                        d={geom.pathD}
                        fill="none"
                        stroke={strokeColor}
                        strokeOpacity="0.18"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    <path
                      d={geom.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="20"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (isSelectableEdge) handleSelectEdge(edge.id);
                      }}
                    />
                    <path
                      d={geom.pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={geom.isDashed ? '6 5' : undefined}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      markerEnd={`url(#${markerId})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (isSelectableEdge) handleSelectEdge(edge.id);
                      }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Clickable Decision Edge Badges */}
            {diagram.edges.map((edge) => {
              const geom = edgeGeometries.get(edge.id);
              if (!geom) return null;

              const isVisitedEdge = visitedEdgeIds.has(edge.id);
              const isCurrentChoiceEdge = currentOutgoingEdgeIds.has(edge.id);
              const isAlternativeBranchEdge =
                !isCurrentChoiceEdge && selectableEdgeIds.has(edge.id);
              const isSelectableEdge = isCurrentChoiceEdge || isAlternativeBranchEdge;
              const hasLabel = edge.label.trim().length > 0;

              if (!hasLabel && !isCurrentChoiceEdge) return null;

              const labelOpacity =
                isVisitedEdge || isCurrentChoiceEdge
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
                  key={`iw-label-${edge.id}`}
                  type="button"
                  data-testid={`inline-walkthrough-edge-btn-${edge.id}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelectableEdge) {
                      handleSelectEdge(edge.id);
                    }
                  }}
                  style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${geom.labelX}px, ${geom.labelY}px, 0) translate(-50%, -50%)`,
                    opacity: labelOpacity * edgeCustomOpacity,
                    fontSize: `${edgeLabelFontSize}px`,
                    ...(!isCurrentChoiceEdge && !isAlternativeBranchEdge && !isVisitedEdge
                      ? {
                          backgroundColor: badgeColors.fill,
                          color: badgeColors.text,
                          borderColor: '#FFFFFF',
                        }
                      : {}),
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
              const usesCustomVector = isCustomSvgShape(node.shape);
              const innerPadding = getShapeInnerPadding(node.shape);
              const hasComment = Boolean(node.comment?.trim());
              const borderRadius =
                node.shape === 'pill'
                  ? `${Math.round(node.height / 2)}px`
                  : node.shape === 'decision'
                    ? '18px'
                    : '14px';

              const stepIndex = stepIndexByNodeId.get(node.id);
              const isVisitedNode = stepIndex !== undefined;
              const isCurrentNode = node.id === currentNodeId;
              const isCurrentChoiceTarget =
                !isVisitedNode &&
                diagram.edges.some(
                  (edge) => edge.to === node.id && currentOutgoingEdgeIds.has(edge.id)
                );
              const isAlternativeTarget =
                !isVisitedNode &&
                !isCurrentChoiceTarget &&
                diagram.edges.some(
                  (edge) => edge.to === node.id && selectableEdgeIds.has(edge.id)
                );
              const isSelectableTarget = isCurrentChoiceTarget || isAlternativeTarget;

              const nodeOpacity = isVisitedNode
                ? 1
                : isCurrentChoiceTarget
                  ? 0.94
                  : isAlternativeTarget
                    ? 0.34
                    : 0.2;

              const resolvedBorderColor =
                isCurrentNode || isVisitedNode ? '#0071E3' : toneStyle.stroke;
              const resolvedBorderWidth =
                isCurrentNode || isVisitedNode || node.shape === 'decision' ? 2 : 1.5;

              return (
                <div
                  key={node.id}
                  data-testid={`inline-walkthrough-node-${node.id}`}
                  data-walkthrough-state={
                    isCurrentNode
                      ? 'active'
                      : isVisitedNode
                        ? 'visited'
                        : isSelectableTarget
                          ? 'available'
                          : 'dimmed'
                  }
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    if (isVisitedNode) {
                      handleRewindToNode(node.id);
                      return;
                    }
                    const matchingEdge = diagram.edges.find(
                      (edge) => edge.to === node.id && selectableEdgeIds.has(edge.id)
                    );
                    if (matchingEdge) {
                      handleSelectEdge(matchingEdge.id);
                    }
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
                          boxShadow: isCurrentNode
                            ? '0 0 0 4px rgba(0, 113, 227, 0.22), 0 14px 30px -12px rgba(0, 113, 227, 0.28)'
                            : isVisitedNode
                              ? '0 8px 22px -10px rgba(0, 113, 227, 0.18)'
                              : '0 2px 8px -4px rgba(29,29,31,0.08)',
                        }),
                  }}
                  className={`absolute flex flex-col items-center justify-center text-center transition-[opacity,box-shadow,border-color,background-color] duration-150 ${
                    usesCustomVector ? '' : 'border'
                  } ${
                    isVisitedNode || isSelectableTarget ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {usesCustomVector && (
                    <NodeShapeBackdrop
                      shape={node.shape}
                      width={node.width}
                      height={node.height}
                      fill={toneStyle.fill}
                      stroke={resolvedBorderColor}
                      strokeWidth={resolvedBorderWidth}
                      highlightRing={isCurrentNode}
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

                  {hasComment && (
                    <span
                      title={`Comentario: ${node.comment}`}
                      className="pointer-events-auto absolute -left-2 -top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-[#0071E3]/40 bg-white text-[#0071E3] shadow-xs"
                    >
                      <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />
                    </span>
                  )}

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

                  <div className="pointer-events-none relative z-10 flex flex-col items-center justify-center gap-1 overflow-hidden">
                    <p
                      style={{
                        color: toneStyle.titleColor,
                        fontSize: `${metrics.titleFontSize}px`,
                        opacity: metrics.titleOpacity,
                      }}
                      className="font-bold leading-snug tracking-[-0.01em]"
                    >
                      {node.title}
                    </p>
                    {node.body && (
                      <p
                        style={{
                          color: toneStyle.bodyColor,
                          fontSize: `${metrics.bodyFontSize}px`,
                          opacity: metrics.bodyOpacity,
                        }}
                        className="font-medium leading-snug"
                      >
                        {node.body}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right-Side Vertical Floating Walkthrough Dock */}
        <div
          role="toolbar"
          aria-orientation="vertical"
          aria-label="Controles de recorrido del algoritmo"
          data-testid="inline-walkthrough-dock"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-4 top-1/2 z-30 flex max-h-[calc(100%-2rem)] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[#E5E5EA] mac-study-dock px-2 py-2.5 mac-dock-shadow sm:right-5"
        >
          <button
            type="button"
            onClick={handleStepBack}
            disabled={walkthroughState.steps.length <= 1}
            aria-label="Paso anterior del recorrido"
            title="Paso anterior"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={walkthroughState.steps.length <= 1}
            aria-label="Reiniciar recorrido"
            title="Reiniciar recorrido"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          <span
            title={
              complete
                ? `Final · ${walkthroughState.steps.length} pasos`
                : `Paso ${walkthroughState.steps.length}`
            }
            className="px-0.5 text-center font-mono-tabular text-[10.5px] font-semibold leading-tight text-[#6E6E73]"
          >
            {complete ? `Fin · ${walkthroughState.steps.length}` : `Paso ${walkthroughState.steps.length}`}
          </span>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          {/* Vertical Zoom Controls with Manual Percentage Input */}
          <div className="flex flex-col items-center gap-0.5">
            <button
              type="button"
              onClick={() => applyZoomCentered(stepZoom(zoomRef.current, 'in'))}
              aria-label="Acercar lienzo"
              title="Acercar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90"
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
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => fitCanvasToView(diagram)}
              aria-label="Restablecer zoom al 100% y centrar"
              title="Centrar al 100%"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E6E73] transition-colors hover:bg-white/90 hover:text-[#1D1D1F]"
            >
              <LocateFixed className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="my-0.5 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setContextOpen((v) => !v)}
            aria-pressed={contextOpen}
            aria-label="Ver contexto del algoritmo"
            title="Contexto del algoritmo"
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              contextOpen
                ? 'bg-[#0071E3] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {!contextOpen && Boolean(diagram.clinicalContext?.summary || diagram.subtitle) && (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0071E3]"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            aria-pressed={panelOpen}
            aria-label={panelOpen ? 'Ocultar panel Recorrido Guiado' : 'Mostrar panel Recorrido Guiado'}
            title="Recorrido Guiado"
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              panelOpen
                ? 'bg-[#1D1D1F] text-white'
                : 'text-[#1D1D1F] hover:bg-white/90'
            }`}
          >
            <ListChecks className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Floating Algorithm Context / Introduction Popover */}
        <AlgorithmContextPopover
          open={contextOpen}
          context={diagram.clinicalContext}
          fallbackSubtitle={diagram.subtitle}
          fallbackReference={diagram.reference ?? fallbackReference}
          editable={false}
          onClose={() => setContextOpen(false)}
        />
      </div>

      {/* Right Checklist & Active Step Panel */}
      <WalkthroughPanel
        open={panelOpen}
        diagram={diagram}
        state={walkthroughState}
        currentNode={currentNode}
        availableEdges={availableEdges}
        isComplete={complete}
        onSelectEdge={handleSelectEdge}
        onRewindToNode={handleRewindToNode}
        onStepBack={handleStepBack}
        onReset={handleReset}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
};
