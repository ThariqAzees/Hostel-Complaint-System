-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_performed_by_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "performed_by" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
