import type { EditableDiagram } from '../types/algorithm';
import { normalizeTags } from './algorithmLogic';
import { normalizeAiDiagramPayload } from './diagramEngine';

const MAX_DIRECT_BASE64_LENGTH = 900 * 1024;
const MAX_RASTER_DIMENSION = 1600;

export interface PreparedGeminiImage {
  base64: string;
  mimeType: string;
}

export interface ApiDiagramResponse {
  diagram?: unknown;
  error?: string;
}

/**
 * Safely parses JSON from an API response without throwing cryptic
 * `Unexpected token '<', "<!doctype "...` syntax errors if a proxy or server
 * returns an HTML error/timeout/SPA page.
 */
export async function parseApiDiagramResponse(response: Response): Promise<ApiDiagramResponse> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as ApiDiagramResponse;
    } catch {
      // Fall through to descriptive error below
    }
  }

  if (response.status === 413) {
    return {
      error:
        'La imagen o archivo es demasiado pesado para enviarlo al servidor. Intenta con una captura más ligera.',
    };
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return {
      error:
        'El servicio de IA tardó demasiado o está temporalmente ocupado. Intenta nuevamente en unos segundos.',
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      error: 'La sesión de vista previa expiró o no tiene permisos. Recarga la página e intenta de nuevo.',
    };
  }

  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
    return {
      error:
        'El servidor respondió con HTML en lugar del servicio de IA. Recarga la página e intenta nuevamente.',
    };
  }

  return {
    error: `Error inesperado del servidor (HTTP ${response.status}). Intenta nuevamente.`,
  };
}

function rasterizeDataUrlToCanvas(
  dataUrl: string,
  targetMime: 'image/png' | 'image/jpeg',
  quality = 0.86
): Promise<PreparedGeminiImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth || 1200;
      const naturalH = img.naturalHeight || 900;
      const scale = Math.min(1, MAX_RASTER_DIMENSION / Math.max(naturalW, naturalH));
      const width = Math.max(1, Math.round(naturalW * scale));
      const height = Math.max(1, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo preparar la imagen para el análisis visual.'));
        return;
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const exported =
        targetMime === 'image/jpeg'
          ? canvas.toDataURL('image/jpeg', quality)
          : canvas.toDataURL('image/png');
      const commaIdx = exported.indexOf(',');
      if (commaIdx < 0) {
        reject(new Error('No se pudo codificar la imagen para enviarla a la IA.'));
        return;
      }

      resolve({
        base64: exported.slice(commaIdx + 1),
        mimeType: targetMime,
      });
    };
    img.onerror = () => {
      reject(new Error('No se pudo leer la imagen seleccionada para analizarla con IA.'));
    };
    img.src = dataUrl;
  });
}

/**
 * Extracts a compact, Gemini-compatible base64 + mimeType payload from any image data URL.
 * Automatically downscales/compresses large photos & rasterizes SVGs so the HTTP POST body stays
 * lightweight (~150KB–600KB) and fast while preserving the full original image locally.
 */
export async function prepareImageForGemini(imageDataUrl: string): Promise<PreparedGeminiImage> {
  const trimmed = imageDataUrl.trim();
  const base64Match = /^data:([^;,]+);base64,(.+)$/i.exec(trimmed);

  if (base64Match) {
    const mimeType = base64Match[1].toLowerCase();
    const base64 = base64Match[2];
    if (
      (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') &&
      base64.length <= MAX_DIRECT_BASE64_LENGTH
    ) {
      return { base64, mimeType };
    }
    return rasterizeDataUrlToCanvas(trimmed, 'image/jpeg', 0.86);
  }

  if (trimmed.startsWith('data:image/')) {
    return rasterizeDataUrlToCanvas(trimmed, 'image/jpeg', 0.88);
  }

  throw new Error('Formato de imagen no válido para digitalizar con IA.');
}

export interface DigitizeImageOptions {
  imageDataUrl: string;
  titleHint?: string;
  tagsHint?: string[];
  notesHint?: string;
  fileName?: string;
}

/**
 * Calls the server-side Gemini multimodal endpoint to transcribe an uploaded clinical algorithm image
 * into an editable Freeform diagram while attaching the original image for corner reference.
 */
export async function digitizeImageToDiagram(
  options: DigitizeImageOptions
): Promise<EditableDiagram> {
  const prepared = await prepareImageForGemini(options.imageDataUrl);

  const contextParts: string[] = [];
  if (options.titleHint?.trim()) {
    contextParts.push(`Título sugerido por el usuario: ${options.titleHint.trim()}`);
  }
  if (options.notesHint?.trim()) {
    contextParts.push(`Notas clínicas adicionales: ${options.notesHint.trim()}`);
  }

  const response = await fetch('/api/generate-algorithm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'image-digitize',
      clinicalText: contextParts.join('\n\n'),
      documentBase64: prepared.base64,
      documentMimeType: prepared.mimeType,
      documentName: options.fileName || options.titleHint || 'algoritmo-clinico.jpg',
    }),
  });

  const payload = await parseApiDiagramResponse(response);

  if (!response.ok || !payload.diagram) {
    throw new Error(
      payload.error || 'No se pudo digitalizar la imagen del algoritmo con Gemini. Intenta nuevamente.'
    );
  }

  const normalized = normalizeAiDiagramPayload(payload.diagram, {
    sourceImageDataUrl: options.imageDataUrl,
  });

  const mergedTags =
    options.tagsHint && options.tagsHint.length > 0
      ? normalizeTags([...options.tagsHint, ...normalized.tags])
      : normalized.tags;

  return {
    ...normalized,
    title: options.titleHint?.trim() || normalized.title,
    tags: mergedTags,
    notes: options.notesHint?.trim() || normalized.notes,
    sourceImageDataUrl: options.imageDataUrl,
  };
}
