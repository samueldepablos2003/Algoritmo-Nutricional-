import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchOpenTrigger?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  searchQuery,
  onSearchChange,
  searchInputRef,
  searchOpenTrigger = 0,
}) => {
  const [searchExpanded, setSearchExpanded] = useState(Boolean(searchQuery));
  const floatingSearchRef = useRef<HTMLDivElement | null>(null);

  const isOpen = searchExpanded || searchQuery.length > 0;

  useEffect(() => {
    if (searchOpenTrigger > 0) {
      setSearchExpanded(true);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
  }, [searchOpenTrigger, searchInputRef]);

  useEffect(() => {
    if (!searchExpanded) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (floatingSearchRef.current?.contains(target)) return;
      if (!searchQuery.trim()) {
        setSearchExpanded(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [searchExpanded, searchQuery]);

  return (
    <>
      {/* Top-Left Brand Title — exact same position & style as Inicio, with no header wrapper box */}
      <div className="w-full px-6 pt-6 sm:px-9 sm:pt-7">
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            onSearchChange('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-block text-[16px] font-bold tracking-[-0.02em] text-[#1D1D1F] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:rounded-md"
        >
          Algoritmo Nutricional
        </a>
      </div>

      {/* Floating Search Button / Expandable Floating Search Pill */}
      <div
        ref={floatingSearchRef}
        data-testid="floating-library-search"
        className="fixed right-4 top-5 z-30 flex items-center sm:right-6"
      >
        {isOpen ? (
          <div className="mac-toast-in relative flex h-10 w-[min(340px,calc(100vw-3rem))] items-center rounded-full border border-[#DFE3EA] bg-white/95 shadow-[0_10px_28px_-8px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.05)] backdrop-blur-md">
            <Search
              className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#6E6E73]"
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
                    setSearchExpanded(false);
                    e.currentTarget.blur();
                  }
                }
              }}
              placeholder="Buscar algoritmos o etiquetas…"
              aria-label="Buscar algoritmos por título o etiquetas"
              className="h-full w-full rounded-full bg-transparent pl-10 pr-10 text-[13.5px] text-[#1D1D1F] placeholder:text-[#8E8E93] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={() => {
                if (searchQuery) {
                  onSearchChange('');
                  searchInputRef.current?.focus();
                } else {
                  setSearchExpanded(false);
                }
              }}
              aria-label={searchQuery ? 'Limpiar búsqueda' : 'Cerrar buscador'}
              className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-[#6E6E73] transition-colors hover:bg-[#F3F4F6] hover:text-[#1D1D1F]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="floating-search-trigger"
            onClick={() => {
              setSearchExpanded(true);
              window.requestAnimationFrame(() => {
                searchInputRef.current?.focus();
              });
            }}
            aria-label="Buscar algoritmos (⌘K)"
            title="Buscar algoritmos (⌘K)"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/95 text-[#1D1D1F] shadow-[0_8px_24px_-8px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all hover:scale-105 hover:border-[#D1D5DB] hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
};
