import "dotenv/config";
import { prisma } from "../src/lib/db";

async function recoverStuckBatches() {
  console.log("==================================================");
  console.log("STUCK STUDENT IMPORT BATCHES RECOVERY UTILITY");
  console.log("==================================================");

  // Define stale threshold based on configured timeout
  const timeoutSeconds = Number(process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS) || 120;
  const staleThresholdTime = new Date(Date.now() - timeoutSeconds * 1000);

  // Find stuck batches
  const stuckBatches = await prisma.studentImport.findMany({
    where: {
      status: "PROCESSING",
      updated_at: { lt: staleThresholdTime }
    },
    orderBy: {
      created_at: "desc"
    }
  });

  console.log(`Found ${stuckBatches.length} batches stuck in PROCESSING (heartbeat older than ${timeoutSeconds} seconds).`);

  if (stuckBatches.length === 0) {
    console.log("No stuck batches found. No recovery needed.");
    return;
  }

  for (const batch of stuckBatches) {
    console.log(`Batch ID: ${batch.id}`);
    console.log(`  Filename: ${batch.original_filename}`);
    console.log(`  Created At: ${batch.created_at}`);
    console.log(`  Total Records: ${batch.total_records}`);
    console.log("  Resetting status to FAILED...");

    await prisma.studentImport.update({
      where: { id: batch.id },
      data: { status: "FAILED" }
    });

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        action: "RECOVER_STUCK_IMPORT",
        entity_type: "StudentImport",
        entity_id: batch.id,
        description: `Stuck import batch ${batch.id} (${batch.original_filename}) recovered and set to FAILED status.`,
      }
    });

    console.log("  Batch reset to FAILED successfully.\n");
  }

  console.log("Recovery utility completed successfully.");
}

recoverStuckBatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
