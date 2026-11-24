import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoLayoutDiagram,
  computeEdgeGeometry,
  computeSnapAndGuides,
  createHistory,
  createStarterDiagram,
  normalizeAiDiagramPayload,
  pushHistory,
  redoHistory,
  serializeDiagramToSvg,
  serializeDiagramToSvgDataUrl,
  undoHistory,
} from './diagramEngine';
import type { DiagramNode, EditableDiagram } from '../types/algorithm';

test('autoLayoutDiagram positions hierarchical ranks top-to-bottom without node overlaps', () => {
  const diagram = createStarterDiagram();
  // Scramble positions intentionally
  const scrambled: EditableDiagram = {
    ...diagram,
    nodes: diagram.nodes.map((n) => ({ ...n, x: 50, y: 50 })),
  };

  const laidOut = autoLayoutDiagram(scrambled);
  const n1 = laidOut.nodes.find((n) => n.id === 'n1')!;
  const n2 = laidOut.nodes.find((n) => n.id === 'n2')!;
  const n3 = laidOut.nodes.find((n) => n.id === 'n3')!;
  const n4 = laidOut.nodes.find((n) => n.id === 'n4')!;

  // Rank order: n1 above n2, n2 above n3 & n4
  assert.ok(n1.y + n1.height < n2.y, 'n1 should be above n2');
  assert.ok(n2.y + n2.height < n3.y, 'n2 should be above n3');
  assert.equal(n3.y, n4.y, 'sibling branch nodes should align on same row');
  // Siblings should not overlap horizontally
  const leftSibling = n3.x < n4.x ? n3 : n4;
  const rightSibling = n3.x < n4.x ? n4 : n3;
  assert.ok(leftSibling.x + leftSibling.width < rightSibling.x, 'siblings must not overlap');
});

test('computeSnapAndGuides snaps dragged node to sibling center and emits blue alignment guide', () => {
  const sibling: DiagramNode = {
    id: 'n1',
    x: 400,
    y: 100,
    width: 300,
    height: 100,
    title: 'Origen',
    body: '',
    shape: 'process',
    tone: 'white',
  };

  // Dragging node whose center X is 554 (4px off sibling center X 550)
  const result = computeSnapAndGuides(
    { id: 'n2', width: 200, height: 100 },
    454,
    280,
    [sibling],
    8
  );

  // Center should snap to 550 -> x = 550 - 100 = 450
  assert.equal(result.x, 450);
  assert.equal(result.y, 280);
  assert.equal(result.guides.length, 1);
  assert.equal(result.guides[0].axis, 'x');
  assert.equal(result.guides[0].position, 550);
});

test('computeEdgeGeometry produces orthogonal elbow for vertical branches and straight line when requested', () => {
  const src: DiagramNode = {
    id: 'a',
    x: 400,
    y: 100,
    width: 300,
    height: 100,
    title: 'A',
    body: '',
    shape: 'decision',
    tone: 'blue',
  };
  const tgt: DiagramNode = {
    id: 'b',
    x: 700,
    y: 300,
    width: 300,
    height: 100,
    title: 'B',
    body: '',
    shape: 'process',
    tone: 'mint',
  };

  const ortho = computeEdgeGeometry(src, tgt, {
    id: 'e1',
    from: 'a',
    to: 'b',
    label: 'Sí',
    style: 'solid',
  });
  assert.ok(ortho.pathD.includes('Q '), 'orthogonal branch should use smooth quadratic corners');
  assert.equal(ortho.isDashed, false);

  const straight = computeEdgeGeometry(src, tgt, {
    id: 'e2',
    from: 'a',
    to: 'b',
    label: 'Excepción',
    style: 'dashed',
  });
  assert.equal(straight.isDashed, true);
});

test('normalizeAiDiagramPayload sanitizes AI JSON, drops invalid edges, and applies layout', () => {
  const normalized = normalizeAiDiagramPayload({
    title: 'Manejo del Síndrome de Realimentación',
    subtitle: 'Guía clínica ASPEN',
    tags: ['Críticos', 'críticos', 'Nutrición Parenteral'],
    notes: '• Vigilar fosfato sérico diario.',
    nodes: [
      { id: '1', title: 'Riesgo Alto', body: 'IMC < 16', shape: 'pill', tone: 'amber' },
      { id: '2', title: 'Iniciar 10 kcal/kg/d', body: 'Suplementar tiamina', shape: 'unknown', tone: 'bad' },
    ],
    edges: [
      { from: '1', to: '2', label: 'Confirmado', style: 'solid' },
      { from: '1', to: '999', label: 'Invalid', style: 'solid' },
    ],
  });

  assert.equal(normalized.nodes.length, 2);
  assert.equal(normalized.edges.length, 1);
  assert.deepEqual(normalized.tags, ['Críticos', 'Nutrición Parenteral']);
  assert.equal(normalized.nodes[1].shape, 'process');
  assert.equal(normalized.nodes[1].tone, 'white');
});

test('history stack supports push, undo, and redo cleanly', () => {
  let h = createHistory(1);
  h = pushHistory(h, 2);
  h = pushHistory(h, 3);
  assert.equal(h.present, 3);
  h = undoHistory(h);
  assert.equal(h.present, 2);
  h = redoHistory(h);
  assert.equal(h.present, 3);
  h = undoHistory(undoHistory(h));
  assert.equal(h.present, 1);
});

test('serializeDiagramToSvg escapes XML safely and outputs valid SVG data URL', () => {
  const diagram = createStarterDiagram();
  diagram.title = 'Protocolo < 48h & Metas';
  const svg = serializeDiagramToSvg(diagram);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('Protocolo &lt; 48h &amp; Metas'));

  const dataUrl = serializeDiagramToSvgDataUrl(diagram);
  assert.ok(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,'));
});

test('normalizeAiDiagramPayload preserves valid sourceImageDataUrl across auto-layout and ignores invalid URLs', () => {
  const validSource = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const withValid = normalizeAiDiagramPayload(
    {
      title: 'Digitalizado',
      subtitle: 'Desde imagen',
      tags: ['Críticos'],
      notes: '',
      nodes: [{ id: 'n1', title: 'Inicio', body: 'Evaluar', shape: 'pill', tone: 'gray' }],
      edges: [],
    },
    { sourceImageDataUrl: validSource }
  );
  assert.equal(withValid.sourceImageDataUrl, validSource);

  const withInvalid = normalizeAiDiagramPayload(
    {
      title: 'Digitalizado',
      subtitle: '',
      tags: [],
      notes: '',
      nodes: [{ id: 'n1', title: 'Inicio', body: '', shape: 'pill', tone: 'gray' }],
      edges: [],
    },
    { sourceImageDataUrl: 'javascript:alert(1)' }
  );
  assert.equal(withInvalid.sourceImageDataUrl, undefined);
});

