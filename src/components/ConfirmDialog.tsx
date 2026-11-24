import React, { useEffect } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      className="mac-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-[#1D1D1F]/30 backdrop-blur-md p-4"
    >
      <div className="mac-sheet-in w-full max-w-[380px] rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-[0_24px_60px_-18px_rgba(29,29,31,0.28)]">
        <h2
          id="confirm-dialog-title"
          className="text-[16px] font-semibold tracking-[-0.015em] text-[#1D1D1F]"
        >
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-2 text-[13.5px] leading-relaxed text-[#6E6E73]">
          {description}
        </p>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-[10px] border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-[10px] bg-[#DC2626] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#B91C1C]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
