import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken, verifyPassword, authenticate, AuthedRequest } from "../auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.active) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const authUser = { id: user.id, role: user.role, email: user.email, name: user.name };
  const token = signToken(authUser);
  return res.json({ token, user: authUser });
});

authRouter.get("/me", authenticate, async (req: AuthedRequest, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, reportingManagerId: true, active: true },
  });
  if (!me) return res.status(404).json({ error: "User not found" });
  return res.json({ user: me });
});
