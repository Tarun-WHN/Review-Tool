import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authenticate, AuthedRequest } from "../auth";
import { writeAudit } from "../audit";
import { getSubtreeUserIds, getDirectReportsAndSelf } from "../tree";
import { taskInclude, serializeTask } from "../serialize";
import { requiresCorrectiveFields, TaskStatus } from "../statusEngine";

export const tasksRouter = Router();
tasksRouter.use(authenticate);

/** Owner IDs the caller is allowed to see, or null = unrestricted (admin). */
async function visibleOwnerIds(req: AuthedRequest): Promise<number[] | null> {
  const me = req.user!;
  if (me.role === "admin") return null;
  if (me.role === "manager") return await getSubtreeUserIds(me.id);
  return [me.id];
}

function parseDateOnly(s: string): Date {
  // Treat as UTC midnight so calendar-day math is stable.
  return new Date(`${s}T00:00:00.000Z`);
}

/* -------------------------------- List -------------------------------- */

tasksRouter.get("/", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const q = req.query;
  const allowed = await visibleOwnerIds(req);

  const where: Prisma.TaskEntryWhereInput = {};

  // Scope toggles: "mine" / "team"
  const scope = typeof q.scope === "string" ? q.scope : undefined;
  let ownerFilter: number[] | undefined;
  if (scope === "mine") {
    ownerFilter = [me.id];
  } else if (scope === "team") {
    ownerFilter = me.role === "admin" ? undefined : await getSubtreeUserIds(me.id);
  }

  if (q.ownerId) {
    const requested = Number(q.ownerId);
    if (allowed && !allowed.includes(requested)) {
      return res.status(403).json({ error: "Not allowed to view this owner's tasks" });
    }
    where.ownerId = requested;
  } else {
    const scopeIds = ownerFilter;
    if (allowed && scopeIds) {
      where.ownerId = { in: scopeIds.filter((id) => allowed.includes(id)) };
    } else if (allowed) {
      where.ownerId = { in: allowed };
    } else if (scopeIds) {
      where.ownerId = { in: scopeIds };
    }
  }

  if (q.categoryId) where.categoryId = Number(q.categoryId);
  if (q.taskMasterId) where.taskMasterId = Number(q.taskMasterId);
  if (q.clientId) where.clientId = Number(q.clientId);
  if (q.warehouseId) where.warehouseId = Number(q.warehouseId);

  // Date range filters apply to end_date (the execution end date).
  if (q.from || q.to) {
    where.endDate = {};
    if (q.from) (where.endDate as Prisma.DateTimeFilter).gte = parseDateOnly(String(q.from));
    if (q.to) (where.endDate as Prisma.DateTimeFilter).lte = parseDateOnly(String(q.to));
  }

  const tasks = await prisma.taskEntry.findMany({
    where,
    include: taskInclude,
    orderBy: { endDate: "asc" },
  });

  const now = new Date();
  let serialized = tasks.map((t) => serializeTask(t, now));

  // Status is computed, so filter it after serialization.
  const statusFilter = typeof q.status === "string" ? q.status : undefined;
  if (statusFilter) {
    serialized = serialized.filter((t) => t.status === statusFilter);
  }

  // KPI counts per status (over the filtered set, ignoring status filter).
  const counts: Record<TaskStatus, number> = {
    Ongoing: 0,
    "At Risk": 0,
    Delayed: 0,
    "Critically Delayed": 0,
    Dead: 0,
    Completed: 0,
  };
  for (const t of tasks.map((t) => serializeTask(t, now))) counts[t.status]++;

  res.json({ tasks: serialized, counts });
});

/* ------------------------------- Detail ------------------------------- */

