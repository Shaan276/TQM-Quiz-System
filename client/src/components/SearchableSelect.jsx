import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, AlertCircle } from 'lucide-react';

/**
 * SearchableSelect
 * A unified searchable dropdown (Combobox):
 * - Displays a single dropdown trigger.
 * - Clicking the trigger opens the dropdown menu.
 * - Search input is embedded INSIDE the dropdown at the top.
 * - Filtered options appear below the search input.
 * - Selecting an option closes the menu and updates the trigger.
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '-- Select --',
  searchPlaceholder = 'Search options...',
  disabled = false,
  disabledText = '',
  error = null,
  id,
  name,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Autofocus the search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Selected item label
  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Filter options based on search query
  const filteredOptions = options.filter((opt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const labelMatch = (opt.label || '').toLowerCase().includes(term);
    const subMatch = (opt.sublabel || '').toLowerCase().includes(term);
    return labelMatch || subMatch;
  });

  const handleSelect = (val) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('');
    }
    setSearchTerm('');
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Unified Dropdown Trigger */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-between border ${
          disabled
            ? 'bg-[#090F1A]/60 border-[#1B2A44] text-[#475569] cursor-not-allowed'
            : error
            ? 'bg-[#0E1626] border-[#F43F5E] text-white hover:border-[#F43F5E]'
            : isOpen
            ? 'bg-[#0E1626] border-[#38BDF8] text-white shadow-lg ring-1 ring-[#38BDF8]/30'
            : 'bg-[#0E1626] border-[#1B2A44] text-white hover:border-[#38BDF8]/60'
        }`}
      >
        <span className="truncate pr-2">
          {disabled && disabledText ? (
            <span className="text-[#64748B] italic">{disabledText}</span>
          ) : selectedOption ? (
            <span className="font-medium text-white">{selectedOption.label}</span>
          ) : (
            <span className="text-[#64748B]">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/10 text-[#64748B] hover:text-white transition-colors cursor-pointer mr-0.5"
              title="Clear selection"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-[#64748B] transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#38BDF8]' : ''}`}
          />
        </div>
      </button>

      {/* Embedded Dropdown Menu with Search inside */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl bg-[#0B1322] border border-[#1E2E4A] shadow-2xl p-2 space-y-2 backdrop-blur-xl animate-in fade-in zoom-in-95">
          {/* Search Box INSIDE the Dropdown */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#070D18] border border-[#1B2A44] text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition-colors"
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtered Options List */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-4 px-2 text-xs text-[#64748B]">
                No options match &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#10B981]/20 text-[#34D399] font-semibold'
                        : 'text-[#CBD5E1] hover:bg-[#132035] hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-[#64748B] group-hover:text-[#94A3B8]">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="text-[#34D399] shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Inline Error Message */}
      {error && (
        <p className="text-xs text-[#F43F5E] mt-1 flex items-center gap-1 font-semibold animate-in fade-in">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
