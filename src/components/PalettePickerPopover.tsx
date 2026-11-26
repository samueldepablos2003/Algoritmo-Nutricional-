import React, { useEffect, useRef } from 'react';
import type { DiagramPaletteId } from '../types/algorithm';
import { DIAGRAM_PALETTES } from '../utils/diagramTheme';

interface PalettePickerPopoverProps {
  open: boolean;
  selectedPaletteId: DiagramPaletteId;
  onSelectPalette: (paletteId: DiagramPaletteId) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const PalettePickerPopover: React.FC<PalettePickerPopoverProps> = ({
  open,
  selectedPaletteId,
  onSelectPalette,
  onClose,
  anchorRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Seleccionar paleta de colores para el algoritmo"
      data-testid="palette-picker-popover"
      className="mac-toast-in absolute bottom-full left-0 z-40 mb-3 w-[min(456px,calc(100vw-4.5rem))] overflow-hidden rounded-[20px] border border-[#DFE3EA] bg-white shadow-[0_22px_52px_-14px_rgba(15,23,42,0.18),0_4px_14px_-2px_rgba(15,23,42,0.06)]"
    >
      {/* 2-Column Scrollable Palette Grid (mouse wheel scroll only, no scroll buttons or scrollbar) */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className="no-scrollbar grid max-h-[328px] grid-cols-2 gap-3 overflow-y-auto overscroll-contain p-4"
      >
        {DIAGRAM_PALETTES.map((palette) => {
          const isSelected = selectedPaletteId === palette.id;
          return (
            <button
              key={palette.id}
              type="button"
              data-testid={`home-palette-card-${palette.id}`}
              aria-pressed={isSelected}
              onClick={() => {
                onSelectPalette(palette.id);
                onClose();
              }}
              className={`group flex flex-col items-start rounded-[14px] border px-3.5 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                isSelected
                  ? 'border-[#1D1D1F] bg-[#F9FAFB] ring-1 ring-[#1D1D1F]'
                  : 'border-[#D9DDE5] bg-white hover:border-[#9CA3AF] hover:bg-[#FAFAFC]'
              }`}
            >
              <span className="flex items-center gap-2" aria-hidden="true">
                {palette.previewDots.map((hex, index) => (
                  <span
                    key={`${palette.id}-dot-${index}`}
                    style={{ backgroundColor: hex }}
                    className="h-6 w-6 rounded-full border border-black/10 transition-transform duration-150 group-hover:scale-105"
                  />
                ))}
              </span>
              <span
                className={`mt-3.5 text-[13.5px] font-medium leading-tight tracking-[-0.01em] ${
                  isSelected ? 'text-[#1D1D1F]' : 'text-[#4B5563]'
                }`}
              >
                {palette.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
