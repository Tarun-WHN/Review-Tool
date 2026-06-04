import { Prisma } from "@prisma/client";
import { deriveFields } from "./statusEngine";

export const taskInclude = {
  category: true,
  taskMaster: true,
  client: true,
  warehouse: true,
  owner: { select: { id: true, name: true, email: true, role: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskEntryInclude;

type TaskWithRelations = Prisma.TaskEntryGetPayload<{ include: typeof taskInclude }>;

export function serializeTask(task: TaskWithRelations, now = new Date()) {
  const derived = deriveFields({
    startDate: task.startDate,
    endDate: task.endDate,
    completedAt: task.completedAt,
    settings: {
      delayProfile: task.category.delayProfile,
      delayedThreshold: task.category.delayedThreshold,
      criticalThreshold: task.category.criticalThreshold,
      deadDays: task.category.deadDays,
    },
    now,
  });

  return {
    id: task.id,
    categoryId: task.categoryId,
    category: { id: task.category.id, name: task.category.name },
    taskMasterId: task.taskMasterId,
    taskMaster: { id: task.taskMaster.id, name: task.taskMaster.name },
    description: task.description,
    clientId: task.clientId,
    client: task.client ? { id: task.client.id, name: task.client.name } : null,
    warehouseId: task.warehouseId,
    warehouse: task.warehouse ? { id: task.warehouse.id, name: task.warehouse.name } : null,
    ownerId: task.ownerId,
    owner: task.owner,
    createdById: task.createdById,
    createdBy: task.createdBy,
    startDate: task.startDate.toISOString().slice(0, 10),
    endDate: task.endDate.toISOString().slice(0, 10),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    remarks: task.remarks,
    bottleneck: task.bottleneck,
    correctiveAction: task.correctiveAction,
    followUpDate: task.followUpDate ? task.followUpDate.toISOString().slice(0, 10) : null,
    endDateChangeCount: task.endDateChangeCount,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    // derived
    durationDays: derived.durationDays,
    dueIn: derived.dueIn,
    overdueDays: derived.overdueDays,
    status: derived.status,
  };
}

export type SerializedTask = ReturnType<typeof serializeTask>;
