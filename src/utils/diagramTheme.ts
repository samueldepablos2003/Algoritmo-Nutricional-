import {
  NODE_TONE_STYLES,
  type DiagramColorMode,
  type DiagramNode,
  type DiagramPaletteId,
  type NodeShape,
  type NodeTone,
} from '../types/algorithm';

export interface ResolvedToneStyle {
  fill: string;
  stroke: string;
  titleColor: string;
  bodyColor: string;
}

export interface DiagramPaletteDefinition {
  id: DiagramPaletteId;
  name: string;
  /** 3 vertical color stripes matching the Formato palette selector swatches */
  swatches: [string, string, string];
  edgeColors: {
    default: string;
    positive: string;
    warning: string;
  };
  tones: Record<NodeTone, ResolvedToneStyle>;
}

export const DEFAULT_TITLE_FONT_SIZE = 14.5;
export const DEFAULT_BODY_FONT_SIZE = 12.5;
export const DEFAULT_EDGE_LABEL_FONT_SIZE = 11.5;

const GRAYSCALE_TONES: Record<NodeTone, ResolvedToneStyle> = {
  white: {
    fill: '#FFFFFF',
    stroke: '#B8B8BF',
    titleColor: '#111113',
    bodyColor: '#3A3A3C',
  },
  gray: {
    fill: '#ECECF0',
    stroke: '#8E8E93',
    titleColor: '#111113',
    bodyColor: '#2C2C2E',
  },
  blue: {
    fill: '#DCDCE2',
    stroke: '#636366',
    titleColor: '#111113',
    bodyColor: '#2C2C2E',
  },
  mint: {
    fill: '#E4E4EA',
    stroke: '#787880',
    titleColor: '#111113',
    bodyColor: '#2C2C2E',
  },
  amber: {
    fill: '#CFCFD6',
    stroke: '#48484A',
    titleColor: '#0E0E10',
    bodyColor: '#262628',
  },
  rose: {
    fill: '#C2C2CA',
    stroke: '#3A3A3C',
    titleColor: '#0A0A0C',
    bodyColor: '#1C1C1E',
  },
};

