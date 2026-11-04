import { formatCurrency } from "./utils";

export interface LoanWhatsAppPayload {
  studentName: string;
  contactNumber: string;
  email?: string;
  state?: string;
  pincode?: string;
  residentialAddress?: string;
  country: string;
  universityCollege?: string;
  course: string;
  courseDuration?: string;
  loanAmount: number | string;
  neetScore?: number | string | null;
  coApplicantRelation?: string;
  coApplicantDetails?: string;
  branchRemarks?: string;
  sdmId?: string;
  branchName?: string;
}

/**
 * Format Indian Lakhs / Crores string for high legibility
 */
function formatLakhsCrores(num: number | undefined): string {
  if (!num || isNaN(num) || num <= 0) return "";
  if (num >= 10000000) {
    const cr = (num / 10000000).toFixed(2).replace(/\.00$/, "");
    return `(${cr} Crore INR)`;
  }
  if (num >= 100000) {
    const lk = (num / 100000).toFixed(2).replace(/\.00$/, "");
    return `(${lk} Lakh INR)`;
  }
  return "";
}

/**
 * Clean phone number to 10-digit Indian standard
 */
export function cleanIndianPhoneNumber(rawPhone?: string): string {
  let cleaned = (rawPhone || "").replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.slice(0, 10);
}

/**
 * Generates a clean, professional, standardized WhatsApp message template
 * with NO EMOJIS, containing complete form data from all fields.
 */
export function generateWhatsAppMessage(data: LoanWhatsAppPayload): string {
  const numericAmount = Number(data.loanAmount) || 0;
  const formattedAmount = formatCurrency(numericAmount);
  const wordsAmount = formatLakhsCrores(numericAmount);
  const amountDisplay = wordsAmount ? `${formattedAmount} ${wordsAmount}` : formattedAmount;

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const studentMobile = cleanIndianPhoneNumber(data.contactNumber) || data.contactNumber || "N/A";
  const neetDisplay =
    data.neetScore !== undefined && data.neetScore !== null && data.neetScore !== ""
      ? `${data.neetScore} / 720 Marks`
      : "N/A";

  const lines: string[] = [
    `*STUDENT EDUCATION LOAN INTAKE SUMMARY*`,
    `----------------------------------------`,
    `*Application ID:* ${data.sdmId?.trim() || "(Assigned upon registration)"}`,
    `*Originating Branch:* ${data.branchName?.trim() || "Branch Office"}`,
    `*Submission Date:* ${dateStr}`,
    ``,
    `*1. STUDENT APPLICANT DETAILS*`,
    `- Student Name: ${data.studentName?.trim() || "N/A"}`,
    `- Contact Number: +91 ${studentMobile}`,
    `- Email ID: ${data.email?.trim() || "N/A"}`,
    `- State / UT: ${data.state?.trim() || "N/A"}`,
    `- 6-Digit PIN Code: ${data.pincode?.trim() || "N/A"}`,
    `- Residential Address (as per Aadhaar): ${data.residentialAddress?.trim() || "N/A"}`,
    ``,
    `*2. ADMISSION & UNIVERSITY DETAILS*`,
    `- Country Applied: ${data.country?.trim() || "N/A"}`,
    `- University / College: ${data.universityCollege?.trim() || "N/A"}`,
    `- Course Applied: ${data.course?.trim() || "N/A"}`,
    `- Course Duration: ${data.courseDuration?.trim() || "N/A"}`,
    `- NEET Score: ${neetDisplay}`,
    ``,
    `*3. LOAN REQUIREMENT & CO-APPLICANT DETAILS*`,
    `- Loan Requirement: ${amountDisplay}`,
    `- Co-Applicant Relation: ${data.coApplicantRelation?.trim() || "N/A"}`,
    `- Brief Details about Co-Applicant: ${data.coApplicantDetails?.trim() || "N/A"}`,
  ];

  if (data.branchRemarks && data.branchRemarks.trim()) {
    lines.push(``);
    lines.push(`*4. BRANCH REMARKS*`);
    lines.push(`- Remarks: ${data.branchRemarks.trim()}`);
  }

  lines.push(``);
  lines.push(`----------------------------------------`);
  lines.push(
    `Note: This customer application has been registered in the Loan Management Portal and forwarded to credit underwriting for processing.`
  );
  lines.push(
    `Please keep your original KYC documents, Aadhaar, and admission offer letter ready for bank verification.`
  );

  return lines.join("\n");
}

/**
 * Creates a direct WhatsApp click-to-chat URL:
 * https://wa.me/91{10digitPhone}?text={encodedText}
 */
export function getWhatsAppShareUrl(rawPhone: string, message: string): string {
  const phone = cleanIndianPhoneNumber(rawPhone);
  const encodedText = encodeURIComponent(message);
  if (phone && phone.length === 10) {
    return `https://wa.me/91${phone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

