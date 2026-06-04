import { useEffect, useMemo, useState } from "react";
import { api, qs } from "../api";
import { useAuth } from "../auth";
import { Category, NamedMaster, StatusCounts, Task, TaskMaster, UserRow } from "../types";
import { Button, Card, StatusChip, inputClass } from "../ui";
import { STATUS_ORDER } from "../ui";
import { TaskTable } from "../components/TaskTable";
import { TeamTree } from "../components/TeamTree";

type Scope = "all" | "mine" | "team";

interface Filters {
  categoryId: string;
  taskMasterId: string;
  ownerId: string;
  clientId: string;
  warehouseId: string;
  status: string;
  from: string;
  to: string;
}

const EMPTY: Filters = {
  categoryId: "",
  taskMasterId: "",
  ownerId: "",
  clientId: "",
  warehouseId: "",
  status: "",
  from: "",
  to: "",
};

export function DashboardPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>(user?.role === "member" ? "mine" : "all");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [followUpDue, setFollowUpDue] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filter option sources
  const [categories, setCategories] = useState<Category[]>([]);
  const [taskMasters, setTaskMasters] = useState<TaskMaster[]>([]);
  const [clients, setClients] = useState<NamedMaster[]>([]);
  const [warehouses, setWarehouses] = useState<NamedMaster[]>([]);
  const [owners, setOwners] = useState<UserRow[]>([]);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
    api.get<NamedMaster[]>("/clients").then(setClients);
    api.get<NamedMaster[]>("/warehouses").then(setWarehouses);
    api.get<UserRow[]>("/users/assignable").then(setOwners).catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    if (filters.categoryId) {
      api.get<TaskMaster[]>(`/task-masters${qs({ categoryId: filters.categoryId })}`).then(setTaskMasters);
    } else {
      setTaskMasters([]);
    }
  }, [filters.categoryId]);

  const query = useMemo(
    () => qs({ ...filters, scope: scope === "all" ? "" : scope, followUpDue: followUpDue ? "true" : "" }),
    [filters, scope, followUpDue]
  );

  useEffect(() => {
    if (scope === "team") return; // team mode renders the tree instead
    setLoading(true);
    api
      .get<{ tasks: Task[]; counts: StatusCounts }>(`/tasks${query}`)
      .then((r) => {
        setTasks(r.tasks);
        setCounts(r.counts);
      })
      .finally(() => setLoading(false));
  }, [query, scope, refreshKey]);

  const canComplete = (t: Task) =>
    !t.completedAt && (user?.role === "admin" || user?.role === "manager" || user?.id === t.ownerId);

  async function completeTask(id: number) {
    try {
      await api.post(`/tasks/${id}/complete`);
      setRefreshKey((k) => k + 1);
    } catch {
      /* ignore — surfaced on the detail page if needed */
    }
  }

  function set<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value, ...(key === "categoryId" ? { taskMasterId: "" } : {}) }));
  }

  const showTree = scope === "team" && user?.role !== "member";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
        {!showTree && (
          <button
            onClick={() => setFollowUpDue((v) => !v)}
            className={`rounded-md border px-3 py-1 text-sm font-medium ${
              followUpDue
                ? "border-amber-400 bg-amber-100 text-amber-800"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Due for follow-up
          </button>
        )}
        <div className="flex gap-1 rounded-lg bg-slate-200 p-1">
          {(["all", "mine", "team"] as Scope[])
            .filter((s) => !(s === "team" && user?.role === "member") && !(s === "all" && user?.role === "member"))
            .map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                  scope === s ? "bg-white text-wh-navy shadow" : "text-slate-600"
                }`}
              >
                {s === "team" ? "My Team" : s}
              </button>
            ))}
        </div>
        </div>
      </div>

      {/* KPI cards */}
      {counts && !showTree && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => set("status", filters.status === s ? "" : s)}
              className={`rounded-lg border bg-white p-3 text-left shadow-sm transition ${
                filters.status === s ? "ring-2 ring-wh-blue" : "hover:shadow"
              }`}
            >
              <div className="text-2xl font-bold text-slate-800">{counts[s]}</div>
              <div className="mt-1">
                <StatusChip status={s} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {!showTree && (
        <Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select className={inputClass} value={filters.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              className={inputClass}
              value={filters.taskMasterId}
              onChange={(e) => set("taskMasterId", e.target.value)}
              disabled={!filters.categoryId}
            >
              <option value="">All tasks</option>
              {taskMasters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select className={inputClass} value={filters.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
              <option value="">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <select className={inputClass} value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className={inputClass} value={filters.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select className={inputClass} value={filters.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
              <option value="">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm">
              <span className="text-slate-500">From</span>
              <input type="date" className={inputClass} value={filters.from} onChange={(e) => set("from", e.target.value)} />
            </label>
            <label className="flex items-center gap-1 text-sm">
              <span className="text-slate-500">To</span>
              <input type="date" className={inputClass} value={filters.to} onChange={(e) => set("to", e.target.value)} />
            </label>
          </div>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
              Clear filters
            </Button>
          </div>
        </Card>
      )}

      {showTree ? (
        <TeamTree />
      ) : loading ? (
        <div className="text-sm text-slate-400">Loading tasks…</div>
      ) : (
        <TaskTable tasks={tasks} onComplete={completeTask} canComplete={canComplete} />
      )}
    </div>
  );
}
