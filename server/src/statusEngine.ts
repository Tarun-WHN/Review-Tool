// Core status / criticality engine. Computed on every read — never stored.

export type TaskStatus =
  | "Ongoing"
  | "At Risk"
  | "Delayed"
  | "Critically Delayed"
  | "Dead"
  | "Completed";

export type DueInLabel = "Week" | "Fortnight" | "Month" | "Quarter" | "Quarter+";

export interface DelaySettings {
  delayProfile: "relative" | "absolute";
  delayedThreshold: number;
  criticalThreshold: number;
  deadDays: number;
  // Days before the end date at which a task flips to "At Risk".
  // e.g. 1 → at risk the day before it's due; 0 → only on/after the due date.
  atRiskLeadDays: number;
}

export interface DerivedFields {
  durationDays: number;
  dueIn: DueInLabel;
  overdueDays: number;
  status: TaskStatus;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole-day difference between two dates (calendar days, UTC-normalized). */
export function dayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const b = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.round((a - b) / MS_PER_DAY);
}

export function dueInLabel(durationDays: number): DueInLabel {
  if (durationDays <= 7) return "Week";
  if (durationDays <= 15) return "Fortnight";
  if (durationDays <= 31) return "Month";
  if (durationDays <= 92) return "Quarter";
  return "Quarter+";
}

export function computeStatus(args: {
  startDate: Date;
  endDate: Date;
  completedAt: Date | null;
  settings: DelaySettings;
  now?: Date;
}): TaskStatus {
  const { startDate, endDate, completedAt, settings } = args;
  const now = args.now ?? new Date();

  if (completedAt) return "Completed";

  const durationDays = Math.max(0, dayDiff(endDate, startDate));
  const overdueDays = dayDiff(now, endDate); // positive when past end date

  if (overdueDays >= settings.deadDays) return "Dead";

  // "At Risk" begins atRiskLeadDays before the end date and lasts until the
  // task crosses the Delayed threshold. overdueDays >= -leadDays means the due
  // date is within `leadDays` away (or already passed).
  const leadDays = Math.max(0, settings.atRiskLeadDays ?? 0);
  const atRisk = overdueDays >= -leadDays;

  if (settings.delayProfile === "relative") {
    if (overdueDays > settings.criticalThreshold * durationDays) return "Critically Delayed";
    if (overdueDays > settings.delayedThreshold * durationDays) return "Delayed";
    return atRisk ? "At Risk" : "Ongoing";
  }

  // absolute
  if (overdueDays > settings.criticalThreshold) return "Critically Delayed";
  if (overdueDays > settings.delayedThreshold) return "Delayed";
  return atRisk ? "At Risk" : "Ongoing";
}

export function deriveFields(args: {
  startDate: Date;
  endDate: Date;
  completedAt: Date | null;
  settings: DelaySettings;
  now?: Date;
}): DerivedFields {
  const now = args.now ?? new Date();
  const durationDays = Math.max(0, dayDiff(args.endDate, args.startDate));
  const overdueRaw = dayDiff(now, args.endDate);
  return {
    durationDays,
    dueIn: dueInLabel(durationDays),
    overdueDays: Math.max(0, overdueRaw),
    status: computeStatus({ ...args, now }),
  };
}

/** Statuses where bottleneck + corrective action become required. */
export function requiresCorrectiveFields(status: TaskStatus): boolean {
  return status === "Delayed" || status === "Critically Delayed" || status === "Dead";
}
