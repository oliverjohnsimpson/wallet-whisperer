import type { CategoryTotal } from "@/types";
import { formatMoney } from "@/lib/format";

/** Horizontal bar list of category totals, scaled to the largest, with icons. */
export default function CategoryBars({
  items,
  currency,
  limit = 6,
  emptyLabel = "Nothing here yet.",
}: {
  items: CategoryTotal[];
  currency: string;
  limit?: number;
  emptyLabel?: string;
}) {
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.total), 1);

  if (shown.length === 0) {
    return <p className="py-4 text-center text-sm text-forest-light">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {shown.map((item) => (
        <div key={item.category_id}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-forest-dark">
              <span>{item.icon}</span>
              {item.label}
            </span>
            <span className="font-display font-bold text-forest-dark">{formatMoney(item.total, currency)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-forest-50">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.total / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
