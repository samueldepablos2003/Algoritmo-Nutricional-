import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendStroke,
  clampZoom,
  collectAvailableTags,
  createBackupPayload,
  filterAlgorithms,
  getNextViewerIndex,
  getStudyProgressRatio,
  MAX_ZOOM,
  MIN_ZOOM,
  normalizeSearchText,
  normalizeTags,
  parseBackupJson,
  shuffleAlgorithms,
  stepZoom,
  undoLastStroke,
} from './algorithmLogic';
import type { AlgorithmItem, HighlightStroke } from '../types/algorithm';

const sampleAlgorithms: AlgorithmItem[] = [
  {
    id: 'algo-1',
    title: 'Algoritmo de Nutrición Enteral en UCI',
    tags: ['Críticos', 'Nutrición Enteral'],
    imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    notes: 'Evaluar síndrome de realimentación en las primeras 48 horas.',
    strokes: [],
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: 'algo-2',
    title: 'Protocolo Nutricional en Pancreatitis Aguda',
    tags: ['Gastroenterología', 'Cirugía'],
    imageDataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    notes: 'Preferir vía enteral temprana en pancreatitis moderada o grave.',
    strokes: [],
    createdAt: 2000,
    updatedAt: 2000,
  },
];

test('normalizeSearchText strips Spanish accents and trims whitespace', () => {
  assert.equal(normalizeSearchText('  Nutrición Crítica  '), 'nutricion critica');
  assert.equal(normalizeSearchText('Pediatría'), 'pediatria');
});

test('normalizeTags deduplicates case-insensitively and removes empty entries', () => {
  const tags = normalizeTags(['  Críticos ', 'criticos', '', 'Cirugía', '  cirugia  ']);
  assert.deepEqual(tags, ['Críticos', 'Cirugía']);
});

test('filterAlgorithms filters by accent-insensitive title, tags, notes, and active category', () => {
  const byTitle = filterAlgorithms(sampleAlgorithms, 'nutricion uci', null);
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, 'algo-1');

  const byTag = filterAlgorithms(sampleAlgorithms, 'gastroenterologia', null);
  assert.equal(byTag.length, 1);
  assert.equal(byTag[0].id, 'algo-2');

  const byNotes = filterAlgorithms(sampleAlgorithms, 'realimentacion', null);
  assert.equal(byNotes.length, 1);
  assert.equal(byNotes[0].id, 'algo-1');

  const byCategoryAndQuery = filterAlgorithms(sampleAlgorithms, 'enteral', 'Cirugía');
  assert.equal(byCategoryAndQuery.length, 1);
  assert.equal(byCategoryAndQuery[0].id, 'algo-2');

  const noMatch = filterAlgorithms(sampleAlgorithms, 'nefrologia', null);
  assert.equal(noMatch.length, 0);
});

test('collectAvailableTags gathers sorted unique categories', () => {
  assert.deepEqual(collectAvailableTags(sampleAlgorithms), [
    'Cirugía',
    'Críticos',
    'Gastroenterología',
    'Nutrición Enteral',
  ]);
});

test('zoom clamping and stepping respect bounds', () => {
  assert.equal(clampZoom(0.1), MIN_ZOOM);
  assert.equal(clampZoom(9.0), MAX_ZOOM);
  assert.equal(stepZoom(1, 'in'), 1.25);
  assert.equal(stepZoom(1, 'out'), 0.75);
});

test('getNextViewerIndex wraps around cleanly in both directions', () => {
  assert.equal(getNextViewerIndex(0, 3, 'next'), 1);
  assert.equal(getNextViewerIndex(2, 3, 'next'), 0);
  assert.equal(getNextViewerIndex(0, 3, 'prev'), 2);
  assert.equal(getNextViewerIndex(0, 1, 'next'), 0);
});

test('stroke stack append and undo preserve immutability', () => {
  const stroke: HighlightStroke = {
    id: 's-1',
    color: 'yellow',
    width: 0.02,
    points: [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.4 },
    ],
  };

  const emptyStroke: HighlightStroke = { id: 's-empty', color: 'mint', width: 0.02, points: [] };
  assert.equal(appendStroke([], emptyStroke).length, 0);

  const added = appendStroke([], stroke);
  assert.equal(added.length, 1);
  const undone = undoLastStroke(added);
  assert.equal(undone.length, 0);
  assert.equal(added.length, 1);
});

test('backup export and import validates payloads strictly', () => {
  const backup = createBackupPayload(sampleAlgorithms);
  const serialized = JSON.stringify(backup);
  const parsed = parseBackupJson(serialized);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.algorithms.length, 2);
    assert.equal(parsed.algorithms[0].title, sampleAlgorithms[0].title);
  }

  const badJson = parseBackupJson('{invalid');
  assert.equal(badJson.ok, false);

  const missingImage = parseBackupJson(
    JSON.stringify({ algorithms: [{ id: 'x', title: 'Test', imageDataUrl: 'http://bad' }] })
  );
  assert.equal(missingImage.ok, false);
});

test('shuffleAlgorithms preserves elements, never mutates input, and avoids repeating first item', () => {
  const deck = [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
  ];

  // Deterministic RNG that would normally leave 'a' first unless avoidFirstId swaps it
  const shuffled = shuffleAlgorithms(deck, { avoidFirstId: 'a', random: () => 0 });
  assert.equal(shuffled.length, deck.length);
  assert.deepEqual(
    [...shuffled].map((x) => x.id).sort(),
    ['a', 'b', 'c', 'd']
  );
  assert.notEqual(shuffled[0].id, 'a');
  // Original array untouched
  assert.deepEqual(deck.map((x) => x.id), ['a', 'b', 'c', 'd']);

  // Single-item deck returns copy safely
  assert.deepEqual(shuffleAlgorithms([{ id: 'only' }], { avoidFirstId: 'only' }), [{ id: 'only' }]);
  assert.deepEqual(shuffleAlgorithms([]), []);
});

test('getStudyProgressRatio calculates clamped progress fractions safely', () => {
  assert.equal(getStudyProgressRatio(0, 0), 0);
  assert.equal(getStudyProgressRatio(0, 2), 0.5);
  assert.equal(getStudyProgressRatio(1, 2), 1);
  assert.equal(getStudyProgressRatio(99, 4), 1);
});

test('backup export and import preserves valid sourceImageDataUrl and drops invalid references', () => {
  const originalImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const backup = createBackupPayload([
    {
      ...sampleAlgorithms[0],
      sourceImageDataUrl: originalImg,
    },
    {
      ...sampleAlgorithms[1],
      sourceImageDataUrl: 'https://example.com/not-a-data-url.png',
    },
  ]);

  const parsed = parseBackupJson(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.algorithms[0].sourceImageDataUrl, originalImg);
    assert.equal(parsed.algorithms[1].sourceImageDataUrl, undefined);
  }
});

