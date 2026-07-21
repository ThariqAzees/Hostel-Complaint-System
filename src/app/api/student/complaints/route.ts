export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { uploadComplaintImage, deleteComplaintImage } from "@/lib/storage";

// Supported image MIME types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const studentUser = await getSessionUser();
  if (!studentUser || studentUser.role !== "STUDENT") {
    return NextResponse.json({ error: "Unauthorized. Student access required." }, { status: 401 });
  }

  let imageUrl: string | null = null;

  try {
    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as string;
    const imageFile = formData.get("image") as File | null;

    // Validate textual parameters
    if (!title || !description || !category) {
      return NextResponse.json({ error: "Title, Description, and Category are required." }, { status: 400 });
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim();

    const VALID_CATEGORIES = [
      "Electrical",
      "Plumbing",
      "Carpentry",
      "Wi-Fi",
      "Housekeeping",
      "Others"
    ];

    if (!VALID_CATEGORIES.includes(trimmedCategory)) {
      return NextResponse.json({ error: "Invalid complaint category selected." }, { status: 400 });
    }

    if (trimmedTitle.length < 5) {
      return NextResponse.json({ error: "Title must be at least 5 characters long." }, { status: 400 });
    }
    if (trimmedDescription.length < 15) {
      return NextResponse.json({ error: "Description must be at least 15 characters long." }, { status: 400 });
    }

    // Validate and upload image via storage abstraction
    if (imageFile && imageFile.size > 0) {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = imageFile.type.split("/")[1] || "jpeg";
      const secureFileName = `complaint-${crypto.randomUUID()}.${ext}`;

      try {
        imageUrl = await uploadComplaintImage(buffer, secureFileName, imageFile.type);
      } catch (uploadErr: any) {
        return NextResponse.json({ error: uploadErr.message || "Failed to upload image." }, { status: 400 });
      }
    }

    const currentYear = new Date().getFullYear();
    let complaintRecord: any = null;

    // Concurrency-safe optimistic insert transaction loop
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        complaintRecord = await prisma.$transaction(async (tx) => {
          // Count complaints in the current year to determine sequential suffix
          const count = await tx.complaint.count({
            where: {
              complaint_code: {
                startsWith: `MNT-${currentYear}-`,
              },
            },
          });

          // Pad sequence to 6 digits, e.g. MNT-2026-000001
          // We add attempts offset to resolve optimistic collisions on concurrent tries
          const sequentialNumber = String(count + attempts).padStart(6, "0");
          const generatedCode = `MNT-${currentYear}-${sequentialNumber}`;

          // Create the Complaint record
          const complaint = await tx.complaint.create({
            data: {
              complaint_code: generatedCode,
              student_id: studentUser.id,
              title: trimmedTitle,
              description: trimmedDescription,
              category: trimmedCategory,
              image_url: imageUrl,
              status: "SUBMITTED",
            },
          });

          // Create initial ComplaintUpdate timeline entry
          await tx.complaintUpdate.create({
            data: {
              complaint_id: complaint.id,
              updated_by_id: studentUser.id,
              previous_status: "SUBMITTED",
              new_status: "SUBMITTED",
              remarks: "Complaint submitted successfully.",
            },
          });

          // Create user notification
          await tx.notification.create({
            data: {
              user_id: studentUser.id,
              complaint_id: complaint.id,
              title: "Complaint Registered Successfully",
              message: `Your complaint ${generatedCode} has been logged in Room ${studentUser.room_number}.`,
            },
          });

          return complaint;
        });

        // Break loop on successful insert
        break;
      } catch (err: any) {
        // P2002 is the Prisma unique constraint violation code (duplicate key)
        if (err.code === "P2002" && attempts < maxAttempts) {
          console.warn(`Conflict on complaint code generation. Attempt ${attempts} failed. Retrying...`);
          continue;
        }
        throw err;
      }
    }

    if (!complaintRecord) {
      throw new Error("Optimistic lock failure during complaint code generation.");
    }

    // Write Audit Log
    await prisma.auditLog.create({
      data: {
        performed_by: studentUser.id,
        action: "CREATE_COMPLAINT",
        entity_type: "Complaint",
        entity_id: complaintRecord.id,
        description: `Student ${studentUser.name} submitted complaint ${complaintRecord.complaint_code} in Category: ${trimmedCategory}.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Complaint submitted successfully.",
      complaintCode: complaintRecord.complaint_code,
      id: complaintRecord.id,
    });
  } catch (err) {
    console.error("Submit complaint error:", err);

    // Compensating Cleanup: Delete uploaded blob if database transaction failed
    if (imageUrl) {
      try {
        await deleteComplaintImage(imageUrl);
      } catch (cleanupErr) {
        console.error("Compensating cleanup error while deleting orphaned blob:", cleanupErr);
      }
    }

    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
