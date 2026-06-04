import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { ApprovalRow } from "../types";
import { Button, Card, ErrorText, StatusChip } from "../ui";

export function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.get<ApprovalRow[]>("/approvals"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: number, decision: "approved" | "rejected") {
    setError("");
    try {
      await api.post(`/change-requests/${id}/decide`, { decision });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Approvals</h1>
      <ErrorText>{error}</ErrorText>
      {loading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">No pending end-date change requests.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link to={`/tasks/${r.taskId}`} className="font-medium text-wh-blue hover:underline">
                      {r.task.taskMaster.name}
                    </Link>
                    <StatusChip status={r.task.status} />
                  </div>
                  <p className="text-sm text-slate-600">
                    {r.task.category.name} · Owner: {r.task.owner.name}
                  </p>
                  <p className="mt-1 text-sm">
                    <strong>{r.oldEndDate}</strong> → <strong>{r.newEndDate}</strong>{" "}
                    <span className="text-slate-500">(requested by {r.requestedBy.name})</span>
                  </p>
                  <p className="text-sm text-slate-500">Reason: {r.reason}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => decide(r.id, "approved")}>Approve</Button>
                  <Button variant="danger" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
