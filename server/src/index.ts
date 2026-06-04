import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { authRouter } from "./routes/auth";
import { mastersRouter } from "./routes/masters";
import { usersRouter } from "./routes/users";
import { tasksRouter } from "./routes/tasks";
import { changeRequestsRouter } from "./routes/changeRequests";
import { reportsRouter } from "./routes/reports";

const app = express();

const origins = config.clientOrigin === "*" ? true : config.clientOrigin.split(",").map((o) => o.trim());
app.use(cors({ origin: origins }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api", mastersRouter); // /api/categories, /api/task-masters, /api/clients, /api/warehouses
app.use("/api/tasks", tasksRouter);
app.use("/api", changeRequestsRouter); // /api/approvals, /api/change-requests/:id/decide, /api/tasks/:id/change-requests
app.use("/api/reports", reportsRouter);

// Serve the built React client (single-service hosting). The client talks to
// same-origin /api when VITE_API_BASE_URL is blank. Works in dev (tsx, __dirname
// = server/src) and prod (compiled, __dirname = server/dist) — both resolve to
// the repo's client/dist.
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
  console.log(`Serving client from ${clientDist}`);
}

// Centralized error handler.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Review Tool API listening on port ${config.port}`);
});
