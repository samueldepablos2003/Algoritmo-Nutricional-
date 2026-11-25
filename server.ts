import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const PRIMARY_MODEL = 'gemini-4-hydrogen';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const MAX_CLINICAL_TEXT_CHARS = 150_000;
const MAX_DOCUMENT_BASE64_CHARS = 22_000_000;

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'No se encontró GEMINI_API_KEY en el servidor. Configura tu clave en Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isTransientHighDemandError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('overloaded') ||
    msg.includes('500') ||
    msg.includes('INTERNAL') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET')
  );
}

function extractCleanJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_INSTRUCTION = `Eres un médico nutriólogo clínico especialista en guías internacionales (ASPEN, ESPEN, ERAS, KDIGO, FELANPE) y arquitecto de algoritmos de decisión clínica.
Tu misión es transformar textos clínicos, guías extensas, PDFs o imágenes médicas en algoritmos terapéutico-nutricionales rigurosos, completos y visualmente limpios.

Directrices de análisis interno y estructuración:
1. Comprensión silenciosa del contexto ("clinicalContext"):
   - De forma interna e indirecta, identifica de qué trata el material clínico entregado y guarda una breve introducción en el objeto "clinicalContext" (summary, targetPopulation, clinicalSetting, protocolSource, primaryObjective).
   - Este contexto sirve únicamente para la tarjeta flotante informativa y para guiar tu criterio médico; NO debe aparecer como un cuadro introductorio ni como una división dentro del algoritmo visual.
2. Algoritmo clínico limpio y continuo ("nodes" y "edges"):
   - El diagrama debe ser un flujo clínico limpio, directo y continuo de arriba hacia abajo.
   - NUNCA dividas, agrupes ni etiquetes el algoritmo ni sus nodos como "Fase 1", "Fase 2", "Etapa 1 / 2" ni separes el diagrama en fases artificiales (solo usa terminología clínica real si el protocolo médico original la exige explícitamente).
   - Devuelve EXCLUSIVAMENTE JSON válido acorde al esquema, completamente en español clínico preciso (conservando siglas universales: UCI, NE, NP, NPT, SNG, SNY, IMC, NRS-2002, MUST, GLIM, ASPEN, ESPEN, ERAS).
   - Cantidad adaptativa de nodos según la riqueza real del material (habitualmente entre 6 y 16 nodos; nunca omitas bifurcaciones clínicas críticas ni metas cuantitativas importantes):
     * id: identificador corto y único (ej. "n1", "n2", ...).
     * title: encabezado claro y accionable (máx. 64 caracteres), numerado lógicamente cuando favorezca la lectura (ej. "1. Tamizaje Nutricional", "2. ¿Estabilidad Hemodinámica?").
     * body: 1 a 3 líneas objetivas con criterios exactos, umbrales, tiempos y dosis extraídos del material (ej. "20–25 kcal/kg/d · Proteína 1.2–1.5 g/kg/d · Evaluar < 48 h").
     * comment (opcional): perla clínica, precaución, vigilancia de laboratorio o ajuste fino relevante para ese paso sin recargar el recuadro (cadena vacía si no aporta valor extra).
     * shape:
       - "pill" para el nodo de inicio/ingreso o desenlaces/alta final.
       - "decision" para preguntas clínicas o puntos de bifurcación (Sí / No, estratificación de riesgo).
       - "process" para intervenciones terapéuticas, prescripciones nutricionales o monitoreos.
       - "hexagon" opcional para preparaciones previas o criterios de seguridad/requisitos.
       - "parallelogram" opcional para recolección de datos/parámetros antropométricos o de laboratorio.
     * tone:
       - "gray" para ingreso, tamizaje o evaluación inicial.
       - "blue" para decisiones clave, estratificación o metas principales.
       - "mint" para vía oral, nutrición enteral favorable o evolución exitosa.
       - "amber" para precaución, riesgo moderado, intolerancia o ajustes intermedios.
       - "rose" para contraindicaciones, alertas críticas, alto riesgo o nutrición parenteral de rescate.
       - "white" para pasos estándar neutros.
3. Conexiones ("edges") coherentes, sin nodos huérfanos ni ciclos innecesarios:
   - Cada nodo "decision" debe tener al menos 2 ramas salientes claramente etiquetadas ("Sí", "No", "Riesgo alto", "Tolerancia < 60%", etc.).
   - style: "solid" para ruta principal, "dashed" para rutas alternativas, excepciones o seguimiento condicional, "straight" para conexiones directas cortas.
4. Metadatos clínicos:
   - title: título clínico preciso del algoritmo.
   - subtitle: línea breve de alcance clínico.
   - reference: referencia bibliográfica o guía clínica identificada (ej. "Guías ESPEN en Nutrición Clínica (2024)").
   - tags: 2 a 4 etiquetas clínicas (ej. "Críticos", "Gastroenterología", "Cirugía", "Nutrición Enteral", "Nutrición Parenteral", "Pediatría", "Oncología", "Nefrología").
   - notes: 3 a 5 viñetas concisas separadas por saltos de línea ("• ...") con los puntos clave de estudio.`;

