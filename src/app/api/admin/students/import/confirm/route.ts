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

  let importId: string | null = null;

  try {
    const body = await request.json();
    importId = body.importId;

    if (!importId) {
      return NextResponse.json({ error: "Import Batch ID is required." }, { status: 400 });
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

    // Process insertions in transaction/batch
    await prisma.$transaction(async (tx) => {
      for (const record of validRecords) {
        // Double check database duplicates right before inserting
        if (dbRegNumbers.has(record.registration_number)) {
          errors.push(`Registration Number ${record.registration_number} was created recently by another process.`);
          continue;
        }

        // Generate temporary DOB-based password
        const tempPasswordStr = formatDobToPassword(record.date_of_birth);
        const tempPasswordHash = await bcrypt.hash(tempPasswordStr, 10);

        // Create student account
        await tx.user.create({
          data: {
            registration_number: record.registration_number,
            name: record.name,
            date_of_birth: record.date_of_birth,
            room_number: record.room_number,
            email: record.email,
            phone_number: record.phone_number,
            password_hash: tempPasswordHash,
            role: "STUDENT",
            must_change_password: true,
            is_active: true,
          },
        });

        importedCount++;
        dbRegNumbers.add(record.registration_number); // Add to local set to prevent duplicates in same batch
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
