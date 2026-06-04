import { useNavigate } from "react-router-dom";
import { Task } from "../types";
import { StatusChip, Badge } from "../ui";

export function TaskTable({ tasks, compact = false }: { tasks: Task[]; compact?: boolean }) {
  const navigate = useNavigate();
  if (tasks.length === 0) {
    return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No tasks.</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Category / Task</th>
            {!compact && <th className="px-3 py-2">Owner</th>}
            <th className="px-3 py-2">End Date</th>
            <th className="px-3 py-2">Due In</th>
            <th className="px-3 py-2">Overdue</th>
            <th className="px-3 py-2">Follow-up</th>
            <th className="px-3 py-2">Flags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t) => (
            <tr
              key={t.id}
              onClick={() => navigate(`/tasks/${t.id}`)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <td className="px-3 py-2">
                <StatusChip status={t.status} />
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{t.taskMaster.name}</div>
                <div className="text-xs text-slate-500">
                  {t.category.name}
                  {t.client ? ` · ${t.client.name}` : ""}
                  {t.warehouse ? ` · ${t.warehouse.name}` : ""}
                </div>
              </td>
              {!compact && <td className="px-3 py-2 text-slate-700">{t.owner.name}</td>}
              <td className="px-3 py-2 whitespace-nowrap text-slate-700">{t.endDate}</td>
              <td className="px-3 py-2 text-slate-600">{t.dueIn}</td>
              <td className="px-3 py-2 text-slate-600">{t.overdueDays > 0 ? `${t.overdueDays}d` : "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                {t.followUpDue ? (
                  <Badge tone="amber">Due today</Badge>
                ) : t.nextFollowUp ? (
                  <span className="text-xs text-slate-600">{t.nextFollowUp}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                {t.endDateChangeCount > 0 && <Badge tone="purple">Date changed ×{t.endDateChangeCount}</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
