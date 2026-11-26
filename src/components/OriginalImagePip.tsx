import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { clampZoom, stepZoom } from '../utils/algorithmLogic';
import { parseSvgDataUrlDimensions } from '../utils/imageExport';

interface OriginalImagePipProps {
  imageDataUrl?: string;
  title?: string;
  /** Optional custom corner placement classes inside a relative stage container */
  className?: string;
}

/**
 * Floating corner miniature ("Picture-in-Picture") showing the original uploaded image.
 * Clicking it opens the full original image in a macOS frosted overlay; closing the overlay
 * returns cleanly to the edited diagram underneath.
 */
export const OriginalImagePip: React.FC<OriginalImagePipProps> = ({
  imageDataUrl,
  title = 'Algoritmo original',
  className = 'top-4 left-4',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const panRef = useRef(pan);
  panRef.current = pan;
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(
    null
  );

  const handleClose = useCallback(() => {
    setIsExpanded(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  const applyZoom = useCallback(
    (rawNextZoom: number, anchorClient?: { x: number; y: number }) => {
      const nextZoom = clampZoom(rawNextZoom);
      const prevZoom = zoomRef.current;
      if (nextZoom === prevZoom) return;

      const ratio = nextZoom / prevZoom;
      const prevPan = panRef.current;
      let nextPan = {
        x: Math.round(prevPan.x * ratio),
        y: Math.round(prevPan.y * ratio),
      };

      if (anchorClient && stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = anchorClient.x - cx;
        const dy = anchorClient.y - cy;
        nextPan = {
          x: Math.round(dx - (dx - prevPan.x) * ratio),
          y: Math.round(dy - (dy - prevPan.y) * ratio),
        };
      }

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    },
    []
  );

  useEffect(() => {
    setNaturalSize(imageDataUrl ? parseSvgDataUrlDimensions(imageDataUrl) : null);
  }, [imageDataUrl]);

  useLayoutEffect(() => {
    if (!isExpanded || !stageRef.current) return;
    const el = stageRef.current;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setStageSize((prev) =>
        prev.width === Math.round(rect.width) && prev.height === Math.round(rect.height)
          ? prev
          : { width: Math.round(rect.width), height: Math.round(rect.height) }
      );
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isExpanded]);

  // Capture-phase Escape handler so closing the original image never closes the editor/viewer behind it
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(stepZoom(zoomRef.current, 'in'));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopImmediatePropagation();
        applyZoom(stepZoom(zoomRef.current, 'out'));
      } else if (e.key === '0') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isExpanded, handleClose, applyZoom]);

  if (!imageDataUrl) return null;

  const fittedZoomedSize = (() => {
    if (!naturalSize || stageSize.width <= 0 || stageSize.height <= 0) return null;
    const availW = Math.max(200, stageSize.width - 48);
    const availH = Math.max(180, stageSize.height - 48);
    const fitScale = Math.min(availW / naturalSize.width, availH / naturalSize.height);
    return {
      width: Math.max(1, Math.round(naturalSize.width * fitScale * zoom)),
      height: Math.max(1, Math.round(naturalSize.height * fitScale * zoom)),
    };
  })();

  const zoomPercent = Math.round(zoom * 100);

  return (
    <>
      {/* Floating Corner Thumbnail Card */}
      <button
        type="button"
        data-testid="original-image-pip"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
        aria-label={`Ver imagen original de referencia: ${title}`}
        title="Haz clic para abrir la imagen original"
        className={`group absolute z-20 flex w-[132px] sm:w-[152px] flex-col overflow-hidden rounded-2xl border border-[#E5E5EA] mac-glass-strong mac-dock-shadow text-left transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#0071E3] hover:shadow-[0_14px_34px_-12px_rgba(0,113,227,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${className}`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-white p-1.5">
          <img
            src={imageDataUrl}
            alt={`Miniatura original de ${title}`}
            draggable={false}
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex items-center justify-between gap-1.5 border-t border-[#E5E5EA]/90 px-2.5 py-1.5">
          <span className="truncate text-[11px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Original
          </span>
          <Maximize2
            className="h-3 w-3 shrink-0 text-[#6E6E73] transition-colors group-hover:text-[#0071E3]"
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Full Original Image Overlay Lightbox */}
      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen original: ${title}`}
          data-testid="original-image-overlay"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose();
            }
          }}
          className="mac-backdrop-in fixed inset-0 z-[60] flex items-center justify-center bg-[#1D1D1F]/38 backdrop-blur-xl p-3 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mac-sheet-in relative flex h-[90vh] w-full max-w-[1300px] flex-col overflow-hidden rounded-[22px] border border-[#E5E5EA] bg-white shadow-[0_32px_90px_-20px_rgba(29,29,31,0.36)]"
          >
            {/* Top Frosted Bar */}
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[#E5E5EA] mac-glass px-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-[14.5px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
                  Imagen original · {title}
                </h2>
                <p className="truncate text-[11.5px] text-[#6E6E73]">
                  Referencia visual sin modificaciones · Cierra para regresar al diagrama editado
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden items-center gap-0.5 rounded-xl border border-[#E5E5EA] bg-white/90 px-1 py-0.5 sm:flex">
                  <button
                    type="button"
                    onClick={() => applyZoom(stepZoom(zoomRef.current, 'out'))}
                    aria-label="Alejar imagen original"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    aria-label="Restablecer zoom al 100%"
                    className="h-7 min-w-[46px] rounded-lg px-1.5 font-mono-tabular text-[12px] font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={() => applyZoom(stepZoom(zoomRef.current, 'in'))}
                    aria-label="Acercar imagen original"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                    aria-label="Centrar imagen original"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  data-testid="close-original-overlay-btn"
                  onClick={handleClose}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#1D1D1F] px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-[#3A3A3C] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Volver al editado</span>
                </button>
              </div>
            </div>

            {/* Interactive Zoom & Pan Surface (true layout resolution up to 400%) */}
            <div
              ref={stageRef}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.15 : -0.15;
                applyZoom(zoomRef.current + delta, { x: e.clientX, y: e.clientY });
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                setIsPanning(true);
                panStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  originX: pan.x,
                  originY: pan.y,
                };
              }}
              onPointerMove={(e) => {
                if (!isPanning || !panStartRef.current) return;
                setPan({
                  x: panStartRef.current.originX + (e.clientX - panStartRef.current.x),
                  y: panStartRef.current.originY + (e.clientY - panStartRef.current.y),
                });
              }}
              onPointerUp={(e) => {
                if (!isPanning) return;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                setIsPanning(false);
                panStartRef.current = null;
              }}
              onPointerCancel={() => {
                setIsPanning(false);
                panStartRef.current = null;
              }}
              className={`relative flex flex-1 items-center justify-center overflow-hidden bg-[#FAFAFC] p-6 select-none touch-none ${
                isPanning ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <div
                style={{
                  transform: `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px)`,
                }}
                className="flex shrink-0 items-center justify-center"
              >
                <img
                  src={imageDataUrl}
                  alt={`Imagen original completa: ${title}`}
                  width={fittedZoomedSize?.width}
                  height={fittedZoomedSize?.height}
                  draggable={false}
                  decoding="sync"
                  referrerPolicy="no-referrer"
                  onLoad={(e) => {
                    const imgEl = e.currentTarget;
                    const parsedSvg = parseSvgDataUrlDimensions(imageDataUrl);
                    const w = parsedSvg?.width || imgEl.naturalWidth;
                    const h = parsedSvg?.height || imgEl.naturalHeight;
                    if (w > 0 && h > 0) {
                      setNaturalSize((prev) =>
                        prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }
                      );
                    }
                  }}
                  style={
                    fittedZoomedSize
                      ? {
                          width: `${fittedZoomedSize.width}px`,
                          height: `${fittedZoomedSize.height}px`,
                        }
                      : undefined
                  }
                  className={
                    fittedZoomedSize
                      ? 'block shrink-0 rounded-xl border border-[#E5E5EA] bg-white object-contain shadow-[0_12px_38px_-14px_rgba(29,29,31,0.14)] pointer-events-none'
                      : 'max-h-[calc(90vh-110px)] max-w-full rounded-xl border border-[#E5E5EA] bg-white object-contain shadow-[0_12px_38px_-14px_rgba(29,29,31,0.14)] pointer-events-none'
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
