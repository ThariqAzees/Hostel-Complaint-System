import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { formatDobToPassword } from "@/lib/utils";

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
  }

  let importId: string | undefined = undefined;

  try {
    const body = await request.json();
    importId = body.importId;

    if (!importId) {
      return NextResponse.json({ error: "Import Batch ID is required." }, { status: 400 });
    }

    // Load configuration from environment variables
    const concurrencyLimit = Number(process.env.IMPORT_HASH_CONCURRENCY) || 8;
    const heartbeatTimeoutSeconds = Number(process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS) || 120;
    const heartbeatIntervalMs = (Number(process.env.IMPORT_HEARTBEAT_INTERVAL_SECONDS) || 10) * 1000;
    const hashRounds = Number(process.env.IMPORT_PASSWORD_HASH_ROUNDS) || 4;

    // Auto-recovery: If this specific batch is stuck in PROCESSING for more than heartbeatTimeoutSeconds, reset it to FAILED
    const timeoutThreshold = new Date(Date.now() - heartbeatTimeoutSeconds * 1000);
    const staleBatch = await prisma.studentImport.findFirst({
      where: {
        id: importId,
        status: "PROCESSING",
        updated_at: { lt: timeoutThreshold },
      },
    });

    if (staleBatch) {
      await prisma.studentImport.update({
        where: { id: importId },
        data: { status: "FAILED" },
      });
    }

    // Retrieve the import batch
    const importBatch = await prisma.studentImport.findUnique({
      where: { id: importId },
    });

    if (!importBatch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    if (importBatch.status !== "PENDING" && importBatch.status !== "FAILED") {
      return NextResponse.json(
        { error: `This batch has already been processed. Current status: ${importBatch.status}` },
        { status: 400 }
      );
    }

    // Set batch status to PROCESSING to prevent concurrent confirmation triggers
    await prisma.studentImport.update({
      where: { id: importId },
      data: { status: "PROCESSING" },
    });

    // Query valid records to insert
    const validRecords = await prisma.importRecord.findMany({
      where: {
        import_id: importId,
        status: "VALID",
      },
    });

    if (validRecords.length === 0) {
      // Mark as CONFIRMED since there's nothing to process (or fail)
      await prisma.studentImport.update({
        where: { id: importId },
        data: { status: "CONFIRMED", successful_records: 0 },
      });

      return NextResponse.json({
        success: true,
        message: "No valid records to import.",
        importedCount: 0,
      });
    }

    let importedCount = 0;
    const errors: string[] = [];

    // Retrieve all student registration numbers to avoid insert conflicts
    const allDbStudents = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { registration_number: true },
    });
    const dbRegNumbers = new Set(allDbStudents.map((u) => u.registration_number));

    // Filter out duplicates and prepare records for hashing
    const recordsToHash: typeof validRecords = [];
    for (const record of validRecords) {
      if (dbRegNumbers.has(record.registration_number)) {
        errors.push(`Registration Number ${record.registration_number} was created recently by another process.`);
        continue;
      }
      recordsToHash.push(record);
      dbRegNumbers.add(record.registration_number); // Add to set to prevent duplicates within the same batch
    }

    let lastHeartbeatTime = Date.now();
    let isHeartbeatUpdating = false;

    // Hash passwords in parallel with bounded concurrency outside database transaction
    const hashedRecords = await mapWithConcurrency(
      recordsToHash,
      async (record) => {
        const tempPasswordStr = formatDobToPassword(record.date_of_birth);
        const tempPasswordHash = await bcrypt.hash(tempPasswordStr, hashRounds);

        // Update heartbeat if heartbeatIntervalMs has elapsed and no update is currently in progress
        if (Date.now() - lastHeartbeatTime >= heartbeatIntervalMs && !isHeartbeatUpdating) {
          isHeartbeatUpdating = true;
          try {
            await prisma.studentImport.update({
              where: { id: importId },
              data: { status: "PROCESSING" }, // Updates updated_at column to default(now)
            });
            lastHeartbeatTime = Date.now();
          } catch (e) {
            console.error("Failed to update import heartbeat:", e);
          } finally {
            isHeartbeatUpdating = false;
          }
        }

        return {
          record,
          tempPasswordHash,
        };
      },
      concurrencyLimit
    );

    // Process insertions in transaction/batch (database writes only, extremely fast)
    await prisma.$transaction(async (tx) => {
      for (const item of hashedRecords) {
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

    // Update import batch details to CONFIRMED
    const failedCount = importBatch.total_records - importedCount;
    await prisma.studentImport.update({
      where: { id: importId },
      data: {
        status: "CONFIRMED",
        successful_records: importedCount,
        failed_records: failedCount,
      },
    });

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        performed_by: adminUser.id,
        action: "IMPORT_STUDENTS",
        entity_type: "StudentImport",
        entity_id: importId,
        description: `Successfully imported ${importedCount} student accounts from Excel file (${importBatch.original_filename}).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${importedCount} student accounts.`,
      importedCount,
      failedCount,
      errors,
    });
  } catch (err) {
    console.error("Confirm import error:", err);
    
    if (importId) {
      try {
        await prisma.studentImport.update({
          where: { id: importId },
          data: { status: "FAILED" },
        });
      } catch (e) {
        console.error("Failed to update status to FAILED:", e);
      }
    }

    return NextResponse.json({ error: "An error occurred during database insertion." }, { status: 500 });
  }
}

/**
 * Maps items asynchronously using a bounded concurrency pool.
 */
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
