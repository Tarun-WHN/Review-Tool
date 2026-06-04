import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, qs } from "../api";
import { Category, FollowUpType, NamedMaster, Task, TaskMaster, UserRow } from "../types";
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

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FOLLOW_UP_TYPES: { value: FollowUpType; label: string }[] = [
  { value: "none", label: "No follow-up" },
  { value: "once", label: "Once (single date)" },
  { value: "interval", label: "Every N days" },
  { value: "weekly", label: "Weekly (weekdays)" },
  { value: "monthly", label: "Monthly (dates)" },
];

function toggle(list: number[], v: number): number[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b);
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
  const [followUpType, setFollowUpType] = useState<FollowUpType>("none");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpInterval, setFollowUpInterval] = useState("2");
  const [followUpWeekdays, setFollowUpWeekdays] = useState<number[]>([]);
  const [followUpMonthDays, setFollowUpMonthDays] = useState<number[]>([]);

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
      setFollowUpType(task.followUpType ?? "none");
      setFollowUpDate(task.followUpDate ?? "");
      setFollowUpInterval(task.followUpInterval ? String(task.followUpInterval) : "2");
      setFollowUpWeekdays(task.followUpWeekdays ?? []);
      setFollowUpMonthDays(task.followUpMonthDays ?? []);
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
    if (followUpType === "once" && !followUpDate) {
      setError("Pick a follow-up date.");
      return;
    }
    if (followUpType === "interval" && Number(followUpInterval) < 1) {
      setError("Follow-up interval must be at least 1 day.");
      return;
    }
    if (followUpType === "weekly" && followUpWeekdays.length === 0) {
      setError("Pick at least one weekday for follow-up.");
      return;
    }
    if (followUpType === "monthly" && followUpMonthDays.length === 0) {
      setError("Pick at least one day of the month for follow-up.");
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
        followUpType,
        followUpDate: followUpDate || null,
        followUpInterval: followUpType === "interval" ? Number(followUpInterval) : null,
        followUpWeekdays: followUpType === "weekly" ? followUpWeekdays : [],
        followUpMonthDays: followUpType === "monthly" ? followUpMonthDays : [],
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

          <div className="rounded-md border border-slate-200 p-3">
            <Field label="Follow-up Schedule">
              <select className={inputClass} value={followUpType} onChange={(e) => setFollowUpType(e.target.value as FollowUpType)}>
                {FOLLOW_UP_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </Field>

            {followUpType === "once" && (
              <div className="mt-3">
                <Field label="Follow-up Date">
                  <input type="date" className={inputClass} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                </Field>
              </div>
            )}

            {followUpType === "interval" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Every N days">
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={followUpInterval}
                    onChange={(e) => setFollowUpInterval(e.target.value)}
                  />
                  <span className="mt-1 block text-xs text-slate-500">e.g. 2 = alternate days, 3 = every 3rd day.</span>
                </Field>
                <Field label="Start From (optional)">
                  <input type="date" className={inputClass} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                </Field>
              </div>
            )}

            {followUpType === "weekly" && (
              <div className="mt-3">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Weekdays</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFollowUpWeekdays((w) => toggle(w, i))}
                      className={`rounded-md border px-3 py-1 text-sm ${
                        followUpWeekdays.includes(i)
                          ? "border-wh-blue bg-wh-blue/10 text-wh-navy"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {followUpType === "monthly" && (
              <div className="mt-3">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Days of month</span>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFollowUpMonthDays((m) => toggle(m, d))}
                      className={`h-8 w-8 rounded-md border text-xs ${
                        followUpMonthDays.includes(d)
                          ? "border-wh-blue bg-wh-blue/10 text-wh-navy"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
