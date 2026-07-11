import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import PennyWidget from "@/components/PennyWidget";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: "🏡" },
  { to: "/income", label: "Income", icon: "💰" },
  { to: "/expenses", label: "Expenses", icon: "🧾" },
  { to: "/budgets", label: "Budgets", icon: "💼" },
  { to: "/reports", label: "Reports", icon: "📊" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { tier } = useSubscription();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("ww-sidebar-collapsed") === "1");

  useEffect(() => {
    localStorage.setItem("ww-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className="flex h-screen bg-cream dark:bg-night-950">
      <aside
        className={`flex shrink-0 flex-col justify-between border-r border-forest/10 bg-white/60 p-3 transition-all duration-200 dark:border-white/10 dark:bg-night-900 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <div>
          {/* Logo + collapse toggle */}
          <div className={`mb-6 flex items-center ${collapsed ? "justify-center" : "justify-between px-1"}`}>
            <div className="flex items-center gap-2">
              <img
                src="/wallet-icon.png"
                alt="Wallet Whisperer"
                className="h-8 w-auto rounded-lg dark:bg-white/90 dark:p-0.5"
              />
              {!collapsed && (
                <div className="leading-none">
                  <p className="font-display text-lg font-extrabold text-forest dark:text-night-ink">Wallet</p>
                  <p className="text-[10px] font-bold tracking-widest text-gold-dark dark:text-gold">WHISPERER</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                className="rounded-lg p-1 text-forest-light hover:bg-forest-50 dark:text-night-muted dark:hover:bg-white/5"
              >
                «
              </button>
            )}
          </div>

          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              className="mb-3 w-full rounded-lg p-1 text-center text-forest-light hover:bg-forest-50 dark:text-night-muted dark:hover:bg-white/5"
            >
              »
            </button>
          )}

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-full font-semibold transition ${
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-4 py-2.5"
                  } ${
                    isActive
                      ? "bg-forest text-cream shadow-card"
                      : "text-forest-dark hover:bg-forest-50 dark:text-night-ink dark:hover:bg-white/5"
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="space-y-2">
          <NavLink
            to="/pricing"
            title={collapsed ? "Plans & upgrade" : undefined}
            className={`flex items-center rounded-full font-semibold transition ${
              tier === "free"
                ? "bg-gold/90 text-forest-dark hover:bg-gold"
                : "bg-forest text-cream hover:bg-forest-dark"
            } ${collapsed ? "justify-center py-2.5" : "gap-2 px-4 py-2.5"}`}
          >
            <span className="text-lg">{tier === "free" ? "⭐" : "👑"}</span>
            {!collapsed && (tier === "free" ? "Upgrade" : `${tier[0].toUpperCase()}${tier.slice(1)} plan`)}
          </NavLink>

          <button
            onClick={toggle}
            aria-label="Toggle light/dark mode"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            className={`flex items-center rounded-full font-semibold text-forest-dark transition hover:bg-forest-50 dark:text-night-ink dark:hover:bg-white/5 ${
              collapsed ? "w-full justify-center py-2.5" : "w-full gap-3 px-4 py-2.5"
            }`}
          >
            <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
            {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
          </button>

          {collapsed ? (
            <button
              onClick={signOut}
              title={`Sign out (${user?.email ?? ""})`}
              aria-label="Sign out"
              className="flex w-full justify-center rounded-full py-2.5 text-lg text-coral hover:bg-coral/10"
            >
              ⎋
            </button>
          ) : (
            <div className="rounded-xl2 bg-forest-50 p-3 dark:bg-white/5">
              <p className="truncate text-xs font-semibold text-forest-dark dark:text-night-ink">
                {user?.email ?? "Signed in"}
              </p>
              <button onClick={signOut} className="mt-1 text-xs font-semibold text-coral hover:underline">
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>

      <PennyWidget />
    </div>
  );
}
