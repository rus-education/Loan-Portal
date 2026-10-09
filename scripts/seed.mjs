import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

// Read .env.local or process.env
const envPath = path.resolve(process.cwd(), ".env.local");
let mongoUri = process.env.MONGODB_URI || "";

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("MONGODB_URI=")) {
      mongoUri = trimmed.replace("MONGODB_URI=", "").replace(/^["']|["']$/g, "").trim();
      break;
    }
  }
}

if (!mongoUri) {
  console.error("Error: MONGODB_URI environment variable is required.");
  process.exit(1);
}

console.log("Connecting to MongoDB Atlas at:", mongoUri.replace(/:[^:@]+@/, ":***@"));

const SEED_BRANCHES = [
  { name: "New Delhi Regional HQ", code: "NDLS", status: "active" },
  { name: "Mumbai Central", code: "BOM", status: "active" },
  { name: "Bengaluru Tech Hub", code: "BLR", status: "active" },
  { name: "Hyderabad Deccan", code: "HYD", status: "active" },
  { name: "Chennai City", code: "MAA", status: "active" },
  { name: "Kolkata Metro", code: "CCU", status: "active" },
  { name: "Pune Shivaji Nagar", code: "PNQ", status: "active" },
  { name: "Ahmedabad West", code: "AMD", status: "active" },
  { name: "Jaipur Pink City", code: "JAI", status: "active" },
  { name: "Chandigarh Capitol", code: "IXC", status: "active" },
  { name: "Lucknow Hazratganj", code: "LKO", status: "active" },
  { name: "Indore Vijay Nagar", code: "IDR", status: "active" },
  { name: "Kochi Marine Drive", code: "COK", status: "active" },
  { name: "Patna Fraser Road", code: "PAT", status: "active" },
  { name: "Bhopal MP Nagar", code: "BHO", status: "active" },
  { name: "Nagpur Dharampeth", code: "NAG", status: "active" },
  { name: "Surat Ring Road", code: "STV", status: "active" },
  { name: "Vadodara Alkapuri", code: "BDQ", status: "active" },
  { name: "Bhubaneswar Saheed Nagar", code: "BBI", status: "active" },
  { name: "Visakhapatnam Beach Road", code: "VTZ", status: "active" },
  { name: "Dehradun Rajpur Road", code: "DED", status: "active" },
  { name: "Coimbatore Gandhipuram", code: "CJB", status: "active" },
];

