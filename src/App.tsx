import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Folder, Home, ImagePlus, RotateCcw, SearchX } from 'lucide-react';
import {
  LIBRARY_FILTER_TAGS,
  type AlgorithmItem,
  type CardOriginRect,
  type EditableDiagram,
} from './types/algorithm';
import {
  filterAlgorithms,
  getNextViewerIndex,
} from './utils/algorithmLogic';
import {
  deleteAlgorithmById,
  getAllAlgorithms,
  putAlgorithm,
  restoreSampleAlgorithms,
} from './utils/db';
import { digitizeImageToDiagram } from './utils/imageDigitizer';
import { exportAlgorithmAsJpg } from './utils/imageExport';
import { createSeedAlgorithms } from './utils/seedData';
import { TopBar } from './components/TopBar';
import { FilterStrip } from './components/FilterStrip';
import { AlgorithmCard } from './components/AlgorithmCard';
import { UploadModal } from './components/UploadModal';
import { QuickLookViewer } from './components/QuickLookViewer';
import { DynamicStudyViewer } from './components/DynamicStudyViewer';
import { AlgorithmGenerator } from './components/AlgorithmGenerator';
import { HomeWorkspace } from './components/HomeWorkspace';
import { DropOverlay } from './components/DropOverlay';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useFullscreen } from './hooks/useFullscreen';

interface ToastMessage {
  id: number;
  text: string;
  tone: 'neutral' | 'error';
}

