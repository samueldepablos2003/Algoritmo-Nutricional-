import type { AlgorithmItem, EditableDiagram } from '../types/algorithm';
import { autoLayoutDiagram } from './diagramEngine';

function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg.trim())
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

const UCI_ENTERAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 148 1600 854" width="1600" height="854">
  <title>Algoritmo de Nutrición Enteral en el Paciente Crítico (UCI)</title>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#0071E3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#15803D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#B45309" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .t-title { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 16px; font-weight: 700; fill: #1D1D1F; }
      .t-body { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 13.5px; font-weight: 500; fill: #3A3A3C; }
      .t-small { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 12.5px; font-weight: 500; fill: #6E6E73; }
      .t-branch { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 12px; font-weight: 700; }
      .t-mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 600; fill: #1D1D1F; }
    </style>
  </defs>

  <rect x="0" y="148" width="1600" height="854" fill="#FFFFFF"/>

  <!-- Subtle clinical grid dots -->
  <g fill="#E5E5EA" opacity="0.6">
    <circle cx="80" cy="172" r="1.5"/><circle cx="1520" cy="172" r="1.5"/>
    <circle cx="80" cy="988" r="1.5"/><circle cx="1520" cy="988" r="1.5"/>
  </g>

  <!-- STEP 1: Ingreso UCI -->
  <rect x="480" y="172" width="640" height="86" rx="14" fill="#F5F5F7" stroke="#D1D1D6" stroke-width="1.5"/>
  <text x="800" y="206" text-anchor="middle" class="t-title">1. Ingreso a UCI y Evaluación Inicial (Primeras 24–48 horas)</text>
  <text x="800" y="232" text-anchor="middle" class="t-body">Tamizaje de riesgo nutricional: NRS-2002 (≥ 5 alto riesgo) o escala mNUTRIC (≥ 5)</text>

  <!-- Connector 1 -> 2 -->
  <line x1="800" y1="258" x2="800" y2="306" stroke="#8E8E93" stroke-width="2" marker-end="url(#arrow)"/>

  <!-- STEP 2: Estabilidad Hemodinámica -->
  <rect x="495" y="314" width="610" height="86" rx="14" fill="#F0F7FF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="800" y="348" text-anchor="middle" class="t-title" fill="#0C4A6E">2. ¿Estabilidad Hemodinámica y Tracto GI Funcional?</text>
  <text x="800" y="374" text-anchor="middle" class="t-body">PAM ≥ 65 mmHg · Lactato en descenso · Vasopresores estables o en destete</text>

  <!-- Left Branch: NO (Shock no controlado) -->
  <path d="M 495 357 L 250 357 L 250 456" fill="none" stroke="#B45309" stroke-width="2" marker-end="url(#arrow-amber)"/>
  <rect x="330" y="341" width="96" height="28" rx="6" fill="#FEF3C7"/>
  <text x="378" y="360" text-anchor="middle" class="t-branch" fill="#92400E">NO · SHOCK</text>

  <rect x="80" y="466" width="340" height="132" rx="14" fill="#FFFBEB" stroke="#FCD34D" stroke-width="1.5"/>
  <text x="250" y="498" text-anchor="middle" class="t-title" fill="#92400E">Diferir Nutrición Enteral</text>
  <text x="250" y="524" text-anchor="middle" class="t-body">• Priorizar reanimación con fluidos</text>
  <text x="250" y="548" text-anchor="middle" class="t-body">• Evitar isquemia intestinal no oclusiva</text>
  <text x="250" y="574" text-anchor="middle" class="t-small">Reevaluar perfusión cada 6–12 horas</text>

  <!-- Right Branch: NO GI Funcional (Contraindicación absoluta) -->
  <path d="M 1105 357 L 1350 357 L 1350 456" fill="none" stroke="#8E8E93" stroke-width="2" marker-end="url(#arrow)"/>
  <rect x="1158" y="341" width="144" height="28" rx="6" fill="#FEE2E2"/>
  <text x="1230" y="360" text-anchor="middle" class="t-branch" fill="#991B1B">GI NO FUNCIONAL</text>

  <rect x="1180" y="466" width="340" height="132" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.5"/>
  <text x="1350" y="498" text-anchor="middle" class="t-title" fill="#991B1B">Evaluar Nutrición Parenteral</text>
  <text x="1350" y="524" text-anchor="middle" class="t-body">• Obstrucción, fístula de alto gasto</text>
  <text x="1350" y="548" text-anchor="middle" class="t-body">• Alto riesgo nutricional: NPT en 3–5 d</text>
  <text x="1350" y="574" text-anchor="middle" class="t-body">• Bajo riesgo: considerar NPT tras día 7</text>

  <!-- Center Branch: SÍ (Iniciar NE Temprana) -->
  <line x1="800" y1="400" x2="800" y2="458" stroke="#15803D" stroke-width="2.2" marker-end="url(#arrow-green)"/>
  <rect x="752" y="414" width="96" height="26" rx="6" fill="#DCFCE7"/>
  <text x="800" y="431" text-anchor="middle" class="t-branch" fill="#166534">SÍ · ESTABLE</text>

  <!-- STEP 3: Inicio de NE Temprana -->
  <rect x="495" y="466" width="610" height="114" rx="14" fill="#ECFDF5" stroke="#6EE7B7" stroke-width="1.5"/>
  <text x="800" y="498" text-anchor="middle" class="t-title" fill="#065F46">3. Iniciar Nutrición Enteral Temprana (24–48 h)</text>
  <text x="800" y="524" text-anchor="middle" class="t-body">Acceso gástrico (SNG) de primera línea · Fórmula polimérica estándar isotónica</text>
  <text x="800" y="550" text-anchor="middle" class="t-mono">Inicio trófico: 10–20 mL/h  ·  Cabecera elevada 30°–45°</text>

  <!-- Connector 3 -> 4 -->
  <line x1="800" y1="580" x2="800" y2="634" stroke="#0071E3" stroke-width="2" marker-end="url(#arrow-blue)"/>

  <!-- STEP 4: Progresión y Metas -->
  <rect x="470" y="642" width="660" height="122" rx="14" fill="#FFFFFF" stroke="#0071E3" stroke-width="1.8"/>
  <text x="800" y="674" text-anchor="middle" class="t-title" fill="#0071E3">4. Progresión Escalonada y Metas Nutricionales (Días 3–7)</text>
  <text x="800" y="702" text-anchor="middle" class="t-mono">Energía: 25–30 kcal/kg/día (70% en fase aguda)  |  Proteína: 1.3–2.0 g/kg/día</text>
  <text x="800" y="730" text-anchor="middle" class="t-body">Vigilar electrolitos (P, K, Mg) y tiamina IV si existe riesgo de síndrome de realimentación</text>

  <!-- Connector 4 -> 5A & 5B -->
  <path d="M 620 764 L 620 806 L 370 806 L 370 842" fill="none" stroke="#15803D" stroke-width="2" marker-end="url(#arrow-green)"/>
  <rect x="432" y="792" width="136" height="26" rx="6" fill="#DCFCE7"/>
  <text x="500" y="809" text-anchor="middle" class="t-branch" fill="#166534">BUENA TOLERANCIA</text>

  <path d="M 980 764 L 980 806 L 1220 806 L 1220 842" fill="none" stroke="#B45309" stroke-width="2" marker-end="url(#arrow-amber)"/>
  <rect x="1032" y="792" width="144" height="26" rx="6" fill="#FEF3C7"/>
  <text x="1104" y="809" text-anchor="middle" class="t-branch" fill="#92400E">INTOLERANCIA GI</text>

  <!-- STEP 5A: Tolerancia adecuada -->
  <rect x="110" y="850" width="520" height="128" rx="14" fill="#F5F5F7" stroke="#D1D1D6" stroke-width="1.5"/>
  <text x="370" y="882" text-anchor="middle" class="t-title">5A. Mantener Meta y Monitorización Diaria</text>
  <text x="370" y="910" text-anchor="middle" class="t-body">• Control glucémico objetivo: 140–180 mg/dL</text>
  <text x="370" y="934" text-anchor="middle" class="t-body">• Verificar balance calórico real (&gt; 80% de la meta al día 5)</text>
  <text x="370" y="958" text-anchor="middle" class="t-body">• Evaluar transición a vía oral tras extubación segura</text>

  <!-- STEP 5B: Intolerancia GI -->
  <rect x="960" y="850" width="520" height="128" rx="14" fill="#FFFBEB" stroke="#F59E0B" stroke-width="1.5"/>
  <text x="1220" y="882" text-anchor="middle" class="t-title" fill="#92400E">5B. Manejo de Intolerancia (VRG &gt; 500 mL / Vómito)</text>
  <text x="1220" y="910" text-anchor="middle" class="t-body">1. Iniciar procinético (metoclopramida o eritromicina IV)</text>
  <text x="1220" y="934" text-anchor="middle" class="t-body">2. Avanzar acceso a vía post-pilórica (sonda nasoyeyunal)</text>
  <text x="1220" y="958" text-anchor="middle" class="t-body">3. Si aporte &lt; 60% tras día 7: considerar NP suplementaria</text>

</svg>
`;

const PANCREATITIS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 148 1600 806" width="1600" height="806">
  <title>Algoritmo de Soporte Nutricional en Pancreatitis Aguda</title>
  <defs>
    <marker id="p-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#8E8E93" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="p-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#0071E3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="p-arrow-green" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#15803D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <marker id="p-arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1.5 L 8.5 5 L 1 8.5" fill="none" stroke="#DC2626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <style>
      .t-title { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 16px; font-weight: 700; fill: #1D1D1F; }
      .t-body { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 13.5px; font-weight: 500; fill: #3A3A3C; }
      .t-small { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 12.5px; font-weight: 500; fill: #6E6E73; }
      .t-branch { font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", sans-serif; font-size: 12px; font-weight: 700; }
      .t-mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 12.5px; font-weight: 600; fill: #1D1D1F; }
    </style>
  </defs>

  <rect x="0" y="148" width="1600" height="806" fill="#FFFFFF"/>

  <!-- STEP 1 -->
  <rect x="470" y="172" width="660" height="86" rx="14" fill="#F5F5F7" stroke="#D1D1D6" stroke-width="1.5"/>
  <text x="800" y="206" text-anchor="middle" class="t-title">1. Diagnóstico Confirmado de Pancreatitis Aguda</text>
  <text x="800" y="232" text-anchor="middle" class="t-body">Reanimación hídrica dirigida (Ringer Lactato), analgesia y estratificación de severidad (Atlanta)</text>

  <!-- Split to Mild vs Moderate/Severe -->
  <path d="M 650 258 L 650 302 L 360 302 L 360 348" fill="none" stroke="#15803D" stroke-width="2" marker-end="url(#p-arrow-green)"/>
  <rect x="424" y="288" width="152" height="26" rx="6" fill="#DCFCE7"/>
  <text x="500" y="305" text-anchor="middle" class="t-branch" fill="#166534">PANCREATITIS LEVE</text>

  <path d="M 950 258 L 950 302 L 1160 302 L 1160 348" fill="none" stroke="#0071E3" stroke-width="2" marker-end="url(#p-arrow-blue)"/>
  <rect x="974" y="288" width="176" height="26" rx="6" fill="#DBEAFE"/>
  <text x="1062" y="305" text-anchor="middle" class="t-branch" fill="#1E40AF">MODERADA O GRAVE</text>

  <!-- LEFT PATH: LEVE -->
  <rect x="100" y="356" width="520" height="122" rx="14" fill="#ECFDF5" stroke="#6EE7B7" stroke-width="1.5"/>
  <text x="360" y="388" text-anchor="middle" class="t-title" fill="#065F46">2A. Vía Oral Temprana (Primeras 24–48 h)</text>
  <text x="360" y="416" text-anchor="middle" class="t-body">• Iniciar tan pronto disminuyan dolor abdominal y náusea</text>
  <text x="360" y="440" text-anchor="middle" class="t-body">• No esperar normalización completa de lipasa sérica</text>
  <text x="360" y="464" text-anchor="middle" class="t-mono">Dieta blanda sólida baja en grasas desde el inicio</text>

  <line x1="360" y1="478" x2="360" y2="544" stroke="#15803D" stroke-width="2" marker-end="url(#p-arrow-green)"/>

  <rect x="100" y="552" width="520" height="114" rx="14" fill="#F5F5F7" stroke="#D1D1D6" stroke-width="1.5"/>
  <text x="360" y="586" text-anchor="middle" class="t-title">3A. Progresión Oral y Seguimiento</text>
  <text x="360" y="612" text-anchor="middle" class="t-body">• Progresar según tolerancia clínica sin ayuno prolongado</text>
  <text x="360" y="638" text-anchor="middle" class="t-body">• Si no tolera vía oral tras 5 días: migrar a Nutrición Enteral</text>

  <!-- Cross-over arrow from 3A to 2B if oral fails -->
  <path d="M 620 610 L 760 610 L 760 416 L 832 416" fill="none" stroke="#8E8E93" stroke-width="1.6" stroke-dasharray="6 5" marker-end="url(#p-arrow)"/>
  <text x="690" y="600" text-anchor="middle" class="t-small">Sin tolerancia &gt; 5 d</text>

  <!-- RIGHT PATH: MODERADA O GRAVE -->
  <rect x="840" y="356" width="640" height="122" rx="14" fill="#F0F7FF" stroke="#93C5FD" stroke-width="1.5"/>
  <text x="1160" y="388" text-anchor="middle" class="t-title" fill="#0C4A6E">2B. Nutrición Enteral Temprana (&lt; 48 horas)</text>
  <text x="1160" y="416" text-anchor="middle" class="t-body">• Primera línea: Sonda Nasogástrica (SNG) con infusión continua</text>
  <text x="1160" y="440" text-anchor="middle" class="t-body">• Sonda Nasoyeyunal (SNY) si obstrucción duodenal o intolerancia gástrica</text>
  <text x="1160" y="464" text-anchor="middle" class="t-mono">Fórmula polimérica estándar  ·  Preserva barrera intestinal</text>

  <line x1="1160" y1="478" x2="1160" y2="544" stroke="#0071E3" stroke-width="2" marker-end="url(#p-arrow-blue)"/>

  <!-- STEP 3B: Evaluación de Tolerancia -->
  <rect x="840" y="552" width="640" height="114" rx="14" fill="#FFFFFF" stroke="#0071E3" stroke-width="1.8"/>
  <text x="1160" y="586" text-anchor="middle" class="t-title" fill="#0071E3">3B. Evaluación de Tolerancia y Metas (Días 2–5)</text>
  <text x="1160" y="614" text-anchor="middle" class="t-mono">Objetivo: 25–30 kcal/kg/día  |  Proteínas: 1.2–1.5 g/kg/día</text>
  <text x="1160" y="640" text-anchor="middle" class="t-body">Vigilar dolor refractario, distensión abdominal, presión intraabdominal (PIA)</text>

  <!-- Split 3B -> 4A (Malabsorción) & 4B (Contraindicación NE / Íleo) -->
  <path d="M 1010 666 L 1010 718 L 620 718 L 620 770" fill="none" stroke="#8E8E93" stroke-width="2" marker-end="url(#p-arrow)"/>
  <rect x="720" y="704" width="192" height="26" rx="6" fill="#FEF3C7"/>
  <text x="816" y="721" text-anchor="middle" class="t-branch" fill="#92400E">INTOLERANCIA / DIARREA</text>

  <path d="M 1310 666 L 1310 718 L 1280 718 L 1280 770" fill="none" stroke="#DC2626" stroke-width="2" marker-end="url(#p-arrow-red)"/>
  <rect x="1168" y="722" width="224" height="26" rx="6" fill="#FEE2E2"/>
  <text x="1280" y="739" text-anchor="middle" class="t-branch" fill="#991B1B">ÍLEO / PIA &gt; 20 mmHg / FÍSTULA</text>

  <!-- STEP 4A: Fórmula Semielemental -->
  <rect x="330" y="778" width="580" height="148" rx="14" fill="#FFFBEB" stroke="#FCD34D" stroke-width="1.5"/>
  <text x="620" y="810" text-anchor="middle" class="t-title" fill="#92400E">4A. Optimización Enteral (Fórmula Semielemental)</text>
  <text x="620" y="838" text-anchor="middle" class="t-body">• Cambiar a fórmula oligomérica / peptídica rica en TCM</text>
  <text x="620" y="862" text-anchor="middle" class="t-body">• Reducir velocidad de infusión temporalmente (15–25 mL/h)</text>
  <text x="620" y="886" text-anchor="middle" class="t-body">• Considerar enzimas pancreáticas si insuficiencia exocrina</text>
  <text x="620" y="910" text-anchor="middle" class="t-small">Mantener mínimo aporte trófico siempre que sea seguro</text>

  <!-- STEP 4B: Nutrición Parenteral -->
  <rect x="970" y="778" width="550" height="148" rx="14" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1.5"/>
  <text x="1245" y="810" text-anchor="middle" class="t-title" fill="#991B1B">4B. Nutrición Parenteral Total o Suplementaria</text>
  <text x="1245" y="838" text-anchor="middle" class="t-body">• Indicada solo si NE imposible o &lt; 60% de meta tras 5–7 días</text>
  <text x="1245" y="862" text-anchor="middle" class="t-body">• Limitar lípidos si triglicéridos séricos &gt; 400 mg/dL</text>
  <text x="1245" y="886" text-anchor="middle" class="t-body">• Monitoreo estricto de glucemia, fosfato y función hepática</text>
  <text x="1245" y="910" text-anchor="middle" class="t-small">Reintroducir NE gradualmente al resolver íleo o PIA elevada</text>

</svg>
`;

function createUciEnteralDiagram(): EditableDiagram {
  return autoLayoutDiagram({
    title: 'Algoritmo de Nutrición Enteral en el Paciente Crítico (UCI)',
    subtitle:
      'Guía estructurada de tamizaje, inicio temprano (< 48 h), progresión calórico-proteica y manejo de intolerancia',
    tags: ['Críticos', 'Nutrición Enteral'],
    notes:
      'Puntos clave de estudio:\n• Evaluar riesgo nutricional (NRS-2002 o mNUTRIC) al ingreso.\n• Iniciar NE temprana (<48h) una vez lograda la estabilidad hemodinámica.\n• Vigilar fosfato, potasio y magnesio las primeras 72 horas para prevenir síndrome de realimentación.',
    nodes: [
      {
        id: 'uci-1',
        x: 0,
        y: 0,
        width: 390,
        height: 94,
        title: '1. Ingreso a UCI y Tamizaje Inicial (24–48 h)',
        body: 'Evaluar riesgo nutricional con NRS-2002 (≥ 5 alto riesgo) o escala mNUTRIC (≥ 5)',
        shape: 'pill',
        tone: 'gray',
      },
      {
        id: 'uci-2',
        x: 0,
        y: 0,
        width: 390,
        height: 102,
        title: '2. ¿Estabilidad Hemodinámica y Tracto GI Funcional?',
        body: 'PAM ≥ 65 mmHg · Lactato en descenso · Vasopresores estables o en destete',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'uci-shock',
        x: 0,
        y: 0,
        width: 320,
        height: 122,
        title: 'Diferir Nutrición Enteral',
        body: 'Priorizar reanimación con fluidos y evitar isquemia intestinal. Reevaluar perfusión cada 6–12 h',
        shape: 'process',
        tone: 'amber',
      },
      {
        id: 'uci-3',
        x: 0,
        y: 0,
        width: 360,
        height: 112,
        title: '3. Iniciar Nutrición Enteral Temprana (< 48 h)',
        body: 'SNG primera línea · Fórmula polimérica estándar isotónica · Inicio trófico 10–20 mL/h · Cabecera 30°–45°',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'uci-np',
        x: 0,
        y: 0,
        width: 320,
        height: 122,
        title: 'Evaluar Nutrición Parenteral',
        body: 'Obstrucción o fístula de alto gasto · Alto riesgo nutricional: NPT en 3–5 d · Bajo riesgo: tras día 7',
        shape: 'process',
        tone: 'rose',
      },
      {
        id: 'uci-4',
        x: 0,
        y: 0,
        width: 380,
        height: 112,
        title: '4. Progresión y Evaluación de Tolerancia (Días 3–7)',
        body: 'Meta: 25–30 kcal/kg/d · Proteína: 1.3–2.0 g/kg/d · Vigilar P, K, Mg y tiamina IV si riesgo de realimentación',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'uci-5a',
        x: 0,
        y: 0,
        width: 350,
        height: 122,
        title: '5A. Mantener Meta y Monitorización Diaria',
        body: 'Glucemia 140–180 mg/dL · Verificar balance calórico > 80% al día 5 · Evaluar transición a vía oral',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'uci-5b',
        x: 0,
        y: 0,
        width: 360,
        height: 122,
        title: '5B. Manejo de Intolerancia (VRG > 500 mL / Vómito)',
        body: 'Iniciar procinético IV · Avanzar a acceso post-pilórico (SNY) · Si aporte < 60% tras día 7: NP suplementaria',
        shape: 'process',
        tone: 'amber',
      },
    ],
    edges: [
      { id: 'uci-e1', from: 'uci-1', to: 'uci-2', label: '', style: 'solid' },
      { id: 'uci-e2', from: 'uci-2', to: 'uci-shock', label: 'No · Shock no controlado', style: 'solid' },
      { id: 'uci-e3', from: 'uci-2', to: 'uci-3', label: 'Sí · Estable y GI funcional', style: 'solid' },
      { id: 'uci-e4', from: 'uci-2', to: 'uci-np', label: 'No · GI no funcional', style: 'dashed' },
      { id: 'uci-e5', from: 'uci-3', to: 'uci-4', label: '', style: 'solid' },
      { id: 'uci-e6', from: 'uci-4', to: 'uci-5a', label: 'Sí · Buena tolerancia', style: 'solid' },
      { id: 'uci-e7', from: 'uci-4', to: 'uci-5b', label: 'No · Intolerancia GI', style: 'solid' },
    ],
  });
}

function createPancreatitisDiagram(): EditableDiagram {
  return autoLayoutDiagram({
    title: 'Algoritmo de Soporte Nutricional en Pancreatitis Aguda',
    subtitle:
      'Estratificación por criterios de Atlanta revisados, selección de vía de alimentación y escalamiento terapéutico',
    tags: ['Gastroenterología', 'Cirugía'],
    notes:
      'Puntos clave de estudio:\n• En pancreatitis leve, iniciar dieta sólida baja en grasas en 24–48 h sin esperar normalización de lipasa.\n• En formas moderadas/graves, la NE vía SNG es igual de segura y eficaz que la SNY como primera línea.\n• Reservar la NP únicamente cuando exista íleo persistente, PIA > 20 mmHg o intolerancia refractaria.',
    nodes: [
      {
        id: 'panc-1',
        x: 0,
        y: 0,
        width: 390,
        height: 98,
        title: '1. Diagnóstico de Pancreatitis Aguda (Severidad Atlanta)',
        body: 'Reanimación hídrica dirigida (Ringer Lactato), analgesia y estratificación de severidad',
        shape: 'decision',
        tone: 'gray',
      },
      {
        id: 'panc-2a',
        x: 0,
        y: 0,
        width: 340,
        height: 112,
        title: '2A. Vía Oral Temprana (24–48 h)',
        body: 'Iniciar al disminuir dolor y náusea sin esperar lipasa normal · Dieta blanda sólida baja en grasas',
        shape: 'process',
        tone: 'mint',
      },
      {
        id: 'panc-2b',
        x: 0,
        y: 0,
        width: 360,
        height: 112,
        title: '2B. Nutrición Enteral Temprana (< 48 h)',
        body: 'Primera línea: SNG infusión continua (SNY si obstrucción duodenal) · Fórmula polimérica estándar',
        shape: 'process',
        tone: 'blue',
      },
      {
        id: 'panc-3a',
        x: 0,
        y: 0,
        width: 340,
        height: 112,
        title: '3A. Progresión Oral y Seguimiento',
        body: 'Progresar según tolerancia clínica sin ayuno prolongado · Alta con seguimiento nutricional',
        shape: 'decision',
        tone: 'gray',
      },
      {
        id: 'panc-3b',
        x: 0,
        y: 0,
        width: 370,
        height: 112,
        title: '3B. Evaluación de Tolerancia y Metas (Días 2–5)',
        body: 'Meta: 25–30 kcal/kg/d · Proteína: 1.2–1.5 g/kg/d · Vigilar dolor refractario, distensión y PIA',
        shape: 'decision',
        tone: 'blue',
      },
      {
        id: 'panc-4a',
        x: 0,
        y: 0,
        width: 350,
        height: 122,
        title: '4A. Optimización Enteral (Semielemental)',
        body: 'Cambiar a fórmula oligomérica rica en TCM · Reducir velocidad (15–25 mL/h) · Enzimas pancreáticas si IPE',
        shape: 'process',
        tone: 'amber',
      },
      {
        id: 'panc-4b',
        x: 0,
        y: 0,
        width: 360,
        height: 122,
        title: '4B. Nutrición Parenteral Total o Suplementaria',
        body: 'Si NE imposible o < 60% tras 5–7 d · Limitar lípidos si TG > 400 mg/dL · Reintroducir NE al resolver íleo',
        shape: 'process',
        tone: 'rose',
      },
      {
        id: 'panc-alta',
        x: 0,
        y: 0,
        width: 330,
        height: 102,
        title: 'Mantener Vía Oral y Alta Segura',
        body: 'Buena tolerancia oral sin complicaciones · Consejería dietética baja en grasas',
        shape: 'pill',
        tone: 'mint',
      },
    ],
    edges: [
      { id: 'panc-e1', from: 'panc-1', to: 'panc-2a', label: 'Pancreatitis Leve', style: 'solid' },
      { id: 'panc-e2', from: 'panc-1', to: 'panc-2b', label: 'Moderada o Grave', style: 'solid' },
      { id: 'panc-e3', from: 'panc-2a', to: 'panc-3a', label: '', style: 'solid' },
      { id: 'panc-e4', from: 'panc-3a', to: 'panc-alta', label: 'Sí · Tolera vía oral', style: 'solid' },
      { id: 'panc-e5', from: 'panc-3a', to: 'panc-2b', label: 'No · Sin tolerancia > 5 d', style: 'dashed' },
      { id: 'panc-e6', from: 'panc-2b', to: 'panc-3b', label: '', style: 'solid' },
      { id: 'panc-e7', from: 'panc-3b', to: 'panc-4a', label: 'Intolerancia / Diarrea', style: 'solid' },
      { id: 'panc-e8', from: 'panc-3b', to: 'panc-4b', label: 'Íleo / PIA > 20 mmHg', style: 'solid' },
    ],
  });
}

export function createSeedAlgorithms(): AlgorithmItem[] {
  const now = Date.now();
  return [
    {
      id: 'seed-uci-nutricion-enteral',
      title: 'Algoritmo de Nutrición Enteral en el Paciente Crítico (UCI)',
      subtitle:
        'Guía estructurada de tamizaje, inicio temprano (< 48 h), progresión calórico-proteica y manejo de intolerancia',
      groupLabel: 'Protocolo clínico · Cuidados Intensivos (ASPEN / ESPEN)',
      tags: ['Críticos', 'Nutrición Enteral'],
      imageDataUrl: svgToDataUrl(UCI_ENTERAL_SVG),
      reference:
        'Guías ESPEN 2023 & ASPEN/SCCM para Terapia Nutricional en Adultos Críticamente Enfermos.',
      notes:
        'Puntos clave de estudio:\n• Evaluar riesgo nutricional (NRS-2002 o mNUTRIC) al ingreso.\n• Iniciar NE temprana (<48h) una vez lograda la estabilidad hemodinámica (vasopresores estables o en descenso).\n• Vigilar fosfato, potasio y magnesio las primeras 72 horas para prevenir síndrome de realimentación.\n• No suspender la NE por volumen residual gástrico aislado < 500 mL sin signos clínicos de intolerancia.',
      strokes: [],
      diagram: createUciEnteralDiagram(),
      createdAt: now - 3600_000,
      updatedAt: now - 3600_000,
      isSample: true,
    },
    {
      id: 'seed-pancreatitis-aguda',
      title: 'Algoritmo de Soporte Nutricional en Pancreatitis Aguda',
      subtitle:
        'Estratificación por criterios de Atlanta revisados, selección de vía de alimentación y escalamiento terapéutico',
      groupLabel: 'Protocolo clínico · Gastroenterología y Cirugía',
      tags: ['Gastroenterología', 'Cirugía'],
      imageDataUrl: svgToDataUrl(PANCREATITIS_SVG),
      reference:
        'Guías ESPEN en Nutrición Clínica para Pancreatitis Aguda y Crónica (2020–2024).',
      notes:
        'Puntos clave de estudio:\n• En pancreatitis leve, iniciar dieta sólida baja en grasas en 24–48 h sin esperar normalización de lipasa.\n• En formas moderadas/graves, la nutrición enteral vía SNG es igual de segura y eficaz que la SNY como primera línea.\n• Reservar la nutrición parenteral únicamente cuando exista íleo persistente, PIA > 20 mmHg o intolerancia refractaria.',
      strokes: [],
      diagram: createPancreatitisDiagram(),
      createdAt: now - 1800_000,
      updatedAt: now - 1800_000,
      isSample: true,
    },
  ];
}
