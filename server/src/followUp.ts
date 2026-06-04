// Follow-up recurrence engine. Computes the next follow-up date (on/after today)
// from a task's schedule, and whether a follow-up is due today.
import { dayDiff } from "./statusEngine";

export type FollowUpType = "none" | "once" | "interval" | "weekly" | "monthly";

export interface FollowUpSchedule {
  followUpType: FollowUpType;
  followUpDate: Date | null; // one-off date OR recurrence anchor / "start from"
  followUpInterval: number | null;
  followUpWeekdays: number[]; // 0=Sun..6=Sat
  followUpMonthDays: number[]; // 1..31
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/** Next follow-up occurrence on/after `now` (date-only), or null if none. */
export function computeNextFollowUp(s: FollowUpSchedule, now = new Date()): Date | null {
  const today = startOfUtcDay(now);
  const anchorRaw = s.followUpDate ? startOfUtcDay(s.followUpDate) : null;

  switch (s.followUpType) {
    case "once":
      return anchorRaw; // the single date (may be in the past)

    case "interval": {
      const n = s.followUpInterval ?? 0;
      if (n < 1) return null;
      const anchor = anchorRaw ?? today;
      if (anchor >= today) return anchor;
      const diff = dayDiff(today, anchor); // > 0
      const steps = Math.ceil(diff / n);
      return addDays(anchor, steps * n);
    }

    case "weekly": {
      if (s.followUpWeekdays.length === 0) return null;
      const set = new Set(s.followUpWeekdays);
      const start = anchorRaw && anchorRaw > today ? anchorRaw : today;
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        if (set.has(d.getUTCDay())) return d;
      }
      return null;
    }

    case "monthly": {
      if (s.followUpMonthDays.length === 0) return null;
      const set = new Set(s.followUpMonthDays);
      const start = anchorRaw && anchorRaw > today ? anchorRaw : today;
      // Search up to ~2 months to clear short months (e.g. day 31 in Feb).
      for (let i = 0; i < 62; i++) {
        const d = addDays(start, i);
        if (set.has(d.getUTCDate())) return d;
      }
      return null;
    }

    case "none":
    default:
      return null;
  }
}

export function isFollowUpDueToday(s: FollowUpSchedule, now = new Date()): boolean {
  const next = computeNextFollowUp(s, now);
  if (!next) return false;
  return dayDiff(next, startOfUtcDay(now)) === 0;
}

export function describeFollowUp(s: FollowUpSchedule): string {
  switch (s.followUpType) {
    case "once":
      return s.followUpDate ? `Once on ${s.followUpDate.toISOString().slice(0, 10)}` : "Once";
    case "interval":
      return s.followUpInterval ? `Every ${s.followUpInterval} day(s)` : "Interval";
    case "weekly": {
      const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Weekly: ${s.followUpWeekdays.map((d) => names[d]).join(", ")}`;
    }
    case "monthly":
      return `Monthly on day(s): ${s.followUpMonthDays.join(", ")}`;
    default:
      return "None";
  }
}
