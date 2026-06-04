-- CreateTable
CREATE TABLE "task_remarks" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_remarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_remarks_task_id_idx" ON "task_remarks"("task_id");

-- AddForeignKey
ALTER TABLE "task_remarks" ADD CONSTRAINT "task_remarks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_remarks" ADD CONSTRAINT "task_remarks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrate existing inline remarks into the thread (authored by the task creator)
INSERT INTO "task_remarks" ("task_id", "author_id", "body", "created_at")
SELECT "id", "created_by", "remarks", "created_at"
FROM "task_entries"
WHERE "remarks" IS NOT NULL AND trim("remarks") <> '';