const ALGORITHM_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clinicalContext: {
      type: Type.OBJECT,
      description:
        'Contexto introductorio del algoritmo para el panel flotante informativo (no forma parte de los cuadros del diagrama).',
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Introducción breve (1–2 oraciones) que explique de qué trata este algoritmo clínico-nutricional.',
        },
        targetPopulation: {
          type: Type.STRING,
          description: 'Población clínica diana del protocolo.',
        },
        clinicalSetting: {
          type: Type.STRING,
          description: 'Escenario asistencial principal (UCI, Hospitalización, Perioperatorio, Consulta externa, etc.).',
        },
        protocolSource: {
          type: Type.STRING,
          description: 'Protocolo o guía médico-nutricional identificada en el texto o archivo.',
        },
        primaryObjective: {
          type: Type.STRING,
          description: 'Objetivo terapéutico o nutricional principal del algoritmo.',
        },
      },
      required: ['summary', 'targetPopulation', 'clinicalSetting', 'protocolSource', 'primaryObjective'],
      propertyOrdering: [
        'summary',
        'targetPopulation',
        'clinicalSetting',
        'protocolSource',
        'primaryObjective',
      ],
    },
    title: {
      type: Type.STRING,
      description: 'Título clínico conciso del algoritmo en español.',
    },
    subtitle: {
      type: Type.STRING,
      description: 'Subtítulo de una línea con alcance clínico o guía de referencia.',
    },
    reference: {
      type: Type.STRING,
      description: 'Referencia clínica o bibliográfica identificada en la fuente.',
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'De 2 a 4 categorías clínicas (ej. Críticos, Gastroenterología, Cirugía, Nutrición Enteral).',
    },
    notes: {
      type: Type.STRING,
      description: 'Puntos clave clínicos para modo estudio en viñetas separadas por saltos de línea.',
    },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: 'Identificador corto único (ej. n1, n2, n3).' },
          title: { type: Type.STRING, description: 'Título breve y accionable del nodo.' },
          body: { type: Type.STRING, description: 'Criterios objetivos, dosis, umbrales, tiempos o conducta clínica.' },
          comment: {
            type: Type.STRING,
            description: 'Nota clínica breve, precaución o perla de monitoreo para este nodo (o cadena vacía si no aplica).',
          },
          shape: {
            type: Type.STRING,
            enum: ['process', 'decision', 'pill', 'oval', 'diamond', 'parallelogram', 'hexagon'],
            description: 'Forma semántica del nodo.',
          },
          tone: {
            type: Type.STRING,
            enum: ['white', 'gray', 'mint', 'amber', 'rose', 'blue'],
            description: 'Color semántico suave del nodo.',
          },
        },
        required: ['id', 'title', 'body', 'shape', 'tone'],
        propertyOrdering: ['id', 'title', 'body', 'comment', 'shape', 'tone'],
      },
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: 'ID del nodo origen.' },
          to: { type: Type.STRING, description: 'ID del nodo destino.' },
          label: { type: Type.STRING, description: 'Etiqueta breve sobre la flecha (o cadena vacía).' },
          style: {
            type: Type.STRING,
            enum: ['solid', 'dashed', 'straight'],
            description: 'Estilo del conector.',
          },
        },
        required: ['from', 'to', 'label', 'style'],
        propertyOrdering: ['from', 'to', 'label', 'style'],
      },
    },
  },
  required: ['clinicalContext', 'title', 'subtitle', 'reference', 'tags', 'notes', 'nodes', 'edges'],
  propertyOrdering: [
    'clinicalContext',
    'title',
    'subtitle',
    'reference',
    'tags',
    'notes',
    'nodes',
    'edges',
  ],
};

