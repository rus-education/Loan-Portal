import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { UserRole } from "@/types";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
  branchId?: Types.ObjectId | null;
  status: "active" | "inactive";
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false, // Hidden by default from queries for security
    },
    role: {
      type: String,
      enum: {
        values: ["SUPERADMIN", "ADMIN", "BRANCH_USER", "VIEWER"],
        message: "Invalid role specified",
      },
      required: [true, "User role is required"],
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
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
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Composite indexes for common queries
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ branchId: 1, role: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
