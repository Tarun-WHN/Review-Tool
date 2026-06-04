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
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
