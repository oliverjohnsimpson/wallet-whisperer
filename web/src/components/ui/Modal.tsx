import type { ReactNode } from "react";

const WIDTHS = { md: "max-w-md", lg: "max-w-lg", "3xl": "max-w-3xl" } as const;

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: keyof typeof WIDTHS;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/40 p-4">
      <div
        className={`max-h-[90vh] w-full ${WIDTHS[maxWidth]} overflow-y-auto scrollbar-thin rounded-xl2 bg-white p-6 shadow-soft dark:bg-night-card`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-forest-dark dark:text-night-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full px-2 py-1 text-forest-light hover:bg-forest-50 dark:hover:bg-white/5"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
