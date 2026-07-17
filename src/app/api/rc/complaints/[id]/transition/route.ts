import { NextResponse } from "next/server";
import { getSessionUser, validateCSRF } from "@/lib/auth";
import { transitionComplaint, TransitionAction } from "@/lib/state-machine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF validation
  if (!validateCSRF(request)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  const rcUser = await getSessionUser();
  if (!rcUser || rcUser.role !== "RC") {
    return NextResponse.json({ error: "Unauthorized. RC access required." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { action, remarks } = await request.json();

    if (!action) {
      return NextResponse.json({ error: "Transition action is required." }, { status: 400 });
    }

    // Limit actions allowed by RCs
    const allowedActions: TransitionAction[] = [
      "ACKNOWLEDGE",
      "RC_VERIFY_CLOSE",
    ];
    if (!allowedActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action for RC role." }, { status: 400 });
    }

    const updated = await transitionComplaint(id, action, rcUser.id, "RC", remarks);

    return NextResponse.json({
      success: true,
      message: "Complaint status updated successfully.",
      status: updated.status,
    });
  } catch (err: any) {
    console.error("RC transition error:", err);
    return NextResponse.json({ error: err.message || "An internal error occurred" }, { status: 400 });
  }
}
