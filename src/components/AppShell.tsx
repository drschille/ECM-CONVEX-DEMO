import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

const nav = [
  { label: "Dashboard", to: "dashboard" },
  { label: "Items", to: "items" },
  { label: "Changes", to: "changes" },
  { label: "Reports", to: "reports" },
  { label: "Audit", to: "audit" },
  { label: "Settings", to: "settings" },
] as const;

export function AppShell() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const location = useLocation();
  const orgMatch = location.pathname.match(/^\/org\/([^/]+)/);
  const orgId = orgMatch?.[1] ?? "org";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
              ECM
            </p>
            <p className="text-sm font-semibold text-slate-900">
              Engineering Change Management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              to="/login"
            >
              Org switch
            </Link>
            {isAuthenticated && (
              <button
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
                onClick={() => void signOut()}
                type="button"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-white/60 bg-white/90 p-3 shadow-sm">
          <div className="mb-3 rounded-xl bg-slate-100 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Organization</p>
            <p className="text-sm font-semibold text-slate-900">{orgId}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-teal-600 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
