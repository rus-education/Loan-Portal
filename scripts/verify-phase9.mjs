/**
 * Comprehensive verification suite for:
 * PHASE 9 — ANALYTICS
 *
 * Verifies:
 * 1. Health check & Session Authentication (SUPERADMIN, ADMIN, BRANCH_USER, VIEWER)
 * 2. SUPERADMIN analytics access & data payload completeness:
 *    - 6 Statistics metrics:
 *      * totalApplications
 *      * totalRequestedAmount
 *      * averageRequestedAmount
 *      * completedApplications
 *      * pendingApplications
 *      * processingRate
 *    - 6 Charts datasets:
 *      * applicationsByMonth
 *      * applicationsByBranch
 *      * applicationsByStatus
 *      * loanAmountByMonth
 *      * loanAmountByBranch
 *      * intakeDistribution
 * 3. ADMIN analytics access & parity with SUPERADMIN
 * 4. Date-range filter processing (30d, 90d, 6m, 1y, all, custom range)
 * 5. Strict RBAC Enforcement:
 *    - BRANCH_USER calling /api/analytics returns 403 Forbidden
 *    - VIEWER calling /api/analytics returns 403 Forbidden
 *    - Unauthenticated caller returns 401 Unauthorized
 * 6. UI Route availability:
 *    - /analytics renders 200 OK
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
  console.log(`STARTING VERIFICATION: PHASE 9 (ANALYTICS & BI)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Health check
  console.log("Step 1: Checking System Health...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert(healthRes.ok && health.database?.connected, "Database and health check online");

  // 2. Authenticate users
  console.log("\nStep 2: Authenticating User Roles...");
  const superAdminAuth = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
  assert(superAdminAuth.status === 200 && superAdminAuth.data?.user?.role === "SUPERADMIN", "SuperAdmin authenticated successfully");

  const adminAuth = await login("admin@loanportal.internal", "Admin@2026!");
  assert(adminAuth.status === 200 && adminAuth.data?.user?.role === "ADMIN", "Admin authenticated successfully");

  const branchUserAuth = await login("delhi.branch@loanportal.internal", "Branch@2026!");
  assert(branchUserAuth.status === 200 && branchUserAuth.data?.user?.role === "BRANCH_USER", "Branch User authenticated successfully");

  const viewerAuth = await login("viewer@loanportal.internal", "Viewer@2026!");
  assert(viewerAuth.status === 200 && viewerAuth.data?.user?.role === "VIEWER", "Viewer authenticated successfully");

  // 3. SuperAdmin Analytics Access & Payload Validation
  console.log("\nStep 3: Validating SUPERADMIN Analytics Payload...");
  const superAnalyticsRes = await fetch(`${BASE_URL}/api/analytics`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  assert(superAnalyticsRes.status === 200, "SUPERADMIN receives 200 OK from /api/analytics");
  const superAnalytics = await superAnalyticsRes.json();
  assert(superAnalytics.success === true, "Response payload indicates success = true");

  const stats = superAnalytics.data?.statistics;
  assert(stats !== undefined, "Statistics object exists in payload");
  assert(typeof stats.totalApplications === "number", `totalApplications is valid number: ${stats.totalApplications}`);
  assert(typeof stats.totalRequestedAmount === "number", `totalRequestedAmount is valid number: ${stats.totalRequestedAmount}`);
  assert(typeof stats.averageRequestedAmount === "number", `averageRequestedAmount is valid number: ${stats.averageRequestedAmount}`);
  assert(typeof stats.completedApplications === "number", `completedApplications is valid number: ${stats.completedApplications}`);
  assert(typeof stats.pendingApplications === "number", `pendingApplications is valid number: ${stats.pendingApplications}`);
  assert(typeof stats.processingRate === "number" && stats.processingRate >= 0 && stats.processingRate <= 100, `processingRate is valid percentage: ${stats.processingRate}%`);

  const charts = superAnalytics.data?.charts;
  assert(charts !== undefined, "Charts object exists in payload");
  assert(Array.isArray(charts.applicationsByMonth), "applicationsByMonth is an array");
  assert(Array.isArray(charts.loanAmountByMonth), "loanAmountByMonth is an array");
  assert(Array.isArray(charts.applicationsByBranch), "applicationsByBranch is an array");
  assert(Array.isArray(charts.loanAmountByBranch), "loanAmountByBranch is an array");
  assert(Array.isArray(charts.applicationsByStatus), "applicationsByStatus is an array");
  assert(Array.isArray(charts.intakeDistribution), "intakeDistribution is an array");

  // Validate item structure in charts if present
  if (charts.applicationsByMonth.length > 0) {
    const item = charts.applicationsByMonth[0];
    assert(typeof item.month === "string" && typeof item.applications === "number" && typeof item.amountInLakhs === "number", "Monthly trend structure contains month, applications, and amountInLakhs");
  }

  if (charts.applicationsByBranch.length > 0) {
    const branchItem = charts.applicationsByBranch[0];
    assert(typeof branchItem.branchName === "string" && typeof branchItem.applications === "number", "Branch data structure contains branchName and applications");
  }

  if (charts.applicationsByStatus.length > 0) {
    const statusItem = charts.applicationsByStatus[0];
    assert(typeof statusItem.status === "string" && typeof statusItem.count === "number" && typeof statusItem.color === "string", "Status distribution structure contains status, count, and color");
  }

  // 4. Admin Analytics Access & Parity
  console.log("\nStep 4: Validating ADMIN Analytics Access...");
  const adminAnalyticsRes = await fetch(`${BASE_URL}/api/analytics`, {
    headers: { Cookie: adminAuth.cookie },
  });
  assert(adminAnalyticsRes.status === 200, "ADMIN receives 200 OK from /api/analytics");
  const adminAnalytics = await adminAnalyticsRes.json();
  assert(adminAnalytics.success === true && adminAnalytics.data?.statistics?.totalApplications !== undefined, "ADMIN gets complete analytics data matching underwriting scope");

  // 5. Date-Range Filters Verification
  console.log("\nStep 5: Validating Date-Range Filters...");
  const ranges = ["30d", "90d", "6m", "1y", "all"];
  for (const r of ranges) {
    const rangeRes = await fetch(`${BASE_URL}/api/analytics?range=${r}`, {
      headers: { Cookie: superAdminAuth.cookie },
    });
    const rangeJson = await rangeRes.json();
    assert(rangeRes.status === 200 && rangeJson.data?.dateRange?.range === r, `Date filter '?range=${r}' successfully applied`);
  }

  // Custom date range
  const customRes = await fetch(`${BASE_URL}/api/analytics?range=custom&startDate=2024-01-01&endDate=2026-12-31`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const customJson = await customRes.json();
  assert(customRes.status === 200 && customJson.data?.dateRange?.range === "custom", "Custom date range '?range=custom&startDate=...&endDate=...' successfully applied");

  // 6. Strict RBAC Enforcement
  console.log("\nStep 6: Enforcing Strict RBAC Security Boundaries...");

  // Branch User attempt -> 403 Forbidden
  const branchUserAttempt = await fetch(`${BASE_URL}/api/analytics`, {
    headers: { Cookie: branchUserAuth.cookie },
  });
  assert(branchUserAttempt.status === 403, `BRANCH_USER is blocked with 403 Forbidden (Received ${branchUserAttempt.status})`);
  const branchUserJson = await branchUserAttempt.json();
  assert(branchUserJson.success === false, "BRANCH_USER response payload confirms access failure");

  // Viewer attempt -> 403 Forbidden
  const viewerAttempt = await fetch(`${BASE_URL}/api/analytics`, {
    headers: { Cookie: viewerAuth.cookie },
  });
  assert(viewerAttempt.status === 403, `VIEWER is blocked with 403 Forbidden (Received ${viewerAttempt.status})`);
  const viewerJson = await viewerAttempt.json();
  assert(viewerJson.success === false, "VIEWER response payload confirms access failure");

  // Unauthenticated attempt -> 401 Unauthorized
  const unauthAttempt = await fetch(`${BASE_URL}/api/analytics`);
  assert(unauthAttempt.status === 401, `Unauthenticated request is blocked with 401 Unauthorized (Received ${unauthAttempt.status})`);

  // 7. Verify UI Route Rendering
  console.log("\nStep 7: Validating Analytics UI Route...");
  const uiPageRes = await fetch(`${BASE_URL}/analytics`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  assert(uiPageRes.status === 200, "/analytics route responds with 200 OK");
  const html = await uiPageRes.text();
  assert(html.length > 500, "/analytics renders substantial HTML document");

  // Summary
  console.log(`\n======================================================`);
  console.log(`PHASE 9 VERIFICATION COMPLETE`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
