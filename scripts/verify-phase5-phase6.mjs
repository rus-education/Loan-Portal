/**
 * Comprehensive verification script for:
 * - PHASE 5: ADMIN PORTAL
 * - PHASE 6: VIEWER PORTAL
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/loan_portal_session=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;
  return { status: res.status, data, token, cookie: token ? `loan_portal_session=${token}` : setCookie };
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`STARTING VERIFICATION: PHASE 5 (ADMIN) & PHASE 6 (VIEWER)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Step 1: Health check
  console.log("Checking API Health...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert(healthRes.ok && health.database?.connected, "Database and health check online");

  // Step 2: Logins
  console.log("\n1. Authenticating Roles...");
  const adminLogin = await login("admin@loanportal.internal", "Admin@2026!");
  assert(adminLogin.status === 200 && adminLogin.data.user.role === "ADMIN", "Admin authentication successful");

  const branchLogin = await login("delhi.branch@loanportal.internal", "Branch@2026!");
  assert(branchLogin.status === 200 && branchLogin.data.user.role === "BRANCH_USER", "Branch User authentication successful");

  const viewerLogin = await login("viewer@loanportal.internal", "Viewer@2026!");
  assert(viewerLogin.status === 200 && viewerLogin.data.user.role === "VIEWER", "Viewer authentication successful");

  // Step 3: Create test loan application via Branch User
  console.log("\n2. Creating Test Loan Application via Branch User...");
  const timestamp = Date.now();
  const testSdmId = `SDM-E2E-${timestamp}`;
  const createRes = await fetch(`${BASE_URL}/api/loans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: branchLogin.cookie,
    },
    body: JSON.stringify({
      sdmId: testSdmId,
      studentName: `Test Student ${timestamp}`,
      contactNumber: "+91 98765 43210",
      course: "M.S. in Computer Science",
      country: "United States",
      loanAmount: 4500000,
      intakeMonth: "September",
      intakeYear: 2025,
      parentGuardianIncomeSource: "Business Proprietor - IT Services",
      currentStage: "Initial Inquiry",
      branchRemarks: "Applicant has strong GRE score and admit letter.",
    }),
  });
  const createData = await createRes.json();
  assert(createRes.status === 201 && createData.success, "Loan application created successfully by branch user");
  const testLoanId = createData.data._id;
  const delhiBranchId = createData.data.branchId._id;

  // Step 4: Admin Portal Capabilities (PHASE 5)
  console.log("\n3. Testing Admin Portal Capabilities (PHASE 5)...");

  // 4a. View all branches
  const adminListRes = await fetch(`${BASE_URL}/api/loans`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminList = await adminListRes.json();
  assert(adminListRes.ok && adminList.success && adminList.data.length > 0, "Admin can retrieve loans across all branches");

  // 4b. Filter by branch
  const adminBranchFilterRes = await fetch(`${BASE_URL}/api/loans?branchId=${delhiBranchId}`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminBranchFilter = await adminBranchFilterRes.json();
  const allMatchBranch = adminBranchFilter.data.every((l) => String(l.branchId._id) === String(delhiBranchId));
  assert(adminBranchFilter.success && allMatchBranch, "Admin can filter applications by specific branch");

  // 4c. Filter by status
  const adminStatusFilterRes = await fetch(`${BASE_URL}/api/loans?status=Pending`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminStatusFilter = await adminStatusFilterRes.json();
  const allMatchStatus = adminStatusFilter.data.every((l) => l.status === "Pending");
  assert(adminStatusFilter.success && allMatchStatus, "Admin can filter applications by status ('Pending')");

  // 4d. Filter by intake month & year
  const adminIntakeFilterRes = await fetch(`${BASE_URL}/api/loans?intakeMonth=September&intakeYear=2025`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminIntakeFilter = await adminIntakeFilterRes.json();
  assert(adminIntakeFilter.success, "Admin can filter applications by intake month & year");

  // 4e. Search SDM ID and student name
  const adminSearchRes = await fetch(`${BASE_URL}/api/loans?search=${testSdmId}`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminSearch = await adminSearchRes.json();
  assert(adminSearch.success && adminSearch.data.length === 1 && adminSearch.data[0].sdmId === testSdmId, "Admin can search by exact SDM ID");

  // 4f. Column sorting
  const adminSortDescRes = await fetch(`${BASE_URL}/api/loans?sortBy=loanAmount&sortOrder=desc`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminSortDesc = await adminSortDescRes.json();
  assert(adminSortDesc.success && adminSortDesc.data.length > 0, "Admin can sort by loan amount descending");

  // 4g. Application Detail: Complete branch-submitted information
  const adminDetailRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const adminDetail = await adminDetailRes.json();
  assert(
    adminDetail.success &&
      adminDetail.data.studentName.includes("Test Student") &&
      adminDetail.data.course === "M.S. in Computer Science" &&
      adminDetail.data.branchRemarks === "Applicant has strong GRE score and admit letter.",
    "Admin detail shows complete branch-submitted information"
  );

  // 4h. Admin status transition: Pending -> Under Review
  console.log("\n4. Testing Admin Workflow Status & Adjudication Transitions...");
  const patch1Res = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminLogin.cookie,
    },
    body: JSON.stringify({
      status: "Under Review",
      currentStage: "Credit Evaluation",
      adminRemarks: "Underwriting evaluation initialized. Preliminary credit check passed.",
      statusRemarks: "Initial assessment completed by Senior Loan Admin",
    }),
  });
  const patch1 = await patch1Res.json();
  assert(patch1Res.ok && patch1.success, "Admin can change status to 'Under Review' with remarks and stage");
  assert(
    patch1.data.status === "Under Review" &&
      patch1.data.currentStage === "Credit Evaluation" &&
      patch1.data.adminRemarks.includes("Underwriting evaluation initialized"),
    "Updated loan reflects new status, stage, and admin remarks"
  );

  // 4i. Admin status transition: Under Review -> In Progress
  const patch2Res = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminLogin.cookie,
    },
    body: JSON.stringify({
      status: "In Progress",
      currentStage: "Bank Submission",
      adminRemarks: "Application submitted to partner bank credit division.",
      statusRemarks: "Forwarded to Axis / HDFC education loan desk",
    }),
  });
  const patch2 = await patch2Res.json();
  assert(patch2Res.ok && patch2.data.status === "In Progress", "Admin can change status to 'In Progress'");

  // 4j. Admin status transition: In Progress -> Approved
  const patch3Res = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminLogin.cookie,
    },
    body: JSON.stringify({
      status: "Approved",
      currentStage: "Sanction Letter Issued",
      adminRemarks: "Formal sanction letter issued for INR 45,00,000.",
      statusRemarks: "Sanction authorized by Credit Committee",
    }),
  });
  const patch3 = await patch3Res.json();
  assert(patch3Res.ok && patch3.data.status === "Approved", "Admin can change status to 'Approved'");

  // 4k. Verify Status History Timeline sequence
  const detailWithHistoryRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    headers: { Cookie: adminLogin.cookie },
  });
  const detailWithHistory = await detailWithHistoryRes.json();
  const history = detailWithHistory.data.statusHistory || [];
  console.log(`  Status History Events (${history.length}):`);
  history.forEach((h, i) => {
    console.log(`    Step ${i + 1}: ${h.fromStatus} -> ${h.toStatus} (by: ${h.changedByName || "System"}) | "${h.remarks}"`);
  });

  const hasPendingToUnderReview = history.some((h) => h.fromStatus === "Pending" && h.toStatus === "Under Review");
  const hasUnderReviewToInProgress = history.some((h) => h.fromStatus === "Under Review" && h.toStatus === "In Progress");
  const hasInProgressToApproved = history.some((h) => h.fromStatus === "In Progress" && h.toStatus === "Approved");
  assert(
    hasPendingToUnderReview && hasUnderReviewToInProgress && hasInProgressToApproved,
    "Status history records complete progression: Pending -> Under Review -> In Progress -> Approved"
  );

  // 4l. Admin restrictions: Users, Branches, Deletion
  console.log("\n5. Testing Admin Restrictions (Admin cannot manage users, branches, or settings)...");

  // Admin cannot GET users
  const adminUsersGet = await fetch(`${BASE_URL}/api/users`, {
    headers: { Cookie: adminLogin.cookie },
  });
  assert(adminUsersGet.status === 403, "Admin CANNOT access /api/users (403 Forbidden)");

  // Admin cannot POST users
  const adminUserPost = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminLogin.cookie },
    body: JSON.stringify({ name: "Hacked", email: "hacked@admin.com", password: "123", role: "ADMIN" }),
  });
  assert(adminUserPost.status === 403, "Admin CANNOT create users via /api/users (403 Forbidden)");

  // Admin cannot create branches
  const adminBranchPost = await fetch(`${BASE_URL}/api/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminLogin.cookie },
    body: JSON.stringify({ name: "Illegal Branch", code: "ILLG" }),
  });
  assert(adminBranchPost.status === 403, "Admin CANNOT create branches via /api/branches (403 Forbidden)");

  // Admin cannot delete loan applications
  const adminDeleteLoan = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "DELETE",
    headers: { Cookie: adminLogin.cookie },
  });
  assert(adminDeleteLoan.status === 403, "Admin CANNOT delete loan applications (403 Forbidden)");

  // Step 5: Viewer Portal Capabilities (PHASE 6)
  console.log("\n6. Testing Viewer Portal Capabilities (PHASE 6 - Strictly Read-Only)...");

  // 5a. Viewer can list all applications
  const viewerListRes = await fetch(`${BASE_URL}/api/loans`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  const viewerList = await viewerListRes.json();
  assert(viewerListRes.ok && viewerList.success && viewerList.data.length > 0, "Viewer can retrieve loan records across all branches");

  // 5b. Viewer can filter by branch
  const viewerBranchFilterRes = await fetch(`${BASE_URL}/api/loans?branchId=${delhiBranchId}`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  const viewerBranchFilter = await viewerBranchFilterRes.json();
  assert(viewerBranchFilter.success, "Viewer can filter by branch");

  // 5c. Viewer can filter by status
  const viewerStatusFilterRes = await fetch(`${BASE_URL}/api/loans?status=Approved`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  const viewerStatusFilter = await viewerStatusFilterRes.json();
  assert(viewerStatusFilter.success, "Viewer can filter by status ('Approved')");

  // 5d. Viewer can search by SDM ID
  const viewerSearchRes = await fetch(`${BASE_URL}/api/loans?search=${testSdmId}`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  const viewerSearch = await viewerSearchRes.json();
  assert(viewerSearch.success && viewerSearch.data.length === 1, "Viewer can search applications by SDM ID");

  // 5e. Viewer can view complete application detail including admin remarks and status history
  const viewerDetailRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  const viewerDetail = await viewerDetailRes.json();
  assert(
    viewerDetail.success &&
      viewerDetail.data.status === "Approved" &&
      viewerDetail.data.currentStage === "Sanction Letter Issued" &&
      viewerDetail.data.adminRemarks.includes("Formal sanction letter issued") &&
      viewerDetail.data.branchRemarks === "Applicant has strong GRE score and admit letter." &&
      viewerDetail.data.statusHistory?.length >= 3,
    "Viewer can view complete application detail, branch remarks, admin remarks, and status timeline"
  );

  // Step 6: Viewer Restrictions (Viewer cannot modify anything)
  console.log("\n7. Testing Viewer Restrictions (Read-Only Enforcement)...");

  // Viewer cannot create application
  const viewerCreateRes = await fetch(`${BASE_URL}/api/loans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: viewerLogin.cookie },
    body: JSON.stringify({
      sdmId: `SDM-VIEWER-${Date.now()}`,
      studentName: "Viewer Should Fail",
      contactNumber: "+91 99999 99999",
      branchId: delhiBranchId,
      course: "MBA",
      country: "UK",
      loanAmount: 2000000,
      intakeMonth: "Fall",
      intakeYear: 2025,
      parentGuardianIncomeSource: "Salaried",
    }),
  });
  assert(viewerCreateRes.status === 403, "Viewer CANNOT create loan applications (403 Forbidden)");

  // Viewer cannot edit application fields
  const viewerPatchRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: viewerLogin.cookie },
    body: JSON.stringify({ loanAmount: 9999999 }),
  });
  assert(viewerPatchRes.status === 403, "Viewer CANNOT edit loan fields (403 Forbidden)");

  // Viewer cannot change status
  const viewerStatusPatchRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: viewerLogin.cookie },
    body: JSON.stringify({ status: "Rejected" }),
  });
  assert(viewerStatusPatchRes.status === 403, "Viewer CANNOT change loan workflow status (403 Forbidden)");

  // Viewer cannot add admin remarks
  const viewerRemarksPatchRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: viewerLogin.cookie },
    body: JSON.stringify({ adminRemarks: "Tampered by Viewer" }),
  });
  assert(viewerRemarksPatchRes.status === 403, "Viewer CANNOT add or update admin remarks (403 Forbidden)");

  // Viewer cannot delete application
  const viewerDeleteRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "DELETE",
    headers: { Cookie: viewerLogin.cookie },
  });
  assert(viewerDeleteRes.status === 403, "Viewer CANNOT delete applications (403 Forbidden)");

  // Viewer cannot access users
  const viewerUsersRes = await fetch(`${BASE_URL}/api/users`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  assert(viewerUsersRes.status === 403, "Viewer CANNOT access user management (403 Forbidden)");

  // Viewer cannot create branches
  const viewerBranchesRes = await fetch(`${BASE_URL}/api/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: viewerLogin.cookie },
    body: JSON.stringify({ name: "Viewer Branch", code: "VWBR" }),
  });
  assert(viewerBranchesRes.status === 403, "Viewer CANNOT create branches (403 Forbidden)");

  // Viewer cannot access audit logs
  const viewerAuditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: viewerLogin.cookie },
  });
  assert(viewerAuditRes.status === 403, "Viewer CANNOT view audit logs (403 Forbidden)");

  // Step 7: Clean up test loan application via Superadmin
  console.log("\n8. Cleaning up test application via Superadmin...");
  const superLogin = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
  const deleteRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "DELETE",
    headers: { Cookie: superLogin.cookie },
  });
  assert(deleteRes.ok, "Superadmin cleaned up test loan application successfully");

  // Summary
  console.log(`\n======================================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
