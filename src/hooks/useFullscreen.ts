import { useCallback, useEffect, useState } from 'react';

interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as WebkitDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function getFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  const root = document.documentElement as WebkitHTMLElement;
  return Boolean(
    document.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      typeof root.requestFullscreen === 'function' ||
      typeof root.webkitRequestFullscreen === 'function'
  );
}

export interface UseFullscreenResult {
  isFullscreen: boolean;
  isSupported: boolean;
  enterFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<boolean>;
  toggleFullscreen: () => Promise<boolean>;
}

/**
 * Application-wide Fullscreen API hook with Safari/WebKit fallback.
 * Controls native fullscreen on document.documentElement so every view
 * (Biblioteca, Quick Look, Visor de Estudio Dinámico y Generador) stays in sync.
 */
export function useFullscreen(): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(getFullscreenElement()));
  const [isSupported] = useState<boolean>(() => getFullscreenSupported());

  useEffect(() => {
    const syncState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };

    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
    };
  }, []);

  const enterFullscreen = useCallback(async (): Promise<boolean> => {
    if (getFullscreenElement()) return true;
    const root = document.documentElement as WebkitHTMLElement;
    try {
      if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
        return true;
      }
      if (typeof root.webkitRequestFullscreen === 'function') {
        await root.webkitRequestFullscreen();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async (): Promise<boolean> => {
    if (!getFullscreenElement()) return true;
    const doc = document as WebkitDocument;
    try {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
        return true;
      }
      if (typeof doc.webkitExitFullscreen === 'function') {
        await doc.webkitExitFullscreen();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<boolean> => {
    if (getFullscreenElement()) {
      return exitFullscreen();
    }
    return enterFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
}
