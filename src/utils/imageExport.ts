import type { AlgorithmItem } from '../types/algorithm';
import { serializeDiagramToSvgDataUrl } from './diagramEngine';

const MAX_EXPORT_EDGE_PX = 4096;
const TARGET_SVG_EXPORT_EDGE_PX = 3400;

/**
 * Builds a clean, filesystem-safe Spanish `.jpg` filename from an algorithm title.
 */
export function buildJpgExportFilename(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return `${slug || 'algoritmo-nutricional'}.jpg`;
}

/**
 * Extracts intrinsic width/height from an inline `data:image/svg+xml` URL
 * so viewers and exporters know the exact aspect ratio synchronously.
 */
export function parseSvgDataUrlDimensions(
  dataUrl: string
): { width: number; height: number } | null {
  if (!dataUrl.startsWith('data:image/svg+xml')) return null;

  let svgText = '';
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const payload = dataUrl.slice(commaIdx + 1);
    if (header.includes(';base64')) {
      svgText = typeof atob === 'function' ? atob(payload) : Buffer.from(payload, 'base64').toString('utf8');
    } else {
      svgText = decodeURIComponent(payload);
    }
  } catch {
    return null;
  }

  const svgTagMatch = svgText.match(/<svg\b[^>]*>/i);
  if (!svgTagMatch) return null;
  const tag = svgTagMatch[0];

  const viewBoxMatch = tag.match(/\bviewBox\s*=\s*["']\s*[-+]?\d*\.?\d+[\s,]+[-+]?\d*\.?\d+[\s,]+(\d*\.?\d+)[\s,]+(\d*\.?\d+)\s*["']/i);
  if (viewBoxMatch) {
    const vbW = Number(viewBoxMatch[1]);
    const vbH = Number(viewBoxMatch[2]);
    if (Number.isFinite(vbW) && Number.isFinite(vbH) && vbW > 0 && vbH > 0) {
      return { width: Math.round(vbW), height: Math.round(vbH) };
    }
  }

  const widthMatch = tag.match(/\bwidth\s*=\s*["'](\d*\.?\d+)(?:px)?["']/i);
  const heightMatch = tag.match(/\bheight\s*=\s*["'](\d*\.?\d+)(?:px)?["']/i);
  if (widthMatch && heightMatch) {
    const w = Number(widthMatch[1]);
    const h = Number(heightMatch[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { width: Math.round(w), height: Math.round(h) };
    }
  }

  return null;
}

/**
 * Computes crisp target canvas dimensions for JPG export.
 * - For vector SVGs, upscales cleanly (up to 3x / 3400px target, max 4096px) for print-sharp text.
 * - For raster images (PNG/JPG/WebP), preserves full native pixels capped at 4096px.
 */
export function computeExportCanvasSize(
  naturalWidth: number,
  naturalHeight: number,
  isSvg: boolean
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(naturalWidth));
  const safeH = Math.max(1, Math.round(naturalHeight));
  const maxEdge = Math.max(safeW, safeH);

  if (isSvg) {
    const desiredScale = Math.min(3, Math.max(2, TARGET_SVG_EXPORT_EDGE_PX / maxEdge));
    const clampedScale = Math.min(desiredScale, MAX_EXPORT_EDGE_PX / maxEdge);
    return {
      width: Math.max(1, Math.round(safeW * clampedScale)),
      height: Math.max(1, Math.round(safeH * clampedScale)),
    };
  }

  if (maxEdge > MAX_EXPORT_EDGE_PX) {
    const ratio = MAX_EXPORT_EDGE_PX / maxEdge;
    return {
      width: Math.max(1, Math.round(safeW * ratio)),
      height: Math.max(1, Math.round(safeH * ratio)),
    };
  }

  return { width: safeW, height: safeH };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para exportar.'));
    img.src = src;
  });
}

function triggerFileDownload(href: string, filename: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Renders an algorithm image (SVG vector diagram or uploaded raster image)
 * onto a high-resolution white-backed canvas and downloads it as a high-quality JPG.
 */
export async function exportAlgorithmAsJpg(algorithm: AlgorithmItem): Promise<string> {
  const sourceUrl = algorithm.diagram
    ? serializeDiagramToSvgDataUrl(algorithm.diagram)
    : algorithm.imageDataUrl;

  if (!sourceUrl) {
    throw new Error('Este algoritmo no tiene una imagen disponible para exportar.');
  }

  const isSvg = sourceUrl.startsWith('data:image/svg+xml');
  const svgDims = isSvg ? parseSvgDataUrlDimensions(sourceUrl) : null;
  const img = await loadImageElement(sourceUrl);

  const naturalW = img.naturalWidth || svgDims?.width || 1600;
  const naturalH = img.naturalHeight || svgDims?.height || 1000;
  const { width, height } = computeExportCanvasSize(naturalW, naturalH, isSvg);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo de exportación JPG.');
  }

  // Paint solid white background first so transparent PNG/SVG areas never turn black in JPEG
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const filename = buildJpgExportFilename(algorithm.title);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.95);
  });

  if (blob) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerFileDownload(objectUrl, filename);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
    return filename;
  }

  // Fallback for environments where toBlob returns null
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  triggerFileDownload(dataUrl, filename);
  return filename;
}
