import React, { useEffect, useState } from 'react';
import { clampZoom, MAX_ZOOM, MIN_ZOOM } from '../utils/algorithmLogic';

interface ZoomPercentInputProps {
  zoom: number;
  onChangeZoom: (nextZoom: number) => void;
  ariaLabel?: string;
}

export const ZoomPercentInput: React.FC<ZoomPercentInputProps> = ({
  zoom,
  onChangeZoom,
  ariaLabel = 'Porcentaje de zoom manual',
}) => {
  const zoomPercent = Math.round(zoom * 100);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(zoomPercent));

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(zoomPercent));
    }
  }, [zoomPercent, isEditing]);

  const commitValue = () => {
    const cleaned = draft.replace(/[^0-9.,]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed) && parsed > 0) {
      const nextZoom = clampZoom(parsed / 100);
      onChangeZoom(nextZoom);
      setDraft(String(Math.round(nextZoom * 100)));
    } else {
      setDraft(String(zoomPercent));
    }
    setIsEditing(false);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      title={`Escribir porcentaje de zoom (${Math.round(MIN_ZOOM * 100)}%–${Math.round(MAX_ZOOM * 100)}%)`}
      value={isEditing ? draft : `${zoomPercent}%`}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={(e) => {
        setIsEditing(true);
        setDraft(String(zoomPercent));
        const input = e.currentTarget;
        window.requestAnimationFrame(() => input.select());
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitValue}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commitValue();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(String(zoomPercent));
          setIsEditing(false);
          e.currentTarget.blur();
        }
      }}
      className="h-7 w-12 rounded-lg border border-transparent bg-transparent px-1 text-center font-mono-tabular text-[11px] font-medium text-[#1D1D1F] transition-colors hover:bg-white/90 focus:border-[#0071E3] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0071E3]/15"
    />
  );
};
