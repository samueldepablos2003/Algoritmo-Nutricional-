import type { AlgorithmItem } from '../types/algorithm';
import { createSeedAlgorithms } from './seedData';

const DB_NAME = 'NutriAlgoLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'algorithms';
const SEED_FLAG_KEY = 'nutri-algo-library-seeded-v1';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
    };
  });

  return dbPromise;
}

export async function getAllAlgorithms(): Promise<AlgorithmItem[]> {
  const db = await openDatabase();
  const items = await new Promise<AlgorithmItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as AlgorithmItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });

  const alreadySeeded =
    typeof localStorage !== 'undefined' && localStorage.getItem(SEED_FLAG_KEY) === 'true';

  if (items.length === 0 && !alreadySeeded) {
    const seeds = createSeedAlgorithms();
    await bulkPutAlgorithms(seeds);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEED_FLAG_KEY, 'true');
    }
    return seeds.sort((a, b) => b.createdAt - a.createdAt);
  }

  // Non-destructively upgrade previously seeded sample records (clean footer-free SVG & structured reference field)
  const hasLegacySampleState = (item: AlgorithmItem) =>
    Boolean(item.isSample) &&
    (!item.diagram ||
      !item.subtitle ||
      !item.groupLabel ||
      item.reference === undefined ||
      item.imageDataUrl.includes('Referencia%20docente') ||
      item.imageDataUrl.includes('Escala%20vectorial') ||
      item.title === 'Protocolo Nutricional en Pancreatitis Aguda' ||
      item.title === 'Algoritmo de Nutrición Enteral en UCI');

  const samplesNeedingUpgrade = items.filter(hasLegacySampleState);
  if (samplesNeedingUpgrade.length > 0) {
    const seedById = new Map(createSeedAlgorithms().map((s) => [s.id, s]));
    const patched: AlgorithmItem[] = [];
    const merged = items.map((item) => {
      if (!hasLegacySampleState(item)) return item;
      const seed = seedById.get(item.id);
      if (!seed) return item;

      const isLegacyTitle =
        item.title === 'Protocolo Nutricional en Pancreatitis Aguda' ||
        item.title === 'Algoritmo de Nutrición Enteral en UCI';
      const hasLegacyFooterSvg =
        item.imageDataUrl.includes('Referencia%20docente') ||
        item.imageDataUrl.includes('Escala%20vectorial');

      const nextDiagram = item.diagram
        ? {
            ...item.diagram,
            title: isLegacyTitle ? seed.title : item.diagram.title,
            subtitle: seed.subtitle ?? item.diagram.subtitle,
          }
        : seed.diagram;

      const nextItem: AlgorithmItem = {
        ...item,
        title: isLegacyTitle ? seed.title : item.title,
        subtitle: item.subtitle ?? seed.subtitle,
        groupLabel: item.groupLabel ?? seed.groupLabel,
        reference: item.reference !== undefined ? item.reference : seed.reference,
        imageDataUrl: hasLegacyFooterSvg || isLegacyTitle ? seed.imageDataUrl : item.imageDataUrl,
        ...(nextDiagram ? { diagram: nextDiagram } : {}),
      };
      patched.push(nextItem);
      return nextItem;
    });
    if (patched.length > 0) {
      await bulkPutAlgorithms(patched);
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function putAlgorithm(item: AlgorithmItem): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function bulkPutAlgorithms(items: AlgorithmItem[]): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAlgorithmById(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function restoreSampleAlgorithms(): Promise<AlgorithmItem[]> {
  const seeds = createSeedAlgorithms();
  await bulkPutAlgorithms(seeds);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SEED_FLAG_KEY, 'true');
  }
  return getAllAlgorithms();
}
