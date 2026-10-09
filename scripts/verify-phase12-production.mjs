// @ts-check
import assert from "node:assert";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

let passCount = 0;
let failCount = 0;

function pass(name, detail = "") {
  passCount++;
  console.log(`  [PASS] ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name, error) {
  failCount++;
  console.error(`  [FAIL] ${name}:`, error?.message || error);
}

function test(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => pass(name))
        .catch((err) => fail(name, err));
    }
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  const setCookie = res.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/loan_portal_session=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  return {
    status: res.status,
    headers: res.headers,
    data,
    token,
    cookie: token ? `loan_portal_session=${token}` : setCookie,
  };
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`STARTING VERIFICATION: PHASE 12 (PRODUCTION READINESS)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  let delhiLoanId = null;

  // Step 1: Health Check & System Diagnostics
  console.log("Step 1: Checking Diagnostics & Health Telemetry...");
  await test("GET /api/health returns 200 with operational metrics", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "healthy");
    assert.strictEqual(json.database.connected, true);
    assert.ok(typeof json.uptime === "number");
    assert.ok(typeof json.database.responseTimeMs === "number");
  });

  // Step 2: Role Authentication Matrix
  console.log("\nStep 2: Authenticating Role Personas...");
  let superAuth, adminAuth, delhiAuth, viewerAuth;

  await test("SuperAdmin authentication succeeds", async () => {
    superAuth = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
    assert.strictEqual(superAuth.status, 200);
    assert.strictEqual(superAuth.data.user.role, "SUPERADMIN");
  });

  await test("GET /diagnostics renders successfully for authenticated operator", async () => {
    const res = await fetch(`${BASE_URL}/diagnostics`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("System Diagnostics") || text.includes("Diagnostics"));
  });

  await test("Admin authentication succeeds", async () => {
    adminAuth = await login("admin@loanportal.internal", "Admin@2026!");
    assert.strictEqual(adminAuth.status, 200);
    assert.strictEqual(adminAuth.data.user.role, "ADMIN");
  });

  await test("Branch User authentication succeeds", async () => {
    delhiAuth = await login("delhi.branch@loanportal.internal", "Branch@2026!");
    assert.strictEqual(delhiAuth.status, 200);
    assert.strictEqual(delhiAuth.data.user.role, "BRANCH_USER");
    assert.ok(delhiAuth.data.user.branchId !== null);
  });

  await test("Viewer authentication succeeds", async () => {
    viewerAuth = await login("viewer@loanportal.internal", "Viewer@2026!");
    assert.strictEqual(viewerAuth.status, 200);
    assert.strictEqual(viewerAuth.data.user.role, "VIEWER");
  });

  // Step 3: Branch User Submission
  console.log("\nStep 3: Testing Branch User Submission Workflow...");
  const testSdmId = `SDM-PROD-${Date.now()}`;
  await test("Branch User creates new loan application", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiAuth.cookie,
      },
      body: JSON.stringify({
        sdmId: testSdmId,
        studentName: "Ananya Sharma",
        contactNumber: "+91 98765 43210",
        course: "M.S. in Machine Learning",
        country: "United States",
        loanAmount: 4800000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried Professional (Software Engineer)",
        currentStage: "Counselor Consultation",
        branchRemarks: "High GRE score applicant with partial university scholarship.",
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.sdmId, testSdmId);
    assert.strictEqual(json.data.status, "Pending");
    assert.strictEqual(String(json.data.branchId?._id || json.data.branchId), String(delhiAuth.data.user.branchId));
    delhiLoanId = json.data._id;
  });

  // Step 4: Admin Processing
  console.log("\nStep 4: Testing Admin Processing Workflow...");
  await test("Admin evaluates and updates loan status & remarks", async () => {
    assert.ok(delhiLoanId, "Test loan ID must exist");
    const res = await fetch(`${BASE_URL}/api/loans/${delhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({
        status: "Under Review",
        currentStage: "Financial Underwriting",
        adminRemarks: "Documents verified with university I-20 form. Processing sanction letter.",
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, "Under Review");
    assert.strictEqual(json.data.currentStage, "Financial Underwriting");
    assert.strictEqual(json.data.adminRemarks, "Documents verified with university I-20 form. Processing sanction letter.");
  });

  // Step 5: Viewer Read-Only Validation
  console.log("\nStep 5: Testing Viewer Read-Only Enforcement...");
  await test("Viewer can read loan record", async () => {
    assert.ok(delhiLoanId, "Test loan ID must exist");
    const res = await fetch(`${BASE_URL}/api/loans/${delhiLoanId}`, {
      headers: { Cookie: viewerAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data._id, delhiLoanId);
  });

  await test("Viewer is strictly blocked from updating loan (HTTP 403)", async () => {
    assert.ok(delhiLoanId, "Test loan ID must exist");
    const res = await fetch(`${BASE_URL}/api/loans/${delhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewerAuth.cookie,
      },
      body: JSON.stringify({ status: "Approved" }),
    });
    assert.strictEqual(res.status, 403);
  });

  // Step 6: Superadmin Governance & Management
  console.log("\nStep 6: Testing Superadmin Governance...");
  await test("SuperAdmin lists audit logs with pagination", async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs?page=1&limit=10`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.pagination.total >= 1);
  });

  await test("SuperAdmin lists users with pagination", async () => {
    const res = await fetch(`${BASE_URL}/api/users?page=1&limit=5`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.pagination.total >= 1);
  });

  await test("SuperAdmin reads system settings", async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.policies?.maintenanceMode !== undefined);
  });

  // Step 7: Unauthorized Access & Security Boundaries
  console.log("\nStep 7: Testing Unauthorized Access & IDOR Containment...");
  await test("Unauthenticated request to /api/loans is blocked (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`);
    assert.strictEqual(res.status, 401);
  });

  await test("Admin blocked from deleting loan records (SuperAdmin only)", async () => {
    assert.ok(delhiLoanId, "Test loan ID must exist");
    const res = await fetch(`${BASE_URL}/api/loans/${delhiLoanId}`, {
      method: "DELETE",
      headers: { Cookie: adminAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  // Step 8: Mobile UI & Viewport & Theme Configuration
  console.log("\nStep 8: Checking Mobile Viewport & Theme Variables...");
  await test("Root HTML contains viewport configuration and ThemeProvider attributes", async () => {
    const res = await fetch(`${BASE_URL}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("viewport") || res.headers.get("content-type")?.includes("text/html"));
    assert.ok(html.includes("bg-background") || html.includes("font-sans"));
  });

  // Step 9: Cleanup
  console.log("\nStep 9: Cleaning Up Test Artifacts...");
  await test("SuperAdmin permanently deletes test loan", async () => {
    if (delhiLoanId) {
      const res = await fetch(`${BASE_URL}/api/loans/${delhiLoanId}`, {
        method: "DELETE",
        headers: { Cookie: superAuth.cookie },
      });
      assert.strictEqual(res.status, 200);
    }
  });

  console.log(`\n======================================================`);
  console.log(`PHASE 12 PRODUCTION READINESS VERIFICATION COMPLETE`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled verification error:", err);
  process.exit(1);
});
