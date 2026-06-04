import { prisma } from "./prisma";

/**
 * Returns the set of user IDs in the downward reporting tree of `rootId`,
 * including `rootId` itself. Walks the reporting_manager_id self-reference
 * recursively (BFS), guarding against cycles.
 */
export async function getSubtreeUserIds(rootId: number): Promise<number[]> {
  const all = await prisma.user.findMany({
    select: { id: true, reportingManagerId: true },
  });

  const childrenOf = new Map<number, number[]>();
  for (const u of all) {
    if (u.reportingManagerId != null) {
      const arr = childrenOf.get(u.reportingManagerId) ?? [];
      arr.push(u.id);
      childrenOf.set(u.reportingManagerId, arr);
    }
  }

  const result = new Set<number>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return [...result];
}

/** Direct reports of a manager (+ the manager themselves), active only. */
export async function getDirectReportsAndSelf(managerId: number): Promise<number[]> {
  const reports = await prisma.user.findMany({
    where: { reportingManagerId: managerId, active: true },
    select: { id: true },
  });
  return [managerId, ...reports.map((r) => r.id)];
}
