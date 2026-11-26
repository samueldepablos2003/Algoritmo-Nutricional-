import React from 'react';

interface FilterStripProps {
  availableTags: string[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  totalCount: number;
  onOpenStudyMode: () => void;
}

export const FilterStrip: React.FC<FilterStripProps> = ({
  availableTags,
  activeTag,
  onSelectTag,
  totalCount,
  onOpenStudyMode,
}) => {
  return (
    <section className="w-full px-4 pt-10 pb-5 sm:px-8 sm:pt-12">
      <div className="flex items-center justify-between gap-4 border-b border-[#E5E5EA] pb-3">
        {/* Segmented Category Filter Controls including Carrusel */}
        <div
          role="tablist"
          aria-label="Filtrar algoritmos por categoría"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-[10px] bg-[#F5F5F7] p-1 max-w-full"
        >
          {availableTags.map((tag) => {
            const isSelected = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onSelectTag(isSelected ? null : tag)}
                className={`rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                  isSelected
                    ? 'bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {tag}
              </button>
            );
          })}

          <button
            type="button"
            role="tab"
            aria-selected={false}
            disabled={totalCount === 0}
            onClick={onOpenStudyMode}
            className="rounded-[7px] px-3 py-1.5 text-[12.5px] font-medium text-[#0071E3] transition-all duration-150 hover:bg-white/80 hover:text-[#005BB5] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            Carrusel
          </button>
        </div>
      </div>
    </section>
  );
};