export const DIAGRAM_PALETTES: readonly DiagramPaletteDefinition[] = [
  {
    id: 'original',
    name: 'Original',
    swatches: ['#334155', '#94A3B8', '#0F172A'],
    edgeColors: {
      default: '#52525B',
      positive: '#15803D',
      warning: '#B45309',
    },
    tones: {
      white: {
        fill: '#FFFFFF',
        stroke: '#C7C7CC',
        titleColor: '#1D1D1F',
        bodyColor: '#3A3A3C',
      },
      gray: {
        fill: '#EFEFF4',
        stroke: '#A1A1AA',
        titleColor: '#18181B',
        bodyColor: '#3F3F46',
      },
      blue: {
        fill: '#DBEAFE',
        stroke: '#3B82F6',
        titleColor: '#1E3A8A',
        bodyColor: '#1E40AF',
      },
      mint: {
        fill: '#D1FAE5',
        stroke: '#10B981',
        titleColor: '#065F46',
        bodyColor: '#047857',
      },
      amber: {
        fill: '#FEF3C7',
        stroke: '#F59E0B',
        titleColor: '#92400E',
        bodyColor: '#78350F',
      },
      rose: {
        fill: '#FFE4E6',
        stroke: '#F43F5E',
        titleColor: '#9F1239',
        bodyColor: '#881337',
      },
    },
  },
  {
    id: 'tech-blue',
    name: 'Azul tecnológico',
    swatches: ['#0284C7', '#7DD3FC', '#0C4A6E'],
    edgeColors: {
      default: '#0369A1',
      positive: '#0284C7',
      warning: '#1D4ED8',
    },
    tones: {
      white: {
        fill: '#F0F9FF',
        stroke: '#7DD3FC',
        titleColor: '#0C4A6E',
        bodyColor: '#0369A1',
      },
      gray: {
        fill: '#E0F2FE',
        stroke: '#38BDF8',
        titleColor: '#075985',
        bodyColor: '#0C4A6E',
      },
      blue: {
        fill: '#BAE6FD',
        stroke: '#0284C7',
        titleColor: '#082F49',
        bodyColor: '#0C4A6E',
      },
      mint: {
        fill: '#CFFAFE',
        stroke: '#06B6D4',
        titleColor: '#155E75',
        bodyColor: '#164E63',
      },
      amber: {
        fill: '#DBEAFE',
        stroke: '#2563EB',
        titleColor: '#1E3A8A',
        bodyColor: '#1D4ED8',
      },
      rose: {
        fill: '#C7D2FE',
        stroke: '#4F46E5',
        titleColor: '#312E81',
        bodyColor: '#3730A3',
      },
    },
  },
  {
    id: 'fresh-green',
    name: 'Verde fresco',
    swatches: ['#16A34A', '#86EFAC', '#14532D'],
    edgeColors: {
      default: '#15803D',
      positive: '#059669',
      warning: '#4D7C0F',
    },
    tones: {
      white: {
        fill: '#F0FDF4',
        stroke: '#86EFAC',
        titleColor: '#14532D',
        bodyColor: '#166534',
      },
      gray: {
        fill: '#DCFCE7',
        stroke: '#4ADE80',
        titleColor: '#14532D',
        bodyColor: '#15803D',
      },
      blue: {
        fill: '#A7F3D0',
        stroke: '#059669',
        titleColor: '#064E3B',
        bodyColor: '#065F46',
      },
      mint: {
        fill: '#99F6E4',
        stroke: '#0D9488',
        titleColor: '#134E4A',
        bodyColor: '#115E59',
      },
      amber: {
        fill: '#D9F99D',
        stroke: '#65A30D',
        titleColor: '#365314',
        bodyColor: '#3F6212',
      },
      rose: {
        fill: '#BBF7D0',
        stroke: '#16A34A',
        titleColor: '#052E16',
        bodyColor: '#14532D',
      },
    },
  },
  {
    id: 'elegant-purple',
    name: 'Púrpura elegante',
    swatches: ['#7C3AED', '#C4B5FD', '#3B0764'],
    edgeColors: {
      default: '#6D28D9',
      positive: '#7C3AED',
      warning: '#A21CAF',
    },
    tones: {
      white: {
        fill: '#F5F3FF',
        stroke: '#C4B5FD',
        titleColor: '#3B0764',
        bodyColor: '#5B21B6',
      },
      gray: {
        fill: '#EDE9FE',
        stroke: '#A78BFA',
        titleColor: '#4C1D95',
        bodyColor: '#5B21B6',
      },
      blue: {
        fill: '#DDD6FE',
        stroke: '#7C3AED',
        titleColor: '#2E1065',
        bodyColor: '#4C1D95',
      },
      mint: {
        fill: '#E0E7FF',
        stroke: '#6366F1',
        titleColor: '#312E81',
        bodyColor: '#3730A3',
      },
      amber: {
        fill: '#E9D5FF',
        stroke: '#9333EA',
        titleColor: '#581C87',
        bodyColor: '#6B21A8',
      },
      rose: {
        fill: '#F5D0FE',
        stroke: '#C026D3',
        titleColor: '#701A75',
        bodyColor: '#86198F',
      },
    },
  },
  {
    id: 'warm-amber',
    name: 'Ámbar cálido',
    swatches: ['#EA580C', '#FCD34D', '#78350F'],
    edgeColors: {
      default: '#B45309',
      positive: '#D97706',
      warning: '#C2410C',
    },
    tones: {
      white: {
        fill: '#FFFBEB',
        stroke: '#FCD34D',
        titleColor: '#78350F',
        bodyColor: '#92400E',
      },
      gray: {
        fill: '#FEF3C7',
        stroke: '#F59E0B',
        titleColor: '#78350F',
        bodyColor: '#92400E',
      },
      blue: {
        fill: '#FDE68A',
        stroke: '#D97706',
        titleColor: '#713F12',
        bodyColor: '#78350F',
      },
      mint: {
        fill: '#FEF08A',
        stroke: '#CA8A04',
        titleColor: '#713F12',
        bodyColor: '#854D0E',
      },
      amber: {
        fill: '#FED7AA',
        stroke: '#EA580C',
        titleColor: '#7C2D12',
        bodyColor: '#9A3412',
      },
      rose: {
        fill: '#FECACA',
        stroke: '#DC2626',
        titleColor: '#7F1D1D',
        bodyColor: '#991B1B',
      },
    },
  },
  {
    id: 'soft-rose',
    name: 'Rosa suave',
    swatches: ['#E11D48', '#FDA4AF', '#881337'],
    edgeColors: {
      default: '#BE123C',
      positive: '#E11D48',
      warning: '#9F1239',
    },
    tones: {
      white: {
        fill: '#FFF1F2',
        stroke: '#FDA4AF',
        titleColor: '#881337',
        bodyColor: '#9F1239',
      },
      gray: {
        fill: '#FFE4E6',
        stroke: '#FB7185',
        titleColor: '#881337',
        bodyColor: '#9F1239',
      },
      blue: {
        fill: '#FECDD3',
        stroke: '#E11D48',
        titleColor: '#4C0519',
        bodyColor: '#881337',
      },
      mint: {
        fill: '#FCE7F3',
        stroke: '#EC4899',
        titleColor: '#831843',
        bodyColor: '#9D174D',
      },
      amber: {
        fill: '#FBCFE8',
        stroke: '#DB2777',
        titleColor: '#831843',
        bodyColor: '#9D174D',
      },
      rose: {
        fill: '#FDA4AF',
        stroke: '#BE123C',
        titleColor: '#4C0519',
        bodyColor: '#881337',
      },
    },
  },
];

