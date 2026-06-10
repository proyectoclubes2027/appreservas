import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  isMoroso?: boolean;
  mesesDeuda?: number;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Buscar..." }: SearchableSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const displayValue = !isOpen && selectedOption ? selectedOption.label : search;

  const filtered = options.filter(o => {
    const searchTerms = search.toLowerCase().trim().split(' ');
    const labelLower = o.label.toLowerCase();
    return searchTerms.every(term => labelLower.includes(term));
  });

  const getInitials = (label: string) => {
    const parts = label.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Apellido, Nombre
      return (parts[1].charAt(0) + parts[0].charAt(0)).toUpperCase();
    }
    return label.substring(0, 2).toUpperCase();
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl py-3 pl-4 pr-10 text-sm text-textPri outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-[#555] shadow-inner"
          placeholder={placeholder}
          value={displayValue}
          onFocus={() => { setIsOpen(true); setSearch(''); }}
          onChange={e => { setSearch(e.target.value); setIsOpen(true); }}
        />
        <div className="absolute right-3 text-textSec pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-[#161616] border border-[#333] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.7)] backdrop-blur-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <ul className="max-h-[250px] overflow-y-auto custom-scrollbar p-1">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-textSec italic">No se encontraron socios</p>
                <p className="text-xs text-[#444] mt-1">Intenta con otro nombre o DNI</p>
              </div>
            ) : (
              filtered.map(o => {
                const initials = getInitials(o.label);
                const isSelected = o.value === value;
                const isMoroso = o.isMoroso;
                
                return (
                  <li
                    key={o.value}
                    className={`group flex items-center gap-3 p-2.5 rounded-lg transition-all mb-0.5 last:mb-0 ${
                      isMoroso
                        ? 'bg-[#1a0f0f]/40 border border-blocked/20 text-blocked cursor-not-allowed'
                        : isSelected 
                          ? 'bg-primary text-[#0d0d0d] cursor-pointer' 
                          : 'hover:bg-[#252525] text-textPri cursor-pointer'
                    }`}
                    onClick={() => {
                      if (isMoroso) return;
                      onChange(o.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border ${
                      isMoroso
                        ? 'bg-blocked/10 border-blocked/30 text-blocked'
                        : isSelected 
                          ? 'bg-black/10 border-black/20' 
                          : 'bg-[#0d0d0d] border-[#333] text-primary group-hover:border-primary/30 transition-colors'
                    }`}>
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold ${isMoroso ? 'text-blocked' : ''}`}>
                        {o.label}
                      </span>
                      {o.value && (
                        <span className={`text-[10px] ${
                          isMoroso 
                            ? 'text-blocked/60'
                            : isSelected
                              ? 'text-[#0d0d0d]/60'
                              : 'text-textSec group-hover:text-textPri/60 transition-colors'
                        }`}>
                          DNI: {o.value}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="ml-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
