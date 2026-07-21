export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { formatDobToPassword } from "@/lib/utils";

/**
 * GET: Fetch students with pagination, filtering, searching, and sorting
 */
export async function GET(request: Request) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all"; // all, active, inactive
  const sortField = searchParams.get("sortField") || "created_at";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  // Validate parameters
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 });
  }

  const allowedSortFields = ["registration_number", "name", "room_number", "created_at"];
  const finalSortField = allowedSortFields.includes(sortField) ? sortField : "created_at";
  const finalSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const offset = (page - 1) * limit;

  try {
    // Build query filters
    const whereClause: any = {
      role: "STUDENT",
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { registration_number: { contains: search, mode: "insensitive" } },
        { room_number: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "active") {
      whereClause.is_active = true;
    } else if (status === "inactive") {
      whereClause.is_active = false;
    }

    // Execute queries in transaction
    const [total, students] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          registration_number: true,
          name: true,
          date_of_birth: true,
          email: true,
          phone_number: true,
          room_number: true,
          must_change_password: true,
          is_active: true,
          created_at: true,
        },
        orderBy: {
          [finalSortField]: finalSortOrder,
        },
        skip: offset,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Fetch students error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

/**
 * POST: Create an individual student
 */
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
    const { registrationNumber, name, dateOfBirth, roomNumber, email, phoneNumber } = await request.json();

    // Validate required fields
    if (!registrationNumber || !name || !dateOfBirth || !roomNumber) {
      return NextResponse.json({ error: "Registration Number, Name, DOB, and Room Number are required." }, { status: 400 });
    }

    // Validate registration number matches 10 digits
    if (!/^\d{10}$/.test(registrationNumber)) {
      return NextResponse.json({ error: "Registration Number must be exactly 10 digits." }, { status: 400 });
    }

    // Validate date format
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Invalid Date of Birth format." }, { status: 400 });
    }

    // Check if registration number already exists in DB
    const existingUser = await prisma.user.findUnique({
      where: { registration_number: registrationNumber },
    });

    if (existingUser) {
      return NextResponse.json({ error: "Student with this Registration Number already exists." }, { status: 409 });
    }

    // Generate temporary password from DOB in DDMMYY format
    const tempPasswordStr = formatDobToPassword(dob);
    const tempPasswordHash = await bcrypt.hash(tempPasswordStr, 10);

    // Create the student user account
    const newStudent = await prisma.user.create({
      data: {
        registration_number: registrationNumber,
        name,
        date_of_birth: dob,
        room_number: roomNumber,
        email: email || null,
        phone_number: phoneNumber || null,
        password_hash: tempPasswordHash,
        role: "STUDENT",
        must_change_password: true,
        is_active: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        performed_by: adminUser.id,
        action: "CREATE_STUDENT",
        entity_type: "User",
        entity_id: newStudent.id,
        description: `Created student account for ${name} (${registrationNumber}) in Room ${roomNumber}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Student account created successfully.",
      studentId: newStudent.id,
    });
  } catch (err) {
    console.error("Create student error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
