import React, { useRef, useState } from 'react';
import { ChevronLeft, FileText, FileUp, Loader2, Sparkles, X } from 'lucide-react';
import type { EditableDiagram } from '../types/algorithm';
import { normalizeAiDiagramPayload } from '../utils/diagramEngine';
import { parseApiDiagramResponse, prepareImageForGemini } from '../utils/imageDigitizer';

interface GeneratorAiDrawerProps {
  visible?: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onDiagramGenerated: (diagram: EditableDiagram) => void;
}

interface AttachedDocument {
  name: string;
  mimeType: string;
  base64?: string;
  dataUrl?: string;
  textContent?: string;
}

const SAMPLE_PROTOCOLS: Array<{ label: string; text: string }> = [
  {
    label: 'Síndrome de Realimentación',
    text: `Protocolo de Prevención y Manejo del Síndrome de Realimentación (ASPEN):
1. Evaluar riesgo al ingreso (IMC < 16, pérdida de peso > 15% en 3-6 meses, ayuno > 10 días, o electrolitos séricos bajos en fósforo, potasio o magnesio).
2. ¿Riesgo moderado o alto de síndrome de realimentación?
   - Si NO hay riesgo: iniciar nutrición enteral o parenteral a velocidad estándar (20-25 kcal/kg/día) con monitoreo habitual.
   - Si SÍ hay riesgo alto: administrar tiamina IV 100-300 mg antes de iniciar aporte calórico y reponer fósforo, potasio y magnesio.
3. Inicio calórico conservador: 10-15 kcal/kg/día durante las primeras 24-48 horas (máx. 5-10 kcal/kg/d en riesgo extremo).
4. Monitoreo de electrolitos cada 12 horas los primeros 3 días.
   - ¿Caída de fósforo, potasio o magnesio > 20% o síntomas clínicos?
     * Si SÍ: pausar progresión calórica, reponer electrolitos vía IV y vigilar balance hídrico.
     * Si NO (electrolitos estables): progresar aporte en 33% de la meta cada 1-2 días hasta alcanzar 25-30 kcal/kg/día.`,
  },
  {
    label: 'Cirugía Gastrointestinal (ERAS)',
    text: `Algoritmo de Nutrición Perioperatoria en Cirugía Gastrointestinal Mayor (Guías ESPEN / ERAS):
1. Evaluación nutricional preoperatoria (NRS-2002, pérdida ponderal > 10%, albúmina < 3 g/dL).
2. ¿Presenta desnutrición severa preoperatoria?
   - Si SÍ: optimizar nutrición 7-14 días antes de cirugía con suplementación oral inmunomoduladora o NE; si tracto GI obstruido, usar NPT preoperatoria.
   - Si NO: aplicar protocolo ERAS estándar (carga de carbohidratos 2 h antes de anestesia, evitar ayuno prolongado).
3. Postoperatorio inmediato (primeras 24 horas): iniciar líquidos claros y dieta blanda temprana según tolerancia.
4. Reevaluar ingesta oral al día 3-5 postoperatorio.
   - ¿Cubre > 50% de requerimientos calóricos por vía oral?
     * Si SÍ: continuar dieta oral progresiva y alta con consejería nutricional.
     * Si NO: iniciar nutrición enteral suplementaria (SNG/yeyunostomía) o nutrición parenteral suplementaria si existe íleo paralítico o fuga anastomótica.`,
  },
];

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

