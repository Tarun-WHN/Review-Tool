import { useEffect, useMemo, useState } from "react";
import { api, downloadExport, qs } from "../api";
import { Category, NamedMaster, Task, TaskMaster, UserRow } from "../types";
import { Button, Card, inputClass, STATUS_ORDER } from "../ui";
import { TaskTable } from "../components/TaskTable";

export function ReportsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [taskMasters, setTaskMasters] = useState<TaskMaster[]>([]);
  const [clients, setClients] = useState<NamedMaster[]>([]);
  const [warehouses, setWarehouses] = useState<NamedMaster[]>([]);
  const [owners, setOwners] = useState<UserRow[]>([]);

  const [f, setF] = useState({
    categoryId: "",
    taskMasterId: "",
    ownerId: "",
    clientId: "",
    warehouseId: "",
    status: "",
    from: "",
    to: "",
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
    api.get<NamedMaster[]>("/clients").then(setClients);
    api.get<NamedMaster[]>("/warehouses").then(setWarehouses);
    api.get<UserRow[]>("/users/assignable").then(setOwners).catch(() => setOwners([]));
  }, []);

  useEffect(() => {
    if (f.categoryId) api.get<TaskMaster[]>(`/task-masters${qs({ categoryId: f.categoryId })}`).then(setTaskMasters);
    else setTaskMasters([]);
  }, [f.categoryId]);

  const query = useMemo(() => qs(f), [f]);

  useEffect(() => {
    setLoading(true);
    api.get<{ tasks: Task[] }>(`/tasks${query}`).then((r) => setTasks(r.tasks)).finally(() => setLoading(false));
  }, [query]);

  function set(key: keyof typeof f, value: string) {
    setF((prev) => ({ ...prev, [key]: value, ...(key === "categoryId" ? { taskMasterId: "" } : {}) }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => downloadExport(query, "csv")}>Export CSV</Button>
          <Button onClick={() => downloadExport(query, "xlsx")}>Export XLSX</Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputClass} value={f.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={inputClass} value={f.taskMasterId} onChange={(e) => set("taskMasterId", e.target.value)} disabled={!f.categoryId}>
            <option value="">All tasks</option>
            {taskMasters.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={inputClass} value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            <option value="">All owners</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputClass} value={f.clientId} onChange={(e) => set("clientId", e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={inputClass} value={f.warehouseId} onChange={(e) => set("warehouseId", e.target.value)}>
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <span className="text-slate-500">From</span>
            <input type="date" className={inputClass} value={f.from} onChange={(e) => set("from", e.target.value)} />
          </label>
          <label className="flex items-center gap-1 text-sm">
            <span className="text-slate-500">To</span>
            <input type="date" className={inputClass} value={f.to} onChange={(e) => set("to", e.target.value)} />
          </label>
        </div>
      </Card>

      <div className="text-sm text-slate-500">{loading ? "Loading…" : `${tasks.length} task(s)`}</div>
      <TaskTable tasks={tasks} />
    </div>
  );
}
