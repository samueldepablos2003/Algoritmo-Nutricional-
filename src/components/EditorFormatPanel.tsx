import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripHorizontal, X } from 'lucide-react';
import type { DiagramColorMode, DiagramPaletteId } from '../types/algorithm';
import { DIAGRAM_PALETTES } from '../utils/diagramTheme';

interface EditorFormatPanelProps {
  open: boolean;
  colorMode: DiagramColorMode;
  paletteId: DiagramPaletteId;
  fontScale: number;
  onChangeColorMode: (mode: DiagramColorMode) => void;
  onChangePalette: (paletteId: DiagramPaletteId) => void;
  onChangeFontScale: (scale: number) => void;
  onReset: () => void;
  onClose: () => void;
}

export const EditorFormatPanel: React.FC<EditorFormatPanelProps> = ({
  open,
  colorMode,
  paletteId,
  fontScale,
  onChangeColorMode,
  onChangePalette,
  onChangeFontScale,
  onReset,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredPaletteId, setHoveredPaletteId] = useState<DiagramPaletteId | null>(null);
  const [isDraggingPalettes, setIsDraggingPalettes] = useState(false);
  const paletteListRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startScrollTop: number;
    didDrag: boolean;
  }>({
    active: false,
    pointerId: -1,
    startY: 0,
    startScrollTop: 0,
    didDrag: false,
  });

  if (!open) return null;

  const fontPercent = Math.round(fontScale * 100);
  const sliderFillPercent = Math.min(100, Math.max(0, ((fontScale - 0.75) / (1.6 - 0.75)) * 100));

  return (
    <aside
      aria-label="Formato global del algoritmo"
      data-testid="format-panel"
      onPointerDown={(e) => e.stopPropagation()}
      className="mac-toast-in absolute left-4 top-4 z-30 w-[308px] max-w-[calc(100%-5.5rem)] rounded-2xl border border-[#E5E5EA] bg-white/98 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.16),0_4px_12px_-2px_rgba(15,23,42,0.06)] backdrop-blur-md sm:left-5 sm:top-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFEFF4] px-4 py-3">
        <div className="flex items-center gap-2">
          <GripHorizontal className="h-4 w-4 text-[#8E8E93]" aria-hidden="true" />
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Formato
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expandir panel de formato' : 'Contraer panel de formato'}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel de formato"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4 px-4 py-4">
          <p className="text-[13.5px] font-semibold text-[#1D1D1F]">Formato global</p>

          {/* Modo de color */}
          <div className="space-y-2">
            <p className="text-[12.5px] font-medium text-[#3A3A3C]">Modo de color</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeColorMode('color')}
                aria-pressed={colorMode === 'color'}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                  colorMode === 'color'
                    ? 'bg-[#262626] text-white shadow-xs'
                    : 'bg-[#F5F5F7] text-[#3A3A3C] hover:bg-[#EBEBF0]'
                }`}
              >
                Color
              </button>
              <button
                type="button"
                onClick={() => onChangeColorMode('grayscale')}
                aria-pressed={colorMode === 'grayscale'}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors whitespace-nowrap ${
                  colorMode === 'grayscale'
                    ? 'bg-[#262626] text-white shadow-xs'
                    : 'bg-[#F5F5F7] text-[#3A3A3C] hover:bg-[#EBEBF0]'
                }`}
              >
                Escala de grises
              </button>
            </div>
          </div>

          {/* Paletas de colores preestablecidas */}
          <div
            ref={paletteListRef}
            onWheel={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              if (e.button !== 0 || !paletteListRef.current) return;
              dragStateRef.current = {
                active: true,
                pointerId: e.pointerId,
                startY: e.clientY,
                startScrollTop: paletteListRef.current.scrollTop,
                didDrag: false,
              };
            }}
            onPointerMove={(e) => {
              const state = dragStateRef.current;
              const container = paletteListRef.current;
              if (!state.active || state.pointerId !== e.pointerId || !container) return;
              const deltaY = e.clientY - state.startY;
              if (!state.didDrag && Math.abs(deltaY) > 5) {
                state.didDrag = true;
                setIsDraggingPalettes(true);
                setHoveredPaletteId(null);
                try {
                  container.setPointerCapture(e.pointerId);
                } catch {
                  // Ignore if pointer capture is unavailable
                }
              }
              if (state.didDrag) {
                container.scrollTop = state.startScrollTop - deltaY;
              }
            }}
            onPointerUp={(e) => {
              const state = dragStateRef.current;
              if (!state.active || state.pointerId !== e.pointerId) return;
              state.active = false;
              if (state.didDrag) {
                setIsDraggingPalettes(false);
                try {
                  paletteListRef.current?.releasePointerCapture(e.pointerId);
                } catch {
                  // Ignore if pointer capture is not held
                }
                window.setTimeout(() => {
                  dragStateRef.current.didDrag = false;
                }, 0);
              }
            }}
            onPointerCancel={() => {
              dragStateRef.current.active = false;
              dragStateRef.current.didDrag = false;
              setIsDraggingPalettes(false);
            }}
            className={`no-scrollbar grid max-h-[212px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain select-none ${
              isDraggingPalettes ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {DIAGRAM_PALETTES.map((palette) => {
              const active = colorMode === 'color' && paletteId === palette.id;
              const showTooltip = !isDraggingPalettes && hoveredPaletteId === palette.id;
              const previewFill = palette.tones.gray.fill;
              const previewBorder = active ? palette.swatches[0] : palette.tones.gray.stroke;
              return (
                <div key={palette.id} className="relative">
                  <button
                    type="button"
                    data-testid={`palette-option-${palette.id}`}
                    onClick={(e) => {
                      if (dragStateRef.current.didDrag) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      if (colorMode !== 'color') onChangeColorMode('color');
                      onChangePalette(palette.id);
                    }}
                    onMouseEnter={() => {
                      if (!isDraggingPalettes) setHoveredPaletteId(palette.id);
                    }}
                    onMouseLeave={() => setHoveredPaletteId((curr) => (curr === palette.id ? null : curr))}
                    aria-pressed={active}
                    title={palette.name}
                    style={{
                      backgroundColor: active ? palette.tones.blue.fill : previewFill,
                      borderColor: previewBorder,
                      boxShadow: active ? `0 0 0 1.5px ${palette.swatches[0]}` : undefined,
                    }}
                    className="flex w-full items-center gap-2 rounded-full border px-2.5 py-2 text-left transition-all hover:brightness-[0.98] active:scale-[0.98]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-4.5 w-8 shrink-0 overflow-hidden rounded-full ring-1 ring-black/15"
                    >
                      <span className="flex-1" style={{ backgroundColor: palette.swatches[0] }} />
                      <span className="flex-1" style={{ backgroundColor: palette.swatches[1] }} />
                      <span className="flex-1" style={{ backgroundColor: palette.swatches[2] }} />
                    </span>
                    <span
                      style={{ color: palette.tones.blue.titleColor }}
                      className="truncate text-[12px] font-semibold"
                    >
                      {palette.name}
                    </span>
                  </button>

                  {showTooltip && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 rounded-lg bg-[#262626] px-2.5 py-1 text-[11.5px] font-medium text-white shadow-md whitespace-nowrap"
                    >
                      {palette.name}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Aumento de fuente adaptable */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="diagram-font-scale-slider"
                className="text-[13px] font-medium text-[#1D1D1F]"
              >
                Aumentar la fuente
              </label>
              <span className="font-mono-tabular text-[12.5px] font-semibold text-[#6E6E73]">
                {fontPercent}%
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                id="diagram-font-scale-slider"
                data-testid="font-scale-slider"
                type="range"
                min={0.75}
                max={1.6}
                step={0.05}
                value={fontScale}
                onChange={(e) => onChangeFontScale(parseFloat(e.target.value))}
                style={{
                  background: `linear-gradient(to right, #262626 0%, #262626 ${sliderFillPercent}%, #E5E5EA ${sliderFillPercent}%, #E5E5EA 100%)`,
                }}
                className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[#262626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2"
              />
            </div>
            <p className="text-[11px] leading-snug text-[#6E6E73]">
              Ajusta el tamaño del texto adaptando automáticamente el espacio de cada división.
            </p>
          </div>

          {/* Footer Reset */}
          <div className="flex justify-end border-t border-[#EFEFF4] pt-3">
            <button
              type="button"
              data-testid="format-reset-btn"
              onClick={onReset}
              className="rounded-full border border-[#E5E5EA] bg-white px-4 py-1.5 text-[12.5px] font-medium text-[#1D1D1F] shadow-2xs transition-colors hover:bg-[#F5F5F7] active:scale-[0.98]"
            >
              Restablecer
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
