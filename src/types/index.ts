export type UserRole = "BRANCH_USER" | "ADMIN" | "VIEWER" | "SUPERADMIN";

export type WorkflowStatus =
  | "Pending"
  | "Under Review"
  | "In Progress"
  | "Approved"
  | "Rejected"
  | "Completed"
  | "On Hold";

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  branchId?: string | null;
  branchName?: string | null;
  isActive: boolean;
}

export interface StatusHistoryItem {
  _id?: string;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  changedByName?: string;
  remarks?: string;
  timestamp: string | Date;
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  badge?: string | number;
  roles?: UserRole[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
