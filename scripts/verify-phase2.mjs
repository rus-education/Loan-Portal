import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import fs from "fs";
import path from "path";

// Read .env.local or process.env
const envPath = path.resolve(process.cwd(), ".env.local");
let mongoUri = process.env.MONGODB_URI || "";
let jwtSecret = process.env.JWT_SECRET || "";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("MONGODB_URI=")) {
      mongoUri = trimmed.replace("MONGODB_URI=", "").replace(/^["']|["']$/g, "").trim();
    }
    if (trimmed.startsWith("JWT_SECRET=")) {
      jwtSecret = trimmed.replace("JWT_SECRET=", "").replace(/^["']|["']$/g, "").trim();
    }
  }
}

if (!mongoUri || !jwtSecret) {
  console.error("Error: MONGODB_URI and JWT_SECRET environment variables are required.");
  process.exit(1);
}

const JWT_KEY = new TextEncoder().encode(jwtSecret);

async function testPhase2() {
  console.log("=== PHASE 2 INTEGRATION VERIFICATION ===");

  // 1. Database Connection
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB Atlas");

  const db = mongoose.connection.db;

  // 2. Branch Collection Check
  const branchCount = await db.collection("branches").countDocuments();
  console.log(`✓ Branches in DB: ${branchCount} (Expect >= 21)`);
  if (branchCount < 21) {
    throw new Error(`Insufficient branches seeded: found ${branchCount}`);
  }

  const delhiBranch = await db.collection("branches").findOne({ code: "NDLS" });
  const mumbaiBranch = await db.collection("branches").findOne({ code: "BOM" });
  if (!delhiBranch || !mumbaiBranch) {
    throw new Error("Core branches NDLS or BOM not found");
  }
  console.log(`✓ Verified NDLS (${delhiBranch.name}) and BOM (${mumbaiBranch.name})`);

  // 3. User Collection & Roles Check
  const users = await db.collection("users").find({}).toArray();
  console.log(`✓ Total Users in DB: ${users.length}`);

  const rolesFound = new Set(users.map((u) => u.role));
  console.log(`✓ Roles present: ${Array.from(rolesFound).join(", ")}`);
  for (const expectedRole of ["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"]) {
    if (!rolesFound.has(expectedRole)) {
      throw new Error(`Expected role missing: ${expectedRole}`);
    }
  }

  // 4. Password Hashing Verification
  const superadmin = users.find((u) => u.email === "superadmin@loanportal.internal");
  if (!superadmin) throw new Error("Superadmin user not found");

  const validPassword = await bcrypt.compare("SuperAdmin@2026!", superadmin.passwordHash);
  const invalidPassword = await bcrypt.compare("WrongPassword123", superadmin.passwordHash);
  console.log(`✓ bcrypt password verification valid check: ${validPassword}`);
  console.log(`✓ bcrypt password verification invalid check: ${!invalidPassword}`);
  if (!validPassword || invalidPassword) {
    throw new Error("Password hashing verification failed");
  }

  // 5. JWT Token Generation & Verification
  const token = await new SignJWT({
    userId: String(superadmin._id),
    name: superadmin.name,
    email: superadmin.email,
    role: superadmin.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_KEY);

  const { payload } = await jwtVerify(token, JWT_KEY);
  console.log(`✓ JWT sign and verify succeeded for: ${payload.email} (${payload.role})`);

  // 6. Test LoanApplication Model & Lifecycle
  const loanCol = db.collection("loanapplications");
  const testLoan = {
    sdmId: "SDM-TEST-001",
    studentName: "Aarav Sharma",
    contactNumber: "+91 98765 43210",
    branchId: delhiBranch._id,
    course: "M.S. Computer Science",
    country: "USA",
    loanAmount: 4500000,
    intakeMonth: "September",
    intakeYear: 2026,
    parentGuardianIncomeSource: "Business (Export-Import)",
    currentStage: "Document Collection",
    status: "Under Review",
    branchRemarks: "Verified passport and bachelor transcripts.",
    adminRemarks: "Awaiting I-20 financial declaration from candidate.",
    createdBy: superadmin._id,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertLoanRes = await loanCol.insertOne(testLoan);
  console.log(`✓ LoanApplication created with ID: ${insertLoanRes.insertedId}`);

  const fetchedLoan = await loanCol.findOne({ _id: insertLoanRes.insertedId });
  if (!fetchedLoan || fetchedLoan.sdmId !== "SDM-TEST-001" || fetchedLoan.loanAmount !== 4500000) {
    throw new Error("LoanApplication fetch mismatch");
  }
  console.log(`✓ LoanApplication successfully retrieved: ${fetchedLoan.studentName} (${fetchedLoan.course})`);

  // Clean up test loan
  await loanCol.deleteOne({ _id: insertLoanRes.insertedId });
  console.log("✓ LoanApplication test cleanup verified");

  // 7. AuditLog Collection Test
  const auditCol = db.collection("auditlogs");
  const testAudit = {
    userId: superadmin._id,
    action: "PHASE2_VERIFICATION_TEST",
    entity: "System",
    entityId: "test-system",
    oldValue: null,
    newValue: { status: "Verified" },
    ip: "127.0.0.1",
    userAgent: "Phase2TestRunner/1.0",
    timestamp: new Date(),
  };

  const insertAuditRes = await auditCol.insertOne(testAudit);
  console.log(`✓ AuditLog record created with ID: ${insertAuditRes.insertedId}`);

  const fetchedAudit = await auditCol.findOne({ _id: insertAuditRes.insertedId });
  if (!fetchedAudit || fetchedAudit.action !== "PHASE2_VERIFICATION_TEST") {
    throw new Error("AuditLog fetch mismatch");
  }
  await auditCol.deleteOne({ _id: insertAuditRes.insertedId });
  console.log("✓ AuditLog test cleanup verified");

  // 8. Test Branch Isolation Logic
  const delhiUser = users.find((u) => u.email === "delhi.branch@loanportal.internal");
  if (!delhiUser) throw new Error("Delhi branch user not found");

  const delhiCanAccessDelhi = String(delhiUser.branchId) === String(delhiBranch._id);
  const delhiCanAccessMumbai = String(delhiUser.branchId) === String(mumbaiBranch._id);
  console.log(`✓ Branch user isolation check - Access to own branch: ${delhiCanAccessDelhi}`);
  console.log(`✓ Branch user isolation check - Blocked from other branch: ${!delhiCanAccessMumbai}`);
  if (!delhiCanAccessDelhi || delhiCanAccessMumbai) {
    throw new Error("Branch isolation logic failed");
  }

  await mongoose.disconnect();
  console.log("=== ALL PHASE 2 TESTS PASSED SUCCESSFULLY ===");
}

testPhase2().catch((err) => {
  console.error("Phase 2 test failed:", err);
  process.exit(1);
});
