import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, qs } from "../api";
import { Category, NamedMaster, Task, TaskMaster, UserRow } from "../types";
import { Button, Card, ErrorText, Field, inputClass } from "../ui";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${to}T00:00:00Z`);
  const b = Date.parse(`${from}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((a - b) / 86400000);
}

function dueInLabel(d: number): string {
  if (d <= 7) return "Week";
  if (d <= 15) return "Fortnight";
  if (d <= 31) return "Month";
  if (d <= 92) return "Quarter";
  return "Quarter+";
}

export function TaskFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [taskMasters, setTaskMasters] = useState<TaskMaster[]>([]);
  const [clients, setClients] = useState<NamedMaster[]>([]);
  const [warehouses, setWarehouses] = useState<NamedMaster[]>([]);
  const [assignable, setAssignable] = useState<UserRow[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [taskMasterId, setTaskMasterId] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [bottleneck, setBottleneck] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const [existing, setExisting] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories);
    api.get<NamedMaster[]>("/clients").then(setClients);
    api.get<NamedMaster[]>("/warehouses").then(setWarehouses);
    api.get<UserRow[]>("/users/assignable").then(setAssignable);
  }, []);

  useEffect(() => {
    if (categoryId) api.get<TaskMaster[]>(`/task-masters${qs({ categoryId })}`).then(setTaskMasters);
    else setTaskMasters([]);
  }, [categoryId]);

  useEffect(() => {
    if (!id) return;
    api.get<{ task: Task }>(`/tasks/${id}`).then(({ task }) => {
      setExisting(task);
      setCategoryId(String(task.categoryId));
      setTaskMasterId(String(task.taskMasterId));
      setDescription(task.description);
      setClientId(task.clientId ? String(task.clientId) : "");
      setWarehouseId(task.warehouseId ? String(task.warehouseId) : "");
      setStartDate(task.startDate);
      setEndDate(task.endDate);
      setOwnerId(String(task.ownerId));
      setRemarks(task.remarks ?? "");
      setBottleneck(task.bottleneck ?? "");
      setCorrectiveAction(task.correctiveAction ?? "");
      setFollowUpDate(task.followUpDate ?? "");
    });
  }, [id]);

  const duration = useMemo(() => (endDate ? Math.max(0, dayDiff(startDate, endDate)) : 0), [startDate, endDate]);
  const correctiveRequired = existing
    ? ["Delayed", "Critically Delayed", "Dead"].includes(existing.status)
    : false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!categoryId || !taskMasterId || !description || !endDate || !ownerId) {
      setError("Please fill all required fields.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after start date.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        categoryId: Number(categoryId),
        taskMasterId: Number(taskMasterId),
        description,
        clientId: clientId ? Number(clientId) : null,
        warehouseId: warehouseId ? Number(warehouseId) : null,
        ownerId: Number(ownerId),
        startDate,
        remarks: remarks || null,
        bottleneck: bottleneck || null,
        correctiveAction: correctiveAction || null,
        followUpDate: followUpDate || null,
      };
      if (isEdit) {
        await api.put(`/tasks/${id}`, payload);
        navigate(`/tasks/${id}`);
      } else {
        const created = await api.post<Task>("/tasks", { ...payload, endDate });
        navigate(`/tasks/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold text-slate-800">{isEdit ? "Edit Task" : "Create Task"}</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <ErrorText>{error}</ErrorText>

          <Field label="Category" required>
            <select className={inputClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setTaskMasterId(""); }} required>
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Task Name" required>
            <select className={inputClass} value={taskMasterId} onChange={(e) => setTaskMasterId(e.target.value)} disabled={!categoryId} required>
              <option value="">Select task…</option>
              {taskMasters.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Description" required>
            <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} required />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Warehouse">
              <select className={inputClass} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">None</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start Date" required>
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </Field>
            <Field label="Execution End Date" required>
              <input
                type="date"
                className={inputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isEdit}
                required
              />
              {isEdit && (
                <span className="mt-1 block text-xs text-slate-500">
                  Locked after creation — submit an end-date change request from the task detail page.
                </span>
              )}
            </Field>
          </div>

          <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Duration: <strong>{duration} days</strong> · Due in: <strong>{endDate ? dueInLabel(duration) : "—"}</strong>
          </div>

          <Field label="Assign To" required>
            <select className={inputClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)} required>
              <option value="">Select assignee…</option>
              {assignable.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Remarks">
            <textarea className={inputClass} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bottleneck" required={correctiveRequired}>
              <textarea className={inputClass} rows={2} value={bottleneck} onChange={(e) => setBottleneck(e.target.value)} />
            </Field>
            <Field label="Corrective Action" required={correctiveRequired}>
              <textarea className={inputClass} rows={2} value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} />
            </Field>
          </div>
          {correctiveRequired && (
            <p className="text-xs text-amber-700">
              This task is {existing?.status}. Bottleneck and Corrective Action are required.
            </p>
          )}

          <Field label="Follow-up Date">
            <input type="date" className={inputClass} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