tasksRouter.get("/:id", async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const task = await prisma.taskEntry.findUnique({ where: { id }, include: taskInclude });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const allowed = await visibleOwnerIds(req);
  if (allowed && !allowed.includes(task.ownerId)) {
    return res.status(403).json({ error: "Not allowed to view this task" });
  }

  const changeRequests = await prisma.endDateChangeRequest.findMany({
    where: { taskId: id },
    include: {
      requestedBy: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const audit = await prisma.auditLog.findMany({
    where: { taskId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json({ task: serializeTask(task), changeRequests, audit });
});

/* ------------------------------- Create ------------------------------- */

const createSchema = z.object({
  categoryId: z.number().int(),
  taskMasterId: z.number().int(),
  description: z.string().min(1),
  clientId: z.number().int().nullable().optional(),
  warehouseId: z.number().int().nullable().optional(),
  ownerId: z.number().int(),
  startDate: z.string().optional(), // YYYY-MM-DD; defaults to today
  endDate: z.string(),
  remarks: z.string().nullable().optional(),
  bottleneck: z.string().nullable().optional(),
  correctiveAction: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
});

async function assertAssignable(req: AuthedRequest, ownerId: number): Promise<string | null> {
  const me = req.user!;
  if (me.role === "admin") return null;
  if (me.role === "member") return "Members cannot assign tasks";
  const allowed = await getDirectReportsAndSelf(me.id);
  if (!allowed.includes(ownerId)) return "You can only assign to yourself or your direct reports";
  return null;
}

tasksRouter.post("/", async (req: AuthedRequest, res) => {
  const me = req.user!;
  if (me.role === "member") return res.status(403).json({ error: "Members cannot create tasks" });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;

  const assignErr = await assertAssignable(req, d.ownerId);
  if (assignErr) return res.status(403).json({ error: assignErr });

  const taskMaster = await prisma.taskMaster.findUnique({ where: { id: d.taskMasterId } });
  if (!taskMaster) return res.status(400).json({ error: "Task master not found" });
  if (taskMaster.categoryId !== d.categoryId) {
    return res.status(400).json({ error: "Task name does not belong to the selected category" });
  }

  const category = await prisma.category.findUnique({ where: { id: d.categoryId } });
  if (!category) return res.status(400).json({ error: "Category not found" });

  const startDate = d.startDate ? parseDateOnly(d.startDate) : parseDateOnly(new Date().toISOString().slice(0, 10));
  const endDate = parseDateOnly(d.endDate);
  if (endDate < startDate) return res.status(400).json({ error: "End date must be on or after start date" });

  // Enforce corrective fields if the task would already be Delayed+.
  const { computeStatus } = await import("../statusEngine");
  const status = computeStatus({
    startDate,
    endDate,
    completedAt: null,
    settings: {
      delayProfile: category.delayProfile,
      delayedThreshold: category.delayedThreshold,
      criticalThreshold: category.criticalThreshold,
      deadDays: category.deadDays,
    },
  });
  if (requiresCorrectiveFields(status) && (!d.bottleneck || !d.correctiveAction)) {
    return res.status(400).json({ error: `Bottleneck and Corrective Action are required when status is ${status}` });
  }

  const created = await prisma.taskEntry.create({
    data: {
      categoryId: d.categoryId,
      taskMasterId: d.taskMasterId,
      description: d.description,
      clientId: d.clientId ?? null,
      warehouseId: d.warehouseId ?? null,
      ownerId: d.ownerId,
      createdById: me.id,
      startDate,
      endDate,
      remarks: d.remarks ?? null,
      bottleneck: d.bottleneck ?? null,
      correctiveAction: d.correctiveAction ?? null,
      followUpDate: d.followUpDate ? parseDateOnly(d.followUpDate) : null,
    },
    include: taskInclude,
  });

  await writeAudit({
    actorId: me.id,
    taskId: created.id,
    action: "task.create",
    details: { ownerId: d.ownerId, categoryId: d.categoryId, endDate: d.endDate },
  });

  res.status(201).json(serializeTask(created));
});

/* -------------------------------- Edit -------------------------------- */
// NOTE: end_date is intentionally NOT editable here — it changes only through
// the approved end-date change request flow.

const editSchema = z.object({
  categoryId: z.number().int().optional(),
  taskMasterId: z.number().int().optional(),
  description: z.string().min(1).optional(),
  clientId: z.number().int().nullable().optional(),
  warehouseId: z.number().int().nullable().optional(),
  ownerId: z.number().int().optional(),
  startDate: z.string().optional(),
  remarks: z.string().nullable().optional(),
  bottleneck: z.string().nullable().optional(),
  correctiveAction: z.string().nullable().optional(),
  followUpDate: z.string().nullable().optional(),
});

tasksRouter.put("/:id", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const id = Number(req.params.id);
  const existing = await prisma.taskEntry.findUnique({ where: { id }, include: { category: true } });
  if (!existing) return res.status(404).json({ error: "Task not found" });

  // Permission: admin = any; manager = owner in subtree or creator; member = own task.
  let canEditAll = false;
  if (me.role === "admin") {
    canEditAll = true;
  } else if (me.role === "manager") {
    const subtree = await getSubtreeUserIds(me.id);
    if (subtree.includes(existing.ownerId) || existing.createdById === me.id) canEditAll = true;
    else return res.status(403).json({ error: "Not allowed to edit this task" });
  } else {
    if (existing.ownerId !== me.id) return res.status(403).json({ error: "Not allowed to edit this task" });
  }

  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;

  const data: Prisma.TaskEntryUpdateInput = {};

  // Members may only touch corrective/remarks/follow-up fields.
  if (canEditAll) {
    if (d.description !== undefined) data.description = d.description;
    if (d.clientId !== undefined) data.client = d.clientId ? { connect: { id: d.clientId } } : { disconnect: true };
    if (d.warehouseId !== undefined)
      data.warehouse = d.warehouseId ? { connect: { id: d.warehouseId } } : { disconnect: true };

    if (d.categoryId !== undefined || d.taskMasterId !== undefined) {
      const categoryId = d.categoryId ?? existing.categoryId;
      const taskMasterId = d.taskMasterId ?? existing.taskMasterId;
      const tm = await prisma.taskMaster.findUnique({ where: { id: taskMasterId } });
      if (!tm || tm.categoryId !== categoryId) {
        return res.status(400).json({ error: "Task name does not belong to the selected category" });
      }
      data.category = { connect: { id: categoryId } };
      data.taskMaster = { connect: { id: taskMasterId } };
    }

    if (d.ownerId !== undefined) {
      const assignErr = await assertAssignable(req, d.ownerId);
      if (assignErr) return res.status(403).json({ error: assignErr });
      data.owner = { connect: { id: d.ownerId } };
    }

    if (d.startDate !== undefined) {
      const newStart = parseDateOnly(d.startDate);
      if (newStart > existing.endDate) return res.status(400).json({ error: "Start date must be on or before end date" });
      data.startDate = newStart;
    }
  }

  if (d.remarks !== undefined) data.remarks = d.remarks;
  if (d.bottleneck !== undefined) data.bottleneck = d.bottleneck;
  if (d.correctiveAction !== undefined) data.correctiveAction = d.correctiveAction;
  if (d.followUpDate !== undefined) data.followUpDate = d.followUpDate ? parseDateOnly(d.followUpDate) : null;

  // Re-validate corrective requirements against current status.
  const finalCategory = d.categoryId
    ? await prisma.category.findUnique({ where: { id: d.categoryId } })
    : existing.category;
  const { computeStatus } = await import("../statusEngine");
  const status = computeStatus({
    startDate: data.startDate instanceof Date ? data.startDate : existing.startDate,
    endDate: existing.endDate,
    completedAt: existing.completedAt,
    settings: {
      delayProfile: finalCategory!.delayProfile,
      delayedThreshold: finalCategory!.delayedThreshold,
      criticalThreshold: finalCategory!.criticalThreshold,
      deadDays: finalCategory!.deadDays,
    },
  });
  if (requiresCorrectiveFields(status)) {
    const bottleneck = d.bottleneck !== undefined ? d.bottleneck : existing.bottleneck;
    const corrective = d.correctiveAction !== undefined ? d.correctiveAction : existing.correctiveAction;
    if (!bottleneck || !corrective) {
      return res.status(400).json({ error: `Bottleneck and Corrective Action are required when status is ${status}` });
    }
  }

  const updated = await prisma.taskEntry.update({ where: { id }, data, include: taskInclude });
  await writeAudit({ actorId: me.id, taskId: id, action: "task.update", details: { fields: Object.keys(d) } });
  res.json(serializeTask(updated));
});

/* ------------------------------ Complete ------------------------------ */

tasksRouter.post("/:id/complete", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const id = Number(req.params.id);
  const task = await prisma.taskEntry.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: "Task not found" });

  // Owner, a managing manager, or admin may complete.
  let allowed = me.role === "admin" || task.ownerId === me.id;
  if (!allowed && me.role === "manager") {
    const subtree = await getSubtreeUserIds(me.id);
    allowed = subtree.includes(task.ownerId);
  }
  if (!allowed) return res.status(403).json({ error: "Not allowed to complete this task" });
  if (task.completedAt) return res.status(400).json({ error: "Task already completed" });

  const updated = await prisma.taskEntry.update({
    where: { id },
    data: { completedAt: new Date() },
    include: taskInclude,
  });
  await writeAudit({ actorId: me.id, taskId: id, action: "task.complete" });
  res.json(serializeTask(updated));
});

/** Re-open a completed task (admin/manager). */
tasksRouter.post("/:id/reopen", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const id = Number(req.params.id);
  const task = await prisma.taskEntry.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: "Task not found" });

  let allowed = me.role === "admin";
  if (!allowed && me.role === "manager") {
    const subtree = await getSubtreeUserIds(me.id);
    allowed = subtree.includes(task.ownerId);
  }
  if (!allowed) return res.status(403).json({ error: "Not allowed to reopen this task" });

  const updated = await prisma.taskEntry.update({
    where: { id },
    data: { completedAt: null },
    include: taskInclude,
  });
  await writeAudit({ actorId: me.id, taskId: id, action: "task.reopen" });
  res.json(serializeTask(updated));
});
