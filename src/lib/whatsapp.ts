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
  neetScore?: number | null;
  coApplicantRelation?: string;
  coApplicantDetails?: string;
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
 * Generates a clean, professional, standardized WhatsApp message template
 * for student education loan counseling and intake.
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

  const lines: (string | null)[] = [
    `🎓 *STUDENT EDUCATION LOAN INTAKE SUMMARY* 🎓`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    data.sdmId ? `📋 *Application ID:* \`${data.sdmId}\`` : null,
    data.branchName ? `🏢 *Originating Branch:* ${data.branchName}` : null,
    `📅 *Submission Date:* ${dateStr}`,
    ``,
    `👤 *1. STUDENT APPLICANT DETAILS*`,
    `• *Full Name:* ${data.studentName}`,
    `• *Mobile Contact:* +91 ${data.contactNumber}`,
    data.email ? `• *Email ID:* ${data.email}` : null,
    data.state ? `• *State / UT:* ${data.state}` : null,
    data.pincode ? `• *PIN Code:* ${data.pincode}` : null,
    data.residentialAddress
      ? `• *Residential Address (Aadhaar):* ${data.residentialAddress}`
      : null,
    ``,
    `🏛️ *2. TARGET ADMISSION & UNIVERSITY*`,
    `• *Country Applied:* ${data.country}`,
    data.universityCollege ? `• *University / College:* ${data.universityCollege}` : null,
    `• *Course Applied:* ${data.course}`,
    data.courseDuration ? `• *Course Duration:* ${data.courseDuration}` : null,
    data.neetScore !== undefined && data.neetScore !== null && data.neetScore > 0
      ? `• *NEET UG Score:* ${data.neetScore} / 720 Marks`
      : null,
    ``,
    `💰 *3. FINANCIAL & CO-APPLICANT (PARENT) DETAILS*`,
    `• *Loan Requirement:* ${amountDisplay}`,
    data.coApplicantRelation ? `• *Co-Applicant Relation:* ${data.coApplicantRelation}` : null,
    data.coApplicantDetails
      ? `• *Co-Applicant Profile:* ${data.coApplicantDetails}`
      : null,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ _This customer application has been registered in the Loan Management Portal and forwarded to credit underwriting for processing._`,
    `📞 _Please keep your original KYC documents, Aadhaar, and admission offer letter ready for bank verification._`,
  ];

  return lines.filter((line) => line !== null).join("\n");
}

/**
 * Clean phone number to 10-digit Indian standard
 */
export function cleanIndianPhoneNumber(rawPhone: string): string {
  let cleaned = (rawPhone || "").replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.slice(0, 10);
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