export const GeneratorAiDrawer: React.FC<GeneratorAiDrawerProps> = ({
  visible = true,
  open,
  onToggleOpen,
  onClose,
  onDiagramGenerated,
}) => {
  const [clinicalText, setClinicalText] = useState('');
  const [attachedDoc, setAttachedDoc] = useState<AttachedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!visible) return null;

  const handleFileSelected = async (file: File) => {
    setError(null);
    const isPlainText =
      file.type.startsWith('text/') ||
      /\.(txt|md|csv)$/i.test(file.name);

    try {
      if (isPlainText) {
        const text = await file.text();
        setAttachedDoc({
          name: file.name,
          mimeType: file.type || 'text/plain',
          textContent: text,
        });
      } else if (
        file.type === 'application/pdf' ||
        file.type.startsWith('image/')
      ) {
        if (file.size > 15 * 1024 * 1024) {
          setError('El archivo supera el límite de 15 MB.');
          return;
        }
        const dataUrl = await fileToDataUrl(file);
        const commaIdx = dataUrl.indexOf(',');
        const rawBase64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        setAttachedDoc({
          name: file.name,
          mimeType: file.type,
          base64: rawBase64,
          dataUrl,
        });
      } else {
        setError('Formato no compatible. Sube un archivo TXT, Markdown, CSV, PDF o imagen.');
      }
    } catch {
      setError('No se pudo leer el documento seleccionado.');
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const combinedText = [clinicalText.trim(), attachedDoc?.textContent?.trim()]
      .filter(Boolean)
      .join('\n\n');

    if (!combinedText && !attachedDoc?.base64) {
      setError('Pega un texto clínico o adjunta un protocolo para generar el algoritmo.');
      return;
    }

    setIsGenerating(true);
    setError(null);

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

      const response = await fetch('/api/generate-algorithm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: isAttachedImage ? 'image-digitize' : 'text',
          clinicalText: combinedText,
          documentBase64: uploadBase64,
          documentMimeType: uploadMimeType,
          documentName: attachedDoc?.name,
        }),
      });

      const payload = await parseApiDiagramResponse(response);

      if (!response.ok || !payload.diagram) {
        throw new Error(
          payload.error || 'No se pudo generar el algoritmo con Gemini. Intenta nuevamente.'
        );
      }

      const sourceImageDataUrl = isAttachedImage ? attachedDoc?.dataUrl : undefined;

      const normalized = normalizeAiDiagramPayload(payload.diagram, {
        sourceImageDataUrl,
      });
      onDiagramGenerated(normalized);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error de conexión al comunicarse con el servidor de generación.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      data-testid="ai-drawer-wrapper"
      data-open={open ? 'true' : 'false'}
      className={`absolute inset-y-0 left-0 z-30 flex transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:relative lg:shrink-0 lg:translate-x-0 ${
        open
          ? 'w-[min(380px,calc(100vw-28px))] translate-x-0 lg:w-[380px]'
          : 'w-[min(380px,calc(100vw-28px))] -translate-x-full lg:w-0'
      }`}
    >
      <aside
        aria-label="Panel de generación de algoritmos con IA"
        aria-hidden={!open}
        className={`flex h-full w-full flex-col overflow-hidden mac-glass-strong transition-opacity duration-200 ${
          open
            ? 'border-r border-[#E5E5EA] opacity-100 shadow-[12px_0_36px_-16px_rgba(29,29,31,0.12)] lg:shadow-none'
            : 'pointer-events-none border-r-0 opacity-0'
        }`}
      >
        <div className="flex h-full w-[min(380px,calc(100vw-28px))] flex-col overflow-hidden lg:w-[380px]">
          <form onSubmit={handleGenerate} noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {/* Quick Clinical Protocol Examples */}
        <div>
          <span className="block text-[12px] font-medium text-[#6E6E73] mb-1.5">
            Cargar protocolo de ejemplo
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PROTOCOLS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setClinicalText(sample.text);
                  setError(null);
                }}
                className="rounded-lg border border-[#E5E5EA] bg-white/90 px-2.5 py-1 text-[12px] font-medium text-[#1D1D1F] transition-colors hover:bg-white hover:border-[#0071E3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clinical Text Input */}
        <div className="flex flex-1 flex-col">
          <label
            htmlFor="ai-clinical-text"
            className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5"
          >
            Agregar texto
          </label>
          <textarea
            id="ai-clinical-text"
            value={clinicalText}
            onChange={(e) => {
              setClinicalText(e.target.value);
              if (error) setError(null);
            }}
            className="min-h-[210px] flex-1 w-full resize-none rounded-xl border border-[#E5E5EA] bg-white/95 p-3.5 text-[13px] leading-relaxed text-[#1D1D1F] placeholder:text-[#8E8E93] focus:border-[#0071E3] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15"
          />
        </div>

        {/* Document or Image Uploader */}
        <div>
          <span className="block text-[12.5px] font-medium text-[#1D1D1F] mb-1.5">
            O adjunta un archivo o imagen{' '}
            <span className="font-normal text-[#8E8E93]">(PNG, JPG, PDF, TXT, MD)</span>
          </span>

          {attachedDoc ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[#0071E3]" aria-hidden="true" />
                <span className="truncate text-[12.5px] font-medium text-[#1D1D1F]">
                  {attachedDoc.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedDoc(null)}
                aria-label="Quitar documento adjunto"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#6E6E73] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D1D6] bg-white/75 px-4 py-3 text-[12.5px] font-medium text-[#1D1D1F] transition-colors hover:border-[#0071E3] hover:bg-white"
            >
              <FileUp className="h-4 w-4 text-[#6E6E73]" aria-hidden="true" />
              Subir archivo
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.csv,.pdf,text/plain,text/markdown,application/pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Seleccionar archivo clínico"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileSelected(file);
              e.target.value = '';
            }}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-[12.5px] font-medium text-[#991B1B]"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isGenerating}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0071E3] px-4 text-[13.5px] font-medium text-white shadow-[0_1px_3px_rgba(0,113,227,0.3)] transition-all hover:bg-[#0077ED] active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Analizando protocolo…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Generar
            </>
          )}
        </button>
          </form>
        </div>
      </aside>

      {/* Dynamic Minimal Edge Toggle Arrow */}
      <button
        type="button"
        onClick={onToggleOpen}
        data-testid="ai-drawer-toggle"
        aria-expanded={open}
        aria-label={open ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
        title={open ? 'Ocultar panel' : 'Mostrar panel'}
        className="group absolute left-full top-1/2 z-40 flex h-8 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-[#E5E5EA] bg-[#F5F5F7]/90 text-[#6E6E73] backdrop-blur-md shadow-[2px_0_8px_rgba(29,29,31,0.06)] transition-all duration-200 hover:w-5 hover:bg-white hover:text-[#1D1D1F] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
      >
        <ChevronLeft
          className={`h-3 w-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            open ? 'rotate-0' : 'rotate-180'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};
