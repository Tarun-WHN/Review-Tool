import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { authenticate, requireRole, AuthedRequest } from "../auth";
import { writeAudit } from "../audit";

export const mastersRouter = Router();
mastersRouter.use(authenticate);

const adminOnly = requireRole("admin");

/* ----------------------------- Categories ----------------------------- */

const categorySchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
  delayProfile: z.enum(["relative", "absolute"]),
  delayedThreshold: z.number().positive(),
  criticalThreshold: z.number().positive(),
  deadDays: z.number().int().positive().optional(),
});

mastersRouter.get("/categories", async (req, res) => {
  const includeInactive = req.query.all === "true";
  const categories = await prisma.category.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
  res.json(categories);
});

mastersRouter.post("/categories", adminOnly, async (req: AuthedRequest, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;
  if (d.criticalThreshold <= d.delayedThreshold) {
    return res.status(400).json({ error: "criticalThreshold must be greater than delayedThreshold" });
  }
  const category = await prisma.category.create({
    data: {
      name: d.name,
      active: d.active ?? true,
      delayProfile: d.delayProfile,
      delayedThreshold: d.delayedThreshold,
      criticalThreshold: d.criticalThreshold,
      deadDays: d.deadDays ?? 25,
    },
  });
  await writeAudit({ actorId: req.user!.id, action: "category.create", details: { id: category.id, name: category.name } });
  res.status(201).json(category);
});

mastersRouter.put("/categories/:id", adminOnly, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const category = await prisma.category.update({ where: { id }, data: parsed.data });
  await writeAudit({ actorId: req.user!.id, action: "category.update", details: { id } });
  res.json(category);
});

/* ----------------------------- Task Masters ----------------------------- */

const taskMasterSchema = z.object({
  categoryId: z.number().int(),
  name: z.string().min(1),
  active: z.boolean().optional(),
});

mastersRouter.get("/task-masters", async (req, res) => {
  const includeInactive = req.query.all === "true";
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const taskMasters = await prisma.taskMaster.findMany({
    where: {
      ...(includeInactive ? {} : { active: true }),
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { name: "asc" },
  });
  res.json(taskMasters);
});

mastersRouter.post("/task-masters", adminOnly, async (req: AuthedRequest, res) => {
  const parsed = taskMasterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category) return res.status(400).json({ error: "Category not found" });
  const tm = await prisma.taskMaster.create({ data: { ...parsed.data, active: parsed.data.active ?? true } });
  await writeAudit({ actorId: req.user!.id, action: "taskMaster.create", details: { id: tm.id } });
  res.status(201).json(tm);
});

mastersRouter.put("/task-masters/:id", adminOnly, async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const parsed = taskMasterSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const tm = await prisma.taskMaster.update({ where: { id }, data: parsed.data });
  await writeAudit({ actorId: req.user!.id, action: "taskMaster.update", details: { id } });
  res.json(tm);
});

/* ------------------------- Clients & Warehouses ------------------------- */

const simpleSchema = z.object({ name: z.string().min(1), active: z.boolean().optional() });

function makeSimpleMaster(path: "clients" | "warehouses", model: "client" | "warehouse") {
  mastersRouter.get(`/${path}`, async (req, res) => {
    const includeInactive = req.query.all === "true";
    // @ts-expect-error dynamic model access
    const rows = await prisma[model].findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: "asc" },
    });
    res.json(rows);
  });

  mastersRouter.post(`/${path}`, adminOnly, async (req: AuthedRequest, res) => {
    const parsed = simpleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    // @ts-expect-error dynamic model access
    const row = await prisma[model].create({ data: { ...parsed.data, active: parsed.data.active ?? true } });
    await writeAudit({ actorId: req.user!.id, action: `${model}.create`, details: { id: row.id } });
    res.status(201).json(row);
  });

  mastersRouter.put(`/${path}/:id`, adminOnly, async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const parsed = simpleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    // @ts-expect-error dynamic model access
    const row = await prisma[model].update({ where: { id }, data: parsed.data });
    await writeAudit({ actorId: req.user!.id, action: `${model}.update`, details: { id } });
    res.json(row);
  });
}

makeSimpleMaster("clients", "client");
makeSimpleMaster("warehouses", "warehouse");
