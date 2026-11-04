import { z } from "zod";

// Indian 10-digit mobile number validation (with optional +91 or 0 prefix, starts with 6, 7, 8, or 9)
export const INDIAN_PHONE_REGEX = /^(?:(?:\+|0{0,2})91(\s*[-]\s*)?|[0]?)?[6789]\d{9}$/;

// Indian 6-digit postal code (PIN code, first digit 1-9, followed by 5 digits)
export const INDIAN_PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const loanFormSchema = z.object({
  // Student Name
  studentName: z
    .string()
    .min(2, "Student name must be at least 2 characters")
    .max(100, "Student name cannot exceed 100 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Student name should contain only English alphabets and spaces")
    .trim(),

  // Contact Number (Indian Mobile)
  contactNumber: z
    .string()
    .min(10, "Contact number must be at least 10 digits")
    .max(16, "Contact number is too long")
    .regex(
      INDIAN_PHONE_REGEX,
      "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 9876543210)"
    )
    .trim(),

  // Email id
  email: z
    .string()
    .min(1, "Email address is required")
    .email("Please enter a valid email address (e.g. student@gmail.com)")
    .trim()
    .toLowerCase(),

  // Residential Address (as mentioned in Aadhaar)
  residentialAddress: z
    .string()
    .min(5, "Please enter full residential address as mentioned in Aadhaar")
    .max(500, "Address cannot exceed 500 characters")
    .trim(),

  // 6 Digit Pincode
  pincode: z
    .string()
    .regex(INDIAN_PINCODE_REGEX, "Please enter a valid 6-digit Indian PIN code (e.g. 110001)")
    .trim(),

  // Country Applied
  country: z
    .string()
    .min(2, "Country applied is required")
    .max(80, "Country name is too long")
    .trim(),

  // University/College
  universityCollege: z
    .string()
    .min(2, "University / College name is required")
    .max(150, "University / College name is too long")
    .trim(),

  // Course Applied
  course: z
    .string()
    .min(2, "Course applied is required")
    .max(100, "Course name is too long")
    .trim(),

  // Course Duration
  courseDuration: z
    .string()
    .min(1, "Course duration is required")
    .max(50, "Course duration is too long")
    .trim(),

  // Loan Requirement (in INR ₹)
  loanAmount: z
    .number()
    .min(10000, "Loan requirement must be at least ₹10,000")
    .max(100000000, "Loan requirement cannot exceed ₹10,00,00,000"),

  // NEET Score (0 to 720)
  neetScore: z
    .number()
    .int("NEET score must be an integer")
    .min(0, "NEET score cannot be less than 0")
    .max(720, "NEET score cannot exceed 720 (Max NEET UG marks)")
    .nullable()
    .optional(),

  // Co-Applicant Relation (separate field)
  coApplicantRelation: z
    .string()
    .min(1, "Please select or specify relation with Co-Applicant")
    .trim(),

  // Brief details about Co Applicant
  coApplicantDetails: z
    .string()
    .min(3, "Please enter brief details about Co-Applicant (e.g. Name, Occupation, Income source)")
    .max(1000, "Co-applicant details cannot exceed 1000 characters")
    .trim(),

  // System & routing fields (optional)
  sdmId: z.string().trim().optional(),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  branchRemarks: z.string().max(2000).optional(),
});

export type LoanFormData = z.infer<typeof loanFormSchema>;

export const CO_APPLICANT_RELATIONS = [
  "Father",
  "Mother",
  "Guardian",
  "Brother",
  "Sister",
  "Spouse",
  "Uncle",
  "Other",
] as const;

export const POPULAR_COUNTRIES = [
  "Russia",
  "Georgia",
  "Kazakhstan",
  "Uzbekistan",
  "Kyrgyzstan",
  "Philippines",
  "Armenia",
  "Egypt",
  "Nepal",
  "Bangladesh",
  "Other",
] as const;

export const POPULAR_COURSES = [
  "MBBS",
  "MD (General Medicine)",
  "BDS (Dental Surgery)",
  "Nursing",
  "Pharmacy",
  "B.Tech / Engineering",
  "Management / MBA",
  "Other",
] as const;

export const COURSE_DURATIONS = [
  "5.8 Years",
  "6.0 Years",
  "5.0 Years",
  "4.5 Years",
  "4.0 Years",
  "3.0 Years",
  "2.0 Years",
  "Other",
] as const;

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
