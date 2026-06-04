export type Role = "admin" | "manager" | "member";

export type TaskStatus =
  | "Ongoing"
  | "At Risk"
  | "Delayed"
  | "Critically Delayed"
  | "Dead"
  | "Completed";

export type FollowUpType = "none" | "once" | "interval" | "weekly" | "monthly";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  reportingManagerId?: number | null;
  active?: boolean;
}

export interface Category {
  id: number;
  name: string;
  active: boolean;
  delayProfile: "relative" | "absolute";
  delayedThreshold: number;
  criticalThreshold: number;
  deadDays: number;
  atRiskLeadDays: number;
}

export interface TaskMaster {
  id: number;
  categoryId: number;
  name: string;
  active: boolean;
}

export interface NamedMaster {
  id: number;
  name: string;
  active: boolean;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  reportingManagerId: number | null;
  active: boolean;
  createdAt?: string;
}

export interface TreeUser extends UserRow {
  hasReports: boolean;
}

export interface Task {
  id: number;
  categoryId: number;
  category: { id: number; name: string };
  taskMasterId: number;
  taskMaster: { id: number; name: string };
  description: string;
  clientId: number | null;
  client: { id: number; name: string } | null;
  warehouseId: number | null;
  warehouse: { id: number; name: string } | null;
  vendorId: number | null;
  vendor: { id: number; name: string } | null;
  ownerId: number;
  owner: { id: number; name: string; email: string; role: Role };
  createdById: number;
  createdBy: { id: number; name: string; email: string };
  startDate: string;
  endDate: string;
  completedAt: string | null;
  remarks: string | null;
  bottleneck: string | null;
  correctiveAction: string | null;
  followUpDate: string | null;
  followUpType: FollowUpType;
  followUpInterval: number | null;
  followUpWeekdays: number[];
  followUpMonthDays: number[];
  nextFollowUp: string | null;
  followUpDue: boolean;
  followUpLabel: string;
  endDateChangeCount: number;
  createdAt: string;
  updatedAt: string;
  durationDays: number;
  dueIn: string;
  overdueDays: number;
  status: TaskStatus;
}

export interface ChangeRequest {
  id: number;
  taskId: number;
  oldEndDate: string;
  newEndDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  requestedBy: { id: number; name: string };
  decidedBy?: { id: number; name: string } | null;
}

export interface ApprovalRow extends ChangeRequest {
  task: Task;
}

export interface AuditEntry {
  id: number;
  action: string;
  details: unknown;
  createdAt: string;
  actor: { id: number; name: string };
}

export type StatusCounts = Record<TaskStatus, number>;
