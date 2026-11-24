import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDiagram } from './diagramEngine.ts';
import {
  createInitialWalkthrough,
  findStartNodeId,
  formatWalkthroughSummary,
  getAvailableOutgoingEdges,
  getCurrentNodeId,
  getSelectableEdgeIds,
  isWalkthroughComplete,
  rewindWalkthroughToNode,
  selectWalkthroughEdge,
  stepBackWalkthrough,
} from './walkthroughEngine.ts';

describe('walkthroughEngine', () => {
  it('detects the root starting node and advances cleanly along chosen connections', () => {
    const diagram = createStarterDiagram();
    const startId = findStartNodeId(diagram);
    assert.equal(startId, 'n1');

    let state = createInitialWalkthrough(diagram);
    assert.equal(getCurrentNodeId(state), 'n1');
    assert.equal(isWalkthroughComplete(diagram, state), false);

    // Step 1 -> Step 2 (linear single outgoing edge e1)
    const firstChoices = getAvailableOutgoingEdges(diagram, state);
    assert.equal(firstChoices.length, 1);
    assert.equal(firstChoices[0].id, 'e1');

    state = selectWalkthroughEdge(diagram, state, 'e1');
    assert.equal(getCurrentNodeId(state), 'n2');

    // Step 2 has 2 decision branches: e2 (Sí) and e3 (No)
    const decisionChoices = getAvailableOutgoingEdges(diagram, state);
    assert.equal(decisionChoices.length, 2);

    state = selectWalkthroughEdge(diagram, state, 'e2');
    assert.equal(getCurrentNodeId(state), 'n3');
    assert.equal(isWalkthroughComplete(diagram, state), true);
    assert.equal(state.steps[2].decisionLabel, 'Sí · Funcional');
  });

  it('allows one-click branch switching on a sibling connection from an earlier decision node', () => {
    const diagram = createStarterDiagram();
    let state = createInitialWalkthrough(diagram);
    state = selectWalkthroughEdge(diagram, state, 'e1');
    state = selectWalkthroughEdge(diagram, state, 'e2'); // n1 -> n2 -> n3

    // Sibling branch e3 (n2 -> n4) must remain selectable directly on the canvas
    const selectable = getSelectableEdgeIds(diagram, state);
    assert.equal(selectable.has('e3'), true);
    assert.equal(selectable.has('e2'), false);

    // Clicking e3 rewinds to n2 and immediately activates n4
    state = selectWalkthroughEdge(diagram, state, 'e3');
    assert.deepEqual(
      state.steps.map((s) => s.nodeId),
      ['n1', 'n2', 'n4']
    );
    assert.equal(state.steps[2].decisionLabel, 'No · Contraindicado');
  });

  it('supports rewinding to an earlier node and stepping back safely', () => {
    const diagram = createStarterDiagram();
    let state = createInitialWalkthrough(diagram);
    state = selectWalkthroughEdge(diagram, state, 'e1');
    state = selectWalkthroughEdge(diagram, state, 'e2');

    state = rewindWalkthroughToNode(state, 'n2');
    assert.deepEqual(
      state.steps.map((s) => s.nodeId),
      ['n1', 'n2']
    );

    state = stepBackWalkthrough(state);
    assert.deepEqual(
      state.steps.map((s) => s.nodeId),
      ['n1']
    );

    // Stepping back at root is a no-op
    state = stepBackWalkthrough(state);
    assert.deepEqual(
      state.steps.map((s) => s.nodeId),
      ['n1']
    );
  });

  it('formats a readable Spanish therapeutic summary with decisions and final conduct', () => {
    const diagram = createStarterDiagram();
    let state = createInitialWalkthrough(diagram);
    state = selectWalkthroughEdge(diagram, state, 'e1');
    state = selectWalkthroughEdge(diagram, state, 'e2');

    const summary = formatWalkthroughSummary(diagram, state);
    assert.match(summary, /RECORRIDO CLÍNICO/);
    assert.match(summary, /\[Sí · Funcional\] → 3A\. Nutrición Enteral Temprana/);
    assert.match(summary, /Conducta terapéutica final: 3A\. Nutrición Enteral Temprana/);
  });
});
