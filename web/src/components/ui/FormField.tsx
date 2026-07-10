import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-forest/15 px-3 py-2 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-forest-light">{label}</label>
      {children}
    </div>
  );
}
