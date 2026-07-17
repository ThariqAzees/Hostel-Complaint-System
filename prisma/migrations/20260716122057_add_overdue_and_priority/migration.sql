-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('NORMAL', 'HIGH');

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "overdue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "ComplaintPriority" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "complaints_overdue_idx" ON "complaints"("overdue");

-- CreateIndex
CREATE INDEX "complaints_priority_idx" ON "complaints"("priority");
