import "dotenv/config";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding database...");

  // Clear existing data (in correct dependency order)
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.complaintUpdate.deleteMany({});
  await prisma.complaint.deleteMany({});
  await prisma.importRecord.deleteMany({});
  await prisma.studentImport.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create ADMIN account
  const adminPasswordHash = await bcrypt.hash("admin_password", 10);
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@ech.com",
      phone_number: "9876543210",
      password_hash: adminPasswordHash,
      role: "ADMIN",
      must_change_password: false,
      is_active: true,
    },
  });
  console.log("Admin account created:", admin.email);

  // 2. Create RC account (Single RC constraint)
  const rcPasswordHash = await bcrypt.hash("rc_password", 10);
  const rc = await prisma.user.create({
    data: {
      name: "Mantharai RC",
      email: "rc@ech.com",
      phone_number: "9876543211",
      password_hash: rcPasswordHash,
      role: "RC",
      must_change_password: false,
      is_active: true,
    },
  });
  console.log("RC account created:", rc.email);

  // 3. Create STUDENT accounts (with must_change_password = true, DOB password hashed)
  // DOB Format: DDMMYY.
  // Student 1: 15 March 2005 -> "150305"
  const s1Dob = new Date("2005-03-15");
  const s1TempPassword = "150305";
  const s1PasswordHash = await bcrypt.hash(s1TempPassword, 10);
  const student1 = await prisma.user.create({
    data: {
      registration_number: "2023105001",
      name: "Student One",
      date_of_birth: s1Dob,
      room_number: "101",
      email: "student1@ech.com",
      phone_number: "9876543212",
      password_hash: s1PasswordHash,
      role: "STUDENT",
      must_change_password: true,
      is_active: true,
    },
  });
  console.log(`Student account 1 created: Reg No ${student1.registration_number}, Temp Pass: ${s1TempPassword}`);

  // Student 2: 22 July 2004 -> "220704"
  const s2Dob = new Date("2004-07-22");
  const s2TempPassword = "220704";
  const s2PasswordHash = await bcrypt.hash(s2TempPassword, 10);
  const student2 = await prisma.user.create({
    data: {
      registration_number: "2023105002",
      name: "Student Two",
      date_of_birth: s2Dob,
      room_number: "102",
      email: "student2@ech.com",
      phone_number: "9876543213",
      password_hash: s2PasswordHash,
      role: "STUDENT",
      must_change_password: true,
      is_active: true,
    },
  });
  console.log(`Student account 2 created: Reg No ${student2.registration_number}, Temp Pass: ${s2TempPassword}`);

  // Student 3: 05 December 2005 -> "051205"
  const s3Dob = new Date("2005-12-05");
  const s3TempPassword = "051205";
  const s3PasswordHash = await bcrypt.hash(s3TempPassword, 10);
  const student3 = await prisma.user.create({
    data: {
      registration_number: "2023105003",
      name: "Student Three",
      date_of_birth: s3Dob,
      room_number: "201",
      email: "student3@ech.com",
      phone_number: "9876543214",
      password_hash: s3PasswordHash,
      role: "STUDENT",
      must_change_password: true,
      is_active: true,
    },
  });
  console.log(`Student account 3 created: Reg No ${student3.registration_number}, Temp Pass: ${s3TempPassword}`);

  console.log("Database seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
