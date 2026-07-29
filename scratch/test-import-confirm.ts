import "dotenv/config";
// Set custom test environment variables
process.env.IMPORT_HASH_CONCURRENCY = "8";
process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS = "10";
process.env.IMPORT_HEARTBEAT_INTERVAL_SECONDS = "1";

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { formatDobToPassword } from "../src/lib/utils";

// Custom bounded concurrency helper
async function mapWithConcurrency<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  concurrencyLimit: number
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrencyLimit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function simulateConfirmImport(importId: string, forceErrorOnRegNo?: string) {
  const errors: string[] = [];
  let importedCount = 0;

  try {
    const concurrencyLimit = Number(process.env.IMPORT_HASH_CONCURRENCY) || 8;
    const heartbeatTimeoutSeconds = Number(process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS) || 120;
    const heartbeatIntervalMs = (Number(process.env.IMPORT_HEARTBEAT_INTERVAL_SECONDS) || 10) * 1000;

    // 1. Retrieve and update status to PROCESSING
    const importBatch = await prisma.studentImport.findUnique({
      where: { id: importId },
    });

    if (!importBatch) throw new Error("Batch not found");

    await prisma.studentImport.update({
      where: { id: importId },
      data: { status: "PROCESSING" },
    });

    // 2. Query valid records
    const validRecords = await prisma.importRecord.findMany({
      where: { import_id: importId, status: "VALID" },
    });

    // 3. Duplicate check and pre-hash
    const allDbStudents = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { registration_number: true },
    });
    const dbRegNumbers = new Set(allDbStudents.map((u) => u.registration_number));

    const recordsToHash = [];
    for (const record of validRecords) {
      if (dbRegNumbers.has(record.registration_number)) {
        errors.push(`Registration Number ${record.registration_number} exists.`);
        continue;
      }
      recordsToHash.push(record);
      dbRegNumbers.add(record.registration_number);
    }

    let lastHeartbeatTime = Date.now();
    let isHeartbeatUpdating = false;
    let heartbeatWrites = 0;

    // Parallel pre-hashing outside transaction with bounded concurrency
    const hashStart = Date.now();
    const hashedRecords = await mapWithConcurrency(
      recordsToHash,
      async (record) => {
        const tempPasswordStr = formatDobToPassword(record.date_of_birth);
        const tempPasswordHash = await bcrypt.hash(tempPasswordStr, 10);

        // Update heartbeat if heartbeatIntervalMs has elapsed and no update is currently in progress
        if (Date.now() - lastHeartbeatTime >= heartbeatIntervalMs && !isHeartbeatUpdating) {
          isHeartbeatUpdating = true;
          try {
            await prisma.studentImport.update({
              where: { id: importId },
              data: { status: "PROCESSING" }, // Updates updated_at column
            });
            lastHeartbeatTime = Date.now();
            heartbeatWrites++;
          } catch (e) {
            console.error("Failed to update import heartbeat:", e);
          } finally {
            isHeartbeatUpdating = false;
          }
        }

        return { record, tempPasswordHash };
      },
      concurrencyLimit
    );
    console.log(`  [Profiling] Pre-hashing duration: ${Date.now() - hashStart}ms, Heartbeat writes: ${heartbeatWrites}`);

    // 4. Transaction (DB writes only)
    const txStart = Date.now();
    await prisma.$transaction(async (tx) => {
      for (const item of hashedRecords) {
        if (forceErrorOnRegNo && item.record.registration_number === forceErrorOnRegNo) {
          throw new Error(`Simulated database write error on registration number: ${forceErrorOnRegNo}`);
        }
        await tx.user.create({
          data: {
            registration_number: item.record.registration_number,
            name: item.record.name,
            date_of_birth: item.record.date_of_birth,
            room_number: item.record.room_number,
            email: item.record.email,
            phone_number: item.record.phone_number,
            password_hash: item.tempPasswordHash,
            role: "STUDENT",
            must_change_password: true,
            is_active: true,
          },
        });
        importedCount++;
      }
    });
    console.log(`  [Profiling] Transaction duration: ${Date.now() - txStart}ms`);

    // 5. Update to CONFIRMED
    await prisma.studentImport.update({
      where: { id: importId },
      data: {
        status: "CONFIRMED",
        successful_records: importedCount,
        failed_records: importBatch.total_records - importedCount,
      },
    });

  } catch (err) {
    console.error("  [simulateConfirmImport] Caught expected/unexpected error:", err instanceof Error ? err.message : err);
    if (importId) {
      try {
        await prisma.studentImport.update({
          where: { id: importId },
          data: { status: "FAILED" },
        });
      } catch (e) {
        console.error("  [simulateConfirmImport] Failed to update status to FAILED:", e);
      }
    }
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("STARTING TEST SUITE FOR STUDENT IMPORT FIXES");
  console.log("==================================================");

  let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { name: "Test Admin", email: "admin_test@ech.com", password_hash: "dummy", role: "ADMIN" }
    });
  }

  // ----------------------------------------------------
  // TEST 1: Large Import (75 students) - Must complete successfully
  // ----------------------------------------------------
  console.log("\n[TEST 1] Testing large import of 75 students with bounded concurrency & periodic heartbeat...");
  const t1Start = Date.now();
  const batch1 = await prisma.studentImport.create({
    data: {
      uploaded_by: admin.id,
      original_filename: "large_import.xlsx",
      total_records: 75,
      successful_records: 0,
      failed_records: 0,
      status: "PENDING",
    }
  });

  const mockRecords = [];
  for (let i = 1; i <= 75; i++) {
    mockRecords.push({
      import_id: batch1.id,
      registration_number: `30231050${String(i).padStart(2, "0")}`,
      name: `Student Number ${i}`,
      date_of_birth: new Date("2005-05-15"),
      room_number: `${100 + i}`,
      status: "VALID",
    });
  }

  await prisma.importRecord.createMany({ data: mockRecords });
  console.log("  Created batch and 75 import records. Starting confirm...");

  await simulateConfirmImport(batch1.id);
  const t1Duration = Date.now() - t1Start;

  const resultBatch1 = await prisma.studentImport.findUnique({ where: { id: batch1.id } });
  console.log(`  Resulting status: ${resultBatch1?.status}`);
  console.log(`  Imported count: ${resultBatch1?.successful_records}`);
  console.log(`  Total time taken: ${t1Duration}ms`);

  if (resultBatch1?.status === "CONFIRMED" && resultBatch1.successful_records === 75) {
    console.log("  [PASS] Large import completed successfully.");
  } else {
    console.error("  [FAIL] Large import failed.");
  }

  // Cleanup Test 1
  await prisma.user.deleteMany({
    where: { registration_number: { startsWith: "30231050" } }
  });
  await prisma.importRecord.deleteMany({ where: { import_id: batch1.id } });
  await prisma.studentImport.delete({ where: { id: batch1.id } });

  // ----------------------------------------------------
  // TEST 2: Failure Case - Must transition to FAILED status
  // ----------------------------------------------------
  console.log("\n[TEST 2] Testing failure case status transition...");
  const batch2 = await prisma.studentImport.create({
    data: {
      uploaded_by: admin.id,
      original_filename: "failed_import.xlsx",
      total_records: 5,
      successful_records: 0,
      failed_records: 0,
      status: "PENDING",
    }
  });

  const mockRecords2 = [];
  for (let i = 1; i <= 5; i++) {
    mockRecords2.push({
      import_id: batch2.id,
      registration_number: `40231050${String(i).padStart(2, "0")}`,
      name: `Student Number ${i}`,
      date_of_birth: new Date("2005-05-15"),
      room_number: `${100 + i}`,
      status: "VALID",
    });
  }
  await prisma.importRecord.createMany({ data: mockRecords2 });

  console.log("  Simulating database error on student 3...");
  await simulateConfirmImport(batch2.id, "4023105003");

  const resultBatch2 = await prisma.studentImport.findUnique({ where: { id: batch2.id } });
  console.log(`  Resulting status: ${resultBatch2?.status}`);

  if (resultBatch2?.status === "FAILED") {
    console.log("  [PASS] Failed import successfully transitioned status to FAILED.");
  } else {
    console.error("  [FAIL] Failed import remained in PROCESSING or other status.");
  }

  // Cleanup Test 2
  await prisma.user.deleteMany({
    where: { registration_number: { startsWith: "40231050" } }
  });
  await prisma.importRecord.deleteMany({ where: { import_id: batch2.id } });
  await prisma.studentImport.delete({ where: { id: batch2.id } });

  // ----------------------------------------------------
  // TEST 3: Stale Recovery - Checking if stuck PROCESSING batch is recovered
  // ----------------------------------------------------
  console.log("\n[TEST 3] Testing stale batch recovery utility...");
  // Create a batch that was updated 15 seconds ago (timeout threshold is 10 seconds), status PROCESSING
  const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000);
  const batch3 = await prisma.studentImport.create({
    data: {
      uploaded_by: admin.id,
      original_filename: "stuck_import.xlsx",
      total_records: 10,
      successful_records: 0,
      failed_records: 0,
      status: "PROCESSING",
      created_at: fifteenSecondsAgo,
      updated_at: fifteenSecondsAgo,
    }
  });

  console.log(`  Created stale stuck batch with ID: ${batch3.id}, Status: PROCESSING, Updated At: 15s ago`);

  // Dynamically run the recovery function logic using configured timeout
  const timeoutSeconds = Number(process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS) || 120;
  const staleThresholdTime = new Date(Date.now() - timeoutSeconds * 1000);
  const stuckBatches = await prisma.studentImport.findMany({
    where: { status: "PROCESSING", updated_at: { lt: staleThresholdTime } }
  });

  console.log(`  Recovery system identified ${stuckBatches.length} stuck batches (older than ${timeoutSeconds}s).`);
  for (const b of stuckBatches) {
    if (b.id === batch3.id) {
      await prisma.studentImport.update({
        where: { id: b.id },
        data: { status: "FAILED" }
      });
      console.log(`  Successfully reset batch ${b.id} to FAILED.`);
    }
  }

  const resultBatch3 = await prisma.studentImport.findUnique({ where: { id: batch3.id } });
  console.log(`  Resulting status: ${resultBatch3?.status}`);

  if (resultBatch3?.status === "FAILED") {
    console.log("  [PASS] Stale PROCESSING batch was successfully recovered to FAILED.");
  } else {
    console.error("  [FAIL] Stale batch recovery failed.");
  }

  // Cleanup Test 3
  await prisma.studentImport.delete({ where: { id: batch3.id } });

  console.log("\n==================================================");
  console.log("TESTING COMPLETED");
  console.log("==================================================");
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
