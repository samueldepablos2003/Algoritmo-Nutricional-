import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoLayoutDiagram,
  computeDiagramEdgeGeometries,
  computeEdgeGeometry,
  computeSnapAndGuides,
  createHistory,
  createStarterDiagram,
  normalizeAiDiagramPayload,
  pushHistory,
  redoHistory,
  serializeDiagramToSvg,
  serializeDiagramToSvgDataUrl,
  smartAutoLayoutDiagram,
  undoHistory,
} from './diagramEngine';
import { computeAdaptiveNodeMetrics } from './diagramTheme';
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

test('normalizeAiDiagramPayload preserves clinicalContext, reference, node comments, and drops reverse cycles', () => {
  const normalized = normalizeAiDiagramPayload({
    clinicalContext: {
      summary: 'Manejo nutricional en pancreatitis aguda grave según guías ESPEN.',
      targetPopulation: 'Adultos hospitalizados con pancreatitis aguda',
      clinicalSetting: 'UCI',
      protocolSource: 'Guías ESPEN 2024',
      primaryObjective: 'Iniciar NE temprana en < 48 h',
    },
    title: 'Soporte en Pancreatitis Aguda',
    subtitle: '',
    tags: ['Gastroenterología', 'Críticos'],
    notes: '• Evaluar severidad al ingreso.',
    nodes: [
      {
        id: 'n1',
        title: '1. Evaluación',
        body: 'Clasificación de Atlanta',
        comment: 'Vigilar necrosis pancreática',
        shape: 'pill',
        tone: 'gray',
      },
      {
        id: 'n2',
        title: '2. Nutrición Enteral',
        body: 'SNG o SNY < 48 h',
        shape: 'process',
        tone: 'mint',
      },
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'Moderada/Grave', style: 'solid' },
      { from: 'n2', to: 'n1', label: 'Ciclo inverso', style: 'dashed' },
    ],
  });

  assert.equal(normalized.clinicalContext?.protocolSource, 'Guías ESPEN 2024');
  assert.equal(normalized.clinicalContext?.clinicalSetting, 'UCI');
  assert.equal(normalized.reference, 'Guías ESPEN 2024');
  assert.ok(normalized.subtitle.includes('pancreatitis aguda grave'));
  assert.equal(normalized.nodes[0].comment, 'Vigilar necrosis pancreática');
  assert.equal(normalized.edges.length, 1);
});

