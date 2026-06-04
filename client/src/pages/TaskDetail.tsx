import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { AuditEntry, ChangeRequest, Task } from "../types";
import { Badge, Button, Card, ErrorText, Field, StatusChip, inputClass } from "../ui";

export function TaskDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");

  const [showCR, setShowCR] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const r = await api.get<{ task: Task; changeRequests: ChangeRequest[]; audit: AuditEntry[] }>(`/tasks/${id}`);
    setTask(r.task);
    setChangeRequests(r.changeRequests);
    setAudit(r.audit);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [id]);

  if (error && !task) return <ErrorText>{error}</ErrorText>;
  if (!task) return <div className="text-sm text-slate-400">Loading…</div>;

  const isOwner = user?.id === task.ownerId;
  const isCreator = user?.id === task.createdById;
  const isManagerial = user?.role === "admin" || user?.role === "manager";
  const pending = changeRequests.find((c) => c.status === "pending");

  async function action(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function submitCR(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/tasks/${id}/change-requests`, { newEndDate, reason });
      setShowCR(false);
      setNewEndDate("");
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">{task.taskMaster.name}</h1>
            <StatusChip status={task.status} />
            {task.endDateChangeCount > 0 && <Badge tone="purple">Date changed ×{task.endDateChangeCount}</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {task.category.name}
            {task.client ? ` · ${task.client.name}` : ""}
            {task.warehouse ? ` · ${task.warehouse.name}` : ""}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/tasks/${task.id}/edit`)}>Edit</Button>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Info label="Owner" value={task.owner.name} />
          <Info label="Created by" value={task.createdBy.name} />
          <Info label="Start Date" value={task.startDate} />
          <Info label="End Date" value={task.endDate} />
          <Info label="Duration" value={`${task.durationDays} days`} />
          <Info label="Due In" value={task.dueIn} />
          <Info label="Overdue" value={task.overdueDays > 0 ? `${task.overdueDays} days` : "—"} />
          <Info label="Follow-up" value={task.followUpDate ?? "—"} />
          <Info label="Completed" value={task.completedAt ? new Date(task.completedAt).toLocaleString() : "—"} />
        </dl>
        <div className="mt-4 space-y-2 text-sm">
          <Block label="Description" value={task.description} />
          <Block label="Remarks" value={task.remarks} />
          <Block label="Bottleneck" value={task.bottleneck} />
          <Block label="Corrective Action" value={task.correctiveAction} />
        </div>
      </Card>

      {/* Actions */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {!task.completedAt && (isOwner || isManagerial) && (
            <Button onClick={() => action(() => api.post(`/tasks/${task.id}/complete`))}>Mark Completed</Button>
          )}
          {task.completedAt && isManagerial && (
            <Button variant="secondary" onClick={() => action(() => api.post(`/tasks/${task.id}/reopen`))}>Reopen</Button>
          )}
          {(isOwner || isCreator || user?.role === "admin") && task.endDateChangeCount < 2 && !pending && (
            <Button variant="secondary" onClick={() => setShowCR((s) => !s)}>Request End-Date Change</Button>
          )}
          {task.endDateChangeCount >= 2 && (
            <span className="self-center text-xs text-slate-500">Max date changes reached.</span>
          )}
        </div>

        {showCR && (
          <form onSubmit={submitCR} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="New End Date" required>
              <input type="date" className={inputClass} value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} required />
            </Field>
            <Field label="Reason" required>
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Submit Request</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Pending approval (managers) */}
      {pending && isManagerial && (
        <Card className="border-amber-300 bg-amber-50">
          <h2 className="mb-2 font-semibold text-amber-900">Pending End-Date Change</h2>
          <p className="text-sm text-slate-700">
            {pending.requestedBy.name} requests <strong>{pending.oldEndDate}</strong> → <strong>{pending.newEndDate}</strong>
          </p>
          <p className="text-sm text-slate-600">Reason: {pending.reason}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => action(() => api.post(`/change-requests/${pending.id}/decide`, { decision: "approved" }))}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => action(() => api.post(`/change-requests/${pending.id}/decide`, { decision: "rejected" }))}>
              Reject
            </Button>
          </div>
        </Card>
      )}

      {/* Change request history */}
      {changeRequests.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold text-slate-800">End-Date Change History</h2>
          <ul className="space-y-2 text-sm">
            {changeRequests.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2">
                <span>{c.oldEndDate} → {c.newEndDate}</span>
                <Badge tone={c.status === "approved" ? "purple" : "slate"}>{c.status}</Badge>
                <span className="text-slate-500">by {c.requestedBy.name}</span>
                <span className="text-xs text-slate-400">— {c.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Audit trail */}
      <Card>
        <h2 className="mb-2 font-semibold text-slate-800">Audit Trail</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-400">No activity.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600">
            {audit.map((a) => (
              <li key={a.id}>
                <span className="font-mono text-slate-400">{new Date(a.createdAt).toLocaleString()}</span> ·{" "}
                <strong>{a.action}</strong> · {a.actor.name}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="whitespace-pre-wrap text-slate-700">{value || "—"}</div>
    </div>
  );
}
