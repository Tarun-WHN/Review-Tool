import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "./auth";
import { Button } from "./ui";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/approvals", label: "Approvals", show: user?.role !== "member" },
    { to: "/reports", label: "Reports" },
    { to: "/masters", label: "Masters", show: user?.role === "admin" },
  ].filter((l) => l.show === undefined || l.show);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? "bg-wh-blue text-white" : "text-slate-200 hover:bg-white/10"
    }`;

  return (
    <div className="min-h-full">
      <header className="bg-wh-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="sm:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
              ☰
            </button>
            <span className="text-lg font-bold">Warehouse Now</span>
            <span className="hidden text-sm text-slate-300 sm:inline">Review &amp; Task Monitoring</span>
          </div>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-300 md:inline">
              {user?.name} · <span className="capitalize">{user?.role}</span>
            </span>
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
        {open && (
          <nav className="space-y-1 px-4 pb-3 sm:hidden">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {user?.role !== "member" && (
          <div className="mb-4 flex justify-end">
            <Button onClick={() => navigate("/tasks/new")}>+ New Task</Button>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
