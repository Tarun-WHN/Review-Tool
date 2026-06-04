import { ReactNode } from "react";
import { TaskStatus } from "./types";

// Status colors per spec.
const STATUS_STYLES: Record<TaskStatus, string> = {
  Ongoing: "bg-green-100 text-green-800 border-green-300",
  "At Risk": "bg-amber-100 text-amber-800 border-amber-300",
  Delayed: "bg-orange-100 text-orange-800 border-orange-300",
  "Critically Delayed": "bg-red-100 text-red-800 border-red-300",
  Dead: "bg-slate-800 text-white border-slate-900",
  Completed: "bg-blue-100 text-blue-800 border-blue-300",
};

export const STATUS_ORDER: TaskStatus[] = [
  "Ongoing",
  "At Risk",
  "Delayed",
  "Critically Delayed",
  "Dead",
  "Completed",
];

export function StatusChip({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "purple" }) {
  const styles = tone === "purple" ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-700";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants = {
    primary: "bg-wh-blue text-white hover:bg-blue-700",
    secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-wh-blue focus:outline-none focus:ring-1 focus:ring-wh-blue";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>;
}
