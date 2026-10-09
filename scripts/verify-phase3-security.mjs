const BASE_URL = "http://localhost:3000";

async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email} with status ${res.status}`);
  }
  const cookie = res.headers.get("set-cookie");
  const data = await res.json();
  return { cookie, user: data.user };
}

async function runSecurityAudit() {
  console.log("=================================================");
  console.log("   PHASE 3 RBAC & SECURITY VERIFICATION SUITE   ");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // SCENARIO 1: Unauthenticated API Requests
  // -------------------------------------------------------------------------
  console.log("--- TEST SUITE 1: Unauthenticated API Requests (401 Expected) ---");
  {
    const resLoans = await fetch(`${BASE_URL}/api/loans`);
    assert(resLoans.status === 401, "GET /api/loans without auth returns 401 Unauthorized");

    const resPostLoan = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdmId: "SDM-TEST" }),
    });
    assert(resPostLoan.status === 401, "POST /api/loans without auth returns 401 Unauthorized");

    const resUsers = await fetch(`${BASE_URL}/api/users`);
    assert(resUsers.status === 401, "GET /api/users without auth returns 401 Unauthorized");

    const resBranches = await fetch(`${BASE_URL}/api/branches`);
    assert(resBranches.status === 401, "GET /api/branches without auth returns 401 Unauthorized");

    const resAudit = await fetch(`${BASE_URL}/api/audit-logs`);
    assert(resAudit.status === 401, "GET /api/audit-logs without auth returns 401 Unauthorized");
  }

  // Authenticate Actors
  console.log("\n--- Authenticating Test Actors ---");
  const superadmin = await loginUser("superadmin@loanportal.internal", "SuperAdmin@2026!");
  const admin = await loginUser("admin@loanportal.internal", "Admin@2026!");
  const delhiUser = await loginUser("delhi.branch@loanportal.internal", "Branch@2026!");
  const mumbaiUser = await loginUser("mumbai.branch@loanportal.internal", "Branch@2026!");
  const viewer = await loginUser("viewer@loanportal.internal", "Viewer@2026!");
  console.log("Actors authenticated: SuperAdmin, Admin, Delhi Branch, Mumbai Branch, Viewer\n");

  // -------------------------------------------------------------------------
  // SCENARIO 2: Branch User Application Creation & IDOR Protection
  // -------------------------------------------------------------------------
  console.log("--- TEST SUITE 2: Branch User Isolation & Cross-Branch IDOR ---");
  let testLoanId = null;
  {
    // Delhi user creates a loan
    const createRes = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiUser.cookie,
      },
      body: JSON.stringify({
        sdmId: "SDM-SEC-999",
        studentName: "Pooja Malhotra",
        contactNumber: "+91 99999 11111",
        course: "M.S. Data Science",
        country: "Germany",
        loanAmount: 2500000,
        intakeMonth: "October",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried (IT Professional)",
        currentStage: "Document Collection",
        branchRemarks: "Delhi branch verified documents",
      }),
    });
    const createdData = await createRes.json();
    assert(createRes.status === 201 && createdData.success, "Delhi Branch User successfully created loan application");
    testLoanId = createdData.data?._id;

    // Delhi user can read their own loan
    const readOwnRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      headers: { Cookie: delhiUser.cookie },
    });
    assert(readOwnRes.status === 200, "Delhi Branch User can read their own branch loan record");

    // Mumbai user attempts to access Delhi user's loan directly by ID (IDOR Attempt)
    const idorRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      headers: { Cookie: mumbaiUser.cookie },
    });
    assert(idorRes.status === 403, "Mumbai Branch User blocked from accessing Delhi loan by ID (403 IDOR Protection)");

    // Mumbai user attempts to query Delhi branch loans via query param ?branchId=...
    const crossQueryRes = await fetch(`${BASE_URL}/api/loans?branchId=${delhiUser.user.branchId}`, {
      headers: { Cookie: mumbaiUser.cookie },
    });
    assert(crossQueryRes.status === 403, "Mumbai Branch User blocked from querying Delhi branch list (403 Forbidden)");

    // Mumbai user attempts to update Delhi user's loan
    const crossUpdateRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: mumbaiUser.cookie,
      },
      body: JSON.stringify({ branchRemarks: "Malicious cross-branch edit" }),
    });
    assert(crossUpdateRes.status === 403, "Mumbai Branch User blocked from updating Delhi loan (403 Forbidden)");
  }

  // -------------------------------------------------------------------------
  // SCENARIO 3: Branch User Field-Level Privilege Restrictions
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 3: Branch User Field-Level Protection ---");
  {
    // Delhi user tries to approve their own loan
    const statusBypassRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiUser.cookie,
      },
      body: JSON.stringify({ status: "Approved" }),
    });
    assert(statusBypassRes.status === 403, "Branch User blocked from updating workflow status to 'Approved' (403 Forbidden)");

    // Delhi user tries to write adminRemarks
    const adminRemarkBypassRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiUser.cookie,
      },
      body: JSON.stringify({ adminRemarks: "Fake approval note" }),
    });
    assert(adminRemarkBypassRes.status === 403, "Branch User blocked from modifying adminRemarks (403 Forbidden)");

    // Delhi user legitimately updates branchRemarks
    const validBranchEditRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: delhiUser.cookie,
      },
      body: JSON.stringify({ branchRemarks: "Updated additional sponsor documents" }),
    });
    assert(validBranchEditRes.status === 200, "Branch User allowed to update permitted branch fields (branchRemarks)");
  }

  // -------------------------------------------------------------------------
  // SCENARIO 4: Viewer (Read-Only) Enforcement
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 4: Viewer Read-Only Enforcement ---");
  {
    // Viewer can read loans
    const viewerReadRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      headers: { Cookie: viewer.cookie },
    });
    assert(viewerReadRes.status === 200, "Viewer can read loan applications");

    // Viewer tries to create loan
    const viewerCreateRes = await fetch(`${BASE_URL}/api/loans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewer.cookie,
      },
      body: JSON.stringify({ sdmId: "SDM-VIEWER-ILLEGAL" }),
    });
    assert(viewerCreateRes.status === 403, "Viewer blocked from creating loan application (403 Forbidden)");

    // Viewer tries to update loan
    const viewerUpdateRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewer.cookie,
      },
      body: JSON.stringify({ branchRemarks: "Unauthorized Viewer edit" }),
    });
    assert(viewerUpdateRes.status === 403, "Viewer blocked from updating loan application (403 Forbidden)");

    // Viewer tries to delete loan
    const viewerDeleteRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "DELETE",
      headers: { Cookie: viewer.cookie },
    });
    assert(viewerDeleteRes.status === 403, "Viewer blocked from deleting loan application (403 Forbidden)");

    // Viewer tries to manage users
    const viewerUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: viewer.cookie },
    });
    assert(viewerUsersRes.status === 403, "Viewer blocked from accessing User Management (403 Forbidden)");
  }

  // -------------------------------------------------------------------------
  // SCENARIO 5: Admin Workflow & Management Restriction
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 5: Admin Workflow Scope & User Management Guard ---");
  {
    // Admin can read all applications
    const adminReadRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      headers: { Cookie: admin.cookie },
    });
    assert(adminReadRes.status === 200, "Admin can read application across branches");

    // Admin updates workflow status and admin remarks
    const adminWorkflowRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: admin.cookie,
      },
      body: JSON.stringify({
        status: "Under Review",
        adminRemarks: "Credit background verification in progress.",
      }),
    });
    assert(adminWorkflowRes.status === 200, "Admin can update workflow status and admin remarks");

    // Admin tries to modify student demographic fields
    const adminIllegalFieldRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: admin.cookie,
      },
      body: JSON.stringify({
        studentName: "Tampered Name",
      }),
    });
    assert(adminIllegalFieldRes.status === 403, "Admin blocked from altering student demographic fields (403 Forbidden)");

    // Admin tries to access user management
    const adminUserAccessRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: admin.cookie },
    });
    assert(adminUserAccessRes.status === 403, "Admin blocked from managing users (403 Forbidden)");

    // Admin tries to create branch
    const adminBranchCreateRes = await fetch(`${BASE_URL}/api/branches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: admin.cookie,
      },
      body: JSON.stringify({ name: "Rogue Branch", code: "ROGUE" }),
    });
    assert(adminBranchCreateRes.status === 403, "Admin blocked from creating branches (403 Forbidden)");

    // Admin CAN view audit logs
    const adminAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { Cookie: admin.cookie },
    });
    assert(adminAuditRes.status === 200, "Admin authorized to view system audit logs");
  }

  // -------------------------------------------------------------------------
  // SCENARIO 6: SuperAdmin Governance & Lifecycle Completion
  // -------------------------------------------------------------------------
  console.log("\n--- TEST SUITE 6: SuperAdmin Full Access & Deletion ---");
  {
    // SuperAdmin can access users
    const saUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: superadmin.cookie },
    });
    assert(saUsersRes.status === 200, "SuperAdmin can access User Directory");

    // SuperAdmin deletes test loan
    const saDeleteRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
      method: "DELETE",
      headers: { Cookie: superadmin.cookie },
    });
    assert(saDeleteRes.status === 200, "SuperAdmin can permanently delete loan application");
  }

  console.log("\n=================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error("Fatal error during security audit:", err);
  process.exit(1);
});
