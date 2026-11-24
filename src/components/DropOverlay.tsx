import React from 'react';
import { ImagePlus } from 'lucide-react';

interface DropOverlayProps {
  visible: boolean;
}

export const DropOverlay: React.FC<DropOverlayProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      className="mac-backdrop-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/75 backdrop-blur-xl p-8"
      aria-live="polite"
    >
      <div className="mac-sheet-in flex max-w-md flex-col items-center rounded-3xl border-2 border-dashed border-[#0071E3] bg-white/95 px-12 py-14 text-center shadow-[0_24px_60px_-15px_rgba(29,29,31,0.14)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F7FF] text-[#0071E3]">
          <ImagePlus className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-[18px] font-semibold tracking-[-0.015em] text-[#1D1D1F]">
          Suelta la imagen aquí
        </p>
        <p className="mt-1.5 text-[13.5px] text-[#6E6E73]">
          PNG, JPG, WebP o SVG en alta resolución. Se guardará localmente en tu navegador.
        </p>
      </div>
    </div>
  );
};