export default function App() {
  const [activePage, setActivePage] = useState<'home' | 'library'>('home');
  const [algorithms, setAlgorithms] = useState<AlgorithmItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpenTrigger, setSearchOpenTrigger] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Quick Look viewer state
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerOrigin, setViewerOrigin] = useState<CardOriginRect | null>(null);

  // Fullscreen Dynamic Study Viewer state ("Ver Todos")
  const [studyModeOpen, setStudyModeOpen] = useState(false);
  const [studyKeepFullscreenOnClose, setStudyKeepFullscreenOnClose] = useState(false);

  // Application-wide Fullscreen API controller
  const { isFullscreen, enterFullscreen, toggleFullscreen } = useFullscreen();

  // Visual Generator & AI Studio state ("Generador" + "Recorrido Guiado")
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorInitialAlgo, setGeneratorInitialAlgo] = useState<AlgorithmItem | null>(null);
  const [generatorOpenAiInitially, setGeneratorOpenAiInitially] = useState(false);
  const [generatorInitialMode, setGeneratorInitialMode] = useState<'edit' | 'walkthrough'>('edit');

  // Upload / Edit modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingAlgorithm, setEditingAlgorithm] = useState<AlgorithmItem | null>(null);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [digitizingAlgoId, setDigitizingAlgoId] = useState<string | null>(null);
  const [exportingAlgoId, setExportingAlgoId] = useState<string | null>(null);

  // Delete confirmation state
  const [pendingDelete, setPendingDelete] = useState<AlgorithmItem | null>(null);

  // Global drag-and-drop overlay state
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const dragDepthRef = useRef(0);

  // Subtle transient feedback toast
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((text: string, tone: 'neutral' | 'error' = 'neutral') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), text, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3400);
  }, []);

  // Load algorithms from IndexedDB on initial mount
  useEffect(() => {
    let active = true;
    getAllAlgorithms()
      .then((items) => {
        if (!active) return;
        setAlgorithms(items);
      })
      .catch(() => {
        if (!active) return;
        setAlgorithms(createSeedAlgorithms());
        showToast('Modo sin persistencia local: usando ejemplos precargados.', 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

  const handleToggleAppFullscreen = useCallback(() => {
    void toggleFullscreen().then((ok) => {
      if (!ok) {
        showToast('No fue posible activar la pantalla completa en esta ventana.', 'error');
      }
    });
  }, [toggleFullscreen, showToast]);

  // Global Shortcuts: Spotlight (Cmd+K / Ctrl+K) & App-Wide Fullscreen (F)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (viewerIndex !== null) {
          setViewerIndex(null);
        }
        if (studyModeOpen) {
          setStudyModeOpen(false);
        }
        setActivePage('library');
        setSearchOpenTrigger((n) => n + 1);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (
        !isTyping &&
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        (e.key.toLowerCase() === 'f' || e.code === 'KeyF')
      ) {
        e.preventDefault();
        handleToggleAppFullscreen();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [viewerIndex, studyModeOpen, handleToggleAppFullscreen]);

  // Global Drag & Drop Image Handler
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const handleDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsWindowDragging(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsWindowDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsWindowDragging(false);

      const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
        f.type.startsWith('image/')
      );
      if (file) {
        setViewerIndex(null);
        setEditingAlgorithm(null);
        setDroppedFile(file);
        setUploadOpen(true);
      } else {
        showToast('Arrastra un archivo de imagen válido (PNG, JPG, WebP o SVG).', 'error');
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [showToast]);

  const visibleAlgorithms = useMemo(
    () => filterAlgorithms(algorithms, searchQuery, activeTag),
    [algorithms, searchQuery, activeTag]
  );

  const viewerAlgorithms = activePage === 'home' ? algorithms : visibleAlgorithms;

  const handleOpenQuickLook = useCallback(
    (algorithm: AlgorithmItem, originRect: CardOriginRect) => {
      const idx = viewerAlgorithms.findIndex((item) => item.id === algorithm.id);
      if (idx === -1) return;
      setViewerOrigin(originRect);
      setViewerIndex(idx);
    },
    [viewerAlgorithms]
  );

  const handleNavigateQuickLook = useCallback(
    (direction: 'prev' | 'next') => {
      setViewerIndex((current) => {
        if (current === null) return null;
        return getNextViewerIndex(current, viewerAlgorithms.length, direction);
      });
    },
    [viewerAlgorithms.length]
  );

  const handleSaveAlgorithm = useCallback(
    async (payload: {
      id?: string;
      title: string;
      subtitle?: string;
      groupLabel?: string;
      tags: string[];
      imageDataUrl: string;
      sourceImageDataUrl?: string;
      reference?: string;
      notes: string;
      diagram?: EditableDiagram;
    }) => {
      const now = Date.now();
      const existing = payload.id
        ? algorithms.find((item) => item.id === payload.id)
        : undefined;

      const resolvedSourceImage =
        payload.sourceImageDataUrl ??
        payload.diagram?.sourceImageDataUrl ??
        existing?.sourceImageDataUrl;

      const resolvedSubtitle =
        payload.subtitle ??
        payload.diagram?.subtitle ??
        existing?.subtitle;

      const resolvedGroupLabel =
        payload.groupLabel ??
        existing?.groupLabel;

      const resolvedReference =
        payload.reference !== undefined
          ? payload.reference
          : payload.diagram?.reference ?? existing?.reference;

      const resolvedDiagram = payload.diagram
        ? payload.diagram
        : existing?.diagram
          ? {
              ...existing.diagram,
              title: payload.title,
              tags: payload.tags,
              notes: payload.notes,
            }
          : undefined;

      const record: AlgorithmItem = existing
        ? {
            ...existing,
            title: payload.title,
            ...(resolvedSubtitle ? { subtitle: resolvedSubtitle } : {}),
            ...(resolvedGroupLabel ? { groupLabel: resolvedGroupLabel } : {}),
            tags: payload.tags,
            imageDataUrl: payload.imageDataUrl,
            ...(resolvedSourceImage ? { sourceImageDataUrl: resolvedSourceImage } : {}),
            ...(resolvedReference !== undefined ? { reference: resolvedReference } : {}),
            notes: payload.notes,
            ...(resolvedDiagram ? { diagram: resolvedDiagram } : {}),
            updatedAt: now,
          }
        : {
            id: `algo-${now}-${Math.random().toString(36).slice(2, 7)}`,
            title: payload.title,
            ...(resolvedSubtitle ? { subtitle: resolvedSubtitle } : {}),
            ...(resolvedGroupLabel ? { groupLabel: resolvedGroupLabel } : {}),
            tags: payload.tags,
            imageDataUrl: payload.imageDataUrl,
            ...(resolvedSourceImage ? { sourceImageDataUrl: resolvedSourceImage } : {}),
            ...(resolvedReference ? { reference: resolvedReference } : {}),
            notes: payload.notes,
            strokes: [],
            ...(payload.diagram ? { diagram: payload.diagram } : {}),
            createdAt: now,
            updatedAt: now,
          };

      await putAlgorithm(record);
      setAlgorithms((prev) => {
        if (existing) {
          return prev.map((item) => (item.id === record.id ? record : item));
        }
        return [record, ...prev];
      });
      showToast(existing ? 'Algoritmo actualizado.' : 'Algoritmo agregado a la biblioteca.');
    },
    [algorithms, showToast]
  );

  const handleDigitizeUploadPayload = useCallback(
    async (payload: {
      id?: string;
      title: string;
      tags: string[];
      imageDataUrl: string;
      notes: string;
    }) => {
      const digitized = await digitizeImageToDiagram({
        imageDataUrl: payload.imageDataUrl,
        titleHint: payload.title,
        tagsHint: payload.tags,
        notesHint: payload.notes,
      });

      const existing = payload.id
        ? algorithms.find((item) => item.id === payload.id)
        : undefined;
      const now = Date.now();

      const draftAlgo: AlgorithmItem = existing
        ? {
            ...existing,
            title: digitized.title,
            ...(digitized.subtitle ? { subtitle: digitized.subtitle } : {}),
            ...(digitized.reference ? { reference: digitized.reference } : {}),
            tags: digitized.tags,
            notes: digitized.notes,
            sourceImageDataUrl: payload.imageDataUrl,
            diagram: digitized,
            updatedAt: now,
          }
        : {
            id: '',
            title: digitized.title,
            ...(digitized.subtitle ? { subtitle: digitized.subtitle } : {}),
            ...(digitized.reference ? { reference: digitized.reference } : {}),
            tags: digitized.tags,
            imageDataUrl: payload.imageDataUrl,
            sourceImageDataUrl: payload.imageDataUrl,
            notes: digitized.notes,
            strokes: [],
            diagram: digitized,
            createdAt: now,
            updatedAt: now,
          };

      setViewerIndex(null);
      setGeneratorInitialAlgo(draftAlgo.id ? draftAlgo : { ...draftAlgo, id: '' });
      setGeneratorOpenAiInitially(false);
      setGeneratorInitialMode('edit');
      setGeneratorOpen(true);
      showToast('Imagen digitalizada. Puedes editarla con la original siempre visible en la esquina.');
    },
    [algorithms, showToast]
  );

  const handleDigitizeExistingAlgorithm = useCallback(
    async (target: AlgorithmItem) => {
      if (digitizingAlgoId) return;
      setDigitizingAlgoId(target.id);
      try {
        const digitized = await digitizeImageToDiagram({
          imageDataUrl: target.sourceImageDataUrl ?? target.imageDataUrl,
          titleHint: target.title,
          tagsHint: target.tags,
          notesHint: target.notes,
        });

        const updatedDraft: AlgorithmItem = {
          ...target,
          title: digitized.title,
          ...(digitized.subtitle ? { subtitle: digitized.subtitle } : {}),
          ...(digitized.reference && !target.reference ? { reference: digitized.reference } : {}),
          tags: digitized.tags,
          notes: digitized.notes,
          sourceImageDataUrl: target.sourceImageDataUrl ?? target.imageDataUrl,
          diagram: digitized,
          updatedAt: Date.now(),
        };

        setViewerIndex(null);
        setGeneratorInitialAlgo(updatedDraft);
        setGeneratorOpenAiInitially(false);
        setGeneratorInitialMode('edit');
        setGeneratorOpen(true);
        showToast('Imagen digitalizada. Edita libremente con la original fija en la esquina.');
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'No se pudo convertir la imagen a diagrama editable.',
          'error'
        );
      } finally {
        setDigitizingAlgoId(null);
      }
    },
    [digitizingAlgoId, showToast]
  );

  const handleUpdateAlgorithm = useCallback((updated: AlgorithmItem) => {
    setAlgorithms((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    void putAlgorithm(updated);
  }, []);

  const handleExportAlgorithmJpg = useCallback(
    async (target: AlgorithmItem) => {
      if (exportingAlgoId) return;
      setExportingAlgoId(target.id);
      try {
        await exportAlgorithmAsJpg(target);
        showToast(`"${target.title}" exportado en formato JPG.`);
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'No se pudo exportar la imagen como JPG.',
          'error'
        );
      } finally {
        setExportingAlgoId(null);
      }
    },
    [exportingAlgoId, showToast]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    await deleteAlgorithmById(target.id);
    setAlgorithms((prev) => prev.filter((item) => item.id !== target.id));
    setViewerIndex(null);
    showToast(`"${target.title}" eliminado.`);
  }, [pendingDelete, showToast]);

  const handleRestoreSamples = useCallback(async () => {
    const refreshed = await restoreSampleAlgorithms();
    setAlgorithms(refreshed);
    showToast('Ejemplos clínicos restaurados.');
  }, [showToast]);

  const handleOpenStudyMode = useCallback(() => {
    if (algorithms.length === 0) return;
    setViewerIndex(null);
    setStudyKeepFullscreenOnClose(isFullscreen);
    setStudyModeOpen(true);
    if (!isFullscreen) {
      void enterFullscreen();
    }
  }, [algorithms.length, isFullscreen, enterFullscreen]);

  const handleHomeGeneratedAlgorithm = useCallback(
    async (payload: {
      title: string;
      subtitle?: string;
      tags: string[];
      imageDataUrl: string;
      sourceImageDataUrl?: string;
      reference?: string;
      notes: string;
      diagram: EditableDiagram;
    }) => {
      await handleSaveAlgorithm(payload);
      setSearchQuery('');
      setActiveTag(null);
      setViewerOrigin(null);
      setViewerIndex(0);
    },
    [handleSaveAlgorithm]
  );

  const showFloatingSidebar = viewerIndex === null && !studyModeOpen && !generatorOpen;

  return (
    <div id="inicio" className="min-h-screen bg-white text-[#1D1D1F] flex flex-col">
      {/* Floating Left Navigation Pill (Home & Folder -> Biblioteca) */}
      {showFloatingSidebar && (
        <nav
          aria-label="Navegación principal"
          data-testid="floating-left-nav"
          className="fixed left-3.5 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white/95 p-1.5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.14)] backdrop-blur-md sm:left-5"
        >
          <button
            type="button"
            data-testid="nav-home-btn"
            onClick={() => {
              setActivePage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Inicio"
            aria-current={activePage === 'home' ? 'page' : undefined}
            title="Inicio"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
              activePage === 'home'
                ? 'bg-[#262626] text-white shadow-xs'
                : 'text-[#6E6E73] hover:bg-[#F3F4F6] hover:text-[#1D1D1F]'
            }`}
          >
            <Home className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-testid="nav-library-btn"
            onClick={() => {
              setActivePage('library');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            aria-label="Biblioteca"
            aria-current={activePage === 'library' ? 'page' : undefined}
            title="Biblioteca"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
              activePage === 'library'
                ? 'bg-[#262626] text-white shadow-xs'
                : 'text-[#6E6E73] hover:bg-[#F3F4F6] hover:text-[#1D1D1F]'
            }`}
          >
            <Folder className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      )}

      {activePage === 'home' ? (
        <HomeWorkspace onGeneratedAlgorithmReady={handleHomeGeneratedAlgorithm} />
      ) : (
        <div className="flex flex-1 flex-col bg-white">
          <TopBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            searchOpenTrigger={searchOpenTrigger}
          />

          <main className="flex-1 pb-12 pl-16 sm:pl-24">
            <FilterStrip
              availableTags={[...LIBRARY_FILTER_TAGS]}
              activeTag={activeTag}
              onSelectTag={setActiveTag}
              totalCount={algorithms.length}
              onOpenStudyMode={handleOpenStudyMode}
            />

            <section
              aria-label="Galería de algoritmos"
              className="w-full px-4 pt-1 sm:px-8"
            >
              {isLoading ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {[0, 1].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white"
                    >
                      <div className="aspect-[16/9] animate-pulse bg-[#F5F5F7]" />
                      <div className="space-y-2.5 p-4">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-[#F5F5F7]" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-[#F5F5F7]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : algorithms.length === 0 ? (
                <div className="mx-auto my-14 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-[#D1D1D6] bg-[#FAFAFC] px-8 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E5E5EA] bg-white text-[#1D1D1F]">
                    <ImagePlus className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h2 className="mt-4 text-[16px] font-semibold text-[#1D1D1F]">
                    Tu biblioteca está vacía
                  </h2>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#6E6E73]">
                    Arrastra una imagen clínica sobre esta pantalla, agrega un nuevo algoritmo o restaura los ejemplos precargados.
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAlgorithm(null);
                        setDroppedFile(null);
                        setUploadOpen(true);
                      }}
                      className="h-9 rounded-[10px] bg-[#1D1D1F] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#3A3A3C]"
                    >
                      Agregar Algoritmo
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRestoreSamples()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restaurar ejemplos
                    </button>
                  </div>
                </div>
              ) : visibleAlgorithms.length === 0 ? (
                <div className="mx-auto my-14 flex max-w-md flex-col items-center rounded-2xl border border-[#E5E5EA] bg-[#FAFAFC] px-8 py-12 text-center">
                  <SearchX className="h-7 w-7 text-[#8E8E93]" aria-hidden="true" />
                  <h2 className="mt-3 text-[15.5px] font-semibold text-[#1D1D1F]">
                    Sin resultados para esta búsqueda
                  </h2>
                  <p className="mt-1 text-[13.5px] text-[#6E6E73]">
                    No se encontraron algoritmos que coincidan con los filtros actuales.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveTag(null);
                    }}
                    className="mt-5 h-9 rounded-[10px] border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
                  >
                    Mostrar todos los algoritmos
                  </button>
                </div>
              ) : (
                <div
                  data-testid="algorithm-grid"
                  className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                >
                  {visibleAlgorithms.map((algo) => (
                    <AlgorithmCard
                      key={algo.id}
                      algorithm={algo}
                      onOpen={handleOpenQuickLook}
                      onExportJpg={(target) => void handleExportAlgorithmJpg(target)}
                      isExporting={exportingAlgoId === algo.id}
                      onEditMetadata={(target) => {
                        setEditingAlgorithm(target);
                        setDroppedFile(null);
                        setUploadOpen(true);
                      }}
                      onDelete={(target) => setPendingDelete(target)}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      )}

      {/* Full-Screen Algorithm Viewer (with Persistent 4-Button Header for Algoritmo, Recorrido, Editar & Notas) */}
      <QuickLookViewer
        algorithms={viewerAlgorithms}
        activeIndex={viewerIndex}
        originRect={viewerOrigin}
        onClose={() => setViewerIndex(null)}
        onNavigate={handleNavigateQuickLook}
        onUpdateAlgorithm={handleUpdateAlgorithm}
        onSaveEditedAlgorithm={async (payload) => {
          await handleSaveAlgorithm({
            ...payload,
            id: payload.id?.trim() ? payload.id : undefined,
          });
        }}
        onEditMetadata={(target) => {
          setEditingAlgorithm(target);
          setDroppedFile(null);
          setUploadOpen(true);
        }}
        onDigitizeAlgorithm={(target) => void handleDigitizeExistingAlgorithm(target)}
        isDigitizing={
          viewerIndex !== null &&
          viewerAlgorithms[viewerIndex] !== undefined &&
          digitizingAlgoId === viewerAlgorithms[viewerIndex].id
        }
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleAppFullscreen}
      />

      {/* Fullscreen Dynamic Study Viewer ("Ver Todos") */}
      <DynamicStudyViewer
        open={studyModeOpen}
        algorithms={algorithms}
        onClose={() => setStudyModeOpen(false)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleAppFullscreen}
        keepFullscreenOnClose={studyKeepFullscreenOnClose}
      />

      {/* Visual AI & Freeform Generator Studio ("Generador" + "Recorrido Guiado") */}
      {generatorOpen && (
        <AlgorithmGenerator
          initialAlgorithm={generatorInitialAlgo}
          openAiDrawerInitially={generatorOpenAiInitially}
          initialMode={generatorInitialMode}
          onBack={() => {
            setGeneratorOpen(false);
            setGeneratorInitialAlgo(null);
          }}
          onSaveToLibrary={async (payload) => {
            await handleSaveAlgorithm({
              ...payload,
              id: payload.id?.trim() ? payload.id : undefined,
            });
            setGeneratorOpen(false);
            setGeneratorInitialAlgo(null);
          }}
        />
      )}

      {/* Upload / Edit Modal */}
      <UploadModal
        open={uploadOpen}
        editingAlgorithm={editingAlgorithm}
        initialFile={droppedFile}
        onClose={() => {
          setUploadOpen(false);
          setEditingAlgorithm(null);
          setDroppedFile(null);
        }}
        onSave={handleSaveAlgorithm}
        onDigitizeToEditable={handleDigitizeUploadPayload}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Eliminar algoritmo"
        description={
          pendingDelete
            ? `¿Deseas eliminar "${pendingDelete.title}" junto con sus notas clínicas y trazos de resaltado? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />

      {/* Full-Window Drag & Drop Overlay */}
      <DropOverlay visible={isWindowDragging} />

      {/* Transient macOS Notification */}
      {toast && (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`mac-toast-in fixed bottom-6 right-6 z-50 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-lg ${
            toast.tone === 'error'
              ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
              : 'border-[#E5E5EA] mac-glass-strong text-[#1D1D1F]'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
