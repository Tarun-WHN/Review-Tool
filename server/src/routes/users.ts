import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate, requireRole, hashPassword, AuthedRequest } from "../auth";
import { writeAudit } from "../audit";
import { getSubtreeUserIds, getDirectReportsAndSelf } from "../tree";

export const usersRouter = Router();
usersRouter.use(authenticate);

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  reportingManagerId: true,
  active: true,
  createdAt: true,
} as const;

/** Assignable users for the "Assign To" dropdown (assign-to rule). */
usersRouter.get("/assignable", async (req: AuthedRequest, res) => {
  const me = req.user!;
  if (me.role === "admin") {
    const all = await prisma.user.findMany({ where: { active: true }, select: userSelect, orderBy: { name: "asc" } });
    return res.json(all);
  }
  const ids = await getDirectReportsAndSelf(me.id);
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, active: true },
    select: userSelect,
    orderBy: { name: "asc" },
  });
  res.json(users);
});

/**
 * Direct reports of `managerId` (default: current user), each annotated with
 * hasReports so the client can render an expandable tree. Authorization:
 * the requested manager must be inside the caller's own subtree (admins: any).
 */
usersRouter.get("/reports", async (req: AuthedRequest, res) => {
  const me = req.user!;
  const managerId = req.query.managerId ? Number(req.query.managerId) : me.id;

  if (me.role !== "admin") {
    const subtree = await getSubtreeUserIds(me.id);
    if (!subtree.includes(managerId)) {
      return res.status(403).json({ error: "Not allowed to view this part of the tree" });
    }
  }

  const reports = await prisma.user.findMany({
    where: { reportingManagerId: managerId, active: true },
    select: userSelect,
    orderBy: { name: "asc" },
  });

  const reportIds = reports.map((r) => r.id);
  const grandchildren = await prisma.user.groupBy({
    by: ["reportingManagerId"],
    where: { reportingManagerId: { in: reportIds }, active: true },
    _count: { _all: true },
  });
  const hasReportsSet = new Set(grandchildren.map((g) => g.reportingManagerId));

  res.json(reports.map((r) => ({ ...r, hasReports: hasReportsSet.has(r.id) })));
});

/** Full user list — admin only (Masters screen). */
usersRouter.get("/", requireRole("admin"), async (_req, res) => {
  const users = await prisma.user.findMany({ select: userSelect, orderBy: { name: "asc" } });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "manager", "member"]),
  reportingManagerId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});

usersRouter.post("/", requireRole("admin"), async (req: AuthedRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: d.email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: "Email already in use" });
  const user = await prisma.user.create({
    data: {
      name: d.name,
      email: d.email.toLowerCase(),
      passwordHash: await hashPassword(d.password),
      role: d.role,
      reportingManagerId: d.reportingManagerId ?? null,
      active: d.active ?? true,
    },
    select: userSelect,
  });
  await writeAudit({ actorId: req.user!.id, action: "user.create", details: { id: user.id, role: user.role } });
  res.status(201).json(user);
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["admin", "manager", "member"]).optional(),
  reportingManagerId: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
});

usersRouter.put("/:id", requireRole("admin"), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;
  if (d.reportingManagerId === id) {
    return res.status(400).json({ error: "A user cannot report to themselves" });
  }
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.email !== undefined) data.email = d.email.toLowerCase();
  if (d.role !== undefined) data.role = d.role;
  if (d.reportingManagerId !== undefined) data.reportingManagerId = d.reportingManagerId;
  if (d.active !== undefined) data.active = d.active;
  if (d.password) data.passwordHash = await hashPassword(d.password);

  const user = await prisma.user.update({ where: { id }, data, select: userSelect });
  await writeAudit({ actorId: req.user!.id, action: "user.update", details: { id } });
  res.json(user);
});
