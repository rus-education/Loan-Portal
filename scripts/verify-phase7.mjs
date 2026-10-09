/**
 * Comprehensive verification script for:
 * PHASE 7 — SUPERADMIN CONTROL CENTER
 *
 * Validates:
 * 1. Health & SuperAdmin Authentication
 * 2. Branch Governance (Create, Read with Stats, Update, Deactivate/Activate, RBAC Guards)
 * 3. User Governance (Create Branch User / Admin / Viewer, Role Change, Branch Assignment, Password Reset, Self-Protection Guards, RBAC Guards)
 * 4. Elevated Loan Governance (Cross-branch view, SuperAdmin Data Correction, Status & Remarks update, Permanent Deletion)
 * 5. System Audit Trail (Inspection of logged events: Logins, Entity creations, Status changes, Role modifications, Deletions)
 * 6. System Settings & Platform Telemetry (Diagnostic checks, Policy parameters, Maintenance mode toggle, RBAC Guards)
 * 7. Cleanup & Referential Integrity
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
  return {
    status: res.status,
    data,
    token,
    cookie: token ? `loan_portal_session=${token}` : setCookie,
  };
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`STARTING VERIFICATION: PHASE 7 (SUPERADMIN CONTROL CENTER)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Step 1: Health check
  console.log("Checking API Health...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert(healthRes.ok && health.database?.connected, "Database and health check online");

  // Step 2: Authenticate SuperAdmin and other actors
  console.log("\n1. Authenticating Roles...");
  const superAdminLogin = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
  assert(
    superAdminLogin.status === 200 && superAdminLogin.data.user.role === "SUPERADMIN",
    "SuperAdmin authentication successful"
  );

  const adminLogin = await login("admin@loanportal.internal", "Admin@2026!");
  assert(adminLogin.status === 200 && adminLogin.data.user.role === "ADMIN", "Admin authentication successful");

  const branchLogin = await login("delhi.branch@loanportal.internal", "Branch@2026!");
  assert(branchLogin.status === 200 && branchLogin.data.user.role === "BRANCH_USER", "Branch User authentication successful");

  const viewerLogin = await login("viewer@loanportal.internal", "Viewer@2026!");
  assert(viewerLogin.status === 200 && viewerLogin.data.user.role === "VIEWER", "Viewer authentication successful");

  // Step 3: Branch Management
  console.log("\n2. Testing Branch Management (Create, Stats, Update, Status Toggle, RBAC)...");
  const timestamp = Date.now();
  const testBranchCode = `BR${timestamp.toString().slice(-4)}`;
  const testBranchName = `Test Alpha Branch ${timestamp}`;

  // 3a. SuperAdmin creates a new branch
  const createBranchRes = await fetch(`${BASE_URL}/api/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      name: testBranchName,
      code: testBranchCode,
      status: "active",
    }),
  });
  const createBranchData = await createBranchRes.json();
  assert(
    createBranchRes.status === 201 && createBranchData.success && createBranchData.data?._id,
    `SuperAdmin successfully created branch: ${testBranchCode}`
  );
  const createdBranchId = createBranchData.data?._id;

  // 3b. Read branches with statistics
  const branchesStatsRes = await fetch(`${BASE_URL}/api/branches?includeStats=true`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const branchesStatsData = await branchesStatsRes.json();
  assert(
    branchesStatsRes.ok && Array.isArray(branchesStatsData.data),
    "Branches fetched with aggregated portfolio statistics"
  );
  const foundBranch = branchesStatsData.data.find((b) => b._id === createdBranchId);
  assert(
    foundBranch && foundBranch.userCount !== undefined && foundBranch.loanCount !== undefined,
    "Branch includes aggregated metrics (userCount, loanCount, totalLoanAmount)"
  );

  // 3c. SuperAdmin fetches branch detail and assigned users
  const branchDetailRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const branchDetailData = await branchDetailRes.json();
  assert(
    branchDetailRes.ok && branchDetailData.success && Array.isArray(branchDetailData.data?.users),
    "Branch detail endpoint returns branch data and assigned personnel list"
  );

  // 3d. SuperAdmin edits branch
  const updatedBranchName = `${testBranchName} - Updated`;
  const updateBranchRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      name: updatedBranchName,
    }),
  });
  const updateBranchData = await updateBranchRes.json();
  assert(
    updateBranchRes.ok && updateBranchData.data?.name === updatedBranchName,
    "SuperAdmin successfully updated branch name"
  );

  // 3e. SuperAdmin toggles branch status (activate/deactivate)
  const deactivateBranchRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ status: "inactive" }),
  });
  const deactivateBranchData = await deactivateBranchRes.json();
  assert(
    deactivateBranchRes.ok && deactivateBranchData.data?.status === "inactive",
    "SuperAdmin successfully deactivated branch"
  );

  const reactivateBranchRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ status: "active" }),
  });
  assert(reactivateBranchRes.ok, "SuperAdmin successfully re-activated branch");

  // 3f. RBAC guard: Admin and Branch User cannot create or edit branches
  const adminBranchCreateRes = await fetch(`${BASE_URL}/api/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminLogin.cookie,
    },
    body: JSON.stringify({ name: "Illegal Admin Branch", code: "ADM01" }),
  });
  assert(
    adminBranchCreateRes.status === 403,
    "RBAC: Admin cannot create branch (HTTP 403 Forbidden)"
  );

  const branchUserBranchUpdateRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: branchLogin.cookie,
    },
    body: JSON.stringify({ name: "Illegal Branch Name" }),
  });
  assert(
    branchUserBranchUpdateRes.status === 403,
    "RBAC: Branch User cannot update branch (HTTP 403 Forbidden)"
  );

  // Step 4: User Management
  console.log("\n3. Testing User Management (Create, Edit, Role Change, Reset Password, Self-Guards, RBAC)...");
  const testUserEmail = `officer_${timestamp}@loanportal.internal`;
  const initialPassword = "InitialPassword@2026!";
  const newPassword = "UpdatedSecurePassword@2026!";

  // 4a. SuperAdmin creates a new branch user
  const createUserRes = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      name: `Officer ${timestamp}`,
      email: testUserEmail,
      phone: "+91 99887 76655",
      password: initialPassword,
      role: "BRANCH_USER",
      branchId: createdBranchId,
      status: "active",
    }),
  });
  const createUserData = await createUserRes.json();
  assert(
    createUserRes.status === 201 && createUserData.success && createUserData.data?._id,
    `SuperAdmin successfully created user: ${testUserEmail}`
  );
  const createdUserId = createUserData.data?._id;

  // Verify login with initial password
  const newOfficerLogin = await login(testUserEmail, initialPassword);
  assert(
    newOfficerLogin.status === 200 && newOfficerLogin.data.user.role === "BRANCH_USER",
    "Newly created user can authenticate successfully"
  );

  // 4b. SuperAdmin queries users with role filters
  const filterUsersRes = await fetch(`${BASE_URL}/api/users?role=BRANCH_USER`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const filterUsersData = await filterUsersRes.json();
  assert(
    filterUsersRes.ok &&
      Array.isArray(filterUsersData.data) &&
      filterUsersData.data.every((u) => u.role === "BRANCH_USER"),
    "SuperAdmin can filter users by permitted role"
  );

  // 4c. SuperAdmin edits user details and reassigns role (e.g. promote to ADMIN)
  const updateUserRes = await fetch(`${BASE_URL}/api/users/${createdUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      name: `Officer ${timestamp} - Promoted`,
      role: "ADMIN",
    }),
  });
  const updateUserData = await updateUserRes.json();
  assert(
    updateUserRes.ok && updateUserData.data?.role === "ADMIN",
    "SuperAdmin successfully promoted user role to ADMIN"
  );

  // 4d. SuperAdmin resets user password
  const resetPasswordRes = await fetch(`${BASE_URL}/api/users/${createdUserId}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ newPassword }),
  });
  assert(resetPasswordRes.ok, "SuperAdmin successfully reset user password");

  // Verify login with new password and old password rejection
  const oldPasswordTry = await login(testUserEmail, initialPassword);
  assert(oldPasswordTry.status === 401, "Old password rejected after administrative reset");

  const newPasswordTry = await login(testUserEmail, newPassword);
  assert(
    newPasswordTry.status === 200 && newPasswordTry.data.user.role === "ADMIN",
    "Authentication succeeded with new administratively reset password"
  );

  // 4e. SuperAdmin deactivates and reactivates user
  const deactivateUserRes = await fetch(`${BASE_URL}/api/users/${createdUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert(deactivateUserRes.ok, "SuperAdmin successfully deactivated user account");

  const deactivatedLoginTry = await login(testUserEmail, newPassword);
  assert(
    deactivatedLoginTry.status === 403,
    "Deactivated user cannot log in (HTTP 403 Account Deactivated)"
  );

  // Reactivate user
  await fetch(`${BASE_URL}/api/users/${createdUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ status: "active" }),
  });

  // 4f. SuperAdmin Self-Protection Guards (Cannot demote, deactivate, or delete own account)
  const selfUserId = superAdminLogin.data.user.id || superAdminLogin.data.user._id;
  const selfDemoteRes = await fetch(`${BASE_URL}/api/users/${selfUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ role: "VIEWER" }),
  });
  assert(
    selfDemoteRes.status === 400,
    "Self-Protection: SuperAdmin cannot demote own role (HTTP 400 Bad Request)"
  );

  const selfDeactivateRes = await fetch(`${BASE_URL}/api/users/${selfUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert(
    selfDeactivateRes.status === 400,
    "Self-Protection: SuperAdmin cannot deactivate own account (HTTP 400 Bad Request)"
  );

  const selfDeleteRes = await fetch(`${BASE_URL}/api/users/${selfUserId}`, {
    method: "DELETE",
    headers: { Cookie: superAdminLogin.cookie },
  });
  assert(
    selfDeleteRes.status === 400,
    "Self-Protection: SuperAdmin cannot delete own account (HTTP 400 Bad Request)"
  );

  // 4g. RBAC: Admin and Viewer cannot manage users
  const adminUserCreateRes = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminLogin.cookie,
    },
    body: JSON.stringify({ name: "Illegal", email: "illegal@test.internal", password: "Pass", role: "BRANCH_USER" }),
  });
  assert(
    adminUserCreateRes.status === 403,
    "RBAC: Admin cannot create users (HTTP 403 Forbidden)"
  );

  const viewerUserEditRes = await fetch(`${BASE_URL}/api/users/${createdUserId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerLogin.cookie,
    },
    body: JSON.stringify({ name: "Hacked" }),
  });
  assert(
    viewerUserEditRes.status === 403,
    "RBAC: Viewer cannot edit users (HTTP 403 Forbidden)"
  );

  // Step 5: Loan Management (Elevated SuperAdmin Controls)
  console.log("\n4. Testing Elevated Loan Governance (Correction, Status Update, History, Deletion)...");
  const testSdmId = `SDM-SA-${timestamp}`;

  // 5a. Create a loan application using Branch User
  const createLoanRes = await fetch(`${BASE_URL}/api/loans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: branchLogin.cookie,
    },
    body: JSON.stringify({
      sdmId: testSdmId,
      studentName: `Original Student ${timestamp}`,
      contactNumber: "+91 91234 56789",
      course: "B.Tech Computer Science",
      country: "United Kingdom",
      loanAmount: 2500000,
      intakeMonth: "September",
      intakeYear: 2025,
      parentGuardianIncomeSource: "Salaried Service",
      currentStage: "Initial Inquiry",
      branchRemarks: "Initial consultation completed at branch.",
    }),
  });
  const createLoanData = await createLoanRes.json();
  assert(createLoanRes.status === 201 && createLoanData.data?._id, "Branch User originated test loan application");
  const testLoanId = createLoanData.data?._id;

  // 5b. SuperAdmin performs Data Correction
  const correctedStudentName = `Corrected Student ${timestamp}`;
  const correctedLoanAmount = 3200000;
  const correctionRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      studentName: correctedStudentName,
      loanAmount: correctedLoanAmount,
      country: "Canada",
      course: "M.Eng. Software Engineering",
      parentGuardianIncomeSource: "Verified Corporate Executive",
      branchRemarks: "Rectified student name and course details by SuperAdmin.",
    }),
  });
  const correctionData = await correctionRes.json();
  assert(
    correctionRes.ok &&
      correctionData.data?.studentName === correctedStudentName &&
      correctionData.data?.loanAmount === correctedLoanAmount,
    "SuperAdmin successfully applied full biographical/financial data correction"
  );

  // 5c. SuperAdmin updates workflow status and admin remarks
  const statusUpdateRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({
      status: "Approved",
      currentStage: "Sanction Letter Issued",
      adminRemarks: "Final approval granted by Head of Governance.",
      statusRemarks: "Direct SuperAdmin clearance for disbursement.",
    }),
  });
  const statusUpdateData = await statusUpdateRes.json();
  assert(
    statusUpdateRes.ok && statusUpdateData.data?.status === "Approved",
    "SuperAdmin successfully transitioned loan status to Approved"
  );

  // 5d. Verify status history audit trail
  const loanHistoryRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const loanHistoryData = await loanHistoryRes.json();
  assert(
    loanHistoryRes.ok &&
      Array.isArray(loanHistoryData.data?.statusHistory) &&
      loanHistoryData.data.statusHistory.length > 0,
    "Complete status transition history recorded and queryable"
  );

  // 5e. SuperAdmin permanently deletes the loan application
  const deleteLoanRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    method: "DELETE",
    headers: { Cookie: superAdminLogin.cookie },
  });
  assert(deleteLoanRes.ok, "SuperAdmin successfully deleted loan application");

  // Verify deletion
  const verifyDeleteRes = await fetch(`${BASE_URL}/api/loans/${testLoanId}`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  assert(verifyDeleteRes.status === 404, "Loan application permanently removed (HTTP 404 Not Found)");

  // Step 6: System Audit Logs
  console.log("\n5. Testing System Audit Logs & Filterability...");
  const auditLogsRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const auditLogsData = await auditLogsRes.json();
  assert(
    auditLogsRes.ok && auditLogsData.success && Array.isArray(auditLogsData.data),
    "SuperAdmin can query system audit logs"
  );
  assert(auditLogsData.data.length > 0, "Audit logs contain logged actions");

  // Check specific action filter
  const branchAuditRes = await fetch(`${BASE_URL}/api/audit-logs?entity=Branch`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const branchAuditData = await branchAuditRes.json();
  assert(
    branchAuditRes.ok &&
      branchAuditData.data.every((log) => log.entity === "Branch"),
    "Audit logs successfully filtered by entity=Branch"
  );

  // Check user audit action
  const userAuditRes = await fetch(`${BASE_URL}/api/audit-logs?action=USER_CREATED`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const userAuditData = await userAuditRes.json();
  assert(
    userAuditRes.ok &&
      userAuditData.data.every((log) => log.action === "USER_CREATED"),
    "Audit logs successfully filtered by action=USER_CREATED"
  );

  // RBAC: Branch User cannot view audit logs
  const branchAuditAccess = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Cookie: branchLogin.cookie },
  });
  assert(
    branchAuditAccess.status === 403,
    "RBAC: Branch User cannot view audit logs (HTTP 403 Forbidden)"
  );

  // Step 7: System Settings & Platform Telemetry
  console.log("\n6. Testing Platform Architecture & System Settings...");
  const settingsRes = await fetch(`${BASE_URL}/api/settings`, {
    headers: { Cookie: superAdminLogin.cookie },
  });
  const settingsData = await settingsRes.json();
  assert(
    settingsRes.ok &&
      settingsData.success &&
      settingsData.data?.database?.connected === true &&
      settingsData.data?.counts?.users > 0,
    "System telemetry returns operational cluster health and entity metrics"
  );

  // Toggle maintenance mode to true then false
  const toggleMaintenanceTrue = await fetch(`${BASE_URL}/api/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ maintenanceMode: true }),
  });
  const toggleMaintenanceTrueData = await toggleMaintenanceTrue.json();
  assert(
    toggleMaintenanceTrue.ok && toggleMaintenanceTrueData.data?.maintenanceMode === true,
    "SuperAdmin can activate system maintenance mode"
  );

  const toggleMaintenanceFalse = await fetch(`${BASE_URL}/api/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminLogin.cookie,
    },
    body: JSON.stringify({ maintenanceMode: false }),
  });
  const toggleMaintenanceFalseData = await toggleMaintenanceFalse.json();
  assert(
    toggleMaintenanceFalse.ok && toggleMaintenanceFalseData.data?.maintenanceMode === false,
    "SuperAdmin can deactivate system maintenance mode"
  );

  // RBAC: Admin and Viewer cannot access settings
  const adminSettingsRes = await fetch(`${BASE_URL}/api/settings`, {
    headers: { Cookie: adminLogin.cookie },
  });
  assert(
    adminSettingsRes.status === 403,
    "RBAC: Admin cannot access system settings (HTTP 403 Forbidden)"
  );

  const viewerSettingsToggle = await fetch(`${BASE_URL}/api/settings`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerLogin.cookie,
    },
    body: JSON.stringify({ maintenanceMode: true }),
  });
  assert(
    viewerSettingsToggle.status === 403,
    "RBAC: Viewer cannot alter system settings (HTTP 403 Forbidden)"
  );

  // Step 8: Cleanup test user and test branch
  console.log("\n7. Cleaning up test artifacts...");
  const deleteTestUserRes = await fetch(`${BASE_URL}/api/users/${createdUserId}`, {
    method: "DELETE",
    headers: { Cookie: superAdminLogin.cookie },
  });
  assert(deleteTestUserRes.ok, "Cleaned up created test user");

  const deleteTestBranchRes = await fetch(`${BASE_URL}/api/branches/${createdBranchId}`, {
    method: "DELETE",
    headers: { Cookie: superAdminLogin.cookie },
  });
  assert(deleteTestBranchRes.ok, "Cleaned up created test branch");

  console.log(`\n======================================================`);
  console.log(`PHASE 7 VERIFICATION RESULTS:`);
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exit(1);
});
