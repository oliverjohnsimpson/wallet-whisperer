import { useEffect, useRef, useState, type ReactNode } from "react";
import { inputClass } from "@/components/ui/FormField";

interface SearchableSelectProps<T> {
  value: string;
  onChange: (value: string) => void;
  options: T[];
  getValue: (item: T) => string;
  getSearchText: (item: T) => string;
  getDisplayValue: (item: T) => string;
  renderOption: (item: T) => ReactNode;
  placeholder?: string;
  emptyLabel?: string;
}

export default function SearchableSelect<T>({
  value,
  onChange,
  options,
  getValue,
  getSearchText,
  getDisplayValue,
  renderOption,
  placeholder = "Search…",
  emptyLabel = "No matches",
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => getValue(o) === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = query.trim()
    ? options.filter((o) => getSearchText(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  function select(item: T) {
    onChange(getValue(item));
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) select(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        value={open ? query : selected ? getDisplayValue(selected) : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto scrollbar-thin rounded-lg border border-forest/15 bg-white shadow-soft">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-forest-light">{emptyLabel}</li>}
          {filtered.map((item, i) => (
            <li key={getValue(item)}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                  i === highlight ? "bg-forest-50" : ""
                } ${getValue(item) === value ? "font-semibold" : ""}`}
              >
                {renderOption(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
