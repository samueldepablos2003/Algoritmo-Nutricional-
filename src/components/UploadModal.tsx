import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { PRESET_TAGS, type AlgorithmItem } from '../types/algorithm';
import { normalizeSearchText, normalizeTags } from '../utils/algorithmLogic';

interface UploadModalProps {
  open: boolean;
  editingAlgorithm: AlgorithmItem | null;
  initialFile: File | null;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    title: string;
    tags: string[];
    imageDataUrl: string;
    reference?: string;
    notes: string;
  }) => Promise<void>;
  onDigitizeToEditable?: (payload: {
    id?: string;
    title: string;
    tags: string[];
    imageDataUrl: string;
    notes: string;
  }) => Promise<void>;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

function deriveTitleFromFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const UploadModal: React.FC<UploadModalProps> = ({
  open,
  editingAlgorithm,
  initialFile,
  onClose,
  onSave,
  onDigitizeToEditable,
}) => {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDigitizing, setIsDigitizing] = useState(false);
  const [isDraggingLocal, setIsDraggingLocal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setCustomTagInput('');
    setIsSaving(false);
    setIsDigitizing(false);

    if (editingAlgorithm) {
      setTitle(editingAlgorithm.title);
      setTags(editingAlgorithm.tags);
      setImageDataUrl(editingAlgorithm.imageDataUrl);
      setReference(editingAlgorithm.reference ?? '');
      setNotes(editingAlgorithm.notes);
    } else {
      setTitle('');
      setTags([]);
      setImageDataUrl('');
      setReference('');
      setNotes('');
    }
  }, [open, editingAlgorithm]);

  useEffect(() => {
    if (!open || !initialFile || editingAlgorithm) return;
    let cancelled = false;

    readFileAsDataUrl(initialFile)
      .then((dataUrl) => {
        if (cancelled) return;
        setImageDataUrl(dataUrl);
        setTitle((prev) => prev || deriveTitleFromFilename(initialFile.name));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo procesar la imagen arrastrada.');
      });

    return () => {
      cancelled = true;
    };
  }, [open, initialFile, editingAlgorithm]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen válido (PNG, JPG, WebP o SVG).');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      if (!title.trim()) {
        setTitle(deriveTitleFromFilename(file.name));
      }
      setError(null);
    } catch {
      setError('No se pudo cargar la imagen. Intenta con otro archivo.');
    }
  };

  const toggleTag = (tag: string) => {
    const key = normalizeSearchText(tag);
    setTags((prev) => {
      const exists = prev.some((t) => normalizeSearchText(t) === key);
      if (exists) {
        return prev.filter((t) => normalizeSearchText(t) !== key);
      }
      return [...prev, tag];
    });
  };

  const commitCustomTag = () => {
    const pieces = customTagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    setTags((prev) => normalizeTags([...prev, ...pieces]));
    setCustomTagInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTitle = title.trim();
    const pendingTags = customTagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalTags = normalizeTags([...tags, ...pendingTags]);

    if (!imageDataUrl) {
      setError('Debes seleccionar o arrastrar una imagen del algoritmo.');
      return;
    }
    if (!cleanedTitle) {
      setError('Ingresa un título descriptivo para el algoritmo.');
      titleInputRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        id: editingAlgorithm?.id,
        title: cleanedTitle,
        tags: finalTags,
        imageDataUrl,
        reference: reference.trim(),
        notes: notes.trim(),
      });
      onClose();
    } catch {
      setError('No se pudo guardar el algoritmo en el almacenamiento local.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDigitizeClick = async () => {
    if (!onDigitizeToEditable) return;
    if (!imageDataUrl) {
      setError('Selecciona primero la imagen del algoritmo que deseas convertir a editable.');
      return;
    }

    const pendingTags = customTagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const finalTags = normalizeTags([...tags, ...pendingTags]);

    setIsDigitizing(true);
    setError(null);
    try {
      await onDigitizeToEditable({
        id: editingAlgorithm?.id,
        title: title.trim(),
        tags: finalTags,
        imageDataUrl,
        notes: notes.trim(),
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo digitalizar la imagen con la IA. Intenta nuevamente.'
      );
    } finally {
      setIsDigitizing(false);
    }
  };

  const isEditing = Boolean(editingAlgorithm);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="mac-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-[#1D1D1F]/28 px-4 py-10 backdrop-blur-md sm:px-6 sm:py-12"
    >
      <div className="mac-sheet-in relative flex max-h-[min(640px,calc(100vh-6rem))] w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white shadow-[0_28px_70px_-20px_rgba(29,29,31,0.28)]">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5EA] bg-[#F5F5F7]/75 px-5 py-3.5">
          <h2
            id="upload-modal-title"
            className="text-[15.5px] font-semibold tracking-[-0.015em] text-[#1D1D1F]"
          >
            {isEditing ? 'Datos del Algoritmo' : 'Agregar Algoritmo'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#E5E5EA]/70 hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="h-[495.4px] min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Image Picker / Dropzone */}
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-2">
              Imagen del algoritmo
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingLocal(true);
              }}
              onDragLeave={() => setIsDraggingLocal(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingLocal(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleImageFile(file);
              }}
              className={`relative flex flex-col items-center justify-center rounded-xl border border-dashed transition-colors ${
                isDraggingLocal
                  ? 'border-[#0071E3] bg-[#F0F7FF]'
                  : 'border-[#D1D1D6] bg-[#FAFAFC] hover:border-[#AEAEB2]'
              } ${imageDataUrl ? 'p-3' : 'px-6 py-8'}`}
            >
              {imageDataUrl ? (
                <div className="w-full space-y-2.5">
                  <div className="relative h-32 w-full overflow-hidden rounded-lg border border-[#E5E5EA] bg-white">
                    <img
                      src={imageDataUrl}
                      alt="Vista previa del algoritmo"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#6E6E73]">Imagen lista en alta resolución</span>
                    <button
                      type="button"
                      disabled={isDigitizing}
                      onClick={() => fileInputRef.current?.click()}
                      className="font-medium text-[#0071E3] hover:underline disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] rounded"
                    >
                      Cambiar imagen
                    </button>
                  </div>
                  {onDigitizeToEditable && !editingAlgorithm?.diagram && (
                    <div className="flex flex-col gap-2 rounded-xl border border-[#0071E3]/20 bg-[#F0F7FF]/75 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[12px] leading-snug text-[#0C4A6E]">
                        Convierte esta imagen en cuadros y flechas editables conservando la original en una esquina.
                      </p>
                      <button
                        type="button"
                        data-testid="upload-digitize-btn"
                        disabled={isDigitizing || isSaving}
                        onClick={() => void handleDigitizeClick()}
                        className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#0071E3] px-3 text-[12px] font-medium text-white shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-colors hover:bg-[#0077ED] disabled:opacity-60 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-1"
                      >
                        {isDigitizing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Digitalizando…
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            Hacer editable con IA
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center text-center focus-visible:outline-none"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-[#E5E5EA] text-[#1D1D1F] shadow-xs">
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="mt-3 text-[13.5px] font-medium text-[#1D1D1F]">
                    Seleccionar imagen o arrastrar aquí
                  </span>
                  <span className="mt-1 text-[12px] text-[#6E6E73]">
                    PNG, JPG, WebP o SVG · Almacenamiento local sin compresión
                  </span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label="Subir archivo de imagen del algoritmo"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label
              htmlFor="algorithm-title-input"
              className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5"
            >
              Nombre del algoritmo
            </label>
            <input
              ref={titleInputRef}
              id="algorithm-title-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ej. Algoritmo de Nutrición Enteral en UCI"
              className="h-9 w-full rounded-[10px] border border-[#E5E5EA] bg-white px-3.5 text-[13.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] transition-all focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
            />
          </div>

          {/* Categories / Sections Selector */}
          <div>
            <label
              htmlFor="algorithm-custom-tag-input"
              className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5"
            >
              Sección / Categorías
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {PRESET_TAGS.map((preset) => {
                const active = tags.some(
                  (t) => normalizeSearchText(t) === normalizeSearchText(preset)
                );
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => toggleTag(preset)}
                    aria-pressed={active}
                    className={`rounded-lg border px-2.5 py-1 text-[12.5px] font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                      active
                        ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
                        : 'border-[#E5E5EA] bg-[#F5F5F7]/70 text-[#1D1D1F] hover:bg-[#E5E5EA]/70'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <input
                id="algorithm-custom-tag-input"
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCustomTag();
                  }
                }}
                placeholder="Agregar otra etiqueta (Enter)…"
                className="h-9 flex-1 rounded-[10px] border border-[#E5E5EA] bg-white px-3 text-[13px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
              />
              <button
                type="button"
                onClick={commitCustomTag}
                aria-label="Añadir etiqueta personalizada"
                className="inline-flex h-9 items-center gap-1 rounded-[10px] border border-[#E5E5EA] bg-[#F5F5F7] px-3 text-[12.5px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#E5E5EA] whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Añadir
              </button>
            </div>

            {tags.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[#6E6E73]">
                <span className="text-[#8E8E93]">Seleccionadas:</span>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={`Quitar etiqueta ${tag}`}
                    className="inline-flex items-center gap-1 rounded-md bg-[#F5F5F7] px-2 py-0.5 text-[#1D1D1F] hover:bg-[#FEE2E2] hover:text-[#991B1B] transition-colors"
                  >
                    <span>{tag}</span>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bibliographic / Guideline Reference */}
          <div>
            <label
              htmlFor="algorithm-reference-input"
              className="block text-[13px] font-medium text-[#1D1D1F] mb-1.5"
            >
              Referencia <span className="font-normal text-[#8E8E93]">(opcional)</span>
            </label>
            <input
              id="algorithm-reference-input"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. Guías ESPEN en Nutrición Clínica (2020–2024)…"
              className="h-9 w-full rounded-[10px] border border-[#E5E5EA] bg-white px-3.5 text-[13px] text-[#1D1D1F] placeholder:text-[#8E8E93] transition-all focus:border-[#0071E3] focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] font-medium text-[#991B1B]"
            >
              {error}
            </p>
          )}
          </div>

          {/* Fixed Footer Actions */}
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#E5E5EA] bg-white px-5 py-3.5">
            <button
              type="button"
              disabled={isDigitizing}
              onClick={onClose}
              className="h-9 rounded-[10px] border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7] disabled:opacity-50 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || isDigitizing}
              className="h-9 rounded-[10px] bg-[#0071E3] px-5 text-[13px] font-medium text-white transition-colors hover:bg-[#0077ED] disabled:opacity-50 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2"
            >
              {isSaving
                ? 'Guardando…'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Guardar algoritmo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
