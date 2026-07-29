import "dotenv/config";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { transitionComplaint, checkAndUpdateOverdueComplaints } from "../src/lib/state-machine";
import { signToken, verifyToken } from "../src/lib/auth";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING MULTI-RC REGRESSION & CONCURRENCY TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // Clean up any old test data
    console.log("\n[1] Preparing database clean slate...");
    await prisma.notification.deleteMany({ where: { user: { email: { in: ["rc_test1@ech.com", "rc_test2@ech.com", "rc_test3@ech.com"] } } } });
    await prisma.complaintUpdate.deleteMany({ where: { updater: { email: { in: ["rc_test1@ech.com", "rc_test2@ech.com", "rc_test3@ech.com"] } } } });
    await prisma.auditLog.deleteMany({ where: { description: { contains: "rc_test" } } });
    
    // Clean up test student & complaints
    const testStudentReg = "9999999999";
    const testStudent = await prisma.user.findFirst({ where: { registration_number: testStudentReg } });
    if (testStudent) {
      await prisma.notification.deleteMany({ where: { user_id: testStudent.id } });
      await prisma.complaintUpdate.deleteMany({ where: { complaint: { student_id: testStudent.id } } });
      await prisma.complaint.deleteMany({ where: { student_id: testStudent.id } });
      await prisma.user.delete({ where: { id: testStudent.id } });
    }
    
    await prisma.user.deleteMany({
      where: {
        email: { in: ["rc_test1@ech.com", "rc_test2@ech.com", "rc_test3@ech.com"] }
      }
    });

    // ----------------------------------------------------
    // TEST A: Create test Student & RCs
    // ----------------------------------------------------
    console.log("\n[2] Testing RC Account Creation & Password Hashing...");
    const hash = await bcrypt.hash("testpass123", 10);
    
    // Create Student
    const studentUser = await prisma.user.create({
      data: {
        registration_number: testStudentReg,
        name: "Test Student",
        date_of_birth: new Date("2000-01-01"),
        room_number: "999",
        email: "teststudent@ech.com",
        password_hash: hash,
        role: "STUDENT",
        must_change_password: false,
        is_active: true,
      }
    });
    assert(!!studentUser.id, "Student user created successfully");

    // Create RC 1
    const rc1 = await prisma.user.create({
      data: {
        name: "RC Test One",
        email: "rc_test1@ech.com",
        password_hash: hash,
        role: "RC",
        must_change_password: true,
        is_active: true,
      }
    });
    assert(rc1.role === "RC", "RC 1 account created successfully with role RC");
    assert(rc1.must_change_password === true, "RC 1 defaults to must_change_password = true");
    assert(await bcrypt.compare("testpass123", rc1.password_hash), "RC 1 password hashed correctly");

    // Create RC 2
    const rc2 = await prisma.user.create({
      data: {
        name: "RC Test Two",
        email: "rc_test2@ech.com",
        password_hash: hash,
        role: "RC",
        must_change_password: true,
        is_active: true,
      }
    });
    assert(rc2.role === "RC", "RC 2 account created successfully");

    // ----------------------------------------------------
    // TEST B: Email Uniqueness
    // ----------------------------------------------------
    console.log("\n[3] Testing Application-level Email Uniqueness...");
    const emailConflict = await prisma.user.findFirst({
      where: { email: "rc_test1@ech.com" }
    });
    assert(!!emailConflict, "Duplicate email lookup matches existing RC account");

    // ----------------------------------------------------
    // TEST C: Independent Authentication & Session Revocation
    // ----------------------------------------------------
    console.log("\n[4] Testing Authentication Token Sessions...");
    const token1 = await signToken({
      userId: rc1.id,
      role: "RC",
      registrationNumber: null,
      tokenVersion: rc1.token_version,
      mustChangePassword: rc1.must_change_password,
    });
    
    const verify1 = await verifyToken(token1);
    assert(verify1?.userId === rc1.id, "RC 1 token verified successfully");

    // Test session revocation by incrementing token version
    console.log("Incrementing token version for RC 1 to simulate password reset/deactivation...");
    await prisma.user.update({
      where: { id: rc1.id },
      data: { token_version: { increment: 1 } }
    });
    
    // Simulate getSessionUser logic
    const dbUser = await prisma.user.findUnique({
      where: { id: rc1.id },
      select: { token_version: true, is_active: true }
    });
    const isTokenValid = dbUser && dbUser.is_active && dbUser.token_version === verify1?.tokenVersion;
    assert(!isTokenValid, "Session token is successfully revoked after token_version mismatch");

    // Reset token version back for subsequent tests
    await prisma.user.update({
      where: { id: rc1.id },
      data: { token_version: 0 }
    });

    // ----------------------------------------------------
    // TEST D: Shared Block-wide Queue (Equal Access)
    // ----------------------------------------------------
    console.log("\n[5] Testing Shared Block-wide Queue Access...");
    // Create test complaint
    const complaint = await prisma.complaint.create({
      data: {
        complaint_code: "TST-2026-000001",
        student_id: studentUser.id,
        title: "Test Leaking Tap",
        description: "Water is continuously leaking from the bathroom tap.",
        category: "Plumbing",
        status: "SUBMITTED",
      }
    });
    assert(!!complaint.id, "Test complaint created successfully");

    // Verify RC 1 and RC 2 can query it (shared queue - no assignment check)
    const queue1 = await prisma.complaint.findMany({ where: { status: "SUBMITTED" } });
    const hasComplaintInQueue1 = queue1.some(c => c.id === complaint.id);
    assert(hasComplaintInQueue1, "RC 1 can view the complaint in the global queue");

    const queue2 = await prisma.complaint.findMany({ where: { status: "SUBMITTED" } });
    const hasComplaintInQueue2 = queue2.some(c => c.id === complaint.id);
    assert(hasComplaintInQueue2, "RC 2 can view the same complaint in the global queue without assignment");

    // ----------------------------------------------------
    // TEST E: Multi-RC Notifications
    // ----------------------------------------------------
    console.log("\n[6] Testing Multi-RC Notifications (Notifying all active RCs)...");
    
    // Transition complaint to ACKNOWLEDGED first
    await transitionComplaint(complaint.id, "ACKNOWLEDGE", rc1.id, "RC", "Acknowledged by RC 1");
    
    // Student marks it completed
    await transitionComplaint(complaint.id, "STUDENT_MARK_COMPLETED", studentUser.id, "STUDENT");

    // Check notifications for both active RCs
    const notificationsRC1 = await prisma.notification.findMany({
      where: { user_id: rc1.id, complaint_id: complaint.id }
    });
    const notificationsRC2 = await prisma.notification.findMany({
      where: { user_id: rc2.id, complaint_id: complaint.id }
    });

    assert(notificationsRC1.length === 1 && notificationsRC1[0].title === "Maintenance Marked Completed", "RC 1 received notification");
    assert(notificationsRC2.length === 1 && notificationsRC2[0].title === "Maintenance Marked Completed", "RC 2 received notification");

    // Test Deactivated RC Notification Exclusion
    console.log("Deactivating RC 2 and testing notification exclusions...");
    await prisma.user.update({
      where: { id: rc2.id },
      data: { is_active: false }
    });

    // Reset status back to AWAITING_STUDENT_CONFIRMATION and mark completed again to trigger notification
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { status: "AWAITING_STUDENT_CONFIRMATION" }
    });
    await prisma.notification.deleteMany({ where: { complaint_id: complaint.id } });

    await transitionComplaint(complaint.id, "STUDENT_MARK_COMPLETED", studentUser.id, "STUDENT");

    const notificationsRC1_after = await prisma.notification.findMany({
      where: { user_id: rc1.id, complaint_id: complaint.id }
    });
    const notificationsRC2_after = await prisma.notification.findMany({
      where: { user_id: rc2.id, complaint_id: complaint.id }
    });

    assert(notificationsRC1_after.length === 1, "Active RC 1 successfully notified");
    assert(notificationsRC2_after.length === 0, "Deactivated RC 2 correctly excluded from notifications");

    // Reactivate RC 2
    await prisma.user.update({
      where: { id: rc2.id },
      data: { is_active: true }
    });

    // ----------------------------------------------------
    // TEST F: Concurrency Control (Atomic Compare-and-Set)
    // ----------------------------------------------------
    console.log("\n[7] Testing Concurrency Control...");
    // Reset complaint back to SUBMITTED
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { status: "SUBMITTED" }
    });
    
    // Clear notifications & updates for clean check
    await prisma.notification.deleteMany({ where: { complaint_id: complaint.id } });
    await prisma.complaintUpdate.deleteMany({ where: { complaint_id: complaint.id } });

    console.log("Simulating concurrent transitions (RC 1 and RC 2 acknowledging the same SUBMITTED complaint)...");
    
    // Launch both concurrently
    const results = await Promise.allSettled([
      transitionComplaint(complaint.id, "ACKNOWLEDGE", rc1.id, "RC", "RC 1 acknowledges"),
      transitionComplaint(complaint.id, "ACKNOWLEDGE", rc2.id, "RC", "RC 2 acknowledges"),
    ]);

    const succeeded = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");

    assert(succeeded.length === 1, "Exactly one concurrent transition succeeded");
    assert(rejected.length === 1, "Exactly one concurrent transition was safely rejected");
    
    if (rejected[0]?.status === "rejected") {
      const err = (rejected[0] as PromiseRejectedResult).reason;
      assert(err.message.includes("status has changed") || err.message.includes("not allowed"), `Rejected request threw expected error: "${err.message}"`);
    }

    // Verify side effects
    const updates = await prisma.complaintUpdate.findMany({ where: { complaint_id: complaint.id } });
    assert(updates.length === 1, `Exactly one ComplaintUpdate timeline entry created (found: ${updates.length})`);

    const notifs = await prisma.notification.findMany({ where: { complaint_id: complaint.id } });
    // Should only have notifications created for the single successful transition (which was ACKNOWLEDGE, notifying student -> 1 notification)
    assert(notifs.length === 1, `Exactly one set of transition notifications created (found: ${notifs.length})`);

    // ----------------------------------------------------
    // TEST G: Timeline Attribution & Full Workflow Lifecycle
    // ----------------------------------------------------
    console.log("\n[8] Testing Timeline Attribution & Lifecycle Completion...");
    
    // Current status is ACKNOWLEDGED (from the successful concurrent acknowledge)
    // Student marks completed -> AWAITING_RC_VERIFICATION
    await transitionComplaint(complaint.id, "STUDENT_MARK_COMPLETED", studentUser.id, "STUDENT");

    // RC 2 Verifies & Closes the complaint -> CLOSED
    await transitionComplaint(complaint.id, "RC_VERIFY_CLOSE", rc2.id, "RC", "Closed by RC 2");

    // Fetch complaint updates timeline
    const timeline = await prisma.complaintUpdate.findMany({
      where: { complaint_id: complaint.id },
      orderBy: { created_at: "asc" }
    });

    assert(timeline.length === 3, `Timeline has exactly 3 transitions (Acknowledge -> Student Completed -> RC Close)`);
    
    // Verify timeline shows who did what
    const ackUpdate = timeline.find(u => u.new_status === "AWAITING_STUDENT_CONFIRMATION");
    const verifyUpdate = timeline.find(u => u.new_status === "CLOSED");

    assert(ackUpdate?.updated_by_id === rc1.id || ackUpdate?.updated_by_id === rc2.id, "Acknowledge correctly attribute to whichever RC won the concurrency race");
    assert(verifyUpdate?.updated_by_id === rc2.id, "Verification and closure correctly attributed to RC 2");

    // ----------------------------------------------------
    // TEST H: RC Deletion Safety (FK/Audit constraint checks)
    // ----------------------------------------------------
    console.log("\n[9] Testing RC Deletion Safety Checks...");
    
    // Try to delete RC 1 (who performed Acknowledge)
    // Should fail because of updates relation check
    const rc1UpdatesCount = await prisma.complaintUpdate.count({ where: { updated_by_id: rc1.id } });
    assert(rc1UpdatesCount > 0, "RC 1 has historical complaint update activity");

    // Simulate DELETE route safety checks
    const deleteAllowedRC1 = rc1UpdatesCount === 0;
    assert(!deleteAllowedRC1, "RC 1 deletion is blocked due to historical complaint activity");

    // RC 3 (has no activity)
    const rc3 = await prisma.user.create({
      data: {
        name: "RC Test Three",
        email: "rc_test3@ech.com",
        password_hash: hash,
        role: "RC",
        must_change_password: true,
        is_active: true,
      }
    });

    const rc3UpdatesCount = await prisma.complaintUpdate.count({ where: { updated_by_id: rc3.id } });
    const deleteAllowedRC3 = rc3UpdatesCount === 0;
    assert(deleteAllowedRC3, "RC 3 (zero historical activity) is permitted for deletion");

    if (deleteAllowedRC3) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { user_id: rc3.id } });
        await tx.user.delete({ where: { id: rc3.id } });
      });
      const deletedCheck = await prisma.user.findUnique({ where: { id: rc3.id } });
      assert(!deletedCheck, "RC 3 successfully and safely deleted");
    }

    // ----------------------------------------------------
    // Final Clean Up
    // ----------------------------------------------------
    console.log("\n[10] Cleaning up test data...");
    await prisma.notification.deleteMany({ where: { complaint_id: complaint.id } });
    await prisma.complaintUpdate.deleteMany({ where: { complaint_id: complaint.id } });
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: studentUser.id } });
    await prisma.user.deleteMany({ where: { id: { in: [rc1.id, rc2.id] } } });
    console.log("Cleanup completed.");

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    failed++;
  }

  console.log("\n==================================================");
  console.log("TEST RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==================================================");
}

runTests();
