export type HighlightColor = 'yellow' | 'mint' | 'sky';

export interface NormalizedPoint {
  /** X coordinate normalized to [0, 1] relative to image display width */
  x: number;
  /** Y coordinate normalized to [0, 1] relative to image display height */
  y: number;
}

export interface HighlightStroke {
  id: string;
  color: HighlightColor;
  /** Stroke width normalized relative to image width (e.g. 0.018) */
  width: number;
  points: NormalizedPoint[];
}

export type NodeShape =
  | 'process'
  | 'decision'
  | 'pill'
  | 'oval'
  | 'diamond'
  | 'parallelogram'
  | 'hexagon'
  | 'block-arrow'
  | 'thin-arrow'
  | 'double-arrow';

export type NodeTone = 'white' | 'gray' | 'mint' | 'amber' | 'rose' | 'blue';
export type EdgeStyle = 'solid' | 'dashed' | 'straight';
export type DiagramColorMode = 'color' | 'grayscale';
export type DiagramPaletteId =
  | 'organic-blend'
  | 'clean-clinical'
  | 'lab-blue'
  | 'water-violet'
  | 'optic-light'
  | 'cyto-neon'
  | 'original'
  | 'tech-blue'
  | 'fresh-green'
  | 'elegant-purple'
  | 'warm-amber'
  | 'soft-rose'
  | 'nordic-forest'
  | 'clinical-coral'
  | 'deep-ocean'
  | 'soft-lavender'
  | 'warm-sand'
  | 'tech-graphite'
  | 'vital-emerald'
  | 'medical-indigo'
  | 'modern-terracotta'
  | 'alpine-sky'
  | 'clinical-plum'
  | 'botanical-olive';

export interface DiagramNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  body: string;
  shape: NodeShape;
  tone: NodeTone;
  /** Optional clinical comment attached to this section */
  comment?: string;
  /** Optional custom font size (px) for the node title */
  titleFontSize?: number;
  /** Optional custom font size (px) for the node body */
  bodyFontSize?: number;
  /** Optional opacity (0–1) for the node title */
  titleOpacity?: number;
  /** Optional opacity (0–1) for the node body */
  bodyOpacity?: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  style: EdgeStyle;
  /** Optional custom font size (px) for the connector label */
  labelFontSize?: number;
  /** Optional opacity (0–1) for the connector label */
  labelOpacity?: number;
}

export interface DiagramClinicalContext {
  /** Concise clinical introduction explaining what the algorithm is about */
  summary: string;
  /** Target patient population identified in the text or file */
  targetPopulation?: string;
  /** Clinical care setting (e.g., UCI, Hospitalización, Perioperatorio) */
  clinicalSetting?: string;
  /** Medical-nutritional guideline or protocol identified (e.g., ESPEN, ASPEN, ERAS) */
  protocolSource?: string;
  /** Main therapeutic or nutritional goal of the protocol */
  primaryObjective?: string;
}

export interface EditableDiagram {
  title: string;
  subtitle: string;
  tags: string[];
  notes: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  /** Extracted clinical introduction & protocol context identifying what the algorithm covers */
  clinicalContext?: DiagramClinicalContext;
  /** Bibliographic or clinical guideline reference extracted from source */
  reference?: string;
  /** Original source image data URL when digitized from an uploaded image */
  sourceImageDataUrl?: string;
  /** Global color mode ('color' | 'grayscale') */
  colorMode?: DiagramColorMode;
  /** Preset global color palette applied to the entire algorithm */
  paletteId?: DiagramPaletteId;
  /** Global adaptive font scale multiplier (default 1, range 0.75–1.6) */
  fontScale?: number;
}

export interface AlgorithmItem {
  id: string;
  title: string;
  /** Short clinical description explaining what the algorithm covers */
  subtitle?: string;
  /** Clinical group / protocol classification displayed in the viewer header */
  groupLabel?: string;
  tags: string[];
  /** Base64 data URL (image/png, image/jpeg, image/webp, image/svg+xml) */
  imageDataUrl: string;
  /** Original uploaded image preserved for corner reference when digitized into an editable diagram */
  sourceImageDataUrl?: string;
  /** Optional bibliographic / clinical guideline reference */
  reference?: string;
  /** Optional clinical notes stored per algorithm */
  notes: string;
  /** Non-destructive highlighter strokes stored in normalized coordinates */
  strokes: HighlightStroke[];
  /** Editable Freeform/AI graph persisted in IndexedDB for future re-editing */
  diagram?: EditableDiagram;
  createdAt: number;
  updatedAt: number;
  /** Marks built-in sample algorithms */
  isSample?: boolean;
}

export interface LibraryBackup {
  schemaVersion: 1;
  exportedAt: string;
  app: 'biblioteca-algoritmos-nutricionales';
  algorithms: AlgorithmItem[];
}

export interface CardOriginRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const LIBRARY_FILTER_TAGS: readonly string[] = [
  'Cirugía',
  'Críticos',
  'Gastroenterología',
  'Neurología',
  'Nutrición enteral',
  'Nutrición parenteral',
  'Rehabilitación',
];

export const PRESET_TAGS: readonly string[] = [
  'Cirugía',
  'Críticos',
  'Gastroenterología',
  'Neurología',
  'Nutrición enteral',
  'Nutrición parenteral',
  'Rehabilitación',
];

export const HIGHLIGHTER_COLORS: Record<
  HighlightColor,
  { label: string; stroke: string; swatch: string; ring: string }
> = {
  yellow: {
    label: 'Amarillo',
    stroke: 'rgba(255, 224, 51, 0.48)',
    swatch: '#FFE033',
    ring: '#D4A800',
  },
  mint: {
    label: 'Verde menta',
    stroke: 'rgba(74, 222, 160, 0.44)',
    swatch: '#4ADEA0',
    ring: '#159963',
  },
  sky: {
    label: 'Azul cielo',
    stroke: 'rgba(78, 195, 255, 0.44)',
    swatch: '#4EC3FF',
    ring: '#0284C7',
  },
};

export const NODE_TONE_STYLES: Record<
  NodeTone,
  {
    label: string;
    fill: string;
    stroke: string;
    titleColor: string;
    bodyColor: string;
    swatch: string;
  }
> = {
  white: {
    label: 'Blanco',
    fill: '#FFFFFF',
    stroke: '#D1D1D6',
    titleColor: '#1D1D1F',
    bodyColor: '#3A3A3C',
    swatch: '#FFFFFF',
  },
  gray: {
    label: 'Gris neutro',
    fill: '#F5F5F7',
    stroke: '#D1D1D6',
    titleColor: '#1D1D1F',
    bodyColor: '#3A3A3C',
    swatch: '#E5E5EA',
  },
  blue: {
    label: 'Azul clínico',
    fill: '#F0F7FF',
    stroke: '#93C5FD',
    titleColor: '#0C4A6E',
    bodyColor: '#1E3A5F',
    swatch: '#BFDBFE',
  },
  mint: {
    label: 'Verde menta',
    fill: '#ECFDF5',
    stroke: '#6EE7B7',
    titleColor: '#065F46',
    bodyColor: '#1B4332',
    swatch: '#A7F3D0',
  },
  amber: {
    label: 'Ámbar alerta',
    fill: '#FFFBEB',
    stroke: '#FCD34D',
    titleColor: '#92400E',
    bodyColor: '#78350F',
    swatch: '#FDE68A',
  },
  rose: {
    label: 'Rojo suave',
    fill: '#FEF2F2',
    stroke: '#FCA5A5',
    titleColor: '#991B1B',
    bodyColor: '#7F1D1D',
    swatch: '#FECACA',
  },
};
