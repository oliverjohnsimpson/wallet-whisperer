import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PennyChat from "@/components/PennyChat";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏡" },
  { to: "/income", label: "Income", icon: "💰" },
  { to: "/budgets", label: "Budgets", icon: "💼" },
  { to: "/reports", label: "Reports", icon: "📊" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [pennyOpen, setPennyOpen] = useState(false);

  return (
    <div className="flex h-screen bg-cream">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-forest/10 bg-white/60 p-4">
        <div>
          <div className="mb-8 flex items-center gap-2 px-2">
            <img src="/wallet-icon.png" alt="" className="h-8 w-auto" />
            <div className="leading-none">
              <p className="font-display text-lg font-extrabold text-forest">Wallet</p>
              <p className="text-[10px] font-bold tracking-widest text-gold-dark">WHISPERER</p>
            </div>
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-full px-4 py-2.5 font-semibold transition ${
                    isActive ? "bg-forest text-cream shadow-card" : "text-forest-dark hover:bg-forest-50"
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setPennyOpen(true)}
            className="flex w-full items-center gap-3 rounded-full bg-gold px-4 py-2.5 font-semibold text-forest-dark shadow-card transition hover:bg-gold-light"
          >
            <span>🪙</span> Ask Penny
          </button>
          <div className="rounded-xl2 bg-forest-50 p-3">
            <p className="truncate text-xs font-semibold text-forest-dark">{user?.email ?? "Signed in"}</p>
            <button onClick={signOut} className="mt-1 text-xs font-semibold text-coral hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>

      {pennyOpen && <PennyChat onClose={() => setPennyOpen(false)} />}
    </div>
  );
}
