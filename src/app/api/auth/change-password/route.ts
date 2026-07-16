import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionUser, signToken, setSessionCookie, validateCSRF } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/utils";

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { newPassword, confirmPassword } = await request.json();

    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    // Validate password strength
    if (!validatePasswordStrength(newPassword)) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update user in database (increment token_version to invalidate previous sessions)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: hashedNewPassword,
        must_change_password: false,
        token_version: { increment: 1 },
      },
    });

    // Generate new session token with updated tokenVersion and mustChangePassword = false
    const token = await signToken({
      userId: updatedUser.id,
      role: updatedUser.role,
      registrationNumber: updatedUser.registration_number,
      tokenVersion: updatedUser.token_version,
      mustChangePassword: false,
    });

    // Set new cookie
    await setSessionCookie(token);

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        performed_by: user.id,
        action: "CHANGE_PASSWORD",
        entity_type: "User",
        entity_id: user.id,
        description: `User ${user.name} changed their password. Session token updated.`,
      },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
