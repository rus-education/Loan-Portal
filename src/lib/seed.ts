import { connectToDatabase } from "@/lib/db";
import { Branch, IBranch } from "@/models/Branch";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth";
import type { Types } from "mongoose";

export const SEED_BRANCHES = [
  { name: "New Delhi Regional HQ", code: "NDLS", status: "active" as const },
  { name: "Mumbai Central", code: "BOM", status: "active" as const },
  { name: "Bengaluru Tech Hub", code: "BLR", status: "active" as const },
  { name: "Hyderabad Deccan", code: "HYD", status: "active" as const },
  { name: "Chennai City", code: "MAA", status: "active" as const },
  { name: "Kolkata Metro", code: "CCU", status: "active" as const },
  { name: "Pune Shivaji Nagar", code: "PNQ", status: "active" as const },
  { name: "Ahmedabad West", code: "AMD", status: "active" as const },
  { name: "Jaipur Pink City", code: "JAI", status: "active" as const },
  { name: "Chandigarh Capitol", code: "IXC", status: "active" as const },
  { name: "Lucknow Hazratganj", code: "LKO", status: "active" as const },
  { name: "Indore Vijay Nagar", code: "IDR", status: "active" as const },
  { name: "Kochi Marine Drive", code: "COK", status: "active" as const },
  { name: "Patna Fraser Road", code: "PAT", status: "active" as const },
  { name: "Bhopal MP Nagar", code: "BHO", status: "active" as const },
  { name: "Nagpur Dharampeth", code: "NAG", status: "active" as const },
  { name: "Surat Ring Road", code: "STV", status: "active" as const },
  { name: "Vadodara Alkapuri", code: "BDQ", status: "active" as const },
  { name: "Bhubaneswar Saheed Nagar", code: "BBI", status: "active" as const },
  { name: "Visakhapatnam Beach Road", code: "VTZ", status: "active" as const },
  { name: "Dehradun Rajpur Road", code: "DED", status: "active" as const },
  { name: "Coimbatore Gandhipuram", code: "CJB", status: "active" as const },
];

export async function runDatabaseSeed() {
  await connectToDatabase();

  const results: {
    branchesCreated: number;
    branchesExisting: number;
    usersCreated: number;
    usersUpdated: number;
  } = {
    branchesCreated: 0,
    branchesExisting: 0,
    usersCreated: 0,
    usersUpdated: 0,
  };

  // 1. Seed Branches
  const branchMap = new Map<string, IBranch>();
  for (const b of SEED_BRANCHES) {
    let branch = await Branch.findOne({ code: b.code });
    if (!branch) {
      branch = await Branch.create(b);
      results.branchesCreated++;
    } else {
      results.branchesExisting++;
    }
    branchMap.set(b.code, branch);
  }

  // 2. Default Password Hashes
  const superAdminPasswordHash = await hashPassword("SuperAdmin@2026!");
  const adminPasswordHash = await hashPassword("Admin@2026!");
  const branchUserPasswordHash = await hashPassword("Branch@2026!");
  const viewerPasswordHash = await hashPassword("Viewer@2026!");

  const delhiBranch = branchMap.get("NDLS");
  const mumbaiBranch = branchMap.get("BOM");

  const SEED_USERS = [
    {
      name: "Master SuperAdmin",
      email: "superadmin@loanportal.internal",
      phone: "+91 98765 00001",
      passwordHash: superAdminPasswordHash,
      role: "SUPERADMIN" as const,
      status: "active" as const,
      branchId: null as Types.ObjectId | null,
    },
    {
      name: "Senior Loan Admin",
      email: "admin@loanportal.internal",
      phone: "+91 98765 00002",
      passwordHash: adminPasswordHash,
      role: "ADMIN" as const,
      status: "active" as const,
      branchId: null as Types.ObjectId | null,
    },
    {
      name: "Delhi Branch Officer",
      email: "delhi.branch@loanportal.internal",
      phone: "+91 98765 00003",
      passwordHash: branchUserPasswordHash,
      role: "BRANCH_USER" as const,
      status: "active" as const,
      branchId: (delhiBranch?._id as Types.ObjectId) || null,
    },
    {
      name: "Mumbai Branch Officer",
      email: "mumbai.branch@loanportal.internal",
      phone: "+91 98765 00004",
      passwordHash: branchUserPasswordHash,
      role: "BRANCH_USER" as const,
      status: "active" as const,
      branchId: (mumbaiBranch?._id as Types.ObjectId) || null,
    },
    {
      name: "Executive Auditor",
      email: "viewer@loanportal.internal",
      phone: "+91 98765 00005",
      passwordHash: viewerPasswordHash,
      role: "VIEWER" as const,
      status: "active" as const,
      branchId: null as Types.ObjectId | null,
    },
  ];

  for (const u of SEED_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create(u);
      results.usersCreated++;
    } else {
      existing.name = u.name;
      existing.role = u.role;
      existing.branchId = u.branchId;
      existing.status = u.status;
      existing.passwordHash = u.passwordHash;
      await existing.save();
      results.usersUpdated++;
    }
  }

  return {
    success: true,
    message: "Database seed executed successfully",
    results,
    credentials: {
      superadmin: { email: "superadmin@loanportal.internal", password: "SuperAdmin@2026!", role: "SUPERADMIN" },
      admin: { email: "admin@loanportal.internal", password: "Admin@2026!", role: "ADMIN" },
      delhiBranch: { email: "delhi.branch@loanportal.internal", password: "Branch@2026!", role: "BRANCH_USER", branch: "NDLS" },
      mumbaiBranch: { email: "mumbai.branch@loanportal.internal", password: "Branch@2026!", role: "BRANCH_USER", branch: "BOM" },
      viewer: { email: "viewer@loanportal.internal", password: "Viewer@2026!", role: "VIEWER" },
    },
  };
}
