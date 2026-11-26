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
  /** 4 circular preview dots displayed in the Home AI palette selector popover */
  previewDots: [string, string, string, string];
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
    id: 'organic-blend',
    name: 'Mezcla orgánica',
    swatches: ['#8C96B8', '#87C4D4', '#A7C97B'],
    previewDots: ['#D2D6E6', '#D5EEF2', '#E2F0CF', '#F3F0CB'],
    edgeColors: {
      default: '#5C6684',
      positive: '#4E8458',
      warning: '#9A7D2E',
    },
    tones: {
      white: {
        fill: '#FAFBF7',
        stroke: '#CFD6C7',
        titleColor: '#26302A',
        bodyColor: '#414F47',
      },
      gray: {
        fill: '#E6E9F2',
        stroke: '#A4AEC9',
        titleColor: '#28304A',
        bodyColor: '#3E4866',
      },
      blue: {
        fill: '#DDF1F5',
        stroke: '#77B7C7',
        titleColor: '#1C4854',
        bodyColor: '#295F6E',
      },
      mint: {
        fill: '#E6F2D6',
        stroke: '#94BA6C',
        titleColor: '#2D4D1E',
        bodyColor: '#3E662B',
      },
      amber: {
        fill: '#F6F3D2',
        stroke: '#C9BC5D',
        titleColor: '#594C13',
        bodyColor: '#73631B',
      },
      rose: {
        fill: '#EFE4EC',
        stroke: '#B895AE',
        titleColor: '#522C47',
        bodyColor: '#6B3D5E',
      },
    },
  },
  {
    id: 'clean-clinical',
    name: 'Clínico limpio',
    swatches: ['#4BA391', '#9AD6C8', '#24584E'],
    previewDots: ['#6AB5A4', '#AEDBD0', '#EDF6F2', '#E8E9EB'],
    edgeColors: {
      default: '#4B6460',
      positive: '#2F8A76',
      warning: '#3C756A',
    },
    tones: {
      white: {
        fill: '#FFFFFF',
        stroke: '#D5DFDC',
        titleColor: '#1B3631',
        bodyColor: '#36524C',
      },
      gray: {
        fill: '#ECEEEF',
        stroke: '#BAC3C5',
        titleColor: '#243033',
        bodyColor: '#414F52',
      },
      blue: {
        fill: '#D8EFE9',
        stroke: '#5CAA99',
        titleColor: '#174A40',
        bodyColor: '#226155',
      },
      mint: {
        fill: '#EBF6F2',
        stroke: '#8CC9BA',
        titleColor: '#1D5247',
        bodyColor: '#2A6B5D',
      },
      amber: {
        fill: '#E2F0EC',
        stroke: '#6CAFA0',
        titleColor: '#1A473E',
        bodyColor: '#295E53',
      },
      rose: {
        fill: '#E4ECEF',
        stroke: '#7E9AA3',
        titleColor: '#213B44',
        bodyColor: '#31515C',
      },
    },
  },
  {
    id: 'lab-blue',
    name: 'Azul de laboratorio',
    swatches: ['#4292CE', '#F4D272', '#E08E8B'],
    previewDots: ['#4B99D6', '#C4E2F2', '#F8DB85', '#E89D9A'],
    edgeColors: {
      default: '#2F72A8',
      positive: '#2A82B5',
      warning: '#C26763',
    },
    tones: {
      white: {
        fill: '#F7FBFE',
        stroke: '#BDDCEF',
        titleColor: '#153F61',
        bodyColor: '#245882',
      },
      gray: {
        fill: '#E5F2FA',
        stroke: '#8CC3E3',
        titleColor: '#174469',
        bodyColor: '#265B87',
      },
      blue: {
        fill: '#CDE7F7',
        stroke: '#4292CE',
        titleColor: '#103657',
        bodyColor: '#1A4E7A',
      },
      mint: {
        fill: '#DFF3F4',
        stroke: '#5AAEB5',
        titleColor: '#154C52',
        bodyColor: '#20656C',
      },
      amber: {
        fill: '#FDF1CC',
        stroke: '#E4B84C',
        titleColor: '#694A0B',
        bodyColor: '#825D11',
      },
      rose: {
        fill: '#F9E0DF',
        stroke: '#DC8581',
        titleColor: '#752522',
        bodyColor: '#8F312E',
      },
    },
  },
  {
    id: 'water-violet',
    name: 'Violeta agua',
    swatches: ['#7A7DB8', '#3F9A96', '#42447A'],
    previewDots: ['#8587BD', '#B5B6DA', '#459B97', '#7ED1CE'],
    edgeColors: {
      default: '#5B5E99',
      positive: '#2F827E',
      warning: '#695C9E',
    },
    tones: {
      white: {
        fill: '#F8F8FC',
        stroke: '#CBCBE3',
        titleColor: '#2D2E57',
        bodyColor: '#444675',
      },
      gray: {
        fill: '#E7E7F5',
        stroke: '#A3A5CE',
        titleColor: '#2F3161',
        bodyColor: '#454780',
      },
      blue: {
        fill: '#D8D9F0',
        stroke: '#7A7DB8',
        titleColor: '#272957',
        bodyColor: '#3A3D75',
      },
      mint: {
        fill: '#D5F0EE',
        stroke: '#449A97',
        titleColor: '#154B49',
        bodyColor: '#1F6360',
      },
      amber: {
        fill: '#E2F3F2',
        stroke: '#6EC2BE',
        titleColor: '#1B5250',
        bodyColor: '#286A68',
      },
      rose: {
        fill: '#E7E0F2',
        stroke: '#9482BA',
        titleColor: '#3E2B61',
        bodyColor: '#543D7D',
      },
    },
  },
  {
    id: 'optic-light',
    name: 'Luz óptica',
    swatches: ['#9DC2A0', '#8AC2CC', '#C9A2B8'],
    previewDots: ['#F1F6EB', '#DFF1F4', '#F3EDF5', '#F2DFDF'],
    edgeColors: {
      default: '#6E7F85',
      positive: '#568C72',
      warning: '#A66F7B',
    },
    tones: {
      white: {
        fill: '#FCFDFB',
        stroke: '#D9E0D4',
        titleColor: '#2B352D',
        bodyColor: '#49574C',
      },
      gray: {
        fill: '#F1F6EB',
        stroke: '#C5D4B8',
        titleColor: '#2D3E25',
        bodyColor: '#465C3B',
      },
      blue: {
        fill: '#E2F2F5',
        stroke: '#9DC9D1',
        titleColor: '#1E464F',
        bodyColor: '#2F5E69',
      },
      mint: {
        fill: '#EAF5EE',
        stroke: '#A3CFBA',
        titleColor: '#1F4B37',
        bodyColor: '#30634C',
      },
      amber: {
        fill: '#F4EEF6',
        stroke: '#C7B5CF',
        titleColor: '#483052',
        bodyColor: '#61436E',
      },
      rose: {
        fill: '#F5E4E4',
        stroke: '#D4A8A8',
        titleColor: '#5E2B2B',
        bodyColor: '#783B3B',
      },
    },
  },
  {
    id: 'cyto-neon',
    name: 'Cito neón',
    swatches: ['#22B2A0', '#EE861F', '#CF3B84'],
    previewDots: ['#29B5A3', '#F08922', '#D13E86', '#5E7AC0'],
    edgeColors: {
      default: '#3F5FA8',
      positive: '#168F80',
      warning: '#C9650E',
    },
    tones: {
      white: {
        fill: '#F7FCFB',
        stroke: '#9CDCD3',
        titleColor: '#114A43',
        bodyColor: '#1E635B',
      },
      gray: {
        fill: '#E8EEFA',
        stroke: '#7E97D1',
        titleColor: '#1F356B',
        bodyColor: '#2E4A8C',
      },
      blue: {
        fill: '#DCE6FA',
        stroke: '#5875BF',
        titleColor: '#1B2E61',
        bodyColor: '#2B4585',
      },
      mint: {
        fill: '#D2F5EF',
        stroke: '#26B09F',
        titleColor: '#0C4D45',
        bodyColor: '#14695E',
      },
      amber: {
        fill: '#FDE9D2',
        stroke: '#EB841E',
        titleColor: '#733806',
        bodyColor: '#8F480B',
      },
      rose: {
        fill: '#FADCEB',
        stroke: '#CF3B84',
        titleColor: '#6E1340',
        bodyColor: '#8C1D54',
      },
    },
  },
  {
    id: 'original',
    name: 'Original',
    swatches: ['#334155', '#94A3B8', '#0F172A'],
    previewDots: ['#BFDBFE', '#A7F3D0', '#FDE68A', '#FECDD3'],
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
    previewDots: ['#0284C7', '#38BDF8', '#7DD3FC', '#6366F1'],
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
    previewDots: ['#16A34A', '#4ADE80', '#86EFAC', '#14B8A6'],
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
    previewDots: ['#7C3AED', '#A78BFA', '#C4B5FD', '#C026D3'],
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
    previewDots: ['#F59E0B', '#FCD34D', '#FB923C', '#EF4444'],
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
    previewDots: ['#FB7185', '#FDA4AF', '#F9A8D4', '#F43F5E'],
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
  {
    id: 'nordic-forest',
    name: 'Bosque nórdico',
    swatches: ['#2F6F5E', '#8FBFB0', '#1B3B33'],
    previewDots: ['#3B7A68', '#8BB8A8', '#D7E8DF', '#D6CCB8'],
    edgeColors: {
      default: '#2F5E50',
      positive: '#2A7A5F',
      warning: '#8A6F3F',
    },
    tones: {
      white: {
        fill: '#F8FAF8',
        stroke: '#C9D8D1',
        titleColor: '#1B362E',
        bodyColor: '#325248',
      },
      gray: {
        fill: '#E7EFEA',
        stroke: '#99B8AA',
        titleColor: '#1C3B31',
        bodyColor: '#315449',
      },
      blue: {
        fill: '#D5E7DF',
        stroke: '#4E8C79',
        titleColor: '#153D32',
        bodyColor: '#235748',
      },
      mint: {
        fill: '#DCF0E5',
        stroke: '#3D8A6B',
        titleColor: '#144230',
        bodyColor: '#1F5C45',
      },
      amber: {
        fill: '#F1ECE0',
        stroke: '#BCA882',
        titleColor: '#4F3E1E',
        bodyColor: '#69542C',
      },
      rose: {
        fill: '#EFE4E0',
        stroke: '#B98E80',
        titleColor: '#592E22',
        bodyColor: '#733F30',
      },
    },
  },
  {
    id: 'clinical-coral',
    name: 'Coral clínico',
    swatches: ['#E86A58', '#F6B19E', '#3A7D8C'],
    previewDots: ['#EC7665', '#F7B7A6', '#FBE6DC', '#76B7C2'],
    edgeColors: {
      default: '#A85245',
      positive: '#347A87',
      warning: '#C95443',
    },
    tones: {
      white: {
        fill: '#FFF9F7',
        stroke: '#EFC9BF',
        titleColor: '#59231B',
        bodyColor: '#78362C',
      },
      gray: {
        fill: '#F7ECE9',
        stroke: '#D6B0A6',
        titleColor: '#4F241D',
        bodyColor: '#6B362D',
      },
      blue: {
        fill: '#DFF0F2',
        stroke: '#5FA4B0',
        titleColor: '#184A54',
        bodyColor: '#24626E',
      },
      mint: {
        fill: '#E5F4EF',
        stroke: '#64B39D',
        titleColor: '#184D3F',
        bodyColor: '#246654',
      },
      amber: {
        fill: '#FCE9DC',
        stroke: '#E4976C',
        titleColor: '#6B3215',
        bodyColor: '#854220',
      },
      rose: {
        fill: '#FCDFD9',
        stroke: '#E37362',
        titleColor: '#6E2014',
        bodyColor: '#8A2D1F',
      },
    },
  },
  {
    id: 'deep-ocean',
    name: 'Océano profundo',
    swatches: ['#1D4E89', '#6AA5D9', '#0B2545'],
    previewDots: ['#1D4E89', '#4A8BC2', '#99C7E8', '#52B2BF'],
    edgeColors: {
      default: '#1D4E89',
      positive: '#1F7A8C',
      warning: '#2B598A',
    },
    tones: {
      white: {
        fill: '#F5F9FD',
        stroke: '#B5CFE8',
        titleColor: '#0F2C4D',
        bodyColor: '#1E4673',
      },
      gray: {
        fill: '#E3EEF8',
        stroke: '#8AB4DB',
        titleColor: '#113054',
        bodyColor: '#1F4978',
      },
      blue: {
        fill: '#CDE2F5',
        stroke: '#3474B3',
        titleColor: '#0C294A',
        bodyColor: '#16406E',
      },
      mint: {
        fill: '#D3EFF2',
        stroke: '#3899A6',
        titleColor: '#10444C',
        bodyColor: '#1A5E69',
      },
      amber: {
        fill: '#E2EBF8',
        stroke: '#587DC2',
        titleColor: '#1A3161',
        bodyColor: '#284785',
      },
      rose: {
        fill: '#DCE4F4',
        stroke: '#4D65A6',
        titleColor: '#1B2852',
        bodyColor: '#2B3D75',
      },
    },
  },
  {
    id: 'soft-lavender',
    name: 'Lavanda suave',
    swatches: ['#8E7CC3', '#CFC6EB', '#4B3C78'],
    previewDots: ['#9381C7', '#C9BFE8', '#E9E4F7', '#DFC5E3'],
    edgeColors: {
      default: '#6B5A9E',
      positive: '#6882B8',
      warning: '#9A639E',
    },
    tones: {
      white: {
        fill: '#FAF9FE',
        stroke: '#D7D0ED',
        titleColor: '#342759',
        bodyColor: '#4E3E7A',
      },
      gray: {
        fill: '#EFEBF9',
        stroke: '#B9ADD9',
        titleColor: '#36295E',
        bodyColor: '#4F4080',
      },
      blue: {
        fill: '#E1DAF5',
        stroke: '#8B79C2',
        titleColor: '#2D2154',
        bodyColor: '#423373',
      },
      mint: {
        fill: '#E3ECFA',
        stroke: '#83A0D4',
        titleColor: '#223A66',
        bodyColor: '#335185',
      },
      amber: {
        fill: '#F1E6F7',
        stroke: '#B68CD1',
        titleColor: '#4B2763',
        bodyColor: '#633880',
      },
      rose: {
        fill: '#F5E4F0',
        stroke: '#C48AB4',
        titleColor: '#59254B',
        bodyColor: '#733562',
      },
    },
  },
  {
    id: 'warm-sand',
    name: 'Arena cálida',
    swatches: ['#B88754', '#E6C9A2', '#6E4C2A'],
    previewDots: ['#C29463', '#E4C7A1', '#F4E8D6', '#9BB59E'],
    edgeColors: {
      default: '#8A633C',
      positive: '#4C7A58',
      warning: '#B56333',
    },
    tones: {
      white: {
        fill: '#FCF9F4',
        stroke: '#E2D3BC',
        titleColor: '#47331D',
        bodyColor: '#634A2E',
      },
      gray: {
        fill: '#F2EAE0',
        stroke: '#CDB99F',
        titleColor: '#42301C',
        bodyColor: '#5E462D',
      },
      blue: {
        fill: '#E6EFEF',
        stroke: '#7FA8AB',
        titleColor: '#1E464A',
        bodyColor: '#2F5F63',
      },
      mint: {
        fill: '#E5EFE5',
        stroke: '#82AB87',
        titleColor: '#224526',
        bodyColor: '#335E38',
      },
      amber: {
        fill: '#F7E7CF',
        stroke: '#CF9C5E',
        titleColor: '#593A12',
        bodyColor: '#734E1D',
      },
      rose: {
        fill: '#F5DFD6',
        stroke: '#CC8468',
        titleColor: '#612B16',
        bodyColor: '#7D3B22',
      },
    },
  },
  {
    id: 'tech-graphite',
    name: 'Grafito técnico',
    swatches: ['#475569', '#94A3B8', '#1E293B'],
    previewDots: ['#475569', '#94A3B8', '#CBD5E1', '#3B82F6'],
    edgeColors: {
      default: '#475569',
      positive: '#2563EB',
      warning: '#64748B',
    },
    tones: {
      white: {
        fill: '#FFFFFF',
        stroke: '#CBD5E1',
        titleColor: '#0F172A',
        bodyColor: '#334155',
      },
      gray: {
        fill: '#F1F5F9',
        stroke: '#94A3B8',
        titleColor: '#0F172A',
        bodyColor: '#334155',
      },
      blue: {
        fill: '#E0ECFF',
        stroke: '#3B82F6',
        titleColor: '#1E3A8A',
        bodyColor: '#1D4ED8',
      },
      mint: {
        fill: '#E2F2F0',
        stroke: '#47948B',
        titleColor: '#15423D',
        bodyColor: '#225C56',
      },
      amber: {
        fill: '#E8ECF2',
        stroke: '#64748B',
        titleColor: '#1E293B',
        bodyColor: '#334155',
      },
      rose: {
        fill: '#ECE7EC',
        stroke: '#7C697D',
        titleColor: '#2E1F30',
        bodyColor: '#48344A',
      },
    },
  },
  {
    id: 'vital-emerald',
    name: 'Esmeralda vital',
    swatches: ['#10B981', '#6EE7B7', '#065F46'],
    previewDots: ['#10B981', '#5EEAD4', '#A7F3D0', '#38BDF8'],
    edgeColors: {
      default: '#0F766E',
      positive: '#059669',
      warning: '#0284C7',
    },
    tones: {
      white: {
        fill: '#F4FDF9',
        stroke: '#A7F3D0',
        titleColor: '#064E3B',
        bodyColor: '#065F46',
      },
      gray: {
        fill: '#E3F8F1',
        stroke: '#6EE7B7',
        titleColor: '#064E3B',
        bodyColor: '#047857',
      },
      blue: {
        fill: '#D7F3FC',
        stroke: '#38BDF8',
        titleColor: '#0C4A6E',
        bodyColor: '#0369A1',
      },
      mint: {
        fill: '#CCFBF1',
        stroke: '#14B8A6',
        titleColor: '#134E4A',
        bodyColor: '#115E59',
      },
      amber: {
        fill: '#E4F9D5',
        stroke: '#84CC16',
        titleColor: '#365314',
        bodyColor: '#4D7C0F',
      },
      rose: {
        fill: '#DDF2EE',
        stroke: '#2DD4BF',
        titleColor: '#115E59',
        bodyColor: '#0F766E',
      },
    },
  },
  {
    id: 'medical-indigo',
    name: 'Índigo médico',
    swatches: ['#4338CA', '#818CF8', '#1E1B4B'],
    previewDots: ['#4F46E5', '#818CF8', '#C7D2FE', '#38BDF8'],
    edgeColors: {
      default: '#4338CA',
      positive: '#0284C7',
      warning: '#7C3AED',
    },
    tones: {
      white: {
        fill: '#F8F9FF',
        stroke: '#C7D2FE',
        titleColor: '#1E1B4B',
        bodyColor: '#3730A3',
      },
      gray: {
        fill: '#EEF2FF',
        stroke: '#A5B4FC',
        titleColor: '#1E1B4B',
        bodyColor: '#3730A3',
      },
      blue: {
        fill: '#E0E7FF',
        stroke: '#6366F1',
        titleColor: '#1E1B4B',
        bodyColor: '#312E81',
      },
      mint: {
        fill: '#E0F2FE',
        stroke: '#38BDF8',
        titleColor: '#0C4A6E',
        bodyColor: '#0369A1',
      },
      amber: {
        fill: '#EDE9FE',
        stroke: '#8B5CF6',
        titleColor: '#3B0764',
        bodyColor: '#5B21B6',
      },
      rose: {
        fill: '#FCE7F3',
        stroke: '#EC4899',
        titleColor: '#831843',
        bodyColor: '#9D174D',
      },
    },
  },
  {
    id: 'modern-terracotta',
    name: 'Terracota moderna',
    swatches: ['#C85A32', '#E59A73', '#7A2E14'],
    previewDots: ['#C9623B', '#E5A17E', '#F3D8C7', '#7A9A8B'],
    edgeColors: {
      default: '#9A4424',
      positive: '#467360',
      warning: '#B84A24',
    },
    tones: {
      white: {
        fill: '#FDF8F5',
        stroke: '#E8C6B5',
        titleColor: '#542211',
        bodyColor: '#73341E',
      },
      gray: {
        fill: '#F3EAE4',
        stroke: '#D1B3A3',
        titleColor: '#4A2416',
        bodyColor: '#663625',
      },
      blue: {
        fill: '#E4EFEA',
        stroke: '#75A391',
        titleColor: '#1C4536',
        bodyColor: '#2B5E4C',
      },
      mint: {
        fill: '#EBF2E4',
        stroke: '#89A86D',
        titleColor: '#2E4719',
        bodyColor: '#426128',
      },
      amber: {
        fill: '#F9E6D4',
        stroke: '#DF955B',
        titleColor: '#6B340D',
        bodyColor: '#874516',
      },
      rose: {
        fill: '#F7DBD2',
        stroke: '#CF6A49',
        titleColor: '#69210B',
        bodyColor: '#852F15',
      },
    },
  },
  {
    id: 'alpine-sky',
    name: 'Cielo alpino',
    swatches: ['#2E86C1', '#85C1E9', '#1B4F72'],
    previewDots: ['#3498DB', '#85C1E9', '#D6EAF8', '#A3E4D7'],
    edgeColors: {
      default: '#2874A6',
      positive: '#1F8A70',
      warning: '#3D6E96',
    },
    tones: {
      white: {
        fill: '#F7FBFE',
        stroke: '#C5E0F2',
        titleColor: '#154360',
        bodyColor: '#1F618D',
      },
      gray: {
        fill: '#EBF5FB',
        stroke: '#9ACAE8',
        titleColor: '#154360',
        bodyColor: '#21618C',
      },
      blue: {
        fill: '#D6EAF8',
        stroke: '#3498DB',
        titleColor: '#123A54',
        bodyColor: '#1B4F72',
      },
      mint: {
        fill: '#D1F2EB',
        stroke: '#48C9B0',
        titleColor: '#115244',
        bodyColor: '#186A59',
      },
      amber: {
        fill: '#E8F6F3',
        stroke: '#76D7C4',
        titleColor: '#145A4D',
        bodyColor: '#1D7363',
      },
      rose: {
        fill: '#E8EEF7',
        stroke: '#7F9EC9',
        titleColor: '#1F3659',
        bodyColor: '#2E4D7A',
      },
    },
  },
  {
    id: 'clinical-plum',
    name: 'Ciruela clínica',
    swatches: ['#883974', '#C98BB9', '#4A183D'],
    previewDots: ['#8E3D7A', '#C78AB8', '#EBD5E6', '#7A9EC4'],
    edgeColors: {
      default: '#753164',
      positive: '#43739E',
      warning: '#9E386A',
    },
    tones: {
      white: {
        fill: '#FCF8FB',
        stroke: '#E0C3D9',
        titleColor: '#4A1A3E',
        bodyColor: '#692B5A',
      },
      gray: {
        fill: '#F3E7F0',
        stroke: '#CCA3C2',
        titleColor: '#4A1A3E',
        bodyColor: '#662857',
      },
      blue: {
        fill: '#E3EEF8',
        stroke: '#6D98C4',
        titleColor: '#1B3F63',
        bodyColor: '#295682',
      },
      mint: {
        fill: '#E6F2F0',
        stroke: '#6EA89E',
        titleColor: '#1B4A43',
        bodyColor: '#28635A',
      },
      amber: {
        fill: '#F4E2F0',
        stroke: '#B570A4',
        titleColor: '#541E48',
        bodyColor: '#702C60',
      },
      rose: {
        fill: '#F7DDE8',
        stroke: '#C45A89',
        titleColor: '#61193A',
        bodyColor: '#7D254D',
      },
    },
  },
  {
    id: 'botanical-olive',
    name: 'Oliva botánica',
    swatches: ['#6B7D3B', '#B5C489', '#3B471C'],
    previewDots: ['#728540', '#B3C487', '#E3EBD0', '#DFC68B'],
    edgeColors: {
      default: '#5A6B2F',
      positive: '#467A45',
      warning: '#9C7A2B',
    },
    tones: {
      white: {
        fill: '#FAFBF6',
        stroke: '#D5DEC0',
        titleColor: '#313B18',
        bodyColor: '#4A5727',
      },
      gray: {
        fill: '#EEF2E4',
        stroke: '#B7C499',
        titleColor: '#323D19',
        bodyColor: '#495927',
      },
      blue: {
        fill: '#E3EFEA',
        stroke: '#78A896',
        titleColor: '#1B4536',
        bodyColor: '#295E4C',
      },
      mint: {
        fill: '#E2EED6',
        stroke: '#7DA35A',
        titleColor: '#294514',
        bodyColor: '#3A5E1F',
      },
      amber: {
        fill: '#F5EED4',
        stroke: '#C9B163',
        titleColor: '#574512',
        bodyColor: '#705A1B',
      },
      rose: {
        fill: '#F2E7DF',
        stroke: '#C2987C',
        titleColor: '#59331C',
        bodyColor: '#734529',
      },
    },
  },
];

const PALETTE_MAP = new Map<DiagramPaletteId, DiagramPaletteDefinition>(
  DIAGRAM_PALETTES.map((p) => [p.id, p])
);

export function getPaletteDefinition(paletteId?: DiagramPaletteId): DiagramPaletteDefinition {
  return PALETTE_MAP.get(paletteId ?? 'original') ?? PALETTE_MAP.get('original') ?? DIAGRAM_PALETTES[0];
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
