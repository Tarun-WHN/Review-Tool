-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('none', 'once', 'interval', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "task_entries" ADD COLUMN     "follow_up_interval" INTEGER,
ADD COLUMN     "follow_up_month_days" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "follow_up_type" "FollowUpType" NOT NULL DEFAULT 'none',
ADD COLUMN     "follow_up_weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

