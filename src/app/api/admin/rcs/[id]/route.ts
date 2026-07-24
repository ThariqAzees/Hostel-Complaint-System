import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";

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
    const { action, name, email, phoneNumber, isActive, password } = await request.json();

    // Verify RC exists
    const rc = await prisma.user.findFirst({
      where: { id, role: "RC" },
    });

    if (!rc) {
      return NextResponse.json({ error: "RC account not found." }, { status: 404 });
    }

    if (action === "update_details") {
      if (!name || !email) {
        return NextResponse.json({ error: "Name and Email are required." }, { status: 400 });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Basic email format check
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ error: "Invalid Email format." }, { status: 400 });
      }

      // Check email uniqueness
      const emailConflict = await prisma.user.findFirst({
        where: { email: normalizedEmail, id: { not: id } },
      });

      if (emailConflict) {
        return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
      }

      // Update RC details
      await prisma.user.update({
        where: { id },
        data: {
          name,
          email: normalizedEmail,
          phone_number: phoneNumber || null,
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "RC_UPDATED",
          entity_type: "User",
          entity_id: rc.id,
          description: `Admin updated details for RC ${name} (${normalizedEmail}).`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "RC details updated successfully.",
      });
    }

    if (action === "toggle_active") {
      if (isActive === undefined) {
        return NextResponse.json({ error: "Active status parameter (isActive) is required." }, { status: 400 });
      }

      // Safety check: prevent deactivating the last active RC
      if (!isActive) {
        const activeRcsCount = await prisma.user.count({
          where: { role: "RC", is_active: true },
        });

        // If the RC we are deactivating is currently active, and count is <= 1, block it
        if (rc.is_active && activeRcsCount <= 1) {
          return NextResponse.json({ error: "Cannot deactivate the last active RC account. The hostel block needs at least one active RC." }, { status: 400 });
        }
      }

      // Update active status. If deactivating, increment token_version to invalidate sessions
      await prisma.user.update({
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
          action: isActive ? "RC_ACTIVATED" : "RC_DEACTIVATED",
          entity_type: "User",
          entity_id: rc.id,
          description: `Admin ${isActive ? "activated" : "deactivated"} RC account for ${rc.name} (${rc.email}).`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `RC account ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    }

    if (action === "reset_password") {
      if (!password || password.trim().length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Reset password, force password change, and increment token_version to invalidate existing sessions
      await prisma.user.update({
        where: { id },
        data: {
          password_hash: passwordHash,
          must_change_password: true,
          token_version: { increment: 1 },
        },
      });

      // Write Audit Log
      await prisma.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "RC_PASSWORD_RESET",
          entity_type: "User",
          entity_id: rc.id,
          description: `Admin reset password for RC ${rc.name} (${rc.email}). Session revoked.`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "RC password reset successfully. Existing sessions revoked.",
      });
    }

    return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
  } catch (err) {
    console.error("Modify RC error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const adminUser = await getSessionUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthenticated. Admin access required." }, { status: 401 });
  }
  if (adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
  }

  const { id } = await params;

  try {
    // Verify RC exists and is indeed an RC
    const rc = await prisma.user.findFirst({
      where: { id, role: "RC" },
    });

    if (!rc) {
      return NextResponse.json({ error: "RC account not found." }, { status: 404 });
    }

    // Safety check: Block if RC has any historical complaint update records
    const updatesCount = await prisma.complaintUpdate.count({
      where: { updated_by_id: id },
    });

    if (updatesCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete this RC because they have historical complaint activity. Please deactivate their account instead to preserve historical records." },
        { status: 409 }
      );
    }

    // Secondary safety check: check for student imports upload activity (unlikely for RC but good for defense-in-depth)
    const importsCount = await prisma.studentImport.count({
      where: { uploaded_by: id },
    });

    if (importsCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete this RC because they have historical upload activity. Please deactivate their account instead." },
        { status: 409 }
      );
    }

    // Execute deletion transaction
    await prisma.$transaction(async (tx) => {
      // Delete notifications related to the RC
      await tx.notification.deleteMany({
        where: { user_id: id },
      });

      // Delete the RC user record
      await tx.user.delete({
        where: { id },
      });

      // Write deletion Audit Log
      await tx.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "RC_DELETED",
          entity_type: "User",
          entity_id: rc.id,
          description: `Admin permanently deleted RC account ${rc.name} (${rc.email}).`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "RC account deleted successfully.",
    });
  } catch (err) {
    console.error("Delete RC error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
