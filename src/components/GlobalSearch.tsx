import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, Layers, Scissors } from 'lucide-react';
import { JobCard, ProductionRoll, SlittingRoll } from '../types';
import { getPartyName } from '../utils/parties';

interface GlobalSearchProps {
  jobCards: JobCard[];
  prodRolls: ProductionRoll[];
  slitRolls: SlittingRoll[];
  onNavigate: (module: string) => void;
}

interface SearchResult {
  type: 'jobCard' | 'prodRoll' | 'slitRoll';
  id: string;
  title: string;
  subtitle: string;
  module: string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  jobCards,
  prodRolls,
  slitRolls,
  onNavigate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const q = query.toLowerCase().trim();

  const matchedJobCards: SearchResult[] = q
    ? jobCards
        .filter(
          (jc) =>
            (jc.jobCode || '').toLowerCase().includes(q) ||
            (jc.partyCode || '').toLowerCase().includes(q) ||
            (getPartyName(jc.partyCode) || '').toLowerCase().includes(q)
        )
        .slice(0, 8)
        .map((jc) => ({
          type: 'jobCard' as const,
          id: jc.id,
          title: jc.jobCode,
          subtitle: `${getPartyName(jc.partyCode)} · ${jc.size} · ${jc.micron}μ`,
          module: 'admin',
        }))
    : [];

  const matchedProdRolls: SearchResult[] = q
    ? prodRolls
        .filter((r) => String(r.rollNo || '').includes(q))
        .slice(0, 5)
        .map((r) => ({
          type: 'prodRoll' as const,
          id: r.id,
          title: `Production Roll #${r.rollNo}`,
          subtitle: `${r.date} · ${r.netWeight} kg`,
          module: 'production',
        }))
    : [];

  const matchedSlitRolls: SearchResult[] = q
    ? slitRolls
        .filter(
          (r) =>
            String(r.rollNo || '').includes(q) ||
            (r.coilSize || '').toLowerCase().includes(q)
        )
        .slice(0, 5)
        .map((r) => ({
          type: 'slitRoll' as const,
          id: r.id,
          title: `Slitting Roll #${r.rollNo}`,
          subtitle: `${r.coilSize} · ${r.date} · ${r.netWeight} kg`,
          module: 'slitting',
        }))
    : [];

  const hasResults =
    matchedJobCards.length > 0 ||
    matchedProdRolls.length > 0 ||
    matchedSlitRolls.length > 0;

  const handleSelect = (result: SearchResult) => {
    onNavigate(result.module);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Search Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
        title="Global Search (Ctrl+K)"
      >
        <Search className="w-5 h-5" />
      </button>

      {/* Search Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center p-4 pt-[10vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Box */}
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in z-10">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search job cards, rolls…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-base text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-md font-mono"
              >
                ESC
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {!q && (
                <div className="p-8 text-center text-sm text-gray-400">
                  <Search className="w-8 h-8 mx-auto mb-3 text-gray-200" />
                  <p>Type to search across job cards and rolls</p>
                  <p className="text-xs mt-1 text-gray-300">Press ESC to close</p>
                </div>
              )}

              {q && !hasResults && (
                <div className="p-8 text-center text-sm text-gray-400">
                  <p>No results found for "<span className="font-semibold text-gray-600">{query}</span>"</p>
                  <p className="text-xs mt-1 text-gray-300">Press ESC to close</p>
                </div>
              )}

              {matchedJobCards.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Job Cards ({matchedJobCards.length})
                    </span>
                  </div>
                  {matchedJobCards.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 font-mono">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                        Admin
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {(matchedProdRolls.length > 0 || matchedSlitRolls.length > 0) && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Rolls ({matchedProdRolls.length + matchedSlitRolls.length})
                    </span>
                  </div>
                  {matchedProdRolls.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                        Production
                      </span>
                    </button>
                  ))}
                  {matchedSlitRolls.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Scissors className="w-4 h-4 text-blue-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{result.title}</p>
                        <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">
                        Slitting
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            {q && hasResults && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-400 text-center">Press ESC to close</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
