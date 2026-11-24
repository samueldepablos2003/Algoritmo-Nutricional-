import React from 'react';
import { Plus, Search, Sparkles, X } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenUpload: () => void;
  onOpenGenerator: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  onOpenUpload,
  onOpenGenerator,
}) => {
  return (
    <header className="sticky top-0 z-30 mac-glass border-b border-[#E5E5EA]">
      <div className="mt-[20px] flex h-16 w-full items-center justify-between gap-2.5 px-4 sm:gap-6 sm:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            onSearchChange('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="text-[14px] font-semibold tracking-[-0.015em] text-[#1D1D1F] whitespace-nowrap shrink-0 sm:text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:rounded-md"
        >
          <span className="sm:hidden">NutriAlgo</span>
          <span className="hidden sm:inline">Algoritmos Nutricionales</span>
        </a>

        {/* Zone 2: Center Spotlight Search Bar */}
        <div className="relative min-w-0 flex-1 max-w-[440px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E6E73] sm:left-3.5"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                if (searchQuery) {
                  onSearchChange('');
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder="Buscar algoritmos o etiquetas…"
            aria-label="Buscar algoritmos por título o etiquetas"
            className="h-9 w-full min-w-0 rounded-[10px] border border-[#E5E5EA] bg-white/85 pl-9 pr-8 text-[13.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] shadow-[inset_0_1px_1px_rgba(0,0,0,0.02)] transition-all duration-150 focus:border-[#0071E3] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#0071E3]/15 sm:pl-10 sm:pr-16 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-[#E5E5EA] text-[#1D1D1F] transition-colors hover:bg-[#D1D1D6] sm:right-2.5"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[#E5E5EA] bg-[#F5F5F7] px-1.5 py-0.5 font-mono-tabular text-[11px] font-medium text-[#6E6E73] sm:inline-block"
            >
              ⌘K
            </kbd>
          )}
        </div>

        {/* Zone 3: Crear con IA and Agregar Algoritmo */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenGenerator}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-[#E5E5EA] bg-white/90 px-3 text-[13px] font-medium text-[#1D1D1F] transition-all duration-150 hover:bg-white hover:border-[#D1D1D6] active:scale-[0.98] whitespace-nowrap shrink-0 sm:px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#0071E3]" aria-hidden="true" />
            <span className="hidden md:inline">Crear con IA</span>
            <span className="md:hidden">IA</span>
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#1D1D1F] px-3 text-[13px] font-medium text-white transition-all duration-150 hover:bg-[#3A3A3C] active:scale-[0.98] whitespace-nowrap shrink-0 sm:px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4 stroke-[2.2]" aria-hidden="true" />
            <span className="hidden sm:inline">Agregar Algoritmo</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
