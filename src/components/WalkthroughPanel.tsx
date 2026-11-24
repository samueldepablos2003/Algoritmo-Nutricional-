import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  RotateCcw,
  X,
} from 'lucide-react';
import type { DiagramEdge, DiagramNode, EditableDiagram } from '../types/algorithm';
import {
  formatWalkthroughSummary,
  type WalkthroughState,
} from '../utils/walkthroughEngine';

interface WalkthroughPanelProps {
  open: boolean;
  diagram: EditableDiagram;
  state: WalkthroughState;
  currentNode: DiagramNode | null;
  availableEdges: DiagramEdge[];
  isComplete: boolean;
  onSelectEdge: (edgeId: string) => void;
  onRewindToNode: (nodeId: string) => void;
  onStepBack: () => void;
  onReset: () => void;
  onClose: () => void;
}

function getChoiceToneClasses(label: string): string {
  const norm = label.toLowerCase().trim();
  if (
    norm.startsWith('no') ||
    norm.includes('no funcional') ||
    norm.includes('shock') ||
    norm.includes('intolerancia') ||
    norm.includes('íleo') ||
    norm.includes('contraind') ||
    norm.includes('sin tolerancia')
  ) {
    return 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] hover:border-[#B45309] hover:bg-[#FEF3C7]';
  }
  if (
    norm.startsWith('sí') ||
    norm.startsWith('si') ||
    norm.includes('funcional') ||
    norm.includes('buena') ||
    norm.includes('leve')
  ) {
    return 'border-[#86EFAC] bg-[#F0FDF4] text-[#166534] hover:border-[#15803D] hover:bg-[#DCFCE7]';
  }
  return 'border-[#BFDBFE] bg-[#F0F7FF] text-[#0C4A6E] hover:border-[#0071E3] hover:bg-[#E0F2FE]';
}

export const WalkthroughPanel: React.FC<WalkthroughPanelProps> = ({
  open,
  diagram,
  state,
  currentNode,
  availableEdges,
  isComplete,
  onSelectEdge,
  onRewindToNode,
  onStepBack,
  onReset,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));

  const handleCopySummary = async () => {
    const summary = formatWalkthroughSummary(diagram, state);
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard permissions
      const area = document.createElement('textarea');
      area.value = summary;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside
      aria-label="Panel de Recorrido Guiado"
      data-testid="walkthrough-panel"
      className="mac-panel-in absolute bottom-4 left-4 top-4 z-30 flex w-[calc(100%-5.5rem)] max-w-[350px] flex-col overflow-hidden rounded-2xl border border-[#E5E5EA] mac-glass-strong shadow-[0_20px_50px_-14px_rgba(29,29,31,0.18),0_4px_14px_-4px_rgba(29,29,31,0.08)] sm:bottom-5 sm:left-5 sm:top-5"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5EA] px-5 py-3.5">
        <div>
          <h2 className="text-[14.5px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
            Recorrido Guiado
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Ocultar panel de recorrido"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-white/80 hover:text-[#1D1D1F]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Full-Height Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
        {/* Current Active Step Card */}
        {currentNode && (
          <section aria-label="Paso actual del recorrido" className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0071E3]">
                {isComplete ? 'Conducta final alcanzada' : `Paso ${state.steps.length} · Activo`}
              </span>
            </div>

            <div
              className={`rounded-2xl border p-4 shadow-[0_2px_10px_-6px_rgba(29,29,31,0.1)] ${
                isComplete
                  ? 'border-[#86EFAC] bg-[#F0FDF4]'
                  : 'border-[#0071E3]/35 bg-white'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isComplete && (
                  <CheckCircle2
                    className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#15803D]"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <h3
                    data-testid="walkthrough-current-title"
                    className={`text-[14px] font-bold leading-snug ${
                      isComplete ? 'text-[#065F46]' : 'text-[#1D1D1F]'
                    }`}
                  >
                    {currentNode.title}
                  </h3>
                  {currentNode.body && (
                    <p
                      className={`mt-1.5 text-[12.5px] leading-relaxed ${
                        isComplete ? 'text-[#047857]' : 'text-[#3A3A3C]'
                      }`}
                    >
                      {currentNode.body}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Decision Buttons mirroring clickable canvas edges */}
            {!isComplete && availableEdges.length > 0 && (
              <div className="space-y-2 pt-0.5">
                <span className="block text-[12px] font-medium text-[#6E6E73]">
                  {availableEdges.length > 1
                    ? 'Selecciona la conexión para continuar:'
                    : 'Siguiente paso del algoritmo:'}
                </span>
                <div className="flex flex-col gap-2">
                  {availableEdges.map((edge) => {
                    const target = nodeMap.get(edge.to);
                    const hasLabel = edge.label.trim().length > 0;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        data-testid={`walkthrough-choice-${edge.id}`}
                        onClick={() => onSelectEdge(edge.id)}
                        className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${getChoiceToneClasses(
                          edge.label
                        )}`}
                      >
                        <div className="min-w-0">
                          <span className="block text-[13px] font-semibold leading-snug">
                            {hasLabel ? edge.label : 'Continuar'}
                          </span>
                          {target && (
                            <span className="mt-0.5 block truncate text-[11.5px] opacity-80">
                              → {target.title}
                            </span>
                          )}
                        </div>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Final Conduct Summary Actions */}
            {isComplete && (
              <div
                data-testid="walkthrough-summary-card"
                className="flex items-center gap-2 pt-1"
              >
                <button
                  type="button"
                  onClick={() => void handleCopySummary()}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1D1D1F] px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#3A3A3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Resumen copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copiar resumen</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5EA] bg-white px-3 text-[12.5px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reiniciar</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* Chronological Decision Checklist */}
        <section aria-label="Checklist de ruta recorrida" className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#1D1D1F]">
              Ruta seleccionada
            </span>
            <span className="font-mono-tabular text-[11.5px] text-[#8E8E93]">
              {state.steps.length} {state.steps.length === 1 ? 'paso' : 'pasos'}
            </span>
          </div>

          <ol className="space-y-1.5">
            {state.steps.map((step, index) => {
              const node = nodeMap.get(step.nodeId);
              if (!node) return null;
              const isCurrent = index === state.steps.length - 1;
              return (
                <li key={`${step.nodeId}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onRewindToNode(step.nodeId)}
                    title={isCurrent ? 'Paso actual' : 'Volver a este paso'}
                    className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                      isCurrent
                        ? 'border-[#0071E3]/40 bg-white text-[#1D1D1F]'
                        : 'border-transparent bg-white/60 text-[#3A3A3C] hover:border-[#E5E5EA] hover:bg-white'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono-tabular text-[11px] font-bold ${
                        isCurrent
                          ? 'bg-[#0071E3] text-white'
                          : 'bg-[#E5E5EA] text-[#1D1D1F]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {step.decisionLabel && (
                        <span className="mb-0.5 block text-[11px] font-semibold text-[#0071E3]">
                          {step.decisionLabel}
                        </span>
                      )}
                      <span className="block text-[12.5px] font-medium leading-snug">
                        {node.title}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </aside>
  );
};