async function generateDiagramWithRetry(
  ai: GoogleGenAI,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
): Promise<Record<string, unknown>> {
  const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs: number }> = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.HIGH, delayMs: 0 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.MEDIUM, delayMs: 900 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 600 },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ALGORITHM_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
        },
      });

      const rawText = extractCleanJsonText(response.text ?? '');
      if (!rawText) {
        lastError = new Error(
          'El modelo no devolvió contenido estructurado. Intenta con una imagen o texto más claro.'
        );
        continue;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
        lastError = new Error(
          'La IA devolvió una estructura sin pasos clínicos válidos. Intenta nuevamente.'
        );
        continue;
      }

      return parsed;
    } catch (err) {
      lastError = err;
      const isSyntaxOrTransient = err instanceof SyntaxError || isTransientHighDemandError(err);
      if (!isSyntaxOrTransient) {
        throw err;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '28mb' }));

  app.post('/api/generate-algorithm', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        mode?: unknown;
        clinicalText?: unknown;
        documentBase64?: unknown;
        documentMimeType?: unknown;
        documentName?: unknown;
      };

      const clinicalText = typeof body.clinicalText === 'string' ? body.clinicalText.trim() : '';
      const documentBase64 =
        typeof body.documentBase64 === 'string' ? body.documentBase64.trim() : '';
      const documentMimeType =
        typeof body.documentMimeType === 'string' ? body.documentMimeType.trim() : '';
      const documentName =
        typeof body.documentName === 'string' ? body.documentName.trim() : 'documento';
      const isImageDigitize =
        body.mode === 'image-digitize' || documentMimeType.startsWith('image/');
      const isPdfDocument = documentMimeType === 'application/pdf';

      if (!clinicalText && !documentBase64) {
        res.status(400).json({
          error: 'Pega un texto clínico o sube un archivo de protocolo antes de generar el algoritmo.',
        });
        return;
      }

      if (clinicalText.length > MAX_CLINICAL_TEXT_CHARS) {
        res.status(400).json({
          error: `El texto clínico supera el límite permitido (${MAX_CLINICAL_TEXT_CHARS.toLocaleString('es-ES')} caracteres). Reduce o divide el protocolo e intenta nuevamente.`,
        });
        return;
      }

      if (documentBase64.length > MAX_DOCUMENT_BASE64_CHARS) {
        res.status(400).json({
          error: 'El archivo adjunto supera el límite de 15 MB permitidos para análisis directo.',
        });
        return;
      }

      if (documentBase64 && !ALLOWED_DOC_MIMES.has(documentMimeType)) {
        res.status(400).json({
          error: 'Tipo de archivo no compatible. Usa PDF, TXT, Markdown, CSV o imagen (PNG, JPG, WebP).',
        });
        return;
      }

      const ai = getGeminiClient();

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (documentBase64 && documentMimeType) {
        parts.push({
          inlineData: {
            mimeType: documentMimeType,
            data: documentBase64,
          },
        });
      }

      const promptLines = isImageDigitize
        ? [
            'Inspecciona cuidadosamente la imagen clínica adjunta, comprende su contexto en "clinicalContext" y construye un algoritmo limpio y continuo (sin dividirlo en fases):',
            '- Si la imagen ES UN DIAGRAMA O ALGORITMO VISUAL: digitalízalo con fidelidad topológica exacta. Rastrea cada caja, rombo/decisión, flecha, dirección de cabeza de flecha, nodo de convergencia, línea sólida vs. punteada y etiqueta de bifurcación ("Sí", "No", umbrales, tiempos). Verifica minuciosamente los signos matemáticos (<, >, ≤, ≥) y unidades clínicas (kcal/kg/d, g/kg/d, mL/h, mg/dL, mmol/L, mmHg). Incluye todos los nodos clínicos relevantes sin recortar ramas.',
            '- Si la imagen ES UNA FOTO O CAPTURA DE TEXTO CLÍNICO, TABLA O PÁGINA DE GUÍA MÉDICA: lee el texto y las tablas de la imagen, analiza el protocolo médico-nutricional descrito y sintetízalo en un algoritmo de decisión limpio y accionable.',
            '- Si el texto de la imagen está en inglés u otro idioma, tradúcelo al español clínico preciso conservando abreviaturas médicas universales (UCI, NE, NP, NPT, SNG, NRS-2002, GLIM, ASPEN, ESPEN, ERAS).',
          ]
        : isPdfDocument
          ? [
              'Analiza íntegramente el documento PDF clínico/nutricional adjunto (texto principal, tablas de dosificación, criterios diagnósticos, figuras y notas al pie).',
              'Extrae silenciosamente el contexto introductorio en "clinicalContext" y sintetiza el protocolo médico-nutricional en un algoritmo limpio y continuo (sin dividirlo ni etiquetarlo en fases), conservando criterios cuantitativos exactos, tiempos de inicio/reevaluación, metas calórico-proteicas, contraindicaciones y rutas de rescate.',
            ]
          : [
              'Analiza rigurosamente el texto clínico/nutricional entregado.',
              'Extrae silenciosamente el contexto introductorio en "clinicalContext" y estructura el protocolo médico-nutricional en un algoritmo limpio y continuo (sin dividirlo ni etiquetarlo en fases), con umbrales, tiempos, dosis y bifurcaciones bien etiquetadas.',
            ];

      if (documentBase64) {
        promptLines.push(`Archivo adjunto: "${documentName}".`);
      }
      if (clinicalText) {
        promptLines.push(`Texto o contexto clínico proporcionado:\n${clinicalText}`);
      }
      parts.push({ text: promptLines.join('\n\n') });

      const parsed = await generateDiagramWithRetry(ai, parts);

      res.json({ diagram: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado al generar el algoritmo.';
      const status =
        message.includes('GEMINI_API_KEY')
          ? 500
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID')
              ? 403
              : isTransientHighDemandError(err)
                ? 503
                : 502;

      const userMessage =
        status === 403
          ? 'La clave de Gemini API no es válida o no tiene permisos. Verifica tu clave en Settings > Secrets.'
          : status === 429
            ? 'Se alcanzó el límite temporal de solicitudes de la API de Gemini. Intenta de nuevo en unos momentos.'
            : status === 503
              ? 'El modelo de Gemini está experimentando alta demanda temporal. Espera unos segundos e intenta nuevamente.'
              : message;

      res.status(status).json({ error: userMessage });
    }
  });

  // Never let unknown /api/* requests fall through to HTML index.html
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta de API no encontrada.' });
  });

  // Always return JSON (never Express default HTML) for body-parser / payload errors
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!err) {
      next();
      return;
    }
    if (req.path.startsWith('/api/')) {
      const e = err as { status?: number; type?: string; message?: string };
      if (e.type === 'entity.too.large' || e.status === 413) {
        res.status(413).json({
          error: 'La imagen o documento enviado supera el tamaño permitido. Intenta con una imagen más ligera.',
        });
        return;
      }
      res.status(e.status && e.status >= 400 && e.status < 600 ? e.status : 400).json({
        error: 'No se pudo procesar la solicitud enviada al servidor. Intenta nuevamente.',
      });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
