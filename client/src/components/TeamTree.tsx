import { useEffect, useState } from "react";
import { api, qs } from "../api";
import { Task, TreeUser } from "../types";
import { TaskTable } from "./TaskTable";

interface NodeProps {
  user: TreeUser;
  depth: number;
}

function TreeNode({ user, depth }: NodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [reports, setReports] = useState<TreeUser[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (reports === null || tasks === null) {
      setLoading(true);
      try {
        const [rep, taskRes] = await Promise.all([
          api.get<TreeUser[]>(`/users/reports${qs({ managerId: user.id })}`),
          api.get<{ tasks: Task[] }>(`/tasks${qs({ ownerId: user.id })}`),
        ]);
        setReports(rep);
        setTasks(taskRes.tasks);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 16 }} className="border-l border-slate-200 pl-3">
      <div
        onDoubleClick={toggle}
        onClick={toggle}
        title="Click to expand this person's reports and tasks"
        className="flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-100"
      >
        <span className="text-slate-400">{expanded ? "▾" : user.hasReports ? "▸" : "•"}</span>
        <span className="font-medium text-slate-800">{user.name}</span>
        <span className="text-xs capitalize text-slate-500">{user.role}</span>
      </div>

      {expanded && (
        <div className="mb-2 mt-1 space-y-2">
          {loading && <div className="pl-4 text-xs text-slate-400">Loading…</div>}
          {tasks && tasks.length > 0 && (
            <div className="pl-1">
              <TaskTable tasks={tasks} compact />
            </div>
          )}
          {tasks && tasks.length === 0 && <div className="pl-4 text-xs text-slate-400">No tasks.</div>}
          {reports?.map((r) => (
            <TreeNode key={r.id} user={r} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TeamTree() {
  const [roots, setRoots] = useState<TreeUser[] | null>(null);

  useEffect(() => {
    api.get<TreeUser[]>("/users/reports").then(setRoots);
  }, []);

  if (!roots) return <div className="text-sm text-slate-400">Loading team…</div>;
  if (roots.length === 0)
    return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">No direct reports.</div>;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="mb-2 text-xs text-slate-500">
        Showing your direct reports. Double-click a person to drill into their reports and tasks.
      </p>
      {roots.map((r) => (
        <TreeNode key={r.id} user={r} depth={0} />
      ))}
    </div>
  );
}