async function seed() {
  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully");

  const db = mongoose.connection.db;
  const branchesCol = db.collection("branches");
  const usersCol = db.collection("users");

  // 1. Seed Branches
  const branchMap = new Map();
  let branchesCreated = 0;
  for (const b of SEED_BRANCHES) {
    const existing = await branchesCol.findOne({ code: b.code });
    if (!existing) {
      const res = await branchesCol.insertOne({
        ...b,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      branchesCreated++;
      branchMap.set(b.code, res.insertedId);
    } else {
      branchMap.set(b.code, existing._id);
    }
  }
  console.log(`Branches: 22 configured (${branchesCreated} created, ${22 - branchesCreated} pre-existing).`);

  // 2. Hash passwords
  const superAdminHash = await bcrypt.hash("SuperAdmin@2026!", 12);
  const adminHash = await bcrypt.hash("Admin@2026!", 12);
  const branchUserHash = await bcrypt.hash("Branch@2026!", 12);
  const viewerHash = await bcrypt.hash("Viewer@2026!", 12);

  const delhiBranchId = branchMap.get("NDLS");
  const mumbaiBranchId = branchMap.get("BOM");

  const SEED_USERS = [
    {
      name: "Master SuperAdmin",
      email: "superadmin@loanportal.internal",
      phone: "+91 98765 00001",
      passwordHash: superAdminHash,
      role: "SUPERADMIN",
      status: "active",
      branchId: null,
    },
    {
      name: "Senior Loan Admin",
      email: "admin@loanportal.internal",
      phone: "+91 98765 00002",
      passwordHash: adminHash,
      role: "ADMIN",
      status: "active",
      branchId: null,
    },
    {
      name: "Delhi Branch Officer",
      email: "delhi.branch@loanportal.internal",
      phone: "+91 98765 00003",
      passwordHash: branchUserHash,
      role: "BRANCH_USER",
      status: "active",
      branchId: delhiBranchId,
    },
    {
      name: "Mumbai Branch Officer",
      email: "mumbai.branch@loanportal.internal",
      phone: "+91 98765 00004",
      passwordHash: branchUserHash,
      role: "BRANCH_USER",
      status: "active",
      branchId: mumbaiBranchId,
    },
    {
      name: "Executive Auditor",
      email: "viewer@loanportal.internal",
      phone: "+91 98765 00005",
      passwordHash: viewerHash,
      role: "VIEWER",
      status: "active",
      branchId: null,
    },
  ];

  let usersUpserted = 0;
  for (const u of SEED_USERS) {
    await usersCol.updateOne(
      { email: u.email },
      {
        $set: {
          name: u.name,
          phone: u.phone,
          passwordHash: u.passwordHash,
          role: u.role,
          status: u.status,
          branchId: u.branchId,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    usersUpserted++;
  }
  console.log(`Users: ${usersUpserted} seeded across all 4 roles.`);

  // 3. Seed Realistic Loan Applications if collection is empty/sparse
  const loansCol = db.collection("loanapplications");
  const existingLoansCount = await loansCol.countDocuments();
  if (existingLoansCount < 10) {
    console.log(`Found ${existingLoansCount} loan applications. Seeding 24 realistic applications for analytics...`);

    const adminUser = await usersCol.findOne({ role: "SUPERADMIN" });
    const adminId = adminUser?._id;

    const SAMPLE_LOANS = [
      {
        sdmId: "SDM-2026-001",
        studentName: "Aarav Sharma",
        contactNumber: "+91 98111 22334",
        branchCode: "NDLS",
        course: "MSc Computer Science",
        country: "United Kingdom",
        loanAmount: 3800000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Senior Software Architect (₹32 LPA)",
        currentStage: "Disbursement Complete",
        status: "Completed",
        branchRemarks: "Admitted to Imperial College London. Unconditional offer received.",
        adminRemarks: "Sanction letter issued and tuition fees wired to university account.",
        monthsAgo: 5,
      },
      {
        sdmId: "SDM-2026-002",
        studentName: "Ananya Iyer",
        contactNumber: "+91 98222 33445",
        branchCode: "BOM",
        course: "Master of Data Science",
        country: "United States",
        loanAmount: 5200000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business - Freight Forwarding & Logistics (₹45 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "CMU admission confirmed with I-20 received.",
        adminRemarks: "Pre-visa disbursement approved. Collateral verified.",
        monthsAgo: 4,
      },
      {
        sdmId: "SDM-2026-003",
        studentName: "Rohan Patel",
        contactNumber: "+91 98333 44556",
        branchCode: "BLR",
        course: "MBA Global Management",
        country: "France",
        loanAmount: 4200000,
        intakeMonth: "January",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - VP Marketing (₹38 LPA)",
        currentStage: "Tuition Wire Transferred",
        status: "Completed",
        branchRemarks: "INSEAD Singapore/France admit. Strong academic record.",
        adminRemarks: "Completed disbursement and document closure.",
        monthsAgo: 4,
      },
      {
        sdmId: "SDM-2026-004",
        studentName: "Sneha Reddy",
        contactNumber: "+91 98444 55667",
        branchCode: "HYD",
        course: "MS Artificial Intelligence",
        country: "Germany",
        loanAmount: 2600000,
        intakeMonth: "October",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Agriculture & Real Estate (₹28 LPA)",
        currentStage: "Credit Committee Evaluation",
        status: "In Progress",
        branchRemarks: "TUM Munich admit. Blocked account requirement included.",
        adminRemarks: "Underwriting in progress. Awaiting co-applicant income tax returns.",
        monthsAgo: 3,
      },
      {
        sdmId: "SDM-2026-005",
        studentName: "Karthik Subramanian",
        contactNumber: "+91 98555 66778",
        branchCode: "MAA",
        course: "MSc Automotive Engineering",
        country: "Germany",
        loanAmount: 2200000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Lead Engineer (₹22 LPA)",
        currentStage: "Documentation Verification",
        status: "Under Review",
        branchRemarks: "RWTH Aachen offer letter enclosed.",
        adminRemarks: "Verifying collateral property registration certificate.",
        monthsAgo: 3,
      },
      {
        sdmId: "SDM-2026-006",
        studentName: "Meera Chatterjee",
        contactNumber: "+91 98666 77889",
        branchCode: "CCU",
        course: "MA International Relations",
        country: "United Kingdom",
        loanAmount: 3100000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - College Professor (₹18 LPA)",
        currentStage: "Initial Branch Origination",
        status: "Pending",
        branchRemarks: "LSE offer letter received. Documents being collated.",
        adminRemarks: "",
        monthsAgo: 2,
      },
      {
        sdmId: "SDM-2026-007",
        studentName: "Devansh Kulkarni",
        contactNumber: "+91 98777 88990",
        branchCode: "PNQ",
        course: "MS Robotics & Autonomous Systems",
        country: "United States",
        loanAmount: 4800000,
        intakeMonth: "January",
        intakeYear: 2027,
        parentGuardianIncomeSource: "Business - Precision Tool Manufacturing (₹40 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "Georgia Tech offer. Excellent GRE 332.",
        adminRemarks: "Approved at 9.25% concessional interest rate.",
        monthsAgo: 2,
      },
      {
        sdmId: "SDM-2026-008",
        studentName: "Pooja Mehta",
        contactNumber: "+91 98888 99001",
        branchCode: "AMD",
        course: "Master of Finance",
        country: "Canada",
        loanAmount: 3400000,
        intakeMonth: "May",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business - Textile Exports (₹50 LPA)",
        currentStage: "Final Disbursal Done",
        status: "Completed",
        branchRemarks: "Rotman School of Management, Toronto.",
        adminRemarks: "All GIC and tuition dispatches executed successfully.",
        monthsAgo: 2,
      },
      {
        sdmId: "SDM-2026-009",
        studentName: "Vikram Rathore",
        contactNumber: "+91 98999 00112",
        branchCode: "JAI",
        course: "Master of Cyber Security",
        country: "Australia",
        loanAmount: 3900000,
        intakeMonth: "July",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Government Officer (₹20 LPA)",
        currentStage: "Credit Committee Evaluation",
        status: "In Progress",
        branchRemarks: "UNSW Sydney admission offer with 20% scholarship.",
        adminRemarks: "Net required loan amount reduced by scholarship grant.",
        monthsAgo: 1,
      },
      {
        sdmId: "SDM-2026-010",
        studentName: "Simran Kaur",
        contactNumber: "+91 98123 45678",
        branchCode: "IXC",
        course: "MSc Biotechnology",
        country: "United Kingdom",
        loanAmount: 3500000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Agriculture - Farm Owner (₹25 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "University of Edinburgh conditional offer.",
        adminRemarks: "Sanction letter generated and delivered to applicant.",
        monthsAgo: 1,
      },
      {
        sdmId: "SDM-2026-011",
        studentName: "Aditya Verma",
        contactNumber: "+91 98234 56789",
        branchCode: "LKO",
        course: "Master of Business Analytics",
        country: "Ireland",
        loanAmount: 2800000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Bank Manager (₹22 LPA)",
        currentStage: "Documentation Verification",
        status: "Under Review",
        branchRemarks: "Trinity College Dublin admission confirmed.",
        adminRemarks: "Underwriter reviewing sponsor statements.",
        monthsAgo: 1,
      },
      {
        sdmId: "SDM-2026-012",
        studentName: "Ishaan Joshi",
        contactNumber: "+91 98345 67890",
        branchCode: "IDR",
        course: "MS Civil Infrastructure",
        country: "United States",
        loanAmount: 4100000,
        intakeMonth: "January",
        intakeYear: 2027,
        parentGuardianIncomeSource: "Business - Construction Contractor (₹35 LPA)",
        currentStage: "Documentation Incomplete",
        status: "Rejected",
        branchRemarks: "Purdue University offer letter.",
        adminRemarks: "Rejected: Ineligible property title and non-responsive co-applicant.",
        monthsAgo: 1,
      },
      {
        sdmId: "SDM-2026-013",
        studentName: "Fathima Noor",
        contactNumber: "+91 98456 78901",
        branchCode: "COK",
        course: "Master of Public Health",
        country: "Sweden",
        loanAmount: 2400000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Chief Nurse Administrator (₹19 LPA)",
        currentStage: "Tuition Wire Transferred",
        status: "Completed",
        branchRemarks: "Karolinska Institute admit.",
        adminRemarks: "Completed full loan lifecycle and tuition remittance.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-014",
        studentName: "Alok Kumar Sinha",
        contactNumber: "+91 98567 89012",
        branchCode: "PAT",
        course: "MS Electrical Engineering",
        country: "United States",
        loanAmount: 4600000,
        intakeMonth: "August",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Railway Officer (₹24 LPA)",
        currentStage: "Credit Committee Evaluation",
        status: "In Progress",
        branchRemarks: "University of Illinois Urbana-Champaign (UIUC).",
        adminRemarks: "Credit committee evaluating collateral encumbrance certificate.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-015",
        studentName: "Tanvi Saxena",
        contactNumber: "+91 98678 90123",
        branchCode: "BHO",
        course: "Master of Design",
        country: "Italy",
        loanAmount: 2900000,
        intakeMonth: "October",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Professional - Architect (₹26 LPA)",
        currentStage: "Underwriting Evaluation",
        status: "Under Review",
        branchRemarks: "Politecnico di Milano admit.",
        adminRemarks: "Analyzing family cash flows and bank account balances.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-016",
        studentName: "Nikhil Deshmukh",
        contactNumber: "+91 98789 01234",
        branchCode: "NAG",
        course: "MS Mechanical Engineering",
        country: "Germany",
        loanAmount: 2300000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Agriculture & Agro Retail (₹20 LPA)",
        currentStage: "Initial Branch Origination",
        status: "Pending",
        branchRemarks: "University of Stuttgart admit letter verified.",
        adminRemarks: "",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-017",
        studentName: "Riddhi Shah",
        contactNumber: "+91 98890 12345",
        branchCode: "STV",
        course: "MSc International Management",
        country: "United Kingdom",
        loanAmount: 3600000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business - Diamond Polishing & Trading (₹60 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "King's College London admit with CAS issued.",
        adminRemarks: "Fast-track approved under HNWI sponsor policy.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-018",
        studentName: "Hardik Patel",
        contactNumber: "+91 98901 23456",
        branchCode: "BDQ",
        course: "MS Chemical Engineering",
        country: "United States",
        loanAmount: 4400000,
        intakeMonth: "January",
        intakeYear: 2027,
        parentGuardianIncomeSource: "Business - Industrial Chemicals (₹42 LPA)",
        currentStage: "Tuition Wire Transferred",
        status: "Completed",
        branchRemarks: "Texas A&M University admission.",
        adminRemarks: "Remittance completed. Candidate in transit.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-019",
        studentName: "Debasis Mohanty",
        contactNumber: "+91 98012 34567",
        branchCode: "BBI",
        course: "Master of Data Engineering",
        country: "Canada",
        loanAmount: 3200000,
        intakeMonth: "May",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Steel Plant General Manager (₹30 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "University of Waterloo admit.",
        adminRemarks: "Sanction letter dispatched to visa authority.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-020",
        studentName: "Sravani Raju",
        contactNumber: "+91 98124 57890",
        branchCode: "VTZ",
        course: "MS Supply Chain Management",
        country: "Netherlands",
        loanAmount: 3000000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - Port Logistics Manager (₹21 LPA)",
        currentStage: "Documentation Verification",
        status: "Under Review",
        branchRemarks: "Erasmus University Rotterdam offer.",
        adminRemarks: "Underwriter assessing exchange rate buffer.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-021",
        studentName: "Gaurav Negi",
        contactNumber: "+91 98235 68901",
        branchCode: "DED",
        course: "Master of Forestry & Climate Science",
        country: "Australia",
        loanAmount: 3300000,
        intakeMonth: "July",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Salaried - State Forest Service (₹23 LPA)",
        currentStage: "Initial Branch Origination",
        status: "Pending",
        branchRemarks: "University of Melbourne conditional offer.",
        adminRemarks: "",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-022",
        studentName: "Kavitha Ranganathan",
        contactNumber: "+91 98346 79012",
        branchCode: "CJB",
        course: "MS Textile Technology & Smart Materials",
        country: "Germany",
        loanAmount: 2500000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business - Cotton Ginning Mills (₹35 LPA)",
        currentStage: "Credit Committee Evaluation",
        status: "In Progress",
        branchRemarks: "TU Dresden admission confirmed.",
        adminRemarks: "Collateral mortgage verification ongoing.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-023",
        studentName: "Priyanka Nair",
        contactNumber: "+91 98457 80123",
        branchCode: "NDLS",
        course: "LLM International Commercial Law",
        country: "United Kingdom",
        loanAmount: 4500000,
        intakeMonth: "September",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Professional - Supreme Court Advocate (₹48 LPA)",
        currentStage: "Sanction Authorized",
        status: "Approved",
        branchRemarks: "University of Cambridge (Sidney Sussex College).",
        adminRemarks: "Full sanction authorized with zero processing fee concession.",
        monthsAgo: 0,
      },
      {
        sdmId: "SDM-2026-024",
        studentName: "Manish Agarwal",
        contactNumber: "+91 98568 91234",
        branchCode: "BOM",
        course: "MS Financial Mathematics",
        country: "United States",
        loanAmount: 5800000,
        intakeMonth: "August",
        intakeYear: 2026,
        parentGuardianIncomeSource: "Business - FMCG Wholesale (₹12 LPA)",
        currentStage: "Ineligible Financial Profile",
        status: "Rejected",
        branchRemarks: "NYU Courant admit.",
        adminRemarks: "Rejected: Inadequate debt service coverage ratio (DSCR < 0.65).",
        monthsAgo: 0,
      },
    ];

    const now = new Date();
    for (const loan of SAMPLE_LOANS) {
      const branchId = branchMap.get(loan.branchCode) || delhiBranchId;
      const createdDate = new Date(now.getFullYear(), now.getMonth() - loan.monthsAgo, 10 + Math.floor(Math.random() * 15));

      await loansCol.insertOne({
        sdmId: loan.sdmId,
        studentName: loan.studentName,
        contactNumber: loan.contactNumber,
        branchId,
        course: loan.course,
        country: loan.country,
        loanAmount: loan.loanAmount,
        intakeMonth: loan.intakeMonth,
        intakeYear: loan.intakeYear,
        parentGuardianIncomeSource: loan.parentGuardianIncomeSource,
        currentStage: loan.currentStage,
        status: loan.status,
        statusHistory: [
          {
            fromStatus: "Draft",
            toStatus: "Pending",
            changedBy: adminId,
            changedByName: "Branch Originator",
            remarks: "Application submitted with initial KYC and admission letter",
            timestamp: createdDate,
          },
          ...(loan.status !== "Pending"
            ? [
                {
                  fromStatus: "Pending",
                  toStatus: loan.status,
                  changedBy: adminId,
                  changedByName: "Underwriting Admin",
                  remarks: loan.adminRemarks || "Status progressed according to underwriting milestones",
                  timestamp: new Date(createdDate.getTime() + 4 * 24 * 60 * 60 * 1000),
                },
              ]
            : []),
        ],
        branchRemarks: loan.branchRemarks,
        adminRemarks: loan.adminRemarks,
        createdBy: adminId,
        updatedBy: adminId,
        createdAt: createdDate,
        updatedAt: createdDate,
      });
    }
    console.log(`Seeded ${SAMPLE_LOANS.length} loan applications successfully.`);
  }

  await mongoose.disconnect();
  console.log("Database seed completed successfully.");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
