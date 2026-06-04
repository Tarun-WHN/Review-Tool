import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export async function writeAudit(args: {
  actorId: number;
  action: string;
  taskId?: number | null;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      action: args.action,
      taskId: args.taskId ?? null,
      details: args.details ?? Prisma.JsonNull,
    },
  });
}
