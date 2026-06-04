import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate, AuthedRequest } from "../auth";
import { writeAudit } from "../audit";
import { getSubtreeUserIds } from "../tree";
import { taskInclude, serializeTask } from "../serialize";

export const changeRequestsRouter = Router();
changeRequestsRouter.use(authenticate);

const MAX_APPROVED_CHANGES = 2;

function parseDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

const submitSchema = z.object({
  newEndDate: z.string(),
  reason: z.string().min(1),
});

/** Submit an end-date change request for a task (owner or creator). */
changeRequestsRouter.post("/tasks/:id/change-requests", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const id = Number(req.params.id);
  const task = await prisma.taskEntry.findUnique({ where: { id } });
  if (!task) return res.status(404).json({ error: "Task not found" });

  const isOwnerOrCreator = task.ownerId === me.id || task.createdById === me.id;
  if (!isOwnerOrCreator && me.role !== "admin") {
    return res.status(403).json({ error: "Only the task owner or creator can request a date change" });
  }

  if (task.endDateChangeCount >= MAX_APPROVED_CHANGES) {
    return res.status(400).json({ error: `Maximum of ${MAX_APPROVED_CHANGES} approved date changes reached` });
  }

  const pending = await prisma.endDateChangeRequest.findFirst({ where: { taskId: id, status: "pending" } });
  if (pending) return res.status(400).json({ error: "There is already a pending change request for this task" });

  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const newEndDate = parseDateOnly(parsed.data.newEndDate);
  if (newEndDate < task.startDate) return res.status(400).json({ error: "New end date must be on or after start date" });

  const cr = await prisma.endDateChangeRequest.create({
    data: {
      taskId: id,
      requestedById: me.id,
      oldEndDate: task.endDate,
      newEndDate,
      reason: parsed.data.reason,
    },
  });
  await writeAudit({
    actorId: me.id,
    taskId: id,
    action: "changeRequest.submit",
    details: { requestId: cr.id, newEndDate: parsed.data.newEndDate },
  });
  res.status(201).json(cr);
});

/** Pending approvals queue for the logged-in manager (admin sees all). */
changeRequestsRouter.get("/approvals", async (req: AuthedRequest, res) => {
  const me = req.user!;
  if (me.role === "member") return res.json([]);

  let ownerScope: number[] | null = null;
  if (me.role === "manager") {
    ownerScope = await getSubtreeUserIds(me.id);
  }

  const requests = await prisma.endDateChangeRequest.findMany({
    where: {
      status: "pending",
      ...(ownerScope ? { task: { ownerId: { in: ownerScope } } } : {}),
    },
    include: {
      requestedBy: { select: { id: true, name: true } },
      task: { include: taskInclude },
    },
    orderBy: { createdAt: "asc" },
  });

  const out = requests.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    oldEndDate: r.oldEndDate.toISOString().slice(0, 10),
    newEndDate: r.newEndDate.toISOString().slice(0, 10),
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
    requestedBy: r.requestedBy,
    task: serializeTask(r.task),
  }));
  res.json(out);
});

const decideSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

/** Approve or reject a pending change request. */
changeRequestsRouter.post("/change-requests/:id/decide", async (req: AuthedRequest, res) => {
  const me = req.user!;
  if (me.role === "member") return res.status(403).json({ error: "Members cannot decide change requests" });

  const id = Number(req.params.id);
  const parsed = decideSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const cr = await prisma.endDateChangeRequest.findUnique({ where: { id }, include: { task: true } });
  if (!cr) return res.status(404).json({ error: "Change request not found" });
  if (cr.status !== "pending") return res.status(400).json({ error: "Request already decided" });

  if (me.role === "manager") {
    const subtree = await getSubtreeUserIds(me.id);
    if (!subtree.includes(cr.task.ownerId)) {
      return res.status(403).json({ error: "Not allowed to decide this request" });
    }
  }

  if (parsed.data.decision === "approved") {
    if (cr.task.endDateChangeCount >= MAX_APPROVED_CHANGES) {
      return res.status(400).json({ error: "Maximum approved date changes already reached" });
    }
    await prisma.$transaction([
      prisma.endDateChangeRequest.update({
        where: { id },
        data: { status: "approved", decidedById: me.id, decidedAt: new Date() },
      }),
      prisma.taskEntry.update({
        where: { id: cr.taskId },
        data: { endDate: cr.newEndDate, endDateChangeCount: { increment: 1 } },
      }),
    ]);
    await writeAudit({
      actorId: me.id,
      taskId: cr.taskId,
      action: "changeRequest.approve",
      details: {
        requestId: id,
        oldEndDate: cr.oldEndDate.toISOString().slice(0, 10),
        newEndDate: cr.newEndDate.toISOString().slice(0, 10),
      },
    });
  } else {
    await prisma.endDateChangeRequest.update({
      where: { id },
      data: { status: "rejected", decidedById: me.id, decidedAt: new Date() },
    });
    await writeAudit({ actorId: me.id, taskId: cr.taskId, action: "changeRequest.reject", details: { requestId: id } });
  }

  const task = await prisma.taskEntry.findUnique({ where: { id: cr.taskId }, include: taskInclude });
  res.json({ ok: true, task: task ? serializeTask(task) : null });
});
