import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-forest-dark outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 dark:border-white/15 dark:bg-night-900 dark:text-night-ink dark:placeholder:text-night-muted";

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-forest-light dark:text-night-muted">{label}</label>
      {children}
    </div>
  );
}
