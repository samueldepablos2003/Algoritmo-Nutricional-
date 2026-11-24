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
    msg.includes('INTERNAL')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_INSTRUCTION = `Eres un médico nutriólogo clínico especialista en guías ASPEN y ESPEN y diseñador de diagramas clínicos estilo macOS.
Tu tarea es analizar texto clínico, guías médicas o protocolos terapéutico-nutricionales y convertirlos en un algoritmo de decisión jerárquico, claro, preciso y listo para renderizar como diagrama de flujo vectorial.

Reglas estrictas de estructuración:
1. Devuelve EXCLUSIVAMENTE JSON válido acorde al esquema. Todo el contenido debe estar en español clínico claro y conciso.
2. Genera entre 5 y 11 nodos bien organizados, sin texto excesivo por nodo:
   - title: encabezado breve (máx. 60 caracteres), numerado secuencialmente cuando ayude (ej. "1. Tamizaje Nutricional", "2. ¿Estabilidad Hemodinámica?").
   - body: 1 a 3 líneas cortas con criterios objetivos, dosis, tiempos o metas (ej. "NRS-2002 ≥ 5 · Evaluar primeras 24–48 h").
   - shape:
     * "pill" para el nodo inicial o desenlace/alta.
     * "decision" para nodos con pregunta clínica o punto de bifurcación (Sí / No).
     * "process" para acciones terapéuticas, progresiones o monitoreos.
   - tone:
     * "gray" para ingreso/evaluación inicial.
     * "blue" para decisiones clave o metas principales.
     * "mint" para vía oral o nutrición enteral favorable.
     * "amber" para precaución, intolerancia o ajustes intermedios.
     * "rose" para contraindicaciones, alertas críticas o nutrición parenteral de rescate.
     * "white" para pasos estándar neutros.
3. Genera conexiones ("edges") dirigidas que formen un grafo acíclico claro de arriba hacia abajo (evita ciclos complejos innecesarios):
   - Usa etiquetas breves en bifurcaciones ("Sí", "No", "Leve", "Moderada/Grave", "Tolerancia < 60%", etc.).
   - style: "solid" para ruta principal, "dashed" para rutas alternativas, excepciones clínicas o seguimiento condicional, "straight" para conexiones directas cortas.
4. Incluye un título clínico limpio, subtítulo de una línea, 2 a 3 etiquetas de categoría (ej. "Críticos", "Gastroenterología", "Cirugía", "Pediatría", "Nutrición Enteral", "Nutrición Parenteral") y 3 a 4 viñetas breves en "notes" como puntos clave de estudio.`;

const ALGORITHM_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Título clínico conciso del algoritmo en español.',
    },
    subtitle: {
      type: Type.STRING,
      description: 'Subtítulo de una línea con alcance clínico o guía de referencia.',
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'De 2 a 3 categorías clínicas (ej. Críticos, Gastroenterología, Cirugía, Pediatría).',
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
          title: { type: Type.STRING, description: 'Título breve del nodo.' },
          body: { type: Type.STRING, description: 'Criterios objetivos, dosis o conducta clínica.' },
          shape: {
            type: Type.STRING,
            description: 'Forma del nodo: process, decision o pill.',
          },
          tone: {
            type: Type.STRING,
            description: 'Color suave: white, gray, mint, amber, rose o blue.',
          },
        },
        required: ['id', 'title', 'body', 'shape', 'tone'],
      },
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: 'ID del nodo origen.' },
          to: { type: Type.STRING, description: 'ID del nodo destino.' },
          label: { type: Type.STRING, description: 'Etiqueta breve sobre la flecha (puede ser cadena vacía).' },
          style: {
            type: Type.STRING,
            description: 'Estilo de conector: solid, dashed o straight.',
          },
        },
        required: ['from', 'to', 'label', 'style'],
      },
    },
  },
  required: ['title', 'subtitle', 'tags', 'notes', 'nodes', 'edges'],
};

async function generateDiagramWithRetry(
  ai: GoogleGenAI,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
) {
  const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel; delayMs: number }> = [
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 0 },
    { model: PRIMARY_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 900 },
    { model: FALLBACK_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 500 },
  ];

  let lastError: unknown;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await sleep(attempt.delayMs);
    }
    try {
      return await ai.models.generateContent({
        model: attempt.model,
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: ALGORITHM_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
        },
      });
    } catch (err) {
      lastError = err;
      if (!isTransientHighDemandError(err)) {
        throw err;
      }
    }
  }

  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

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

      if (!clinicalText && !documentBase64) {
        res.status(400).json({
          error: 'Pega un texto clínico o sube un archivo de protocolo antes de generar el algoritmo.',
        });
        return;
      }

      if (clinicalText.length > 40_000) {
        res.status(400).json({
          error: 'El texto clínico es demasiado extenso (máximo 40,000 caracteres).',
        });
        return;
      }

      if (documentBase64 && !ALLOWED_DOC_MIMES.has(documentMimeType)) {
        res.status(400).json({
          error: 'Tipo de archivo no compatible. Usa PDF, TXT, Markdown, CSV o imagen.',
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
            'Inspecciona cuidadosamente la imagen del algoritmo médico/nutricional adjunta y digitalízala fielmente en un diagrama de flujo estructurado en formato JSON editable.',
            'Instrucciones específicas de digitalización visual:',
            '- Transcribe con alta fidelidad todos los cuadros, rombos/criterios de decisión, flechas y etiquetas de rama ("Sí", "No", umbrales, tiempos, dosis y unidades clínicas exactas como kcal/kg/d, g/kg/d, mL/h, mg/dL, mmHg).',
            '- Respeta la jerarquía y el orden clínico del diagrama original (si el diagrama tiene más de 11 bloques importantes, incluye todos los nodos clínicos necesarios para no omitir conductas esenciales).',
            '- Si la imagen contiene texto en inglés u otro idioma, tradúcelo al español clínico preciso conservando abreviaturas médicas reconocidas (UCI, NE, NP, SNG, NRS-2002, ASPEN, ESPEN).',
            '- Usa "decision" para cuadros con preguntas/bifurcaciones, "pill" para inicio o desenlaces finales, y "process" para acciones terapéuticas.',
          ]
        : [
            'Analiza la siguiente información médica/nutricional y extrae el algoritmo de tratamiento médico nutricional en formato JSON estructurado.',
          ];

      if (documentBase64) {
        promptLines.push(`Archivo adjunto: "${documentName}".`);
      }
      if (clinicalText) {
        promptLines.push(`Contexto o texto clínico adicional:\n${clinicalText}`);
      }
      parts.push({ text: promptLines.join('\n\n') });

      const response = await generateDiagramWithRetry(ai, parts);

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'El modelo no devolvió contenido estructurado. Intenta con una imagen o texto más claro.',
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        res.status(502).json({
          error: 'No se pudo interpretar la respuesta JSON generada por la IA. Intenta nuevamente.',
        });
        return;
      }

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
