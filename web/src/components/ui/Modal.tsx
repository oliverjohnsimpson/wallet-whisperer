import type { ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = "md",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "md" | "lg";
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/40 p-4">
      <div
        className={`max-h-[90vh] w-full ${
          maxWidth === "lg" ? "max-w-lg" : "max-w-md"
        } overflow-y-auto scrollbar-thin rounded-xl2 bg-white p-6 shadow-soft`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-forest-dark">{title}</h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-forest-light hover:bg-forest-50">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
