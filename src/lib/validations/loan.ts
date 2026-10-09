import { z } from "zod";

const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{9,14}$/;

export const loanFormSchema = z.object({
  sdmId: z
    .string()
    .min(1, "SDM ID is required")
    .max(50, "SDM ID is too long")
    .trim(),
  studentName: z
    .string()
    .min(2, "Student name must be at least 2 characters")
    .max(120, "Student name cannot exceed 120 characters")
    .trim(),
  contactNumber: z
    .string()
    .min(10, "Contact number must be at least 10 digits")
    .max(18, "Contact number is too long")
    .regex(phoneRegex, "Please enter a valid phone number (e.g. +91 9876543210 or 9876543210)")
    .trim(),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  course: z
    .string()
    .min(2, "Course name is required")
    .max(100, "Course name is too long")
    .trim(),
  country: z
    .string()
    .min(2, "Destination country is required")
    .max(80, "Country name is too long")
    .trim(),
  loanAmount: z
    .number()
    .min(10000, "Loan amount must be at least ₹10,000")
    .max(500000000, "Loan amount cannot exceed ₹50,00,00,000"),
  intakeMonth: z
    .string()
    .min(1, "Intake month is required"),
  intakeYear: z
    .number()
    .int()
    .min(2024, "Intake year must be 2024 or later")
    .max(2030, "Intake year cannot exceed 2030"),
  parentGuardianIncomeSource: z
    .string()
    .min(2, "Parent/Guardian income source is required")
    .trim(),
  currentStage: z
    .string()
    .min(1, "Current stage is required")
    .trim(),
  branchRemarks: z
    .string()
    .max(2000, "Remarks cannot exceed 2000 characters")
    .default("")
    .optional(),
});

export type LoanFormData = z.infer<typeof loanFormSchema>;

export const INTAKE_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const INTAKE_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

export const WORKFLOW_STAGES = [
  "Initial Inquiry",
  "Document Collection",
  "Profile Evaluation",
  "Bank Verification",
  "Sanction Pending",
  "Sanctioned",
  "Disbursement Processed",
  "Visa Approved",
];

export const INCOME_SOURCES = [
  "Salaried (Private Sector)",
  "Salaried (Government / PSU)",
  "Business / Entrepreneurship",
  "Self-Employed Professional (Doctor, CA, Lawyer)",
  "Agriculture & Farming",
  "Rental / Investment Income",
  "NRI / Remittance",
  "Other Income Source",
];
