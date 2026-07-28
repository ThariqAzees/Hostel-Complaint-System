import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { deleteComplaintImage } from "@/lib/storage";

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
    // Verify complaint exists
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "This complaint has already been removed." }, { status: 404 });
    }

    // Safety Check: Only CLOSED complaints are eligible for deletion
    if (complaint.status !== "CLOSED") {
      return NextResponse.json(
        { error: "Complaint must be closed before permanent deletion." },
        { status: 409 }
      );
    }

    const imageUrl = complaint.image_url;

    // Run database deletion inside a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated timeline history updates
      await tx.complaintUpdate.deleteMany({
        where: { complaint_id: id },
      });

      // 2. Delete associated notifications
      await tx.notification.deleteMany({
        where: { complaint_id: id },
      });

      // 3. Delete associated audit log entries directly tied to this complaint
      await tx.auditLog.deleteMany({
        where: { entity_type: "Complaint", entity_id: id },
      });

      // 4. Delete the complaint record
      await tx.complaint.delete({
        where: { id },
      });

      // 5. Create persistent AuditLog (performed_by is the current Admin)
      await tx.auditLog.create({
        data: {
          performed_by: adminUser.id,
          action: "COMPLAINT_DELETED",
          entity_type: "Complaint",
          entity_id: complaint.complaint_code,
          description: `Complaint ${complaint.complaint_code} was permanently deleted by Admin.`,
        },
      });
    });

    // 5. Clean up image/blob attachment after successful DB transaction
    if (imageUrl) {
      try {
        await deleteComplaintImage(imageUrl);
      } catch (storageErr) {
        console.error("Storage cleanup failed for deleted complaint:", imageUrl, storageErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Complaint deleted successfully.",
    });
  } catch (err) {
    console.error("Delete complaint error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