const PALETTE_MAP = new Map<DiagramPaletteId, DiagramPaletteDefinition>(
  DIAGRAM_PALETTES.map((p) => [p.id, p])
);

export function getPaletteDefinition(paletteId?: DiagramPaletteId): DiagramPaletteDefinition {
  return PALETTE_MAP.get(paletteId ?? 'original') ?? DIAGRAM_PALETTES[0];
}

export function resolveNodeColors(
  tone: NodeTone,
  paletteId?: DiagramPaletteId,
  colorMode?: DiagramColorMode
): ResolvedToneStyle {
  if (colorMode === 'grayscale') {
    return GRAYSCALE_TONES[tone] ?? GRAYSCALE_TONES.white;
  }
  const palette = getPaletteDefinition(paletteId);
  return palette.tones[tone] ?? palette.tones.white;
}

export function resolveEdgeColor(
  semanticBaseColor: string,
  paletteId?: DiagramPaletteId,
  colorMode?: DiagramColorMode
): string {
  if (colorMode === 'grayscale') {
    if (semanticBaseColor === '#15803D') return '#3A3A3C';
    if (semanticBaseColor === '#B45309') return '#52525B';
    return '#6E6E73';
  }
  const palette = getPaletteDefinition(paletteId);
  if (semanticBaseColor === '#15803D') return palette.edgeColors.positive;
  if (semanticBaseColor === '#B45309') return palette.edgeColors.warning;
  return palette.edgeColors.default;
}

export function resolveEdgeBadgeColors(
  semanticBaseColor: string,
  paletteId?: DiagramPaletteId,
  colorMode?: DiagramColorMode
): { fill: string; text: string } {
  if (colorMode === 'grayscale') {
    return { fill: '#EFEFF4', text: '#1D1D1F' };
  }
  if (!paletteId || paletteId === 'original') {
    if (semanticBaseColor === '#15803D') return { fill: '#DCFCE7', text: '#166534' };
    if (semanticBaseColor === '#B45309') return { fill: '#FEF3C7', text: '#92400E' };
    return { fill: '#F5F5F7', text: '#1D1D1F' };
  }
  const palette = getPaletteDefinition(paletteId);
  const accentTone =
    semanticBaseColor === '#15803D'
      ? palette.tones.mint
      : semanticBaseColor === '#B45309'
        ? palette.tones.amber
        : palette.tones.gray;
  return { fill: accentTone.fill, text: accentTone.titleColor };
}

/**
 * Returns true if the shape requires a custom vector polygon/ellipse backdrop
 * rather than a simple CSS rounded box.
 */
export function isCustomSvgShape(shape: NodeShape): boolean {
  return (
    shape === 'oval' ||
    shape === 'diamond' ||
    shape === 'parallelogram' ||
    shape === 'hexagon' ||
    shape === 'block-arrow' ||
    shape === 'thin-arrow' ||
    shape === 'double-arrow'
  );
}

