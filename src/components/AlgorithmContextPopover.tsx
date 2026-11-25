import React, { useEffect, useState } from 'react';
import { BookOpen, Pencil, X } from 'lucide-react';
import type { DiagramClinicalContext } from '../types/algorithm';

interface AlgorithmContextPopoverProps {
  open: boolean;
  context?: DiagramClinicalContext;
  fallbackSubtitle?: string;
  fallbackReference?: string;
  editable?: boolean;
  onSave?: (next: DiagramClinicalContext | undefined) => void;
  onClose: () => void;
}

/**
 * Floating frosted macOS popover displaying (and optionally editing) the clinical
 * introduction/context of an algorithm without cluttering the flowchart canvas.
 */
export const AlgorithmContextPopover: React.FC<AlgorithmContextPopoverProps> = ({
  open,
  context,
  fallbackSubtitle,
  fallbackReference,
  editable = false,
  onSave,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [summary, setSummary] = useState('');
  const [protocolSource, setProtocolSource] = useState('');
  const [targetPopulation, setTargetPopulation] = useState('');
  const [clinicalSetting, setClinicalSetting] = useState('');
  const [primaryObjective, setPrimaryObjective] = useState('');

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      return;
    }
    setSummary(context?.summary ?? fallbackSubtitle ?? '');
    setProtocolSource(context?.protocolSource ?? fallbackReference ?? '');
    setTargetPopulation(context?.targetPopulation ?? '');
    setClinicalSetting(context?.clinicalSetting ?? '');
    setPrimaryObjective(context?.primaryObjective ?? '');
    const hasAnyContent = Boolean(
      context?.summary?.trim() ||
        context?.protocolSource?.trim() ||
        context?.targetPopulation?.trim() ||
        context?.clinicalSetting?.trim() ||
        context?.primaryObjective?.trim() ||
        fallbackSubtitle?.trim() ||
        fallbackReference?.trim()
    );
    setIsEditing(editable && !hasAnyContent);
  }, [open, context, fallbackSubtitle, fallbackReference, editable]);

  if (!open) return null;

  const displaySummary = context?.summary?.trim() || fallbackSubtitle?.trim() || '';
  const displayProtocol = context?.protocolSource?.trim() || fallbackReference?.trim() || '';
  const displayPopulation = context?.targetPopulation?.trim() || '';
  const displaySetting = context?.clinicalSetting?.trim() || '';
  const displayObjective = context?.primaryObjective?.trim() || '';

  const hasContent = Boolean(
    displaySummary || displayProtocol || displayPopulation || displaySetting || displayObjective
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSave) return;
    const cleanSummary = summary.trim();
    const cleanProtocol = protocolSource.trim();
    const cleanPopulation = targetPopulation.trim();
    const cleanSetting = clinicalSetting.trim();
    const cleanObjective = primaryObjective.trim();

    if (
      !cleanSummary &&
      !cleanProtocol &&
      !cleanPopulation &&
      !cleanSetting &&
      !cleanObjective
    ) {
      onSave(undefined);
    } else {
      onSave({
        summary: cleanSummary || cleanObjective || cleanProtocol,
        ...(cleanProtocol ? { protocolSource: cleanProtocol } : {}),
        ...(cleanPopulation ? { targetPopulation: cleanPopulation } : {}),
        ...(cleanSetting ? { clinicalSetting: cleanSetting } : {}),
        ...(cleanObjective ? { primaryObjective: cleanObjective } : {}),
      });
    }
    setIsEditing(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Contexto del algoritmo"
      data-testid="algorithm-context-popover"
      onPointerDown={(e) => e.stopPropagation()}
      className="mac-toast-in absolute right-[72px] top-4 z-35 w-[336px] max-w-[calc(100vw-6rem)] overflow-hidden rounded-2xl border border-[#E5E5EA] mac-glass-strong mac-dock-shadow sm:right-[78px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E5EA]/90 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen className="h-4 w-4 shrink-0 text-[#0071E3]" aria-hidden="true" />
          <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Contexto del algoritmo
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editable && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Editar contexto del algoritmo"
              title="Editar contexto"
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-white/90 hover:text-[#1D1D1F]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar contexto del algoritmo"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-white/90 hover:text-[#1D1D1F]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[calc(100vh-11rem)] overflow-y-auto p-4">
        {isEditing && editable ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="algo-context-summary"
                className="mb-1 block text-[11.5px] font-semibold text-[#1D1D1F]"
              >
                Introducción / ¿De qué trata?
              </label>
              <textarea
                id="algo-context-summary"
                rows={3}
                autoFocus
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Describe brevemente el propósito clínico-nutricional de este algoritmo…"
                className="w-full resize-none rounded-xl border border-[#D1D1D6] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
              />
            </div>

            <div>
              <label
                htmlFor="algo-context-protocol"
                className="mb-1 block text-[11.5px] font-semibold text-[#1D1D1F]"
              >
                Protocolo o guía de referencia
              </label>
              <input
                id="algo-context-protocol"
                type="text"
                value={protocolSource}
                onChange={(e) => setProtocolSource(e.target.value)}
                placeholder="Ej. Guías ESPEN 2024 / Consenso ASPEN"
                className="h-8.5 w-full rounded-lg border border-[#D1D1D6] bg-white px-2.5 text-[12.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label
                  htmlFor="algo-context-population"
                  className="mb-1 block text-[11.5px] font-semibold text-[#1D1D1F]"
                >
                  Población diana
                </label>
                <input
                  id="algo-context-population"
                  type="text"
                  value={targetPopulation}
                  onChange={(e) => setTargetPopulation(e.target.value)}
                  placeholder="Ej. Adultos hospitalizados con pancreatitis aguda"
                  className="h-8.5 w-full rounded-lg border border-[#D1D1D6] bg-white px-2.5 text-[12.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="algo-context-setting"
                  className="mb-1 block text-[11.5px] font-semibold text-[#1D1D1F]"
                >
                  Escenario clínico
                </label>
                <input
                  id="algo-context-setting"
                  type="text"
                  value={clinicalSetting}
                  onChange={(e) => setClinicalSetting(e.target.value)}
                  placeholder="Ej. UCI, Hospitalización, Perioperatorio"
                  className="h-8.5 w-full rounded-lg border border-[#D1D1D6] bg-white px-2.5 text-[12.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="algo-context-objective"
                  className="mb-1 block text-[11.5px] font-semibold text-[#1D1D1F]"
                >
                  Objetivo terapéutico
                </label>
                <input
                  id="algo-context-objective"
                  type="text"
                  value={primaryObjective}
                  onChange={(e) => setPrimaryObjective(e.target.value)}
                  placeholder="Ej. Iniciar NE precoz < 48 h sin complicaciones"
                  className="h-8.5 w-full rounded-lg border border-[#D1D1D6] bg-white px-2.5 text-[12.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!hasContent) {
                    onClose();
                  } else {
                    setIsEditing(false);
                  }
                }}
                className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#6E6E73] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#0071E3] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-xs transition-colors hover:bg-[#0077ED]"
              >
                Guardar
              </button>
            </div>
          </form>
        ) : hasContent ? (
          <div className="space-y-3 text-[12.5px] leading-relaxed">
            {displaySummary && (
              <p className="text-[#1D1D1F]">{displaySummary}</p>
            )}

            {(displayProtocol || displayPopulation || displaySetting || displayObjective) && (
              <dl className="space-y-2 border-t border-[#E5E5EA] pt-3 text-[12px]">
                {displayProtocol && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6E6E73]">
                      Protocolo / Guía
                    </dt>
                    <dd className="mt-0.5 text-[#1D1D1F]">{displayProtocol}</dd>
                  </div>
                )}
                {displayPopulation && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6E6E73]">
                      Población diana
                    </dt>
                    <dd className="mt-0.5 text-[#1D1D1F]">{displayPopulation}</dd>
                  </div>
                )}
                {displaySetting && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6E6E73]">
                      Escenario clínico
                    </dt>
                    <dd className="mt-0.5 text-[#1D1D1F]">{displaySetting}</dd>
                  </div>
                )}
                {displayObjective && (
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6E6E73]">
                      Objetivo terapéutico
                    </dt>
                    <dd className="mt-0.5 text-[#1D1D1F]">{displayObjective}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        ) : (
          <div className="py-3 text-center">
            <p className="text-[12.5px] text-[#6E6E73]">
              Este algoritmo aún no tiene un contexto introductorio registrado.
            </p>
            {editable && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0071E3] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#0077ED]"
              >
                Agregar contexto
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
