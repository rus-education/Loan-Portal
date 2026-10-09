import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBranch extends Document {
  name: string;
  code: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
      maxlength: [100, "Branch name cannot exceed 100 characters"],
    },
    code: {
      type: String,
      required: [true, "Branch code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
      maxlength: [20, "Branch code cannot exceed 20 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["active", "inactive"],
        message: "Status must be either active or inactive",
      },
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

BranchSchema.index({ name: 1 });
BranchSchema.index({ status: 1, name: 1 });

export const Branch: Model<IBranch> =
  mongoose.models.Branch || mongoose.model<IBranch>("Branch", BranchSchema);
