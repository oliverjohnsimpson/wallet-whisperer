import { CURRENCIES } from "@/lib/currencies";
import SearchableSelect from "@/components/ui/SearchableSelect";

export default function CurrencySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={CURRENCIES}
      getValue={(c) => c.code}
      getSearchText={(c) => `${c.code} ${c.name}`}
      getDisplayValue={(c) => `${c.symbol} ${c.code}`}
      placeholder="Search currency…"
      emptyLabel="No matching currency"
      renderOption={(c) => (
        <>
          <span className="w-8 shrink-0">{c.symbol}</span>
          <span className="w-10 shrink-0 font-semibold text-forest-dark">{c.code}</span>
          <span className="truncate text-forest-light">{c.name}</span>
        </>
      )}
    />
  );
}
