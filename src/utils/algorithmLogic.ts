import type { AlgorithmItem, HighlightColor, HighlightStroke, LibraryBackup } from '../types/algorithm';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;

/**
 * Strips diacritics and lowercases text for fast, forgiving Spanish search
 * (e.g. "nutricion" matches "Nutrición", "criticos" matches "Críticos").
 */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Normalizes and deduplicates a list of tags while preserving first-seen casing.
 */
export function normalizeTags(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    const cleaned = raw.trim().replace(/\s+/g, ' ');
    if (!cleaned) continue;
    const key = normalizeSearchText(cleaned);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result;
}

/**
 * Extracts all unique categories/tags present across the library sorted alphabetically.
 */
export function collectAvailableTags(algorithms: AlgorithmItem[]): string[] {
  const tagMap = new Map<string, string>();
  for (const algo of algorithms) {
    for (const tag of algo.tags) {
      const key = normalizeSearchText(tag);
      if (key && !tagMap.has(key)) {
        tagMap.set(key, tag.trim());
      }
    }
  }
  return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

/**
 * Filters algorithms by Spotlight query (matches title, tags, or notes) and optional active category.
 */
export function filterAlgorithms(
  algorithms: AlgorithmItem[],
  query: string,
  activeTag: string | null
): AlgorithmItem[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];
  const normalizedActiveTag = activeTag ? normalizeSearchText(activeTag) : null;

  return algorithms.filter((algo) => {
    if (normalizedActiveTag) {
      const hasTag = algo.tags.some((t) => normalizeSearchText(t) === normalizedActiveTag);
      if (!hasTag) return false;
    }

    if (queryTokens.length === 0) return true;

    const haystack = normalizeSearchText(
      [algo.title, algo.tags.join(' '), algo.notes].join(' ')
    );

    return queryTokens.every((token) => haystack.includes(token));
  });
}

/**
 * Clamps zoom scale smoothly within [MIN_ZOOM, MAX_ZOOM] rounded to 2 decimals.
 */
export function clampZoom(zoom: number): number {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  return Math.round(clamped * 100) / 100;
}

export function stepZoom(currentZoom: number, direction: 'in' | 'out'): number {
  const delta = direction === 'in' ? ZOOM_STEP : -ZOOM_STEP;
  return clampZoom(currentZoom + delta);
}

/**
 * Computes cyclic or clamped neighbor index for Quick Look navigation.
 */
export function getNextViewerIndex(
  currentIndex: number,
  total: number,
  direction: 'prev' | 'next'
): number {
  if (total <= 1) return currentIndex;
  if (direction === 'next') {
    return (currentIndex + 1) % total;
  }
  return (currentIndex - 1 + total) % total;
}

/**
 * Fisher-Yates shuffle for randomized active-recall study mode.
 * Returns a new array without mutating input. When `avoidFirstId` is provided
 * and there are at least 2 items, ensures the first item differs from `avoidFirstId`.
 */
export function shuffleAlgorithms<T extends { id: string }>(
  items: readonly T[],
  options?: { avoidFirstId?: string; random?: () => number }
): T[] {
  const copy = [...items];
  const rand = options?.random ?? Math.random;

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }

  if (options?.avoidFirstId && copy.length > 1 && copy[0].id === options.avoidFirstId) {
    const swapIdx = 1 + Math.floor(rand() * (copy.length - 1));
    const tmp = copy[0];
    copy[0] = copy[swapIdx];
    copy[swapIdx] = tmp;
  }

  return copy;
}

/**
 * Computes normalized progress ratio [0..1] for the minimalist study progress bar.
 */
export function getStudyProgressRatio(currentIndex: number, total: number): number {
  if (total <= 0) return 0;
  const clamped = Math.min(total - 1, Math.max(0, currentIndex));
  return (clamped + 1) / total;
}

/**
 * Immutable highlighter stroke stack helpers.
 */
