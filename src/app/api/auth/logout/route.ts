import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, clearSessionCookie, validateCSRF } from "@/lib/auth";

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  try {
    const user = await getSessionUser();
    if (user) {
      // Invalidate the session on the backend by incrementing token_version
      await prisma.user.update({
        where: { id: user.id },
        data: { token_version: { increment: 1 } },
      });

      // Log the logout action
      await prisma.auditLog.create({
        data: {
          performed_by: user.id,
          action: "LOGOUT",
          entity_type: "User",
          entity_id: user.id,
          description: `User ${user.name} logged out. Session invalidated.`,
        },
      });
    }

    // Clear the HttpOnly session cookie
    await clearSessionCookie();

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await clearSessionCookie();
  } catch (err) {
    console.error("Logout GET error:", err);
  }
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirect") || "/login";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
