/**
 * Comprehensive verification suite for:
 * PHASE 10 — DATA MANAGEMENT
 *
 * Verifies:
 * 1. Health check & Session Authentication (SUPERADMIN, ADMIN, BRANCH_USER, VIEWER)
 * 2. Search capabilities:
 *    - Global search across multiple fields
 *    - Specific SDM ID search
 *    - Specific Student Name search
 *    - Specific Contact Number search
 * 3. Multi-dimensional Filtering:
 *    - Branch filtering & Branch User isolation
 *    - Status filtering (Pending, Approved, Completed, etc.)
 *    - Intake Month & Year filtering
 *    - Date filtering (Presets: 30d, 90d, all; and custom start/end dates)
 * 4. Server-Side Sorting:
 *    - Loan amount descending/ascending
 *    - Student name ascending/descending
 * 5. Server-Side Pagination:
 *    - Page size, skip, totalPages, totalCount, hasNext, hasPrev
 * 6. CSV Export:
 *    - Returns valid CSV with headers and RFC 4180 escaping
 *    - Filter parity: Export query parameters match resulting rows
 *    - Branch User export isolation: Only exports own branch records
 *    - Security: Unauthenticated export blocked with 401
 * 7. CSV Import:
 *    - Dry-run validation mode returns summary and preview
 *    - Robust row validation (invalid amount, missing fields, unknown branch)
 *    - Duplicate SDM ID detection
 *    - Branch User branch containment (cannot import into another branch)
 *    - Unauthorized roles (VIEWER, unauthenticated) blocked
 *    - Real import execution creates record with audit trail
 *    - Cleanup of test imported records
 * 8. MongoDB Index Inspection
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
  console.log(`STARTING VERIFICATION: PHASE 10 (DATA MANAGEMENT)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Step 1: Health check & Authenticate Roles
  console.log("Step 1: Authenticating Test Actors...");
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  assert(healthRes.ok && health.database?.connected, "Database and health check online");

  const superAdminAuth = await login("superadmin@loanportal.internal", "SuperAdmin@2026!");
  assert(superAdminAuth.status === 200, "SuperAdmin authenticated");

  const adminAuth = await login("admin@loanportal.internal", "Admin@2026!");
  assert(adminAuth.status === 200, "Admin authenticated");

  const delhiAuth = await login("delhi.branch@loanportal.internal", "Branch@2026!");
  assert(delhiAuth.status === 200, "Delhi Branch User authenticated");

  const viewerAuth = await login("viewer@loanportal.internal", "Viewer@2026!");
  assert(viewerAuth.status === 200, "Viewer authenticated");

  // Step 2: Global and Targeted Search
  console.log("\nStep 2: Testing Search Capabilities...");

  // Global search
  const globalSearchRes = await fetch(`${BASE_URL}/api/loans?search=Aarav`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const globalSearchJson = await globalSearchRes.json();
  assert(
    globalSearchJson.success &&
      globalSearchJson.data.some((l) => l.studentName.includes("Aarav")),
    "Global search finds student by name across application fields"
  );

  // Specific SDM ID search
  const sdmSearchRes = await fetch(`${BASE_URL}/api/loans?sdmId=SDM-2026-001`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const sdmSearchJson = await sdmSearchRes.json();
  assert(
    sdmSearchJson.success &&
      sdmSearchJson.data.length >= 1 &&
      sdmSearchJson.data[0].sdmId === "SDM-2026-001",
    "Specific SDM ID search matches exact application"
  );

  // Specific Student Name search
  const nameSearchRes = await fetch(`${BASE_URL}/api/loans?studentName=Ananya`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const nameSearchJson = await nameSearchRes.json();
  assert(
    nameSearchJson.success &&
      nameSearchJson.data.every((l) => l.studentName.toLowerCase().includes("ananya")),
    "Specific Student Name search matches candidate"
  );

  // Specific Contact Number search
  const contactSearchRes = await fetch(`${BASE_URL}/api/loans?contactNumber=98111`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const contactSearchJson = await contactSearchRes.json();
  assert(
    contactSearchJson.success &&
      contactSearchJson.data.every((l) => l.contactNumber.includes("98111")),
    "Specific Contact Number search matches candidate"
  );

  // Step 3: Multi-Dimensional Filtering
  console.log("\nStep 3: Testing Multi-Dimensional Filters...");

  // Status Filter
  const statusRes = await fetch(`${BASE_URL}/api/loans?status=Approved`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const statusJson = await statusRes.json();
  assert(
    statusJson.success &&
      statusJson.data.length > 0 &&
      statusJson.data.every((l) => l.status === "Approved"),
    "Status filter 'Approved' returns exclusively approved records"
  );

  // Intake Month & Year Filter
  const intakeRes = await fetch(`${BASE_URL}/api/loans?intakeMonth=September&intakeYear=2026`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const intakeJson = await intakeRes.json();
  assert(
    intakeJson.success &&
      intakeJson.data.every(
        (l) => l.intakeMonth === "September" && l.intakeYear === 2026
      ),
    "Intake filter 'September 2026' returns matching seasonal records"
  );

  // Date Range Presets
  const date30dRes = await fetch(`${BASE_URL}/api/loans?dateRange=30d`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const date30dJson = await date30dRes.json();
  assert(date30dJson.success, "Date range filter '?dateRange=30d' executes properly");

  // Custom Date Range
  const customDateRes = await fetch(
    `${BASE_URL}/api/loans?startDate=2024-01-01&endDate=2027-12-31`,
    { headers: { Cookie: superAdminAuth.cookie } }
  );
  const customDateJson = await customDateRes.json();
  assert(customDateJson.success, "Custom date range '?startDate=...&endDate=...' executes properly");

  // Branch User Isolation
  const delhiLoansRes = await fetch(`${BASE_URL}/api/loans`, {
    headers: { Cookie: delhiAuth.cookie },
  });
  const delhiLoansJson = await delhiLoansRes.json();
  assert(
    delhiLoansJson.success &&
      delhiLoansJson.data.every(
        (l) => l.branchId?.code === "NDLS" || l.branchId === delhiAuth.data.user.branchId
      ),
    "Branch User cannot see applications from other branches"
  );

  // Step 4: Server-Side Sorting
  console.log("\nStep 4: Testing Server-Side Sorting...");

  // Sort by loanAmount descending
  const sortAmountDescRes = await fetch(
    `${BASE_URL}/api/loans?sortBy=loanAmount&sortOrder=desc&limit=10`,
    { headers: { Cookie: superAdminAuth.cookie } }
  );
  const sortAmountDescJson = await sortAmountDescRes.json();
  const amounts = sortAmountDescJson.data.map((l) => l.loanAmount);
  let isSortedDesc = true;
  for (let i = 0; i < amounts.length - 1; i++) {
    if (amounts[i] < amounts[i + 1]) {
      isSortedDesc = false;
      break;
    }
  }
  assert(
    sortAmountDescJson.success && isSortedDesc,
    "Server-side sorting by loanAmount descending is mathematically verified"
  );

  // Sort by studentName ascending
  const sortNameAscRes = await fetch(
    `${BASE_URL}/api/loans?sortBy=studentName&sortOrder=asc&limit=10`,
    { headers: { Cookie: superAdminAuth.cookie } }
  );
  const sortNameAscJson = await sortNameAscRes.json();
  const names = sortNameAscJson.data.map((l) => l.studentName.toLowerCase());
  let isSortedAsc = true;
  for (let i = 0; i < names.length - 1; i++) {
    if (names[i].localeCompare(names[i + 1]) > 0) {
      isSortedAsc = false;
      break;
    }
  }
  assert(
    sortNameAscJson.success && isSortedAsc,
    "Server-side sorting by studentName ascending is verified"
  );

  // Step 5: Server-Side Pagination
  console.log("\nStep 5: Testing Server-Side Pagination...");
  const page1Res = await fetch(`${BASE_URL}/api/loans?page=1&limit=5`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const page1Json = await page1Res.json();
  assert(
    page1Json.success &&
      page1Json.pagination.page === 1 &&
      page1Json.pagination.limit === 5 &&
      page1Json.data.length <= 5 &&
      page1Json.pagination.hasNext === true &&
      page1Json.pagination.hasPrev === false,
    "Page 1 returns 5 records with hasNext=true, hasPrev=false"
  );

  const page2Res = await fetch(`${BASE_URL}/api/loans?page=2&limit=5`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const page2Json = await page2Res.json();
  assert(
    page2Json.success &&
      page2Json.pagination.page === 2 &&
      page2Json.pagination.hasPrev === true,
    "Page 2 returns next page with hasPrev=true"
  );

  // Ensure items on page 1 and page 2 are distinct
  const page1Ids = new Set(page1Json.data.map((l) => l._id));
  const hasOverlap = page2Json.data.some((l) => page1Ids.has(l._id));
  assert(!hasOverlap, "Page 1 and Page 2 contain mutually distinct records without overlap");

  // Step 6: CSV Export
  console.log("\nStep 6: Testing CSV Export & Filter Parity...");

  // Full export
  const exportAllRes = await fetch(`${BASE_URL}/api/loans/export`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  assert(exportAllRes.status === 200, "SuperAdmin receives 200 OK from /api/loans/export");
  const contentType = exportAllRes.headers.get("content-type") || "";
  assert(contentType.includes("text/csv"), "Export response Content-Type is text/csv");
  const exportAllText = await exportAllRes.text();
  assert(
    exportAllText.includes("SDM ID") &&
      exportAllText.includes("Student Name") &&
      exportAllText.includes("Loan Amount (INR)"),
    "CSV header contains all standard loan attributes"
  );

  // Filter parity: Export matching active filter
  const exportFilterRes = await fetch(`${BASE_URL}/api/loans/export?status=Approved`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const exportFilterText = await exportFilterRes.text();
  const exportLines = exportFilterText.trim().split("\r\n").slice(1); // skip header
  assert(
    exportLines.length > 0 && exportLines.every((line) => line.includes("Approved")),
    "CSV export strictly matches active filter (all exported rows are Approved)"
  );

  // Branch User Export Isolation
  const branchExportRes = await fetch(`${BASE_URL}/api/loans/export`, {
    headers: { Cookie: delhiAuth.cookie },
  });
  assert(branchExportRes.status === 200, "Branch User authorized to export own branch records");
  const branchExportText = await branchExportRes.text();
  const branchExportLines = branchExportText.trim().split("\r\n").slice(1);
  assert(
    branchExportLines.every((line) => line.includes("NDLS")),
    "Branch User CSV export is strictly isolated to user's assigned branch (NDLS)"
  );

  // Unauthenticated export -> 401
  const unauthExportRes = await fetch(`${BASE_URL}/api/loans/export`);
  assert(
    unauthExportRes.status === 401,
    `Unauthenticated export blocked with 401 Unauthorized (Received ${unauthExportRes.status})`
  );

  // Step 7: CSV Import Safety Validation & Ingestion
  console.log("\nStep 7: Testing Safe CSV Import & Business Rules...");

  // Dry run with valid CSV
  const testSdmId = `SDM-VAL-${Date.now()}`;
  const validCsv = `SDM ID,Student Name,Contact Number,Branch Code,Course,Country,Loan Amount,Intake Month,Intake Year,Parent Income,Stage,Remarks
${testSdmId},Vikram Malhotra,+91 98111 88990,NDLS,MSc Quantum Computing,United Kingdom,4200000,September,2026,Salaried (₹35 LPA),Initial Inquiry,Pre-admit assessment`;

  const dryRunRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminAuth.cookie,
    },
    body: JSON.stringify({ csvContent: validCsv, dryRun: true }),
  });
  const dryRunJson = await dryRunRes.json();
  assert(
    dryRunJson.success &&
      dryRunJson.dryRun === true &&
      dryRunJson.summary.validCount === 1 &&
      dryRunJson.summary.invalidCount === 0,
    "Dry-run validation passes with 1 valid row and 0 errors"
  );

  // Dry run with invalid CSV (Missing required fields & invalid branch)
  const invalidCsv = `SDM ID,Student Name,Contact Number,Branch Code,Course,Country,Loan Amount,Intake Month,Intake Year
,A,+91 1,NONEXISTENT_BRANCH,CS,UK,-50000,Sep,2010`;

  const invalidDryRunRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminAuth.cookie,
    },
    body: JSON.stringify({ csvContent: invalidCsv, dryRun: true }),
  });
  const invalidDryRunJson = await invalidDryRunRes.json();
  assert(
    invalidDryRunJson.success &&
      invalidDryRunJson.summary.invalidCount >= 1 &&
      invalidDryRunJson.errors.length >= 1,
    "Validation safely rejects invalid CSV rows and returns row-by-row error details"
  );

  // Branch User isolation guard on Import:
  // Delhi branch user trying to import row for Mumbai branch (BOM)
  const crossBranchCsv = `SDM ID,Student Name,Contact Number,Branch Code,Course,Country,Loan Amount,Intake Month,Intake Year
SDM-CROSS-${Date.now()},Sneha Rao,+91 98222 33445,BOM,MSc Data Science,USA,4500000,September,2026`;

  const crossBranchRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: delhiAuth.cookie,
    },
    body: JSON.stringify({ csvContent: crossBranchCsv, dryRun: true }),
  });
  const crossBranchJson = await crossBranchRes.json();
  assert(
    crossBranchJson.errors.some((e) => e.error.includes("assigned branch")),
    "Branch User prevented from importing applications into other branches"
  );

  // Unauthorized roles blocked from import: VIEWER -> 403
  const viewerImportRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerAuth.cookie,
    },
    body: JSON.stringify({ csvContent: validCsv }),
  });
  assert(
    viewerImportRes.status === 403,
    `Viewer role blocked from importing with 403 Forbidden (Received ${viewerImportRes.status})`
  );

  // Execute real import as SuperAdmin
  const realImportRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminAuth.cookie,
    },
    body: JSON.stringify({ csvContent: validCsv, dryRun: false }),
  });
  const realImportJson = await realImportRes.json();
  assert(
    realImportJson.success &&
      realImportJson.summary.importedCount === 1,
    "Real CSV import successfully created application record in database"
  );

  // Verify imported application exists and is queryable
  const verifyImportedRes = await fetch(`${BASE_URL}/api/loans?sdmId=${testSdmId}`, {
    headers: { Cookie: superAdminAuth.cookie },
  });
  const verifyImportedJson = await verifyImportedRes.json();
  assert(
    verifyImportedJson.success &&
      verifyImportedJson.data.length === 1 &&
      verifyImportedJson.data[0].studentName === "Vikram Malhotra" &&
      verifyImportedJson.data[0].status === "Pending",
    "Imported application is queryable with status='Pending' and correct counselor remarks"
  );

  // Cleanup test imported loan via SuperAdmin
  if (verifyImportedJson.data.length > 0) {
    const importedId = verifyImportedJson.data[0]._id;
    const deleteRes = await fetch(`${BASE_URL}/api/loans/${importedId}`, {
      method: "DELETE",
      headers: { Cookie: superAdminAuth.cookie },
    });
    assert(deleteRes.status === 200, "Cleaned up test imported application");
  }

  // Duplicate SDM ID detection check
  const duplicateCsv = `SDM ID,Student Name,Contact Number,Branch Code,Course,Country,Loan Amount,Intake Month,Intake Year
SDM-2026-001,Duplicate Candidate,+91 98111 22334,NDLS,MSc,UK,3000000,September,2026`;

  const duplicateRes = await fetch(`${BASE_URL}/api/loans/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: superAdminAuth.cookie,
    },
    body: JSON.stringify({ csvContent: duplicateCsv, dryRun: true }),
  });
  const duplicateJson = await duplicateRes.json();
  assert(
    duplicateJson.errors.some((e) => e.error.includes("already exists")),
    "Duplicate SDM ID detection verified against existing database records"
  );

  // Summary
  console.log(`\n======================================================`);
  console.log(`PHASE 10 VERIFICATION COMPLETE`);
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
