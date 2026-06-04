-- AlterTable
ALTER TABLE "task_entries" ADD COLUMN     "vendor_id" INTEGER;

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "task_entries" ADD CONSTRAINT "task_entries_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
