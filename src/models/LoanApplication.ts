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
  branchId: Types.ObjectId;
  course: string;
  country: string;
  loanAmount: number;
  intakeMonth: string;
  intakeYear: number;
  parentGuardianIncomeSource: string;
  currentStage: string;
  status: WorkflowStatus;
  statusHistory: IStatusHistoryItem[];
  branchRemarks: string;
  adminRemarks: string;
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
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      required: [true, "Branch reference is required"],
      index: true,
    },
    course: {
      type: String,
      required: [true, "Course is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      index: true,
    },
    loanAmount: {
      type: Number,
      required: [true, "Loan amount required is required"],
      min: [0, "Loan amount cannot be negative"],
    },
    intakeMonth: {
      type: String,
      required: [true, "Intake month is required"],
      trim: true,
    },
    intakeYear: {
      type: Number,
      required: [true, "Intake year is required"],
      min: [2000, "Invalid intake year"],
      max: [2100, "Invalid intake year"],
    },
    parentGuardianIncomeSource: {
      type: String,
      required: [true, "Parent/Guardian income source is required"],
      trim: true,
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
          "Pending",
          "Under Review",
          "In Progress",
          "Approved",
          "Rejected",
          "Completed",
          "On Hold",
        ],
        message: "Invalid workflow status",
      },
      default: "Pending",
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
LoanApplicationSchema.index({ loanAmount: -1, _id: -1 });
LoanApplicationSchema.index({ branchId: 1, sdmId: 1 });

export const LoanApplication: Model<ILoanApplication> =
  mongoose.models.LoanApplication ||
  mongoose.model<ILoanApplication>("LoanApplication", LoanApplicationSchema);
