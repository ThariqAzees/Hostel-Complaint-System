export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { downloadComplaintImage } from "@/lib/storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate user session
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized. Authentication required." }, { status: 401 });
  }

  const { id: complaintId } = await params;
  if (!complaintId) {
    return NextResponse.json({ error: "Complaint ID is required." }, { status: 400 });
  }

  try {
    // 2. Fetch complaint record from database by ID
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        student_id: true,
        image_url: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    if (!complaint.image_url) {
      return NextResponse.json({ error: "No image attached to this complaint." }, { status: 404 });
    }

    // 3. Strict Authorization Check:
    // - STUDENT: Can only view images for complaints they own (student_id === currentUser.id)
    // - RC & ADMIN: Authorized according to role-based access control
    const isOwner = currentUser.role === "STUDENT" && complaint.student_id === currentUser.id;
    const isStaff = currentUser.role === "RC" || currentUser.role === "ADMIN";

    if (!isOwner && !isStaff) {
      return NextResponse.json(
        { error: "Forbidden. You do not have permission to view this image." },
        { status: 403 }
      );
    }

    // 4. Securely stream image buffer using stored image_url from database
    const imageData = await downloadComplaintImage(complaint.image_url);
    if (!imageData) {
      return NextResponse.json({ error: "Failed to retrieve image content." }, { status: 404 });
    }

    // 5. Return image stream with safe headers
    return new NextResponse(new Uint8Array(imageData.buffer), {
      status: 200,
      headers: {
        "Content-Type": imageData.mimeType,
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Proxy complaint image error:", err);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}
