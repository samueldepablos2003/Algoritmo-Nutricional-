import React from 'react';
import type { NodeShape } from '../types/algorithm';

interface EditorShapesPopoverProps {
  onSelectShape: (shape: NodeShape) => void;
}

interface ShapeOption {
  shape: NodeShape;
  label: string;
  renderPreview: () => React.ReactNode;
}

const SHAPE_OPTIONS: readonly ShapeOption[] = [
  {
    shape: 'oval',
    label: 'Óvalo',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <ellipse cx="22" cy="14" rx="16" ry="10.5" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'process',
    label: 'Rectángulo',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <rect x="6" y="4" width="32" height="20" rx="1.5" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'diamond',
    label: 'Rombo',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon points="22,2.5 40,14 22,25.5 4,14" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'pill',
    label: 'Rectángulo redondeado',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <rect x="6" y="4.5" width="32" height="19" rx="9.5" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'parallelogram',
    label: 'Paralelogramo',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon points="12,4 39,4 32,24 5,24" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'hexagon',
    label: 'Hexágono',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon points="13,4 31,4 39,14 31,24 13,24 5,14" fill="#D4D6DC" />
      </svg>
    ),
  },
  {
    shape: 'block-arrow',
    label: 'Flecha de bloque',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon
          points="5,9 26,9 26,4 39,14 26,24 26,19 5,19"
          fill="#E2E5EC"
          stroke="#7A8292"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    shape: 'thin-arrow',
    label: 'Bloque fino',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon
          points="5,10 27,10 27,4.5 39,14 27,23.5 27,18 5,18"
          fill="#FFFFFF"
          stroke="#7A8292"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    shape: 'double-arrow',
    label: 'Doble bloque',
    renderPreview: () => (
      <svg viewBox="0 0 44 28" className="h-7 w-11" aria-hidden="true">
        <polygon
          points="5,14 14,5 14,9.5 30,9.5 30,5 39,14 30,23 30,18.5 14,18.5 14,23"
          fill="#E2E5EC"
          stroke="#7A8292"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export const EditorShapesPopover: React.FC<EditorShapesPopoverProps> = ({
  onSelectShape,
}) => {
  return (
    <div
      role="menu"
      aria-label="Seleccionar forma para agregar al algoritmo"
      data-testid="shapes-popover"
      onPointerDown={(e) => e.stopPropagation()}
      className="mac-toast-in absolute right-full top-1/2 mr-3 w-[328px] -translate-y-1/2 rounded-2xl border border-[#E5E5EA] bg-white/98 p-4 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.18),0_4px_12px_-2px_rgba(15,23,42,0.06)] backdrop-blur-md"
    >
      <div className="grid grid-cols-3 gap-x-2 gap-y-4">
        {SHAPE_OPTIONS.map((item) => (
          <button
            key={item.shape}
            type="button"
            role="menuitem"
            data-testid={`shape-option-${item.shape}`}
            onClick={() => onSelectShape(item.shape)}
            className="group flex flex-col items-center justify-start gap-2 rounded-xl px-2 py-2 text-center transition-colors hover:bg-[#F5F5F7] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <span className="flex h-8 w-12 items-center justify-center transition-transform duration-150 group-hover:scale-105">
              {item.renderPreview()}
            </span>
            <span className="text-[12px] font-medium leading-tight text-[#515968] group-hover:text-[#1D1D1F]">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