export function appendStroke(
  strokes: HighlightStroke[],
  newStroke: HighlightStroke
): HighlightStroke[] {
  if (newStroke.points.length === 0) return strokes;
  return [...strokes, newStroke];
}

export function undoLastStroke(strokes: HighlightStroke[]): HighlightStroke[] {
  if (strokes.length === 0) return strokes;
  return strokes.slice(0, -1);
}

/**
 * Creates a clean JSON backup envelope.
 */
export function createBackupPayload(algorithms: AlgorithmItem[]): LibraryBackup {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'biblioteca-algoritmos-nutricionales',
    algorithms,
  };
}

const VALID_COLORS = new Set<HighlightColor>(['yellow', 'mint', 'sky']);

function isValidStroke(candidate: unknown): candidate is HighlightStroke {
  if (!candidate || typeof candidate !== 'object') return false;
  const s = candidate as Record<string, unknown>;
  if (typeof s.id !== 'string' || !VALID_COLORS.has(s.color as HighlightColor)) return false;
  if (typeof s.width !== 'number' || !Number.isFinite(s.width) || s.width <= 0) return false;
  if (!Array.isArray(s.points)) return false;
  return s.points.every(
    (p) =>
      p &&
      typeof p === 'object' &&
      typeof (p as Record<string, unknown>).x === 'number' &&
      typeof (p as Record<string, unknown>).y === 'number'
  );
}

/**
 * Parses and strictly validates an imported JSON backup file.
 * Supports both wrapped LibraryBackup objects and raw AlgorithmItem[] arrays.
 */
export function parseBackupJson(rawJson: string): {
  ok: true;
  algorithms: AlgorithmItem[];
} | {
  ok: false;
  error: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'El archivo no contiene un JSON válido.' };
  }

  let items: unknown;
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).algorithms)
  ) {
    items = (parsed as Record<string, unknown>).algorithms;
  } else {
    return {
      ok: false,
      error: 'Estructura de respaldo no reconocida. Se esperaba una lista de algoritmos.',
    };
  }

  const list = items as unknown[];
  if (list.length === 0) {
    return { ok: false, error: 'El respaldo JSON no contiene ningún algoritmo.' };
  }

  const sanitized: AlgorithmItem[] = [];
  const now = Date.now();

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `Registro #${i + 1} inválido en el respaldo.` };
    }

    const record = item as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const imageDataUrl =
      typeof record.imageDataUrl === 'string' ? record.imageDataUrl.trim() : '';

    if (!title) {
      return { ok: false, error: `El algoritmo #${i + 1} no tiene un título válido.` };
    }
    if (!imageDataUrl.startsWith('data:image/')) {
      return {
        ok: false,
        error: `El algoritmo "${title}" no contiene una imagen codificada válida.`,
      };
    }

    const rawTags = Array.isArray(record.tags)
      ? record.tags.filter((t): t is string => typeof t === 'string')
      : [];

    const strokes = Array.isArray(record.strokes)
      ? record.strokes.filter(isValidStroke)
      : [];

    const rawSourceImage =
      typeof record.sourceImageDataUrl === 'string' ? record.sourceImageDataUrl.trim() : '';
    const validSourceImage = rawSourceImage.startsWith('data:image/')
      ? rawSourceImage
      : undefined;

    sanitized.push({
      id:
        typeof record.id === 'string' && record.id.trim()
          ? record.id.trim()
          : `imported-${now}-${i}`,
      title,
      tags: normalizeTags(rawTags),
      imageDataUrl,
      ...(validSourceImage ? { sourceImageDataUrl: validSourceImage } : {}),
      ...(typeof record.reference === 'string' && record.reference.trim()
        ? { reference: record.reference.trim() }
        : {}),
      notes: typeof record.notes === 'string' ? record.notes : '',
      strokes,
      ...(record.diagram && typeof record.diagram === 'object'
        ? { diagram: record.diagram as AlgorithmItem['diagram'] }
        : {}),
      createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
    });
  }

  return { ok: true, algorithms: sanitized };
}
