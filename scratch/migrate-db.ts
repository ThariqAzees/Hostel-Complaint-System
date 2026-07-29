import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  console.log("Applying SQL migration: adding updated_at to student_imports...");
  // Postgres supports ADD COLUMN IF NOT EXISTS
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "student_imports" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);
  console.log("SQL migration completed successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
