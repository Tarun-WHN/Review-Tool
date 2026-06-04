import { Router } from "express";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, AuthedRequest } from "../auth";
import { getSubtreeUserIds } from "../tree";
import { taskInclude, serializeTask, SerializedTask } from "../serialize";

export const reportsRouter = Router();
reportsRouter.use(authenticate);

function parseDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

async function queryTasks(req: AuthedRequest): Promise<SerializedTask[]> {
  const me = req.user!;
  const q = req.query;
  const where: Prisma.TaskEntryWhereInput = {};

  let allowed: number[] | null = null;
  if (me.role === "manager") allowed = await getSubtreeUserIds(me.id);
  else if (me.role === "member") allowed = [me.id];

  if (q.ownerId) {
    const requested = Number(q.ownerId);
    if (allowed && !allowed.includes(requested)) return [];
    where.ownerId = requested;
  } else if (allowed) {
    where.ownerId = { in: allowed };
  }

  if (q.categoryId) where.categoryId = Number(q.categoryId);
  if (q.taskMasterId) where.taskMasterId = Number(q.taskMasterId);
  if (q.clientId) where.clientId = Number(q.clientId);
  if (q.warehouseId) where.warehouseId = Number(q.warehouseId);
  if (q.from || q.to) {
    where.endDate = {};
    if (q.from) (where.endDate as Prisma.DateTimeFilter).gte = parseDateOnly(String(q.from));
    if (q.to) (where.endDate as Prisma.DateTimeFilter).lte = parseDateOnly(String(q.to));
  }

  const tasks = await prisma.taskEntry.findMany({ where, include: taskInclude, orderBy: { endDate: "asc" } });
  const now = new Date();
  let rows = tasks.map((t) => serializeTask(t, now));
  if (typeof q.status === "string" && q.status) rows = rows.filter((t) => t.status === q.status);
  return rows;
}

const COLUMNS: { header: string; get: (t: SerializedTask) => string | number }[] = [
  { header: "ID", get: (t) => t.id },
  { header: "Category", get: (t) => t.category.name },
  { header: "Task", get: (t) => t.taskMaster.name },
  { header: "Description", get: (t) => t.description },
  { header: "Client", get: (t) => t.client?.name ?? "" },
  { header: "Warehouse", get: (t) => t.warehouse?.name ?? "" },
  { header: "Owner", get: (t) => t.owner.name },
  { header: "Created By", get: (t) => t.createdBy.name },
  { header: "Start Date", get: (t) => t.startDate },
  { header: "End Date", get: (t) => t.endDate },
  { header: "Duration (days)", get: (t) => t.durationDays },
  { header: "Due In", get: (t) => t.dueIn },
  { header: "Overdue (days)", get: (t) => t.overdueDays },
  { header: "Status", get: (t) => t.status },
  { header: "Date Changes", get: (t) => t.endDateChangeCount },
  { header: "Remarks", get: (t) => t.remarks ?? "" },
  { header: "Bottleneck", get: (t) => t.bottleneck ?? "" },
  { header: "Corrective Action", get: (t) => t.correctiveAction ?? "" },
  { header: "Follow-up Date", get: (t) => t.followUpDate ?? "" },
  { header: "Completed At", get: (t) => t.completedAt ?? "" },
];

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

reportsRouter.get("/export", async (req: AuthedRequest, res) => {
  const rows = await queryTasks(req);
  const format = (req.query.format as string) || "csv";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tasks");
    ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.header, width: Math.max(12, c.header.length + 2) }));
    ws.getRow(1).font = { bold: true };
    for (const t of rows) {
      ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.header, c.get(t)])));
    }
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="review-tasks-${stamp}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
    return;
  }

  // CSV
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const t of rows) lines.push(COLUMNS.map((c) => csvCell(c.get(t))).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="review-tasks-${stamp}.csv"`);
  res.send(lines.join("\n"));
});
