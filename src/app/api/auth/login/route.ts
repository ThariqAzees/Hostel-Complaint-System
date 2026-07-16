import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signToken, setSessionCookie, validateCSRF } from "@/lib/auth";

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    // Try to find the user by registration_number (for students) or email (for admins/RCs)
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { registration_number: username },
          { email: username }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify active status
    if (!user.is_active) {
      return NextResponse.json({ error: "Your account is deactivated. Please contact the administrator." }, { status: 401 });
    }

    // Verify password hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Generate session token
    const token = await signToken({
      userId: user.id,
      role: user.role,
      registrationNumber: user.registration_number,
      tokenVersion: user.token_version,
      mustChangePassword: user.must_change_password,
    });

    // Set cookie
    await setSessionCookie(token);

    // Create Audit Log for successful login
    await prisma.auditLog.create({
      data: {
        performed_by: user.id,
        action: "LOGIN",
        entity_type: "User",
        entity_id: user.id,
        description: `User ${user.name} (${user.role}) logged in successfully.`,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        name: user.name,
        role: user.role,
        registrationNumber: user.registration_number,
        mustChangePassword: user.must_change_password,
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
