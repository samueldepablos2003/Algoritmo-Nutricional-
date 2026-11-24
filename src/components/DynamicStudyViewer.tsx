import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shuffle,
  X,
} from 'lucide-react';
import type { AlgorithmItem } from '../types/algorithm';
import {
  getNextViewerIndex,
  getStudyProgressRatio,
  shuffleAlgorithms,
} from '../utils/algorithmLogic';

interface DynamicStudyViewerProps {
  open: boolean;
  algorithms: AlgorithmItem[];
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  keepFullscreenOnClose?: boolean;
}

type TransitionDirection = 'initial' | 'next' | 'prev' | 'shuffle';

interface OutgoingLayer {
  algorithm: AlgorithmItem;
  direction: 'next' | 'prev';
  key: number;
}

const IDLE_HIDE_MS = 2000;
const TRANSITION_CLEANUP_MS = 450;

export const DynamicStudyViewer: React.FC<DynamicStudyViewerProps> = ({
  open,
  algorithms,
  onClose,
  isFullscreen,
  onToggleFullscreen,
  keepFullscreenOnClose = false,
}) => {
  const [deck, setDeck] = useState<AlgorithmItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<TransitionDirection>('initial');
  const [transitionTick, setTransitionTick] = useState(0);
  const [outgoing, setOutgoing] = useState<OutgoingLayer | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);

  const idleTimerRef = useRef<number | null>(null);
  const outgoingTimerRef = useRef<number | null>(null);
  const pointerSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const enteredNativeFullscreenRef = useRef(false);
  const isClosingRef = useRef(false);

  const scheduleControlsAutoHide = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, IDLE_HIDE_MS);
  }, []);

  const exitStudyMode = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (!keepFullscreenOnClose && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [keepFullscreenOnClose, onClose]);

  // Initialize randomized sequence every time Visor de Estudio Dinámico opens
  useEffect(() => {
    if (!open) {
      setOutgoing(null);
      enteredNativeFullscreenRef.current = false;
      isClosingRef.current = false;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (outgoingTimerRef.current) window.clearTimeout(outgoingTimerRef.current);
      return;
    }

    isClosingRef.current = false;
    const shuffled = shuffleAlgorithms(algorithms);
    setDeck(shuffled);
    setCurrentIndex(0);
    setDirection('initial');
    setTransitionTick((t) => t + 1);
    setOutgoing(null);
    scheduleControlsAutoHide();
    if (!keepFullscreenOnClose && document.fullscreenElement) {
      enteredNativeFullscreenRef.current = true;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (outgoingTimerRef.current) window.clearTimeout(outgoingTimerRef.current);
    };
  }, [open, algorithms, scheduleControlsAutoHide, keepFullscreenOnClose]);

  // Keep synced with native browser Fullscreen API (including Esc exiting fullscreen)
  useEffect(() => {
    if (!open || keepFullscreenOnClose) return;

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      if (active) {
        enteredNativeFullscreenRef.current = true;
      } else if (enteredNativeFullscreenRef.current && !isClosingRef.current) {
        isClosingRef.current = true;
        onClose();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [open, keepFullscreenOnClose, onClose]);

  const stepToIndex = useCallback(
    (targetIndex: number, moveDirection: 'next' | 'prev') => {
      if (deck.length <= 1 || targetIndex === currentIndex) return;
      const previousAlgo = deck[currentIndex];
      const nextTick = Date.now();

      if (outgoingTimerRef.current) {
        window.clearTimeout(outgoingTimerRef.current);
      }

      if (previousAlgo) {
        setOutgoing({
          algorithm: previousAlgo,
          direction: moveDirection,
          key: nextTick,
        });
        outgoingTimerRef.current = window.setTimeout(() => {
          setOutgoing(null);
        }, TRANSITION_CLEANUP_MS);
      }

      setDirection(moveDirection);
      setCurrentIndex(targetIndex);
      setTransitionTick((t) => t + 1);
    },
    [deck, currentIndex]
  );

  const handleStep = useCallback(
    (moveDirection: 'prev' | 'next') => {
      if (deck.length <= 1) return;
      const nextIdx = getNextViewerIndex(currentIndex, deck.length, moveDirection);
      stepToIndex(nextIdx, moveDirection);
    },
    [deck.length, currentIndex, stepToIndex]
  );

  const handleShuffle = useCallback(() => {
    if (deck.length <= 1) return;
    const currentAlgo = deck[currentIndex];
    const nextDeck = shuffleAlgorithms(deck, { avoidFirstId: currentAlgo?.id });
    const nextTick = Date.now();

    if (outgoingTimerRef.current) {
      window.clearTimeout(outgoingTimerRef.current);
    }

    if (currentAlgo) {
      setOutgoing({
        algorithm: currentAlgo,
        direction: 'next',
        key: nextTick,
      });
      outgoingTimerRef.current = window.setTimeout(() => {
        setOutgoing(null);
      }, TRANSITION_CLEANUP_MS);
    }

    setDeck(nextDeck);
    setCurrentIndex(0);
    setDirection('shuffle');
    setTransitionTick((t) => t + 1);
    scheduleControlsAutoHide();
  }, [deck, currentIndex, scheduleControlsAutoHide]);

  const handleToggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      enteredNativeFullscreenRef.current = false;
    }
    onToggleFullscreen();
    scheduleControlsAutoHide();
  }, [isFullscreen, onToggleFullscreen, scheduleControlsAutoHide]);

  // Keyboard navigation: ←, →, Space, Esc
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitStudyMode();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleStep('next');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStep('prev');
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleShuffle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, exitStudyMode, handleStep, handleShuffle]);

  if (!open || deck.length === 0) return null;

  const currentAlgorithm = deck[currentIndex] ?? deck[0];
  const canNavigate = deck.length > 1;
  const progressRatio = getStudyProgressRatio(currentIndex, deck.length);

  const enterAnimationClass =
    direction === 'next' || direction === 'shuffle'
      ? 'mac-study-enter-right'
      : direction === 'prev'
        ? 'mac-study-enter-left'
        : 'mac-study-enter-depth';

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerSwipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerSwipeStartRef.current;
    pointerSwipeStartRef.current = null;
    if (!start || !canNavigate) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Horizontal swipe support on touch/trackpad or clean click-to-advance
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      handleStep(dx < 0 ? 'next' : 'prev');
    } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      handleStep('next');
    }
  };

  const chromeVisibilityClass = controlsVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-2 pointer-events-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de Estudio Dinámico"
      data-testid="dynamic-study-viewer"
      data-controls-visible={controlsVisible ? 'true' : 'false'}
      data-current-index={currentIndex}
      data-total={deck.length}
      onMouseMove={scheduleControlsAutoHide}
      onTouchStart={scheduleControlsAutoHide}
      className="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-white select-none"
    >
      {/* Pure Frameless Canvas — No border, no card wrapper, fits laptop screen cleanly */}
      <div
        data-testid="study-canvas"
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        className={`relative h-full w-full overflow-hidden bg-white ${
          canNavigate ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Outgoing Algorithm Image Layer (shrinks + slides out + fades) */}
        {outgoing && (
          <img
            key={`out-${outgoing.key}`}
            src={outgoing.algorithm.imageDataUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            referrerPolicy="no-referrer"
            className={`pointer-events-none absolute inset-0 m-auto h-full w-full max-h-[96vh] max-w-[96vw] object-contain p-3 sm:p-5 will-change-transform ${
              outgoing.direction === 'next' ? 'mac-study-exit-left' : 'mac-study-exit-right'
            }`}
          />
        )}

        {/* Active Incoming Algorithm Image (frameless, fitted directly to viewport) */}
        <img
          key={`in-${currentAlgorithm.id}-${transitionTick}`}
          src={currentAlgorithm.imageDataUrl}
          alt={currentAlgorithm.title}
          draggable={false}
          referrerPolicy="no-referrer"
          data-testid="study-active-image"
          className={`pointer-events-none absolute inset-0 m-auto h-full w-full max-h-[96vh] max-w-[96vw] object-contain p-3 sm:p-5 will-change-transform ${enterAnimationClass}`}
        />
      </div>

      {/* Discreet Top-Right Exit Button (auto-hides with inactivity) */}
      <button
        type="button"
        onClick={exitStudyMode}
        aria-label="Salir del visor de estudio"
        title="Salir (Esc)"
        className={`fixed right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E5EA] mac-study-dock text-[#1D1D1F] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:bg-white focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <X className="h-4.5 w-4.5" />
      </button>

      {/* Translucent Left / Right Navigation Arrows (auto-hide with inactivity) */}
      {canNavigate && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStep('prev');
              scheduleControlsAutoHide();
            }}
            aria-label="Algoritmo anterior en estudio"
            title="Anterior (←)"
            className={`fixed left-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5EA] mac-study-dock text-[#1D1D1F] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:bg-white focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleStep('next');
              scheduleControlsAutoHide();
            }}
            aria-label="Algoritmo siguiente en estudio"
            title="Siguiente (→)"
            className={`fixed right-5 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E5EA] mac-study-dock text-[#1D1D1F] shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:bg-white focus-visible:opacity-100 focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Minimalist Text-Free Bottom Progress Indicator */}
      <div
        aria-label="Progreso de la secuencia aleatoria"
        data-testid="study-progress"
        className="fixed bottom-3 left-1/2 z-10 -translate-x-1/2"
      >
        {deck.length <= 14 ? (
          <div className="flex items-center gap-1.5">
            {deck.map((item, idx) => {
              const active = idx === currentIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stepToIndex(idx, idx > currentIndex ? 'next' : 'prev');
                    scheduleControlsAutoHide();
                  }}
                  aria-label={`Ir al paso ${idx + 1} de ${deck.length}`}
                  aria-current={active ? 'step' : undefined}
                  className={`h-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                    active ? 'w-6 bg-[#1D1D1F]/80' : 'w-1.5 bg-[#D1D1D6] hover:bg-[#AEAEB2]'
                  }`}
                />
              );
            })}
          </div>
        ) : (
          <div className="h-1 w-44 overflow-hidden rounded-full bg-[#E5E5EA]">
            <div
              style={{ width: `${Math.round(progressRatio * 100)}%` }}
              className="h-full rounded-full bg-[#1D1D1F]/80 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            />
          </div>
        )}
      </div>

      {/* Floating macOS Frosted Glass Dock (auto-hides after 2s cursor inactivity) */}
      <div
        role="toolbar"
        aria-label="Controles del visor de estudio dinámico"
        data-testid="study-dock"
        onMouseEnter={() => {
          if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
          setControlsVisible(true);
        }}
        onMouseLeave={scheduleControlsAutoHide}
        className={`fixed bottom-9 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-[#E5E5EA] mac-study-dock px-2.5 py-1.5 mac-dock-shadow transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${chromeVisibilityClass}`}
      >
        <button
          type="button"
          onClick={() => {
            handleStep('prev');
            scheduleControlsAutoHide();
          }}
          disabled={!canNavigate}
          aria-label="Anterior"
          title="Anterior (←)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          onClick={handleShuffle}
          disabled={!canNavigate}
          aria-label="Mezclar secuencia aleatoria"
          title="Mezclar aleatoriamente (S)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
        >
          <Shuffle className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            handleStep('next');
            scheduleControlsAutoHide();
          }}
          disabled={!canNavigate}
          aria-label="Siguiente"
          title="Siguiente (→)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1D1D1F] transition-colors hover:bg-white/90 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
        >
          <ChevronRight className="h-4.5 w-4.5" />
        </button>

        <div className="mx-1 h-5 w-px bg-[#D1D1D6]" aria-hidden="true" />

        <button
          type="button"
          onClick={handleToggleFullscreen}
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Activar pantalla completa'}
          title={isFullscreen ? 'Salir de pantalla completa (F)' : 'Pantalla completa (F)'}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#1D1D1F] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={exitStudyMode}
          aria-label="Cerrar visor de estudio"
          title="Salir (Esc)"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#6E6E73] transition-colors hover:bg-white/90 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
