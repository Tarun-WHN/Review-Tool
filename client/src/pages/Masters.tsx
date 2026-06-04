import { useEffect, useState } from "react";
import { api, qs } from "../api";
import { Category, NamedMaster, TaskMaster, UserRow } from "../types";
import { Button, Card, ErrorText, Field, inputClass } from "../ui";

type Tab = "categories" | "tasks" | "clients" | "warehouses" | "users";

const TABS: { key: Tab; label: string }[] = [
  { key: "categories", label: "Categories" },
  { key: "tasks", label: "Task Masters" },
  { key: "clients", label: "Clients" },
  { key: "warehouses", label: "Warehouses" },
  { key: "users", label: "Users" },
];

export function MastersPage() {
  const [tab, setTab] = useState<Tab>("categories");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Masters</h1>
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-b-2 border-wh-blue text-wh-blue" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "categories" && <CategoriesTab />}
      {tab === "tasks" && <TaskMastersTab />}
      {tab === "clients" && <SimpleTab path="clients" label="Client" />}
      {tab === "warehouses" && <SimpleTab path="warehouses" label="Warehouse" />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

/* ----------------------------- Categories ----------------------------- */

const EMPTY_CATEGORY = {
  name: "",
  delayProfile: "relative" as "relative" | "absolute",
  delayedThreshold: "1.5",
  criticalThreshold: "2.0",
  deadDays: "25",
  atRiskLeadDays: "3",
};

function CategoriesTab() {
  const [rows, setRows] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_CATEGORY });

  const load = () => api.get<Category[]>("/categories?all=true").then(setRows);
  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY_CATEGORY });
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setError("");
    setForm({
      name: c.name,
      delayProfile: c.delayProfile,
      delayedThreshold: String(c.delayedThreshold),
      criticalThreshold: String(c.criticalThreshold),
      deadDays: String(c.deadDays),
      atRiskLeadDays: String(c.atRiskLeadDays),
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const payload = {
      name: form.name,
      delayProfile: form.delayProfile,
      delayedThreshold: Number(form.delayedThreshold),
      criticalThreshold: Number(form.criticalThreshold),
      deadDays: Number(form.deadDays),
      atRiskLeadDays: Number(form.atRiskLeadDays),
    };
    if (payload.criticalThreshold <= payload.delayedThreshold) {
      setError("Critical threshold must be greater than Delayed threshold.");
      return;
    }
    try {
      if (editingId) await api.put(`/categories/${editingId}`, payload);
      else await api.post("/categories", payload);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function toggleActive(c: Category) {
    await api.put(`/categories/${c.id}`, { active: !c.active });
    await load();
  }

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      <Card>
        <div className="mb-2 text-sm font-medium text-slate-700">
          {editingId ? "Edit category" : "Add category"}
        </div>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Profile">
            <select className={inputClass} value={form.delayProfile} onChange={(e) => setForm({ ...form, delayProfile: e.target.value as "relative" | "absolute" })}>
              <option value="relative">relative</option>
              <option value="absolute">absolute</option>
            </select>
          </Field>
          <Field label="Delayed"><input type="number" step="0.1" className={inputClass} value={form.delayedThreshold} onChange={(e) => setForm({ ...form, delayedThreshold: e.target.value })} /></Field>
          <Field label="Critical"><input type="number" step="0.1" className={inputClass} value={form.criticalThreshold} onChange={(e) => setForm({ ...form, criticalThreshold: e.target.value })} /></Field>
          <Field label="Dead Days"><input type="number" className={inputClass} value={form.deadDays} onChange={(e) => setForm({ ...form, deadDays: e.target.value })} /></Field>
          <Field label="At-Risk Lead"><input type="number" min="0" className={inputClass} value={form.atRiskLeadDays} onChange={(e) => setForm({ ...form, atRiskLeadDays: e.target.value })} /></Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="w-full">{editingId ? "Save" : "Add"}</Button>
            {editingId && <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>}
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Relative thresholds are multiples of the task's duration; absolute thresholds are fixed day counts past the end date.
          <br />
          <strong>At-Risk Lead</strong> = days <em>before</em> the end date a task turns “At Risk” (e.g. 1 = the day before it's due; 0 = only on/after the due date).
        </p>
      </Card>
      <MasterTable
        headers={["Name", "Profile", "Delayed", "Critical", "Dead", "At-Risk Lead", "Active", ""]}
        rows={rows.map((c) => [
          c.name, c.delayProfile, c.delayedThreshold, c.criticalThreshold, c.deadDays, c.atRiskLeadDays, c.active ? "Yes" : "No",
          <div key="a" className="flex gap-2">
            <Button variant="ghost" onClick={() => startEdit(c)}>Edit</Button>
            <Button variant="ghost" onClick={() => toggleActive(c)}>{c.active ? "Deactivate" : "Activate"}</Button>
          </div>,
        ])}
      />
    </div>
  );
}

/* ----------------------------- Task Masters ----------------------------- */

function TaskMastersTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<TaskMaster[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { api.get<Category[]>("/categories?all=true").then(setCategories); }, []);
  const load = () => api.get<TaskMaster[]>(`/task-masters${qs({ all: "true", categoryId: categoryId || undefined })}`).then(setRows);
  useEffect(() => { load(); }, [categoryId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!categoryId) { setError("Select a category first."); return; }
    try {
      await api.post("/task-masters", { categoryId: Number(categoryId), name });
      setName("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }

  async function toggleActive(t: TaskMaster) {
    await api.put(`/task-masters/${t.id}`, { active: !t.active });
    await load();
  }

  const catName = (id: number) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      <Card>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Category">
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Task Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <div className="flex items-end"><Button type="submit">Add</Button></div>
        </form>
      </Card>
      <MasterTable
        headers={["Task", "Category", "Active", ""]}
        rows={rows.map((t) => [
          t.name, catName(t.categoryId), t.active ? "Yes" : "No",
          <Button key="t" variant="ghost" onClick={() => toggleActive(t)}>{t.active ? "Deactivate" : "Activate"}</Button>,
        ])}
      />
    </div>
  );
}

/* ------------------------- Clients & Warehouses ------------------------- */

function SimpleTab({ path, label }: { path: "clients" | "warehouses"; label: string }) {
  const [rows, setRows] = useState<NamedMaster[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get<NamedMaster[]>(`/${path}?all=true`).then(setRows);
  useEffect(() => { load(); }, [path]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try { await api.post(`/${path}`, { name }); setName(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }
  async function toggleActive(r: NamedMaster) { await api.put(`/${path}/${r.id}`, { active: !r.active }); await load(); }

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      <Card>
        <form onSubmit={save} className="flex items-end gap-3">
          <Field label={`${label} Name`}><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <MasterTable
        headers={["Name", "Active", ""]}
        rows={rows.map((r) => [
          r.name, r.active ? "Yes" : "No",
          <Button key="t" variant="ghost" onClick={() => toggleActive(r)}>{r.active ? "Deactivate" : "Activate"}</Button>,
        ])}
      />
    </div>
  );
}

/* -------------------------------- Users -------------------------------- */

function UsersTab() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "member" as "admin" | "manager" | "member", reportingManagerId: "",
  });

  const load = () => api.get<UserRow[]>("/users").then(setRows);
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        reportingManagerId: form.reportingManagerId ? Number(form.reportingManagerId) : null,
      });
      setForm({ name: "", email: "", password: "", role: "member", reportingManagerId: "" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }

  async function update(u: UserRow, patch: Record<string, unknown>) {
    setError("");
    try { await api.put(`/users/${u.id}`, patch); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }

  const mgrName = (id: number | null) => (id ? rows.find((r) => r.id === id)?.name ?? "—" : "—");

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      <Card>
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="Email"><input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Password"><input className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} /></Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "manager" | "member" })}>
              <option value="member">member</option>
              <option value="manager">manager</option>
              <option value="admin">admin</option>
            </select>
          </Field>
          <Field label="Reports To">
            <select className={inputClass} value={form.reportingManagerId} onChange={(e) => setForm({ ...form, reportingManagerId: e.target.value })}>
              <option value="">None</option>
              {rows.filter((r) => r.role !== "member").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <div className="flex items-end"><Button type="submit">Add User</Button></div>
        </form>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Reports To</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2 text-slate-600">{u.email}</td>
                <td className="px-3 py-2">
                  <select className="rounded border border-slate-300 px-1 py-0.5 text-xs" value={u.role} onChange={(e) => update(u, { role: e.target.value })}>
                    <option value="member">member</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select className="rounded border border-slate-300 px-1 py-0.5 text-xs" value={u.reportingManagerId ?? ""} onChange={(e) => update(u, { reportingManagerId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">None</option>
                    {rows.filter((r) => r.id !== u.id && r.role !== "member").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2">{u.active ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  <Button variant="ghost" onClick={() => update(u, { active: !u.active })}>{u.active ? "Deactivate" : "Activate"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ shared table ------------------------------ */

function MasterTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((cells, i) => (
            <tr key={i}>{cells.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
