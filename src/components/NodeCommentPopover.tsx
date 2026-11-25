import React, { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

interface NodeCommentPopoverProps {
  nodeTitle: string;
  initialComment: string;
  onSave: (comment: string) => void;
  onCancel: () => void;
}

export const NodeCommentPopover: React.FC<NodeCommentPopoverProps> = ({
  nodeTitle,
  initialComment,
  onSave,
  onCancel,
}) => {
  const [draft, setDraft] = useState(initialComment);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(initialComment);
  }, [initialComment]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const hasExisting = initialComment.trim().length > 0;
  const canPublish = draft.trim().length > 0;

  return (
    <div
      role="dialog"
      aria-label={`Comentario para ${nodeTitle}`}
      data-testid="node-comment-popover"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="mac-toast-in w-[332px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#E5E5EA] bg-white p-3.5 shadow-[0_18px_42px_-12px_rgba(15,23,42,0.22),0_4px_12px_-2px_rgba(15,23,42,0.08)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <span className="truncate text-[11.5px] font-semibold text-[#6E6E73]">
          Comentario · {nodeTitle}
        </span>
        {hasExisting && (
          <button
            type="button"
            onClick={() => onSave('')}
            aria-label="Eliminar comentario"
            title="Eliminar comentario"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#8E8E93] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <textarea
        ref={textareaRef}
        data-testid="node-comment-textarea"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canPublish) {
            e.preventDefault();
            onSave(draft.trim());
          }
        }}
        placeholder="Añade un comentario..."
        className="w-full resize-none rounded-xl border-2 border-[#7C7C82] bg-white px-3 py-2.5 text-[13.5px] leading-snug text-[#1D1D1F] placeholder:text-[#7A8292] focus:border-[#1D1D1F] focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-[#515968] transition-colors hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
        >
          Cancelar
        </button>
        <button
          type="button"
          data-testid="node-comment-publish"
          disabled={!canPublish}
          onClick={() => onSave(draft.trim())}
          className="rounded-full bg-[#1D1D1F] px-4 py-1.5 text-[13px] font-semibold text-white transition-all hover:bg-[#3A3A3C] active:scale-[0.98] disabled:bg-[#8E8E93] disabled:opacity-75"
        >
          Publicar
        </button>
      </div>
    </div>
  );
};
