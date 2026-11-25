import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GripHorizontal, X } from 'lucide-react';

export type SelectedTextKind = 'node-title' | 'node-body' | 'edge-label';

interface SelectedTextPanelProps {
  open: boolean;
  kind: SelectedTextKind;
  text: string;
  fontSize: number;
  opacity: number;
  onChangeText: (nextText: string) => void;
  onChangeFontSize: (nextSize: number) => void;
  onChangeOpacity: (nextOpacity: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReset: () => void;
  onClose: () => void;
}

const KIND_LABELS: Record<SelectedTextKind, string> = {
  'node-title': 'Título del cuadro',
  'node-body': 'Descripción del cuadro',
  'edge-label': 'Etiqueta de conexión',
};

export const SelectedTextPanel: React.FC<SelectedTextPanelProps> = ({
  open,
  kind,
  text,
  fontSize,
  opacity,
  onChangeText,
  onChangeFontSize,
  onChangeOpacity,
  onDuplicate,
  onDelete,
  onReset,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!open) return null;

  return (
    <aside
      aria-label="Editor de texto seleccionado"
      data-testid="selected-text-panel"
      onPointerDown={(e) => e.stopPropagation()}
      className="mac-toast-in absolute left-4 top-4 z-30 w-[312px] max-w-[calc(100%-5.5rem)] rounded-2xl border border-[#E5E5EA] bg-white/98 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.16),0_4px_12px_-2px_rgba(15,23,42,0.06)] backdrop-blur-md sm:left-5 sm:top-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFEFF4] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal className="h-4 w-4 shrink-0 text-[#8E8E93]" aria-hidden="true" />
          <span className="truncate text-[12px] font-medium text-[#6E6E73]">
            {KIND_LABELS[kind]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expandir editor de texto' : 'Contraer editor de texto'}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar editor de texto seleccionado"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-[14.5px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              Texto seleccionado
            </h2>
            <p className="text-[12px] leading-snug text-[#6E6E73]">
              Los cambios de texto se aplican al instante en el algoritmo final.
            </p>
          </div>

          {/* Contenido del texto */}
          <div className="space-y-1.5">
            <label
              htmlFor="selected-text-content-input"
              className="block text-[12.5px] font-medium text-[#3A3A3C]"
            >
              Contenido del texto
            </label>
            <textarea
              id="selected-text-content-input"
              data-testid="selected-text-textarea"
              rows={3}
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              placeholder="Escribe el texto…"
              className="w-full resize-y rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 text-[13.5px] leading-snug text-[#1D1D1F] transition-colors focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
            />
          </div>

          {/* Tamaño de fuente y Opacidad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="selected-text-fontsize-input"
                className="block text-[12.5px] font-medium text-[#3A3A3C]"
              >
                Tamaño de fuente
              </label>
              <input
                id="selected-text-fontsize-input"
                data-testid="selected-text-fontsize"
                type="number"
                min={8}
                max={48}
                step={0.5}
                value={Number(fontSize.toFixed(2))}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  if (Number.isFinite(parsed)) {
                    onChangeFontSize(Math.min(48, Math.max(8, parsed)));
                  }
                }}
                className="w-full rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 font-mono-tabular text-[13.5px] text-[#1D1D1F] transition-colors focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="selected-text-opacity-input"
                className="block text-[12.5px] font-medium text-[#3A3A3C]"
              >
                Opacidad
              </label>
              <input
                id="selected-text-opacity-input"
                data-testid="selected-text-opacity"
                type="number"
                min={0.1}
                max={1}
                step={0.1}
                value={Number(opacity.toFixed(2))}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  if (Number.isFinite(parsed)) {
                    onChangeOpacity(Math.min(1, Math.max(0.1, parsed)));
                  }
                }}
                className="w-full rounded-xl border border-[#E5E5EA] bg-white px-3 py-2 font-mono-tabular text-[13.5px] text-[#1D1D1F] transition-colors focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
              />
            </div>
          </div>

          {/* Element Actions */}
          <div className="space-y-2 border-t border-[#EFEFF4] pt-3">
            <button
              type="button"
              onClick={onDuplicate}
              className="w-full rounded-full border border-[#E5E5EA] bg-white px-4 py-2 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] active:scale-[0.99]"
            >
              Duplicar elemento
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="w-full rounded-full border border-[#FECACA] bg-[#FFF5F5] px-4 py-2 text-[13px] font-medium text-[#DC2626] transition-colors hover:bg-[#FEE2E2] active:scale-[0.99]"
            >
              Eliminar elemento
            </button>
          </div>

          <div className="flex justify-end pt-0.5">
            <button
              type="button"
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
