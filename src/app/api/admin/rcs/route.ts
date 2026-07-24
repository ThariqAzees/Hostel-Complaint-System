export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { Prisma } from "@/generated/prisma";

/**
 * GET: Fetch RC accounts with pagination, filtering, searching, and sorting
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

  const allowedSortFields = ["name", "email", "created_at"];
  const finalSortField = allowedSortFields.includes(sortField) ? sortField : "created_at";
  const finalSortOrder = sortOrder === "asc" ? "asc" : "desc";

  const offset = (page - 1) * limit;

  try {
    // Build query filters
    const whereClause: Prisma.UserWhereInput = {
      role: "RC",
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone_number: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "active") {
      whereClause.is_active = true;
    } else if (status === "inactive") {
      whereClause.is_active = false;
    }

    // Execute queries in transaction
    const [total, rcs] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          phone_number: true,
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
      rcs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Fetch RCs error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

/**
 * POST: Create an individual RC account
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
    const { name, email, password, phoneNumber } = await request.json();

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, Email, and Password are required." }, { status: 400 });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid Email format." }, { status: 400 });
    }

    // Enforce uniqueness validation in application code
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
    }

    // Hash initial password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create the RC user account
    const newRc = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone_number: phoneNumber || null,
        password_hash: passwordHash,
        role: "RC",
        must_change_password: true,
        is_active: true,
      },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        performed_by: adminUser.id,
        action: "RC_CREATED",
        entity_type: "User",
        entity_id: newRc.id,
        description: `Admin created RC account ${name} (${normalizedEmail}).`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "RC account created successfully.",
      rcId: newRc.id,
    });
  } catch (err) {
    console.error("Create RC error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
