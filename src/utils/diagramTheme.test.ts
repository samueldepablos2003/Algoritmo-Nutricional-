import assert from 'node:assert/strict';
import test from 'node:test';
import type { DiagramNode, EditableDiagram, NodeShape } from '../types/algorithm';
import { serializeDiagramToSvg } from './diagramEngine';
import {
  buildNodeShapeSvgMarkup,
  computeAdaptiveNodeMetrics,
  DIAGRAM_PALETTES,
  resolveEdgeColor,
  resolveNodeColors,
} from './diagramTheme';

const SAMPLE_NODE: DiagramNode = {
  id: 'n1',
  x: 100,
  y: 100,
  width: 280,
  height: 92,
  title: 'Evaluación Nutricional Integral',
  body: 'Integración de indicadores directos e indirectos para definir la ruta clínica.',
  shape: 'process',
  tone: 'blue',
};

test('all 6 preset palettes and grayscale mode resolve distinct valid hex colors', () => {
  assert.equal(DIAGRAM_PALETTES.length, 6);
  const original = resolveNodeColors('blue', 'original', 'color');
  const green = resolveNodeColors('blue', 'fresh-green', 'color');
  const gray = resolveNodeColors('blue', 'fresh-green', 'grayscale');

  assert.notEqual(original.fill, green.fill);
  assert.equal(gray.fill, '#DCDCE2');
  assert.equal(resolveEdgeColor('#15803D', 'tech-blue', 'color'), '#0284C7');
  assert.equal(resolveEdgeColor('#15803D', 'tech-blue', 'grayscale'), '#3A3A3C');
});

test('computeAdaptiveNodeMetrics grows node height and width smoothly when fontScale increases', () => {
  const base = computeAdaptiveNodeMetrics(SAMPLE_NODE, 1);
  const enlarged = computeAdaptiveNodeMetrics(SAMPLE_NODE, 1.5);

  assert.ok(enlarged.titleFontSize > base.titleFontSize);
  assert.ok(enlarged.bodyFontSize > base.bodyFontSize);
  assert.ok(enlarged.width > base.width);
  assert.ok(enlarged.height > base.height);
});

test('buildNodeShapeSvgMarkup outputs valid vector primitives for all 10 shapes', () => {
  const shapes: NodeShape[] = [
    'oval',
    'process',
    'diamond',
    'pill',
    'parallelogram',
    'hexagon',
    'block-arrow',
    'thin-arrow',
    'double-arrow',
    'decision',
  ];
  for (const shape of shapes) {
    const svg = buildNodeShapeSvgMarkup(shape, 0, 0, 260, 100, '#FFFFFF', '#000000', 2);
    assert.ok(
      svg.startsWith('<rect ') || svg.startsWith('<ellipse ') || svg.startsWith('<polygon '),
      `Expected SVG primitive for shape ${shape}`
    );
  }
});

test('serializeDiagramToSvg reflects selected palette, new shapes, and per-text font overrides', () => {
  const diagram: EditableDiagram = {
    title: 'Prueba de formato',
    subtitle: '',
    tags: ['Nutrición'],
    notes: '',
    paletteId: 'fresh-green',
    colorMode: 'color',
    fontScale: 1.2,
    nodes: [
      {
        ...SAMPLE_NODE,
        shape: 'diamond',
        titleFontSize: 20,
        titleOpacity: 0.85,
        comment: 'Revisar balance nitrogenado',
      },
    ],
    edges: [],
  };

  const svg = serializeDiagramToSvg(diagram);
  assert.ok(svg.includes('<polygon '), 'Expected diamond polygon in serialized SVG');
  assert.ok(svg.includes('#A7F3D0'), 'Expected Verde fresco palette fill in serialized SVG');
  assert.ok(svg.includes('font-size:24px'), 'Expected scaled custom font size (20 * 1.2 = 24px)');
  assert.ok(svg.includes('opacity="0.85"'), 'Expected custom opacity in serialized SVG');
});
