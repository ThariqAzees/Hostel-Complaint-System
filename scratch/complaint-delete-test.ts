import "dotenv/config";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";
import { DELETE as deleteComplaint } from "../src/app/api/admin/complaints/[id]/route";
import { DELETE as deleteStudent } from "../src/app/api/admin/students/[id]/route";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING COMPLAINT DELETION REGRESSION TESTS");
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

  // Helper to make a Next.js Request mock
  function mockRequest() {
    return new Request("http://localhost/api/admin/complaints/test-id", {
      method: "DELETE",
    });
  }

  try {
    // 1. Clean up old test users & data
    console.log("\n[1] Preparing database clean slate...");
    const testAdminEmail = "delete_test_admin@ech.com";
    const testRcEmail = "delete_test_rc@ech.com";
    const testStudentReg = "8888888888";
    const testStudentEmail = "delete_test_student@ech.com";

    // Clean up old student complaints, updates, notifications
    const oldStudent = await prisma.user.findFirst({ where: { registration_number: testStudentReg } });
    if (oldStudent) {
      await prisma.notification.deleteMany({ where: { user_id: oldStudent.id } });
      await prisma.complaintUpdate.deleteMany({ where: { complaint: { student_id: oldStudent.id } } });
      const oldComplaints = await prisma.complaint.findMany({ where: { student_id: oldStudent.id } });
      const oldComplaintIds = oldComplaints.map(c => c.id);
      await prisma.notification.deleteMany({ where: { complaint_id: { in: oldComplaintIds } } });
      await prisma.complaintUpdate.deleteMany({ where: { complaint_id: { in: oldComplaintIds } } });
      await prisma.auditLog.deleteMany({ where: { entity_type: "Complaint", entity_id: { in: oldComplaintIds } } });
      await prisma.complaint.deleteMany({ where: { student_id: oldStudent.id } });
      await prisma.user.delete({ where: { id: oldStudent.id } });
    }

    await prisma.user.deleteMany({
      where: { email: { in: [testAdminEmail, testRcEmail] } }
    });

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { description: { contains: "delete_test_admin" } },
          { description: { contains: "delete_test_rc" } },
          { description: { contains: "8888888888" } },
          { description: { contains: "DEL-2026-999999" } }
        ]
      }
    });

    // 2. Create test accounts
    console.log("\n[2] Creating test accounts...");
    const hash = await bcrypt.hash("testpassword123", 10);

    const adminUser = await prisma.user.create({
      data: {
        name: "Delete Test Admin",
        email: testAdminEmail,
        password_hash: hash,
        role: "ADMIN",
        must_change_password: false,
        is_active: true,
      }
    });

    const rcUser = await prisma.user.create({
      data: {
        name: "Delete Test RC",
        email: testRcEmail,
        password_hash: hash,
        role: "RC",
        must_change_password: false,
        is_active: true,
      }
    });

    const studentUser = await prisma.user.create({
      data: {
        registration_number: testStudentReg,
        name: "Delete Test Student",
        date_of_birth: new Date("2001-05-15"),
        room_number: "888",
        email: testStudentEmail,
        password_hash: hash,
        role: "STUDENT",
        must_change_password: false,
        is_active: true,
      }
    });

    assert(!!adminUser.id && !!rcUser.id && !!studentUser.id, "Admin, RC, and Student accounts created successfully.");

    // 3. Create a test complaint in SUBMITTED state
    console.log("\n[3] Creating test complaint in SUBMITTED state...");
    const complaint = await prisma.complaint.create({
      data: {
        complaint_code: "DEL-2026-999999",
        student_id: studentUser.id,
        title: "Test Leaking Tap",
        description: "Water leaking in washroom",
        category: "Plumbing",
        status: "SUBMITTED",
      }
    });

    // Create a mock complaint update, notification, and audit log
    const update = await prisma.complaintUpdate.create({
      data: {
        complaint_id: complaint.id,
        updated_by_id: rcUser.id,
        previous_status: "SUBMITTED",
        new_status: "SUBMITTED",
        remarks: "Test update record",
      }
    });

    const notification = await prisma.notification.create({
      data: {
        user_id: studentUser.id,
        complaint_id: complaint.id,
        title: "Complaint Created",
        message: "Your complaint DEL-2026-999999 has been submitted.",
      }
    });

    const mockAudit = await prisma.auditLog.create({
      data: {
        performed_by: adminUser.id,
        action: "TEST_ACTION",
        entity_type: "Complaint",
        entity_id: complaint.id,
        description: "Test log related to complaint DEL-2026-999999",
      }
    });

    assert(!!complaint.id && !!update.id && !!notification.id && !!mockAudit.id, "Complaint and dependent mock records created successfully.");

    // Set CSRF globally valid for tests
    (global as any).__MOCK_CSRF_VALID__ = true;

    // 4. Test Route Authorization Controls
    console.log("\n[4] Testing Route Authorization Controls...");
    
    // Test unauthenticated
    (global as any).__MOCK_SESSION_USER__ = null;
    const resUnauth = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    assert(resUnauth.status === 401, "Complaint deletion blocked with 401 for unauthenticated request.");

    // Test RC role
    (global as any).__MOCK_SESSION_USER__ = { id: rcUser.id, role: "RC" };
    const resRc = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    assert(resRc.status === 403, "Complaint deletion blocked with 403 for RC role.");

    // Test Student role
    (global as any).__MOCK_SESSION_USER__ = { id: studentUser.id, role: "STUDENT" };
    const resStudent = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    assert(resStudent.status === 403, "Complaint deletion blocked with 403 for STUDENT role.");

    // 5. Test status deletion constraint (Safety Rule)
    console.log("\n[5] Testing Deletion State Constraints (CLOSED status constraint)...");
    (global as any).__MOCK_SESSION_USER__ = { id: adminUser.id, role: "ADMIN" };
    const resAdminSubmitted = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    const dataAdminSubmitted = await resAdminSubmitted.json();
    assert(resAdminSubmitted.status === 409, "Deletion of SUBMITTED complaint blocked with 409 Conflict.");
    assert(dataAdminSubmitted.error === "Complaint must be closed before permanent deletion.", "Safety error message matches requirement.");

    // 6. Test student deletion block with 409 when complaints exist
    console.log("\n[6] Testing Student Deletion Blocking with complaints...");
    const resDelStudentBlock = await deleteStudent(mockRequest(), { params: Promise.resolve({ id: studentUser.id }) });
    const dataDelStudentBlock = await resDelStudentBlock.json();
    assert(resDelStudentBlock.status === 409, "Student deletion blocked with 409 Conflict when complaints exist.");
    assert(
      dataDelStudentBlock.error === "This student still has complaint records. Delete all complaints before deleting the student.",
      "Student delete blocker message matches requirement."
    );

    // 7. Transition complaint to CLOSED and test student deletion block again
    console.log("\n[7] Transitioning complaint to CLOSED and testing student deletion blocker again...");
    await prisma.complaint.update({
      where: { id: complaint.id },
      data: { status: "CLOSED" }
    });

    const resDelStudentBlock2 = await deleteStudent(mockRequest(), { params: Promise.resolve({ id: studentUser.id }) });
    assert(resDelStudentBlock2.status === 409, "Student deletion still blocked with 409 after transitioning complaint to CLOSED.");

    // 8. Delete CLOSED complaint as Admin
    console.log("\n[8] Deleting CLOSED complaint as Admin...");
    const resDeleteSuccess = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    const dataDeleteSuccess = await resDeleteSuccess.json();
    assert(resDeleteSuccess.status === 200, "Complaint deleted successfully as Admin with 200 OK.");

    // 9. Verify database cleanup
    console.log("\n[9] Verifying database transaction cleanup...");
    const dbComplaint = await prisma.complaint.findUnique({ where: { id: complaint.id } });
    assert(!dbComplaint, "Complaint record removed from database.");

    const dbUpdatesCount = await prisma.complaintUpdate.count({ where: { complaint_id: complaint.id } });
    assert(dbUpdatesCount === 0, "Dependent ComplaintUpdate records successfully deleted.");

    const dbNotificationsCount = await prisma.notification.count({ where: { complaint_id: complaint.id } });
    assert(dbNotificationsCount === 0, "Dependent Notification records successfully deleted.");

    const dbAuditLogsCount = await prisma.auditLog.count({
      where: {
        entity_type: "Complaint",
        entity_id: complaint.id,
        action: { not: "COMPLAINT_DELETED" }
      }
    });
    assert(dbAuditLogsCount === 0, "Dependent AuditLog records directly tied to complaint successfully deleted.");

    // Check new audit log creation
    const delAudit = await prisma.auditLog.findFirst({
      where: { action: "COMPLAINT_DELETED", entity_id: complaint.complaint_code }
    });
    assert(!!delAudit, "COMPLAINT_DELETED audit log entry created successfully.");
    assert(
      !!(delAudit?.description.includes(complaint.complaint_code) &&
      !delAudit?.description.includes("Water leaking") &&
      !delAudit?.description.includes("Delete Test Student")),
      "AuditLog contains only safe code/ID details and excludes personal/complaint description info."
    );

    // 10. Test double delete / 404 handler
    console.log("\n[10] Testing subsequent/duplicate delete request...");
    const resDelete404 = await deleteComplaint(mockRequest(), { params: Promise.resolve({ id: complaint.id }) });
    const dataDelete404 = await resDelete404.json();
    assert(resDelete404.status === 404, "Subsequent deletion attempt returned 404 Not Found.");
    assert(dataDelete404.error === "This complaint has already been removed.", "Not Found error message matches requirement.");

    // 11. Test student deletion succeeds now that all complaints are gone
    console.log("\n[11] Testing student deletion succeeds now that all complaints are removed...");
    const resStudentDelSuccess = await deleteStudent(mockRequest(), { params: Promise.resolve({ id: studentUser.id }) });
    assert(resStudentDelSuccess.status === 200, "Student account deleted successfully with 200 OK after complaint was removed.");

    const dbStudent = await prisma.user.findUnique({ where: { id: studentUser.id } });
    assert(!dbStudent, "Student user record removed from database.");

    // 12. Clean up test users
    console.log("\n[12] Cleaning up remaining test admin & RC accounts...");
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, rcUser.id] } }
    });
    console.log("Cleanup completed.");

  } catch (error) {
    console.error("Test execution failed with error:", error);
    failed++;
  }

  console.log("\n==================================================");
  console.log("TEST RESULTS SUMMARY");
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
