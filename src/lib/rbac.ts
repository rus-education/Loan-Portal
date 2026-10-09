import { UserRole, UserSession } from "@/types";

export type Permission =
  | "loan:create"
  | "loan:read_all"
  | "loan:read_own_branch"
  | "loan:update_status"
  | "loan:update_admin_remarks"
  | "loan:update_branch_fields"
  | "loan:delete"
  | "user:manage"
  | "branch:manage"
  | "audit:view";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPERADMIN: [
    "loan:create",
    "loan:read_all",
    "loan:read_own_branch",
    "loan:update_status",
    "loan:update_admin_remarks",
    "loan:update_branch_fields",
    "loan:delete",
    "user:manage",
    "branch:manage",
    "audit:view",
  ],
  ADMIN: [
    "loan:read_all",
    "loan:read_own_branch",
    "loan:update_status",
    "loan:update_admin_remarks",
    "audit:view",
  ],
  BRANCH_USER: [
    "loan:create",
    "loan:read_own_branch",
    "loan:update_branch_fields",
  ],
  VIEWER: [
    "loan:read_all",
    "loan:read_own_branch",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

/**
 * Validates whether user has permission to view a specific loan
 */
export function canViewLoan(user: UserSession, loanBranchId: string): boolean {
  if (user.role === "SUPERADMIN" || user.role === "ADMIN" || user.role === "VIEWER") {
    return true;
  }
  if (user.role === "BRANCH_USER") {
    return Boolean(user.branchId && String(user.branchId) === String(loanBranchId));
  }
  return false;
}

/**
 * Validates which fields a given role can update on a loan application
 */
export function validateLoanUpdatePermissions(
  user: UserSession,
  loanBranchId: string,
  updateFields: Record<string, unknown>
): { allowed: boolean; reason?: string } {
  // 1. Viewer cannot update anything
  if (user.role === "VIEWER") {
    return { allowed: false, reason: "Viewers have read-only access and cannot modify applications" };
  }

  // 2. Superadmin has full modification rights
  if (user.role === "SUPERADMIN") {
    return { allowed: true };
  }

  // 3. Admin can update workflow status, admin remarks, and current processing stage
  if (user.role === "ADMIN") {
    const adminAllowedFields = new Set(["status", "adminRemarks", "currentStage", "statusRemarks"]);
    const requestedFields = Object.keys(updateFields);
    for (const field of requestedFields) {
      if (!adminAllowedFields.has(field)) {
        return {
          allowed: false,
          reason: `Admins can only update workflow status, admin remarks, and current stage. Field '${field}' is restricted.`,
        };
      }
    }
    return { allowed: true };
  }

  // 4. Branch user can only update their own branch's loan
  if (user.role === "BRANCH_USER") {
    if (!user.branchId || String(user.branchId) !== String(loanBranchId)) {
      return { allowed: false, reason: "Branch users cannot modify applications of other branches" };
    }

    // Branch users cannot touch status or adminRemarks
    if ("status" in updateFields) {
      return { allowed: false, reason: "Branch users cannot modify workflow status" };
    }
    if ("adminRemarks" in updateFields) {
      return { allowed: false, reason: "Branch users cannot modify admin remarks" };
    }
    if ("branchId" in updateFields) {
      return { allowed: false, reason: "Branch users cannot reassign branch ownership" };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: "Unauthorized role" };
}
