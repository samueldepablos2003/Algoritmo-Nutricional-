import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Eraser,
  Eye,
  Hand,
  Highlighter,
  Loader2,
  Minus,
  NotebookPen,
  Pencil,
  Plus,
  RotateCcw,
  Route,
  Save,
  Undo2,
  X,
} from 'lucide-react';
import {
  HIGHLIGHTER_COLORS,
  type AlgorithmItem,
  type CardOriginRect,
  type EditableDiagram,
  type HighlightColor,
  type HighlightStroke,
  type NormalizedPoint,
} from '../types/algorithm';
import {
  appendStroke,
  clampZoom,
  stepZoom,
  undoLastStroke,
} from '../utils/algorithmLogic';
import { AlgorithmContextPopover } from './AlgorithmContextPopover';
import { AlgorithmGenerator } from './AlgorithmGenerator';
import { InlineWalkthroughStage } from './InlineWalkthroughStage';
import { OriginalImagePip } from './OriginalImagePip';
import { ZoomPercentInput } from './ZoomPercentInput';

interface QuickLookViewerProps {
  algorithms: AlgorithmItem[];
  activeIndex: number | null;
  originRect: CardOriginRect | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onUpdateAlgorithm: (updated: AlgorithmItem) => void;
  onSaveEditedAlgorithm?: (payload: {
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
  onEditDiagram?: (algorithm: AlgorithmItem) => void;
  onEditMetadata?: (algorithm: AlgorithmItem) => void;
  onDigitizeAlgorithm?: (algorithm: AlgorithmItem) => void;
  isDigitizing?: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

type ToolMode = 'pan' | 'highlight';
type ViewerMode = 'view' | 'walkthrough' | 'edit';

function renderStrokesToCanvas(
  canvas: HTMLCanvasElement,
  strokes: HighlightStroke[],
  activeStroke: HighlightStroke | null
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(rect.width * dpr);
  const targetHeight = Math.round(rect.height * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const allStrokes = activeStroke ? [...strokes, activeStroke] : strokes;

  for (const stroke of allStrokes) {
    if (stroke.points.length === 0) continue;
    const style = HIGHLIGHTER_COLORS[stroke.color] ?? HIGHLIGHTER_COLORS.yellow;
    const pixelWidth = Math.max(8, stroke.width * rect.width);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = pixelWidth;
    ctx.strokeStyle = style.stroke;

    ctx.beginPath();
    const first = stroke.points[0];
    ctx.moveTo(first.x * rect.width, first.y * rect.height);

    if (stroke.points.length === 1) {
      ctx.lineTo(first.x * rect.width + 0.1, first.y * rect.height + 0.1);
    } else {
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

export const QuickLookViewer: React.FC<QuickLookViewerProps> = ({
  algorithms,
  activeIndex,
  onClose,
  onNavigate,
  onUpdateAlgorithm,
  onSaveEditedAlgorithm,
  onEditDiagram,
  onEditMetadata,
  onDigitizeAlgorithm,
  isDigitizing = false,
}) => {
  const isOpen = activeIndex !== null && activeIndex >= 0 && activeIndex < algorithms.length;
  const currentAlgorithm = isOpen ? algorithms[activeIndex] : null;
  const canNavigate = algorithms.length > 1;

  const [viewerMode, setViewerMode] = useState<ViewerMode>('view');
  const [navDirection, setNavDirection] = useState<'none' | 'next' | 'prev'>('none');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<ToolMode>('pan');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');
  const [showNotes, setShowNotes] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saved'>('idle');
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [activeStroke, setActiveStroke] = useState<HighlightStroke | null>(null);

  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null
  );
  const drawingStrokeRef = useRef<HighlightStroke | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const notesTimerRef = useRef<number | null>(null);
  const editSaveHandlerRef = useRef<(() => Promise<void>) | null>(null);

  const handleClose = useCallback(() => {
    setNavDirection('none');
    setViewerMode('view');
    onClose();
  }, [onClose]);

  // Reset transform, notes draft, and inline mode when switching algorithms or reopening
  useEffect(() => {
    if (!currentAlgorithm) return;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNotesDraft(currentAlgorithm.notes);
    setNoteSaveState('idle');
    setEditTitleDraft(currentAlgorithm.title);
    setIsSavingEdit(false);
    setActiveStroke(null);
    drawingStrokeRef.current = null;
    setShowContext(false);
    setViewerMode('view');
  }, [currentAlgorithm?.id, isOpen]);

  // Prevent background page scroll while full-screen viewer is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!canNavigate) return;
      setNavDirection(direction);
      onNavigate(direction);
    },
    [canNavigate, onNavigate]
  );

  const handleUndoStroke = useCallback(() => {
    if (!currentAlgorithm || currentAlgorithm.strokes.length === 0) return;
    onUpdateAlgorithm({
      ...currentAlgorithm,
      strokes: undoLastStroke(currentAlgorithm.strokes),
      updatedAt: Date.now(),
    });
  }, [currentAlgorithm, onUpdateAlgorithm]);

  const handleClearStrokes = useCallback(() => {
    if (!currentAlgorithm || currentAlgorithm.strokes.length === 0) return;
    onUpdateAlgorithm({
      ...currentAlgorithm,
      strokes: [],
      updatedAt: Date.now(),
    });
  }, [currentAlgorithm, onUpdateAlgorithm]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts: Esc, ArrowLeft/Right, Ctrl/Cmd+Z, +, -, 0
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'TEXTAREA' ||
          target.tagName === 'INPUT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (viewerMode === 'edit') {
          // Let the embedded diagram editor handle Escape for node editing / selection
          return;
        }
        e.preventDefault();
        if (viewerMode === 'walkthrough') {
          setViewerMode('view');
        } else {
          handleClose();
        }
        return;
      }

      if (isTyping) return;

      if (e.key === 'ArrowRight' && viewerMode === 'view') {
        e.preventDefault();
        handleNavigate('next');
      } else if (e.key === 'ArrowLeft' && viewerMode === 'view') {
        e.preventDefault();
        handleNavigate('prev');
      } else if (viewerMode === 'view' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoStroke();
      } else if (viewerMode === 'view' && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setZoom((z) => stepZoom(z, 'in'));
      } else if (viewerMode === 'view' && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        setZoom((z) => stepZoom(z, 'out'));
      } else if (viewerMode === 'view' && e.key === '0') {
        e.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewerMode, handleClose, handleNavigate, handleUndoStroke, resetView]);

  // Redraw highlighter canvas whenever strokes, activeStroke, zoom, mode, or container size changes
  useLayoutEffect(() => {
    if (!isOpen || viewerMode !== 'view' || !currentAlgorithm || !canvasRef.current) return;
    renderStrokesToCanvas(canvasRef.current, currentAlgorithm.strokes, activeStroke);
  }, [isOpen, viewerMode, currentAlgorithm, activeStroke, zoom, showNotes]);

  useEffect(() => {
    if (!isOpen || viewerMode !== 'view' || !imageContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (canvasRef.current && currentAlgorithm) {
        renderStrokesToCanvas(
          canvasRef.current,
          currentAlgorithm.strokes,
          drawingStrokeRef.current
        );
      }
    });
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [isOpen, viewerMode, currentAlgorithm]);

  if (!isOpen || !currentAlgorithm) return null;

  const isInlineWalkthrough = viewerMode === 'walkthrough' && Boolean(currentAlgorithm.diagram);
  const isInlineEdit = viewerMode === 'edit' && Boolean(currentAlgorithm.diagram);
  const isViewMode = !isInlineWalkthrough && !isInlineEdit;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => clampZoom(z + factor));
  };

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'pan') return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy,
    });
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsPanning(false);
    panStartRef.current = null;
  };

  const getNormalizedPoint = (
    e: React.PointerEvent<HTMLCanvasElement>
  ): NormalizedPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'highlight' || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getNormalizedPoint(e);
    if (!point) return;

    const stroke: HighlightStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      color: highlightColor,
      width: 0.022,
      points: [point],
    };
    drawingStrokeRef.current = stroke;
    setActiveStroke(stroke);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== 'highlight' || !drawingStrokeRef.current) return;
    e.stopPropagation();
    const point = getNormalizedPoint(e);
    if (!point) return;

    const current = drawingStrokeRef.current;
    const last = current.points[current.points.length - 1];
    const distSq = (point.x - last.x) ** 2 + (point.y - last.y) ** 2;
    if (distSq < 0.00001) return;

    const updated: HighlightStroke = {
      ...current,
      points: [...current.points, point],
    };
    drawingStrokeRef.current = updated;
    setActiveStroke(updated);
  };

  const finishCanvasStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingStrokeRef.current) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const finished = drawingStrokeRef.current;
    drawingStrokeRef.current = null;
    setActiveStroke(null);

    onUpdateAlgorithm({
      ...currentAlgorithm,
      strokes: appendStroke(currentAlgorithm.strokes, finished),
      updatedAt: Date.now(),
    });
  };

  const handleNotesChange = (value: string) => {
    setNotesDraft(value);
    setNoteSaveState('idle');
    if (notesTimerRef.current) {
      window.clearTimeout(notesTimerRef.current);
    }
    const snapshotAlgo = currentAlgorithm;
    notesTimerRef.current = window.setTimeout(() => {
      onUpdateAlgorithm({
        ...snapshotAlgo,
        notes: value,
        updatedAt: Date.now(),
      });
      setNoteSaveState('saved');
    }, 240);
  };

  const zoomPercent = Math.round(zoom * 100);
  const strokeCount = currentAlgorithm.strokes.length;
  const slideAnimClass =
    navDirection === 'next'
      ? 'mac-slide-next-in'
      : navDirection === 'prev'
        ? 'mac-slide-prev-in'
        : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Algoritmo: ${currentAlgorithm.title}`}
      data-testid="algorithm-fullscreen-viewer"
      className="fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden bg-white text-[#1D1D1F]"
    >
      {/* Unified Full-Width Top Header Bar */}
      <header className="z-20 mt-[20px] flex shrink-0 items-center justify-between gap-4 border-b border-[#E5E5EA] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Volver a la biblioteca"
            title="Volver a la biblioteca (Esc)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E5E5EA] bg-[#FAFAFC] text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            {isInlineEdit ? (
              <input
                type="text"
                value={editTitleDraft}
                onChange={(e) => setEditTitleDraft(e.target.value)}
                aria-label="Título del algoritmo"
                placeholder="Nombre del algoritmo clínico..."
                className="-ml-1.5 w-full max-w-[540px] rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-[17px] font-bold leading-tight tracking-[-0.02em] text-[#1D1D1F] transition-colors hover:border-[#E5E5EA] hover:bg-[#FAFAFC] focus:border-[#0071E3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15 sm:text-[20px]"
              />
            ) : (
              <h1 className="truncate text-[17px] font-bold leading-tight tracking-[-0.02em] text-[#1D1D1F] sm:text-[20px]">
                {currentAlgorithm.title}
              </h1>
            )}
          </div>
        </div>

        {/* Right Controls: Optional Save (in Edit mode) + Persistent 4 Icon-Only Buttons */}
        <div className="flex shrink-0 items-center gap-2.5">
          {isInlineEdit && (
            <button
              type="button"
              data-testid="viewer-inline-save-btn"
              disabled={isSavingEdit}
              onClick={() => void editSaveHandlerRef.current?.()}
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#0071E3] px-3.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,113,227,0.3)] transition-colors hover:bg-[#0077ED] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-1"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{isSavingEdit ? 'Guardando…' : 'Guardar'}</span>
            </button>
          )}

          <div
            role="toolbar"
            aria-label="Acciones del algoritmo"
            className="flex shrink-0 items-center gap-2"
          >
            {/* 1. Algoritmo (Ojo) */}
            <button
              type="button"
              data-testid="viewer-algorithm-btn"
              aria-pressed={isViewMode}
              aria-label="Ver algoritmo"
              title="Algoritmo"
              onClick={() => setViewerMode('view')}
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                isViewMode
                  ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
                  : 'border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D1D1D6] hover:bg-[#F5F5F7]'
              }`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* 2. Recorrido */}
            <button
              type="button"
              data-testid="viewer-inline-walkthrough-btn"
              disabled={!currentAlgorithm.diagram && (!onDigitizeAlgorithm || isDigitizing)}
              aria-pressed={isInlineWalkthrough}
              aria-label={
                currentAlgorithm.diagram
                  ? 'Iniciar recorrido del algoritmo'
                  : 'Digitalizar algoritmo para recorrido'
              }
              title={
                currentAlgorithm.diagram
                  ? 'Recorrido'
                  : isDigitizing
                    ? 'Digitalizando algoritmo…'
                    : 'Convertir imagen para recorrido'
              }
              onClick={() => {
                if (currentAlgorithm.diagram) {
                  setViewerMode('walkthrough');
                } else if (onDigitizeAlgorithm) {
                  onDigitizeAlgorithm(currentAlgorithm);
                }
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                isInlineWalkthrough
                  ? 'border-[#0071E3] bg-[#0071E3] text-white'
                  : 'border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D1D1D6] hover:bg-[#F5F5F7]'
              }`}
            >
              {isDigitizing && !currentAlgorithm.diagram ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Route className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* 3. Editar */}
            <button
              type="button"
              data-testid="viewer-edit-btn"
              aria-pressed={isInlineEdit}
              aria-label="Editar algoritmo"
              title="Editar"
              onClick={() => {
                if (currentAlgorithm.diagram) {
                  if (onSaveEditedAlgorithm) {
                    setEditTitleDraft(currentAlgorithm.title);
                    setViewerMode('edit');
                  } else if (onEditDiagram) {
                    onEditDiagram(currentAlgorithm);
                  }
                } else if (onEditMetadata) {
                  onEditMetadata(currentAlgorithm);
                }
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                isInlineEdit
                  ? 'border-[#0071E3] bg-[#0071E3] text-white'
                  : 'border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D1D1D6] hover:bg-[#F5F5F7]'
              }`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* 4. Notas */}
            <button
              type="button"
              data-testid="viewer-notes-btn"
              onClick={() => setShowNotes((v) => !v)}
              aria-expanded={showNotes}
              aria-pressed={showNotes}
              aria-label={showNotes ? 'Ocultar notas clínicas' : 'Mostrar notas clínicas'}
              title="Notas"
              className={`flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                showNotes
                  ? 'border-[#0071E3] bg-[#0071E3] text-white'
                  : 'border-[#E5E5EA] bg-white text-[#1D1D1F] hover:border-[#D1D1D6] hover:bg-[#F5F5F7]'
              }`}
            >
              <NotebookPen className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Inline Editor, Inline Walkthrough, OR Full-Bleed Algorithm Canvas + Retractable Notes */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-white">
        {isInlineEdit && currentAlgorithm.diagram ? (
          <AlgorithmGenerator
            key={`inline-edit-${currentAlgorithm.id}`}
            embedded
            initialAlgorithm={currentAlgorithm}
            initialMode="edit"
            openAiDrawerInitially={false}
            externalTitle={editTitleDraft}
            saveHandlerRef={editSaveHandlerRef}
            onSavingChange={setIsSavingEdit}
            onBack={() => setViewerMode('view')}
            onSaveToLibrary={async (payload) => {
              if (onSaveEditedAlgorithm) {
                await onSaveEditedAlgorithm(payload);
              }
            }}
          />
        ) : isInlineWalkthrough && currentAlgorithm.diagram ? (
          <InlineWalkthroughStage
            key={currentAlgorithm.id}
            diagram={currentAlgorithm.diagram}
            sourceImageDataUrl={
              currentAlgorithm.sourceImageDataUrl ?? currentAlgorithm.diagram.sourceImageDataUrl
            }
            fallbackReference={currentAlgorithm.reference}
            title={currentAlgorithm.title}
          />
        ) : (
          /* Full-Bleed Seamless Algorithm Stage (no inner card division) */
          <div
            onWheel={handleWheel}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={handleStagePointerUp}
            data-testid="quicklook-stage"
            data-zoom={zoomPercent}
            data-tool={tool}
            className={`relative flex flex-1 items-center justify-center overflow-hidden bg-white select-none touch-none ${
              tool === 'pan'
                ? isPanning
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-crosshair'
            }`}
          >
            {/* Floating Corner Original Image Reference when viewing a digitized diagram */}
            <OriginalImagePip
              imageDataUrl={
                currentAlgorithm.sourceImageDataUrl ?? currentAlgorithm.diagram?.sourceImageDataUrl
              }
              title={currentAlgorithm.title}
              className="top-4 left-4"
            />

            {/* Seamless Edge-to-Edge Algorithm Surface with Zoom/Pan Transform */}
            <div
              key={currentAlgorithm.id}
              className={`flex h-full w-full items-center justify-center py-4 pl-6 pr-20 sm:py-5 sm:pl-10 sm:pr-24 ${slideAnimClass}`}
            >
              <div
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transition: isPanning
                    ? 'none'
                    : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="relative flex h-full w-full items-center justify-center will-change-transform"
              >
                <div ref={imageContainerRef} className="relative inline-block max-h-full max-w-full">
                  <img
                    src={currentAlgorithm.imageDataUrl}
                    alt={currentAlgorithm.title}
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onLoad={() => {
                      if (canvasRef.current) {
                        renderStrokesToCanvas(
                          canvasRef.current,
                          currentAlgorithm.strokes,
                          drawingStrokeRef.current
                        );
                      }
                    }}
                    className="block max-h-[calc(100vh-116px)] max-w-full object-contain pointer-events-none select-none"
                  />

                  {/* Non-destructive Fluorescent Highlighter Canvas Overlay */}
                  <canvas
                    ref={canvasRef}
                    data-testid="highlighter-canvas"
                    data-stroke-count={strokeCount}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={finishCanvasStroke}
                    onPointerCancel={finishCanvasStroke}
                    className={`absolute inset-0 h-full w-full mix-blend-multiply ${
                      tool === 'highlight'
                        ? 'pointer-events-auto cursor-crosshair'
                        : 'pointer-events-none'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Right-Side Vertical Floating macOS Dock Toolbar */}
            <div
              role="toolbar"
              aria-orientation="vertical"
              aria-label="Herramientas del visor"
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-4 top-1/2 z-30 flex max-h-[calc(100%-2rem)] -translate-y-1/2 flex-col items-center gap-1 overflow-y-auto rounded-2xl border border-[#E5E5EA] mac-glass-strong px-2 py-2.5 mac-dock-shadow sm:right-5"
            >
              {/* Zoom Controls */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => stepZoom(z, 'in'))}
                  aria-label="Acercar zoom"
                  title="Acercar (+)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <ZoomPercentInput
                  zoom={zoom}
                  onChangeZoom={(next) => setZoom(clampZoom(next))}
                  ariaLabel="Porcentaje de zoom del algoritmo"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => stepZoom(z, 'out'))}
                  aria-label="Alejar zoom"
                  title="Alejar (−)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  aria-label="Restablecer vista a 100%"
                  title="Restablecer zoom y posición"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6E6E73] transition-colors hover:bg-white/90 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="my-1 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

              {/* Pan vs Highlighter Mode Switch */}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => setTool('pan')}
                  aria-pressed={tool === 'pan'}
                  aria-label="Modo mover imagen"
                  title="Mover / Panear imagen"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                    tool === 'pan'
                      ? 'bg-[#1D1D1F] text-white'
                      : 'text-[#1D1D1F] hover:bg-white/90'
                  }`}
                >
                  <Hand className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setTool((t) => (t === 'highlight' ? 'pan' : 'highlight'))}
                  aria-pressed={tool === 'highlight'}
                  aria-label="Activar resaltador fluorescente"
                  title="Resaltar"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                    tool === 'highlight'
                      ? 'bg-[#0071E3] text-white'
                      : 'text-[#1D1D1F] hover:bg-white/90'
                  }`}
                >
                  <Highlighter className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* 3 Soft Fluorescent Swatches */}
              <div
                className="flex flex-col items-center gap-1 py-0.5"
                role="group"
                aria-label="Color del resaltador"
              >
                {(['yellow', 'mint', 'sky'] as HighlightColor[]).map((colorKey) => {
                  const spec = HIGHLIGHTER_COLORS[colorKey];
                  const selected = highlightColor === colorKey && tool === 'highlight';
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => {
                        setHighlightColor(colorKey);
                        setTool('highlight');
                      }}
                      aria-label={`Color ${spec.label}`}
                      aria-pressed={selected}
                      title={`Resaltador ${spec.label}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                    >
                      <span
                        style={{
                          backgroundColor: spec.swatch,
                          boxShadow: selected
                            ? `0 0 0 2px #FFFFFF, 0 0 0 3.5px ${spec.ring}`
                            : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                        }}
                        className="h-4 w-4 rounded-full"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="my-1 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

              {/* Undo & Clear Strokes */}
              <div className="flex flex-col items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleUndoStroke}
                  disabled={strokeCount === 0}
                  aria-label="Deshacer último trazo"
                  title="Deshacer trazo (Ctrl+Z)"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClearStrokes}
                  disabled={strokeCount === 0}
                  aria-label="Borrar todos los trazos"
                  title="Borrar todos los trazos"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#1D1D1F] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
                >
                  <Eraser className="h-4 w-4" />
                </button>
              </div>

              <div className="my-1 h-px w-6 bg-[#D1D1D6]" aria-hidden="true" />

              {/* Contexto del algoritmo (Floating Popover Trigger) */}
              <button
                type="button"
                data-testid="viewer-context-btn"
                onClick={() => setShowContext((v) => !v)}
                aria-pressed={showContext}
                aria-label="Ver contexto del algoritmo"
                title="Contexto del algoritmo"
                className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                  showContext
                    ? 'bg-[#0071E3] text-white'
                    : 'text-[#1D1D1F] hover:bg-white/90'
                }`}
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                {!showContext &&
                  Boolean(
                    currentAlgorithm.diagram?.clinicalContext?.summary ||
                      currentAlgorithm.subtitle
                  ) && (
                    <span
                      aria-hidden="true"
                      className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0071E3]"
                    />
                  )}
              </button>
            </div>

            {/* Floating Algorithm Context / Introduction Popover */}
            <AlgorithmContextPopover
              open={showContext}
              context={currentAlgorithm.diagram?.clinicalContext}
              fallbackSubtitle={currentAlgorithm.subtitle}
              fallbackReference={currentAlgorithm.reference ?? currentAlgorithm.diagram?.reference}
              editable={false}
              onClose={() => setShowContext(false)}
            />
          </div>
        )}

        {/* Retractable Study Mode / Clinical Notes Side Panel (always accessible from the top-right Notes icon) */}
        {showNotes && (
          <aside
            aria-label="Panel de notas clínicas"
            className="mac-panel-in absolute inset-y-0 right-0 z-30 flex w-full max-w-[340px] flex-col border-l border-[#E5E5EA] mac-glass-strong sm:static sm:w-[340px] sm:shrink-0"
          >
            <div className="flex items-center justify-between border-b border-[#E5E5EA] px-5 py-3.5">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#1D1D1F]">Notas Clínicas</h3>
                <p className="text-[11.5px] text-[#6E6E73]">
                  {noteSaveState === 'saved'
                    ? 'Guardado localmente'
                    : 'Modo estudio · Guardado automático'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNotes(false)}
                aria-label="Cerrar panel de notas"
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-white/80 hover:text-[#1D1D1F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col p-4">
              <label htmlFor="quicklook-study-notes" className="sr-only">
                Notas clínicas clave para {currentAlgorithm.title}
              </label>
              <textarea
                id="quicklook-study-notes"
                value={notesDraft}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Escribe criterios clave, metas calórico-proteicas, contraindicaciones o perlas clínicas de este algoritmo…"
                className="flex-1 w-full resize-none rounded-xl border border-[#E5E5EA] bg-white/90 p-3.5 text-[13.5px] leading-relaxed text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
