import React, { useRef, useState } from 'react';
import { Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import type { AlgorithmItem, CardOriginRect } from '../types/algorithm';

interface AlgorithmCardProps {
  algorithm: AlgorithmItem;
  onOpen: (algorithm: AlgorithmItem, originRect: CardOriginRect) => void;
  onExportJpg: (algorithm: AlgorithmItem) => void;
  isExporting?: boolean;
  onEditMetadata: (algorithm: AlgorithmItem) => void;
  onDelete: (algorithm: AlgorithmItem) => void;
}

export const AlgorithmCard: React.FC<AlgorithmCardProps> = ({
  algorithm,
  onOpen,
  onExportJpg,
  isExporting = false,
  onEditMetadata,
  onDelete,
}) => {
  const previewRef = useRef<HTMLButtonElement | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleOpen = () => {
    const rect = previewRef.current?.getBoundingClientRect();
    onOpen(algorithm, {
      top: rect?.top ?? window.innerHeight / 2 - 150,
      left: rect?.left ?? window.innerWidth / 2 - 220,
      width: rect?.width ?? 440,
      height: rect?.height ?? 300,
    });
  };

  const strokeCount = algorithm.strokes.length;

  return (
    <article className="group relative flex flex-col rounded-2xl border border-[#E5E5EA] bg-white mac-card-shadow">
      {/* Main Clickable Preview Surface */}
      <button
        ref={previewRef}
        type="button"
        onClick={handleOpen}
        aria-label={`Abrir algoritmo ${algorithm.title} a pantalla completa`}
        className="relative aspect-[16/9] w-full overflow-hidden rounded-t-[15px] bg-[#FAFAFC] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0071E3]"
      >
        {!imageError ? (
          <img
            src={algorithm.imageDataUrl}
            alt={algorithm.title}
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="h-full w-full object-contain p-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.018]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#F5F5F7] p-6 text-center">
            <span className="text-[13px] font-medium text-[#6E6E73]">
              Vista previa no disponible
            </span>
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#E5E5EA]/80"
        />
      </button>

      {/* Top-Right Image Actions: Export JPG (Upload icon) & Discreet Hover Delete */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        <button
          type="button"
          data-testid={`export-jpg-btn-${algorithm.id}`}
          disabled={isExporting}
          onClick={(e) => {
            e.stopPropagation();
            onExportJpg(algorithm);
          }}
          aria-label={`Exportar ${algorithm.title} como JPG`}
          title="Exportar como JPG"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5EA] bg-white/92 text-[#1D1D1F] shadow-xs backdrop-blur-md transition-all hover:border-[#0071E3]/40 hover:bg-white hover:text-[#0071E3] disabled:cursor-wait focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
            isExporting
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(algorithm);
          }}
          aria-label={`Eliminar ${algorithm.title}`}
          title="Eliminar algoritmo"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5EA] bg-white/92 text-[#6E6E73] opacity-0 backdrop-blur-md transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white hover:text-[#DC2626] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Card Typography & Clean Unboxed Metadata */}
      <div className="flex flex-1 flex-col justify-between gap-2 p-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={handleOpen}
              className="text-left text-[15.5px] font-semibold leading-snug tracking-[-0.012em] text-[#1D1D1F] transition-colors hover:text-[#0071E3] focus-visible:outline-none focus-visible:underline"
            >
              {algorithm.title}
            </button>

            {/* Zero-pill clean metadata with typographic dot separators */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-[#6E6E73]">
              {algorithm.tags.length > 0 ? (
                algorithm.tags.map((tag, index) => (
                  <React.Fragment key={tag}>
                    {index > 0 && <span aria-hidden="true">·</span>}
                    <span>{tag}</span>
                  </React.Fragment>
                ))
              ) : (
                <span>Sin categoría</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditMetadata(algorithm);
            }}
            aria-label={`Editar datos de ${algorithm.title}`}
            title="Editar nombre y sección"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8E8E93] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {strokeCount > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 text-[12px] text-[#8E8E93]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono-tabular shrink-0">
                {strokeCount} {strokeCount === 1 ? 'resaltado' : 'resaltados'}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
