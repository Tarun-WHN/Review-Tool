import { prisma } from "./prisma";
import { config } from "./config";
import { hashPassword } from "./auth";

type Profile = "relative" | "absolute";

interface SeedCategory {
  name: string;
  profile: Profile;
  delayedThreshold: number;
  criticalThreshold: number;
  tasks: string[];
}

// Section 8 masters.
const RELATIVE = { delayedThreshold: 1.5, criticalThreshold: 2.0 };
const ABSOLUTE = { delayedThreshold: 3, criticalThreshold: 5 };

const CATEGORIES: SeedCategory[] = [
  // Relative profile
  { name: "New Lead Generation", profile: "relative", ...RELATIVE, tasks: ["Preliminary Discussion"] },
  { name: "Corporate Ops", profile: "relative", ...RELATIVE, tasks: ["Sales", "HR", "Finance", "Admin"] },
  // Absolute profile
  {
    name: "New Business",
    profile: "absolute",
    ...ABSOLUTE,
    tasks: [
      "Requirement Received",
      "WH Space Scouting – Cost Estimate",
      "WH Procurement – Cost Estimate",
      "WH Interior Set-up – Cost Estimate",
      "WH Recruitment – Cost Estimate",
      "Cost Sheet Submission",
      "Documentation/Agreement Signing",
      "Onboarding/SLA/Tutorials",
    ],
  },
  {
    name: "New Warehouse Setup",
    profile: "absolute",
    ...ABSOLUTE,
    tasks: ["Compliances", "Project Initiation", "Procurement", "Interior Setup", "Recruitment", "SLA/SOP/Training Manuals"],
  },
  {
    name: "Warehouse Ops – BAU",
    profile: "absolute",
    ...ABSOLUTE,
    tasks: ["Manpower", "Bill Payments/Opex/Salary", "Invoicing"],
  },
];

async function main() {
  console.log("Seeding masters...");

  for (const c of CATEGORIES) {
    let category = await prisma.category.findFirst({ where: { name: c.name } });
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: c.name,
          delayProfile: c.profile,
          delayedThreshold: c.delayedThreshold,
          criticalThreshold: c.criticalThreshold,
          deadDays: 25,
        },
      });
      console.log(`  + category: ${c.name}`);
    }
    for (const taskName of c.tasks) {
      const existing = await prisma.taskMaster.findFirst({ where: { name: taskName, categoryId: category.id } });
      if (!existing) {
        await prisma.taskMaster.create({ data: { name: taskName, categoryId: category.id } });
        console.log(`      + task master: ${taskName}`);
      }
    }
  }

  // Admin user (credentials from env).
  const email = config.seedAdmin.email.toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(config.seedAdmin.password);
  if (existingAdmin) {
    await prisma.user.update({
      where: { email },
      data: { name: config.seedAdmin.name, passwordHash, role: "admin", active: true },
    });
    console.log(`  ~ updated admin: ${email}`);
  } else {
    await prisma.user.create({
      data: { name: config.seedAdmin.name, email, passwordHash, role: "admin", active: true },
    });
    console.log(`  + admin user: ${email}`);
  }

  // Clients & Warehouses are intentionally left empty for the admin to populate.

  await seedDemoTasks();

  console.log("Seed complete.");
}

// One sample task per status so the dashboard can be tested end-to-end.
// Uses the absolute-profile "Warehouse Ops – BAU" category:
//   At Risk: overdue 1–3d · Delayed: >3d · Critically Delayed: >5d · Dead: ≥25d.
// Idempotent: every demo task description starts with "[DEMO]".
async function seedDemoTasks() {
  const admin = await prisma.user.findUnique({ where: { email: config.seedAdmin.email.toLowerCase() } });
  if (!admin) return;

  const category = await prisma.category.findFirst({ where: { name: "Warehouse Ops – BAU" } });
  if (!category) return;
  const taskMaster = await prisma.taskMaster.findFirst({ where: { categoryId: category.id } });
  if (!taskMaster) return;

  const existingDemo = await prisma.taskEntry.findFirst({ where: { description: { startsWith: "[DEMO]" } } });
  if (existingDemo) {
    console.log("  ~ demo tasks already present, skipping");
    return;
  }

  const DAY = 86400000;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateOnly = (offsetDays: number) => new Date(today.getTime() + offsetDays * DAY);

  interface DemoTask {
    label: string;
    startOffset: number;
    endOffset: number;
    completed?: boolean;
    bottleneck?: string;
    correctiveAction?: string;
    followUp?: {
      followUpType: "once" | "interval" | "weekly" | "monthly";
      followUpDate?: Date | null;
      followUpInterval?: number | null;
      followUpWeekdays?: number[];
      followUpMonthDays?: number[];
    };
  }

  const demos: DemoTask[] = [
    // Ongoing: ends in the future.
    {
      label: "Ongoing",
      startOffset: -5,
      endOffset: 10,
      followUp: { followUpType: "interval", followUpInterval: 2, followUpDate: dateOnly(0) }, // due today
    },
    // At Risk: 2 days overdue (≤3).
    { label: "At Risk", startOffset: -10, endOffset: -2 },
    // Delayed: 4 days overdue (>3, ≤5).
    {
      label: "Delayed",
      startOffset: -14,
      endOffset: -4,
      bottleneck: "Awaiting vendor confirmation.",
      correctiveAction: "Escalated to procurement lead.",
    },
    // Critically Delayed: 10 days overdue (>5, <25).
    {
      label: "Critically Delayed",
      startOffset: -20,
      endOffset: -10,
      bottleneck: "Manpower shortage at site.",
      correctiveAction: "Hiring drive initiated; temp staff arranged.",
      followUp: { followUpType: "weekly", followUpWeekdays: [1, 4] }, // Mon & Thu
    },
    // Dead: 30 days overdue (≥25).
    {
      label: "Dead",
      startOffset: -45,
      endOffset: -30,
      bottleneck: "Client put project on hold indefinitely.",
      correctiveAction: "Pending client decision to revive.",
    },
    // Completed.
    { label: "Completed", startOffset: -12, endOffset: -3, completed: true },
  ];

  for (const d of demos) {
    await prisma.taskEntry.create({
      data: {
        categoryId: category.id,
        taskMasterId: taskMaster.id,
        description: `[DEMO] ${d.label} sample task`,
        ownerId: admin.id,
        createdById: admin.id,
        startDate: dateOnly(d.startOffset),
        endDate: dateOnly(d.endOffset),
        completedAt: d.completed ? new Date() : null,
        bottleneck: d.bottleneck ?? null,
        correctiveAction: d.correctiveAction ?? null,
        followUpType: d.followUp?.followUpType ?? "none",
        followUpDate: d.followUp?.followUpDate ?? null,
        followUpInterval: d.followUp?.followUpInterval ?? null,
        followUpWeekdays: d.followUp?.followUpWeekdays ?? [],
        followUpMonthDays: d.followUp?.followUpMonthDays ?? [],
      },
    });
    console.log(`  + demo task: ${d.label}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