test('smartAutoLayoutDiagram eliminates all bounding-box overlaps on a dense 16-node dysphagia-like clinical algorithm with elevated fontScale', () => {
  const denseDiagram: EditableDiagram = {
    title: 'Manejo nutricional y deglutorio en disfagia severa del adulto',
    subtitle: 'Evaluación integral, seguridad de la vía aérea y soporte nutricional',
    tags: ['Disfagia', 'Soporte Nutricional'],
    notes: '• Evaluar eficacia y seguridad deglutoria antes de indicar vía oral.',
    fontScale: 1.25,
    nodes: [
      {
        id: 'n1',
        x: 100,
        y: 100,
        width: 280,
        height: 90,
        title: '1. Sospecha clínica de disfagia orofaríngea severa',
        body: 'Paciente adulto con antecedente de ACV, patología neurodegenerativa, post-extubación prolongada o tos/ahogo durante la ingesta.',
        shape: 'pill',
        tone: 'gray',
      },
      {
        id: 'n2',
        x: 110,
        y: 110,
        width: 280,
        height: 90,
        title: '2. Estabilidad respiratoria y nivel de alerta',
        body: '¿Paciente vigil, cooperador, capaz de mantener sedestación y manejo adecuado de secreciones orales sin riesgo inmediato de aspiración?',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n3',
        x: 120,
        y: 120,
        width: 280,
        height: 90,
        title: '3A. Tamizaje estructurado (EAT-10 / MECV-V)',
        body: 'Evaluación clínica fonoaudiológica con volúmenes y viscosidades crecientes (néctar, pudín, líquido) monitorizando saturación O2 y voz húmeda.',
        shape: 'process',
        tone: 'white',
      },
      {
        id: 'n4',
        x: 130,
        y: 130,
        width: 280,
        height: 90,
        title: '3B. Mantener NPO estricto e higiene oral intensiva',
        body: 'Suspender ingesta oral por alto riesgo de neumonía aspirativa. Iniciar hidratación IV y valoración temprana para vía enteral.',
        shape: 'process',
        tone: 'rose',
      },
      {
        id: 'n5',
        x: 140,
        y: 140,
        width: 280,
        height: 90,
        title: '4. ¿Alteración de seguridad o sospecha de aspiración silente?',
        body: 'Desaturación >= 3%, tos tardía, cambio de timbre vocal o residuo faríngeo significativo en MECV-V.',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n6',
        x: 150,
        y: 150,
        width: 280,
        height: 90,
        title: '5A. Vía oral adaptada (IDDSI) + maniobras',
        body: 'Indicar texturas modificadas IDDSI 4-5 y líquidos espesados IDDSI 2-3, postura mentón-pecho y fraccionamiento en 5-6 tomas.',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'n7',
        x: 160,
        y: 160,
        width: 280,
        height: 90,
        title: '5B. Estudio instrumental (FEES o Videofluoroscopía)',
        body: 'Confirmar biomecánica deglutoria, penetración/aspiración y respuesta real a consistencias y estrategias compensatorias.',
        shape: 'process',
        tone: 'amber',
      },
      {
        id: 'n8',
        x: 170,
        y: 170,
        width: 280,
        height: 90,
        title: '6A. ¿Cubre >= 75% de requerimientos calórico-proteicos?',
        body: 'Monitoreo estricto de ingesta oral 72 h, peso corporal y estado de hidratación.',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n9',
        x: 180,
        y: 180,
        width: 280,
        height: 90,
        title: '6B. ¿Deglución segura con adaptación confirmada?',
        body: 'Determinar si permite vía oral exclusiva, mixta o contraindicación total.',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n10',
        x: 190,
        y: 190,
        width: 280,
        height: 90,
        title: '7A. Continuar dieta adaptada + rehabilitación',
        body: 'Seguimiento nutricional quincenal y progresión de consistencias según reevaluación fonoaudiológica.',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'n11',
        x: 200,
        y: 200,
        width: 280,
        height: 90,
        title: '7B. Suplementación oral hipercalórica (SNO)',
        body: 'Añadir SNO espesados o tipo crema (400-600 kcal/día) y enriquecimiento proteico modular.',
        shape: 'process',
        tone: 'amber',
      },
      {
        id: 'n12',
        x: 210,
        y: 210,
        width: 280,
        height: 90,
        title: '8. ¿Duración estimada de soporte enteral > 4 semanas?',
        body: 'Evaluar pronóstico neurológico, recuperación esperada de reflejo deglutorio y metas de cuidado.',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'n13',
        x: 220,
        y: 220,
        width: 280,
        height: 90,
        title: '9A. Sonda Nasogástrica (SNG) de fino calibre',
        body: 'Iniciar nutrición enteral polimérica progresiva vigilando síndrome de realimentación y elevación cabecera 30-45°.',
        shape: 'process',
        tone: 'amber',
      },
      {
        id: 'n14',
        x: 230,
        y: 230,
        width: 280,
        height: 90,
        title: '9B. Gastrostomía endoscópica percutánea (PEG)',
        body: 'Acceso enteral definitivo con fórmula adaptada, cuidados de ostomía y capacitación a cuidador.',
        shape: 'process',
        tone: 'rose',
      },
      {
        id: 'n15',
        x: 240,
        y: 240,
        width: 280,
        height: 90,
        title: '10. Reevaluación multidisciplinaria periódica',
        body: 'Control de albúmina, peso, electrolitos, estado respiratorio y posibilidad de destete progresivo de sonda.',
        shape: 'pill',
        tone: 'mint',
      },
      {
        id: 'n16',
        x: 250,
        y: 250,
        width: 280,
        height: 90,
        title: 'Nota clínica independiente: Higiene oral',
        body: 'Cepillado y clorhexidina cada 8 h en todo paciente con disfagia severa para reducir neumonía.',
        shape: 'process',
        tone: 'gray',
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', label: '', style: 'solid' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'Sí · Estable y vigil', style: 'solid' },
      { id: 'e3', from: 'n2', to: 'n4', label: 'No · Inseguro / somnoliento', style: 'dashed' },
      { id: 'e4', from: 'n3', to: 'n5', label: '', style: 'solid' },
      { id: 'e5', from: 'n5', to: 'n6', label: 'No · Sin signos de aspiración', style: 'solid' },
      { id: 'e6', from: 'n5', to: 'n7', label: 'Sí · Sospecha aspiración', style: 'solid' },
      { id: 'e7', from: 'n6', to: 'n8', label: '', style: 'solid' },
      { id: 'e8', from: 'n7', to: 'n9', label: '', style: 'solid' },
      { id: 'e9', from: 'n8', to: 'n10', label: 'Sí · Meta cubierta', style: 'solid' },
      { id: 'e10', from: 'n8', to: 'n11', label: 'No · Ingesta insuficiente', style: 'dashed' },
      { id: 'e11', from: 'n9', to: 'n6', label: 'Sí · Segura con textura', style: 'solid' },
      { id: 'e12', from: 'n9', to: 'n12', label: 'No · Aspiración confirmada', style: 'solid' },
      { id: 'e13', from: 'n4', to: 'n12', label: 'Acceso enteral temprano', style: 'solid' },
      { id: 'e14', from: 'n11', to: 'n12', label: 'Fallo tras 5-7 días', style: 'dashed' },
      { id: 'e15', from: 'n12', to: 'n13', label: 'No · < 4 semanas', style: 'solid' },
      { id: 'e16', from: 'n12', to: 'n14', label: 'Sí · > 4 semanas', style: 'solid' },
      { id: 'e17', from: 'n13', to: 'n15', label: '', style: 'solid' },
      { id: 'e18', from: 'n14', to: 'n15', label: '', style: 'solid' },
      { id: 'e19', from: 'n10', to: 'n15', label: '', style: 'solid' },
    ],
  };

  const laidOut = smartAutoLayoutDiagram(denseDiagram);
  assert.equal(laidOut.nodes.length, denseDiagram.nodes.length);

  // Verify zero pairwise bounding-box overlaps using actual rendered adaptive metrics at fontScale=1.25
  const renderedRects = laidOut.nodes.map((n) => {
    const m = computeAdaptiveNodeMetrics(n, laidOut.fontScale ?? 1);
    return { id: n.id, x: n.x, y: n.y, w: m.width, h: m.height };
  });

  for (let i = 0; i < renderedRects.length; i++) {
    for (let j = i + 1; j < renderedRects.length; j++) {
      const a = renderedRects[i];
      const b = renderedRects[j];
      const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
      assert.ok(
        !(overlapsX && overlapsY),
        `Nodes ${a.id} and ${b.id} overlap: (${a.x},${a.y},${a.w}x${a.h}) vs (${b.x},${b.y},${b.w}x${b.h})`
      );
    }
  }

  // Verify idempotency: clicking Auto-Ordenar a second time at fontScale=1.25 must not inflate widths
  const secondPass = smartAutoLayoutDiagram(laidOut);
  for (let i = 0; i < laidOut.nodes.length; i++) {
    assert.equal(
      secondPass.nodes[i].width,
      laidOut.nodes[i].width,
      `Node ${laidOut.nodes[i].id} width should remain stable across repeated smartAutoLayoutDiagram calls`
    );
  }
});

test('computeDiagramEdgeGeometries detours skip-level edges around blocking boxes and separates sibling labels', () => {
  const nodes: DiagramNode[] = [
    { id: 'top', x: 500, y: 100, width: 300, height: 90, title: 'Inicio', body: '', shape: 'decision', tone: 'blue' },
    { id: 'mid', x: 500, y: 310, width: 300, height: 100, title: 'Intermedio', body: '', shape: 'process', tone: 'white' },
    { id: 'bot', x: 500, y: 540, width: 300, height: 90, title: 'Final', body: '', shape: 'process', tone: 'mint' },
    { id: 'sideA', x: 100, y: 310, width: 280, height: 90, title: 'Rama A', body: '', shape: 'process', tone: 'mint' },
    { id: 'sideB', x: 150, y: 540, width: 280, height: 90, title: 'Rama B', body: '', shape: 'process', tone: 'amber' },
  ];
  const edges = [
    { id: 'skip', from: 'top', to: 'bot', label: 'Atajo directo', style: 'solid' as const },
    { id: 'left1', from: 'top', to: 'sideA', label: 'Opción A larga', style: 'solid' as const },
    { id: 'left2', from: 'top', to: 'sideB', label: 'Opción B larga', style: 'dashed' as const },
  ];

  const geoms = computeDiagramEdgeGeometries(nodes, edges);
  const skipGeom = geoms.get('skip')!;
  const left1Geom = geoms.get('left1')!;
  const left2Geom = geoms.get('left2')!;

  // Skip edge from top (x=650) to bot (x=650) with mid blocking at x=500..800 must detour orthogonally (contains 'Q ')
  assert.ok(skipGeom.pathD.includes('Q '), 'skip edge blocked by middle box should detour cleanly with rounded corners');

  // Sibling labels should not sit at identical coordinates
  const labelDist = Math.hypot(left1Geom.labelX - left2Geom.labelX, left1Geom.labelY - left2Geom.labelY);
  assert.ok(labelDist > 20, `sibling labels should be separated cleanly (distance=${labelDist})`);
});



