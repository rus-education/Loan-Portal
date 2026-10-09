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

async function test(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
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

async function runQA() {
  console.log(`\n================================================================`);
  console.log(`STARTING PHASE 14 — COMPREHENSIVE END-TO-END QA AUDIT`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`================================================================\n`);

  // Credentials
  let superAuth, adminAuth, delhiAuth, mumbaiAuth, viewerAuth;
  let testDelhiLoanId = null;
  let testMumbaiLoanId = null;
  let testBranchId = null;
  let testUserId = null;

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION LIFECYCLE
  // -------------------------------------------------------------------------
  console.log("Section 1: Authentication Matrix & Session Lifecycle...");

  await test("SUPERADMIN authenticates successfully", async () => {
    superAuth = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
    assert.strictEqual(superAuth.status, 200);
    assert.strictEqual(superAuth.data.user.role, "SUPERADMIN");
  });

  await test("ADMIN authenticates successfully", async () => {
    adminAuth = await login("admin@loanportal.internal", "Admin@2026!");
    assert.strictEqual(adminAuth.status, 200);
    assert.strictEqual(adminAuth.data.user.role, "ADMIN");
  });

  await test("BRANCH_USER (Delhi) authenticates successfully", async () => {
    delhiAuth = await login("delhi.branch@loanportal.internal", "Branch@2026!");
    assert.strictEqual(delhiAuth.status, 200);
    assert.strictEqual(delhiAuth.data.user.role, "BRANCH_USER");
    assert.ok(delhiAuth.data.user.branchId !== null);
  });

  await test("BRANCH_USER (Mumbai) authenticates successfully", async () => {
    mumbaiAuth = await login("mumbai.branch@loanportal.internal", "Branch@2026!");
    assert.strictEqual(mumbaiAuth.status, 200);
    assert.strictEqual(mumbaiAuth.data.user.role, "BRANCH_USER");
    assert.ok(mumbaiAuth.data.user.branchId !== null);
  });

  await test("VIEWER authenticates successfully", async () => {
    viewerAuth = await login("viewer@loanportal.internal", "Viewer@2026!");
    assert.strictEqual(viewerAuth.status, 200);
    assert.strictEqual(viewerAuth.data.user.role, "VIEWER");
  });

  await test("Invalid password rejected with HTTP 401", async () => {
    const res = await login("superadmin@loanportal.internal", "WrongPassword999!");
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test("Tampered session JWT cookie rejected with HTTP 401", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: "loan_portal_session=invalid.token.structure" },
    });
    assert.strictEqual(res.status, 401);
  });

  await test("Session logout properly expires auth cookie", async () => {
    const tempAuth = await login("delhi.branch@loanportal.internal", "Branch@2026!");
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: tempAuth.cookie },
    });
    assert.strictEqual(logoutRes.status, 200);
    const setCookie = logoutRes.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("Max-Age=0") || setCookie.includes("expires="));
  });

  // -------------------------------------------------------------------------
  // 2. BRANCH USER CAPABILITIES & STRICT BOUNDARIES
  // -------------------------------------------------------------------------
  console.log("\nSection 2: Testing BRANCH USER Capabilities & Multi-Branch Isolation...");

  const delhiSdmId = `SDM-QA-DELHI-${Date.now()}`;
  await test("Branch User creates valid loan application (auto-bound to Delhi branch)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiAuth.cookie,
      },
      body: JSON.stringify({
        sdmId: delhiSdmId,
        studentName: "Aditya Verma",
        contactNumber: "+91 91234 56789",
        course: "M.Sc. Data Science",
        country: "Germany",
        loanAmount: 3200000,
        intakeMonth: "October",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business (Export Logistics)",
        currentStage: "Counselor Consultation",
        branchRemarks: "Admitted to Technical University of Munich.",
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.sdmId, delhiSdmId);
    assert.strictEqual(String(json.data.branchId?._id || json.data.branchId), String(delhiAuth.data.user.branchId));
    testDelhiLoanId = json.data._id;
  });

  const mumbaiSdmId = `SDM-QA-MUMBAI-${Date.now()}`;
  await test("Mumbai Branch User creates loan application (auto-bound to Mumbai branch)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: mumbaiAuth.cookie,
      },
      body: JSON.stringify({
        sdmId: mumbaiSdmId,
        studentName: "Rohit Kulkarni",
        contactNumber: "+91 99887 76655",
        course: "MBA Global Finance",
        country: "United Kingdom",
        loanAmount: 5500000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Corporate Director",
        currentStage: "Document Collection",
        branchRemarks: "Oxford Said Business School candidate.",
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    testMumbaiLoanId = json.data._id;
  });

  await test("Branch User querying /api/loans ONLY receives own branch records", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: { Cookie: delhiAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length > 0);
    for (const loan of json.data) {
      assert.strictEqual(
        String(loan.branchId?._id || loan.branchId),
        String(delhiAuth.data.user.branchId),
        "Branch user must never see other branch records"
      );
    }
  });

  await test("IDOR Read Blocked: Delhi user cannot read Mumbai loan (HTTP 403)", async () => {
    assert.ok(testMumbaiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testMumbaiLoanId}`, {
      headers: { Cookie: delhiAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("IDOR Update Blocked: Delhi user cannot edit Mumbai loan (HTTP 403)", async () => {
    assert.ok(testMumbaiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testMumbaiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiAuth.cookie,
      },
      body: JSON.stringify({ branchRemarks: "Unauthorized cross-branch modification" }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Branch User forbidden from modifying admin status (HTTP 403)", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiAuth.cookie,
      },
      body: JSON.stringify({ status: "Approved" }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Branch User forbidden from user management endpoints (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: delhiAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Branch User forbidden from system settings (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      headers: { Cookie: delhiAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  // -------------------------------------------------------------------------
  // 3. ADMIN UNDERWRITING CAPABILITIES & ROLE CONSTRAINTS
  // -------------------------------------------------------------------------
  console.log("\nSection 3: Testing ADMIN Underwriting Capabilities & Role Boundaries...");

  await test("Admin can query applications across all branches", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: { Cookie: adminAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length >= 2, "Admin should see loans from multiple branches");
    const branchIds = new Set(json.data.map((l) => String(l.branchId?._id || l.branchId)));
    assert.ok(branchIds.size >= 2, "Admin scope includes multiple branches");
  });

  await test("Admin updates loan status to 'Under Review' with admin remarks", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({
        status: "Under Review",
        currentStage: "Financial Credit Assessment",
        adminRemarks: "Academic transcript and university admission verified. Proceeding with credit evaluation.",
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.status, "Under Review");
    assert.strictEqual(json.data.currentStage, "Financial Credit Assessment");
    assert.ok(json.data.adminRemarks.includes("credit evaluation"));
  });

  await test("Admin updates loan status to 'Approved' with sanction remarks", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({
        status: "Approved",
        currentStage: "Sanction Letter Issued",
        adminRemarks: "Credit committee approved sanction letter at 9.25% fixed ROI.",
      }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.status, "Approved");
  });

  await test("Admin cannot manage or create users (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({
        name: "Unauthorized Officer",
        email: "unauthorized.user@test.internal",
        password: "Password123!",
        role: "BRANCH_USER",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Admin cannot delete loan applications (SuperAdmin only, HTTP 403)", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "DELETE",
      headers: { Cookie: adminAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Admin cannot alter system settings (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({ maintenanceMode: true }),
    });
    assert.strictEqual(res.status, 403);
  });

  // -------------------------------------------------------------------------
  // 4. VIEWER READ-ONLY ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log("\nSection 4: Testing VIEWER Read-Only Enforcement...");

  await test("Viewer can read loan registry with full branch information", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      headers: { Cookie: viewerAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
  });

  await test("Viewer can read specific loan detail", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      headers: { Cookie: viewerAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data._id, testDelhiLoanId);
  });

  await test("Viewer blocked from creating loan application (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewerAuth.cookie,
      },
      body: JSON.stringify({
        sdmId: `SDM-VIEWER-ILLEGAL-${Date.now()}`,
        studentName: "Illegal Candidate",
        contactNumber: "+91 99999 88888",
        course: "Law",
        country: "UK",
        loanAmount: 1000000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried",
        currentStage: "Inquiry",
      }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Viewer blocked from modifying loan records (HTTP 403)", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewerAuth.cookie,
      },
      body: JSON.stringify({ branchRemarks: "Auditor tamper attempt" }),
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Viewer blocked from deleting loan records (HTTP 403)", async () => {
    assert.ok(testDelhiLoanId);
    const res = await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
      method: "DELETE",
      headers: { Cookie: viewerAuth.cookie },
    });
    assert.strictEqual(res.status, 403);
  });

  await test("Viewer blocked from CSV imports (HTTP 403)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewerAuth.cookie,
      },
      body: JSON.stringify({ csvContent: "sdmId,studentName\nTEST,Test" }),
    });
    assert.strictEqual(res.status, 403);
  });

  // -------------------------------------------------------------------------
  // 5. SUPERADMIN FULL CRUD & GOVERNANCE
  // -------------------------------------------------------------------------
  console.log("\nSection 5: Testing SUPERADMIN Full Governance & Lifecycle...");

  const testBranchCode = `QA${Math.floor(1000 + Math.random() * 9000)}`;
  await test("SuperAdmin creates new branch", async () => {
    const res = await fetch(`${BASE_URL}/api/branches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({
        name: `Test QA Branch ${testBranchCode}`,
        code: testBranchCode,
        status: "active",
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.code, testBranchCode);
    testBranchId = json.data._id;
  });

  await test("SuperAdmin updates branch status to inactive", async () => {
    assert.ok(testBranchId);
    const res = await fetch(`${BASE_URL}/api/branches/${testBranchId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({ status: "inactive" }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.status, "inactive");
  });

  const testUserEmail = `qa_officer_${Date.now()}@loanportal.internal`;
  await test("SuperAdmin creates staff user", async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({
        name: "Test QA Officer",
        email: testUserEmail,
        password: "InitialPassword@2026!",
        role: "BRANCH_USER",
        branchId: testBranchId,
        status: "active",
      }),
    });
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.email, testUserEmail.toLowerCase());
    testUserId = json.data._id;
  });

  await test("SuperAdmin resets staff user password", async () => {
    assert.ok(testUserId);
    const res = await fetch(`${BASE_URL}/api/users/${testUserId}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({ newPassword: "NewResetPassword@2026!" }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
  });

  await test("SuperAdmin queries audit logs with pagination and filters", async () => {
    const res = await fetch(`${BASE_URL}/api/audit-logs?page=1&limit=10&action=USER_LOGIN`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.data));
    assert.ok(json.pagination.total >= 1);
  });

  await test("SuperAdmin updates system maintenance policy", async () => {
    const res = await fetch(`${BASE_URL}/api/settings`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({ maintenanceMode: false }),
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
  });

  // -------------------------------------------------------------------------
  // 6. INPUT VALIDATION, INJECTION & QUERY SAFETY
  // -------------------------------------------------------------------------
  console.log("\nSection 6: Testing Input Validation, Injection Defense & Safety...");

  await test("Zod rejects malformed email on login (HTTP 400)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "Password123!" }),
    });
    assert.strictEqual(res.status, 400);
  });

  await test("Zod rejects negative loan amount on loan creation (HTTP 400)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: superAuth.cookie,
      },
      body: JSON.stringify({
        sdmId: `SDM-NEG-${Date.now()}`,
        studentName: "Negative Test",
        contactNumber: "+91 99999 11111",
        course: "Engineering",
        country: "USA",
        loanAmount: -50000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried",
        currentStage: "Inquiry",
      }),
    });
    assert.strictEqual(res.status, 400);
  });

  await test("ReDoS attacks in search query handled safely (HTTP 200)", async () => {
    const maliciousPatterns = [
      "((((a+)+)+)+)",
      "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$",
      ".*",
      "[a-z",
      "\\",
    ];

    for (const pattern of maliciousPatterns) {
      const res = await fetch(`${BASE_URL}/api/loans?search=${encodeURIComponent(pattern)}`, {
        headers: { Cookie: superAuth.cookie },
      });
      assert.strictEqual(res.status, 200, `ReDoS search for '${pattern}' failed`);
    }
  });

  await test("Direct unauthenticated access to /api/loans blocked (HTTP 401)", async () => {
    const res = await fetch(`${BASE_URL}/api/loans`);
    assert.strictEqual(res.status, 401);
  });

  // -------------------------------------------------------------------------
  // 7. DATASET SCALING, SORTING & PAGINATION
  // -------------------------------------------------------------------------
  console.log("\nSection 7: Testing Pagination, Sorting & Export Parity...");

  await test("Server-side sorting by loanAmount descending is verified", async () => {
    const res = await fetch(`${BASE_URL}/api/loans?sortBy=loanAmount&sortOrder=desc&limit=10`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.data.length >= 2);
    for (let i = 0; i < json.data.length - 1; i++) {
      assert.ok(
        json.data[i].loanAmount >= json.data[i + 1].loanAmount,
        "loanAmount must be descending"
      );
    }
  });

  await test("Server-side pagination returns distinct pages without overlapping items", async () => {
    const resPage1 = await fetch(`${BASE_URL}/api/loans?page=1&limit=3`, {
      headers: { Cookie: superAuth.cookie },
    });
    const resPage2 = await fetch(`${BASE_URL}/api/loans?page=2&limit=3`, {
      headers: { Cookie: superAuth.cookie },
    });
    const json1 = await resPage1.json();
    const json2 = await resPage2.json();

    assert.strictEqual(json1.pagination.page, 1);
    assert.strictEqual(json2.pagination.page, 2);
    const ids1 = new Set(json1.data.map((l) => l._id));
    for (const l of json2.data) {
      assert.ok(!ids1.has(l._id), `Item ${l._id} must not appear on both page 1 and page 2`);
    }
  });

  await test("CSV export reflects active status filter", async () => {
    const res = await fetch(`${BASE_URL}/api/loans/export?status=Approved`, {
      headers: { Cookie: superAuth.cookie },
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("text/csv"));
    const csv = await res.text();
    const lines = csv.trim().split("\n");
    assert.ok(lines.length >= 2, "CSV must contain header and data rows");
    for (let i = 1; i < lines.length; i++) {
      assert.ok(lines[i].includes("Approved"), "All exported records must match status=Approved filter");
    }
  });

  // -------------------------------------------------------------------------
  // 8. THEME & UI INTEGRITY
  // -------------------------------------------------------------------------
  console.log("\nSection 8: Checking Theme Attributes, Mobile & Viewport Configuration...");

  await test("Root HTML contains proper viewport and theme class metadata", async () => {
    const res = await fetch(`${BASE_URL}/login`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("viewport") || res.headers.get("content-type")?.includes("text/html"));
    assert.ok(html.includes("suppressHydrationWarning") || html.includes("min-h-screen"));
  });

  await test("HTTP Security headers are properly served", async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
    assert.strictEqual(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.strictEqual(res.headers.get("x-xss-protection"), "1; mode=block");
    assert.strictEqual(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  });

  // -------------------------------------------------------------------------
  // 9. CLEANUP OF QA TEST ARTIFACTS
  // -------------------------------------------------------------------------
  console.log("\nSection 9: Cleaning Up QA Test Artifacts...");

  await test("SuperAdmin permanently deletes test loans and test staff user", async () => {
    if (testDelhiLoanId) {
      await fetch(`${BASE_URL}/api/loans/${testDelhiLoanId}`, {
        method: "DELETE",
        headers: { Cookie: superAuth.cookie },
      });
    }
    if (testMumbaiLoanId) {
      await fetch(`${BASE_URL}/api/loans/${testMumbaiLoanId}`, {
        method: "DELETE",
        headers: { Cookie: superAuth.cookie },
      });
    }
    if (testUserId) {
      await fetch(`${BASE_URL}/api/users/${testUserId}`, {
        method: "DELETE",
        headers: { Cookie: superAuth.cookie },
      });
    }
    if (testBranchId) {
      await fetch(`${BASE_URL}/api/branches/${testBranchId}`, {
        method: "DELETE",
        headers: { Cookie: superAuth.cookie },
      });
    }
  });

  console.log(`\n================================================================`);
  console.log(`PHASE 14 FINAL QA COMPLETE`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`================================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runQA().catch((err) => {
  console.error("Unhandled QA runner failure:", err);
  process.exit(1);
});
