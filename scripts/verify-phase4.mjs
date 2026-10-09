const BASE_URL = "http://localhost:3000";

async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}`);
  const cookie = res.headers.get("set-cookie");
  const data = await res.json();
  return { cookie, user: data.user };
}

async function testPhase4() {
  console.log("=== PHASE 4: BRANCH USER PORTAL INTEGRATION VERIFICATION ===\n");

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

  // 1. Login as Delhi Branch User
  const delhiActor = await loginUser("delhi.branch@loanportal.internal", "Branch@2026!");
  console.log(`✓ Authenticated as: ${delhiActor.user.name} (${delhiActor.user.branchName})`);

  // 2. Login as Mumbai Branch User
  const mumbaiActor = await loginUser("mumbai.branch@loanportal.internal", "Branch@2026!");
  console.log(`✓ Authenticated as: ${mumbaiActor.user.name} (${mumbaiActor.user.branchName})\n`);

  // 3. Create Loan Application (Form Submission)
  console.log("--- 1. Testing New Loan Application Submission ---");
  const createPayload = {
    sdmId: "SDM-DELHI-PHASE4-01",
    studentName: "Tanvi Deshmukh",
    contactNumber: "+91 98765 12345",
    course: "M.Sc. Business Analytics",
    country: "United Kingdom",
    loanAmount: 3200000,
    intakeMonth: "September",
    intakeYear: 2026,
    parentGuardianIncomeSource: "Business / Entrepreneurship",
    currentStage: "Document Collection",
    branchRemarks: "Passport and GMAT score verified by Delhi branch.",
  };

  const createRes = await fetch(`${BASE_URL}/api/loans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: delhiActor.cookie,
    },
    body: JSON.stringify(createPayload),
  });

  const createData = await createRes.json();
  assert(createRes.status === 201 && createData.success, "Loan application created successfully");
  const loanId = createData.data?._id;

  assert(createData.data?.sdmId === "SDM-DELHI-PHASE4-01", "SDM ID stored correctly");
  assert(createData.data?.studentName === "Tanvi Deshmukh", "Student name stored correctly");
  assert(createData.data?.status === "Pending", "Initial workflow status locked to 'Pending'");
  assert(createData.data?.branchId?._id === delhiActor.user.branchId, "Branch locked to user's assigned branch");

  // 4. Test Branch User Loan Listing & Isolation
  console.log("\n--- 2. Testing Branch Isolated Loan Listing ---");
  const delhiListRes = await fetch(`${BASE_URL}/api/loans`, {
    headers: { Cookie: delhiActor.cookie },
  });
  const delhiListData = await delhiListRes.json();
  assert(delhiListRes.status === 200, "Delhi branch user can list loans");
  const foundInDelhi = delhiListData.data?.some((l) => l._id === loanId);
  assert(foundInDelhi, "Newly created loan appears in Delhi branch list");

  // Mumbai branch must NOT see Delhi loan
  const mumbaiListRes = await fetch(`${BASE_URL}/api/loans`, {
    headers: { Cookie: mumbaiActor.cookie },
  });
  const mumbaiListData = await mumbaiListRes.json();
  assert(mumbaiListRes.status === 200, "Mumbai branch user can list loans");
  const foundInMumbai = mumbaiListData.data?.some((l) => l._id === loanId);
  assert(!foundInMumbai, "Delhi loan is completely isolated and hidden from Mumbai branch list");

  // 5. Test Search & Filters
  console.log("\n--- 3. Testing Search & Filtering ---");
  const searchRes = await fetch(`${BASE_URL}/api/loans?search=Tanvi`, {
    headers: { Cookie: delhiActor.cookie },
  });
  const searchData = await searchRes.json();
  assert(searchData.data?.length >= 1 && searchData.data[0].studentName === "Tanvi Deshmukh", "Search by student name returns matching loan");

  const filterRes = await fetch(`${BASE_URL}/api/loans?status=Pending`, {
    headers: { Cookie: delhiActor.cookie },
  });
  const filterData = await filterRes.json();
  assert(filterData.data?.every((l) => l.status === "Pending"), "Filter by status 'Pending' returns only pending records");

  // 6. Test Loan Detail Page & Updating Branch Remarks
  console.log("\n--- 4. Testing Loan Detail & Counselor Remarks Update ---");
  const detailRes = await fetch(`${BASE_URL}/api/loans/${loanId}`, {
    headers: { Cookie: delhiActor.cookie },
  });
  const detailData = await detailRes.json();
  assert(detailRes.status === 200, "Delhi branch user can fetch loan details");
  assert(detailData.data?.currentStage === "Document Collection", "Current stage displayed accurately");

  // Update remarks
  const updateRemarksRes = await fetch(`${BASE_URL}/api/loans/${loanId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: delhiActor.cookie,
    },
    body: JSON.stringify({
      branchRemarks: "Updated: Financial guarantor ITR and property evaluation attached.",
    }),
  });
  const updateRemarksData = await updateRemarksRes.json();
  assert(updateRemarksRes.status === 200, "Branch counselor can update branchRemarks");
  assert(
    updateRemarksData.data?.branchRemarks === "Updated: Financial guarantor ITR and property evaluation attached.",
    "Updated branch remarks persisted successfully in database"
  );

  // 7. Cleanup test loan using SuperAdmin
  console.log("\n--- 5. Cleanup ---");
  const sa = await loginUser("superadmin@loanportal.internal", "SuperAdmin@2026!");
  const delRes = await fetch(`${BASE_URL}/api/loans/${loanId}`, {
    method: "DELETE",
    headers: { Cookie: sa.cookie },
  });
  assert(delRes.status === 200, "SuperAdmin cleaned up test loan");

  console.log("\n=================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) process.exit(1);
}

testPhase4().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
