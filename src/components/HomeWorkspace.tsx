import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  FileText,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Workflow,
  X,
} from 'lucide-react';
import {
  PRESET_TAGS,
  type DiagramPaletteId,
  type EditableDiagram,
} from '../types/algorithm';
import { normalizeSearchText, normalizeTags } from '../utils/algorithmLogic';
import {
  normalizeAiDiagramPayload,
  serializeDiagramToSvgDataUrl,
} from '../utils/diagramEngine';
import { getPaletteDefinition } from '../utils/diagramTheme';
import {
  AI_CAPACITY_LIMITS,
  parseApiDiagramResponse,
  prepareImageForGemini,
} from '../utils/imageDigitizer';
import { PalettePickerPopover } from './PalettePickerPopover';

interface AttachedDocument {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64?: string;
  dataUrl?: string;
  textContent?: string;
}

interface HomeWorkspaceProps {
  onGeneratedAlgorithmReady: (payload: {
    title: string;
    subtitle?: string;
    tags: string[];
    imageDataUrl: string;
    sourceImageDataUrl?: string;
    reference?: string;
    notes: string;
    diagram: EditableDiagram;
  }) => Promise<void>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export const HomeWorkspace: React.FC<HomeWorkspaceProps> = ({
  onGeneratedAlgorithmReady,
}) => {
  const [promptText, setPromptText] = useState('');
  const [attachedDoc, setAttachedDoc] = useState<AttachedDocument | null>(null);
  const [selectedPaletteId, setSelectedPaletteId] = useState<DiagramPaletteId>('original');
  const [hasChosenPalette, setHasChosenPalette] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // "Editar" dropdown state for AI protocol metadata & context
  const [editPopoverOpen, setEditPopoverOpen] = useState(false);
  const [editPopoverPos, setEditPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customReference, setCustomReference] = useState('');
  const [algorithmContext, setAlgorithmContext] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const paletteBtnRef = useRef<HTMLButtonElement | null>(null);
  const editBtnRef = useRef<HTMLButtonElement | null>(null);
  const editPopoverRef = useRef<HTMLDivElement | null>(null);

  const activePalette = getPaletteDefinition(selectedPaletteId);
  const canSubmit =
    !isGenerating && (promptText.trim().length > 0 || Boolean(attachedDoc));

  const hasEditConfig = Boolean(
    customTitle.trim() ||
      selectedTags.length > 0 ||
      customReference.trim() ||
      algorithmContext.trim()
  );

  // Close "Editar" dropdown on outside click or Escape
  useEffect(() => {
    if (!editPopoverOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (editPopoverRef.current?.contains(target)) return;
      if (editBtnRef.current?.contains(target)) return;
      setEditPopoverOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setEditPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editPopoverOpen]);

  // Keep the "Editar" dropdown fully inside the viewport so it is never cut off
  useLayoutEffect(() => {
    if (!editPopoverOpen) {
      setEditPopoverPos(null);
      return;
    }

    const updatePosition = () => {
      const anchor = editBtnRef.current;
      const popover = editPopoverRef.current;
      if (!anchor || !popover) return;

      const margin = 16;
      const anchorRect = anchor.getBoundingClientRect();
      const popoverWidth = popover.offsetWidth;
      const popoverHeight = popover.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const desiredLeft = anchorRect.left - 110;
      const maxLeft = Math.max(margin, vw - popoverWidth - margin);
      const left = Math.max(margin, Math.min(desiredLeft, maxLeft));

      const desiredTop = anchorRect.bottom + 10;
      const maxTop = Math.max(margin, vh - popoverHeight - margin);
      const top = Math.max(margin, Math.min(desiredTop, maxTop));

      setEditPopoverPos({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [editPopoverOpen, selectedTags.length]);

  const togglePresetTag = (tag: string) => {
    const key = normalizeSearchText(tag);
    setSelectedTags((prev) => {
      const exists = prev.some((t) => normalizeSearchText(t) === key);
      if (exists) {
        return prev.filter((t) => normalizeSearchText(t) !== key);
      }
      return normalizeTags([...prev, tag]);
    });
  };

  const addCustomTag = () => {
    const cleaned = customTagInput.trim();
    if (!cleaned) return;
    setSelectedTags((prev) => normalizeTags([...prev, cleaned]));
    setCustomTagInput('');
  };

  const removeTag = (tag: string) => {
    const key = normalizeSearchText(tag);
    setSelectedTags((prev) => prev.filter((t) => normalizeSearchText(t) !== key));
  };

  const presetKeys = new Set(PRESET_TAGS.map((t) => normalizeSearchText(t)));
  const customOnlyTags = selectedTags.filter((t) => !presetKeys.has(normalizeSearchText(t)));

  const handleFileSelected = async (file: File) => {
    setError(null);
    const isPlainText =
      file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name);

    try {
      if (isPlainText) {
        if (file.size > AI_CAPACITY_LIMITS.MAX_FILE_BYTES) {
          setError('El archivo de texto supera el límite de 15 MB.');
          return;
        }
        const text = await file.text();
        if (text.trim().length > AI_CAPACITY_LIMITS.MAX_TEXT_CHARS) {
          setError(
            `El archivo contiene ${text.trim().length.toLocaleString('es-ES')} caracteres y supera el máximo de ${AI_CAPACITY_LIMITS.MAX_TEXT_CHARS.toLocaleString('es-ES')}.`
          );
          return;
        }
        setAttachedDoc({
          name: file.name,
          mimeType: file.type || 'text/plain',
          sizeBytes: file.size,
          textContent: text,
        });
      } else if (
        file.type === 'application/pdf' ||
        file.type.startsWith('image/')
      ) {
        if (file.size > AI_CAPACITY_LIMITS.MAX_FILE_BYTES) {
          setError('El archivo supera el límite de 15 MB.');
          return;
        }
        const dataUrl = await fileToDataUrl(file);
        const commaIdx = dataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        setAttachedDoc({
          name: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          base64: rawBase64,
          dataUrl,
        });
      } else {
        setError(
          'Formato no compatible. Sube un archivo TXT, Markdown, CSV, PDF o imagen (PNG, JPG, WebP).'
        );
      }
    } catch {
      setError('No se pudo leer el documento seleccionado.');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isGenerating) return;

    const combinedText = [promptText.trim(), attachedDoc?.textContent?.trim()]
      .filter(Boolean)
      .join('\n\n');

    if (!combinedText && !attachedDoc?.base64) {
      setError('Escribe un protocolo clínico o adjunta un documento antes de generar.');
      return;
    }

    if (combinedText.length > AI_CAPACITY_LIMITS.MAX_TEXT_CHARS) {
      setError(
        `El texto combinado supera el máximo de ${AI_CAPACITY_LIMITS.MAX_TEXT_CHARS.toLocaleString('es-ES')} caracteres.`
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPaletteOpen(false);
    setEditPopoverOpen(false);

    try {
      const isAttachedImage = Boolean(
        attachedDoc?.dataUrl && attachedDoc.mimeType.startsWith('image/')
      );

      let uploadBase64 = attachedDoc?.base64;
      let uploadMimeType = attachedDoc?.base64 ? attachedDoc.mimeType : undefined;

      if (isAttachedImage && attachedDoc?.dataUrl) {
        const prepared = await prepareImageForGemini(attachedDoc.dataUrl);
        uploadBase64 = prepared.base64;
        uploadMimeType = prepared.mimeType;
      }

      const trimmedTitle = customTitle.trim();
      const trimmedRef = customReference.trim();
      const trimmedContext = algorithmContext.trim();

      const response = await fetch('/api/generate-algorithm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isAttachedImage ? 'image-digitize' : 'text',
          clinicalText: combinedText,
          documentBase64: uploadBase64,
          documentMimeType: uploadMimeType,
          documentName: attachedDoc?.name,
          colorPaletteName: activePalette.name,
          colorPaletteColors: activePalette.previewDots,
          customTitle: trimmedTitle || undefined,
          hasReference: Boolean(trimmedRef),
          customReference: trimmedRef || undefined,
          algorithmContext: trimmedContext || undefined,
        }),
      });

      const payload = await parseApiDiagramResponse(response);

      if (!response.ok || !payload.diagram) {
        throw new Error(
          payload.error || 'No se pudo generar el algoritmo. Intenta nuevamente.'
        );
      }

      const sourceImageDataUrl = isAttachedImage ? attachedDoc?.dataUrl : undefined;
      const normalized = normalizeAiDiagramPayload(payload.diagram, {
        sourceImageDataUrl,
      });

      const resolvedTitle = trimmedTitle || normalized.title;
      const resolvedTags =
        selectedTags.length > 0 ? normalizeTags(selectedTags) : normalized.tags;
      const resolvedReference = trimmedRef || normalized.reference;
      const resolvedClinicalContext = normalized.clinicalContext
        ? normalized.clinicalContext
        : trimmedContext
          ? { summary: trimmedContext }
          : undefined;

      const styledDiagram: EditableDiagram = {
        ...normalized,
        title: resolvedTitle,
        tags: resolvedTags,
        ...(resolvedReference ? { reference: resolvedReference } : {}),
        ...(resolvedClinicalContext ? { clinicalContext: resolvedClinicalContext } : {}),
        colorMode: 'color',
        paletteId: selectedPaletteId,
      };

      const imageDataUrl = serializeDiagramToSvgDataUrl(styledDiagram);

      await onGeneratedAlgorithmReady({
        title: styledDiagram.title,
        subtitle: styledDiagram.subtitle,
        tags: styledDiagram.tags,
        imageDataUrl,
        sourceImageDataUrl,
        reference: styledDiagram.reference,
        notes: styledDiagram.notes,
        diagram: styledDiagram,
      });

      setPromptText('');
      setAttachedDoc(null);
      setCustomTitle('');
      setSelectedTags([]);
      setCustomTagInput('');
      setCustomReference('');
      setAlgorithmContext('');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error de conexión al generar el algoritmo.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Top-Left Brand Title Only */}
      <header className="flex h-16 w-full items-center px-6 sm:px-9">
        <span className="text-[16px] font-bold tracking-[-0.02em] text-[#1D1D1F]">
          Algoritmo Nutricional
        </span>
      </header>

      <main className="flex flex-1 items-center justify-center px-16 pb-16 sm:px-24">
        {/* Center Hero Greeting & AI Prompt Card (dead-center horizontally & vertically in fullscreen) */}
        <section
          aria-label="Generador de algoritmos con inteligencia artificial"
          className="mx-auto w-full max-w-[780px] py-6"
        >
          <h1 className="mb-7 text-[26px] font-bold leading-tight tracking-[-0.028em] text-[#1D1D1F] sm:text-[31px]">
            Hola, ¿en qué te puedo ayudar?
          </h1>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="relative rounded-[22px] border border-[#E2E6EE] bg-white shadow-[0_14px_40px_-18px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.04)] transition-shadow focus-within:border-[#CBD5E1] focus-within:shadow-[0_18px_46px_-18px_rgba(15,23,42,0.16)]"
          >
            {/* Subtle Pale-Blue Top Tab Header with "Algoritmo" pill & "Editar" dropdown button */}
            <div className="relative flex items-center gap-2 rounded-t-[21px] border-b border-[#EDF1F7] bg-gradient-to-r from-[#EBF4FE] via-[#F3F8FE] to-[#F9FBFE] px-3 py-2.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#1D1D1F] shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]">
                <Workflow className="h-3.5 w-3.5 text-[#3A3A3C]" aria-hidden="true" />
                <span>Algoritmo</span>
              </div>

              <button
                ref={editBtnRef}
                type="button"
                data-testid="home-edit-options-btn"
                disabled={isGenerating}
                aria-expanded={editPopoverOpen}
                aria-haspopup="dialog"
                onClick={() => {
                  setPaletteOpen(false);
                  setEditPopoverOpen((prev) => !prev);
                }}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] disabled:opacity-50 ${
                  editPopoverOpen
                    ? 'bg-[#262626] text-white shadow-xs'
                    : hasEditConfig
                      ? 'bg-white text-[#1D1D1F] shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-[#0071E3]/35 hover:bg-[#F8FAFC]'
                      : 'text-[#4B5563] hover:bg-white/80 hover:text-[#1D1D1F]'
                }`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Editar</span>
                {hasEditConfig && !editPopoverOpen && (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-[#0071E3]"
                  />
                )}
              </button>

              {/* Floating Dropdown Panel for "Editar" (Metadata & Context for AI) */}
              {editPopoverOpen && (
                <div
                  ref={editPopoverRef}
                  role="dialog"
                  aria-label="Configurar datos y contexto del algoritmo"
                  data-testid="home-ai-edit-popover"
                  style={
                    editPopoverPos
                      ? { top: editPopoverPos.top, left: editPopoverPos.left }
                      : { top: 16, left: 16, visibility: 'hidden' }
                  }
                  className="mac-toast-in fixed z-50 flex max-h-[calc(100vh-32px)] w-[min(520px,calc(100vw-32px))] flex-col rounded-[20px] border border-[#DFE3EA] bg-white p-4 sm:p-5 shadow-[0_22px_52px_-14px_rgba(15,23,42,0.18),0_4px_14px_-2px_rgba(15,23,42,0.06)]"
                >
                  <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto no-scrollbar pr-0.5">
                    {/* 1. Nombre del algoritmo */}
                    <div>
                      <label
                        htmlFor="home-edit-algo-title"
                        className="mb-1.5 block text-[12.5px] font-semibold text-[#1D1D1F]"
                      >
                        Nombre del algoritmo
                      </label>
                      <input
                        id="home-edit-algo-title"
                        data-testid="home-edit-title-input"
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="h-9 w-full rounded-xl border border-[#DFE3EA] bg-white px-3.5 text-[13.5px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
                      />
                    </div>

                    {/* 2. Categoría a la que pertenece + 3. Agregar otra etiqueta */}
                    <div>
                      <span className="mb-1.5 block text-[12.5px] font-semibold text-[#1D1D1F]">
                        Categoría a la que pertenece
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_TAGS.map((tag) => {
                          const isSelected = selectedTags.some(
                            (t) => normalizeSearchText(t) === normalizeSearchText(tag)
                          );
                          return (
                            <button
                              key={tag}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => togglePresetTag(tag)}
                              className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                                isSelected
                                  ? 'border-[#0071E3] bg-[#0071E3] text-white'
                                  : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#374151] hover:border-[#CBD5E1] hover:bg-white'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>

                      {customOnlyTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {customOnlyTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#1D1D1F]/15 bg-[#F3F4F6] px-2.5 py-1 text-[12px] font-medium text-[#1D1D1F]"
                            >
                              {tag}
                              <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                aria-label={`Quitar etiqueta ${tag}`}
                                className="rounded-full p-0.5 text-[#6E6E73] hover:bg-white hover:text-[#1D1D1F]"
                              >
                                <X className="h-3 w-3" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          data-testid="home-edit-custom-tag-input"
                          value={customTagInput}
                          onChange={(e) => setCustomTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomTag();
                            }
                          }}
                          aria-label="Agregar otra etiqueta"
                          className="h-9 flex-1 rounded-xl border border-[#DFE3EA] bg-white px-3 text-[13px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
                        />
                        <button
                          type="button"
                          onClick={addCustomTag}
                          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#DFE3EA] bg-[#F8FAFC] px-3 text-[12.5px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F3F4F6]"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          Añadir
                        </button>
                      </div>
                    </div>

                    {/* 4. Referencia */}
                    <div>
                      <label
                        htmlFor="home-edit-algo-reference"
                        className="mb-1.5 block text-[12.5px] font-semibold text-[#1D1D1F]"
                      >
                        Referencia
                      </label>
                      <input
                        id="home-edit-algo-reference"
                        type="text"
                        data-testid="home-edit-reference-input"
                        value={customReference}
                        onChange={(e) => setCustomReference(e.target.value)}
                        aria-label="Referencia"
                        className="h-9 w-full rounded-xl border border-[#DFE3EA] bg-white px-3.5 text-[13.5px] text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
                      />
                    </div>

                    {/* 5. Contexto del algoritmo (únicamente para guiar a la IA) */}
                    <div>
                      <label
                        htmlFor="home-edit-algo-context"
                        className="mb-1.5 block text-[12.5px] font-semibold text-[#1D1D1F]"
                      >
                        Contexto del algoritmo
                      </label>
                      <textarea
                        id="home-edit-algo-context"
                        data-testid="home-edit-context-textarea"
                        rows={3}
                        value={algorithmContext}
                        onChange={(e) => setAlgorithmContext(e.target.value)}
                        className="w-full resize-none rounded-xl border border-[#DFE3EA] bg-white p-2.5 text-[13px] leading-relaxed text-[#1D1D1F] focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
                      />
                    </div>
                  </div>

                  {/* Popover Footer */}
                  <div className="mt-3.5 flex shrink-0 items-center justify-between border-t border-[#EDF1F7] pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTitle('');
                        setSelectedTags([]);
                        setCustomTagInput('');
                        setCustomReference('');
                        setAlgorithmContext('');
                      }}
                      className="text-[12.5px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
                    >
                      Limpiar
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditPopoverOpen(false)}
                        className="h-9 rounded-xl border border-[#DFE3EA] bg-white px-3.5 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        data-testid="home-edit-apply-btn"
                        onClick={() => setEditPopoverOpen(false)}
                        className="h-9 rounded-xl bg-[#0071E3] px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-[#0077ED]"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Input Surface */}
            <div className="p-4 sm:p-5">
              {/* Top Row: "+" Add Document button + optional attached file preview */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  data-testid="home-attach-doc-btn"
                  disabled={isGenerating}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Más: agregar documento"
                  title="Agregar documento o imagen (PDF, TXT, CSV, PNG, JPG, WebP)"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#D5DAE3] bg-white text-[#525866] transition-colors hover:border-[#0071E3] hover:bg-[#F8FAFC] hover:text-[#0071E3] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>

                {attachedDoc && (
                  <div
                    data-testid="home-attached-doc-chip"
                    className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[#E2E6EE] bg-[#F8FAFC] py-1.5 pl-2 pr-2.5"
                  >
                    {attachedDoc.dataUrl && attachedDoc.mimeType.startsWith('image/') ? (
                      <img
                        src={attachedDoc.dataUrl}
                        alt={attachedDoc.name}
                        className="h-7 w-7 rounded-lg object-cover ring-1 ring-black/10"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EBF4FE] text-[#0071E3]">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="block max-w-[220px] truncate text-[12.5px] font-medium text-[#1D1D1F]">
                        {attachedDoc.name}
                      </span>
                      <span className="block text-[10.5px] text-[#6E6E73]">
                        {formatFileSize(attachedDoc.sizeBytes)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedDoc(null)}
                      disabled={isGenerating}
                      aria-label="Quitar documento adjunto"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#E5E7EB] hover:text-[#1D1D1F]"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.pdf,text/plain,text/markdown,application/pdf,image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label="Seleccionar documento clínico o imagen"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileSelected(file);
                    e.target.value = '';
                  }}
                />
              </div>

              {/* Clean Borderless Textarea */}
              <textarea
                data-testid="home-ai-textarea"
                value={promptText}
                disabled={isGenerating}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Pega un protocolo nutricional, caso clínico o adjunta un documento con +…"
                aria-label="Instrucciones o protocolo clínico para generar el algoritmo"
                rows={3}
                className="mt-3 min-h-[82px] w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[#1D1D1F] placeholder:text-[#9CA3AF] focus:outline-none disabled:opacity-60"
              />

              {error && (
                <p
                  role="alert"
                  className="mt-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2 text-[12.5px] font-medium text-[#991B1B]"
                >
                  {error}
                </p>
              )}

              {/* Bottom Controls Row: Left Palette Picker + Right Upload/Submit Arrow */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="relative flex items-center gap-2">
                  <button
                    ref={paletteBtnRef}
                    type="button"
                    data-testid="home-palette-btn"
                    disabled={isGenerating}
                    onClick={() => {
                      setEditPopoverOpen(false);
                      setPaletteOpen((prev) => !prev);
                    }}
                    aria-expanded={paletteOpen}
                    aria-haspopup="dialog"
                    aria-label={`Seleccionar paleta de colores (actual: ${activePalette.name})`}
                    title={`Paleta de colores: ${activePalette.name}`}
                    className={`inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                      paletteOpen || hasChosenPalette
                        ? 'bg-[#F3F4F6] text-[#1D1D1F] hover:bg-[#E5E7EB]'
                        : 'text-[#3A3A3C] hover:bg-[#F3F4F6] hover:text-[#1D1D1F]'
                    }`}
                  >
                    <Palette className="h-[18px] w-[18px]" aria-hidden="true" />
                    {hasChosenPalette && (
                      <>
                        <span className="flex items-center gap-1" aria-hidden="true">
                          {activePalette.previewDots.map((hex, i) => (
                            <span
                              key={`active-dot-${i}`}
                              style={{ backgroundColor: hex }}
                              className="h-3 w-3 rounded-full border border-black/15"
                            />
                          ))}
                        </span>
                        <span className="hidden sm:inline max-w-[140px] truncate text-[12px] text-[#374151]">
                          {activePalette.name}
                        </span>
                      </>
                    )}
                  </button>

                  <PalettePickerPopover
                    open={paletteOpen}
                    selectedPaletteId={selectedPaletteId}
                    anchorRef={paletteBtnRef}
                    onSelectPalette={(id) => {
                      setSelectedPaletteId(id);
                      setHasChosenPalette(true);
                    }}
                    onClose={() => setPaletteOpen(false)}
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  {isGenerating && (
                    <span className="text-[12.5px] font-medium text-[#6E6E73]">
                      Generando algoritmo…
                    </span>
                  )}
                  <button
                    type="submit"
                    data-testid="home-generate-submit-btn"
                    disabled={!canSubmit}
                    aria-label="Generar algoritmo nutricional"
                    title="Generar algoritmo"
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2 ${
                      canSubmit
                        ? 'bg-[#262626] text-white shadow-xs hover:bg-[#111111] active:scale-95'
                        : 'bg-[#EEF1F6] text-[#8E95A2] cursor-default'
                    }`}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#262626]" aria-hidden="true" />
                    ) : (
                      <ArrowUp className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};
