export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.is_active) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const [notifications, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: "desc" },
        take: 20,
      }),
      prisma.notification.count({
        where: { user_id: user.id, is_read: false },
      }),
    ]);

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const user = await getSessionUser();
  if (!user || !user.is_active) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await request.json().catch(() => ({ id: undefined }));

    if (id) {
      // Mark a single notification as read
      // Verify notification belongs to the user
      const notif = await prisma.notification.findFirst({
        where: { id, user_id: user.id },
      });

      if (!notif) {
        return NextResponse.json({ error: "Notification not found." }, { status: 404 });
      }

      await prisma.notification.update({
        where: { id },
        data: { is_read: true },
      });
    } else {
      // Mark all user notifications as read
      await prisma.notification.updateMany({
        where: { user_id: user.id, is_read: false },
        data: { is_read: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Notifications updated successfully.",
    });
  } catch (err) {
    console.error("Update notifications error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
