import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";

// Helper to parse dates from Excel formats (handles serial numbers and standard formats)
function parseExcelDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Convert Excel date serial number to JS Date
    // Excel base date is 1899-12-30 (due to Lotus 1-2-3 leap year bug)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    const parsedDate = new Date(trimmed);
    if (!isNaN(parsedDate.getTime())) return parsedDate;
    
    // Parse DD/MM/YYYY or DD-MM-YYYY formats
    const match = trimmed.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1;
      const year = parseInt(match[3]);
      return new Date(Date.UTC(year, month, day));
    }
  }
  return null;
}

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 5MB limit." }, { status: 400 });
    }

    // Validate file type (must be xlsx)
    const isXlsx = file.name.endsWith(".xlsx");
    if (!isXlsx) {
      return NextResponse.json({ error: "Unsupported file format. Please upload an .xlsx Excel file." }, { status: 400 });
    }

    // Parse Excel data
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(bytes), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON array of objects
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel sheet is empty." }, { status: 400 });
    }

    // Auto-recovery: transition any stale PROCESSING imports (heartbeat older than configured timeout) to FAILED
    const heartbeatTimeoutSeconds = Number(process.env.IMPORT_HEARTBEAT_TIMEOUT_SECONDS) || 120;
    const timeoutThreshold = new Date(Date.now() - heartbeatTimeoutSeconds * 1000);
    await prisma.studentImport.updateMany({
      where: {
        status: "PROCESSING",
        updated_at: { lt: timeoutThreshold },
      },
      data: {
        status: "FAILED",
      },
    });

    // Create a new StudentImport record as PENDING
    const studentImport = await prisma.studentImport.create({
      data: {
        uploaded_by: adminUser.id,
        original_filename: file.name,
        total_records: rows.length,
        successful_records: 0,
        failed_records: 0,
        status: "PENDING",
      },
    });

    const parsedRecords: any[] = [];
    const seenRegNumbers = new Set<string>();

    // Query all existing student registration numbers to check for database duplicates
    const allDbStudents = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { registration_number: true },
    });
    const dbRegNumbers = new Set(allDbStudents.map((u) => u.registration_number));

    // Validate and process each row
    for (const row of rows) {
      // Normalize columns (handle lowercase, uppercase, and trims)
      const regNoRaw = String(row.registration_number || row.Registration_Number || row.reg_no || "").trim();
      const nameRaw = String(row.student_name || row.Student_Name || row.name || "").trim();
      const dobRaw = row.date_of_birth || row.Date_of_Birth || row.dob;
      const roomRaw = String(row.room_number || row.Room_Number || row.room || "").trim();
      const emailRaw = String(row.email || "").trim();
      const phoneRaw = String(row.phone_number || row.phone || "").trim();

      let status = "VALID";
      let errorMessage: string | null = null;
      let dob: Date | null = null;

      // 1. Validation: check missing required fields
      if (!regNoRaw || !nameRaw || !dobRaw || !roomRaw) {
        status = "INVALID";
        const missing = [];
        if (!regNoRaw) missing.push("registration_number");
        if (!nameRaw) missing.push("student_name");
        if (!dobRaw) missing.push("date_of_birth");
        if (!roomRaw) missing.push("room_number");
        errorMessage = `Missing required fields: ${missing.join(", ")}`;
      }
      // 2. Validation: registration number format (10 digits)
      else if (!/^\d{10}$/.test(regNoRaw)) {
        status = "INVALID";
        errorMessage = "Registration Number must be exactly 10 digits.";
      }
      // 3. Validation: date format check
      else {
        dob = parseExcelDate(dobRaw);
        if (!dob || isNaN(dob.getTime())) {
          status = "INVALID";
          errorMessage = "Invalid Date of Birth format. Use DD/MM/YYYY or date cell.";
        }
      }

      // 4. Validation: duplicate check
      if (status === "VALID" && regNoRaw) {
        if (seenRegNumbers.has(regNoRaw)) {
          status = "DUPLICATE";
          errorMessage = "Duplicate Registration Number in upload file.";
        } else if (dbRegNumbers.has(regNoRaw)) {
          status = "DUPLICATE";
          errorMessage = "Registration Number already exists in database.";
        } else {
          seenRegNumbers.add(regNoRaw);
        }
      }

      parsedRecords.push({
        import_id: studentImport.id,
        registration_number: regNoRaw,
        name: nameRaw,
        date_of_birth: dob || new Date(0), // Fallback to epoch if invalid, but marked as INVALID/DUPLICATE
        email: emailRaw || null,
        phone_number: phoneRaw || null,
        room_number: roomRaw,
        status,
        error_message: errorMessage,
      });
    }

    // Save all parsed rows to ImportRecord table
    await prisma.importRecord.createMany({
      data: parsedRecords,
    });

    // Count successful vs failed
    const successfulCount = parsedRecords.filter((r) => r.status === "VALID").length;
    const failedCount = parsedRecords.length - successfulCount;

    // Update StudentImport summary counts
    await prisma.studentImport.update({
      where: { id: studentImport.id },
      data: {
        successful_records: successfulCount,
        failed_records: failedCount,
      },
    });

    // Return import batch info and records preview
    const records = await prisma.importRecord.findMany({
      where: { import_id: studentImport.id },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json({
      success: true,
      importBatch: {
        id: studentImport.id,
        filename: file.name,
        total: rows.length,
        valid: successfulCount,
        invalid: failedCount,
        created_at: studentImport.created_at,
      },
      records,
    });
  } catch (err) {
    console.error("Upload import error:", err);
    return NextResponse.json({ error: "An internal server error occurred while parsing the file." }, { status: 500 });
  }
}
