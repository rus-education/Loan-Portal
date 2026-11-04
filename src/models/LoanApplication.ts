import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { WorkflowStatus } from "@/types";

export interface IStatusHistoryItem {
  fromStatus: string;
  toStatus: string;
  changedBy: Types.ObjectId;
  changedByName?: string;
  remarks?: string;
  timestamp: Date;
}

export interface ILoanApplication extends Document {
  sdmId: string;
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
  loanAmount: number;
  neetScore?: number | null;
  coApplicantRelation?: string;
  coApplicantDetails?: string;
  branchId: Types.ObjectId;
  intakeMonth?: string;
  intakeYear?: number;
  parentGuardianIncomeSource?: string;
  currentStage: string;
  status: WorkflowStatus;
  statusHistory: IStatusHistoryItem[];
  branchRemarks?: string;
  adminRemarks?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const LoanApplicationSchema = new Schema<ILoanApplication>(
  {
    sdmId: {
      type: String,
      required: [true, "SDM ID is required"],
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
      maxlength: [120, "Student name cannot exceed 120 characters"],
      index: true,
    },
    contactNumber: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      index: true,
    },
    state: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    residentialAddress: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      index: true,
    },
    universityCollege: {
      type: String,
      trim: true,
      default: "",
    },
    course: {
      type: String,
      required: [true, "Course is required"],
      trim: true,
    },
    courseDuration: {
      type: String,
      trim: true,
      default: "",
    },
    loanAmount: {
      type: Number,
      required: [true, "Loan amount required is required"],
      min: [0, "Loan amount cannot be negative"],
    },
    neetScore: {
      type: Number,
      default: null,
      min: 0,
      max: 720,
    },
    coApplicantRelation: {
      type: String,
      trim: true,
      default: "",
    },
    coApplicantDetails: {
      type: String,
      trim: true,
      default: "",
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch reference is required"],
      index: true,
    },
    intakeMonth: {
      type: String,
      trim: true,
      default: "September",
    },
    intakeYear: {
      type: Number,
      default: () => new Date().getFullYear(),
      min: [2000, "Invalid intake year"],
      max: [2100, "Invalid intake year"],
    },
    parentGuardianIncomeSource: {
      type: String,
      trim: true,
      default: "Family / Co-Applicant",
    },
    currentStage: {
      type: String,
      required: [true, "Current stage is required"],
      trim: true,
      default: "Initial Inquiry",
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: [
          "Logged in",
          "In Process",
          "Sanctioned",
          "Disbursed",
          "Deffered",
          "No response",
          "Rejected",
          "Closed",
          "Pending",
          "Under Review",
          "Approved",
          "Completed",
          "On Hold",
        ],
        message: "Invalid workflow status",
      },
      default: "Logged in",
      index: true,
    },
    statusHistory: [
      {
        fromStatus: { type: String, required: true },
        toStatus: { type: String, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        changedByName: { type: String, default: "" },
        remarks: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    branchRemarks: {
      type: String,
      default: "",
      trim: true,
    },
    adminRemarks: {
      type: String,
      default: "",
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator user ID is required"],
      index: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-frequency search, filtering, and server-side pagination at 50,000+ scale
LoanApplicationSchema.index({ createdAt: -1, _id: -1 });
LoanApplicationSchema.index({ branchId: 1, createdAt: -1, _id: -1 });
LoanApplicationSchema.index({ branchId: 1, status: 1, createdAt: -1, _id: -1 });
LoanApplicationSchema.index({ status: 1, createdAt: -1, _id: -1 });
LoanApplicationSchema.index({ status: 1, loanAmount: -1, _id: -1 });
LoanApplicationSchema.index({ intakeYear: 1, intakeMonth: 1, createdAt: -1 });
LoanApplicationSchema.index({ sdmId: 1 });
LoanApplicationSchema.index({ studentName: 1 });
LoanApplicationSchema.index({ contactNumber: 1 });
LoanApplicationSchema.index({ email: 1 });
LoanApplicationSchema.index({ pincode: 1 });
LoanApplicationSchema.index({ loanAmount: -1, _id: -1 });
LoanApplicationSchema.index({ branchId: 1, sdmId: 1 });

export const LoanApplication: Model<ILoanApplication> =
  mongoose.models.LoanApplication ||
  mongoose.model<ILoanApplication>("LoanApplication", LoanApplicationSchema);