/**
 * Generates an SVG primitive string (rect, ellipse, or polygon) inside local coordinates [0..width, 0..height]
 * offset by (x, y). Used identically by the live React canvas, Walkthrough stage, and final SVG export.
 */
export function buildNodeShapeSvgMarkup(
  shape: NodeShape,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  strokeWidth: number
): string {
  const pad = strokeWidth / 2 + 0.5;
  const left = x + pad;
  const top = y + pad;
  const right = x + width - pad;
  const bottom = y + height - pad;
  const w = Math.max(4, right - left);
  const h = Math.max(4, bottom - top);
  const cx = left + w / 2;
  const cy = top + h / 2;

  const fmt = (n: number) => Number(n.toFixed(2));
  const pts = (coords: Array<[number, number]>) =>
    coords.map(([px, py]) => `${fmt(px)},${fmt(py)}`).join(' ');

  switch (shape) {
    case 'oval':
      return `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(w / 2)}" ry="${fmt(h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

    case 'diamond':
      return `<polygon points="${pts([
        [cx, top],
        [right, cy],
        [cx, bottom],
        [left, cy],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;

    case 'parallelogram': {
      const skew = Math.min(w * 0.16, 36);
      return `<polygon points="${pts([
        [left + skew, top],
        [right, top],
        [right - skew, bottom],
        [left, bottom],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    case 'hexagon': {
      const indent = Math.min(w * 0.14, 34);
      return `<polygon points="${pts([
        [left + indent, top],
        [right - indent, top],
        [right, cy],
        [right - indent, bottom],
        [left + indent, bottom],
        [left, cy],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    case 'block-arrow': {
      const headW = Math.min(w * 0.2, 46);
      const shaftTop = top + h * 0.16;
      const shaftBottom = bottom - h * 0.16;
      return `<polygon points="${pts([
        [left, shaftTop],
        [right - headW, shaftTop],
        [right - headW, top],
        [right, cy],
        [right - headW, bottom],
        [right - headW, shaftBottom],
        [left, shaftBottom],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    case 'thin-arrow': {
      const headW = Math.min(w * 0.18, 42);
      const shaftTop = top + h * 0.24;
      const shaftBottom = bottom - h * 0.24;
      return `<polygon points="${pts([
        [left, shaftTop],
        [right - headW, shaftTop],
        [right - headW, top],
        [right, cy],
        [right - headW, bottom],
        [right - headW, shaftBottom],
        [left, shaftBottom],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    case 'double-arrow': {
      const headW = Math.min(w * 0.16, 38);
      const shaftTop = top + h * 0.18;
      const shaftBottom = bottom - h * 0.18;
      return `<polygon points="${pts([
        [left, cy],
        [left + headW, top],
        [left + headW, shaftTop],
        [right - headW, shaftTop],
        [right - headW, top],
        [right, cy],
        [right - headW, bottom],
        [right - headW, shaftBottom],
        [left + headW, shaftBottom],
        [left + headW, bottom],
      ])}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    case 'pill': {
      const rx = Math.round(h / 2);
      return `<rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(w)}" height="${fmt(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }

    case 'decision':
      return `<rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(w)}" height="${fmt(h)}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

    case 'process':
    default:
      return `<rect x="${fmt(left)}" y="${fmt(top)}" width="${fmt(w)}" height="${fmt(h)}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }
}

/**
 * Computes safe inner horizontal/vertical padding for text inside geometric shapes
 * so text never collides with diagonal edges or arrow tips.
 */
export function getShapeInnerPadding(shape: NodeShape): { px: number; py: number } {
  switch (shape) {
    case 'diamond':
      return { px: 42, py: 24 };
    case 'oval':
      return { px: 32, py: 18 };
    case 'parallelogram':
      return { px: 34, py: 12 };
    case 'hexagon':
      return { px: 32, py: 12 };
    case 'block-arrow':
    case 'thin-arrow':
      return { px: 28, py: 16 };
    case 'double-arrow':
      return { px: 38, py: 16 };
    default:
      return { px: 16, py: 10 };
  }
}

export interface AdaptiveNodeMetrics {
  titleFontSize: number;
  bodyFontSize: number;
  titleOpacity: number;
  bodyOpacity: number;
  width: number;
  height: number;
}

/**
 * Computes effective font sizes and adaptive box sizing for a node given the global
 * `fontScale` (e.g. 0.75–1.6) and any per-text overrides on the node.
 * When `fontScale` increases (or per-node font size increases), the box smoothly adapts
 * its height (and gently widens when needed) so text never clips or overflows inside its division.
 */
export function computeAdaptiveNodeMetrics(
  node: DiagramNode,
  fontScale = 1
): AdaptiveNodeMetrics {
  const safeScale = Math.min(1.6, Math.max(0.75, Number.isFinite(fontScale) ? fontScale : 1));
  const baseTitle = node.titleFontSize ?? DEFAULT_TITLE_FONT_SIZE;
  const baseBody = node.bodyFontSize ?? DEFAULT_BODY_FONT_SIZE;

  const titleFontSize = Number((baseTitle * safeScale).toFixed(2));
  const bodyFontSize = Number((baseBody * safeScale).toFixed(2));
  const titleOpacity =
    typeof node.titleOpacity === 'number' && Number.isFinite(node.titleOpacity)
      ? Math.min(1, Math.max(0, node.titleOpacity))
      : 1;
  const bodyOpacity =
    typeof node.bodyOpacity === 'number' && Number.isFinite(node.bodyOpacity)
      ? Math.min(1, Math.max(0, node.bodyOpacity))
      : 1;

  // Determine whether any text scale exceeds default baseline and adapt container dimensions gracefully
  const effectiveGrowth = Math.max(
    safeScale,
    titleFontSize / DEFAULT_TITLE_FONT_SIZE,
    bodyFontSize / DEFAULT_BODY_FONT_SIZE
  );

  // Gently widen box up to +24% when fonts grow larger, keeping layout crisp and balanced
  const adaptiveWidth =
    effectiveGrowth > 1.02
      ? Math.round(node.width * (1 + Math.min(0.24, (effectiveGrowth - 1) * 0.4)))
      : node.width;

  const { px, py } = getShapeInnerPadding(node.shape);
  const innerWidth = Math.max(96, adaptiveWidth - px * 2);

  const avgTitleCharW = titleFontSize * 0.57;
  const avgBodyCharW = bodyFontSize * 0.54;
  const titleCharsPerLine = Math.max(8, Math.floor(innerWidth / avgTitleCharW));
  const bodyCharsPerLine = Math.max(10, Math.floor(innerWidth / avgBodyCharW));

  const countWrappedLines = (text: string, maxChars: number): number => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split('\n').reduce((sum, para) => {
      const len = para.trim().length;
      if (len === 0) return sum;
      return sum + Math.max(1, Math.ceil(len / maxChars));
    }, 0);
  };

  const titleLines = countWrappedLines(node.title, titleCharsPerLine);
  const bodyLines = countWrappedLines(node.body, bodyCharsPerLine);

  const titleLineHeight = titleFontSize * 1.32;
  const bodyLineHeight = bodyFontSize * 1.34;
  const gap = titleLines > 0 && bodyLines > 0 ? Math.max(4, Math.round(4 * safeScale)) : 0;
  const requiredContentHeight =
    titleLines * titleLineHeight + gap + bodyLines * bodyLineHeight + py * 2 + 8;

  // For diamond/arrow shapes, allow extra vertical room because the tapered geometry narrows top/bottom
  const shapeHeightFactor =
    node.shape === 'diamond'
      ? 1.35
      : node.shape === 'block-arrow' || node.shape === 'thin-arrow' || node.shape === 'double-arrow'
        ? 1.24
        : 1;

  const adaptiveHeight = Math.max(
    node.height,
    Math.ceil(requiredContentHeight * shapeHeightFactor)
  );

  return {
    titleFontSize,
    bodyFontSize,
    titleOpacity,
    bodyOpacity,
    width: adaptiveWidth,
    height: adaptiveHeight,
  };
}

export const ALL_NODE_SHAPE_LABELS: Record<NodeShape, string> = {
  oval: 'Óvalo',
  process: 'Rectángulo',
  diamond: 'Rombo',
  pill: 'Rectángulo redondeado',
  parallelogram: 'Paralelogramo',
  hexagon: 'Hexágono',
  'block-arrow': 'Flecha de bloque',
  'thin-arrow': 'Bloque fino',
  'double-arrow': 'Doble bloque',
  decision: 'Decisión',
};
