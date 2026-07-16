import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { formatDobToPassword } from "@/lib/utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { action, name, roomNumber, email, phoneNumber, isActive } = await request.json();

    // Verify student exists
    const student = await prisma.user.findFirst({
      where: { id, role: "STUDENT" },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    if (action === "update_details") {
      if (!name || !roomNumber) {
        return NextResponse.json({ error: "Name and Room Number are required." }, { status: 400 });
      }

      // Update student details
      const updatedStudent = await prisma.user.update({
        where: { id },
        data: {
          name,
          room_number: roomNumber,
          email: email || null,
          phone_number: phoneNumber || null,
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "UPDATE_STUDENT",
          entity_type: "User",
          entity_id: student.id,
          description: `Updated details for student ${student.name} (${student.registration_number}). Changed Room to ${roomNumber}.`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Student details updated successfully.",
      });
    }

    if (action === "toggle_active") {
      if (isActive === undefined) {
        return NextResponse.json({ error: "Active status parameter (isActive) is required." }, { status: 400 });
      }

      // Update active status. If deactivating, increment token_version to invalidate sessions
      const updatedStudent = await prisma.user.update({
        where: { id },
        data: {
          is_active: isActive,
          token_version: isActive ? undefined : { increment: 1 },
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: isActive ? "ACTIVATE_STUDENT" : "DEACTIVATE_STUDENT",
          entity_type: "User",
          entity_id: student.id,
          description: `${isActive ? "Activated" : "Deactivated"} student account for ${student.name} (${student.registration_number}).`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Student account ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    }

    if (action === "reset_password") {
      if (!student.date_of_birth) {
        return NextResponse.json({ error: "Cannot reset password. Student Date of Birth is missing." }, { status: 400 });
      }

      // Generate temporary password from DOB in DDMMYY format
      const tempPasswordStr = formatDobToPassword(student.date_of_birth);
      const tempPasswordHash = await bcrypt.hash(tempPasswordStr, 10);

      // Reset password, force password change, and increment token_version to invalidate existing sessions
      await prisma.user.update({
        where: { id },
        data: {
          password_hash: tempPasswordHash,
          must_change_password: true,
          token_version: { increment: 1 },
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "RESET_PASSWORD",
          entity_type: "User",
          entity_id: student.id,
          description: `Reset password for student ${student.name} (${student.registration_number}) to temporary DOB format. Session revoked.`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Student password reset to temporary DOB format successfully. Existing sessions revoked.",
      });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (err) {
    console.error("Modify student error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
